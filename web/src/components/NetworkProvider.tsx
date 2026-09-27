"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { switchChain } from "wagmi/actions";
import { DEFAULT_NETWORK, NETWORKS, type NetworkConfig, type NetworkId } from "@/lib/networks";

const STORAGE_KEY = "torus-network";

type NetworkContextValue = {
  networkId: NetworkId;
  network: NetworkConfig;
  setNetworkId: (id: NetworkId) => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkId, setNetworkIdState] = useState<NetworkId>(DEFAULT_NETWORK);
  const config = useConfig();
  const { isConnected } = useAccount();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "testnet" || stored === "mainnet") setNetworkIdState(stored);
    } catch {
      // Private browsing / blocked storage — fall back to the build-time default.
    }
  }, []);

  const setNetworkId = useCallback(
    (id: NetworkId) => {
      setNetworkIdState(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Nothing to persist to — the in-memory switch below still applies for this session.
      }
      if (isConnected) {
        // Best-effort: if the wallet refuses (e.g. network not added), the UI switch still
        // happens and useIsCorrectNetwork's mismatch banner tells the user to switch manually.
        void switchChain(config, { chainId: NETWORKS[id].chain.id }).catch(() => {});
      }
    },
    [config, isConnected]
  );

  return (
    <NetworkContext.Provider value={{ networkId, network: NETWORKS[networkId], setNetworkId }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
