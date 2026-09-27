import { parseAbiItem, type Address } from "viem";
import { publicClient } from "./clients.ts";
import { addresses } from "./contracts.ts";
import { migrate, sql } from "./db.ts";
import { scanLogChunks } from "./logScanner.ts";

const CHAIN_ID = addresses.chainId;

// How often watchEvent polls for new logs once caught up (viem has no WebSocket transport for
// Arc, so "listening" is still eth_getLogs under the hood — just scoped to new blocks only,
// nothing like the full historical re-scan this replaced).
const WATCH_POLLING_INTERVAL_MS = 30_000;

const USER_OPERATION_SPONSORED_EVENT = parseAbiItem(
  "event UserOperationSponsored(bytes32 indexed userOpHash, address indexed token, uint256 tokenAmount, uint256 tokenPerNative)"
);
const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
);
const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
);

type PositionEntry = { depositedTotal: bigint; withdrawnTotal: bigint };

type State = {
  lastScannedBlock: bigint;
  totalTorUsdcCharged: bigint;
  userOperationCount: number;
  positions: Map<Address, PositionEntry>;
  lastScannedAt: number;
};

// Kept in memory as a read cache for getGasSponsoredStats/getPositionCostBasis (called on every
// /stats and /position request) — Postgres is the durable copy, not the read path.
async function loadState(): Promise<State> {
  await migrate();

  const [row] = await sql`
    SELECT last_scanned_block, total_tor_usdc_charged, user_operation_count, last_scanned_at
    FROM indexer_state WHERE chain_id = ${CHAIN_ID}
  `;

  const positionRows: { owner: string; deposited_total: string; withdrawn_total: string }[] = await sql`
    SELECT owner, deposited_total, withdrawn_total FROM indexer_positions WHERE chain_id = ${CHAIN_ID}
  `;

  return {
    lastScannedBlock: BigInt(row?.last_scanned_block ?? addresses.deployedAtBlock ?? 0),
    totalTorUsdcCharged: BigInt(row?.total_tor_usdc_charged ?? 0),
    userOperationCount: Number(row?.user_operation_count ?? 0),
    positions: new Map(
      positionRows.map((p) => [
        p.owner as Address,
        { depositedTotal: BigInt(p.deposited_total), withdrawnTotal: BigInt(p.withdrawn_total) },
      ])
    ),
    lastScannedAt: Number(row?.last_scanned_at ?? 0),
  };
}

const state = await loadState();

async function persistState() {
  await sql`
    INSERT INTO indexer_state (chain_id, last_scanned_block, total_tor_usdc_charged, user_operation_count, last_scanned_at)
    VALUES (
      ${CHAIN_ID}, ${state.lastScannedBlock.toString()}, ${state.totalTorUsdcCharged.toString()},
      ${state.userOperationCount}, ${state.lastScannedAt}
    )
    ON CONFLICT (chain_id) DO UPDATE SET
      last_scanned_block = EXCLUDED.last_scanned_block,
      total_tor_usdc_charged = EXCLUDED.total_tor_usdc_charged,
      user_operation_count = EXCLUDED.user_operation_count,
      last_scanned_at = EXCLUDED.last_scanned_at
  `;
}

async function addPosition(owner: Address, key: keyof PositionEntry, amount: bigint) {
  const entry = state.positions.get(owner) ?? { depositedTotal: 0n, withdrawnTotal: 0n };
  entry[key] += amount;
  state.positions.set(owner, entry);

  await sql`
    INSERT INTO indexer_positions (chain_id, owner, deposited_total, withdrawn_total)
    VALUES (${CHAIN_ID}, ${owner}, ${entry.depositedTotal.toString()}, ${entry.withdrawnTotal.toString()})
    ON CONFLICT (chain_id, owner) DO UPDATE SET
      deposited_total = EXCLUDED.deposited_total,
      withdrawn_total = EXCLUDED.withdrawn_total
  `;
}

async function bumpSyncedAt(latestLogBlock?: bigint) {
  state.lastScannedAt = Date.now();
  if (latestLogBlock && latestLogBlock > state.lastScannedBlock) {
    state.lastScannedBlock = latestLogBlock;
  }
  await persistState();
}

/**
 * Catches up from whatever was last persisted to the current head (chunked, rate-limit-safe —
 * see logScanner.ts). Only runs once, at boot; after this, watchEvent below takes over so we
 * never re-scan the same range twice.
 */
