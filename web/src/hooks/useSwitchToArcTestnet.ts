"use client";

import { useMutation } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { switchChain } from "wagmi/actions";
import { arcTestnet } from "@/lib/chain";
import type { MutationHookResult } from "./types";

/** Prompts the connected wallet to switch its active network to Arc Testnet. */
export function useSwitchToArcTestnet(): MutationHookResult<void> {
  const config = useConfig();

  return useMutation({
    mutationFn: async () => {
      await switchChain(config, { chainId: arcTestnet.id });
    },
  });
}
