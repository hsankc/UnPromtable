"use client";

import { useState } from "react";
import { parseEther, type Address } from "viem";
import { useWallet } from "@/components/wallet/WalletProvider";
import { publicClient } from "./chain";
import { multiVaultAbi } from "./abis";

type Status = "idle" | "pending" | "confirming" | "done" | "error";

function describe(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; code?: number };
  if (e?.code === 4001) return "İşlem cüzdanda reddedildi.";
  return e?.shortMessage ?? e?.message ?? "İşlem başarısız oldu.";
}

/** Owner actions on a generated vault: fund, allowlist, veto, release. Each waits for real confirmation. */
export function useVaultActions(vault: Address, onDone?: () => void) {
  const w = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const [label, setLabel] = useState<string>();

  async function run(action: string, fn: (client: NonNullable<ReturnType<typeof w.walletClient>>) => Promise<`0x${string}`>) {
    const client = w.walletClient();
    if (!client) {
      setError("Önce cüzdanını bağla.");
      setStatus("error");
      return;
    }
    setLabel(action);
    setStatus("pending");
    setError(undefined);
    try {
      const hash = await fn(client);
      setStatus("confirming");
      await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      setStatus("done");
      onDone?.();
    } catch (err) {
      setError(describe(err));
      setStatus("error");
    }
  }

  return {
    status,
    error,
    label,
    fund: (amountMon: string) =>
      run("Fonlama", (client) => client.sendTransaction({ to: vault, value: parseEther(amountMon), chain: client.chain, account: client.account! })),
    setAllow: (address: Address, allow: boolean) =>
      run(allow ? "Güvenilir ekleme" : "Güvenilir çıkarma", (client) =>
        client.writeContract({ address: vault, abi: multiVaultAbi, functionName: "setAllow", args: [address, allow], chain: client.chain, account: client.account! }),
      ),
    veto: (id: bigint) =>
      run("Veto", (client) => client.writeContract({ address: vault, abi: multiVaultAbi, functionName: "veto", args: [id], chain: client.chain, account: client.account! })),
    release: (id: bigint) =>
      run("Serbest bırakma", (client) => client.writeContract({ address: vault, abi: multiVaultAbi, functionName: "release", args: [id], chain: client.chain, account: client.account! })),
    reset: () => {
      setStatus("idle");
      setError(undefined);
    },
  };
}
