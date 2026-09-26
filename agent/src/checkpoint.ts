import "dotenv/config";
import { createPublicClient, http, decodeEventLog, type Log } from "viem";
import { keylessVaultAbi } from "./abi.js";

const RPC = process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz/";
const VAULT = "0xfFeb20303e91B07f1bC709E1661F58a52271CE99" as const;
const DEPLOY_BLOCK = 65273071n;

const client = createPublicClient({ transport: http(RPC) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const latest = await client.getBlockNumber();
  const CHUNK = 99n;
  const items: { id: string; decision: 0 | 1 | 2; to: string; amountWei: string; txHash: string; blockNumber: string }[] = [];

  let n = 0;
  for (let start = DEPLOY_BLOCK; start <= latest; start += CHUNK + 1n) {
    const end = start + CHUNK > latest ? latest : start + CHUNK;
    let logs: Log[] = [];
    for (let attempt = 0; ; attempt++) {
      try {
        logs = await client.getLogs({ address: VAULT, fromBlock: start, toBlock: end });
        break;
      } catch (err) {
        if (attempt >= 5) throw err;
        await sleep(500 * 2 ** attempt);
      }
    }
    for (const log of logs) {
      try {
        const parsed = decodeEventLog({ abi: keylessVaultAbi, data: log.data, topics: log.topics });
        const decision = parsed.eventName === "Executed" ? 0 : parsed.eventName === "Delayed" ? 1 : parsed.eventName === "Rejected" ? 2 : null;
        if (decision === null) continue;
        const args = parsed.args as unknown as { to: string; amount: bigint };
        items.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          decision,
          to: args.to,
          amountWei: args.amount.toString(),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!.toString(),
        });
      } catch {
        // not one of ours
      }
    }
    n++;
    if (n % 50 === 0) console.log(`  ${n} chunks done, block ${start}/${latest}`);
    await sleep(120); // ~8 req/s, safe margin
  }

  items.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)));
  const rejectedTotal = items.filter((i) => i.decision === 2).reduce((s, i) => s + BigInt(i.amountWei), 0n);
  const heldOrBlocked = items.filter((i) => i.decision !== 0).reduce((s, i) => s + BigInt(i.amountWei), 0n);
  const feed = items.slice(-12).reverse();

  console.log(JSON.stringify({ block: latest.toString(), rejectedTotal: rejectedTotal.toString(), heldOrBlocked: heldOrBlocked.toString(), feed, totalEvents: items.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
