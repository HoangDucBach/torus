"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { useIsCorrectNetwork } from "./useIsCorrectNetwork";
import { useNetwork } from "./useNetwork";
import type { QueryHookResult } from "./types";

export type Earnings = {
  currentValue: bigint;
  depositedTotal: bigint;
  withdrawnTotal: bigint;
  earned: bigint;
};

type PositionResponse = {
  depositedTotal: string;
  withdrawnTotal: string;
};

export function useEarnings(): QueryHookResult<Earnings> {
  const { address } = useAccount();
  const config = useConfig();
  const isCorrectNetwork = useIsCorrectNetwork();
  const { networkId, network } = useNetwork();

  return useQuery({
    queryKey: queryKeys.position(networkId, address),
    queryFn: async () => {
      const [shares, position] = await Promise.all([
        readContract(config, {
          address: network.addresses.vault,
          abi: vaultAbi,
          functionName: "balanceOf",
          args: [address!],
          chainId: network.chain.id,
        }),
        fetch(`${network.serverUrl}/position?address=${address}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch position (${res.status})`);
          return res.json() as Promise<PositionResponse>;
        }),
      ]);

      const currentValue = await readContract(config, {
        address: network.addresses.vault,
        abi: vaultAbi,
        functionName: "previewRedeem",
        args: [shares],
        chainId: network.chain.id,
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
  });
}
