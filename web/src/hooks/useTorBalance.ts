"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { addresses, vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryHookResult } from "./types";

/** The connected account's `torUSDC` balance (18 decimals), read directly from the vault. */
export function useTorBalance(): QueryHookResult<bigint> {
  const { address } = useAccount();
  const config = useConfig();

  return useQuery({
    queryKey: queryKeys.torBalance(address),
    queryFn: () =>
      readContract(config, {
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "balanceOf",
        args: [address!],
      }),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });
}
