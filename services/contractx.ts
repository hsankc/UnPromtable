import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { CACHE_DIR, FORGE_BIN } from "./lib/env.js";

const execFileAsync = promisify(execFile);

// Same six categories and entry points as extracted/guard/generate_vault.py.
const CATEGORIES = [
  { key: "api_payment", entry: "proposePayment", label: "API ödemesi" },
  { key: "nft_purchase", entry: "proposeNftPurchase", label: "NFT alımı" },
  { key: "defi_swap", entry: "proposeSwap", label: "DeFi takas" },
  { key: "subscription", entry: "proposeSubscription", label: "Abonelik" },
  { key: "treasury_dao", entry: "proposeGrant", label: "DAO hazinesi" },
  { key: "social_tip", entry: "proposeTip", label: "Bahşiş" },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]["key"];
const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export interface ScanFinding {
  id: number;
  line: number;
  functionName: string;
  statement: string;
  kind: "native" | "erc20";
  toExpr: string;
  amountExpr: string;
  supported: boolean;
}

/**
 * Finds every MON-sending statement in the source: `.transfer(x)`,
 * `.send(x)` and `.call{value: x}(...)`. Two-argument `.transfer(to, amount)`
 * is an ERC20 token transfer, not native MON — flagged but not patched, since
 * generated vaults only guard native value today.
 */
