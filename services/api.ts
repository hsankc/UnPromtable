import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import "./lib/env.js";
import { keccak256, stringToHex } from "viem";
import { REGISTRY_V2 } from "./lib/env.js";
import { publicClient } from "./lib/rpc.js";
import { registryV2Abi } from "./lib/abis.js";
import { overview, recentDecisions, revenueView, startIndexer, status, vaultView } from "./indexer.js";
import { compileVault, maskOfKeys } from "./build.js";
import { classifyFindings, compileArbitrary, patchSource, scanPayments, sourceLabel } from "./contractx.js";

/**
 * HTTP API for the web app (proxied by Next under /svc). Read endpoints
 * serve indexed chain history; build endpoints (added per phase) compile
 * generated vaults and run ContractX conversions. Keys stay in this process.
 */
export const PORT = Number(process.env.API_PORT ?? 8790);

type Handler = (req: IncomingMessage, url: URL) => Promise<unknown> | unknown;
const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];

export function route(method: string, pattern: RegExp, handler: Handler) {
  routes.push({ method, pattern, handler });
}

export async function readJson<T>(req: IncomingMessage, maxBytes = 512 * 1024): Promise<T> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "İstek çok büyük.");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "Geçersiz JSON.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

route("GET", /^\/index\/status$/, () => status());
route("GET", /^\/index\/overview$/, () => overview());
route("GET", /^\/index\/revenue$/, () => revenueView(50));
route("GET", /^\/index\/decisions$/, (_req, url) => recentDecisions(Math.min(100, Number(url.searchParams.get("limit") ?? 20))));
route("GET", /^\/index\/vault\/(0x[0-9a-fA-F]{40})$/, (_req, url) => vaultView(url.pathname.split("/").pop()!));

route("POST", /^\/compile$/, async (req) => {
  const { mask } = await readJson<{ mask: number }>(req);
  if (typeof mask !== "number" || mask <= 0 || mask >= 64) throw new HttpError(400, "Geçersiz model seçimi.");
  try {
    return await compileVault(mask);
  } catch (err) {
    throw new HttpError(500, `Derleme başarısız: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
});

route("POST", /^\/contractx\/precheck$/, async (req) => {
  const { source } = await readJson<{ source: string }>(req);
  if (!source || typeof source !== "string") throw new HttpError(400, "Kaynak kodu eksik.");
  if (source.length > 60_000) throw new HttpError(413, "Kaynak kodu çok büyük (60.000 karakter sınırı).");
  const findings = scanPayments(source);
  const compile = await compileArbitrary(source, `pre-${sourceLabel(source)}`);
  return { findings, compile, sourceHash: keccak256(stringToHex(source)) };
});

route("POST", /^\/contractx\/convert$/, async (req) => {
  const { source, payer } = await readJson<{ source: string; payer: `0x${string}` }>(req);
  if (!source || !payer) throw new HttpError(400, "source ve payer gerekli.");
  const sourceHash = keccak256(stringToHex(source));
  const paid = await publicClient.readContract({ address: REGISTRY_V2, abi: registryV2Abi, functionName: "paidConversion", args: [payer, sourceHash] });
  if (!paid) throw new HttpError(402, "Ödeme zincirde görülmedi. Önce 0,01 MON'luk dönüşüm ücretini öde.");

  const findings = scanPayments(source);
  const { findings: classified, purpose, additionalConcerns } = await classifyFindings(findings, source);
  const patchedSource = patchSource(source, classified);
  const patchedCompile = await compileArbitrary(patchedSource, `post-${sourceLabel(source)}`);
  const suggestedMask = maskOfKeys(classified.filter((f) => f.supported && f.category).map((f) => f.category!));

  return { findings: classified, purpose, additionalConcerns, patchedSource, patchedCompile, suggestedMask };
});

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const r = routes.find((x) => x.method === req.method && x.pattern.test(url.pathname));
  if (!r) return send(res, 404, { error: "Bulunamadı." });
  try {
    send(res, 200, await r.handler(req, url));
  } catch (err) {
    const code = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    if (code === 500) console.error(err);
    send(res, code, { error: message });
  }
});

await startIndexer();
server.listen(PORT, "0.0.0.0", () => console.log(`api listening on http://0.0.0.0:${PORT}`));
