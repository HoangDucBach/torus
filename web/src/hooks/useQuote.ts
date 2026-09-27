"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useNetwork } from "./useNetwork";
import type { QueryHookResult } from "./types";

export type Quote = {
  nativeCostWei: string;
  tokenPerNative: string;
  torUsdcShares: string;
};

export function useQuote(gas = "200000", maxFeePerGas = "2000000000"): QueryHookResult<Quote> {
  const { networkId, network } = useNetwork();

  return useQuery({
    queryKey: queryKeys.quote(networkId, gas, maxFeePerGas),
    queryFn: async () => {
      const res = await fetch(`${network.serverUrl}/quote?gas=${gas}&maxFeePerGas=${maxFeePerGas}`);
      if (!res.ok) throw new Error(`Failed to fetch quote (${res.status})`);
      return (await res.json()) as Quote;
    },
  });
}
