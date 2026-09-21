"use client";

import type { BridgeResult } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EIP1193Provider } from "viem";
import { useAccount } from "wagmi";
import { appKit } from "@/lib/appkit";
import { queryKeys } from "@/lib/queryKeys";
import type { MutationHookResult } from "./types";

type BridgeToArcVariables = {
  /** Amount of USDC to bridge, as a decimal string (e.g. "5" for 5 USDC). */
  amount: string;
  /** Source testnet to bridge from. Defaults to Ethereum Sepolia. */
  fromChain?: "Ethereum_Sepolia" | "Base_Sepolia" | "Avalanche_Fuji";
};

/**
 * Bridges testnet USDC into Arc Testnet via Circle's App Kit (docs.arc.io/app-kit), using
 * Circle's Cross-Chain Transfer Protocol under the hood. Lets a new user fund their Arc account
 * without first finding an Arc-specific faucet — they can bridge in from USDC they already hold
 * on another testnet, then deposit into torUSDC from the resulting native balance.
 */
export function useBridgeToArc(): MutationHookResult<BridgeToArcVariables, BridgeResult<string>> {
  const { connector, address } = useAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, fromChain = "Ethereum_Sepolia" }) => {
      if (!connector) throw new Error("Connect a wallet first");

      const provider = (await connector.getProvider()) as EIP1193Provider;
      const adapter = await createViemAdapterFromProvider({ provider });

      return appKit.bridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: "Arc_Testnet" },
        amount,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nativeBalance(address) });
    },
  });
}
