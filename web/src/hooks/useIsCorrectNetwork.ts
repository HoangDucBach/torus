"use client";

import { useChainId } from "wagmi";
import { useNetwork } from "./useNetwork";

// Other hooks gate on this so they fail closed instead of throwing an opaque
// ChainNotConfiguredError when the wallet's active network isn't the selected Arc network.
export function useIsCorrectNetwork(): boolean {
  const chainId = useChainId();
  const { network } = useNetwork();
  return chainId === network.chain.id;
}
