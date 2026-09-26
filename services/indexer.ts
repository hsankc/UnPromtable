import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeEventLog, getAddress, type Address, type Hex } from "viem";
import { allEvents } from "./lib/abis.js";
import { getLogsRaw, head, type RawLog } from "./lib/rpc.js";
import { CACHE_DIR, DEMO_VAULT, DEMO_VAULT_DEPLOY_BLOCK, REGISTRY_V2, REGISTRY_V2_BLOCK, TREASURY } from "./lib/env.js";

/**
 * A small log indexer for everything the site shows as history: the demo
 * vault's decisions, every vault created through registry v2, and every fee
 * that reached the treasury. It walks Monad testnet forward in 100-block
 * windows (the public RPC's eth_getLogs limit) and persists to disk, so a
 * restart only catches up the gap. Nothing here is estimated: every number
 * is a sum over decoded on-chain events.
 */

export type Decision = 0 | 1 | 2;

export interface DecisionEvent {
  vault: Address;
  decision: Decision;
  category: number | null; // null for the single-model KeylessVault
  pendingId?: string; // for Delayed: index into the vault's pending[]
  to: Address;
  amountWei: string;
  txHash: Hex;
  block: string;
  ts: number;
  logIndex: number;
}

export interface FeeEvent {
  kind: "creation" | "conversion" | "protocol";
  payer: Address; // who paid (vault owner, converter, or the paying vault)
  amountWei: string;
  vault?: Address;
  txHash: Hex;
  block: string;
  ts: number;
}

export interface VaultCreated {
  vault: Address;
  owner: Address;
  mask: number;
  feeWei: string;
  fundedWei: string;
  txHash: Hex;
  block: string;
  ts: number;
}

interface State {
  version: 2;
  cursor: string; // last block fully applied
  tracked: Record<string, string>; // address -> first block to scan from
  decisions: DecisionEvent[];
  fees: FeeEvent[];
  created: VaultCreated[];
}

const CACHE_FILE = path.join(CACHE_DIR, "index.json");
const CHUNK = 100n;
const WINDOW = 4; // chunks fetched in parallel, applied in order

// The demo vault was redeployed 2026-09-26 (see lib/env.ts's comment); no
// history is seeded here, the indexer does a real forward scan instead. The
// global cursor must start at the EARLIEST tracked address's block (registry
// v2 predates the redeploy by a lot) — starting it at the vault's own deploy
// block would skip the registry's real history, since the scan never looks
// behind the cursor.
function seedState(): State {
  const startBlock = DEMO_VAULT_DEPLOY_BLOCK < REGISTRY_V2_BLOCK ? DEMO_VAULT_DEPLOY_BLOCK : REGISTRY_V2_BLOCK;
  return {
    version: 2,
    cursor: (startBlock - 1n).toString(),
    tracked: { [DEMO_VAULT.toLowerCase()]: DEMO_VAULT_DEPLOY_BLOCK.toString(), [REGISTRY_V2.toLowerCase()]: REGISTRY_V2_BLOCK.toString() },
    decisions: [],
    fees: [],
    created: [],
  };
}

let state: State = seedState();
let headBlock = 0n;
let lastError: string | undefined;
let dirty = false;

async function load() {
  try {
    const raw = JSON.parse(await readFile(CACHE_FILE, "utf8")) as State;
    if (raw.version === 2) state = raw;
  } catch {
    // first run: keep the checkpoint seed
  }
}

async function save() {
  if (!dirty) return;
  dirty = false;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(state));
}

function addressesFor(to: bigint): Address[] {
  return Object.entries(state.tracked)
    .filter(([, start]) => BigInt(start) <= to)
    .map(([a]) => a as Address);
}

// An empty address list would make eth_getLogs return every log in range.
async function logsFor(from: bigint, to: bigint, addresses: Address[]) {
  return addresses.length ? getLogsRaw(from, to, addresses) : [];
}

