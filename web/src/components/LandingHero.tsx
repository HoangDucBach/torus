"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InputGroup, Label, TextField } from "@heroui/react";

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LandingHero() {
  const router = useRouter();
  const [amount, setAmount] = useState("");

  return (
    <section
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: "radial-gradient(358.23% 100% at 50% 0%, #121212 54.25%, #3A4454 100%)" }}
    >
      <Image
        src="/assets/Landing-TorusBackground.svg"
        alt=""
        fill
        priority
        className="object-cover"
      />

      <div className="absolute top-1/2 left-[6%] flex w-[90%] max-w-[393px] -translate-y-1/2 flex-col items-start gap-4 md:left-[13.6%]">
        <h1 className="text-4xl leading-10 text-foreground">
          Stop holding gas
          <br />
          Start earning yield
          <br />
          <span className="font-bold">Built for Arc Network</span>
        </h1>

        <p className="text-base leading-6 text-foreground/60">
          <span className="font-semibold text-foreground">torUSDC</span> is a yield-bearing USDC
          vault on <span className="font-semibold text-foreground">Arc</span> that pays your gas
          straight out of its own yield, so you never need to hold or swap a separate gas token.
        </p>

        <div className="flex w-full items-end gap-4">
          <TextField className="min-w-0 flex-1" name="amount" value={amount} onChange={setAmount}>
            <Label className="sr-only">Amount of USDC</Label>
            <InputGroup className="rounded-full">
              <InputGroup.Input placeholder="Amount of USDC" />
              <InputGroup.Suffix className="pe-3">
                <Image src="/assets/USDC.webp" alt="USDC" width={24} height={24} className="rounded-full" />
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>

          <Button onPress={() => router.push("/app")}>
            Deposit
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </section>
  );
}
