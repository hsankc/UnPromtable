import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FORGE_BIN, GUARD_DIR, PYTHON_BIN } from "./lib/env.js";

const execFileAsync = promisify(execFile);

// Must match generate_vault.py's CATEGORIES order exactly (bit i -> category i).
export const CATEGORY_KEYS = ["api_payment", "nft_purchase", "defi_swap", "subscription", "treasury_dao", "social_tip"] as const;

export function keysOfMask(mask: number): string[] {
  return CATEGORY_KEYS.filter((_, i) => mask & (1 << i));
}

export function maskOfKeys(keys: string[]): number {
  return keys.reduce((m, k) => {
    const i = CATEGORY_KEYS.indexOf(k as (typeof CATEGORY_KEYS)[number]);
    return i >= 0 ? m | (1 << i) : m;
  }, 0);
}

async function run(cmd: string, args: string[]) {
  return execFileAsync(cmd, args, { cwd: GUARD_DIR, maxBuffer: 32 * 1024 * 1024 });
}

export interface CompileResult {
  mask: number;
  keys: string[];
  creationCode: `0x${string}`;
  runtimeBytes: number;
  source: string;
}

const cache = new Map<number, Promise<CompileResult>>();

/**
 * Generates and forge-builds a vault contract for the given category mask.
 * Returns raw creation bytecode (no constructor args baked in) — the caller
 * appends abi-encoded (reputation, owner) itself, since owner is whichever
 * wallet is about to sign the deploy.
 */
export function compileVault(mask: number): Promise<CompileResult> {
  const cached = cache.get(mask);
  if (cached) return cached;
  const p = compileVaultUncached(mask).catch((err) => {
    cache.delete(mask);
    throw err;
  });
  cache.set(mask, p);
  return p;
}

async function compileVaultUncached(mask: number): Promise<CompileResult> {
  const keys = keysOfMask(mask);
  if (keys.length === 0) throw new Error("En az bir model seçilmeli.");
  const name = `WebVault${mask}`;
  const relOut = `src/generated/${name}.sol`;
  await run(PYTHON_BIN, ["generate_vault.py", ...keys, "--name", name, "--out", relOut]);
  await run(FORGE_BIN, ["build"]);
  const artifact = JSON.parse(await readFile(path.join(GUARD_DIR, `out/${name}.sol/${name}.json`), "utf8"));
  const source = await readFile(path.join(GUARD_DIR, relOut), "utf8");
  const runtimeBytes = (artifact.deployedBytecode.object.length - 2) / 2;
  return { mask, keys, creationCode: artifact.bytecode.object, runtimeBytes, source };
}
