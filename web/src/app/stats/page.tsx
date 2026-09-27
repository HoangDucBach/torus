"use client";

import Image from "next/image";
import { Alert, Card, ProgressBar, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Torus } from "@/components/icons/Torus";
import { useProtocolStats } from "@/hooks";
import {
  formatCompactNumber,
  formatRelativeTime,
  formatTokenAmount,
} from "@/lib/format";

function Stat({
  label,
  value,
  size = "lg",
}: {
  label: string;
  value: string;
  size?: "base" | "lg";
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-foreground/60">{label}</p>
      <p
        className={
          size === "base"
            ? "text-base font-bold text-foreground"
            : "text-2xl font-bold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export default function StatsPage() {
  const stats = useProtocolStats();

  if (stats.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
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
  const lastUpdated = formatRelativeTime(stats.dataUpdatedAt);
  const strategyTotalAssets = BigInt(data.strategy.totalAssets);
  const reserveCoverage =
    strategyTotalAssets > 0n
      ? Math.min(
          100,
          (Number(BigInt(data.strategy.reserve)) /
            Number(strategyTotalAssets)) *
            100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-foreground/60">TVL</p>
        <div className="flex items-center gap-3">
          <span className="text-6xl font-bold text-foreground">
            {formatTokenAmount(BigInt(data.totalAssets), 6)}
          </span>
          <Image
            src="/assets/USDC.webp"
            alt="USDC"
            width={40}
            height={40}
            className="rounded-full"
          />
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Torus size={24} />
            <Card.Title>torUSDC Vault</Card.Title>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Stat
              label="Total Minted"
              value={formatTokenAmount(BigInt(data.totalSupply), 18)}
            />
            <Stat
              label="Exchange Rate"
              value={formatTokenAmount(BigInt(data.rate), 18)}
            />
            <Stat
              label="Performance Fee"
              size="base"
              value={`${data.performanceFeeBps / 100}%`}
            />
            <Stat
              label="Strategy Total"
              size="base"
              value={`${formatTokenAmount(BigInt(data.strategy.totalAssets), 6)} USDC`}
            />
            <Stat
              label="Strategy Reserve"
              size="base"
              value={`${formatTokenAmount(BigInt(data.strategy.reserve), 6)} USDC`}
            />
          </div>

          <ProgressBar
            aria-label="Strategy reserve coverage"
            value={reserveCoverage}
          >
            <ProgressBar.Track className="rounded-full">
              <ProgressBar.Fill
                className="rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #D86DB6 0%, #FCC07C 36%, #00C950 66%, #5454FF 100%)",
                }}
              />
            </ProgressBar.Track>
          </ProgressBar>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">
          Paymaster &amp; Gas Sponsorship
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card
            style={{
              background:
                "radial-gradient(circle at 50% 100%, #F48B49 6%, #7C4C2F 17%, #131313 73%)",
            }}
          >
            <Card.Content className="flex flex-col items-center justify-center gap-2 py-8">
              <span className="text-3xl font-bold text-foreground">
                {data.spreadBps / 100}%
              </span>
              <span className="text-sm text-foreground/60">Spread</span>
            </Card.Content>
          </Card>

          <Card
            style={{
              background: "linear-gradient(180deg, #131313 37%, #7F7F7F 100%)",
            }}
          >
            <Card.Content className="flex flex-col gap-6 justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground/60">EntryPoint Deposit</p>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {formatTokenAmount(
                      BigInt(data.paymasterEntryPointDeposit),
                      18,
                    )}
                  </span>
                  <Torus size={20} />
                </div>
                <p className="text-xs text-foreground/40">
                  Last updated {lastUpdated}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground/60">
                  UserOperations Sponsored
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {formatCompactNumber(data.gasSponsored.userOperationCount)}
                  </span>
                  <Icon
                    icon="solar:widget-2-bold-duotone"
                    className="size-5 text-foreground"
                  />
                </div>
                <p className="text-xs text-foreground/40">
                  Last updated {lastUpdated}
                </p>
              </div>
            </Card.Content>
          </Card>

          <Card
            style={{
              background: "linear-gradient(180deg, #131313 0%, #3A4454 100%)",
            }}
          >
            <Card.Content className="flex flex-col gap-3 justify-between">
              <Icon
                icon="solar:gas-station-bold-duotone"
                className="size-6 text-foreground"
              />
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-foreground/60">Gas Sponsored</p>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {formatTokenAmount(
                      BigInt(data.gasSponsored.totalTorUsdcCharged),
                      18,
                    )}
                  </span>
                  <Torus size={32} />
                </div>
                <p className="text-xs text-foreground/40">
                  Last updated {lastUpdated}
                </p>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
