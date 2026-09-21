"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { addresses, serverUrl, vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { useIsCorrectNetwork } from "./useIsCorrectNetwork";
import type { QueryHookResult } from "./types";

export type Earnings = {
  /** Current value of the account's torUSDC balance, in USDC (6 decimals). */
  currentValue: bigint;
  /** Total USDC (6 decimals) ever deposited, from the vault's own Deposit events. */
  depositedTotal: bigint;
  /** Total USDC (6 decimals) ever withdrawn, from the vault's own Withdraw events. */
  withdrawnTotal: bigint;
  /** currentValue - (depositedTotal - withdrawnTotal) — real, not an APY estimate. */
  earned: bigint;
};

type PositionResponse = {
  depositedTotal: string;
  withdrawnTotal: string;
};

/**
 * Real earnings for the connected account — no APY projection, no off-chain indexer: the
 * current value of its torUSDC balance (read on-chain via previewRedeem) minus its net cost
 * basis (from the server's /position, itself aggregated from the vault's own Deposit/Withdraw
 * events — see server/src/position.ts).
 */
export function useEarnings(): QueryHookResult<Earnings> {
  const { address } = useAccount();
  const config = useConfig();
  const isCorrectNetwork = useIsCorrectNetwork();

  return useQuery({
    queryKey: queryKeys.position(address),
    queryFn: async () => {
      const [shares, position] = await Promise.all([
        readContract(config, {
          address: addresses.vault,
          abi: vaultAbi,
          functionName: "balanceOf",
          args: [address!],
        }),
        fetch(`${serverUrl}/position?address=${address}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch position (${res.status})`);
          return res.json() as Promise<PositionResponse>;
        }),
      ]);

      const currentValue = await readContract(config, {
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "previewRedeem",
        args: [shares],
      });

      const depositedTotal = BigInt(position.depositedTotal);
      const withdrawnTotal = BigInt(position.withdrawnTotal);

      return {
        currentValue,
        depositedTotal,
        withdrawnTotal,
        earned: currentValue - (depositedTotal - withdrawnTotal),
      };
    },
    enabled: Boolean(address) && isCorrectNetwork,
    refetchInterval: 15_000,
  });
}
