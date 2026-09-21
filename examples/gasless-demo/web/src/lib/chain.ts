import { defineChain } from "viem";

/**
 * Arc Testnet — mirrors the main Torus dashboard's chain def (web/src/lib/chain.ts) and
 * contracts/foundry.toml. Kept here too so this example stands alone and can be copy-pasted by
 * a third-party integrator without pulling in the rest of this monorepo.
 */
export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});
