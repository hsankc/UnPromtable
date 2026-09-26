import {
  createPublicClient,
  createWalletClient,
  http,
  type Hash,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainConfig } from "./config.js";
import { keylessVaultAbi } from "./abi.js";

// A brand-new vault's first approved payment touches many zero-initialized
// storage slots (paidCount, totalPaid, windowStart, dayStart, ...), and a
// cold SSTORE costs far more than the warm updates our gas benchmarks
// measured on an already-seeded vault. 400k stays modest in absolute terms
// while covering that first-write spike; steady-state calls use a fraction
// of it.
const FIXED_GAS_LIMIT = BigInt(process.env.GAS_LIMIT ?? 400_000);

interface RelayerSlot {
  index: number;
  address: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
  nonce: number;
}

export interface ProposeJob {
  to: `0x${string}`;
  amountWei: bigint;
}

export type ProposeOutcome =
  | { status: "sent"; relayer: `0x${string}`; hash: Hash }
  | { status: "queued"; reason: string };

/**
 * Round-robins propose() calls across a pool of relayer wallets, each
 * tracking its own nonce so sends never collide. A transaction that fails
 * (bad nonce, transient RPC error) is re-synced and retried a couple of
 * times before the job is handed back as "queued" rather than thrown —
 * callers show that as "sıraya alındı", never a raw error.
 */
export class RelayerPool {
  private readonly publicClient: PublicClient;
  private readonly slots: RelayerSlot[];
  private cursor = 0;
  private readonly queue: ProposeJob[] = [];

  private constructor(publicClient: PublicClient, slots: RelayerSlot[]) {
    this.publicClient = publicClient;
    this.slots = slots;
  }

  static async create(chain: ChainConfig): Promise<RelayerPool> {
    const transport = http(chain.rpcUrl);
    const publicClient = createPublicClient({ transport }) as PublicClient;

    const slots: RelayerSlot[] = [];
    for (let i = 0; i < chain.relayerKeys.length; i++) {
      const account = privateKeyToAccount(chain.relayerKeys[i]);
      const wallet = createWalletClient({ account, transport });
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      slots.push({ index: i, address: account.address, account, wallet, nonce });
    }

    return new RelayerPool(publicClient, slots);
  }

  get addresses(): `0x${string}`[] {
    return this.slots.map((s) => s.address);
  }

  private nextSlot(): RelayerSlot {
    const slot = this.slots[this.cursor % this.slots.length];
    this.cursor += 1;
    return slot;
  }

  async propose(vault: `0x${string}`, job: ProposeJob, attempt = 0): Promise<ProposeOutcome> {
    const slot = this.nextSlot();
    try {
      const hash = await slot.wallet.writeContract({
        address: vault,
        abi: keylessVaultAbi,
        functionName: "propose",
        args: [job.to, job.amountWei],
        account: slot.account,
        chain: null,
        nonce: slot.nonce,
        gas: FIXED_GAS_LIMIT,
      });
      slot.nonce += 1;
      return { status: "sent", relayer: slot.address, hash };
    } catch (err) {
      if (attempt < 2) {
        // Nonce likely stale (e.g. a previous send from this slot never
        // landed) — resync from chain and retry with a fresh slot pick.
        slot.nonce = await this.publicClient.getTransactionCount({ address: slot.address });
        return this.propose(vault, job, attempt + 1);
      }
      this.queue.push(job);
      return { status: "queued", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  get queueLength(): number {
    return this.queue.length;
  }

  async drainQueue(vault: `0x${string}`): Promise<ProposeOutcome[]> {
    const pending = this.queue.splice(0, this.queue.length);
    const results: ProposeOutcome[] = [];
    for (const job of pending) {
      results.push(await this.propose(vault, job));
    }
    return results;
  }

  async waitForReceipt(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  get client(): PublicClient {
    return this.publicClient;
  }
}
