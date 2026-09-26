import path from "node:path";
import dotenv from "dotenv";
// Reuse the agent's own wallets/deployment — same relayer pool, same vault.
dotenv.config({ path: path.resolve(import.meta.dirname, "../agent/.env") });

import { WebSocketServer, WebSocket } from "ws";
import { parseEther, decodeEventLog } from "viem";
import { loadChainConfig, requireVaultAddress } from "../agent/src/config.js";
import { RelayerPool } from "../agent/src/relayerPool.js";
import { keylessVaultAbi } from "../agent/src/abi.js";
import { think } from "../agent/src/thinker.js";

const chain = loadChainConfig();
const vault = requireVaultAddress();
const pool = await RelayerPool.create(chain);

console.log(`relay: chain=${chain.name} vault=${vault}`);
console.log(`relay: relayers=${pool.addresses.join(", ")}`);

const PORT = 8787;
const wss = new WebSocketServer({ port: PORT });

interface ProposePayload {
  id: string;
  name: string;
  address: string;
  amountMon: number;
  hiddenInstruction: string;
}

wss.on("connection", (socket: WebSocket) => {
  socket.on("message", async (data) => {
    let msg: { type: string; payload: ProposePayload };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type !== "propose") return;
    const { id, name, address, amountMon, hiddenInstruction } = msg.payload;

    try {
      // Route through the same thinker the agent uses — the phone's
      // "gizli talimat" is a prompt-injection attempt aimed at the LLM,
      // not at the contract. Whatever Gemini decides to propose is what
      // actually gets submitted; the vault is the real backstop.
      const thought = await think({ provider: name, toAddress: address, priceMon: amountMon, note: hiddenInstruction });
      console.log(`relay: thinker(${thought.source}) -> ${thought.amountMon} MON to ${thought.toAddress}`);

      const outcome = await pool.propose(vault, {
        to: thought.toAddress as `0x${string}`,
        amountWei: parseEther(String(thought.amountMon)),
      });

      if (outcome.status === "queued") {
        socket.send(
          JSON.stringify({
            type: "decision",
            payload: { id, status: "queued", reason: outcome.reason, thinkerSource: thought.source, rationale: thought.rationale },
          })
        );
        return;
      }

      const receipt = await pool.waitForReceipt(outcome.hash);
      let decision: 0 | 1 | 2 | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({ abi: keylessVaultAbi, data: log.data, topics: log.topics });
          if (parsed.eventName === "Executed") decision = 0;
          else if (parsed.eventName === "Delayed") decision = 1;
          else if (parsed.eventName === "Rejected") decision = 2;
        } catch {
          // other log on the same tx, ignore
        }
      }

      socket.send(
        JSON.stringify({
          type: "decision",
          payload: {
            id,
            status: receipt.status,
            decision,
            txHash: outcome.hash,
            relayer: outcome.relayer,
            thinkerSource: thought.source,
            rationale: thought.rationale,
            proposedAmountMon: thought.amountMon,
          },
        })
      );
    } catch (err) {
      socket.send(
        JSON.stringify({
          type: "decision",
          payload: { id, status: "error", reason: err instanceof Error ? err.message : String(err) },
        })
      );
    }
  });
});

console.log(`relay listening on ws://0.0.0.0:${PORT}`);
