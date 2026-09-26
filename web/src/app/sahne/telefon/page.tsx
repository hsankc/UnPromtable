import Link from "next/link";
import { Mark } from "@/components/brand/Logo";
import { AttackConsole } from "@/components/attack/AttackConsole";
import styles from "./page.module.css";

export default function SahneTelefonPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><Mark size={24} /></Link>
        <span className="caption subtle">Salon telefonu</span>
      </header>
      <h1 className="heading-2">Ajanı ikna etmeyi dene</h1>
      <p className="body muted">Bir fatura yaz, gizli bir talimat gizle. Gerçek ajan okuyacak, gerçek kasa karar verecek.</p>
      <div className={styles.console}>
        <AttackConsole variant="stage" />
      </div>
    </div>
  );
}
