"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "./chain";
import { multiVaultAbi, keylessVaultAbi, v2OnlyAbi } from "./abis";
import { DEMO_VAULT } from "./deployments";

export interface VaultChainState {
  owner: Address;
  balanceWei: bigint;
  mask: number; // 1 = single legacy model (api_payment) for the demo vault
  legacy: boolean; // true = original KeylessVault (no CATEGORY_MASK/day-cap getters split out)
  delaySeconds: number;
  hardCapBps: number;
  unknownDailyBps: number;
  dayCapWei: bigint;
  dayUnknownOutWei: bigint;
  hasProtocolFee: boolean;
  protocolFeeBps?: number;
}

async function readVaultState(address: Address): Promise<VaultChainState> {
  const isDemo = address.toLowerCase() === DEMO_VAULT.address.toLowerCase();
  const balanceWei = await publicClient.getBalance({ address });

  if (isDemo) {
    // KeylessVault (the original single-model vault) declares the same
    // public day-cap fields as the generated vaults, just not CATEGORY_MASK —
    // the selectors match, so reading them through multiVaultAbi is fine.
    const [owner, dayCap, dayUnknownOut] = await Promise.all([
      publicClient.readContract({ address, abi: keylessVaultAbi, functionName: "owner" }),
      publicClient.readContract({ address, abi: multiVaultAbi, functionName: "dayCap" }),
      publicClient.readContract({ address, abi: multiVaultAbi, functionName: "dayUnknownOut" }),
    ]);
    return {
      owner,
      balanceWei,
      mask: 1,
      legacy: true,
      delaySeconds: 600,
      hardCapBps: 2000,
      unknownDailyBps: 100,
      dayCapWei: dayCap,
      dayUnknownOutWei: dayUnknownOut,
      hasProtocolFee: false,
    };
  }

  const [owner, mask, delay, hardCapBps, unknownDailyBps, dayCap, dayUnknownOut] = await Promise.all([
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "owner" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "CATEGORY_MASK" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "DELAY" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "HARD_CAP_BPS" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "UNKNOWN_DAILY_BPS" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "dayCap" }),
    publicClient.readContract({ address, abi: multiVaultAbi, functionName: "dayUnknownOut" }),
  ]);

  let protocolFeeBps: number | undefined;
  try {
    protocolFeeBps = Number(await publicClient.readContract({ address, abi: v2OnlyAbi, functionName: "PROTOCOL_FEE_BPS" }));
  } catch {
    protocolFeeBps = undefined;
  }

  return {
    owner,
    balanceWei,
    mask,
    legacy: false,
    delaySeconds: Number(delay),
    hardCapBps: Number(hardCapBps),
    unknownDailyBps: Number(unknownDailyBps),
    dayCapWei: dayCap,
    dayUnknownOutWei: dayUnknownOut,
    hasProtocolFee: protocolFeeBps !== undefined,
    protocolFeeBps,
  };
}

export function useVaultChainState(address: Address | undefined, intervalMs = 15000) {
  const [state, setState] = useState<VaultChainState>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    if (!address) return;
    readVaultState(address)
      .then(setState)
      .catch(() => setError("Kasa okunamadı. Adres yanlış olabilir ya da RPC'ye ulaşılamıyor."));
  }, [address]);

  useEffect(() => {
    if (!address) return;
    setState(undefined);
    setError(undefined);
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [address, intervalMs, load]);

  return { state, error, refresh: load };
}

export interface PendingEntry {
  id: bigint;
  to: Address;
  amount: bigint;
  releaseAt: number;
  vetoed: boolean;
  done: boolean;
}

export async function readPending(address: Address, id: bigint): Promise<PendingEntry> {
  const abi = address.toLowerCase() === DEMO_VAULT.address.toLowerCase() ? keylessVaultAbi : multiVaultAbi;
  const [to, amount, releaseAt, vetoed, done] = await publicClient.readContract({ address, abi, functionName: "pending", args: [id] });
  return { id, to, amount, releaseAt: Number(releaseAt), vetoed, done };
}
