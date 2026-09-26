import { parseAbi } from "viem";

export const keylessVaultAbi = parseAbi([
  "function propose(address to, uint256 amount) returns (uint8)",
  "function owner() view returns (address)",
  "event Executed(address indexed to, uint256 amount, int256[3] logits)",
  "event Delayed(uint256 indexed id, address indexed to, uint256 amount, int256[3] logits)",
  "event Rejected(address indexed to, uint256 amount, int256[3] logits)",
]);
