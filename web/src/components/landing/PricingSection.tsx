"use client";

import { ExternalLink } from "lucide-react";
import { useApi, type RevenueView } from "@/lib/api";
import { addressUrl } from "@/lib/chain";
import { TREASURY } from "@/lib/deployments";
import { formatMon, shortAddr } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/motion";
import s from "./section.module.css";
import styles from "./PricingSection.module.css";

const FEES = [
  {
    key: "creationWei" as const,
    price: "0,001 MON",
    unit: "model başına",
    title: "Kasa oluşturma",
    body: "Kasayı oluştururken bir kez. Üç modelli bir kasa 0,003 MON. Registry ücreti almadan kasayı deploy etmez.",
  },
  {
    key: "conversionWei" as const,
    price: "0,01 MON",
    unit: "dönüşüm başına",
    title: "ContractX dönüşümü",
    body: "Kendi kontratını getirir, korunan versiyonunu alırsın. Ödeme zincirde doğrulanmadan dönüşüm başlamaz.",
  },
  {
    key: "protocolWei" as const,
    price: "%0,1",
    unit: "ödeme başına",
    title: "Protokol payı",
    body: "Kasa onaylanan her ödemede tutarın binde birini hazineye gönderir. Reddedilen ödemeden pay alınmaz.",
  },
];

// Flow diagram geometry (viewBox 0 0 520 300): three sources merge into the treasury.
const SRC_Y = [50, 150, 250];
const TREASURY_PT = { x: 440, y: 150 };
const pathFor = (y: number) => `M120,${y} C280,${y} 300,${TREASURY_PT.y} ${TREASURY_PT.x - 34},${TREASURY_PT.y}`;

export function PricingSection() {
  const reduced = usePrefersReducedMotion();
  const revenue = useApi<RevenueView>("/index/revenue", 8000);

  return (
    <section id="fiyat" className={s.section}>
      <div className="container">
        <div className={s.head}>
          <h2 className="heading-1">Ücretler zincirde, hepsi tek adrese.</h2>
          <p className={`body-l ${s.lede}`}>
            Abonelik yok, fatura yok. Her ücret işlemin içinde ödenir ve aynı anda hazine adresine gider. Kimse elle
            toplamaz, kontrat biriktirmez.
          </p>
        </div>

        <div className={s.split}>
          <ul className={styles.fees}>
            {FEES.map((f) => (
              <li key={f.key} className={styles.fee}>
                <div className={styles.price}>
                  <span className="heading-2 num">{f.price}</span>
                  <span className="caption subtle">{f.unit}</span>
                </div>
                <div className={styles.feeText}>
                  <h3 className="title">{f.title}</h3>
                  <p className="body muted">{f.body}</p>
                  {revenue.data && (
                    <p className="caption subtle num">Şimdiye kadar: {formatMon(BigInt(revenue.data[f.key]), 6)} MON</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <figure className={styles.flow}>
            <svg viewBox="0 0 520 300" className={styles.svg} role="img" aria-label="Üç ücret kalemi hazine adresine akıyor">
              {SRC_Y.map((y, i) => (
                <g key={i}>
                  <path id={`fee-path-${i}`} d={pathFor(y)} className={styles.path} />
                  <rect x="8" y={y - 20} width="112" height="40" rx="20" className={styles.src} />
                  <text x="64" y={y + 5} textAnchor="middle" className={styles.srcLabel}>
                    {["Oluşturma", "Dönüşüm", "Protokol payı"][i]}
                  </text>
                  {!reduced &&
                    [0, 1, 2].map((k) => (
                      <circle key={k} r="4" className={styles.coin}>
                        <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.5 + k * 0.8}s`}>
                          <mpath href={`#fee-path-${i}`} />
                        </animateMotion>
                      </circle>
                    ))}
                </g>
              ))}
              <circle cx={TREASURY_PT.x} cy={TREASURY_PT.y} r="34" className={styles.treasury} />
              <text x={TREASURY_PT.x} y={TREASURY_PT.y + 5} textAnchor="middle" className={styles.treasuryLabel}>
                MON
              </text>
            </svg>
            <figcaption className={styles.caption}>
              <span className="title">Hazine</span>
              <a href={addressUrl(TREASURY)} target="_blank" rel="noreferrer" className={`mono ${styles.addr}`}>
                {shortAddr(TREASURY, 8, 6)} <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" />
              </a>
              <span className="caption subtle">
                {revenue.data ? `Toplam ${formatMon(BigInt(revenue.data.totalWei), 6)} MON, ${revenue.data.count} ödeme` : "Zincirden okunuyor…"}
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
