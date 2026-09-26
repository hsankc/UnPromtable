"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHead, Panel, AddressLink, ModelChips, Empty } from "@/components/app/ui";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRegistries } from "@/lib/registry";
import { formatMon, timeAgo } from "@/lib/format";
import styles from "./page.module.css";

type Tab = "all" | "mine";

export default function KontratlarPage() {
  const w = useWallet();
  const { entries, error } = useRegistries(15000);
  const [tab, setTab] = useState<Tab>("all");

  const shown = useMemo(() => {
    if (!entries) return undefined;
    if (tab === "mine") {
      if (!w.address) return [];
      return entries.filter((e) => e.owner.toLowerCase() === w.address!.toLowerCase());
    }
    return entries;
  }, [entries, tab, w.address]);

  return (
    <>
      <PageHead title="Kontratlar">
        Registry v2 ve v1&apos;den okunan her kasa. Sahiplik ve model seçimi zincirden geliyor.
      </PageHead>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "all"} className={`${styles.tab} ${tab === "all" ? styles.tabOn : ""}`} onClick={() => setTab("all")}>
          Tümü {entries ? `(${entries.length})` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "mine"} className={`${styles.tab} ${tab === "mine" ? styles.tabOn : ""}`} onClick={() => setTab("mine")}>
          Benimkiler
        </button>
      </div>

      <Panel pad={false}>
        {error && <p className={`body ${styles.error}`}>{error}</p>}
        {tab === "mine" && !w.address ? (
          <Empty title="Cüzdanını bağla" action={<button type="button" className="krom-btn krom-btn--ring" onClick={w.connect}><span>Cüzdan bağla</span></button>}>
            Kendi kasalarını görmek için önce cüzdanını bağlaman gerekiyor.
          </Empty>
        ) : shown === undefined ? (
          <p className={`body muted ${styles.pad}`}>Okunuyor…</p>
        ) : shown.length === 0 ? (
          <Empty title={tab === "mine" ? "Henüz kasan yok" : "Kayıt yok"} action={<Link href="/app/olustur" className="krom-btn krom-btn--primary"><span>Kontrat oluştur</span></Link>}>
            {tab === "mine" ? "Modelleri seç, tek imzayla ilk kasanı oluştur." : "İlk kasayı sen oluştur."}
          </Empty>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kasa</th>
                <th>Sahip</th>
                <th>Modeller</th>
                <th className={styles.num}>Ücret</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.vault}>
                  <td>
                    <AddressLink address={e.vault} href={`/app/kontratlar/${e.vault}`} />
                    {e.version === 1 && <span className={styles.v1}>v1</span>}
                  </td>
                  <td><AddressLink address={e.owner} /></td>
                  <td><ModelChips mask={e.mask} /></td>
                  <td className={`${styles.num} num`}>{formatMon(e.feeWei)} MON</td>
                  <td className="caption subtle">{timeAgo(e.deployedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
