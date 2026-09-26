"use client";

import { ShieldCheck } from "lucide-react";
import { useVaultChainState } from "@/lib/vaultChain";
import { formatMon } from "@/lib/format";
import { DEMO_VAULT } from "@/lib/deployments";
import styles from "./AgentPanel.module.css";

export function ProtectedAgentPanel() {
  const { state } = useVaultChainState(DEMO_VAULT.address, 8000);

  return (
    <div className={`${styles.panel} ${styles.ok}`}>
      <div className={styles.head}>
        <ShieldCheck size={18} strokeWidth={1.8} />
        <span className="title">Korumalı ajan</span>
        <span className={styles.example}>KeylessVault, gerçek zincir verisi</span>
      </div>
      <span className={`${styles.balance} num`}>{state ? formatMon(state.balanceWei) : "…"} MON</span>
      <div className={styles.bar}>
        <div className={`${styles.barFill} ${styles.barOk}`} style={{ width: "100%" }} />
      </div>
      <p className="caption subtle">Aynı saldırı denenir; kasanın içindeki model reddeder, bakiye yerinde kalır.</p>
    </div>
  );
}
