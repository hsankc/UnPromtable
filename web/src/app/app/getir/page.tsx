"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Upload } from "lucide-react";
import { PageHead, Panel, Notice } from "@/components/app/ui";
import { DecisionTag } from "@/components/ui/DecisionTag";
import { CipherCard } from "@/components/ui/CipherCard";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useContractX } from "@/lib/useContractX";
import { useModelCart } from "@/lib/cart";
import { keysOfMask } from "@/lib/models";
import { txUrl } from "@/lib/chain";
import { CONVERSION_FEE_WEI, TREASURY } from "@/lib/deployments";
import { formatMon } from "@/lib/format";
import styles from "./page.module.css";

const STEPS = ["Kaynağı ver", "Ön kontrol", "Öde", "Dönüşüm"] as const;
const phaseStep: Record<string, number> = { input: 0, checking: 0, checked: 1, paying: 2, "confirming-payment": 2, converting: 3, done: 3, error: 1 };

export default function GetirPage() {
  const w = useWallet();
  const cx = useContractX();
  const cart = useModelCart();
  const router = useRouter();
  const [source, setSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const step = phaseStep[cx.phase] ?? 0;

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
      <PageHead title="Kontratını getir">
        Kendi kontratının kaynağını yapıştır, MON gönderen satırları bul, korunan versiyonunu al. Ön kontrol ücretsiz;
        dönüşüm 0,01 MON.
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
      ) : (
        <div className={styles.stack}>
          <Panel title="Ön kontrol" aside={<button type="button" className="caption" onClick={cx.reset}>Kaynağı değiştir</button>}>
            {cx.precheck && (
              <>
                {cx.precheck.compile.ok ? (
                  <Notice tone="ok">Derleniyor ✓ · {cx.precheck.findings.length} ödeme noktası bulundu.</Notice>
                ) : (
                  <Notice tone="danger">
                    Derlenemedi. <span className="mono" style={{ whiteSpace: "pre-wrap" }}>{cx.precheck.compile.errors}</span>
                  </Notice>
                )}
                {cx.precheck.findings.length > 0 && (
                  <ul className={styles.findingList}>
                    {cx.precheck.findings.map((f) => (
                      <li key={f.id} className={styles.findingRow}>
                        <span className="mono subtle">satır {f.line}</span>
                        <span className="mono">{f.functionName}()</span>
                        <span className={`mono ${styles.stmt}`}>{f.statement}</span>
                        {!f.supported && <span className={styles.unsupported}>desteklenmiyor (sadece MON)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>

          {(cx.phase === "checked" || cx.phase === "paying" || cx.phase === "confirming-payment" || cx.phase === "error") && (
            <Panel title="Öde ve dönüştür">
              <p className="body muted">
                Dönüşüm ücreti <strong className="num">{formatMon(CONVERSION_FEE_WEI)} MON</strong> → hazine (
                <span className="mono">{TREASURY.slice(0, 8)}…</span>). Sunucu bu ödemeyi zincirde görmeden ContractX üretmez.
              </p>
              {!w.address && <Notice>Ödeme yapmak için önce cüzdanını bağla.</Notice>}
              {cx.phase === "paying" && <Notice>Cüzdanında onay bekleniyor…</Notice>}
              {cx.phase === "confirming-payment" && <Notice>Ödeme zincirde onaylanıyor…</Notice>}
              {cx.phase === "error" && <Notice tone="danger">{cx.error}</Notice>}
              <button
                type="button"
                className="krom-btn krom-btn--glow"
                disabled={!w.address || !cx.precheck?.compile.ok || cx.phase === "paying" || cx.phase === "confirming-payment"}
                onClick={() => cx.payAndConvert(source)}
                style={{ marginTop: "var(--space-4)" }}
              >
                <span>{formatMon(CONVERSION_FEE_WEI)} MON öde ve dönüştür</span>
              </button>
              {cx.payTxHash && (
                <p className={styles.payTx}>
                  <a href={txUrl(cx.payTxHash)} target="_blank" rel="noreferrer" className="mono">Ödeme işlemi ↗</a>
                </p>
              )}
            </Panel>
          )}

          {cx.phase === "converting" && (
            <Panel>
              <div className={styles.converting}>
                <CipherCard size={280}>Kontratın dönüştürülüyor</CipherCard>
              </div>
            </Panel>
          )}

          {cx.phase === "done" && cx.result && (
            <>
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
                <ul className={styles.findingList}>
                  {cx.result.findings.map((f) => (
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
            </>
          )}
        </div>
      )}
    </>
  );
}
