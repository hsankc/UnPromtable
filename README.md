# Unpromptable

**Talk it into anything. It still won't pay.**

An AI agent that pays for things is a single convincing sentence away from
being robbed — it has no way to tell a legitimate invoice from a prompt
injection. Unpromptable's fix: the agent never holds a private key. It can
only call `propose(to, amount)` on a vault contract. A small trained neural
network runs **inside the contract itself** and decides approve / delay /
reject on every call, with two hard limits on top that no model output can
override: at most 20% of the vault per transaction, at most 1% of the vault
per day to an unrecognized address.

Built for Monad İstanbul V2. Everything in this repo runs against real
contracts on Monad testnet — no mocked chain state, no simulated decisions.

## Layout

| Path | What |
|---|---|
| `web/` | The product — Next.js App Router site. Landing page + the app (models, create a vault, bring-your-own-contract, live vault explorer, attack playground, treasury, docs) + the stage/projection pages. |
| `services/` | Backend the site talks to (`/svc/*`, proxied by `web/next.config.ts`): a chain indexer, the vault compiler, and the ContractX (bring-your-own-contract) pipeline. Also `relay.ts`, the WebSocket bridge the Gemini agent demo uses. |
| `agent/` | The keyless agent itself: a `think()` step (Gemini, with a mock fallback) plus a relayer pool that submits `propose()` transactions with no agent-held key. |
| `extracted/guard/` | The Solidity contracts and the training pipeline for the six category models (Foundry project). |

## Running it locally

Three processes, three terminals:

```bash
cd services && npm run relay   # port 8787 — the agent's WebSocket bridge
cd services && npm run api     # port 8790 — indexer + compiler + ContractX
cd web && npm run dev          # port 3000 — the site
```

(`services` also has `npm run dev` to run relay + api together.)

You'll need `agent/.env` (gitignored, ask for a copy or fill in your own —
see `agent/.env.example`) with a Gemini key, RPC settings, and a handful of
burner wallet keys. Foundry (`forge`) must be on `FORGE_BIN` or the default
path in `services/lib/env.ts`.

## Deployed contracts (Monad testnet, chain id 10143)

| Contract | Address |
|---|---|
| UnpromptableRegistry (v2 — the vault factory) | `0xc7bF53E580E19384d80DFCEc4dAAf6d4fEBF6409` |
| GuardLab (read-only model runner) | `0x017818c3B30e538de2418FCE459cA2B0E625e083` |
| CategoryRegistry (v1, kept for history) | `0xAA4179BFe9557277A53ee53809Cc336e8c130eea` |
| Treasury | `0x3D254CE41d2462A1292aAD726A39E6845fcDe452` |

Explorer: https://testnet.monadexplorer.com · Faucet: https://faucet.monad.xyz/

## What's actually proven, not just built

- A vault created through the exact browser code path — registry count
  advanced, funded balance exact, verified via the `VaultCreated` log and
  `getCode`, never `receipt.status` (Monad's own status field has reported
  "failed" on transactions that later prove to have succeeded).
- A real ContractX conversion: 0.01 MON paid and confirmed on-chain, Gemini
  correctly classified three payment sites in a sample contract, the patched
  source recompiled.
- A real attack through the site's attack playground: an ordinary-looking,
  inflated invoice that Gemini didn't even flag — the vault rejected it
  anyway for exceeding the 20% cap, regardless of what the model proposed.
