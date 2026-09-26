import { LockKeyhole } from "lucide-react";
import { CipherCard } from "@/components/ui/CipherCard";
import s from "./section.module.css";
import styles from "./HowSection.module.css";

// The three steps really are a sequence (propose → model → hard limits), so
// they're numbered. A signal dot runs down the connectors and each badge
// lights as it arrives: the path every payment takes.
const STEPS = [
  {
    title: "Ajan öneri yapar",
    body: "Ajanın cüzdanı ve anahtarı yok. Ödemek istediğinde kasaya proposePayment(alıcı, tutar) gönderir. Bu çağrı tek başına hiçbir şey ödemez.",
  },
  {
    title: "Kasanın içindeki model karar verir",
    body: "Kontratta 195 parametreli, eğitilmiş bir sinir ağı çalışır. Tutarı, alıcının geçmişini ve itibarını, son harcama hızını okur. Onaylar, 10 dakika bekletir ya da reddeder.",
  },
  {
    title: "Sert limitler son sözü söyler",
    body: "Model ne derse desin, tek işlemde kasanın %20'sinden fazlası çıkamaz. Tanınmayan adreslere günde en fazla %1 gider. Bekleyen ödemeyi kasa sahibi veto edebilir.",
  },
];

export function HowSection() {
  return (
    <section id="nasil" className={s.section}>
      <div className="container">
        <div className={s.head}>
          <h2 className="heading-1">Ajan önerir. Kontrat karar verir.</h2>
          <p className={`body-l ${s.lede}`}>
            Ajanın ne düşündüğü artık önemli değil. Para sadece kasanın içindeki kurallardan geçerse çıkar.
          </p>
        </div>
        <div className={s.splitEven}>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li key={step.title} className={`${styles.step} ${styles[`s${i}` as "s0"]}`}>
                <span className={styles.num} aria-hidden="true">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={styles.connector} aria-hidden="true">
                    <span className={styles.signal} />
                  </span>
                )}
                <div className={styles.text}>
                  <h3 className="title">{step.title}</h3>
                  <p className="body muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className={styles.cipherWrap}>
            <CipherCard size={440}>
              <LockKeyhole size={28} strokeWidth={1.8} aria-hidden="true" />
              Anahtar yok
              <small>ajan sadece önerir</small>
            </CipherCard>
          </div>
        </div>
      </div>
    </section>
  );
}
