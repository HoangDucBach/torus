"use client";

import { Chip, Tooltip } from "@heroui/react";
import { useNetwork } from "@/hooks";

export function NetworkBadge() {
  const { network } = useNetwork();

  return (
    <Tooltip delay={0}>
      <Chip size="sm" color={network.id === "mainnet" ? "success" : "default"}>
        {network.label}
      </Chip>
      <Tooltip.Content>
        <p>Chain ID {network.chain.id}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
