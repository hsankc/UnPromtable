import Link from "next/link";
import { Mark } from "@/components/brand/Logo";
import { addressUrl } from "@/lib/chain";
import { GUARD_LAB, REGISTRY_V2, TREASURY } from "@/lib/deployments";
import styles from "./SiteFooter.module.css";

const CONTRACTS = [
  { label: "Registry v2", address: REGISTRY_V2.address },
  { label: "GuardLab", address: GUARD_LAB },
  { label: "Hazine", address: TREASURY },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Mark size={32} />
          <p className="caption subtle">Monad İstanbul V2 için yapıldı. Tüm kontratlar Monad testnet'te.</p>
        </div>
        <nav className={styles.cols} aria-label="Alt menü">
          <div className={styles.col}>
            <span className="caption subtle">Uygulama</span>
            <Link href="/app/modeller">Modeller</Link>
            <Link href="/app/olustur">Kontrat oluştur</Link>
            <Link href="/app/getir">Kontratını getir</Link>
            <Link href="/app/kontratlar">Kontratlar</Link>
          </div>
          <div className={styles.col}>
            <span className="caption subtle">Kontratlar</span>
            {CONTRACTS.map((c) => (
              <a key={c.label} href={addressUrl(c.address)} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}
