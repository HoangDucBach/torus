import type { Address } from "viem";

export const queryKeys = {
  protocolStats: ["protocolStats"] as const,
  quote: (gas: string, maxFeePerGas: string) => ["quote", gas, maxFeePerGas] as const,
  torBalance: (address?: Address) => ["torBalance", address] as const,
  nativeBalance: (address?: Address) => ["nativeBalance", address] as const,
  position: (address?: Address) => ["position", address] as const,
};
