import type { Verdict } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";

export default function VerdictBadge({
  verdict,
  size = "sm",
  showLong = false,
}: {
  verdict: Verdict;
  size?: "sm" | "lg";
  showLong?: boolean;
}) {
  const info = getVerdictInfo(verdict);
  const sizeClasses = size === "lg" ? "px-4 py-1.5 text-base" : "px-3 py-1 text-sm";
  return (
    <span
      title={`${info.long}: ${info.description}`}
      className={`inline-block rounded-md border font-semibold ${sizeClasses} ${info.classes}`}
    >
      {showLong ? info.long : info.short}
      {showLong && <span className="ml-2 opacity-60 font-normal text-xs">({info.short})</span>}
    </span>
  );
}
