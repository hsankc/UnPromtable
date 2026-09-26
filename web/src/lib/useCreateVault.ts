"use client";

import { useState } from "react";
import { concatHex, decodeEventLog, encodeAbiParameters, type Address } from "viem";
import { useWallet } from "@/components/wallet/WalletProvider";
import { publicClient } from "./chain";
import { registryV2Abi } from "./abis";
import { REGISTRY_V2, REPUTATION } from "./deployments";
import { api } from "./api";

export interface CompileResult {
  mask: number;
  keys: string[];
  creationCode: `0x${string}`;
  runtimeBytes: number;
  source: string;
}

type Status = "idle" | "compiling" | "compiled" | "pending" | "confirming" | "done" | "error";

function describe(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; code?: number };
  if (e?.code === 4001) return "İşlem cüzdanda reddedildi.";
  const msg = e?.shortMessage ?? e?.message ?? "İşlem başarısız oldu.";
  if (/insufficient funds/i.test(msg)) return "Cüzdanında yeterli MON yok. Faucet'ten al.";
  return msg;
}

export function useCreateVault() {
  const w = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const [compiled, setCompiled] = useState<CompileResult>();
  const [vaultAddress, setVaultAddress] = useState<Address>();
  const [txHash, setTxHash] = useState<`0x${string}`>();

  async function compile(mask: number) {
    setStatus("compiling");
    setError(undefined);
    setCompiled(undefined);
    try {
      const r = await api<CompileResult>("/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mask }) });
      setCompiled(r);
      setStatus("compiled");
      return r;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      return undefined;
    }
  }

  async function create(fundWei: bigint, feeWei: bigint) {
    const client = w.walletClient();
    const c = compiled;
    if (!client || !w.address) {
      setError("Önce cüzdanını bağla.");
      setStatus("error");
      return;
    }
    if (!c) {
      setError("Önce kontratı derle.");
      setStatus("error");
      return;
    }
    setStatus("pending");
    setError(undefined);
    try {
      const initCode = concatHex([c.creationCode, encodeAbiParameters([{ type: "address" }, { type: "address" }], [REPUTATION, w.address])]);
      const value = feeWei + fundWei;
      let gas: bigint;
      try {
        const est = await publicClient.estimateContractGas({
          address: REGISTRY_V2.address,
          abi: registryV2Abi,
          functionName: "createVault",
          args: [initCode, c.mask],
          value,
          account: w.address,
        });
        gas = (est * 14n) / 10n;
      } catch {
        // Monad's eth_estimateGas has under-priced cold storage writes before;
        // fall back to a generous fixed budget scaled by model count.
        gas = 1_800_000n + BigInt(c.keys.length) * 900_000n;
      }
      const hash = await client.writeContract({
        address: REGISTRY_V2.address,
        abi: registryV2Abi,
        functionName: "createVault",
        args: [initCode, c.mask],
        value,
        gas,
        chain: client.chain,
        account: client.account!,
      });
      setTxHash(hash);
      setStatus("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });

      // Monad receipts have reported "reverted" on transactions that actually
      // succeeded, so success is read from the VaultCreated log and the
      // deployed vault's own code, never from receipt.status.
      let vault: Address | undefined;
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({ abi: registryV2Abi, data: log.data, topics: log.topics });
          if (parsed.eventName === "VaultCreated" && parsed.args.owner.toLowerCase() === w.address.toLowerCase()) {
            vault = parsed.args.vault;
          }
        } catch {
          // another log in the same tx (e.g. from CREATE's internals); skip
        }
      }
      if (!vault) throw new Error("İşlem gitti ama kasa adresi okunamadı. Kontratlar sayfasından kontrol et.");
      const code = await publicClient.getCode({ address: vault });
      if (!code || code === "0x") throw new Error("Kasa zincirde bulunamadı. Tekrar dene.");

      setVaultAddress(vault);
      setStatus("done");
    } catch (err) {
      setError(describe(err));
      setStatus("error");
    }
  }

  return { status, error, compiled, vaultAddress, txHash, compile, create, reset: () => setStatus(compiled ? "compiled" : "idle") };
}
