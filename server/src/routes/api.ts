import { Hono } from "hono";
import { publicClient } from "../clients.ts";
import { addresses, entryPointAbi, paymasterAbi, strategyAbi, vaultAbi } from "../contracts.ts";
import { getTokenPerNative, nativeCostToTorUsdc } from "../pricing.ts";

export const apiRoute = new Hono();

/**
 * GET /quote?gas=<uint>&maxFeePerGas=<wei>
 * Estimated torUSDC a user operation of `gas` gas units at `maxFeePerGas` would cost, using the
 * same pricing {TorusPaymaster} applies on-chain. Useful for wallets that want to show a price
 * before submitting, without needing their own EntryPoint gas-estimation round trip.
 */
apiRoute.get("/quote", async (c) => {
  const gas = c.req.query("gas");
  const maxFeePerGas = c.req.query("maxFeePerGas");
  if (!gas || !maxFeePerGas) {
    return c.json({ error: "query params 'gas' and 'maxFeePerGas' (wei) are required" }, 400);
  }

  const nativeCostWei = BigInt(gas) * BigInt(maxFeePerGas);
  const tokenPerNative = await getTokenPerNative();
  const torUsdcShares = nativeCostToTorUsdc(nativeCostWei, tokenPerNative);

  return c.json({
    nativeCostWei: nativeCostWei.toString(),
    tokenPerNative: tokenPerNative.toString(),
    torUsdcShares: torUsdcShares.toString(),
  });
});

/** GET /stats — protocol-wide numbers for a dashboard or health check. */
apiRoute.get("/stats", async (c) => {
  const [totalAssets, totalSupply, rate, performanceFeeBps, strategyAssets, strategyReserve, spreadBps, paymasterDeposit] =
    await Promise.all([
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "totalAssets" }),
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "totalSupply" }),
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "getRate" }),
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "performanceFeeBps" }),
      publicClient.readContract({ address: addresses.strategy, abi: strategyAbi, functionName: "totalAssets" }),
      publicClient.readContract({ address: addresses.strategy, abi: strategyAbi, functionName: "reserve" }),
      publicClient.readContract({ address: addresses.paymaster, abi: paymasterAbi, functionName: "spreadBps" }),
      publicClient.readContract({
        address: addresses.entryPoint,
        abi: entryPointAbi,
        functionName: "balanceOf",
        args: [addresses.paymaster],
      }),
    ]);

  const paymasterV08Deposit =
    addresses.paymasterV08 && addresses.entryPointV08
      ? await publicClient.readContract({
          address: addresses.entryPointV08,
          abi: entryPointAbi,
          functionName: "balanceOf",
          args: [addresses.paymasterV08],
        })
      : undefined;

  return c.json({
    chainId: (await publicClient.getChainId()).toString(),
    vault: addresses.vault,
    paymaster: addresses.paymaster,
    totalAssets: totalAssets.toString(),
    totalSupply: totalSupply.toString(),
    rate: rate.toString(),
    performanceFeeBps,
    spreadBps,
    strategy: {
      address: addresses.strategy,
      totalAssets: strategyAssets.toString(),
      reserve: strategyReserve.toString(),
    },
    paymasterEntryPointDeposit: paymasterDeposit.toString(),
    // EIP-7702 support (see contracts/src/TorusPaymaster.sol) — an EOA delegated to
    // Simple7702Account has no separate deployed contract, so it must use EntryPoint v0.8.
    eip7702: addresses.paymasterV08
      ? {
          entryPoint: addresses.entryPointV08,
          paymaster: addresses.paymasterV08,
          paymasterEntryPointDeposit: paymasterV08Deposit?.toString(),
        }
      : null,
  });
});
