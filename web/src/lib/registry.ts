"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "./chain";
import { registryV1Abi, registryV2Abi } from "./abis";
import { REGISTRY_V1, REGISTRY_V2 } from "./deployments";

export interface RegistryEntry {
  vault: Address;
  owner: Address;
  mask: number;
  feeWei: bigint;
  deployedAt: number; // ms
  version: 1 | 2;
}

export async function readRegistries(): Promise<RegistryEntry[]> {
  const [v2, v1] = await Promise.all([
    publicClient.readContract({ address: REGISTRY_V2.address, abi: registryV2Abi, functionName: "allVaults" }),
    publicClient.readContract({ address: REGISTRY_V1.address, abi: registryV1Abi, functionName: "allVaults" }),
  ]);
  const map = (version: 1 | 2) => (e: { vault: Address; owner: Address; categoryBitmask: number; feePaid: bigint; deployedAt: bigint }) => ({
    vault: e.vault,
    owner: e.owner,
    mask: e.categoryBitmask,
    feeWei: e.feePaid,
    deployedAt: Number(e.deployedAt) * 1000,
    version,
  });
  return [...v2.map(map(2)), ...v1.map(map(1))].sort((a, b) => b.deployedAt - a.deployedAt);
}

export function useRegistries(intervalMs = 0) {
  const [entries, setEntries] = useState<RegistryEntry[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let alive = true;
    const load = () =>
      readRegistries()
        .then((e) => {
          if (!alive) return;
          setEntries(e);
          setError(undefined);
        })
        .catch(() => alive && setError("Registry okunamadı. Monad RPC'ye ulaşılamıyor olabilir."));
    load();
    const id = intervalMs ? setInterval(load, intervalMs) : undefined;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, [intervalMs]);
  return { entries, error };
}
