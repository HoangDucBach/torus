import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain";

/**
 * Built with `@privy-io/wagmi`'s `createConfig` (a thin wrapper around wagmi's own) so Privy's
 * embedded wallet is synced into wagmi state automatically alongside a regular injected wallet
 * (MetaMask, etc. — no WalletConnect project ID needed). Every existing `useAccount`/
 * `useBalance`/etc. hook keeps working unmodified regardless of which connection is active.
 *
 * The embedded wallet exists specifically for {@link useEip7702GaslessCall}: standard browser
 * wallets (MetaMask) don't yet let a dApp request an EIP-7702 authorization signature — see
 * github.com/MetaMask/smart-accounts-kit/issues/247 — while Privy's embedded wallet, which it
 * fully controls the key for, can (`useSign7702Authorization`).
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
