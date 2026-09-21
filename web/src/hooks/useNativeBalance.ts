"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { getBalance } from "wagmi/actions";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryHookResult } from "./types";

/** The connected account's native USDC balance (18 decimals). */
export function useNativeBalance(): QueryHookResult<bigint> {
  const { address } = useAccount();
  const config = useConfig();

  return useQuery({
    queryKey: queryKeys.nativeBalance(address),
    queryFn: async () => {
      const balance = await getBalance(config, { address: address! });
      return balance.value;
    },
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });
}
