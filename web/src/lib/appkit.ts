import { AppKit } from "@circle-fin/app-kit";

/**
 * Single AppKit instance for the app (docs.arc.io/app-kit). AppKit itself has no wallet-UI or
 * account-abstraction surface — it works alongside wagmi/viem via an adapter created from the
 * currently connected wallet's EIP-1193 provider (see `hooks/useBridgeToArc.ts`).
 */
export const appKit = new AppKit();
