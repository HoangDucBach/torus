"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { getBalance } from "wagmi/actions";
import { queryKeys } from "@/lib/queryKeys";
import { useIsCorrectNetwork } from "./useIsCorrectNetwork";
import type { QueryHookResult } from "./types";

/** The connected account's native USDC balance (18 decimals). */
export function useNativeBalance(): QueryHookResult<bigint> {
  const { address } = useAccount();
  const config = useConfig();
  const isCorrectNetwork = useIsCorrectNetwork();

  return useQuery({
    queryKey: queryKeys.nativeBalance(address),
    queryFn: async () => {
      const balance = await getBalance(config, { address: address! });
      return balance.value;
    },
    // Gated on the active chain, not just the address: reading with the wallet on the wrong
    // network throws wagmi's ChainNotConfiguredError instead of returning a wrong balance.
    enabled: Boolean(address) && isCorrectNetwork,
    refetchInterval: 10_000,
  });
}
