"use client";

import { useEffect, useState } from "react";
import { guardLabAbi } from "./abis";
import { publicClient } from "./chain";
import { GUARD_LAB } from "./deployments";
import type { Decision } from "./models";

export interface LabResult {
  decision: Decision;
  logits: [bigint, bigint, bigint];
}

/** Runs a feature vector through the deployed model with an eth_call. */
export async function decideOnChain(category: number, x: number[]): Promise<LabResult> {
  const [d, o] = await publicClient.readContract({
    address: GUARD_LAB,
    abi: guardLabAbi,
    functionName: "decide",
    args: [category, x.map((v) => BigInt(Math.trunc(v))) as unknown as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]],
  });
  return { decision: d as Decision, logits: [o[0], o[1], o[2]] };
}

export function useOnChainDecision(category: number | undefined, x: number[] | undefined) {
  const [result, setResult] = useState<LabResult>();
  const [error, setError] = useState<string>();
  const key = category === undefined || !x ? null : `${category}:${x.join(",")}`;
  useEffect(() => {
    if (key === null || category === undefined || !x) return;
    let alive = true;
    setResult(undefined);
    setError(undefined);
    decideOnChain(category, x)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setError("Zincire ulaşılamadı."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { result, error };
}
