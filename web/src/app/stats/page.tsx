"use client";

import { formatEther, formatUnits } from "viem";
import { Alert, Card, Separator, Skeleton } from "@heroui/react";
import { useProtocolStats } from "@/hooks";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function StatsPage() {
  const stats = useProtocolStats();

  if (stats.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded" />
        <Skeleton className="h-32 w-full rounded" />
      </div>
    );
  }

  if (stats.error || !stats.data) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Could not load stats</Alert.Title>
          <Alert.Description>{stats.error?.message}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const { data } = stats;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Card>
        <Card.Header>
          <Card.Title>Vault</Card.Title>
          <Card.Description>{data.vault}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <StatRow label="Total Value Locked" value={`${formatUnits(BigInt(data.totalAssets), 6)} USDC`} />
          <Separator />
          <StatRow label="torUSDC Supply" value={formatEther(BigInt(data.totalSupply))} />
          <Separator />
          <StatRow label="Exchange Rate" value={formatEther(BigInt(data.rate))} />
          <Separator />
          <StatRow label="Performance Fee" value={`${data.performanceFeeBps / 100}%`} />
          <Separator />
          <StatRow label="Strategy Total Assets" value={`${formatUnits(BigInt(data.strategy.totalAssets), 6)} USDC`} />
          <Separator />
          <StatRow label="Strategy Reserve" value={`${formatUnits(BigInt(data.strategy.reserve), 6)} USDC`} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Paymaster &amp; Gas Sponsorship</Card.Title>
          <Card.Description>{data.paymaster}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <StatRow label="Spread" value={`${data.spreadBps / 100}%`} />
          <Separator />
          <StatRow label="EntryPoint Deposit" value={formatEther(BigInt(data.paymasterEntryPointDeposit))} />
          <Separator />
          <StatRow
            label="Gas Sponsored (torUSDC)"
            value={formatEther(BigInt(data.gasSponsored.totalTorUsdcCharged))}
          />
          <Separator />
          <StatRow label="UserOperations Sponsored" value={data.gasSponsored.userOperationCount} />
        </Card.Content>
      </Card>
    </div>
  );
}
