"use client";

import { Icon } from "@iconify/react";
import { Button, Modal } from "@heroui/react";
import { Torus } from "@/components/icons/Torus";
import { useConnectWallet } from "@/hooks";

// Same radial structure as the landing hero background.
const DIALOG_BACKGROUND = "radial-gradient(358.23% 100% at 50% 0%, #121212 54.25%, #3A4454 100%)";

export function ConnectWalletDialog({ isOpen }: { isOpen: boolean }) {
  const connectWallet = useConnectWallet();

  return (
    <Modal.Backdrop isOpen={isOpen} isDismissable={false} isKeyboardDismissDisabled variant="blur">
      <Modal.Container placement="center">
        <Modal.Dialog
          aria-label="Connect wallet"
          className="rounded-[2rem] p-2 sm:max-w-95"
          style={{ background: DIALOG_BACKGROUND }}
        >
          <Modal.Header className="items-center text-center">
            <Torus size={48} />
            <Modal.Heading className="mt-3 text-xl">Connect your wallet</Modal.Heading>
            <p className="text-sm text-foreground/60">Deposit USDC, earn yield, pay gas from it.</p>
          </Modal.Header>
          <Modal.Footer className="flex-col gap-3">
            <Button
              className="w-full"
              size="lg"
              isPending={connectWallet.isPending}
              onPress={() => connectWallet.mutate()}
            >
              <Icon icon="solar:wallet-bold-duotone" className="size-5" />
              Connect Wallet
            </Button>
            {connectWallet.error ? (
              <p className="text-center text-sm text-danger">{connectWallet.error.message}</p>
            ) : null}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
