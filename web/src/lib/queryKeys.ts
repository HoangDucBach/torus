import type { Address } from "viem";
import type { NetworkId } from "./networks";

export const queryKeys = {
  protocolStats: (network: NetworkId) => ["protocolStats", network] as const,
  quote: (network: NetworkId, gas: string, maxFeePerGas: string) =>
    ["quote", network, gas, maxFeePerGas] as const,
  torBalance: (network: NetworkId, address?: Address) => ["torBalance", network, address] as const,
  nativeBalance: (network: NetworkId, address?: Address) =>
    ["nativeBalance", network, address] as const,
  position: (network: NetworkId, address?: Address) => ["position", network, address] as const,
};
