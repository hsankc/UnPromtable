import Link from "next/link";
import s from "./section.module.css";
import styles from "./ClosingSection.module.css";

export function ClosingSection() {
  return (
    // Krom's dark tokens scoped to this band: the chrome heading needs a dark
    // ground to read as metal.
    <section className={`${s.section} ${styles.closing}`} data-theme="dark">
      <div className={`container ${styles.inner}`}>
        <h2 className="display-l krom-chrome">Konuşarak ikna edilemez.</h2>
        <p className={`body-l ${styles.lede}`}>
          Ajanına kendi kasasını ver. Hangi ödeme türlerini yapacaksa o modelleri seç; kasa tek imzayla Monad'da
          oluşur ve sahibi sen olursun.
        </p>
        <div className={styles.actions}>
          <Link href="/app/olustur" className="krom-btn krom-btn--ring">
            <span>Kontratını oluştur</span>
          </Link>
          <Link href="/app/getir" className="krom-btn krom-btn--ghost">
            Mevcut kontratını getir
          </Link>
        </div>
      </div>
    </section>
  );
}
