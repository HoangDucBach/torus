import type { AbiEvent, Address } from "viem";
import { publicClient } from "./clients.ts";

// The public RPC rejects eth_getLogs ranges wider than ~10-20k blocks ("requested range too
// large") — chunk every scan through this one helper instead of re-deriving that limit elsewhere.
const MAX_BLOCK_RANGE = 9_000n;

export async function scanLogs<const event extends AbiEvent>(params: {
  address: Address | Address[];
  event: event;
  args?: Record<string, unknown>;
  fromBlock: bigint;
}) {
  const latest = await publicClient.getBlockNumber();
  const logs = [];

  for (let start = params.fromBlock; start <= latest; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE < latest ? start + MAX_BLOCK_RANGE : latest;
    const chunk = await publicClient.getLogs({
      address: params.address,
      event: params.event,
      // This generic helper is intentionally shared across events with different indexed-arg
      // shapes; viem's precise per-event `args` type can't be expressed for that here.
      args: params.args as never,
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
  }

  return logs;
}
