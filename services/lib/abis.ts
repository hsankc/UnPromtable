import { parseAbi } from "viem";

// Original single-model vault (the demo vault the Gemini agent pays from).
export const keylessVaultEvents = parseAbi([
  "event Executed(address indexed to, uint256 amount, int256[3] logits)",
  "event Delayed(uint256 indexed id, address indexed to, uint256 amount, int256[3] logits)",
  "event Rejected(address indexed to, uint256 amount, int256[3] logits)",
]);

// Generated multi-model vaults (v1 and v2; v2 adds ProtocolFee).
export const multiVaultEvents = parseAbi([
  "event Executed(uint8 indexed category, address indexed to, uint256 amount, int256[3] logits)",
  "event Delayed(uint8 indexed category, uint256 indexed id, address indexed to, uint256 amount, int256[3] logits)",
  "event Rejected(uint8 indexed category, address indexed to, uint256 amount, int256[3] logits)",
  "event ProtocolFee(address indexed to, uint256 amount, uint256 fee)",
]);

export const registryV2Events = parseAbi([
  "event VaultCreated(address indexed vault, address indexed owner, uint8 categoryBitmask, uint256 feePaid, uint256 funded)",
  "event ConversionPaid(address indexed payer, bytes32 indexed sourceHash, uint256 feePaid)",
]);

export const allEvents = [...keylessVaultEvents, ...multiVaultEvents, ...registryV2Events];

export const registryV2Abi = parseAbi([
  "function paidConversion(address payer, bytes32 sourceHash) view returns (bool)",
  "function count() view returns (uint256)",
  "function totalCreationFees() view returns (uint256)",
  "function totalConversionFees() view returns (uint256)",
  "function conversions() view returns (uint256)",
]);
