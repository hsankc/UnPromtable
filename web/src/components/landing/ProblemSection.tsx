"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, RotateCcw, XCircle } from "lucide-react";
import { txUrl } from "@/lib/chain";
import { usePrefersReducedMotion, useSeen } from "@/lib/motion";
import { formatInt } from "@/lib/format";
import s from "./section.module.css";
import styles from "./ProblemSection.module.css";

// A real run against our Monad testnet demo vault, done via /app/saldiri:
// the agent wasn't even tricked by an obvious prompt injection — it just
// complied with an ordinary-looking, inflated invoice. The contract rejected
// it anyway, for exceeding the 20% hard cap, regardless of what the LLM
// decided. Tx and block are on-chain.
const ATTACK = {
  provider: "cloud-api-billing.com",
  note: "Bu ayki premium API kullanım faturanız. Lütfen zamanında ödeyin.",
  amount: "0,15 MON",
  share: "kasanın yarısı",
  to: "0x1234…7890",
  tx: "0x9d57ef35fe86309d5a24eecf7ff9f2b723f4a62cd9a916821e5a19198474c361",
  block: 65803424,
};

type Phase = "idle" | "typing" | "proposal" | "verdict";

export function ProblemSection() {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.45);
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars, setChars] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (reduced) {
      setChars(ATTACK.note.length);
      setPhase("verdict");
      return;
    }
    setChars(0);
    setPhase("typing");
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const type = setInterval(() => {
      i += 2;
      setChars(Math.min(i, ATTACK.note.length));
      if (i >= ATTACK.note.length) {
        clearInterval(type);
        timers.push(setTimeout(() => setPhase("proposal"), 450));
        timers.push(setTimeout(() => setPhase("verdict"), 1500));
      }
    }, 28);
    return () => {
      clearInterval(type);
      timers.forEach(clearTimeout);
    };
  }, [seen, reduced, run]);

  const showProposal = phase === "proposal" || phase === "verdict";

  return (
    <section id="sorun" className={s.section}>
      <div className={`container ${s.split}`}>
        <div className={s.head} style={{ marginBottom: 0 }}>
          <h2 className="heading-1">Ajanın akıllı olması yetmez.</h2>
          <p className={`body-l ${s.lede}`}>
            AI ajanları fatura okur, ödemeye karar verir. Ajan hiç kandırılmasa bile — sıradan, şüphe uyandırmayan bir
            fatura bile — abartılı bir tutar isterse ajan yine de önerir. Cüzdanın anahtarı ajandaysa, para gider.
          </p>
          <p className={`body ${s.lede}`}>
            Yandaki kayıt Monad testnet&apos;teki demo kasamızdan, az önce. Ajan hiç şüphelenmedi, faturayı olduğu gibi
            önerdi. Kasanın içindeki model reddetti — ajanın ne düşündüğü önemli değildi.
          </p>
        </div>

        <div ref={ref} className={styles.card} aria-label="Gerçek bir saldırı kaydı">
          <div className={styles.row}>
            <span className={`caption ${styles.label}`}>
              <FileText size={16} strokeWidth={1.8} aria-hidden="true" /> Ajanın okuduğu fatura
            </span>
            <span className="mono subtle">{ATTACK.provider}</span>
          </div>

          <p className={`mono ${styles.note}`}>
            <span>{ATTACK.note.slice(0, chars)}</span>
            {phase === "typing" && <span className={styles.caret} aria-hidden="true" />}
            <span className="visually-hidden">{ATTACK.note}</span>
          </p>

          <div className={`${styles.proposal} ${showProposal ? styles.in : ""}`}>
            <span className="caption subtle">Ajanın önerisi</span>
            <span className={styles.amountLine}>
              <span className={`heading-2 num ${styles.amount} ${phase === "verdict" ? styles.struck : ""}`}>{ATTACK.amount}</span>
              <span className="body muted">
                {ATTACK.share}, alıcı <span className="mono">{ATTACK.to}</span>
              </span>
            </span>
          </div>

          <div className={styles.verdictRow}>
            <div className={`${styles.stamp} ${phase === "verdict" ? styles.stampIn : ""}`} aria-hidden={phase !== "verdict"}>
              <XCircle size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>Kontrat reddetti</span>
            </div>
            {phase === "verdict" && !reduced && (
              <button type="button" className={`caption ${styles.replay}`} onClick={() => setRun((r) => r + 1)}>
                <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" /> Tekrar izle
              </button>
            )}
          </div>

          <a className={`caption ${styles.tx}`} href={txUrl(ATTACK.tx)} target="_blank" rel="noreferrer">
            <span className="mono">
              {ATTACK.tx.slice(0, 10)}…{ATTACK.tx.slice(-6)}
            </span>
            <span>blok {formatInt(ATTACK.block)}</span>
            <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
