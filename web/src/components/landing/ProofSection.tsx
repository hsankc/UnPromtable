"use client";

import { formatEther } from "viem";
import { DecisionList } from "@/components/ui/DecisionList";
import { useApi, type DecisionEvent, type Overview } from "@/lib/api";
import { useRegistries } from "@/lib/registry";
import { useCountUp, useSeen } from "@/lib/motion";
import s from "./section.module.css";
import styles from "./ProofSection.module.css";

function Stat({ value, decimals, unit, label, note, start }: { value?: number; decimals: number; unit?: string; label: string; note: string; start: boolean }) {
  const shown = useCountUp(value, start);
  return (
    <div className={styles.stat}>
      <span className={`heading-1 num ${styles.value}`}>
        {value === undefined ? (
          <span className={styles.unknown}>…</span>
        ) : (
          shown.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        )}
        {unit && value !== undefined && <span className={styles.unit}>{unit}</span>}
      </span>
      <span className="title">{label}</span>
      <span className="caption subtle">{note}</span>
    </div>
  );
}

const mon = (wei?: string | bigint) => (wei === undefined ? undefined : Number(formatEther(BigInt(wei))));

export function ProofSection() {
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const overview = useApi<Overview>("/index/overview", 5000);
  const decisions = useApi<DecisionEvent[]>("/index/decisions?limit=6", 4000);
  const { entries, error: regError } = useRegistries(15000);

  const stopped = overview.data ? BigInt(overview.data.demo.rejectedWei) + BigInt(overview.data.demo.heldWei) : undefined;
  const offline = overview.error && !overview.data;

  return (
    <section id="kanit" className={`${s.section} ${s.strip}`}>
      <div className="container">
        <div className={s.head}>
          <h2 className="heading-1">Zincirde, şu an.</h2>
          <p className={`body-l ${s.lede}`}>
            Bu sayılar Monad testnet'ten okunuyor. Tahmin, örnek ya da yuvarlanmış pazarlama rakamı yok.
          </p>
        </div>

        <div ref={ref} className={styles.stats}>
          <Stat value={entries?.length} decimals={0} label="Kayıtlı kasa" note={regError ?? "v1 ve v2 registry'deki toplam kayıt"} start={seen} />
          <Stat
            value={mon(overview.data?.revenue.totalWei)}
            decimals={4}
            unit=" MON"
            label="Hazineye giden ücret"
            note={offline ? "Indexer'a ulaşılamıyor" : "Oluşturma, dönüşüm ve protokol payı"}
            start={seen}
          />
          <Stat value={mon(stopped)} decimals={2} unit=" MON" label="Demo kasada durdurulan" note="Reddedilen ve bekletilen ödemeler" start={seen} />
        </div>

        <div className={styles.feed}>
          <div className={styles.feedHead}>
            <h3 className="title">Son kararlar</h3>
            <span className={`caption ${styles.live}`}>
              <span className={styles.dot} aria-hidden="true" /> Canlı
            </span>
          </div>
          {decisions.data ? (
            <DecisionList items={decisions.data} />
          ) : (
            <p className="body muted">{decisions.error ? "Karar akışı şu an okunamıyor." : "Kararlar okunuyor…"}</p>
          )}
        </div>
      </div>
    </section>
  );
}
