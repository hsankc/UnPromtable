"use client";

import { useState } from "react";
import { keccak256, stringToHex, type Hex } from "viem";
import { useWallet } from "@/components/wallet/WalletProvider";
import { publicClient } from "./chain";
import { registryV2Abi } from "./abis";
import { REGISTRY_V2, CONVERSION_FEE_WEI } from "./deployments";
import { api } from "./api";

export interface ScanFinding {
  id: number;
  line: number;
  functionName: string;
  statement: string;
  kind: "native" | "erc20";
  toExpr: string;
  amountExpr: string;
  supported: boolean;
}

export interface ClassifiedFinding extends ScanFinding {
  category?: string;
  categoryLabel?: string;
  entry?: string;
  rationale: string;
  source: "gemini" | "mock";
}

export interface CompileCheck {
  ok: boolean;
  errors?: string;
  runtimeBytes?: number;
}

export interface PrecheckResult {
  findings: ScanFinding[];
  compile: CompileCheck;
  sourceHash: Hex;
}

export interface ConvertResult {
  findings: ClassifiedFinding[];
  patchedSource: string;
  patchedCompile: CompileCheck;
  suggestedMask: number;
}

type Phase = "input" | "checking" | "checked" | "paying" | "confirming-payment" | "converting" | "done" | "error";

function describe(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; code?: number };
  if (e?.code === 4001) return "İşlem cüzdanda reddedildi.";
  return e?.shortMessage ?? e?.message ?? "İşlem başarısız oldu.";
}

export function useContractX() {
  const w = useWallet();
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string>();
  const [precheck, setPrecheck] = useState<PrecheckResult>();
  const [result, setResult] = useState<ConvertResult>();
  const [payTxHash, setPayTxHash] = useState<Hex>();

  async function check(source: string) {
    setPhase("checking");
    setError(undefined);
    setResult(undefined);
    try {
      const r = await api<PrecheckResult>("/contractx/precheck", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
      setPrecheck(r);
      setPhase("checked");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function payAndConvert(source: string) {
    const client = w.walletClient();
    if (!client || !w.address) {
      setError("Önce cüzdanını bağla.");
      setPhase("error");
      return;
    }
    if (!precheck) return;
    setError(undefined);
    try {
      const alreadyPaid = await publicClient.readContract({
        address: REGISTRY_V2.address,
        abi: registryV2Abi,
        functionName: "paidConversion",
        args: [w.address, precheck.sourceHash],
      });
      if (!alreadyPaid) {
        setPhase("paying");
        const hash = await client.writeContract({
          address: REGISTRY_V2.address,
          abi: registryV2Abi,
          functionName: "payConversion",
          args: [precheck.sourceHash],
          value: CONVERSION_FEE_WEI,
          chain: client.chain,
          account: client.account!,
        });
        setPayTxHash(hash);
        setPhase("confirming-payment");
        await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      }

      setPhase("converting");
      const r = await api<ConvertResult>("/contractx/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, payer: w.address }),
      });
      setResult(r);
      setPhase("done");
    } catch (err) {
      setError(describe(err));
      setPhase("error");
    }
  }

  return {
    phase,
    error,
    precheck,
    result,
    payTxHash,
    check,
    payAndConvert,
    reset: () => {
      setPhase("input");
      setPrecheck(undefined);
      setResult(undefined);
      setError(undefined);
    },
  };
}

export function sourceHashOf(source: string): Hex {
  return keccak256(stringToHex(source));
}
