"use client";

import { useChainId } from "wagmi";
import { arcTestnet } from "@/lib/chain";

// Other hooks gate on this so they fail closed instead of throwing an opaque
// ChainNotConfiguredError when the wallet's active network isn't Arc Testnet.
export function useIsCorrectNetwork(): boolean {
  const chainId = useChainId();
  return chainId === arcTestnet.id;
}
