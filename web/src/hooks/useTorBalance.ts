"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { vaultAbi } from "@/lib/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { useIsCorrectNetwork } from "./useIsCorrectNetwork";
import { useNetwork } from "./useNetwork";
import type { QueryHookResult } from "./types";

/** The connected account's `torUSDC` balance (18 decimals), read directly from the vault. */
export function useTorBalance(): QueryHookResult<bigint> {
  const { address } = useAccount();
  const config = useConfig();
  const isCorrectNetwork = useIsCorrectNetwork();
  const { networkId, network } = useNetwork();

  return useQuery({
    queryKey: queryKeys.torBalance(networkId, address),
    queryFn: () =>
      readContract(config, {
        address: network.addresses.vault,
        abi: vaultAbi,
        functionName: "balanceOf",
        args: [address!],
        chainId: network.chain.id,
      }),
    // Gated on the active chain too — see useNativeBalance for why.
    enabled: Boolean(address) && isCorrectNetwork,
  });
}
