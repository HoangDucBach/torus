"use client";

import { Tooltip } from "@heroui/react";
import { CopyButton } from "@/components/CopyButton";
import { useNetwork } from "@/hooks";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function AddressRow({ label, address, explorerUrl }: { label: string; address: string; explorerUrl: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-foreground/60">{label}</span>
      <div className="flex items-center gap-1">
        <Tooltip delay={0}>
          <a
            className="font-mono text-sm underline decoration-foreground/30 underline-offset-2"
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {shortAddress(address)}
          </a>
          <Tooltip.Content>
            <p className="break-all">{address}</p>
          </Tooltip.Content>
        </Tooltip>
        <CopyButton value={address} label={`Copy ${label} address`} />
      </div>
    </div>
  );
}

export function ContractAddresses() {
  const { network } = useNetwork();

  return (
    <div className="flex flex-col divide-y divide-foreground/10">
      <AddressRow label="TorusVault (torUSDC)" address={network.addresses.vault} explorerUrl={network.explorerUrl} />
      <AddressRow label="TorusPaymaster" address={network.addresses.paymaster} explorerUrl={network.explorerUrl} />
      <AddressRow label="USDC" address={network.addresses.usdc} explorerUrl={network.explorerUrl} />
    </div>
  );
}
