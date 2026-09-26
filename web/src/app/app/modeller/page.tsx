"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { PageHead, Panel } from "@/components/app/ui";
import { MODELS } from "@/lib/models";
import { FEE_PER_MODEL_WEI } from "@/lib/deployments";
import { formatMon } from "@/lib/format";
import { useModelCart } from "@/lib/cart";
import styles from "./page.module.css";

export default function ModellerPage() {
  const cart = useModelCart();
  const router = useRouter();
  const fee = FEE_PER_MODEL_WEI * BigInt(cart.keys.length);

  return (
    <>
      <PageHead title="Modeller">
        Her biri 8 girdili, 195 parametreli, tek bir ödeme türü için eğitilmiş. Kasana ekleyeceklerini seç.
      </PageHead>

      <Panel pad={false}>
        <ul className={styles.list}>
          {MODELS.map((m) => (
            <li key={m.key} className={styles.row}>
              <label className={styles.checkWrap}>
                <input type="checkbox" className={styles.checkbox} checked={cart.has(m.key)} onChange={() => cart.toggle(m.key)} aria-label={`${m.name} seç`} />
                <span className={styles.checkbox_} aria-hidden="true">
                  {cart.has(m.key) && <Check size={14} strokeWidth={2.4} />}
                </span>
              </label>
              <div className={styles.text}>
                <span className="title">{m.name}</span>
                <span className="caption subtle">{m.tagline}</span>
              </div>
              <span className={`caption subtle ${styles.meta}`}>{m.params} parametre · {(m.vaultBytes / 1024).toFixed(1)} KB</span>
              <Link href={`/app/modeller/${m.key}`} className={styles.detail}>
                Detay <ChevronRight size={16} strokeWidth={1.8} />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {cart.keys.length > 0 && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyInner}>
            <span className="body">
              <strong>{cart.keys.length}</strong> model seçildi · <span className="num">{formatMon(fee)} MON</span>
            </span>
            <div className={styles.stickyActions}>
              <button type="button" className="krom-btn krom-btn--ghost" onClick={cart.clear}>
                Temizle
              </button>
              <button type="button" className="krom-btn krom-btn--primary" onClick={() => router.push("/app/olustur")}>
                <span>Kontrat oluştur</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
