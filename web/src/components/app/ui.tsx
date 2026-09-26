import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { addressUrl, txUrl } from "@/lib/chain";
import { shortAddr } from "@/lib/format";
import { keysOfMask, modelByKey } from "@/lib/models";
import styles from "./ui.module.css";

export function PageHead({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <div className={styles.pageHeadText}>
        <h1 className="heading-1">{title}</h1>
        {children && <p className={`body-l ${styles.pageLede}`}>{children}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  );
}

export function Panel({ title, aside, children, className, pad = true }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`${styles.panel} ${pad ? styles.pad : ""} ${className ?? ""}`}>
      {(title || aside) && (
        <header className={styles.panelHead}>
          {title && <h2 className="title">{title}</h2>}
          {aside && <div className={styles.panelAside}>{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatRow({ items }: { items: { label: string; value: React.ReactNode; note?: React.ReactNode }[] }) {
  return (
    <div className={styles.stats} style={{ "--n": items.length } as React.CSSProperties}>
      {items.map((it) => (
        <div key={it.label} className={styles.stat}>
          <span className="caption subtle">{it.label}</span>
          <span className={`heading-2 num ${styles.statValue}`}>{it.value}</span>
          {it.note && <span className="caption subtle">{it.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function ModelChips({ mask }: { mask: number }) {
  return (
    <span className={styles.chips}>
      {keysOfMask(mask).map((k) => (
        <span key={k} className={styles.chip}>
          {modelByKey(k)?.short}
        </span>
      ))}
    </span>
  );
}

export function AddressLink({ address, href, full }: { address: string; href?: string; full?: boolean }) {
  return (
    <span className={styles.addr}>
      {href ? (
        <Link href={href} className="mono">
          {full ? address : shortAddr(address)}
        </Link>
      ) : (
        <span className="mono">{full ? address : shortAddr(address)}</span>
      )}
      <a href={addressUrl(address)} target="_blank" rel="noreferrer" aria-label="Explorer'da aç" className={styles.ext}>
        <ExternalLink size={14} strokeWidth={1.8} />
      </a>
    </span>
  );
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className={`mono ${styles.tx}`}>
      {label ?? `${hash.slice(0, 10)}…${hash.slice(-6)}`}
      <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className="title">{title}</p>
      {children && <p className="body muted">{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  return <div className={`${styles.notice} ${styles[tone]}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}
