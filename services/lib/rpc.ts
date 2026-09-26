import { createPublicClient, http, toHex, type Address, type Hex } from "viem";
import { RPC_URL } from "./env.js";

export const publicClient = createPublicClient({ transport: http(RPC_URL, { retryCount: 3, retryDelay: 400 }) });

// Monad's public RPC allows ~25 req/s; the browser talks to it too, so the
// services keep to a modest share.
const MAX_PER_SECOND = 8;
let tokens = MAX_PER_SECOND;
const waiters: (() => void)[] = [];
setInterval(() => {
  tokens = MAX_PER_SECOND;
  while (tokens > 0 && waiters.length) {
    tokens--;
    waiters.shift()!();
  }
}, 1000).unref();

export function throttle(): Promise<void> {
  if (tokens > 0) {
    tokens--;
    return Promise.resolve();
  }
  return new Promise((r) => waiters.push(r));
}

export interface RawLog {
  address: Address;
  topics: [Hex, ...Hex[]];
  data: Hex;
  blockNumber: Hex;
  blockTimestamp?: Hex;
  transactionHash: Hex;
  logIndex: Hex;
}

/** eth_getLogs over at most 100 blocks (Monad's limit), raw so blockTimestamp survives. */
export async function getLogsRaw(from: bigint, to: bigint, address: Address[]): Promise<RawLog[]> {
  await throttle();
  return (await publicClient.request({
    method: "eth_getLogs",
    params: [{ fromBlock: toHex(from), toBlock: toHex(to), address }],
  } as never)) as RawLog[];
}

export async function head(): Promise<bigint> {
  await throttle();
  return publicClient.getBlockNumber({ cacheTime: 0 });
}
