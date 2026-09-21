"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther, type Hash } from "viem";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { arcTestnet } from "@/lib/chain";
import { addresses, vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import type { MutationHookResult } from "./types";

type DepositNativeVariables = {
  /** Amount of native USDC to deposit, as a decimal string (e.g. "5" for 5 USDC). */
  amount: string;
};

type DepositNativeResult = {
  hash: Hash;
};

export function useDepositNative(): MutationHookResult<DepositNativeVariables, DepositNativeResult> {
  const { address } = useAccount();
  const config = useConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount }) => {
      if (!address) throw new Error("Connect a wallet first");

      const hash = await writeContract(config, {
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "depositNative",
        args: [address],
        value: parseEther(amount),
        chainId: arcTestnet.id,
      });

      await waitForTransactionReceipt(config, { hash });
      return { hash };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.torBalance(address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nativeBalance(address) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.protocolStats });
    },
  });
}
