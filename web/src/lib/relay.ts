"use client";

import { useEffect, useRef, useState } from "react";

export const RELAY_PORT = 8787;

export function relayUrl(): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `ws://${host}:${RELAY_PORT}`;
}

export interface ProposeInput {
  name: string;
  address: string;
  amountMon: number;
  hiddenInstruction: string;
}

export type ProposeResult =
  | { kind: "decided"; decision: 0 | 1 | 2; txHash: string; thinkerSource: "gemini" | "mock"; rationale: string; proposedAmountMon: number }
  | { kind: "failed"; reason: string };

interface DecisionMessage {
  id: string;
  status: "success" | "reverted" | "queued" | "error";
  decision?: 0 | 1 | 2 | null;
  txHash?: string;
  reason?: string;
  thinkerSource?: "gemini" | "mock";
  rationale?: string;
  proposedAmountMon?: number;
}

let seq = 0;
const nextId = () => `w-${Date.now()}-${seq++}`;

/** Same protocol as dashboard/server/relay.ts: propose over WS, the real Gemini agent + real relayer answer. */
export function useRelay() {
  const wsRef = useRef<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const pending = useRef<Map<string, (m: DecisionMessage) => void>>(new Map());

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(relayUrl());
      wsRef.current = ws;
      ws.onopen = () => setReady(true);
      ws.onclose = () => setReady(false);
      ws.onerror = () => setReady(false);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "decision") {
            pending.current.get(msg.payload.id)?.(msg.payload as DecisionMessage);
            pending.current.delete(msg.payload.id);
          }
        } catch {
          // ignore malformed messages
        }
      };
    } catch {
      setReady(false);
    }
    return () => ws?.close();
  }, []);

  async function propose(input: ProposeInput): Promise<ProposeResult> {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return { kind: "failed", reason: "Relay'e bağlı değil." };
    }
    const id = nextId();
    const result = new Promise<DecisionMessage>((resolve, reject) => {
      pending.current.set(id, resolve);
      setTimeout(() => {
        if (pending.current.delete(id)) reject(new Error("Relay zamanında cevap vermedi."));
      }, 25_000);
    });
    ws.send(JSON.stringify({ type: "propose", payload: { id, ...input, ts: Date.now() } }));
    try {
      const msg = await result;
      if (msg.status === "queued") return { kind: "failed", reason: `Sıraya alındı: ${msg.reason ?? ""}` };
      if (msg.status === "error") return { kind: "failed", reason: msg.reason ?? "Bilinmeyen hata." };
      if (msg.decision === null || msg.decision === undefined) return { kind: "failed", reason: "İşlem gitti ama karar okunamadı." };
      return {
        kind: "decided",
        decision: msg.decision,
        txHash: msg.txHash ?? "",
        thinkerSource: msg.thinkerSource ?? "mock",
        rationale: msg.rationale ?? "",
        proposedAmountMon: msg.proposedAmountMon ?? 0,
      };
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  return { propose, ready };
}
