"use client";

import { CopyButton } from "@/components/CopyButton";
import { useNetwork } from "@/hooks";

export function PaymasterEndpoint() {
  const { network } = useNetwork();
  const url = `${network.serverUrl}/paymaster`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/5 px-3 py-2">
      <code className="truncate font-mono text-sm">{url}</code>
      <CopyButton value={url} label="Copy paymaster endpoint" />
    </div>
  );
}
