import "dotenv/config";

type Hex = `0x${string}`;

// Anvil's well-known default accounts (from its own "test test test ... junk"
// dev mnemonic), captured directly from a live `anvil` run in this repo.
// Used only when CHAIN=anvil — zero real value, safe to keep in source.
const ANVIL_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

export interface ChainConfig {
  name: "anvil" | "monad-testnet";
  rpcUrl: string;
  chainId: number;
  explorer: string | null;
  ownerKey: Hex;
  relayerKeys: Hex[];
}

export function loadChainConfig(): ChainConfig {
  const chain = process.env.CHAIN ?? "anvil";

  if (chain === "monad-testnet") {
    return {
      name: "monad-testnet",
      rpcUrl: process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz/",
      chainId: Number(process.env.MONAD_TESTNET_CHAIN_ID ?? 10143),
      explorer: process.env.MONAD_TESTNET_EXPLORER ?? "https://testnet.monadexplorer.com",
      ownerKey: requireEnv("OWNER_PRIVATE_KEY") as Hex,
      relayerKeys: requireEnv("RELAYER_PRIVATE_KEYS")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as Hex[],
    };
  }

  return {
    name: "anvil",
    rpcUrl: process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.ANVIL_CHAIN_ID ?? 31337),
    explorer: null,
    ownerKey: ANVIL_KEYS[0],
    relayerKeys: ANVIL_KEYS.slice(1, 5),
  };
}

export function requireVaultAddress(): Hex {
  return requireEnv("VAULT_ADDRESS") as Hex;
}
