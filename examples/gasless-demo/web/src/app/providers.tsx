"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { arcTestnet } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="p-6">
          Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local (see README) to run this demo.
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={privyAppId}
        config={{
          embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
          defaultChain: arcTestnet,
          supportedChains: [arcTestnet],
        }}
      >
        <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}
