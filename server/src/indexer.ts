import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAbiItem, type Address } from "viem";
import { publicClient } from "./clients.ts";
import { addresses } from "./contracts.ts";
import { scanLogChunks } from "./logScanner.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Scoped by chain id: running a testnet and a mainnet instance side by side (as the web app's
// network switch expects) from the same server/ checkout must not have them clobber each other's
// indexed state through one shared file.
const STATE_FILE = join(__dirname, "..", `.indexer-state.${addresses.chainId}.json`);

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

type StoredState = {
  lastScannedBlock: string;
  totalTorUsdcCharged: string;
  userOperationCount: number;
  positions: Record<string, { depositedTotal: string; withdrawnTotal: string }>;
  lastScannedAt: number;
};

function loadState(): State {
  const initial: State = {
    lastScannedBlock: BigInt(addresses.deployedAtBlock ?? 0),
    totalTorUsdcCharged: 0n,
    userOperationCount: 0,
    positions: new Map(),
    lastScannedAt: 0,
  };

  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as StoredState;
    return {
      lastScannedBlock: BigInt(raw.lastScannedBlock),
      totalTorUsdcCharged: BigInt(raw.totalTorUsdcCharged),
      userOperationCount: raw.userOperationCount,
      positions: new Map(
        Object.entries(raw.positions).map(([owner, p]) => [
          owner as Address,
          { depositedTotal: BigInt(p.depositedTotal), withdrawnTotal: BigInt(p.withdrawnTotal) },
        ])
      ),
      lastScannedAt: raw.lastScannedAt,
    };
    // Falls through to `initial` for a missing file (first run) or a corrupt/outdated one —
    // either way the indexer just re-scans from the deployment block.
  } catch {
    return initial;
  }
}

function saveState(state: State) {
  const stored: StoredState = {
    lastScannedBlock: state.lastScannedBlock.toString(),
    totalTorUsdcCharged: state.totalTorUsdcCharged.toString(),
    userOperationCount: state.userOperationCount,
    positions: Object.fromEntries(
      [...state.positions.entries()].map(([owner, p]) => [
        owner,
        { depositedTotal: p.depositedTotal.toString(), withdrawnTotal: p.withdrawnTotal.toString() },
      ])
    ),
    lastScannedAt: state.lastScannedAt,
  };
  writeFileSync(STATE_FILE, JSON.stringify(stored));
}

const state = loadState();

function addPosition(owner: Address, key: keyof PositionEntry, amount: bigint) {
  const entry = state.positions.get(owner) ?? { depositedTotal: 0n, withdrawnTotal: 0n };
  entry[key] += amount;
  state.positions.set(owner, entry);
}

function bumpSyncedAt(latestLogBlock?: bigint) {
  state.lastScannedAt = Date.now();
  if (latestLogBlock && latestLogBlock > state.lastScannedBlock) {
    state.lastScannedBlock = latestLogBlock;
  }
  saveState(state);
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
        addPosition(log.args.owner, "depositedTotal", log.args.assets ?? 0n);
        counts.deposits += 1;
      } else if (log.eventName === "Withdraw" && fromVault && log.args.owner) {
        addPosition(log.args.owner, "withdrawnTotal", log.args.assets ?? 0n);
        counts.withdrawals += 1;
      }
    }
    // Persisted per chunk, so a retry after a mid-scan failure resumes here instead of block 0.
    state.lastScannedBlock = toBlock;
    bumpSyncedAt();
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
    onLogs: (logs) => {
      if (logs.length === 0) return;
      logs.forEach((log) => {
        state.totalTorUsdcCharged += log.args.tokenAmount ?? 0n;
        state.userOperationCount += 1;
      });
      bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
      console.log(`[indexer] +${logs.length} sponsored UserOperation(s)`);
    },
  });

  publicClient.watchEvent({
    address: addresses.vault,
    event: DEPOSIT_EVENT,
    pollingInterval: WATCH_POLLING_INTERVAL_MS,
    fromBlock,
    onLogs: (logs) => {
      if (logs.length === 0) return;
      logs.forEach((log) => {
        if (log.args.owner) addPosition(log.args.owner, "depositedTotal", log.args.assets ?? 0n);
      });
      bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
      console.log(`[indexer] +${logs.length} deposit(s)`);
    },
  });

  publicClient.watchEvent({
    address: addresses.vault,
    event: WITHDRAW_EVENT,
    pollingInterval: WATCH_POLLING_INTERVAL_MS,
    fromBlock,
    onLogs: (logs) => {
      if (logs.length === 0) return;
      logs.forEach((log) => {
        if (log.args.owner) addPosition(log.args.owner, "withdrawnTotal", log.args.assets ?? 0n);
      });
      bumpSyncedAt(logs.at(-1)?.blockNumber ?? undefined);
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
