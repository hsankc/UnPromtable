import Link from "next/link";
import { HeroLockup } from "@/components/brand/HeroLockup";
import { LiveBlock } from "./LiveBlock";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-label="Unpromptable">
      <div className={`container ${styles.inner}`}>
        <HeroLockup />
        <div className={styles.foot}>
          <p className={`body-l ${styles.lede}`}>
            AI ajanın parayı hiç tutmaz. Kontratın içindeki eğitilmiş model her ödemeye karar verir: onaylar,
            bekletir ya da reddeder.
          </p>
          <div className={styles.actions}>
            <Link href="/app" className="krom-btn krom-btn--glow">
              <span>Uygulamaya gir</span>
            </Link>
            <a href="#nasil" className={`krom-btn krom-btn--ghost ${styles.second}`}>
              Nasıl çalıştığını gör
            </a>
          </div>
          <LiveBlock />
        </div>
      </div>
    </section>
  );
}
