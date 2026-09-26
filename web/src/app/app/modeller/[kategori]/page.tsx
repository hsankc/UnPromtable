"use client";

import { use, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { PageHead, Panel, StatRow, Notice } from "@/components/app/ui";
import { DecisionTag } from "@/components/ui/DecisionTag";
import { NeuralNet } from "@/components/ui/NeuralNet";
import { modelByKey, DECISION_LABEL, type Decision, type GuardModelInfo } from "@/lib/models";
import { decideOnChain, type LabResult } from "@/lib/guardLab";
import { useModelCart } from "@/lib/cart";
import styles from "./page.module.css";

export default function ModelDetailPage({ params }: PageProps<"/app/modeller/[kategori]">) {
  const { kategori } = use(params);
  const model = modelByKey(kategori);
  if (!model) notFound();
  return <ModelDetail model={model} />;
}

function ModelDetail({ model }: { model: GuardModelInfo }) {
  const cart = useModelCart();
  const inCart = cart.has(model.key);
  const [x, setX] = useState<number[]>(model.cases[0]?.x ?? Array(8).fill(0));
  const [custom, setCustom] = useState<LabResult>();
  const [customLoading, setCustomLoading] = useState(false);

  const runCustom = async () => {
    setCustomLoading(true);
    try {
      setCustom(await decideOnChain(model.id, x));
    } catch {
      setCustom(undefined);
    } finally {
      setCustomLoading(false);
    }
  };

  useEffect(() => {
    runCustom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.key]);

  return (
    <>
      <PageHead
        title={model.name}
        actions={
          <button type="button" className={inCart ? "krom-btn krom-btn--ghost" : "krom-btn krom-btn--primary"} onClick={() => cart.toggle(model.key)}>
            {inCart ? <Check size={18} strokeWidth={1.8} /> : <Plus size={18} strokeWidth={1.8} />}
            {inCart ? "Kontrata eklendi" : "Kontrata ekle"}
          </button>
        }
      >
        {model.description} Giriş fonksiyonu <code className="mono">{model.entry}()</code>.
      </PageHead>

      <StatRow
        items={[
          { label: "Mimari", value: "8 → 16 → 3" },
          { label: "Parametre", value: model.params },
          { label: "Kasa boyutu (tek model)", value: `${(model.vaultBytes / 1024).toFixed(1)} KB` },
        ]}
      />

      <div className={styles.gap}>
        <Panel title="Zincirde dene" aside={<span className="caption subtle">GuardLab · eth_call</span>}>
          <div className={styles.tryLayout}>
            <div className={styles.form}>
              {model.features.map((label, i) => (
                <label key={label} className={styles.field}>
                  <span className="caption subtle">{label}</span>
                  <input
                    className={styles.input}
                    type="number"
                    value={x[i]}
                    onChange={(e) => setX((cur) => cur.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                  />
                </label>
              ))}
              <button type="button" className="krom-btn krom-btn--primary" onClick={runCustom} disabled={customLoading}>
                <span>{customLoading ? "Çalışıyor…" : "Zincirde çalıştır"}</span>
              </button>
              {custom && (
                <div className={styles.result}>
                  <DecisionTag decision={custom.decision} />
                  <span className="caption subtle num">
                    logit: {custom.logits.map((l) => l.toString()).join(" · ")}
                  </span>
                </div>
              )}
            </div>
            <NeuralNet model={model} x={x} animate={false} />
          </div>
        </Panel>
      </div>

      <div className={styles.gap}>
        <Panel title="Özellikler">
          <ol className={styles.features}>
            {model.features.map((f, i) => (
              <li key={f} className={styles.featureRow}>
                <span className="mono subtle">x[{i}]</span>
                <span className="body">{f}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className={styles.gap}>
        <GoldenTests model={model} />
      </div>

      <div className={styles.gap}>
        <Notice tone="warn">{model.attack}</Notice>
      </div>
    </>
  );
}

function GoldenTests({ model }: { model: GuardModelInfo }) {
  const [results, setResults] = useState<Record<string, Decision | "error">>({});

  useEffect(() => {
    let alive = true;
    setResults({});
    model.cases.forEach((c) => {
      decideOnChain(model.id, c.x)
        .then((r) => alive && setResults((cur) => ({ ...cur, [c.key]: r.decision })))
        .catch(() => alive && setResults((cur) => ({ ...cur, [c.key]: "error" })));
    });
    return () => {
      alive = false;
    };
  }, [model]);

  const allMatch = model.cases.every((c) => results[c.key] === c.expect);
  const allDone = model.cases.every((c) => c.key in results);

  return (
    <Panel
      title="Altın testler"
      aside={
        allDone && (
          <span className={`caption ${allMatch ? styles.ok : styles.mismatch}`}>
            {allMatch ? "Zincirde hepsi eşleşiyor" : "Uyuşmazlık var"}
          </span>
        )
      }
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Senaryo</th>
            <th>Beklenen</th>
            <th>Zincirdeki sonuç</th>
          </tr>
        </thead>
        <tbody>
          {model.cases.map((c) => {
            const r = results[c.key];
            return (
              <tr key={c.key}>
                <td className="body">{c.label}</td>
                <td><DecisionTag decision={c.expect} label={DECISION_LABEL[c.expect]} /></td>
                <td>{r === undefined ? <span className="caption subtle">okunuyor…</span> : r === "error" ? <span className="caption" style={{ color: "var(--danger)" }}>hata</span> : <DecisionTag decision={r} label={DECISION_LABEL[r]} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
