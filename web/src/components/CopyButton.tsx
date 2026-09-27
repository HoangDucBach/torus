"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={copy}>
      <Icon
        icon={copied ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"}
        className={`size-4 ${copied ? "text-success" : ""}`}
      />
    </Button>
  );
}
