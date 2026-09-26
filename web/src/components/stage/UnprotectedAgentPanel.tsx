"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import styles from "./AgentPanel.module.css";

const START = 1;
const DRAIN_SECONDS = 8;

/**
 * A side-by-side illustration, not a real contract: no unprotected agent
 * actually holds funds here. Runs a simple visual countdown so the contrast
 * with the real, flat KeylessVault balance next to it reads at a glance.
 */
export function UnprotectedAgentPanel() {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setT((x) => (x + 0.1) % (DRAIN_SECONDS + 3)), 100);
    return () => clearInterval(id);
  }, [reduced]);

  const drained = Math.min(1, t / DRAIN_SECONDS);
  const balance = reduced ? 0 : START * (1 - drained);

  return (
    <div className={`${styles.panel} ${styles.danger}`}>
      <div className={styles.head}>
        <AlertTriangle size={18} strokeWidth={1.8} />
        <span className="title">Korumasız ajan</span>
        <span className={styles.example}>örnek, gerçek kontrat değil</span>
      </div>
      <span className={`${styles.balance} num`}>{balance.toFixed(3)} MON</span>
      <div className={styles.bar}>
        <div className={`${styles.barFill} ${styles.barDanger}`} style={{ width: `${(1 - drained) * 100}%` }} />
      </div>
      <p className="caption subtle">Anahtarı ajanda olsaydı, tek bir ikna edici cümle kasayı böyle boşaltırdı.</p>
    </div>
  );
}