function apply(logs: RawLog[]): Address[] {
  const discovered: Address[] = [];
  for (const log of logs) {
    let parsed;
    try {
      parsed = decodeEventLog({ abi: allEvents, data: log.data, topics: log.topics });
    } catch {
      continue; // an event we don't index
    }
    const block = BigInt(log.blockNumber).toString();
    const ts = log.blockTimestamp ? Number(BigInt(log.blockTimestamp)) * 1000 : Date.now();
    const from = getAddress(log.address);
    const args = parsed.args as Record<string, unknown>;
    const base = { txHash: log.transactionHash, block, ts };

    switch (parsed.eventName) {
      case "Executed":
      case "Delayed":
      case "Rejected": {
        const decision: Decision = parsed.eventName === "Executed" ? 0 : parsed.eventName === "Delayed" ? 1 : 2;
        const exists = state.decisions.some((d) => d.txHash === log.transactionHash && d.logIndex === Number(BigInt(log.logIndex)));
        if (exists) break;
        state.decisions.push({
          vault: from,
          decision,
          category: typeof args.category === "number" ? args.category : null,
          ...(decision === 1 ? { pendingId: (args.id as bigint).toString() } : {}),
          to: getAddress(args.to as string),
          amountWei: (args.amount as bigint).toString(),
          logIndex: Number(BigInt(log.logIndex)),
          ...base,
        });
        break;
      }
      case "ProtocolFee":
        state.fees.push({ kind: "protocol", payer: from, vault: from, amountWei: (args.fee as bigint).toString(), ...base });
        break;
      case "VaultCreated": {
        const vault = getAddress(args.vault as string);
        state.created.push({
          vault,
          owner: getAddress(args.owner as string),
          mask: Number(args.categoryBitmask),
          feeWei: (args.feePaid as bigint).toString(),
          fundedWei: (args.funded as bigint).toString(),
          ...base,
        });
        state.fees.push({ kind: "creation", payer: getAddress(args.owner as string), vault, amountWei: (args.feePaid as bigint).toString(), ...base });
        if (!state.tracked[vault.toLowerCase()]) {
          state.tracked[vault.toLowerCase()] = block;
          discovered.push(vault);
        }
        break;
      }
      case "ConversionPaid":
        state.fees.push({ kind: "conversion", payer: getAddress(args.payer as string), amountWei: (args.feePaid as bigint).toString(), ...base });
        break;
    }
  }
  dirty = true;
  return discovered;
}

async function scanLoop() {
  for (;;) {
    try {
      headBlock = await head();
      let cursor = BigInt(state.cursor);
      while (cursor < headBlock) {
        const ranges: [bigint, bigint][] = [];
        for (let i = 0; i < WINDOW && cursor + 1n + BigInt(i) * CHUNK <= headBlock; i++) {
          const from = cursor + 1n + BigInt(i) * CHUNK;
          const to = from + CHUNK - 1n > headBlock ? headBlock : from + CHUNK - 1n;
          ranges.push([from, to]);
        }
        const results = await Promise.all(ranges.map(([f, t]) => logsFor(f, t, addressesFor(t))));
        for (let i = 0; i < ranges.length; i++) {
          const found = apply(results[i]);
          // Vaults created inside this window can already have activity in
          // the rest of it; re-read those ranges for the new addresses only.
          if (found.length) {
            for (let j = i; j < ranges.length; j++) {
              const [f2, t2] = ranges[j];
              apply(await logsFor(f2, t2, found));
            }
          }
          cursor = ranges[i][1];
          state.cursor = cursor.toString();
        }
        await save();
      }
      lastError = undefined;
    } catch (err) {
      lastError = err instanceof Error ? err.message.split("\n")[0] : String(err);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function startIndexer() {
  await load();
  void scanLoop();
  setInterval(() => void save(), 5000).unref();
}

// ---------- read models ----------

const sum = (xs: { amountWei: string }[]) => xs.reduce((a, x) => a + BigInt(x.amountWei), 0n);

export function status() {
  const cursor = BigInt(state.cursor);
  return {
    head: headBlock.toString(),
    cursor: state.cursor,
    lagBlocks: headBlock > cursor ? (headBlock - cursor).toString() : "0",
    syncing: headBlock - cursor > 20n,
    error: lastError ?? null,
  };
}

function byNewest<T extends { block: string; ts: number }>(a: T, b: T) {
  return Number(BigInt(b.block) - BigInt(a.block)) || b.ts - a.ts;
}

export function vaultView(address: string, limit = 100) {
  const a = address.toLowerCase();
  const ds = state.decisions.filter((d) => d.vault.toLowerCase() === a).sort(byNewest);
  const fees = state.fees.filter((f) => f.kind === "protocol" && f.vault?.toLowerCase() === a);
  return {
    tracked: a in state.tracked,
    counts: { approved: ds.filter((d) => d.decision === 0).length, delayed: ds.filter((d) => d.decision === 1).length, rejected: ds.filter((d) => d.decision === 2).length },
    paidWei: sum(ds.filter((d) => d.decision === 0)).toString(),
    heldWei: sum(ds.filter((d) => d.decision === 1)).toString(),
    rejectedWei: sum(ds.filter((d) => d.decision === 2)).toString(),
    protocolFeesWei: sum(fees).toString(),
    decisions: ds.slice(0, limit),
  };
}

export function revenueView(limit = 20) {
  const by = (k: FeeEvent["kind"]) => sum(state.fees.filter((f) => f.kind === k));
  const creation = by("creation");
  const conversion = by("conversion");
  const protocol = by("protocol");
  return {
    treasury: TREASURY,
    creationWei: creation.toString(),
    conversionWei: conversion.toString(),
    protocolWei: protocol.toString(),
    totalWei: (creation + conversion + protocol).toString(),
    count: state.fees.length,
    recent: [...state.fees].sort(byNewest).slice(0, limit),
  };
}

export function overview() {
  return {
    status: status(),
    demo: { address: DEMO_VAULT, ...vaultView(DEMO_VAULT, 12) },
    revenue: revenueView(10),
    created: [...state.created].sort(byNewest).slice(0, 10),
    createdCount: state.created.length,
  };
}

export function recentDecisions(limit = 20) {
  return [...state.decisions].sort(byNewest).slice(0, limit);
}
