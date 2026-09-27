import { formatUnits } from "viem";

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  return formatCompactNumber(Number(formatUnits(value, decimals)));
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** Relative time since `timestampMs` (e.g. a query's real `dataUpdatedAt`) — never a made-up value. */
export function formatRelativeTime(timestampMs: number): string {
  const seconds = Math.round((timestampMs - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relativeTimeFormatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeTimeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return relativeTimeFormatter.format(hours, "hour");
}
