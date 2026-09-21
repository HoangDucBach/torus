"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther, type Hash } from "viem";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { arcTestnet } from "@/lib/chain";
import { addresses, vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import type { MutationHookResult } from "./types";

type WithdrawVariables = {
  /** Amount of torUSDC shares to redeem, as a decimal string (e.g. "5" for 5 torUSDC). */
  shares: string;
};

type WithdrawResult = {
  hash: Hash;
};

/** Redeems torUSDC shares back into USDC (native + ERC-20, same underlying balance on Arc). */
export function useWithdraw(): MutationHookResult<WithdrawVariables, WithdrawResult> {
  const { address } = useAccount();
  const config = useConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shares }) => {
      if (!address) throw new Error("Connect a wallet first");

      const hash = await writeContract(config, {
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "redeem",
        args: [parseEther(shares), address, address],
        chainId: arcTestnet.id,
      });

      await waitForTransactionReceipt(config, { hash });
      return { hash };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.torBalance(address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nativeBalance(address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.protocolStats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.position(address) });
    },
  });
}
