"use client";

import { useMutation } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { switchChain } from "wagmi/actions";
import { useNetwork } from "./useNetwork";
import type { MutationHookResult } from "./types";

export function useSwitchToArc(): MutationHookResult<void> {
  const config = useConfig();
  const { network } = useNetwork();

  return useMutation({
    mutationFn: async () => {
      await switchChain(config, { chainId: network.chain.id });
    },
  });
}
