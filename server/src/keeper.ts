import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "./clients.ts";
import { addresses, entryPointAbi, paymasterAbi, strategyAbi, vaultAbi } from "./contracts.ts";
import { chain, env, rpcUrl } from "./env.ts";

/**
 * Self-sustaining gas loop, run on an interval: accrue yield -> skim the performance fee ->
 * top the paymaster's EntryPoint deposit back up. None of these calls require special
 * privileges (see {MockRWAStrategy-accrue}, {TorusVault-harvest}, {TorusPaymaster-refuel} — all
 * permissionless by design), so the keeper key only ever needs a little native USDC for gas.
 */
async function tick(walletClient: ReturnType<typeof createWalletClient>) {
  const account = walletClient.account!;

  const accrueHash = await walletClient.writeContract({
    address: addresses.strategy,
    abi: strategyAbi,
    functionName: "accrue",
    account,
    chain,
  });
  await publicClient.waitForTransactionReceipt({ hash: accrueHash });
  console.log(`[keeper] strategy.accrue() -> ${accrueHash}`);

  const harvestHash = await walletClient.writeContract({
    address: addresses.vault,
    abi: vaultAbi,
    functionName: "harvest",
    account,
    chain,
  });
  await publicClient.waitForTransactionReceipt({ hash: harvestHash });
  console.log(`[keeper] vault.harvest() -> ${harvestHash}`);

  const paymasterDeposit = await publicClient.readContract({
    address: addresses.entryPoint,
    abi: entryPointAbi,
    functionName: "balanceOf",
    args: [addresses.paymaster],
  });

  if (paymasterDeposit < env.paymasterMinDepositWei) {
    const refuelHash = await walletClient.writeContract({
      address: addresses.paymaster,
      abi: paymasterAbi,
      functionName: "refuel",
      account,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: refuelHash });
    console.log(
      `[keeper] paymaster deposit (${paymasterDeposit} wei) below floor -> refuel() -> ${refuelHash}`
    );
  } else {
    console.log(`[keeper] paymaster deposit healthy (${paymasterDeposit} wei), skipping refuel`);
  }
}

async function main() {
  if (!env.keeperPrivateKey) {
    throw new Error("KEEPER_PRIVATE_KEY is not set");
  }

  const account = privateKeyToAccount(env.keeperPrivateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log(`[keeper] starting, account=${account.address}, interval=${env.keeperIntervalSeconds}s`);

  const run = () => tick(walletClient).catch((err) => console.error("[keeper] tick failed:", err));
  await run();
  setInterval(run, env.keeperIntervalSeconds * 1000);
}

main().catch((err) => {
  console.error("[keeper] fatal:", err);
  process.exit(1);
});