async function catchUp() {
  const latest = await publicClient.getBlockNumber();
  if (state.lastScannedBlock >= latest) return;

  const vault = addresses.vault.toLowerCase();
  const paymasters = [addresses.paymaster, addresses.paymasterV08].filter(
    (p): p is Address => Boolean(p)
  );
  const counts = { sponsored: 0, deposits: 0, withdrawals: 0 };

  for await (const { logs, toBlock } of scanLogChunks({
    address: [addresses.vault, ...paymasters],
    events: [USER_OPERATION_SPONSORED_EVENT, DEPOSIT_EVENT, WITHDRAW_EVENT],
    fromBlock: state.lastScannedBlock + 1n,
    toBlock: latest,
  })) {
    for (const log of logs) {
      const fromVault = log.address.toLowerCase() === vault;
      if (log.eventName === "UserOperationSponsored" && !fromVault) {
        state.totalTorUsdcCharged += log.args.tokenAmount ?? 0n;
        state.userOperationCount += 1;
        counts.sponsored += 1;
      } else if (log.eventName === "Deposit" && fromVault && log.args.owner) {
        await addPosition(log.args.owner, "depositedTotal", log.args.assets ?? 0n);
        counts.deposits += 1;
      } else if (log.eventName === "Withdraw" && fromVault && log.args.owner) {
        await addPosition(log.args.owner, "withdrawnTotal", log.args.assets ?? 0n);
        counts.withdrawals += 1;
      }
    }
    // Persisted per chunk, so a retry after a mid-scan failure resumes here instead of block 0.
    state.lastScannedBlock = toBlock;
    await bumpSyncedAt();
  }

  console.log(
    `[indexer] caught up to block ${latest} — ${counts.sponsored} sponsored op(s), ` +
      `${counts.deposits} deposit(s), ${counts.withdrawals} withdrawal(s)`
  );
}

/** Live-watches for new events from here on — no more re-scanning the same blocks on a timer. */
function watch() {
  // Resume exactly where catch-up stopped, so no block falls between the two phases.
  const fromBlock = state.lastScannedBlock + 1n;
  const paymasters = [addresses.paymaster, addresses.paymasterV08].filter(
    (p): p is Address => Boolean(p)
  );

  publicClient.watchEvent({
    address: paymasters,
    event: USER_OPERATION_SPONSORED_EVENT,
    pollingInterval: WATCH_POLLING_INTERVAL_MS,
    fromBlock,
    onLogs: async (logs) => {
      if (logs.length === 0) return;
      logs.forEach((log) => {
        state.totalTorUsdcCharged += log.args.tokenAmount ?? 0n;
        state.userOperationCount += 1;
      });
      await bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
      console.log(`[indexer] +${logs.length} sponsored UserOperation(s)`);
    },
  });

  publicClient.watchEvent({
    address: addresses.vault,
    event: DEPOSIT_EVENT,
    pollingInterval: WATCH_POLLING_INTERVAL_MS,
    fromBlock,
    onLogs: async (logs) => {
      if (logs.length === 0) return;
      for (const log of logs) {
        if (log.args.owner) await addPosition(log.args.owner, "depositedTotal", log.args.assets ?? 0n);
      }
      await bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
      console.log(`[indexer] +${logs.length} deposit(s)`);
    },
  });

  publicClient.watchEvent({
    address: addresses.vault,
    event: WITHDRAW_EVENT,
    pollingInterval: WATCH_POLLING_INTERVAL_MS,
    fromBlock,
    onLogs: async (logs) => {
      if (logs.length === 0) return;
      for (const log of logs) {
        if (log.args.owner) await addPosition(log.args.owner, "withdrawnTotal", log.args.assets ?? 0n);
      }
      await bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
      console.log(`[indexer] +${logs.length} withdrawal(s)`);
    },
  });
}

const CATCH_UP_RETRY_MS = [30_000, 60_000, 120_000, 300_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startIndexer() {
  // Historical totals are only ever counted here, so a failed catch-up (e.g. the public RPC
  // rate-limiting us) must be retried rather than skipped — otherwise they'd be missing forever.
  for (let attempt = 0; ; attempt++) {
    try {
      await catchUp();
      break;
    } catch (err) {
      const delay = CATCH_UP_RETRY_MS[Math.min(attempt, CATCH_UP_RETRY_MS.length - 1)];
      console.error(`[indexer] catch-up failed, retrying in ${delay / 1000}s:`, err);
      await sleep(delay);
    }
  }
  watch();
}

export function getGasSponsoredStats() {
  return {
    totalTorUsdcCharged: state.totalTorUsdcCharged,
    userOperationCount: state.userOperationCount,
  };
}

export function getPositionCostBasis(owner: Address) {
  return state.positions.get(owner) ?? { depositedTotal: 0n, withdrawnTotal: 0n };
}

export function getIndexerStatus() {
  return { lastScannedBlock: state.lastScannedBlock.toString(), lastScannedAt: state.lastScannedAt };
}
