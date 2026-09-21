import { defineChain } from "viem";

/**
 * Arc network definitions, pointed at the RPC/explorer endpoints documented at
 * docs.arc.io/arc/references/connect-to-arc. Defined locally (rather than trusting viem's
 * bundled `arc`/`arcTestnet` chains) since those currently point at a different RPC domain
 * (`arc.network` vs. the `arc.io` endpoints Circle's own docs and this repo's Foundry config
 * use) — verified working against `rpc.testnet.arc.io` throughout this project.
 */
export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: 5_042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

export function chainForNetwork(network: "testnet" | "mainnet") {
  return network === "mainnet" ? arcMainnet : arcTestnet;
}
