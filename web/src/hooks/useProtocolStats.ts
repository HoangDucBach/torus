"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useNetwork } from "./useNetwork";
import type { QueryHookResult } from "./types";

export type ProtocolStats = {
  chainId: string;
  vault: string;
  paymaster: string;
  totalAssets: string;
  totalSupply: string;
  rate: string;
  performanceFeeBps: number;
  spreadBps: number;
  strategy: { address: string; totalAssets: string; reserve: string };
  paymasterEntryPointDeposit: string;
  /** Real totals aggregated from every sponsored UserOperation — see server/src/gasStats.ts. */
  gasSponsored: { totalTorUsdcCharged: string; userOperationCount: number };
};

export function useProtocolStats(): QueryHookResult<ProtocolStats> {
  const { networkId, network } = useNetwork();

  return useQuery({
    queryKey: queryKeys.protocolStats(networkId),
    queryFn: async () => {
      const res = await fetch(`${network.serverUrl}/stats`);
      if (!res.ok) throw new Error(`Failed to fetch protocol stats (${res.status})`);
      return (await res.json()) as ProtocolStats;
    },
  });
}
