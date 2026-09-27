"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther, type Hash } from "viem";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { useNetwork } from "./useNetwork";
import type { MutationHookResult } from "./types";

type WithdrawVariables = {
  /** Amount of torUSDC shares to redeem, as a decimal string (e.g. "5" for 5 torUSDC). */
  shares: string;
};

type WithdrawResult = {
  hash: Hash;
};

export function useWithdraw(): MutationHookResult<WithdrawVariables, WithdrawResult> {
  const { address } = useAccount();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { networkId, network } = useNetwork();

  return useMutation({
    mutationFn: async ({ shares }) => {
      if (!address) throw new Error("Connect a wallet first");

      const hash = await writeContract(config, {
        address: network.addresses.vault,
        abi: vaultAbi,
        functionName: "redeem",
        args: [parseEther(shares), address, address],
        chainId: network.chain.id,
      });

      await waitForTransactionReceipt(config, { hash });
      return { hash };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.torBalance(networkId, address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nativeBalance(networkId, address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.protocolStats(networkId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.position(networkId, address) });
    },
  });
}
