import type { Address } from "viem";

/**
 * Centralized query key factory — every read hook in `hooks/` builds its TanStack Query key
 * from here, so cache invalidation (e.g. after a deposit mutation settles) has one place to
 * reference instead of ad-hoc string arrays scattered across hooks.
 */
export const queryKeys = {
  protocolStats: ["protocolStats"] as const,
  quote: (gas: string, maxFeePerGas: string) => ["quote", gas, maxFeePerGas] as const,
  torBalance: (address?: Address) => ["torBalance", address] as const,
  nativeBalance: (address?: Address) => ["nativeBalance", address] as const,
  position: (address?: Address) => ["position", address] as const,
};
