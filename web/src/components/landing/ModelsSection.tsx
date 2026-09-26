"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { NeuralNet } from "@/components/ui/NeuralNet";
import { DecisionTag } from "@/components/ui/DecisionTag";
import { MODELS } from "@/lib/models";
import { useOnChainDecision } from "@/lib/guardLab";
import { usePrefersReducedMotion } from "@/lib/motion";
import s from "./section.module.css";
import styles from "./ModelsSection.module.css";

// Each model is shown on its own headline attack scenario.
const attackCase = (i: number) => MODELS[i].cases.find((c) => c.expect === 2) ?? MODELS[i].cases[0];

export function ModelsSection() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touched = useRef(false);

  // Walk through the six models until someone picks one.
  useEffect(() => {
    if (reduced || paused || touched.current) return;
    const id = setInterval(() => setActive((a) => (a + 1) % MODELS.length), 5000);
    return () => clearInterval(id);
  }, [reduced, paused]);

  const model = MODELS[active];
  const scenario = attackCase(active);
  const onChain = useOnChainDecision(model.id, scenario.x);

  return (
    <section id="modeller" className={s.section}>
      <div className="container">
        <div className={s.head}>
          <h2 className="heading-1">Altı model, altı ödeme türü.</h2>
          <p className={`body-l ${s.lede}`}>
            Her model kendi ödeme türünün saldırı desenleriyle eğitildi. Hepsi 8 girdili, 195 parametreli küçük bir ağ;
            kasanın içinde, her ödemede çalışır.
          </p>
        </div>

        <div className={styles.layout} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className={styles.list} role="tablist" aria-label="Modeller" aria-orientation="vertical">
            {MODELS.map((m, i) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`${styles.item} ${i === active ? styles.itemOn : ""}`}
                onClick={() => {
                  touched.current = true;
                  setActive(i);
                }}
                onFocus={() => setPaused(true)}
              >
                <span className="title">{m.name}</span>
                <span className="caption subtle">{m.tagline}</span>
                {i === active && !paused && !touched.current && !reduced && <span className={styles.progress} aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className={styles.panel} role="tabpanel" aria-label={model.name}>
            <div className={styles.panelHead}>
              <span className="caption subtle">Senaryo</span>
              <span className="body">{scenario.label}</span>
            </div>
            <NeuralNet key={model.key} model={model} x={scenario.x} animate={!reduced} />
            <div className={styles.panelFoot}>
              <span className={`caption ${styles.chain}`}>
                <Link2 size={14} strokeWidth={1.8} aria-hidden="true" />
                {onChain.result ? "Zincirde aynı karar:" : onChain.error ? onChain.error : "Zincirde doğrulanıyor…"}
                {onChain.result && <DecisionTag decision={onChain.result.decision} />}
              </span>
              <Link href={`/app/modeller/${model.key}`} className={`caption ${styles.more}`}>
                Model sayfası
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
