import { Bot, Coins, Landmark, Repeat, ShoppingBag, Users } from "lucide-react";
import s from "./section.module.css";
import styles from "./AudienceSection.module.css";

const WHO = [
  { icon: Bot, label: "API'ye kendi kendine ödeme yapan ajanlar" },
  { icon: ShoppingBag, label: "NFT ve dijital varlık alan ajanlar" },
  { icon: Coins, label: "DEX'te otonom takas yapan ajanlar" },
  { icon: Repeat, label: "Abonelik faturalarını kendi ödeyen ajanlar" },
  { icon: Landmark, label: "DAO hazinesinden harcama yapan ajanlar" },
  { icon: Users, label: "İçerik üreticisine bahşiş/ödül dağıtan ajanlar" },
];

export function AudienceSection() {
  return (
    <section className={s.section}>
      <div className="container">
        <div className={s.head}>
          <h2 className="heading-1">Otonom ödeme yapan AI ajanı kuran herkes.</h2>
          <p className={`body-l ${s.lede}`}>
            Her kontrata uymaya çalışmıyoruz. Ajanının parayı kendi kendine hareket ettirdiği her yerde aynı risk var:
            tek bir ikna edici cümle, tüm bakiye. Bu zaten oldu — Grok tarzı ajan boşaltmaları gerçek olaylar.
          </p>
        </div>
        <ul className={styles.list}>
          {WHO.map(({ icon: Icon, label }) => (
            <li key={label} className={styles.item}>
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span className="body">{label}</span>
            </li>
          ))}
        </ul>
        <p className={`heading-2 ${styles.line}`}>Ajanınız kandırılırsa bile parayı biz durdururuz.</p>
      </div>
    </section>
  );
}
