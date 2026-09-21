"use client";

import { useState } from "react";
import { formatEther, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Alert, Button, Card, Chip, Label, NumberField, Separator, Skeleton } from "@heroui/react";
import {
  useConnectWallet,
  useDepositNative,
  useDisconnectWallet,
  useEarnings,
  useIsCorrectNetwork,
  useNativeBalance,
  useSwitchToArcTestnet,
  useTorBalance,
  useWithdraw,
} from "@/hooks";
import type { QueryHookResult } from "@/hooks/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletCard() {
  const { address, isConnected } = useAccount();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();
  const isCorrectNetwork = useIsCorrectNetwork();
  const switchNetwork = useSwitchToArcTestnet();

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
        {isConnected && !isCorrectNetwork ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Wrong network</Alert.Title>
              <Alert.Description>
                Your wallet isn&apos;t on Arc Testnet (chain 5042002), so balances below can&apos;t
                load.
              </Alert.Description>
              <Button
                className="mt-2"
                size="sm"
                isPending={switchNetwork.isPending}
                onPress={() => switchNetwork.mutate()}
              >
                Switch to Arc Testnet
              </Button>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Footer>
    </Card>
  );
}

function BalanceRow({ label, query }: { label: string; query: QueryHookResult<bigint> }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      {query.isPending ? (
        <Skeleton className="h-4 w-24 rounded" />
      ) : query.isError ? (
        <span title={query.error.message}>Error</span>
      ) : (
        <span>{formatEther(query.data ?? 0n)}</span>
      )}
    </div>
  );
}

function AccountCard() {
  const { isConnected } = useAccount();
  const nativeBalance = useNativeBalance();
  const torBalance = useTorBalance();
  const earnings = useEarnings();

  return (
    <Card>
      <Card.Header>
        <Card.Title>Your Position</Card.Title>
        <Card.Description>Native USDC vs. yield-bearing torUSDC, and real earnings.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {!isConnected ? (
          <p>Connect a wallet to see your position.</p>
        ) : (
          <>
            <BalanceRow label="Native USDC" query={nativeBalance} />
            <Separator />
            <BalanceRow label="torUSDC" query={torBalance} />
            <Separator />
            <div className="flex items-center justify-between">
              <span>Deposited</span>
              {earnings.isPending ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : earnings.isError ? (
                <span title={earnings.error.message}>Error</span>
              ) : (
                <span>{formatUnits(earnings.data?.depositedTotal ?? 0n, 6)} USDC</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Current Value</span>
              {earnings.isPending ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : earnings.isError ? (
                <span title={earnings.error.message}>Error</span>
              ) : (
                <span>{formatUnits(earnings.data?.currentValue ?? 0n, 6)} USDC</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Earned</span>
              {earnings.isPending ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : earnings.isError ? (
                <span title={earnings.error.message}>Error</span>
              ) : (
                <span>{formatUnits(earnings.data?.earned ?? 0n, 6)} USDC</span>
              )}
            </div>
          </>
        )}
      </Card.Content>
      <Card.Footer>
        <Button
          variant="outline"
          size="sm"
          isDisabled={!isConnected}
          onPress={() => {
            void nativeBalance.refetch();
            void torBalance.refetch();
            void earnings.refetch();
          }}
        >
          Refresh
        </Button>
      </Card.Footer>
    </Card>
  );
}

function DepositCard() {
  const { isConnected } = useAccount();
  const isCorrectNetwork = useIsCorrectNetwork();
  const [amount, setAmount] = useState(1);
  const depositNative = useDepositNative();
  const canDeposit = isConnected && isCorrectNetwork;

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
        <NumberField value={amount} onChange={setAmount} minValue={0} isDisabled={!canDeposit}>
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
          isDisabled={!canDeposit || amount <= 0}
          isPending={depositNative.isPending}
          onPress={() => depositNative.mutate({ amount: String(amount) })}
        >
          Deposit
        </Button>
      </Card.Footer>
    </Card>
  );
}

function WithdrawCard() {
  const { isConnected } = useAccount();
  const isCorrectNetwork = useIsCorrectNetwork();
  const [amount, setAmount] = useState(1);
  const withdraw = useWithdraw();
  const canWithdraw = isConnected && isCorrectNetwork;

  return (
    <Card>
      <Card.Header>
        <Card.Title>Withdraw</Card.Title>
        <Card.Description>Redeem torUSDC back into USDC, at the current exchange rate.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <NumberField value={amount} onChange={setAmount} minValue={0} isDisabled={!canWithdraw}>
          <Label>Amount (torUSDC)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        {withdraw.isSuccess ? (
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Withdrawal confirmed</Alert.Title>
              <Alert.Description className="break-all">Tx: {withdraw.data?.hash}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {withdraw.error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Withdrawal failed</Alert.Title>
              <Alert.Description>{withdraw.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Content>
      <Card.Footer>
        <Button
          variant="outline"
          isDisabled={!canWithdraw || amount <= 0}
          isPending={withdraw.isPending}
          onPress={() => withdraw.mutate({ shares: String(amount) })}
        >
          Withdraw
        </Button>
      </Card.Footer>
    </Card>
  );
}

export default function AppPage() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <WalletCard />
      <AccountCard />
      <DepositCard />
      <WithdrawCard />
    </div>
  );
}
