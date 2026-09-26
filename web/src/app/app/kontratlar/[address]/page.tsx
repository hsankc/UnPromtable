"use client";

import { use, useState } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import { Clock3, ShieldCheck, ShieldX } from "lucide-react";
import { PageHead, Panel, StatRow, AddressLink, ModelChips, Notice, Empty } from "@/components/app/ui";
import { DecisionList } from "@/components/ui/DecisionList";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useApi, type VaultView as ApiVaultView } from "@/lib/api";
import { useVaultChainState } from "@/lib/vaultChain";
import { usePendingPayments } from "@/lib/pending";
import { useVaultActions } from "@/lib/useVaultActions";
import { useRegistries } from "@/lib/registry";
import { formatMon, timeAgo } from "@/lib/format";
import { DEMO_VAULT } from "@/lib/deployments";
import styles from "./page.module.css";

export default function VaultDetailPage({ params }: PageProps<"/app/kontratlar/[address]">) {
  const { address: raw } = use(params);

  if (!isAddress(raw)) {
    return (
      <Panel>
        <Empty title="Geçersiz adres">{raw} bir Monad adresi gibi görünmüyor.</Empty>
      </Panel>
    );
  }
  return <VaultDetail address={raw} />;
}

function VaultDetail({ address }: { address: Address }) {
  const w = useWallet();
  const { state, error: chainError, refresh } = useVaultChainState(address);
  const { entries: registries } = useRegistries();
  const vaultView = useApi<ApiVaultView>(`/index/vault/${address}`, 6000);
  const { entries: pending } = usePendingPayments(address);
  const actions = useVaultActions(address, () => {
    refresh();
    vaultView && setNonce((n) => n + 1);
  });
  const [, setNonce] = useState(0);
  const [fundAmount, setFundAmount] = useState("0.1");
  const [allowAddr, setAllowAddr] = useState("");

  const isDemo = address.toLowerCase() === DEMO_VAULT.address.toLowerCase();
  const registryEntry = registries?.find((e) => e.vault.toLowerCase() === address.toLowerCase());
  const isOwner = !!w.address && !!state && w.address.toLowerCase() === state.owner.toLowerCase();
  const ownerMismatch = !!registryEntry && !!state && registryEntry.owner.toLowerCase() !== state.owner.toLowerCase();

  const dailyPct = state && state.dayCapWei > 0n ? Math.min(100, Number((state.dayUnknownOutWei * 100n) / state.dayCapWei)) : 0;

  return (
    <>
      <PageHead
        title={isDemo ? "Demo kasa" : "Kasa"}
        actions={
          registryEntry ? (
            <span className="caption subtle num">Registry {registryEntry.version === 2 ? "v2" : "v1"}</span>
          ) : undefined
        }
      >
        <AddressLink address={address} full />
      </PageHead>

      {chainError && <Notice tone="danger">{chainError}</Notice>}
      {ownerMismatch && (
        <div className={styles.gap}>
          <Notice tone="warn">
            Registry&apos;deki sahip (<AddressLink address={registryEntry!.owner} />) kasanın kendi bildirdiği sahiple (
            <AddressLink address={state!.owner} />) eşleşmiyor.
          </Notice>
        </div>
      )}

      {state && (
        <div className={styles.gap}>
          <StatRow
            items={[
              { label: "Bakiye", value: `${formatMon(state.balanceWei)} MON` },
              { label: "Sahip", value: <AddressLink address={state.owner} /> },
              {
                label: "Modeller",
                value: state.legacy ? <span className="body">API ödemesi (tekil model)</span> : <ModelChips mask={state.mask} />,
              },
            ]}
          />
        </div>
      )}

      <div className={styles.gap}>
        <Panel title="Sert limitler">
          {state ? (
            <div className={styles.limits}>
              <div className={styles.limitRow}>
                <span className="body">Tek işlem tavanı</span>
                <span className="body num">%{state.hardCapBps / 100} · {formatMon((state.balanceWei * BigInt(state.hardCapBps)) / 10000n)} MON</span>
              </div>
              <div className={styles.limitRow}>
                <span className="body">Tanınmayana günlük bütçe</span>
                <span className="body num">
                  {formatMon(state.dayUnknownOutWei)} / {formatMon(state.dayCapWei)} MON
                </span>
              </div>
              <div className={styles.bar} role="progressbar" aria-valuenow={dailyPct} aria-valuemin={0} aria-valuemax={100}>
                <div className={styles.barFill} style={{ width: `${dailyPct}%` }} />
              </div>
              <p className="caption subtle">
                Gün, son harcamadan {state.delaySeconds / 60} dk sonra bekletilen ödemeler serbest kalır. Bütçe periyodu 24 saatte bir
                sıfırlanır (kayan pencere değil, bu yüzden sınırda kısa süreliğine %{state.unknownDailyBps / 100 * 2} kadar çıkabilir).
              </p>
              {state.hasProtocolFee && <p className="caption subtle">Onaylanan her ödemede binde {state.protocolFeeBps} hazineye gider.</p>}
            </div>
          ) : (
            <p className="body muted">Okunuyor…</p>
          )}
        </Panel>
      </div>

      <div className={styles.gap}>
        <Panel title="Canlı kararlar">
          {vaultView.data ? (
            <DecisionList items={vaultView.data.decisions} showVault={false} empty="Bu kasada henüz karar yok." />
          ) : (
            <p className="body muted">{vaultView.error ?? "Okunuyor…"}</p>
          )}
        </Panel>
      </div>

      <div className={styles.gap}>
        <Panel title="Bekleyen ödemeler" aside={<span className="caption subtle">10 dakika gecikmeli</span>}>
          {pending === undefined ? (
            <p className="body muted">Okunuyor…</p>
          ) : pending.length === 0 ? (
            <p className="body muted">Bekleyen ödeme yok.</p>
          ) : (
            <ul className={styles.pendingList}>
              {pending.map((p) => {
                const ready = Date.now() >= p.releaseAt * 1000;
                return (
                  <li key={p.id.toString()} className={styles.pendingRow}>
                    <span className="mono">#{p.id.toString()}</span>
                    <AddressLink address={p.to} />
                    <span className="num body">{formatMon(p.amount)} MON</span>
                    {p.done ? (
                      <span className={styles.tag}><ShieldCheck size={16} strokeWidth={1.8} /> Ödendi</span>
                    ) : p.vetoed ? (
                      <span className={`${styles.tag} ${styles.tagDanger}`}><ShieldX size={16} strokeWidth={1.8} /> Veto edildi</span>
                    ) : (
                      <span className={styles.tag}>
                        <Clock3 size={16} strokeWidth={1.8} /> {ready ? "Serbest bırakılabilir" : timeAgo(p.releaseAt * 1000)}
                      </span>
                    )}
                    {!p.done && !p.vetoed && isOwner && (
                      <span className={styles.pendingActions}>
                        <button type="button" className="krom-btn krom-btn--ghost" onClick={() => actions.veto(p.id)} disabled={actions.status === "pending" || actions.status === "confirming"}>
                          Veto
                        </button>
                        {ready && (
                          <button type="button" className="krom-btn krom-btn--primary" onClick={() => actions.release(p.id)} disabled={actions.status === "pending" || actions.status === "confirming"}>
                            <span>Serbest bırak</span>
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {isOwner && !state?.legacy && (
        <div className={styles.gap}>
          <Panel title="Sahip işlemleri">
            <div className={styles.ownerGrid}>
              <div className={styles.ownerAction}>
                <label className="caption subtle" htmlFor="fund-amount">Kasayı fonla</label>
                <div className={styles.inline}>
                  <input id="fund-amount" className={styles.input} value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} inputMode="decimal" />
                  <span className="body muted">MON</span>
                  <button type="button" className="krom-btn krom-btn--primary" onClick={() => actions.fund(fundAmount)} disabled={actions.status === "pending" || actions.status === "confirming"}>
                    <span>Gönder</span>
                  </button>
                </div>
              </div>
              <div className={styles.ownerAction}>
                <label className="caption subtle" htmlFor="allow-addr">Güvenilir adres ekle</label>
                <div className={styles.inline}>
                  <input id="allow-addr" className={styles.input} value={allowAddr} onChange={(e) => setAllowAddr(e.target.value)} placeholder="0x…" />
                  <button
                    type="button"
                    className="krom-btn krom-btn--ghost"
                    onClick={() => isAddress(allowAddr) && actions.setAllow(allowAddr, true)}
                    disabled={!isAddress(allowAddr) || actions.status === "pending" || actions.status === "confirming"}
                  >
                    Ekle
                  </button>
                </div>
              </div>
            </div>
            {actions.status === "pending" && <Notice>{actions.label} için cüzdanında onay bekleniyor…</Notice>}
            {actions.status === "confirming" && <Notice>{actions.label} zincirde onaylanıyor…</Notice>}
            {actions.status === "done" && <Notice tone="ok">İşlem tamamlandı.</Notice>}
            {actions.status === "error" && <Notice tone="danger">{actions.error}</Notice>}
          </Panel>
        </div>
      )}

      <div className={styles.gap}>
        <Link href="/app/kontratlar" className="caption">← Tüm kontratlar</Link>
      </div>
    </>
  );
}
