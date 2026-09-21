import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { arcTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
