"use client";

import { useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";

// Shapes returned by services/api.ts (proxied at /svc). Amounts are wei strings.

export type Decision = 0 | 1 | 2;

export interface DecisionEvent {
  vault: Address;
  decision: Decision;
  category: number | null;
  pendingId?: string;
  to: Address;
  amountWei: string;
  txHash: Hex;
  block: string;
  ts: number;
  logIndex: number;
}

export interface FeeEvent {
  kind: "creation" | "conversion" | "protocol";
  payer: Address;
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

export interface IndexStatus {
  head: string;
  cursor: string;
  lagBlocks: string;
  syncing: boolean;
  error: string | null;
}

export interface VaultView {
  tracked: boolean;
  counts: { approved: number; delayed: number; rejected: number };
  paidWei: string;
  heldWei: string;
  rejectedWei: string;
  protocolFeesWei: string;
  decisions: DecisionEvent[];
}

export interface RevenueView {
  treasury: Address;
  creationWei: string;
  conversionWei: string;
  protocolWei: string;
  totalWei: string;
  count: number;
  recent: FeeEvent[];
}

export interface Overview {
  status: IndexStatus;
  demo: VaultView & { address: Address };
  revenue: RevenueView;
  created: VaultCreated[];
  createdCount: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/svc${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `İstek başarısız (${res.status}).`);
  return body as T;
}

/** Polls a GET endpoint. `data` keeps the last good value if a poll fails. */
export function useApi<T>(path: string | null, intervalMs = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      api<T>(path)
        .then((d) => {
          if (!alive || pathRef.current !== path) return;
          setData(d);
          setError(undefined);
        })
        .catch((e: Error) => alive && setError(e.message));
    load();
    if (!intervalMs) return () => void (alive = false);
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, intervalMs]);

  return { data, error, loading: data === undefined && !error };
}
