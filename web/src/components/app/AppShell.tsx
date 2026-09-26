"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MonitorPlay, X } from "lucide-react";
import { Logo, Mark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { WalletButton } from "@/components/wallet/WalletButton";
import { NetworkPill } from "./NetworkPill";
import { APP_NAV, activeNav } from "./nav";
import styles from "./AppShell.module.css";

const ICON = { size: 20, strokeWidth: 1.8 } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = activeNav(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  const nav = (
    <nav className={styles.nav} aria-label="Uygulama">
      {APP_NAV.map((item) => {
        const Icon = item.icon;
        const on = current?.href === item.href;
        return (
          <Link key={item.href} href={item.href} className={`${styles.link} ${on ? styles.linkOn : ""}`} aria-current={on ? "page" : undefined}>
            <Icon {...ICON} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <div className={styles.navFoot}>
        <Link href="/sahne" className={styles.link}>
          <MonitorPlay {...ICON} aria-hidden="true" />
          Sahne modu
        </Link>
      </div>
    </nav>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Unpromptable ana sayfa">
          <Logo height={22} />
        </Link>
        {nav}
        <div className={styles.sideFoot}>
          <ThemeToggle />
          <span className="caption subtle">Monad Testnet</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={`icon-btn ${styles.menuBtn}`} onClick={() => setMenuOpen(true)} aria-label="Menüyü aç">
            <Menu size={20} strokeWidth={1.8} />
          </button>
          <Link href="/" className={styles.mobileBrand} aria-label="Unpromptable ana sayfa">
            <Mark size={26} />
          </Link>
          <span className={`title ${styles.pageTitle}`}>{current?.label ?? ""}</span>
          <div className={styles.topActions}>
            <NetworkPill />
            <WalletButton />
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>

      {menuOpen && (
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Menü">
          <div className={styles.sheetHead}>
            <Logo height={20} />
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Menüyü kapat">
              <X size={20} strokeWidth={1.8} />
            </button>
          </div>
          {nav}
          <div className={styles.sheetFoot}>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
