import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain";

/**
 * Wallet connection is via browser-injected wallets only (MetaMask, etc.) — no WalletConnect
 * project ID required. Any injected wallet added to Arc Testnet (see
 * docs.arc.io/arc/references/connect-to-arc) works out of the box.
 */
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
