"use client";

import { useState } from "react";
import { formatEther, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Alert, Button, Card, Chip, Label, NumberField, Separator, Skeleton } from "@heroui/react";
import {
  useBridgeToArc,
  useConnectWallet,
  useDepositNative,
  useDisconnectWallet,
  useNativeBalance,
  useProtocolStats,
  useTorBalance,
} from "@/hooks";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletCard() {
  const { address, isConnected } = useAccount();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Wallet</Card.Title>
        <Card.Description>Connect a browser wallet added to Arc Testnet.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Chip>{isConnected && address ? shortAddress(address) : "Not connected"}</Chip>
      </Card.Content>
      <Card.Footer className="flex flex-col items-start gap-3">
        {isConnected ? (
          <Button variant="outline" onPress={() => disconnectWallet.disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button isPending={connectWallet.isPending} onPress={() => connectWallet.mutate()}>
            Connect Wallet
          </Button>
        )}
        {connectWallet.error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Could not connect</Alert.Title>
              <Alert.Description>{connectWallet.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Footer>
    </Card>
  );
}

function AccountCard() {
  const { isConnected } = useAccount();
  const nativeBalance = useNativeBalance();
  const torBalance = useTorBalance();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Your Balances</Card.Title>
        <Card.Description>Native USDC vs. yield-bearing torUSDC.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {!isConnected ? (
          <p>Connect a wallet to see your balances.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span>Native USDC</span>
              {nativeBalance.isPending ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                <span>{formatEther(nativeBalance.data ?? 0n)}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>torUSDC</span>
              {torBalance.isPending ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                <span>{formatEther(torBalance.data ?? 0n)}</span>
              )}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

function DepositCard() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState(1);
  const depositNative = useDepositNative();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Deposit</Card.Title>
        <Card.Description>
          Wrap native USDC into torUSDC. No approval step — gas for future transactions is paid
          straight out of this balance.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <NumberField value={amount} onChange={setAmount} minValue={0} isDisabled={!isConnected}>
          <Label>Amount (native USDC)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        {depositNative.isSuccess ? (
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Deposit confirmed</Alert.Title>
              <Alert.Description className="break-all">
                Tx: {depositNative.data?.hash}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {depositNative.error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Deposit failed</Alert.Title>
              <Alert.Description>{depositNative.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Content>
      <Card.Footer>
        <Button
          isDisabled={!isConnected || amount <= 0}
          isPending={depositNative.isPending}
          onPress={() => depositNative.mutate({ amount: String(amount) })}
        >
          Deposit
        </Button>
      </Card.Footer>
    </Card>
  );
}

function BridgeCard() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState(1);
  const bridge = useBridgeToArc();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Bridge Into Arc</Card.Title>
        <Card.Description>
          No Arc Testnet USDC yet? Bridge it in from Ethereum Sepolia via Circle&apos;s App Kit
          (docs.arc.io/app-kit), then deposit above.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <NumberField value={amount} onChange={setAmount} minValue={0} isDisabled={!isConnected}>
          <Label>Amount (USDC on Ethereum Sepolia)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        {bridge.isSuccess ? (
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Bridge submitted</Alert.Title>
              <Alert.Description>State: {bridge.data?.state}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {bridge.error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Bridge failed</Alert.Title>
              <Alert.Description>{bridge.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Content>
      <Card.Footer>
        <Button
          isDisabled={!isConnected || amount <= 0}
          isPending={bridge.isPending}
          onPress={() => bridge.mutate({ amount: String(amount) })}
        >
          Bridge from Ethereum Sepolia
        </Button>
      </Card.Footer>
    </Card>
  );
}

function StatsCard() {
  const stats = useProtocolStats();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Protocol Stats</Card.Title>
        <Card.Description>Live numbers from the Torus vault and paymaster.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {stats.isPending ? (
          <>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </>
        ) : stats.error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Could not load stats</Alert.Title>
              <Alert.Description>{stats.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : stats.data ? (
          <>
            <div className="flex items-center justify-between">
              <span>Total Value Locked</span>
              <span>{formatUnits(BigInt(stats.data.totalAssets), 6)} USDC</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Exchange Rate</span>
              <span>{formatEther(BigInt(stats.data.rate))}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Performance Fee</span>
              <span>{stats.data.performanceFeeBps / 100}%</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Paymaster Spread</span>
              <span>{stats.data.spreadBps / 100}%</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Paymaster EntryPoint Deposit</span>
              <span>{formatEther(BigInt(stats.data.paymasterEntryPointDeposit))}</span>
            </div>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Torus Protocol</h1>
        <p>Self-paying gas on Arc — deposit native USDC, earn yield, pay gas from it.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <WalletCard />
        <AccountCard />
        <BridgeCard />
        <DepositCard />
        <StatsCard />
      </div>
    </main>
  );
}
