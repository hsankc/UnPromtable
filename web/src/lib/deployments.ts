// Every address here is live on Monad testnet and was verified from chain
// state after deploy (getCode / view calls), not from receipts.
export const TREASURY = "0x3D254CE41d2462A1292aAD726A39E6845fcDe452" as const;

export const REGISTRY_V2 = {
  address: "0xc7bF53E580E19384d80DFCEc4dAAf6d4fEBF6409" as const,
  deployBlock: 65675416n,
} as const;

export const REGISTRY_V1 = {
  address: "0xAA4179BFe9557277A53ee53809Cc336e8c130eea" as const,
} as const;

export const GUARD_LAB = "0x017818c3B30e538de2418FCE459cA2B0E625e083" as const;

// Shared reputation source every generated vault reads (MockReputation).
export const REPUTATION = "0xFfc80c21C218b67B6d18282a52b68dfA0e2681C8" as const;

// The original single-model KeylessVault the Gemini agent and the stage demo use.
// Redeployed fresh on 2026-09-26 (see agent/.env / memory) so demo history
// reads as today's activity rather than an older test run.
export const DEMO_VAULT = {
  address: "0x0820015450fc95395EE4B8A927569211652C951B" as const,
  deployBlock: 65802049n,
} as const;

export const FEE_PER_MODEL_WEI = 1_000_000_000_000_000n; // 0.001 MON
export const CONVERSION_FEE_WEI = 10_000_000_000_000_000n; // 0.01 MON
export const PROTOCOL_FEE_BPS = 10; // 0.1%

export const MONAD_CODE_LIMIT = 131072;
export const ETHEREUM_CODE_LIMIT = 24576;
