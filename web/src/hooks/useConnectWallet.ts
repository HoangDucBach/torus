"use client";

import { useMutation } from "@tanstack/react-query";
import { useConfig, useConnect, useDisconnect } from "wagmi";
import { connect } from "wagmi/actions";
import type { MutationHookResult } from "./types";

export function useConnectWallet(): MutationHookResult<void> {
  const config = useConfig();
  const { connectors } = useConnect();

  return useMutation({
    mutationFn: async () => {
      const connector = connectors[0];
      if (!connector) throw new Error("No injected wallet found");
      await connect(config, { connector });
    },
  });
}

export function useDisconnectWallet() {
  return useDisconnect();
}