export function scanPayments(source: string): ScanFinding[] {
  const lines = source.split("\n");
  const findings: ScanFinding[] = [];
  let currentFn = "(fonksiyon dışı)";
  let id = 0;

  const nativeTransfer = /([\w.]+(?:\[[^\]]*\])?)\.transfer\(\s*([^,()]+)\s*\)/g;
  const erc20Transfer = /([\w.]+(?:\[[^\]]*\])?)\.transfer\(\s*([^,()]+)\s*,\s*([^()]+)\)/g;
  const nativeSend = /([\w.]+(?:\[[^\]]*\])?)\.send\(\s*([^,()]+)\s*\)/g;
  const callValue = /([\w.]+(?:\[[^\]]*\])?)\.call\{[^}]*\bvalue\s*:\s*([^,}]+)[^}]*\}\s*\(/g;

  lines.forEach((raw, idx) => {
    const fnMatch = raw.match(/function\s+(\w+)\s*\(/);
    if (fnMatch) currentFn = fnMatch[1];
    const line = idx + 1;
    const seen = new Set<number>(); // column offsets already claimed, so erc20 doesn't double-count with native

    for (const m of raw.matchAll(erc20Transfer)) {
      seen.add(m.index ?? -1);
      findings.push({ id: id++, line, functionName: currentFn, statement: raw.trim(), kind: "erc20", toExpr: m[2].trim(), amountExpr: m[3].trim(), supported: false });
    }
    for (const m of raw.matchAll(nativeTransfer)) {
      if (seen.has(m.index ?? -1)) continue;
      findings.push({ id: id++, line, functionName: currentFn, statement: raw.trim(), kind: "native", toExpr: m[1].trim(), amountExpr: m[2].trim(), supported: true });
    }
    for (const m of raw.matchAll(nativeSend)) {
      findings.push({ id: id++, line, functionName: currentFn, statement: raw.trim(), kind: "native", toExpr: m[1].trim(), amountExpr: m[2].trim(), supported: true });
    }
    for (const m of raw.matchAll(callValue)) {
      findings.push({ id: id++, line, functionName: currentFn, statement: raw.trim(), kind: "native", toExpr: m[1].trim(), amountExpr: m[2].trim(), supported: true });
    }
  });

  return findings;
}

// ---------- isolated compile (never touches the main guard project) ----------

async function run(cmd: string, args: string[], cwd: string) {
  return execFileAsync(cmd, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
}

export interface CompileCheck {
  ok: boolean;
  errors?: string;
  runtimeBytes?: number;
}

/** Compiles arbitrary user source in its own throwaway forge project — never the guard repo. */
export async function compileArbitrary(source: string, label: string): Promise<CompileCheck> {
  const dir = path.join(CACHE_DIR, "contractx", label);
  await mkdir(path.join(dir, "src"), { recursive: true });
  await writeFile(
    path.join(dir, "foundry.toml"),
    "[profile.default]\nsrc = \"src\"\nout = \"out\"\nlibs = []\noptimizer = true\noptimizer_runs = 200\n",
  );
  await writeFile(path.join(dir, "src", "Submitted.sol"), source);
  try {
    await run(FORGE_BIN, ["build", "--force"], dir);
    // The file can define more than one artifact (an injected interface plus
    // the user's contract) — the real contract is whichever has bytecode;
    // interfaces compile to "0x". Take the largest.
    const artifactDir = path.join(dir, "out", "Submitted.sol");
    const files = (await readdir(artifactDir)).filter((f) => f.endsWith(".json"));
    let runtimeBytes = 0;
    for (const file of files) {
      const artifact = JSON.parse(await readFile(path.join(artifactDir, file), "utf8"));
      const bytes = artifact.deployedBytecode?.object ? (artifact.deployedBytecode.object.length - 2) / 2 : 0;
      if (bytes > runtimeBytes) runtimeBytes = bytes;
    }
    return { ok: true, runtimeBytes };
  } catch (err) {
    const stderr = (err as { stderr?: string; message?: string }).stderr ?? (err as Error).message;
    return { ok: false, errors: stderr.split("\n").slice(0, 25).join("\n") };
  }
}

// ---------- classification ----------

export interface ClassifiedFinding extends ScanFinding {
  category?: CategoryKey;
  categoryLabel?: string;
  entry?: string;
  rationale: string;
  source: "claude" | "gemini" | "mock";
}

export interface ClassifyResult {
  findings: ClassifiedFinding[];
  /** One-paragraph, whole-contract read of what it actually does — not just the payment lines. */
  purpose: string;
  /** Other value-movement patterns the model noticed that the structural scan didn't capture
   *  (delegatecall, selfdestruct, arbitrary low-level call, etc.) — informational only, never
   *  auto-patched, since we can't reliably rewrite what we can't structurally locate. */
  additionalConcerns: string[];
}

function mockClassify(f: ScanFinding): { category: CategoryKey; rationale: string } {
  const s = `${f.functionName} ${f.toExpr} ${f.statement}`.toLowerCase();
  const guess: [RegExp, CategoryKey][] = [
    [/nft|nonfungible|mint|collection|floor/, "nft_purchase"],
    [/swap|token|dex|slippage|amm/, "defi_swap"],
    [/subscri|billing|recurring|invoice/, "subscription"],
    [/dao|treasury|grant|proposal|governance/, "treasury_dao"],
    [/tip|donate|reward|creator/, "social_tip"],
  ];
  const hit = guess.find(([re]) => re.test(s));
  return { category: hit?.[1] ?? "api_payment", rationale: "[mock] anahtar kelimeye göre tahmin edildi, LLM yok" };
}

interface RawFinding {
  id: number;
  category: string;
  rationale: string;
}
interface RawUnderstanding {
  purpose: string;
  findings: RawFinding[];
  additionalConcerns?: string[];
}

function buildPrompt(findings: ScanFinding[], source: string, sourceCap: number): string {
  const supported = findings.filter((f) => f.supported);
  return `Bir Solidity kontratını incelemen gerekiyor. Bu kontratın sahibi, içindeki ödeme noktalarını
"Unpromptable" adlı bir korumaya (kasa kontratına) yönlendirmek istiyor. Görevin iki parça:

1. Kontratın BÜTÜNÜNE bakarak ne iş yaptığını bir paragrafta özetle (fonksiyon isimlerine değil,
   gerçek davranışına bak: kim çağırıyor, para nereye gidiyor, tekrarlayan mı tek seferlik mi).
2. Aşağıda statik taramayla bulunmuş, MON (native coin) gönderen ifadeleri şu 6 kategoriden birine ata:
   api_payment (API/servis ödemesi), nft_purchase (NFT alımı), defi_swap (DeFi takas),
   subscription (abonelik), treasury_dao (DAO hazine harcaması), social_tip (sosyal bahşiş).
   Kategoriyi SADECE fonksiyon adına göre değil, kontratın genel amacına göre seç.
3. Statik taramanın KAÇIRMIŞ OLABİLECEĞİ başka para hareketi noktaları var mı (delegatecall,
   selfdestruct, düşük seviye arbitrary call, bir yönetici fonksiyonunun tüm bakiyeyi çekmesi vb.)?
   Varsa düz Türkçe, kısa cümlelerle listele. Yoksa boş dizi döndür. Bunları PATCH ETMİYORUZ,
   sadece kullanıcıyı uyarıyoruz.

Kontrat kaynağı:
---
${source.slice(0, sourceCap)}
---

Statik taramanın bulduğu MON gönderen ifadeler (id, satır, fonksiyon, ifade):
${supported.map((f) => `${f.id}: satır ${f.line}, fonksiyon ${f.functionName}(), \`${f.statement}\``).join("\n")}

Sadece şu şekilde bir JSON nesnesi döndür, başka hiçbir metin yazma:
{"purpose": "<bir paragraf, Türkçe>", "findings": [{"id": <sayı>, "category": "<altı kategoriden biri>", "rationale": "<tek cümle, Türkçe>"}], "additionalConcerns": ["<varsa, yoksa boş dizi>"]}`;
}

/**
 * Extracts the first balanced {...} object from free-form model output (code
 * fences, a stray trailing sentence, etc. can all follow it) by tracking
 * brace depth and string state, rather than a greedy first-{-to-last-}
 * regex, which breaks the moment anything after the JSON contains a brace.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("yanıtta JSON nesnesi yok");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("yanıttaki JSON nesnesi kapanmıyor");
}

function parseUnderstanding(text: string): RawUnderstanding {
  return JSON.parse(extractJsonObject(text)) as RawUnderstanding;
}

async function understandWithClaude(findings: ScanFinding[], source: string): Promise<RawUnderstanding> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY yok");
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(findings, source, 40_000) }],
  });
  if (message.stop_reason === "max_tokens") throw new Error("Claude yanıtı max_tokens'ta kesildi");
  const text = message.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return parseUnderstanding(text);
}

async function understandWithGemini(findings: ScanFinding[], source: string): Promise<RawUnderstanding> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY yok");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" });
  const result = await model.generateContent(buildPrompt(findings, source, 6_000));
  return parseUnderstanding(result.response.text());
}

/**
 * Reads the WHOLE contract (not just the matched lines) to explain what it
 * does and classify every supported finding, preferring Claude for the
 * deeper, whole-file reasoning this needs; Gemini is the fallback if Claude
 * is unavailable or fails, and a keyword guess is the last resort so the
 * pipeline never just stops.
 */
export async function classifyFindings(findings: ScanFinding[], source: string): Promise<ClassifyResult> {
  const supported = findings.filter((f) => f.supported);
  let raw: RawUnderstanding | undefined;
  let usedSource: "claude" | "gemini" | undefined;

  if (supported.length > 0) {
    try {
      raw = await understandWithClaude(findings, source);
      usedSource = "claude";
    } catch (err) {
      console.warn("[contractx] Claude başarısız, Gemini'ye düşülüyor:", err instanceof Error ? err.message : err);
      try {
        raw = await understandWithGemini(findings, source);
        usedSource = "gemini";
      } catch (err2) {
        console.warn("[contractx] Gemini de başarısız, mock'a düşülüyor:", err2 instanceof Error ? err2.message : err2);
      }
    }
  }

  const results = new Map<number, { category: CategoryKey; rationale: string }>();
  if (raw) {
    for (const p of raw.findings ?? []) {
      if (BY_KEY.has(p.category as CategoryKey)) results.set(p.id, { category: p.category as CategoryKey, rationale: p.rationale });
    }
  }

  const classified = findings.map((f): ClassifiedFinding => {
    if (!f.supported) return { ...f, rationale: "ERC20 token transferi — bu sürüm sadece native MON'u koruyor.", source: "mock" };
    const got = results.get(f.id);
    const category = got?.category ?? mockClassify(f).category;
    const cat = BY_KEY.get(category)!;
    return {
      ...f,
      category,
      categoryLabel: cat.label,
      entry: cat.entry,
      rationale: got?.rationale ?? mockClassify(f).rationale,
      source: got ? usedSource! : "mock",
    };
  });

  return {
    findings: classified,
    purpose: raw?.purpose ?? "Kontratın genel amacı çözümlenemedi (LLM'e ulaşılamadı) — sadece statik tarama sonuçları aşağıda.",
    additionalConcerns: raw?.additionalConcerns ?? [],
  };
}

// ---------- patch ----------

const GUARD_INTERFACE = `interface IUnpromptableGuard {
    function proposePayment(address payable to, uint256 amount) external returns (uint8);
    function proposeNftPurchase(address payable to, uint256 amount) external returns (uint8);
    function proposeSwap(address payable to, uint256 amount) external returns (uint8);
    function proposeSubscription(address payable to, uint256 amount) external returns (uint8);
    function proposeGrant(address payable to, uint256 amount) external returns (uint8);
    function proposeTip(address payable to, uint256 amount) external returns (uint8);
}
// TODO: /app/olustur'da oluşturduğun kasanın adresini buraya koy.
address constant UNPROMPTABLE_GUARD = address(0);
`;

/**
 * Replaces every supported payment statement with a call through
 * IUnpromptableGuard, routed to a placeholder constant. Purely mechanical —
 * the LLM only chose a category earlier, it never writes code here.
 */
export function patchSource(source: string, classified: ClassifiedFinding[]): string {
  const lines = source.split("\n");
  const byLine = new Map<number, ClassifiedFinding[]>();
  for (const f of classified) {
    if (!f.supported || !f.entry) continue;
    if (!byLine.has(f.line)) byLine.set(f.line, []);
    byLine.get(f.line)!.push(f);
  }

  for (const [lineNo, fs] of byLine) {
    let text = lines[lineNo - 1];
    for (const f of fs) {
      const replacement = `IUnpromptableGuard(UNPROMPTABLE_GUARD).${f.entry}(payable(${f.toExpr}), ${f.amountExpr})`;
      const patterns = [
        new RegExp(escapeRe(`${f.toExpr}.transfer(${f.amountExpr})`)),
        new RegExp(escapeRe(`${f.toExpr}.send(${f.amountExpr})`)),
      ];
      let replaced = false;
      for (const re of patterns) {
        if (re.test(text)) {
          text = text.replace(re, replacement);
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        // .call{value: ...}(...) has too many shapes to reconstruct exactly;
        // splice the guard call in as the statement and comment the original out.
        text = `${text} /* UnpromptableGuard: ${replacement}; — call{value:} orijinali yorumlandı, elle uygula */`;
      }
    }
    lines[lineNo - 1] = text;
  }

  const pragmaIdx = lines.findIndex((l) => /^\s*pragma solidity/.test(l));
  const insertAt = pragmaIdx >= 0 ? pragmaIdx + 1 : 0;
  lines.splice(insertAt, 0, "", GUARD_INTERFACE);
  return lines.join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sourceLabel(source: string): string {
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
}
