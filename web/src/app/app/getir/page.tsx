"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { Check, Download, Upload } from "lucide-react";
import { PageHead, Panel, Notice } from "@/components/app/ui";
import { CipherCard } from "@/components/ui/CipherCard";
import { FilterBuilder } from "@/components/contractx/FilterBuilder";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useContractX, type ClassifiedFinding } from "@/lib/useContractX";
import { useModelCart } from "@/lib/cart";
import { keysOfMask } from "@/lib/models";
import { txUrl } from "@/lib/chain";
import { CONVERSION_FEE_WEI, TREASURY } from "@/lib/deployments";
import { formatMon } from "@/lib/format";
import styles from "./page.module.css";

const STEPS = ["Kaynağı ver", "Ön kontrol", "Filtreleme", "Öde", "Dönüşüm"] as const;
const phaseStep: Record<string, number> = { input: 0, checking: 0, converting: 4, done: 4 };

function FindingList({ findings }: { findings: ClassifiedFinding[] }) {
  return (
    <ul className={styles.findingList}>
      {findings.map((f) => (
        <li key={f.id} className={styles.classifiedRow}>
          <span className="mono subtle">satır {f.line}</span>
          <span className="mono">{f.functionName}()</span>
          {f.supported ? (
            <>
              <span className={styles.catChip}>{f.categoryLabel}</span>
              <span className="caption subtle">{f.rationale}</span>
            </>
          ) : (
            <span className={styles.unsupported}>{f.rationale}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function GetirPage() {
  const w = useWallet();
  const cx = useContractX();
  const cart = useModelCart();
  const router = useRouter();
  const [source, setSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [precheckConfirmed, setPrecheckConfirmed] = useState(false);
  const [filtersConfirmed, setFiltersConfirmed] = useState(false);
  const [filterFeeMon, setFilterFeeMon] = useState(0);

  const atFilterStep = precheckConfirmed && !filtersConfirmed && cx.phase === "checked";
  const atPaymentStep = filtersConfirmed || cx.phase === "paying" || cx.phase === "confirming-payment";
  let step = phaseStep[cx.phase] ?? 1;
  if (cx.phase === "checked" || cx.phase === "error") step = atPaymentStep ? 3 : precheckConfirmed ? 2 : 1;
  if (cx.phase === "paying" || cx.phase === "confirming-payment") step = 3;

  const totalWei = CONVERSION_FEE_WEI + (filterFeeMon > 0 ? parseEther(filterFeeMon.toFixed(4)) : 0n);

  const changeSource = () => {
    cx.reset();
    setPrecheckConfirmed(false);
    setFiltersConfirmed(false);
    setFilterFeeMon(0);
  };

  const onFile = async (file: File) => {
    setSource(await file.text());
  };

  const useVault = () => {
    if (!cx.result) return;
    cart.set(keysOfMask(cx.result.suggestedMask));
    router.push("/app/olustur");
  };

  const downloadPatched = () => {
    if (!cx.result) return;
    const blob = new Blob([cx.result.patchedSource], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ContractX.sol";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead title="N Protocol">
        Kendi kontratının kaynağını yapıştır, MON gönderen satırları bul, korunan versiyonunu al. Ön kontrol ücretsiz;
        dönüşüm en az {formatMon(CONVERSION_FEE_WEI)} MON, seçtiğin koruma filtrelerine göre artabilir.
      </PageHead>

      <ol className={styles.stepper}>
        {STEPS.map((label, i) => (
          <li key={label} className={`${styles.step} ${i === step ? styles.stepOn : ""} ${i < step ? styles.stepDone : ""}`}>
            <span className={styles.stepNum}>{i < step ? <Check size={14} strokeWidth={2.4} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {cx.phase === "input" || cx.phase === "checking" ? (
        <Panel>
          <div className={styles.pane}>
            <div className={styles.inputHead}>
              <span className="title">Solidity kaynağı</span>
              <button type="button" className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
                <Upload size={16} strokeWidth={1.8} /> .sol yükle
              </button>
              <input ref={fileRef} type="file" accept=".sol" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </div>
            <textarea
              className={styles.textarea}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\ncontract Agent {\n    function payProvider(address payable to, uint256 amount) external {\n        to.transfer(amount);\n    }\n}"}
              spellCheck={false}
            />
            <div className={styles.paneFoot}>
              <span className="caption subtle">{source.length.toLocaleString("tr-TR")} karakter</span>
              <button type="button" className="krom-btn krom-btn--primary" disabled={source.trim().length === 0 || cx.phase === "checking"} onClick={() => cx.check(source)}>
                <span>{cx.phase === "checking" ? "Deniyor…" : "Ön kontrol"}</span>
              </button>
            </div>
          </div>
        </Panel>
      ) : cx.phase === "checked" && !precheckConfirmed ? (
        <Panel title="Ön kontrol" aside={<button type="button" className="caption" onClick={changeSource}>Kaynağı değiştir</button>}>
          {cx.precheck && (
            <div className={styles.pane}>
              {cx.precheck.compile.ok ? (
                <Notice tone="ok">Derleniyor ✓ · {cx.precheck.findings.length} ödeme noktası bulundu.</Notice>
              ) : (
                <Notice tone="danger">
                  Derlenemedi. <span className="mono" style={{ whiteSpace: "pre-wrap" }}>{cx.precheck.compile.errors}</span>
                </Notice>
              )}

              <div>
                <span className="title">Kontratın ne yaptığı</span>
                <p className="body muted" style={{ marginTop: "var(--space-2)" }}>{cx.precheck.purpose}</p>
              </div>

              {cx.precheck.additionalConcerns.length > 0 && (
                <div className={styles.concerns}>
                  <span className="caption subtle">Dikkat edilmesi gereken noktalar:</span>
                  <ul className={styles.concernList}>
                    {cx.precheck.additionalConcerns.map((c, i) => (
                      <li key={i} className="body">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {cx.precheck.findings.length > 0 && (
                <div>
                  <span className="title">Bulunan ödeme noktaları</span>
                  <FindingList findings={cx.precheck.findings} />
                </div>
              )}

              <button
                type="button"
                className="krom-btn krom-btn--primary"
                disabled={!cx.precheck.compile.ok}
                onClick={() => setPrecheckConfirmed(true)}
              >
                <span>Devam et</span>
              </button>
            </div>
          )}
        </Panel>
      ) : atFilterStep ? (
        <FilterBuilder
          source={source}
          onContinue={(totalMon) => {
            setFilterFeeMon(totalMon);
            setFiltersConfirmed(true);
          }}
        />
      ) : atPaymentStep || cx.phase === "error" ? (
        <Panel title="Öde ve dönüştür">
          <p className="body muted">
            Toplam <strong className="num">{formatMon(totalWei)} MON</strong> → hazine (
            <span className="mono">{TREASURY.slice(0, 8)}…</span>): {formatMon(CONVERSION_FEE_WEI)} MON dönüşüm ücreti
            {filterFeeMon > 0 && <> + {filterFeeMon.toFixed(3)} MON seçili filtreler</>}. Sunucu bu ödemeyi zincirde
            görmeden ContractX üretmez.
          </p>
          {!w.address && <Notice>Ödeme yapmak için önce cüzdanını bağla.</Notice>}
          {cx.phase === "paying" && <Notice>Cüzdanında onay bekleniyor…</Notice>}
          {cx.phase === "confirming-payment" && <Notice>Ödeme zincirde onaylanıyor…</Notice>}
          {cx.phase === "error" && <Notice tone="danger">{cx.error}</Notice>}
          <button
            type="button"
            className="krom-btn krom-btn--glow"
            disabled={!w.address || !cx.precheck?.compile.ok || cx.phase === "paying" || cx.phase === "confirming-payment"}
            onClick={() => cx.payAndConvert(source, totalWei)}
            style={{ marginTop: "var(--space-4)" }}
          >
            <span>{formatMon(totalWei)} MON öde ve dönüştür</span>
          </button>
          {cx.payTxHash && (
            <p className={styles.payTx}>
              <a href={txUrl(cx.payTxHash)} target="_blank" rel="noreferrer" className="mono">Ödeme işlemi ↗</a>
            </p>
          )}
        </Panel>
      ) : cx.phase === "converting" ? (
        <Panel>
          <div className={styles.converting}>
            <CipherCard size={280}>Kontratın dönüştürülüyor</CipherCard>
          </div>
        </Panel>
      ) : cx.phase === "done" && cx.result ? (
        <div className={styles.stack}>
          <Panel title="Kontratın ne yaptığı">
            <p className="body muted">{cx.result.purpose}</p>
            {cx.result.additionalConcerns.length > 0 && (
              <div className={styles.concerns}>
                <span className="caption subtle">Statik taramanın kaçırmış olabileceği noktalar (yamalanmadı, bilgi amaçlı):</span>
                <ul className={styles.concernList}>
                  {cx.result.additionalConcerns.map((c, i) => (
                    <li key={i} className="body">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="ContractX">
            <FindingList findings={cx.result.findings} />
          </Panel>

          <Panel
            title="A) Senin kasan"
            aside={<span className="caption subtle">{keysOfMask(cx.result.suggestedMask).length} model önerildi</span>}
          >
            <p className="body muted">Bulunan kategorilere göre kendi kasanı oluştur — bu senin normal, izole kasan olur.</p>
            <button type="button" className="krom-btn krom-btn--primary" onClick={useVault} style={{ marginTop: "var(--space-4)" }}>
              <span>Bu kasayı oluştur</span>
            </button>
          </Panel>

          <Panel
            title="B) Yamalı kontratın"
            aside={
              <span className={`caption ${cx.result.patchedCompile.ok ? styles.ok : styles.mismatch}`}>
                {cx.result.patchedCompile.ok ? "Derleniyor ✓" : "Derleme hatası"}
              </span>
            }
          >
            <pre className={styles.source}>{cx.result.patchedSource}</pre>
            <div className={styles.paneFoot}>
              <span className="caption subtle">
                Yayına almadan önce denetlet. ERC20 transferleri bu sürümde korunmuyor. UNPROMPTABLE_GUARD sabitini
                oluşturduğun kasanın adresiyle değiştir.
              </span>
              <button type="button" className="krom-btn krom-btn--ghost" onClick={downloadPatched}>
                <Download size={16} strokeWidth={1.8} /> .sol indir
              </button>
            </div>
          </Panel>
        </div>
      ) : null}
    </>
  );
}
