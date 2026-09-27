"use client";

import { useState } from "react";
import Image from "next/image";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Alert, Button, Label, Modal, NumberField, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ConnectWalletDialog } from "@/components/ConnectWalletDialog";
import { Torus } from "@/components/icons/Torus";
import { formatTokenAmount } from "@/lib/format";
import {
  useDepositNative,
  useEarnings,
  useIsCorrectNetwork,
  useNativeBalance,
  useNetwork,
  useSwitchToArc,
  useTorBalance,
  useWithdraw,
} from "@/hooks";

const EARNED_BLOCK_COLORS = ["#9651AE", "#D86DB6", "#F4D1A9"];

function DepositModal() {
  const isCorrectNetwork = useIsCorrectNetwork();
  const [amount, setAmount] = useState(1);
  const depositNative = useDepositNative();

  return (
    <Modal>
      <Button isDisabled={!isCorrectNetwork}>Deposit</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[360px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Deposit USDC</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-foreground/60">
                Wrap native USDC into torUSDC. No approval step needed.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <NumberField value={amount} onChange={setAmount} minValue={0}>
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
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {depositNative.isSuccess ? "Done" : "Cancel"}
              </Button>
              {depositNative.isSuccess ? null : (
                <Button
                  isDisabled={amount <= 0}
                  isPending={depositNative.isPending}
                  onPress={() => depositNative.mutate({ amount: String(amount) })}
                >
                  Confirm
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function WithdrawModal() {
  const isCorrectNetwork = useIsCorrectNetwork();
  const [amount, setAmount] = useState(1);
  const withdraw = useWithdraw();

  return (
    <Modal>
      <Button variant="secondary" isDisabled={!isCorrectNetwork}>
        Withdraw
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[360px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Withdraw torUSDC</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-foreground/60">
                Redeem torUSDC back into USDC at the current exchange rate.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <NumberField value={amount} onChange={setAmount} minValue={0}>
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
                    <Alert.Description className="break-all">
                      Tx: {withdraw.data?.hash}
                    </Alert.Description>
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
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {withdraw.isSuccess ? "Done" : "Cancel"}
              </Button>
              {withdraw.isSuccess ? null : (
                <Button
                  isDisabled={amount <= 0}
                  isPending={withdraw.isPending}
                  onPress={() => withdraw.mutate({ shares: String(amount) })}
                >
                  Confirm
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function BalanceWidget({
  label,
  icon,
  amount,
  isPending,
  action,
  earnedBadge,
  style,
}: {
  label: string;
  icon: React.ReactNode;
  amount: string | undefined;
  isPending: boolean;
  action: React.ReactNode;
  earnedBadge?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col justify-between gap-8 rounded-3xl bg-surface p-6"
      style={style}
    >
      <div className="flex items-start justify-between">
        <p className="text-base text-foreground/60">{label}</p>
        {earnedBadge ? <span className="text-sm text-green-500">{earnedBadge}</span> : null}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {icon}
          {isPending ? (
            <Skeleton className="h-14 w-32 rounded-full" />
          ) : (
            <span className="text-6xl font-bold text-foreground">{amount}</span>
          )}
        </div>
      </div>
      <div className="flex justify-end">{action}</div>
    </div>
  );
}

export default function AppPage() {
  const { isConnected } = useAccount();
  const isCorrectNetwork = useIsCorrectNetwork();
  const switchNetwork = useSwitchToArc();
  const { network } = useNetwork();
  const nativeBalance = useNativeBalance();
  const torBalance = useTorBalance();
  const earnings = useEarnings();

  if (!isConnected) {
    return <ConnectWalletDialog isOpen />;
  }

  if (!isCorrectNetwork) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Wrong network</Alert.Title>
          <Alert.Description>
            Your wallet isn&apos;t on {network.chain.name} (chain {network.chain.id}).
          </Alert.Description>
          <Button
            className="mt-2"
            size="sm"
            isPending={switchNetwork.isPending}
            onPress={() => switchNetwork.mutate()}
          >
            Switch to {network.chain.name}
          </Button>
        </Alert.Content>
      </Alert>
    );
  }

  const earned = earnings.data?.earned ?? 0n;
  const depositedTotal = earnings.data?.depositedTotal ?? 0n;
  const roiPercent =
    depositedTotal > 0n
      ? (Number(formatUnits(earned, 6)) / Number(formatUnits(depositedTotal, 6))) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="pointer-events-none fixed right-0 bottom-0 z-0 translate-x-1/2 translate-y-1/2 opacity-5">
        <Torus size={256} />
      </div>

      <div className="relative flex flex-col gap-6 sm:flex-row">
        <BalanceWidget
          label="Total balance"
          icon={<Image src="/assets/USDC.webp" alt="USDC" width={64} height={64} className="rounded-full" />}
          amount={nativeBalance.isPending ? undefined : formatTokenAmount(nativeBalance.data ?? 0n, 18)}
          isPending={nativeBalance.isPending}
          action={<DepositModal />}
        />

        <div className="absolute top-1/2 left-1/2 hidden size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-secondary sm:flex">
          <Icon icon="solar:transfer-horizontal-bold-duotone" className="size-5 text-foreground" />
        </div>

        <BalanceWidget
          label="Total balance"
          icon={<Torus size={64} />}
          amount={torBalance.isPending ? undefined : formatTokenAmount(torBalance.data ?? 0n, 18)}
          isPending={torBalance.isPending}
          action={<WithdrawModal />}
          earnedBadge={
            earnings.isPending ? undefined : `+${formatTokenAmount(earned, 6)} earned`
          }
          style={{ background: "linear-gradient(270deg, #121212 15%, #3A4454 100%)" }}
        />
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-surface p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-foreground/60">Total earned</p>
          <div className="flex items-baseline gap-2">
            {earnings.isPending ? (
              <Skeleton className="h-7 w-24 rounded-full" />
            ) : (
              <span className="text-2xl font-semibold text-foreground">
                {formatTokenAmount(earned, 6)}
              </span>
            )}
            <span className="text-sm text-green-500">+{roiPercent.toFixed(1)}%</span>
          </div>
        </div>

        <p className="max-w-md text-sm text-foreground/60">
          Total earned based on yield-bearing <span className="font-semibold text-foreground">stablecoin</span> earned
          <br/> from all <span className="font-semibold text-foreground">transactions</span>.
        </p>

        <div className="flex h-16 items-stretch gap-2">
          {EARNED_BLOCK_COLORS.map((color, i) => (
            <div
              key={color}
              className="rounded-2xl"
              style={{ backgroundColor: color, width: i === EARNED_BLOCK_COLORS.length - 1 ? 96 : 40 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
