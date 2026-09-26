"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/brand/Logo";
import { DecisionList } from "@/components/ui/DecisionList";
import { UnprotectedAgentPanel } from "@/components/stage/UnprotectedAgentPanel";
import { ProtectedAgentPanel } from "@/components/stage/ProtectedAgentPanel";
import { useApi, type VaultView } from "@/lib/api";
import { useVaultChainState } from "@/lib/vaultChain";
import { useCountUp } from "@/lib/motion";
import { DEMO_VAULT } from "@/lib/deployments";
import { formatMon } from "@/lib/format";
import styles from "./page.module.css";

export default function SahnePage() {
  const view = useApi<VaultView>(`/index/vault/${DEMO_VAULT.address}`, 5000);
  const { state } = useVaultChainState(DEMO_VAULT.address, 8000);
  const [phoneUrl, setPhoneUrl] = useState("");

  useEffect(() => {
    setPhoneUrl(`${window.location.origin}/sahne/telefon`);
  }, []);

  const blockedWei = view.data ? BigInt(view.data.rejectedWei) + BigInt(view.data.heldWei) : undefined;
  const blockedMon = blockedWei !== undefined ? Number(formatMon(blockedWei, 6).replace(",", ".")) : undefined;
  const shown = useCountUp(blockedMon, blockedMon !== undefined);

  const dailyPct = state && state.dayCapWei > 0n ? Math.min(100, Number((state.dayUnknownOutWei * 10000n) / state.dayCapWei) / 100) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><Mark size={26} /></Link>
        {phoneUrl && (
          <div className={styles.qr}>
            <span className="caption subtle">Telefonundan katıl</span>
            <span className={`mono ${styles.qrUrl}`}>{phoneUrl}</span>
          </div>
        )}
      </header>

      <div className={styles.topStrip}>
        <div className={styles.blocked}>
          <span className="caption subtle">Engellenen toplam</span>
          <span className={`${styles.blockedNum} num`}>
            {blockedMon === undefined ? "…" : shown.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <small>MON</small>
          </span>
        </div>
        <div className={styles.budget}>
          <span className="caption subtle">Tanınmayana günlük bütçe</span>
          <div className={styles.budgetBar}>
            <div className={styles.budgetFill} style={{ width: `${dailyPct}%` }} />
          </div>
          <span className="caption subtle num">
            {state ? `${formatMon(state.dayUnknownOutWei)} / ${formatMon(state.dayCapWei)} MON` : "…"}
          </span>
        </div>
      </div>

      <main className={styles.feed}>
        {view.data ? <DecisionList items={view.data.decisions} showVault={false} /> : <p className="body muted">Okunuyor…</p>}
      </main>

      <div className={styles.agents}>
        <UnprotectedAgentPanel />
        <ProtectedAgentPanel />
      </div>
    </div>
  );
}
