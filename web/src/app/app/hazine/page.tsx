"use client";

import { PageHead, Panel, StatRow, AddressLink, TxLink } from "@/components/app/ui";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useApi, type RevenueView, type FeeEvent } from "@/lib/api";
import { TREASURY } from "@/lib/deployments";
import { formatMon, shortAddr, timeAgo } from "@/lib/format";
import styles from "./page.module.css";

const KIND_LABEL: Record<FeeEvent["kind"], string> = {
  creation: "Kasa oluşturma",
  conversion: "ContractX dönüşümü",
  protocol: "Protokol payı",
};

export default function HazinePage() {
  const w = useWallet();
  const revenue = useApi<RevenueView>("/index/revenue", 8000);
  const isTreasuryOwner = !!w.address && w.address.toLowerCase() === TREASURY.toLowerCase();

  return (
    <>
      <PageHead title="Hazine">
        Platformun aldığı her ücret zincirden okunuyor. Kimse elle toplamaz; her ödeme aynı işlemde bu adrese gider.
      </PageHead>

      <Panel>
        <div className={styles.treasuryRow}>
          <div>
            <span className="caption subtle">Hazine adresi</span>
            <div className={styles.addr}>
              <AddressLink address={TREASURY} full />
            </div>
          </div>
          {isTreasuryOwner && <span className={styles.mine}>Bu senin hazinen</span>}
        </div>
      </Panel>

      <div className={styles.gap}>
        <StatRow
          items={[
            { label: "Toplam gelir", value: revenue.data ? `${formatMon(BigInt(revenue.data.totalWei), 6)} MON` : "…", note: revenue.data ? `${revenue.data.count} ödeme` : undefined },
            { label: "Kasa oluşturma", value: revenue.data ? `${formatMon(BigInt(revenue.data.creationWei), 6)} MON` : "…" },
            { label: "ContractX dönüşümü", value: revenue.data ? `${formatMon(BigInt(revenue.data.conversionWei), 6)} MON` : "…" },
            { label: "Protokol payı", value: revenue.data ? `${formatMon(BigInt(revenue.data.protocolWei), 6)} MON` : "…" },
          ]}
        />
      </div>

      <div className={styles.gap}>
        <Panel title="Son ödemeler">
          {revenue.data ? (
            revenue.data.recent.length === 0 ? (
              <p className="body muted">Henüz ödeme yok.</p>
            ) : (
              <ul className={styles.list}>
                {revenue.data.recent.map((f, i) => (
                  <li key={`${f.txHash}-${i}`} className={styles.row}>
                    <span className={styles.kind}>{KIND_LABEL[f.kind]}</span>
                    <span className="mono">{shortAddr(f.payer)}</span>
                    <span className="num body">{formatMon(BigInt(f.amountWei), 6)} MON</span>
                    <span className="caption subtle">{timeAgo(f.ts)}</span>
                    <TxLink hash={f.txHash} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="body muted">{revenue.error ?? "Okunuyor…"}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
