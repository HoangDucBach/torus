/**
 * End-to-end validation script: deposits native USDC into `torUSDC` for a counterfactual
 * ERC-4337 smart account, then dispatches a UserOperation for that account through a real
 * bundler with **zero native USDC in the account** — gas is paid entirely out of its torUSDC
 * balance via Torus's ERC-7677 paymaster RPC.
 *
 * Uses viem's native `viem/account-abstraction` support plus permissionless.js's
 * `toSimpleSmartAccount` (the eth-infinitism SimpleAccount ABI, whose v0.7 factory is already
 * deployed on Arc at 0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985 — no custom account contract
 * needed). No Torus-specific SDK code is required on the client side: the paymaster is just a
 * standard ERC-7677 endpoint (this server's `/paymaster` route).
 *
 * Required env vars:
 *   ARC_RPC_URL          Arc RPC (default: https://rpc.testnet.arc.io)
 *   BUNDLER_RPC_URL       A bundler that supports Arc Testnet (e.g. a Pimlico endpoint)
 *   TORUS_PAYMASTER_URL   This server's own base URL, e.g. http://localhost:8787/paymaster
 *   FUNDER_PRIVATE_KEY    An EOA with a little native USDC, used only for the one bootstrap
 *                         `depositNative` call below (a plain, unsponsored native-gas tx)
 *   OWNER_PRIVATE_KEY     The smart account's signing key (needs no funds of its own)
 *
 * Run: bun run scripts/e2e.ts
 */
import { createPublicClient, createWalletClient, encodeFunctionData, formatUnits, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { addresses, vaultAbi } from "../src/contracts.ts";
import { chain, rpcUrl } from "../src/env.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const bundlerRpcUrl = requireEnv("BUNDLER_RPC_URL");
  const paymasterUrl = requireEnv("TORUS_PAYMASTER_URL");
  const funder = privateKeyToAccount(requireEnv("FUNDER_PRIVATE_KEY") as `0x${string}`);
  const owner = privateKeyToAccount(requireEnv("OWNER_PRIVATE_KEY") as `0x${string}`);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: addresses.entryPoint, version: "0.7" },
  });
  console.log(`Smart account (counterfactual): ${account.address}`);

  // --- Step 1: onboard. One plain, native-gas transaction from a funder EOA wraps native USDC
  // into torUSDC credited to the (not-yet-deployed) smart account. Every UserOperation after
  // this is fully gas-sponsored from that torUSDC balance — no ERC-20 approval needed either,
  // since the vault grants its configured paymaster an implicit max allowance.
  const depositAmount = parseEther("5"); // 5 native USDC units
  console.log(`Depositing ${formatUnits(depositAmount, 18)} native USDC into torUSDC for the account...`);

  const funderClient = createWalletClient({ account: funder, chain, transport: http(rpcUrl) });
  const depositTxHash = await funderClient.sendTransaction({
    chain,
    to: addresses.vault,
    value: depositAmount,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "depositNative",
          stateMutability: "payable",
          inputs: [{ name: "receiver", type: "address" }],
          outputs: [{ name: "shares", type: "uint256" }],
        },
      ],
      functionName: "depositNative",
      args: [account.address],
    }),
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
  console.log(`depositNative tx: ${depositTxHash}`);

  const torBalanceBefore = await publicClient.readContract({
    address: addresses.vault,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`Account torUSDC balance: ${formatUnits(torBalanceBefore, 18)}`);

  // --- Step 2: send a gasless UserOperation through a real bundler, paid for via Torus's
  // ERC-7677 paymaster endpoint. The account itself never holds any native USDC.
  const paymaster = createPaymasterClient({ transport: http(paymasterUrl) });
  const bundlerClient = createBundlerClient({
    client: publicClient,
    chain,
    transport: http(bundlerRpcUrl),
    paymaster,
  });

  const nativeBalanceBefore = await publicClient.getBalance({ address: account.address });
  console.log(`Account native balance before UserOperation: ${nativeBalanceBefore} wei`);

  const userOpHash = await bundlerClient.sendUserOperation({
    account,
    calls: [{ to: account.address, value: 0n, data: "0x" }], // trivial no-op call to itself
  });
  console.log(`UserOperation hash: ${userOpHash}`);

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
  console.log(`UserOperation mined in tx ${receipt.receipt.transactionHash}, success=${receipt.success}`);

  const [torBalanceAfter, nativeBalanceAfter] = await Promise.all([
    publicClient.readContract({
      address: addresses.vault,
      abi: vaultAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ]);

  console.log(`Account native balance after UserOperation: ${nativeBalanceAfter} wei (should still be 0)`);
  console.log(`torUSDC spent on gas: ${formatUnits(torBalanceBefore - torBalanceAfter, 18)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
