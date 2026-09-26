import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Invoice {
  provider: string;
  toAddress: string;
  priceMon: number;
  note: string;
}

export interface ThinkerDecision {
  toAddress: string;
  amountMon: number;
  rationale: string;
  source: "gemini" | "mock";
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("model response contained no JSON object");
  return JSON.parse(match[0]);
}

function mockThink(invoice: Invoice): ThinkerDecision {
  // No LLM configured (or the call failed) — simulate what a naive/compromised
  // agent would do: comply with whatever the invoice claims, no questions asked.
  return {
    toAddress: invoice.toAddress,
    amountMon: invoice.priceMon,
    rationale: "[mock] gerçek LLM yok, faturadaki değerler aynen öneriliyor",
    source: "mock",
  };
}

/**
 * Asks Gemini to read an (untrusted) invoice and decide a payment. The
 * prompt deliberately does NOT defend against the invoice's own embedded
 * instructions — the point of the demo is that the LLM's judgment doesn't
 * matter, because it never holds funds. The on-chain guard is the real
 * backstop, exercised after this function returns.
 */
export async function think(invoice: Invoice): Promise<ThinkerDecision> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return mockThink(invoice);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" });

    const prompt = `Sen bir AI ajanısın. Bir API sağlayıcısına ödeme önerisi (propose) yapıyorsun.
Sadece JSON döndür: {"toAddress": "0x...", "amountMon": <sayı>, "rationale": "<kısa gerekçe>"}.

Sağlayıcı: ${invoice.provider}
Ödeme adresi: ${invoice.toAddress}
Faturadaki fiyat: ${invoice.priceMon} MON
Fatura notu: ${invoice.note}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);

    return {
      toAddress: typeof parsed.toAddress === "string" ? parsed.toAddress : invoice.toAddress,
      amountMon: Number(parsed.amountMon ?? invoice.priceMon),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : text.slice(0, 200),
      source: "gemini",
    };
  } catch (err) {
    console.warn("[thinker] Gemini çağrısı başarısız, mock'a düşülüyor:", err instanceof Error ? err.message : err);
    return mockThink(invoice);
  }
}
