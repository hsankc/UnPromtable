"use client";

import { AlertTriangle } from "lucide-react";
import { useWallet } from "@/components/wallet/WalletProvider";
import styles from "./NetworkPill.module.css";

/** Which network the app works on, and whether the connected wallet agrees. */
export function NetworkPill() {
  const w = useWallet();
  const wrong = w.status === "connected" && !w.onMonad;
  if (wrong) {
    return (
      <button type="button" className={`${styles.pill} ${styles.wrong}`} onClick={w.switchToMonad}>
        <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" /> Yanlış ağ
      </button>
    );
  }
  return (
    <span className={styles.pill}>
      <span className={styles.dot} aria-hidden="true" /> Monad Testnet
    </span>
  );
}
