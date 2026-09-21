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
  // Second paymaster targeting EntryPoint v0.8, required for EIP-7702 accounts.
  entryPointV08?: Address;
  paymasterV08?: Address;
  // Lets gasStats.ts/position.ts scope eth_getLogs scans instead of starting from genesis
  // (rejected by public RPCs once history is pruned).
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

export { arcMainnet, arcTestnet };
