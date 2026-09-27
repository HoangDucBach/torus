import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { NETWORKS } from "./networks";

const testnetChain = NETWORKS.testnet.chain;
const mainnetChain = NETWORKS.mainnet.chain;

// Plain wagmi on purpose: @privy-io/wagmi's createConfig strips every non-mock connector, which
// would break MetaMask. The /gasless demo only needs Privy's own hooks, not wagmi integration.
// Both networks are registered so the in-app network switch (see NetworkProvider) can move the
// connected wallet between them without reconfiguring wagmi.
export const wagmiConfig = createConfig({
  chains: [testnetChain, mainnetChain],
  connectors: [injected()],
  transports: {
    [testnetChain.id]: http(),
    [mainnetChain.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
