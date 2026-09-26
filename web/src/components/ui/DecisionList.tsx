"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { DecisionEvent } from "@/lib/api";
import { txUrl } from "@/lib/chain";
import { DEMO_VAULT } from "@/lib/deployments";
import { formatMon, shortAddr, timeAgo } from "@/lib/format";
import { modelById } from "@/lib/models";
import { DecisionTag } from "./DecisionTag";
import styles from "./DecisionList.module.css";

const keyOf = (d: DecisionEvent) => `${d.txHash}-${d.logIndex}`;

export function vaultLabel(addr: string) {
  return addr.toLowerCase() === DEMO_VAULT.address.toLowerCase() ? "Demo kasa" : shortAddr(addr);
}

/**
 * On-chain decisions, newest first. Rows that arrive after the first render
 * slide in at the top and hold a brief highlight so a new verdict is noticed.
 */
export function DecisionList({ items, showVault = true, empty }: { items: DecisionEvent[]; showVault?: boolean; empty?: React.ReactNode }) {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const keys = items.map(keyOf);
    if (known.current === null) {
      known.current = new Set(keys);
      return;
    }
    const added = keys.filter((k) => !known.current!.has(k));
    added.forEach((k) => known.current!.add(k));
    if (added.length) setFresh(new Set(added));
  }, [items]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) return <div className={styles.empty}>{empty ?? "Henüz karar yok."}</div>;

  return (
    <ul className={styles.list}>
      {items.map((d) => {
        const model = d.category === null ? undefined : modelById(d.category);
        return (
          <li key={keyOf(d)} className={`${styles.row} ${fresh.has(keyOf(d)) ? styles.fresh : ""}`}>
            <DecisionTag decision={d.decision} />
            <span className={`num ${styles.amount}`}>{formatMon(BigInt(d.amountWei))} MON</span>
            <span className={styles.meta}>
              <span className="mono">{shortAddr(d.to)}</span>
              {showVault && (
                <Link href={`/app/kontratlar/${d.vault}`} className={styles.vault}>
                  {vaultLabel(d.vault)}
                  {model ? `, ${model.short}` : ""}
                </Link>
              )}
            </span>
            <span className={`caption subtle ${styles.time}`}>{timeAgo(d.ts, now)}</span>
            <a className={styles.tx} href={txUrl(d.txHash)} target="_blank" rel="noreferrer" aria-label="İşlemi explorer'da aç">
              <ExternalLink size={16} strokeWidth={1.8} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
