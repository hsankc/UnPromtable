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
  source: "claude" | "gemini" | "mock";
}

export interface CompileCheck {
  ok: boolean;
  errors?: string;
  runtimeBytes?: number;
}

export interface PrecheckResult {
  findings: ClassifiedFinding[];
  purpose: string;
  additionalConcerns: string[];
  compile: CompileCheck;
  sourceHash: Hex;
}

export interface SuggestedFilter {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  hasValue: boolean;
  valueLabel?: string;
  suggestedValue?: string;
  feeMon: number;
}

export interface ConvertResult {
  findings: ClassifiedFinding[];
  purpose: string;
  additionalConcerns: string[];
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
  const [filters, setFilters] = useState<SuggestedFilter[]>();
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filtersError, setFiltersError] = useState<string>();

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

  async function payAndConvert(source: string, valueWei: bigint = CONVERSION_FEE_WEI) {
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
          value: valueWei > CONVERSION_FEE_WEI ? valueWei : CONVERSION_FEE_WEI,
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

  async function loadFilters(source: string, description: string) {
    setFiltersLoading(true);
    setFiltersError(undefined);
    try {
      const r = await api<{ filters: SuggestedFilter[] }>("/contractx/filters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, description }),
      });
      setFilters(r.filters);
    } catch (err) {
      setFiltersError(err instanceof Error ? err.message : String(err));
    } finally {
      setFiltersLoading(false);
    }
  }

  return {
    phase,
    error,
    precheck,
    result,
    payTxHash,
    filters,
    filtersLoading,
    filtersError,
    check,
    payAndConvert,
    loadFilters,
    clearFilters: () => {
      setFilters(undefined);
      setFiltersError(undefined);
    },
    reset: () => {
      setPhase("input");
      setPrecheck(undefined);
      setResult(undefined);
      setError(undefined);
      setFilters(undefined);
    },
  };
}

export function sourceHashOf(source: string): Hex {
  return keccak256(stringToHex(source));
}
