"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { NetworkProvider } from "@/components/NetworkProvider";
import { NETWORKS } from "@/lib/networks";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
  );

  const app = (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <NetworkProvider>{children}</NetworkProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) return app;

  // Privy runs alongside wagmi rather than through it: the main app connects MetaMask via
  // wagmi's injected connector, while /gasless uses Privy's embedded wallet for EIP-7702.
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        defaultChain: NETWORKS.testnet.chain,
        supportedChains: [NETWORKS.testnet.chain, NETWORKS.mainnet.chain],
      }}
    >
      {app}
    </PrivyProvider>
  );
}
