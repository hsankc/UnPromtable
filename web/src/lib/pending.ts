"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useApi, type DecisionEvent } from "./api";
import { readPending, type PendingEntry } from "./vaultChain";

/** Bekleyen ödemeler: API'den gelen Delayed olaylarının zincirdeki güncel durumu. */
export function usePendingPayments(vault: Address | undefined) {
  const decisions = useApi<{ decisions: DecisionEvent[] }>(vault ? `/index/vault/${vault}` : null, 8000);
  const delayed = decisions.data?.decisions.filter((d) => d.decision === 1 && d.pendingId !== undefined) ?? [];
  const [entries, setEntries] = useState<PendingEntry[]>();

  const key = delayed.map((d) => d.pendingId).join(",");
  useEffect(() => {
    if (!vault || delayed.length === 0) {
      setEntries(delayed.length === 0 ? [] : undefined);
      return;
    }
    let alive = true;
    Promise.all(delayed.map((d) => readPending(vault, BigInt(d.pendingId!))))
      .then((rows) => alive && setEntries(rows.sort((a, b) => a.releaseAt - b.releaseAt)))
      .catch(() => alive && setEntries(undefined));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, key]);

  return { entries, loading: entries === undefined };
}
