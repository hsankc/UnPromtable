import Link from "next/link";
import { Logo, Mark } from "@/components/brand/Logo";
import { WalletButton } from "@/components/wallet/WalletButton";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/#nasil", label: "Nasıl çalışır" },
  { href: "/#modeller", label: "Modeller" },
  { href: "/#fiyat", label: "Fiyat" },
  { href: "/app/entegrasyon", label: "Geliştiriciler" },
];

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="Unpromptable ana sayfa">
          <span className={styles.full}><Logo height={24} /></span>
          <span className={styles.compact}><Mark size={28} /></span>
        </Link>
        <nav className={styles.nav} aria-label="Ana menü">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={styles.link}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
