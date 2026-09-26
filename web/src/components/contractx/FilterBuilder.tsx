"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Panel, Notice } from "@/components/app/ui";
import { useContractX } from "@/lib/useContractX";
import styles from "./FilterBuilder.module.css";

/**
 * Claude reads the contract plus a plain-language description of what it's
 * for, and proposes a tailored list of protective filters — a demo of the
 * direction, not a priced, on-chain-enforced menu yet: today only the two
 * hard caps every generated vault already has (tek işlem tavanı, günlük
 * bütçe) are real, wired limits. Said plainly in the panel, not hidden.
 */
export function FilterBuilder({ source, onContinue }: { source: string; onContinue: (totalMon: number) => void }) {
  const cx = useContractX();
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  const total = useMemo(() => {
    if (!cx.filters) return 0;
    return cx.filters.filter((f) => enabled[f.id] ?? f.recommended).reduce((sum, f) => sum + f.feeMon, 0);
  }, [cx.filters, enabled]);

  const suggest = async () => {
    await cx.loadFilters(source, description);
    setEnabled({});
    setValues({});
  };

  return (
    <Panel title="Koruma filtreleri" aside={<span className="caption subtle">önizleme</span>}>
      {!cx.filters && !cx.filtersLoading && (
        <div className={styles.intro}>
          <label className={styles.field}>
            <span className="caption subtle">Bu kontratı ne için kullanacaksın? (opsiyonel ama önerileri iyileştirir)</span>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: DAO hazinesinden onaylı adreslere hibe ödüyor, ayda birkaç kez, genelde küçük tutarlarda."
            />
          </label>
          <div className={styles.introActions}>
            <button type="button" className="krom-btn krom-btn--primary" onClick={suggest}>
              <span><Sparkles size={16} strokeWidth={1.8} /> Filtre öner</span>
            </button>
            <button type="button" className="krom-btn krom-btn--ghost" onClick={() => onContinue(0)}>
              Filtresiz devam et
            </button>
          </div>
        </div>
      )}

      {cx.filtersLoading && <Notice>N Protocol kontratını ve açıklamanı okuyup filtre öneriyor…</Notice>}
      {cx.filtersError && <Notice tone="danger">{cx.filtersError}</Notice>}

      {cx.filters && (
        <div className={styles.list}>
          {cx.filters.map((f) => {
            const on = enabled[f.id] ?? f.recommended;
            return (
              <div key={f.id} className={styles.row}>
                <label className={styles.checkWrap}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={on}
                    onChange={(e) => setEnabled((cur) => ({ ...cur, [f.id]: e.target.checked }))}
                  />
                  <span className={styles.checkbox_} aria-hidden="true" />
                </label>
                <div className={styles.text}>
                  <span className="body" style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className="caption subtle">{f.description}</span>
                </div>
                {f.hasValue && (
                  <div className={styles.valueField}>
                    <input
                      className={styles.input}
                      disabled={!on}
                      placeholder={f.valueLabel}
                      value={values[f.id] ?? f.suggestedValue ?? ""}
                      onChange={(e) => setValues((cur) => ({ ...cur, [f.id]: e.target.value }))}
                    />
                    {f.valueLabel && <span className="caption subtle">{f.valueLabel}</span>}
                  </div>
                )}
                <span className={`caption num ${styles.fee}`}>{f.feeMon.toFixed(3)} MON</span>
              </div>
            );
          })}
          <div className={styles.footer}>
            <span className="body muted">Seçili filtreler toplamı</span>
            <span className="title num">{total.toFixed(3)} MON</span>
          </div>
          <p className="caption subtle">
            Bu liste N Protocol&apos;ün gerçek önerisi. Şu an gerçekten zincirde uygulanan tek limitler, kasa
            oluştururken seçtiğin tek-işlem tavanı ve günlük bütçe — buradaki diğer filtreler yol haritası,
            henüz kasaya gömülmüyor.
          </p>
          <div className={styles.introActions}>
            <button type="button" className="krom-btn krom-btn--ghost" onClick={() => cx.clearFilters()}>
              Yeniden öner
            </button>
            <button type="button" className="krom-btn krom-btn--primary" onClick={() => onContinue(total)}>
              <span>Ödemeye geç</span>
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
