"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { arcTestnet } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // A blocked/unreachable RPC (ad blocker, offline, misconfigured URL) shouldn't hammer
          // the endpoint dozens of times per minute — one retry is enough to shake off a
          // one-off network blip, and refetchInterval already re-tries every 10s regardless.
          queries: { retry: 1 },
        },
      })
  );

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // QueryClientProvider must be the outermost data-layer provider: `@privy-io/wagmi`'s
  // WagmiProvider calls wagmi/TanStack hooks in its own body (to sync Privy's wallet state),
  // not just in its children, so QueryClient has to be available *above* it, not nested inside.
  const wagmi = !privyAppId ? (
    // Privy's embedded wallet (needed for EIP-7702 authorization signing — see lib/wagmi.ts) is
    // opt-in: without an App ID the app still works fully via a regular injected wallet, just
    // without the "gasless via EIP-7702" demo. `@privy-io/wagmi`'s WagmiProvider throws when
    // mounted without a `<PrivyProvider>` ancestor, so the *provider component itself* — not
    // just what wraps it — has to be chosen conditionally.
    <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
  ) : (
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
  );

  return <QueryClientProvider client={queryClient}>{wagmi}</QueryClientProvider>;
}
