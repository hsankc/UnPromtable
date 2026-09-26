import path from "node:path";
import dotenv from "dotenv";

// Services share the agent's .env (relayer keys, Gemini key). Nothing from it
// is ever sent to the browser.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../agent/.env"), quiet: true });

export const RPC_URL = process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz/";
export const EXPLORER = process.env.MONAD_TESTNET_EXPLORER ?? "https://testnet.monadexplorer.com";
export const GUARD_DIR = path.resolve(import.meta.dirname, "../../extracted/guard");
export const CACHE_DIR = path.resolve(import.meta.dirname, "../.cache");

// PATH isn't reliably inherited across how these get started, so the
// toolchain is resolved to absolute binaries.
export const FORGE_BIN = process.env.FORGE_BIN ?? "C:\\Users\\hasan\\.foundry\\bin\\forge.exe";
export const PYTHON_BIN = process.env.PYTHON_BIN ?? "C:\\Users\\hasan\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";

export const TREASURY = "0x3D254CE41d2462A1292aAD726A39E6845fcDe452" as const;
export const REGISTRY_V2 = "0xc7bF53E580E19384d80DFCEc4dAAf6d4fEBF6409" as const;
export const REGISTRY_V2_BLOCK = 65675416n;
export const REGISTRY_V1 = "0xAA4179BFe9557277A53ee53809Cc336e8c130eea" as const;
export const REPUTATION = "0xFfc80c21C218b67B6d18282a52b68dfA0e2681C8" as const;
// Redeployed fresh 2026-09-26 — see web/src/lib/deployments.ts's matching comment.
export const DEMO_VAULT = "0x0820015450fc95395EE4B8A927569211652C951B" as const;
export const DEMO_VAULT_DEPLOY_BLOCK = 65802049n;
