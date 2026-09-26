import { parseAbi } from "viem";

export const registryV2Abi = parseAbi([
  "function treasury() view returns (address)",
  "function FEE_PER_MODEL() view returns (uint256)",
  "function CONVERSION_FEE() view returns (uint256)",
  "function creationFee(uint8 mask) view returns (uint256)",
  "function count() view returns (uint256)",
  "function totalCreationFees() view returns (uint256)",
  "function totalConversionFees() view returns (uint256)",
  "function conversions() view returns (uint256)",
  "function isVault(address) view returns (bool)",
  "function paidConversion(address payer, bytes32 sourceHash) view returns (bool)",
  "function vaultIdsOf(address owner) view returns (uint256[])",
  "function allVaults() view returns ((address vault, address owner, uint8 categoryBitmask, uint256 feePaid, uint64 deployedAt)[])",
  "function createVault(bytes initCode, uint8 mask) payable returns (address vault)",
  "function payConversion(bytes32 sourceHash) payable",
  "event VaultCreated(address indexed vault, address indexed owner, uint8 categoryBitmask, uint256 feePaid, uint256 funded)",
  "event ConversionPaid(address indexed payer, bytes32 indexed sourceHash, uint256 feePaid)",
]);

export const registryV1Abi = parseAbi([
  "function count() view returns (uint256)",
  "function allVaults() view returns ((address vault, address owner, uint8 categoryBitmask, uint256 feePaid, uint64 deployedAt)[])",
]);

export const guardLabAbi = parseAbi([
  "function decide(uint8 category, int256[8] x) pure returns (uint8 d, int256[3] o)",
]);

// Read/write surface shared by every generated vault (v1 and v2).
export const multiVaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function CATEGORY_MASK() view returns (uint8)",
  "function DELAY() view returns (uint256)",
  "function HARD_CAP_BPS() view returns (uint256)",
  "function UNKNOWN_DAILY_BPS() view returns (uint256)",
  "function dayStart() view returns (uint256)",
  "function dayUnknownOut() view returns (uint256)",
  "function dayCap() view returns (uint256)",
  "function allow(address) view returns (bool)",
  "function trusted(address) view returns (bool)",
  "function pending(uint256) view returns (address to, uint256 amount, uint64 releaseAt, bool vetoed, bool done)",
  "function features(address to, uint256 amount) view returns (int256[8])",
  "function setAllow(address a, bool b)",
  "function veto(uint256 id)",
  "function release(uint256 id)",
]);

export const v2OnlyAbi = parseAbi([
  "function TREASURY() view returns (address)",
  "function PROTOCOL_FEE_BPS() view returns (uint256)",
]);

// The original single-model demo vault.
export const keylessVaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function propose(address to, uint256 amount) returns (uint8)",
  "function pending(uint256) view returns (address to, uint256 amount, uint64 releaseAt, bool vetoed, bool done)",
]);
