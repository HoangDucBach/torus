import { parseAbiItem } from "viem";
import { addresses } from "./contracts.ts";
import { scanLogs } from "./logScanner.ts";

// No single contract getter tracks this — it's a running total aggregated from every
// UserOperationSponsored event across both paymaster versions.
export type GasSponsoredStats = {
  totalTorUsdcCharged: bigint;
  userOperationCount: number;
};

const USER_OPERATION_SPONSORED_EVENT = parseAbiItem(
  "event UserOperationSponsored(bytes32 indexed userOpHash, address indexed token, uint256 tokenAmount, uint256 tokenPerNative)"
);

// The scan takes several RPC round trips; cache briefly so /stats doesn't redo it every request.
const CACHE_TTL_MS = 60_000;
let cache: { value: GasSponsoredStats; expiresAt: number } | undefined;

export async function getGasSponsoredStats(): Promise<GasSponsoredStats> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const fromBlock = BigInt(addresses.deployedAtBlock ?? 0);
  const paymasters = [addresses.paymaster, addresses.paymasterV08].filter(
    (p): p is `0x${string}` => Boolean(p)
  );

  const events = await scanLogs({
    address: paymasters,
    event: USER_OPERATION_SPONSORED_EVENT,
    fromBlock,
  });

  const value: GasSponsoredStats = {
    totalTorUsdcCharged: events.reduce((sum, log) => sum + (log.args.tokenAmount ?? 0n), 0n),
    userOperationCount: events.length,
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
