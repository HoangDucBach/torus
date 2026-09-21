"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
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

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
