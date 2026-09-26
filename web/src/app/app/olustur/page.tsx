"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Code2, ExternalLink } from "lucide-react";
import { PageHead, Panel, Notice, AddressLink } from "@/components/app/ui";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useModelCart } from "@/lib/cart";
import { useCreateVault } from "@/lib/useCreateVault";
import { MODELS, maskOf } from "@/lib/models";
import { FEE_PER_MODEL_WEI, MONAD_CODE_LIMIT, ETHEREUM_CODE_LIMIT, TREASURY } from "@/lib/deployments";
import { formatMon } from "@/lib/format";
import { txUrl } from "@/lib/chain";
import styles from "./page.module.css";

const STEPS = ["Modelleri seç", "Fonla", "İncele", "İmzala"] as const;

export default function OlusturPage() {
  const w = useWallet();
  const cart = useModelCart();
  const [step, setStep] = useState(0);
  const [fund, setFund] = useState("0.1");
  const [showSource, setShowSource] = useState(false);
  const created = useCreateVault();

  const mask = useMemo(() => maskOf(cart.keys), [cart.keys]);
  const fee = FEE_PER_MODEL_WEI * BigInt(cart.keys.length);
  const fundWei = safeParse(fund);
  const total = fee + (fundWei ?? 0n);

  // Re-compile whenever the selection changes once the user reaches review.
  useEffect(() => {
    if (step >= 2 && cart.keys.length > 0) created.compile(mask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mask]);

  if (created.status === "done" && created.vaultAddress) {
    return (
      <Panel>
        <div className={styles.success}>
          <h1 className="display-l krom-chrome">Kasan hazır.</h1>
          <p className="body-l muted">Seçtiğin {cart.keys.length} model artık zincirde, kendi kasanın içinde çalışıyor.</p>
          <div className={styles.successAddr}>
            <AddressLink address={created.vaultAddress} full />
          </div>
          {created.txHash && (
            <a href={txUrl(created.txHash)} target="_blank" rel="noreferrer" className={`mono ${styles.successTx}`}>
              İşlemi gör <ExternalLink size={14} strokeWidth={1.8} />
            </a>
          )}
          <div className={styles.successActions}>
            <Link href={`/app/kontratlar/${created.vaultAddress}`} className="krom-btn krom-btn--glow">
              <span>Canlı izle</span>
            </Link>
            <button
              type="button"
              className="krom-btn krom-btn--ghost"
              onClick={() => {
                cart.clear();
                setStep(0);
                created.reset();
              }}
            >
              Yeni kasa oluştur
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHead title="Kontrat oluştur">Modelleri seç, kasanı fonla, tek imzayla Monad&apos;da oluştur. Sahibi sen olursun.</PageHead>

      <ol className={styles.stepper}>
        {STEPS.map((label, i) => (
          <li key={label} className={`${styles.step} ${i === step ? styles.stepOn : ""} ${i < step ? styles.stepDone : ""}`}>
            <span className={styles.stepNum}>{i < step ? <Check size={14} strokeWidth={2.4} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <Panel>
        {step === 0 && (
          <div className={styles.pane}>
            <ul className={styles.modelList}>
              {MODELS.map((m) => (
                <li key={m.key} className={styles.modelRow}>
                  <label className={styles.checkWrap}>
                    <input type="checkbox" className={styles.checkbox} checked={cart.has(m.key)} onChange={() => cart.toggle(m.key)} />
                    <span className={styles.checkbox_} aria-hidden="true">{cart.has(m.key) && <Check size={14} strokeWidth={2.4} />}</span>
                  </label>
                  <div className={styles.text}>
                    <span className="body" style={{ fontWeight: 600 }}>{m.name}</span>
                    <span className="caption subtle">{m.tagline}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.paneFoot}>
              <span className="body muted">{cart.keys.length} model seçildi · <span className="num">{formatMon(fee)} MON</span></span>
              <button type="button" className="krom-btn krom-btn--primary" disabled={cart.keys.length === 0} onClick={() => setStep(1)}>
                <span>Devam et</span> <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={styles.pane}>
            <label className={styles.fundField}>
              <span className="title">Başlangıç fonu</span>
              <span className="caption subtle">Kasa oluşur oluşmaz bu kadar MON'la başlar. Sonra dilediğin zaman ekleyebilirsin.</span>
              <div className={styles.inline}>
                <input className={styles.input} value={fund} onChange={(e) => setFund(e.target.value)} inputMode="decimal" />
                <span className="body muted">MON</span>
              </div>
            </label>
            <div className={styles.paneFoot}>
              <button type="button" className="krom-btn krom-btn--ghost" onClick={() => setStep(0)}>Geri</button>
              <button type="button" className="krom-btn krom-btn--primary" disabled={fundWei === undefined} onClick={() => setStep(2)}>
                <span>Devam et</span> <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.pane}>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewRow}>
                <span className="body muted">Seçilen modeller</span>
                <span className="body">{cart.keys.map((k) => MODELS.find((m) => m.key === k)?.short).join(", ")}</span>
              </div>
              {created.compiled && (
                <div className={styles.reviewRow}>
                  <span className="body muted">Kontrat boyutu</span>
                  <div className={styles.sizeCol}>
                    <div className={styles.sizeBar}>
                      <div className={styles.sizeFill} style={{ width: `${Math.min(100, (created.compiled.runtimeBytes / MONAD_CODE_LIMIT) * 100)}%` }} />
                      <div className={styles.sizeMarker} style={{ left: `${(ETHEREUM_CODE_LIMIT / MONAD_CODE_LIMIT) * 100}%` }} />
                    </div>
                    <span className="caption subtle num">
                      {(created.compiled.runtimeBytes / 1024).toFixed(1)} KB / {(MONAD_CODE_LIMIT / 1024).toFixed(0)} KB (Monad sınırı)
                    </span>
                    {created.compiled.runtimeBytes > ETHEREUM_CODE_LIMIT && (
                      <span className="caption subtle">Ethereum sınırı 24 KB — bu kontrat orada deploy edilemez.</span>
                    )}
                  </div>
                </div>
              )}
              <div className={styles.reviewRow}>
                <span className="body muted">Oluşturma ücreti</span>
                <span className="body num">{cart.keys.length} × 0,001 = {formatMon(fee)} MON → hazine</span>
              </div>
              <div className={styles.reviewRow}>
                <span className="body muted">Protokol payı</span>
                <span className="body">Onaylanan her ödemenin %0,1&apos;i, kontratta sabit</span>
              </div>
              <div className={styles.reviewRow}>
                <span className="body muted">Başlangıç fonu</span>
                <span className="body num">{fund} MON</span>
              </div>
              <div className={styles.reviewRow}>
                <span className="body muted">Toplam gönderilecek</span>
                <span className="heading-2 num">{formatMon(total)} MON</span>
              </div>
            </div>

            <button type="button" className={styles.sourceToggle} onClick={() => setShowSource((s) => !s)}>
              <Code2 size={16} strokeWidth={1.8} /> {showSource ? "Kaynak kodu gizle" : "Solidity'yi göster"}
            </button>
            {showSource && created.compiled && <pre className={styles.source}>{created.compiled.source}</pre>}

            {created.status === "compiling" && <Notice>Kontrat derleniyor…</Notice>}
            {created.status === "error" && !created.compiled && <Notice tone="danger">{created.error}</Notice>}

            <div className={styles.paneFoot}>
              <button type="button" className="krom-btn krom-btn--ghost" onClick={() => setStep(1)}>Geri</button>
              <button type="button" className="krom-btn krom-btn--primary" disabled={!created.compiled} onClick={() => setStep(3)}>
                <span>Devam et</span> <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.pane}>
            {!w.address ? (
              <Notice>Kasayı imzalamak için önce cüzdanını bağla.</Notice>
            ) : !w.onMonad ? (
              <Notice tone="warn">Cüzdanın Monad Testnet'te değil. Sağ üstten ağı değiştir.</Notice>
            ) : (
              <p className="body muted">
                Cüzdanın <strong className="mono">{w.address}</strong> tek bir işlemle {formatMon(total)} MON gönderecek: {formatMon(fee)} MON hazineye
                (<span className="mono">{TREASURY.slice(0, 8)}…</span>), kalanı yeni kasana.
              </p>
            )}

            {created.status === "pending" && <Notice>Cüzdanında onay bekleniyor…</Notice>}
            {created.status === "confirming" && <Notice>İşlem zincirde onaylanıyor…</Notice>}
            {created.status === "error" && <Notice tone="danger">{created.error}</Notice>}

            <div className={styles.signRow}>
              <button type="button" className="krom-btn krom-btn--ghost" onClick={() => setStep(2)}>Geri</button>
              <button
                type="button"
                className="krom-btn krom-btn--glow"
                disabled={!w.address || !w.onMonad || !created.compiled || created.status === "pending" || created.status === "confirming"}
                onClick={() => created.create(fundWei ?? 0n, fee)}
              >
                <span>Cüzdanla imzala ve oluştur</span>
              </button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

function safeParse(s: string): bigint | undefined {
  try {
    if (!/^\d*\.?\d*$/.test(s.trim()) || s.trim() === "") return undefined;
    const [whole, frac = ""] = s.trim().split(".");
    const padded = (frac + "0".repeat(18)).slice(0, 18);
    return BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0");
  } catch {
    return undefined;
  }
}
