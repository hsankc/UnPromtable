"use client";

import Link from "next/link";
import { PlusSquare, FileCode2, ShieldAlert } from "lucide-react";
import { PageHead, Panel, StatRow, AddressLink, ModelChips, Empty } from "@/components/app/ui";
import { DecisionList } from "@/components/ui/DecisionList";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useApi, type Overview } from "@/lib/api";
import { useRegistries } from "@/lib/registry";
import { formatInt, formatMon, timeAgo } from "@/lib/format";
import styles from "./page.module.css";

// Demo gününün başlangıcı: bugün 09:00'dan önceki kayıtlar (geçmiş test
// verileri) görünmesin, sadece bugünkü gerçek aktivite kalsın.
function todayNineAM(): number {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export default function AppOverviewPage() {
  const w = useWallet();
  const overview = useApi<Overview>("/index/overview", 6000);
  const { entries: allEntries, error: regError } = useRegistries(15000);
  const entries = allEntries?.filter((e) => e.deployedAt >= todayNineAM());

  const mine = w.address ? entries?.filter((e) => e.owner.toLowerCase() === w.address!.toLowerCase()) : undefined;
  const createdToday = overview.data?.created.filter((c) => c.ts >= todayNineAM());

  return (
    <>
      <PageHead
        title="Genel bakış"
        actions={
          <>
            <Link href="/app/olustur" className="krom-btn krom-btn--primary">
              <PlusSquare size={18} strokeWidth={1.8} /> Kontrat oluştur
            </Link>
            <Link href="/app/getir" className="krom-btn krom-btn--ghost">
              <FileCode2 size={18} strokeWidth={1.8} /> Kontratını getir
            </Link>
          </>
        }
      >
        Modeller, kontratlar ve hazine — hepsi Monad testnet&apos;ten okunuyor.
      </PageHead>

      <StatRow
        items={[
          { label: "Kayıtlı kasa", value: entries === undefined ? "…" : formatInt(entries.length), note: regError ?? "bugün oluşturulan" },
          {
            label: "Hazineye giden ücret",
            value: overview.data ? `${formatMon(BigInt(overview.data.revenue.totalWei), 6)} MON` : "…",
            note: overview.data ? `${overview.data.revenue.count} ödeme` : undefined,
          },
          { label: "Model sayısı", value: "6", note: "her biri 195 parametre" },
        ]}
      />

      {!w.address && (
        <div className={styles.connectRow}>
          <Panel>
            <p className="body muted">Kendi kasalarını görmek için cüzdanını bağla.</p>
            <button type="button" className="krom-btn krom-btn--ring" onClick={w.connect} style={{ marginTop: "var(--space-4)" }}>
              <span>Cüzdan bağla</span>
            </button>
          </Panel>
        </div>
      )}

      {w.address && (
        <div className={styles.section}>
          <Panel title="Kontratlarım">
            {mine === undefined ? (
              <p className="body muted">Okunuyor…</p>
            ) : mine.length === 0 ? (
              <Empty title="Henüz kasan yok" action={<Link href="/app/olustur" className="krom-btn krom-btn--primary"><span>Kontrat oluştur</span></Link>}>
                Modelleri seç, tek imzayla ilk kasanı oluştur.
              </Empty>
            ) : (
              <ul className={styles.vaultList}>
                {mine.map((e) => (
                  <li key={e.vault} className={styles.vaultRow}>
                    <AddressLink address={e.vault} href={`/app/kontratlar/${e.vault}`} />
                    <ModelChips mask={e.mask} />
                    <span className="caption subtle">{timeAgo(e.deployedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <div className={styles.section}>
        <Panel title="Son kararlar" aside={<Link href="/app/kontratlar" className="caption">Tüm kontratlar</Link>}>
          {overview.data ? (
            <DecisionList items={[...(overview.data.demo.decisions ?? [])].slice(0, 8)} />
          ) : (
            <p className="body muted">{overview.error ? "Karar akışı okunamıyor." : "Okunuyor…"}</p>
          )}
        </Panel>
      </div>

      <div className={styles.section}>
        <Panel title="Son oluşturulan kasalar">
          {createdToday && createdToday.length > 0 ? (
            <ul className={styles.vaultList}>
              {createdToday.map((c) => (
                <li key={c.vault} className={styles.vaultRow}>
                  <AddressLink address={c.vault} href={`/app/kontratlar/${c.vault}`} />
                  <ModelChips mask={c.mask} />
                  <span className="caption subtle num">{formatMon(BigInt(c.feeWei))} MON ücret</span>
                  <span className="caption subtle">{timeAgo(c.ts)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="body muted">{overview.data ? "Bugün henüz kasa oluşturulmadı." : "Okunuyor…"}</p>
          )}
        </Panel>
      </div>

      <div className={styles.section}>
        <Panel title="Ajanını dene">
          <p className="body muted">Gerçek Gemini ajanına sahte bir fatura ya da gizli talimat gönder, kasanın nasıl karar verdiğini izle.</p>
          <Link href="/app/saldiri" className="krom-btn krom-btn--ghost" style={{ marginTop: "var(--space-4)" }}>
            <ShieldAlert size={18} strokeWidth={1.8} /> Saldırı dene
          </Link>
        </Panel>
      </div>
    </>
  );
}
