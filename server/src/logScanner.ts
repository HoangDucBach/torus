import type { AbiEvent, Address } from "viem";
import { publicClient } from "./clients.ts";

// The public RPC rejects eth_getLogs ranges wider than ~10-20k blocks ("requested range too
// large") — chunk every scan through this one helper instead of re-deriving that limit elsewhere.
const MAX_BLOCK_RANGE = 9_000n;

// Back-to-back requests trip Arc's public RPC rate limiter; spacing them keeps us under it.
const CHUNK_DELAY_MS = 1_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Yields one chunk of logs at a time (all `events`, all `address`es in a single request per
 * chunk) so callers can persist progress as they go and resume after a failure.
 */
export async function* scanLogChunks<const events extends readonly AbiEvent[]>(params: {
  address: Address | Address[];
  events: events;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  for (let start = params.fromBlock; start <= params.toBlock; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE < params.toBlock ? start + MAX_BLOCK_RANGE : params.toBlock;
    const logs = await publicClient.getLogs({
      address: params.address,
      events: params.events,
      fromBlock: start,
      toBlock: end,
    });
    yield { logs, toBlock: end };
    if (end < params.toBlock) await sleep(CHUNK_DELAY_MS);
  }
}
