"use client";

import { useCreateWallet, useSign7702Authorization, useWallets } from "@privy-io/react-auth";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createPublicClient, http, zeroAddress, type Hash } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import { arcTestnet } from "@/lib/chain";
import { serverUrl } from "@/lib/contracts";
import type { MutationHookResult } from "./types";

// eth-infinitism's Simple7702Account reference implementation — already deployed on Arc at this
// canonical address (same one viem's and permissionless.js's 7702 helpers default to), so no
// new contract deployment is needed for this to work.
const SIMPLE_7702_ACCOUNT_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

type Eip7702GaslessCallResult = {
  userOpHash: Hash;
  txHash: Hash;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a trivial, fully-sponsored UserOperation from the user's own EOA — via EIP-7702, with
 * no separate smart-account contract ever deployed for it — paid entirely out of its torUSDC
 * balance through TorusPaymaster on EntryPoint v0.8.
 *
 * Requires Privy's embedded wallet (`NEXT_PUBLIC_PRIVY_APP_ID`): standard browser wallets
 * (MetaMask) don't yet expose an RPC method for a dApp to request an EIP-7702 authorization
 * signature — see github.com/MetaMask/smart-accounts-kit/issues/247 — so this specific flow
 * can't run against an injected wallet today. It also needs a real bundler
 * (`NEXT_PUBLIC_BUNDLER_URL`, e.g. Pimlico) to relay the UserOperation; Torus's own server only
 * supplies the paymaster half via its ERC-7677 `/paymaster` endpoint.
 */
export function useEip7702GaslessCall(): MutationHookResult<void, Eip7702GaslessCallResult> {
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  // `wallets` closed over by `mutationFn` below would otherwise be a snapshot from whichever
  // render created this particular `useMutation` instance — stale by the time an in-flight
  // `createWallet()` call resolves and Privy's own state (and therefore `useWallets()`) updates.
  // Reading through a ref kept fresh by this effect lets the retry loop below see that update.
  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  return useMutation({
    mutationFn: async () => {
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL;
      if (!bundlerUrl) {
        throw new Error("Set NEXT_PUBLIC_BUNDLER_URL to a bundler that supports Arc Testnet (e.g. Pimlico)");
      }

      const findEmbeddedWallet = () => walletsRef.current.find((w) => w.walletClientType === "privy");

      let embeddedWallet = findEmbeddedWallet();
      if (!embeddedWallet) {
        // `createOnLogin` only auto-creates an embedded wallet for users who log in with no
        // wallet at all (e.g. email/OTP); a user who connected an external wallet through
        // Privy's modal has none, so create one on demand instead of failing outright.
        await createWallet();
        // Privy's own state (and this hook's `wallets`) updates asynchronously after that
        // resolves — poll briefly rather than assuming it's already reflected.
        for (let attempt = 0; !embeddedWallet && attempt < 20; attempt++) {
          await sleep(250);
          embeddedWallet = findEmbeddedWallet();
        }
      }
      if (!embeddedWallet) {
        throw new Error("Could not find or create a Privy embedded wallet — try again");
      }

      const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
      const provider = await embeddedWallet.getEthereumProvider();

      const account = await to7702SimpleSmartAccount({
        client: publicClient,
        // permissionless's `OneOf<{ request(...) } | EIP1193Provider>` owner type wants an exact
        // shape match; a plain EIP1193Provider also structurally satisfies the simpler branch
        // (it has extra `on`/`removeListener` members), which trips strict `OneOf` checking.
        owner: { request: provider.request.bind(provider) },
      });

      const authorization = await signAuthorization(
        {
          contractAddress: SIMPLE_7702_ACCOUNT_IMPL,
          chainId: arcTestnet.id,
          nonce: await publicClient.getTransactionCount({ address: account.address }),
        },
        // Without this, Privy tries to resolve "the" signing wallet on its own (e.g. via the
        // user's primary linked account) and throws "Signing wallet not found" for a user whose
        // embedded wallet isn't set as primary — the address found above is unambiguous.
        { address: embeddedWallet.address }
      );

      const paymaster = createPaymasterClient({ transport: http(`${serverUrl}/paymaster`) });
      const bundlerClient = createBundlerClient({
        client: publicClient,
        chain: arcTestnet,
        transport: http(bundlerUrl),
        paymaster,
      });

      const userOpHash = await bundlerClient.sendUserOperation({
        account,
        calls: [{ to: zeroAddress, value: 0n, data: "0x" }],
        authorization,
      });

      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      return { userOpHash, txHash: receipt.receipt.transactionHash };
    },
  });
}
