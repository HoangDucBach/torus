import { parseAbiItem } from "viem";
import { publicClient } from "./clients.ts";
import { addresses } from "./contracts.ts";

/**
 * Real, on-chain-derived "gas sponsored" totals — summed from every `UserOperationSponsored`
 * event either TorusPaymaster instance (v0.7 and, if deployed, v0.8) has ever emitted. This is
 * the one number in the whole API that can't be read from a single contract getter: it's a
 * running total across every sponsored UserOperation, so it has to be aggregated from logs.
 */
export type GasSponsoredStats = {
  /** Total torUSDC (18 decimals) ever charged for gas across every sponsored UserOperation. */
  totalTorUsdcCharged: bigint;
  /** Number of UserOperations sponsored. */
  userOperationCount: number;
};

const USER_OPERATION_SPONSORED_EVENT = parseAbiItem(
  "event UserOperationSponsored(bytes32 indexed userOpHash, address indexed token, uint256 tokenAmount, uint256 tokenPerNative)"
);

// The public RPC rejects `eth_getLogs` ranges wider than ~10-20k blocks ("requested range too
// large") — chunk the scan instead of requesting the whole range in one call.
const MAX_BLOCK_RANGE = 9_000n;

async function fetchSponsoredEvents(paymaster: `0x${string}`, fromBlock: bigint) {
  const latest = await publicClient.getBlockNumber();
  const events = [];

  for (let start = fromBlock; start <= latest; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE < latest ? start + MAX_BLOCK_RANGE : latest;
    const logs = await publicClient.getLogs({
      address: paymaster,
      event: USER_OPERATION_SPONSORED_EVENT,
      fromBlock: start,
      toBlock: end,
    });
    events.push(...logs);
  }

  return events;
}

// In-memory cache: this scan takes several RPC round trips, and the totals only ever grow, so
// there's no reason to redo it on every /stats request. A short TTL keeps it fresh enough for a
// dashboard without hammering the RPC.
const CACHE_TTL_MS = 60_000;
let cache: { value: GasSponsoredStats; expiresAt: number } | undefined;

export async function getGasSponsoredStats(): Promise<GasSponsoredStats> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const fromBlock = BigInt(addresses.deployedAtBlock ?? 0);
  const paymasters = [addresses.paymaster, addresses.paymasterV08].filter(
    (p): p is `0x${string}` => Boolean(p)
  );

  const eventLists = await Promise.all(paymasters.map((p) => fetchSponsoredEvents(p, fromBlock)));
  const events = eventLists.flat();

  const value: GasSponsoredStats = {
    totalTorUsdcCharged: events.reduce((sum, log) => sum + (log.args.tokenAmount ?? 0n), 0n),
    userOperationCount: events.length,
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
