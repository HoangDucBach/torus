"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { addresses, vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { useIsCorrectNetwork } from "./useIsCorrectNetwork";
import type { QueryHookResult } from "./types";

/** The connected account's `torUSDC` balance (18 decimals), read directly from the vault. */
export function useTorBalance(): QueryHookResult<bigint> {
  const { address } = useAccount();
  const config = useConfig();
  const isCorrectNetwork = useIsCorrectNetwork();

  return useQuery({
    queryKey: queryKeys.torBalance(address),
    queryFn: () =>
      readContract(config, {
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "balanceOf",
        args: [address!],
      }),
    // Gated on the active chain too — see useNativeBalance for why.
    enabled: Boolean(address) && isCorrectNetwork,
    refetchInterval: 10_000,
  });
}
