import { publicClient } from "./clients.ts";
import { addresses, paymasterAbi, vaultAbi } from "./contracts.ts";

const BPS_DENOMINATOR = 10_000n;
const NATIVE_USDC_UNIT = 1_000_000n; // 1 USDC at the vault's 6-decimal asset precision

// Mirrors TorusPaymaster._fetchDetails: torUSDC-per-native-unit, marked up by the spread.
export async function getTokenPerNative(): Promise<bigint> {
  const [sharesPerNative, spreadBps] = await Promise.all([
    publicClient.readContract({
      address: addresses.vault,
      abi: vaultAbi,
      functionName: "previewDeposit",
      args: [NATIVE_USDC_UNIT],
    }),
    publicClient.readContract({
      address: addresses.paymaster,
      abi: paymasterAbi,
      functionName: "spreadBps",
    }),
  ]);

  return (sharesPerNative * (BPS_DENOMINATOR + BigInt(spreadBps))) / BPS_DENOMINATOR;
}

/** ceil(nativeCostWei * tokenPerNative / 1e18) — mirrors {PaymasterERC20-_erc20Cost}. */
export function nativeCostToTorUsdc(nativeCostWei: bigint, tokenPerNative: bigint): bigint {
  const denominator = 10n ** 18n;
  const numerator = nativeCostWei * tokenPerNative;
  const shares = numerator / denominator;
  return numerator % denominator === 0n ? shares : shares + 1n;
}
