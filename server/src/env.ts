import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Address } from "viem";
import { arcMainnet, arcTestnet, chainForNetwork } from "./chain.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Deployment = {
  chainId: number;
  usdc: Address;
  entryPoint: Address; // EntryPoint v0.7 — deployed smart accounts (SimpleAccount, Kernel, Safe, ...)
  oracle: Address;
  strategy: Address;
  vault: Address;
  paymaster: Address; // targets `entryPoint` (v0.7)
  treasury: Address;
  admin: Address;
  // Written by script/DeployPaymaster.s.sol: a second paymaster targeting EntryPoint v0.8,
  // required for EIP-7702 accounts (an EOA temporarily delegated to Simple7702Account has no
  // separate deployed contract, so it must use v0.8 — see contracts/src/TorusPaymaster.sol).
  entryPointV08?: Address;
  paymasterV08?: Address;
  // The block this deployment was broadcast in — lets gasStats.ts scope `eth_getLogs` scans to
  // blocks that could actually contain its events, instead of scanning from genesis (rejected by
  // public RPCs once history is pruned).
  deployedAtBlock?: number;
};

const network = (process.env.ARC_NETWORK === "mainnet" ? "mainnet" : "testnet") as
  | "testnet"
  | "mainnet";

export const chain = chainForNetwork(network);
export const rpcUrl = process.env.ARC_RPC_URL ?? chain.rpcUrls.default.http[0]!;

function loadDeployment(): Deployment {
  const explicitPath = process.env.DEPLOYMENT_FILE;
  const path =
    explicitPath ?? join(__dirname, "..", "..", "contracts", "deployments", `${chain.id}.json`);

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(
      `Could not read deployment file at ${path}. Run \`forge script script/Deploy.s.sol --broadcast\` ` +
        `in contracts/ first, or set DEPLOYMENT_FILE to point at an existing one.\nOriginal error: ${err}`
    );
  }

  return JSON.parse(raw) as Deployment;
}

export const deployment = loadDeployment();

export const env = {
  network,
  port: Number(process.env.PORT ?? 8787),
  keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined,
  keeperIntervalSeconds: Number(process.env.KEEPER_INTERVAL_SECONDS ?? 3600),
  paymasterMinDepositWei: BigInt(process.env.PAYMASTER_MIN_DEPOSIT_WEI ?? "1000000000000000000"),
};

// Re-exported for convenience so callers don't need to import from ./chain.ts separately.
export { arcMainnet, arcTestnet };
