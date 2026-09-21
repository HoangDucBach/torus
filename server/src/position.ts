import { parseAbiItem, type Address } from "viem";
import { addresses } from "./contracts.ts";
import { scanLogs } from "./logScanner.ts";

// No getter for "how much has this address ever put in" — aggregated from the vault's own
// Deposit/Withdraw events instead (like gasStats.ts).
export type PositionCostBasis = {
  depositedTotal: bigint;
  withdrawnTotal: bigint;
};

const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
);
const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
);

const CACHE_TTL_MS = 30_000;
const cache = new Map<Address, { value: PositionCostBasis; expiresAt: number }>();

export async function getPositionCostBasis(owner: Address): Promise<PositionCostBasis> {
  const cached = cache.get(owner);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fromBlock = BigInt(addresses.deployedAtBlock ?? 0);

  const [deposits, withdrawals] = await Promise.all([
    scanLogs({ address: addresses.vault, event: DEPOSIT_EVENT, args: { owner }, fromBlock }),
    scanLogs({ address: addresses.vault, event: WITHDRAW_EVENT, args: { owner }, fromBlock }),
  ]);

  const value: PositionCostBasis = {
    depositedTotal: deposits.reduce((sum, log) => sum + (log.args.assets ?? 0n), 0n),
    withdrawnTotal: withdrawals.reduce((sum, log) => sum + (log.args.assets ?? 0n), 0n),
  };

  cache.set(owner, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
