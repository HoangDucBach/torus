"use client";

import { useQuery } from "@tanstack/react-query";
import { serverUrl } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryHookResult } from "./types";

export type Quote = {
  nativeCostWei: string;
  tokenPerNative: string;
  torUsdcShares: string;
};

/** Estimated torUSDC cost for a UserOperation of `gas` gas units at `maxFeePerGas` wei. */
export function useQuote(gas = "200000", maxFeePerGas = "2000000000"): QueryHookResult<Quote> {
  return useQuery({
    queryKey: queryKeys.quote(gas, maxFeePerGas),
    queryFn: async () => {
      const res = await fetch(`${serverUrl}/quote?gas=${gas}&maxFeePerGas=${maxFeePerGas}`);
      if (!res.ok) throw new Error(`Failed to fetch quote (${res.status})`);
      return (await res.json()) as Quote;
    },
  });
}
