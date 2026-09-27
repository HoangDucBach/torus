"use client";

import { Torus } from "@/components/icons/Torus";
import { useNetwork } from "@/hooks";

export function ProtocolStatusCard() {
  const { network } = useNetwork();

  return (
    <div className="relative mt-auto overflow-hidden rounded-3xl bg-surface p-4">
      <div className="pointer-events-none absolute top-1/2 right-0 size-32 -translate-y-1/2 translate-x-1/3 rounded-full border border-foreground/10" />
      <div className="pointer-events-none absolute top-1/2 right-0 size-48 -translate-y-1/2 translate-x-1/3 rounded-full border border-foreground/[0.06]" />
      <div className="pointer-events-none absolute top-1/2 right-0 size-64 -translate-y-1/2 translate-x-1/3 rounded-full border border-foreground/[0.03]" />

      <span className="absolute top-3 right-4 text-lg leading-none text-foreground/25">−</span>

      <div className="relative flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-white to-neutral-400 text-black">
        <Torus size={20} />
      </div>

      <div className="relative mt-5 flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Torus Protocol</span>
        <span className="flex items-center gap-1.5 text-xs text-foreground/50">
          <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
          Live on {network.label} now
        </span>
      </div>
    </div>
  );
}
