"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Droplets, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useWallet } from "./WalletProvider";
import { addressUrl, FAUCET } from "@/lib/chain";
import { formatMon, shortAddr } from "@/lib/format";
import styles from "./WalletButton.module.css";

const ICON = { size: 18, strokeWidth: 1.8 } as const;

export function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  let button: React.ReactNode;
  if (w.status === "detecting") {
    button = (
      <span className={`krom-btn krom-btn--ring ${styles.btn}`} aria-hidden="true">
        <span><Wallet {...ICON} /><span className={styles.label}>Cüzdan</span></span>
      </span>
    );
  } else if (w.status === "unavailable") {
    button = (
      <a className={`krom-btn krom-btn--ring ${styles.btn}`} href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        <span><Wallet {...ICON} /><span className={styles.label}>MetaMask kur</span></span>
      </a>
    );
  } else if (w.status !== "connected" || !w.address) {
    button = (
      <button type="button" className={`krom-btn krom-btn--ring ${styles.btn}`} onClick={w.connect} disabled={w.status === "connecting"}>
        <span>
          <Wallet {...ICON} />
          <span className={styles.label}>{w.status === "connecting" ? "Bağlanıyor…" : "Cüzdan bağla"}</span>
          <span className={styles.labelShort}>{w.status === "connecting" ? "…" : "Bağla"}</span>
        </span>
      </button>
    );
  } else if (!w.onMonad) {
    button = (
      <button type="button" className={`krom-btn krom-btn--ghost ${styles.btn} ${styles.warn}`} onClick={w.switchToMonad}>
        <AlertTriangle {...ICON} />
        <span className={styles.label}>Monad Testnet'e geç</span>
        <span className={styles.labelShort}>Ağı değiştir</span>
      </button>
    );
  } else {
    button = (
      <button
        type="button"
        className={`krom-btn krom-btn--ring ${styles.btn}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <span className={styles.dot} aria-hidden="true" />
          <span className="num">{shortAddr(w.address)}</span>
          {w.balance !== undefined && <span className={`${styles.balance} num`}>{formatMon(w.balance, 3)} MON</span>}
        </span>
      </button>
    );
  }

  const copy = async () => {
    if (!w.address) return;
    await navigator.clipboard.writeText(w.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      {button}
      {open && w.address && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <span className="caption subtle">Bağlı cüzdan, Monad Testnet</span>
            <span className={`mono ${styles.full}`}>{w.address}</span>
            {w.balance !== undefined && <span className="title num">{formatMon(w.balance)} MON</span>}
          </div>
          <button type="button" role="menuitem" className={styles.item} onClick={copy}>
            {copied ? <Check {...ICON} /> : <Copy {...ICON} />} {copied ? "Kopyalandı" : "Adresi kopyala"}
          </button>
          <a role="menuitem" className={styles.item} href={addressUrl(w.address)} target="_blank" rel="noreferrer">
            <ExternalLink {...ICON} /> Explorer'da aç
          </a>
          <a role="menuitem" className={styles.item} href={FAUCET} target="_blank" rel="noreferrer">
            <Droplets {...ICON} /> Faucet'ten MON al
          </a>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false);
              w.disconnect();
            }}
          >
            <LogOut {...ICON} /> Bağlantıyı kes
          </button>
        </div>
      )}
      {w.error && (
        <p className={`caption ${styles.error}`} role="status">
          {w.error}
        </p>
      )}
    </div>
  );
}
