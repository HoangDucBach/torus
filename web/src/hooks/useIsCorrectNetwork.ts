"use client";

import { useChainId } from "wagmi";
import { arcTestnet } from "@/lib/chain";

/**
 * Connection state, not server/chain data — deliberately a plain hook (not a query/mutation)
 * like wagmi's own `useAccount`. Balance and mutation hooks gate on this so they fail closed
 * (never silently read/write against the wrong chain) instead of throwing an opaque
 * `ChainNotConfiguredError` when the wallet's active network isn't Arc Testnet.
 */
export function useIsCorrectNetwork(): boolean {
  const chainId = useChainId();
  return chainId === arcTestnet.id;
}
