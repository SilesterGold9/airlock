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
  const sizeClasses =
    size === "lg" ? "px-3.5 py-1.5 text-sm rounded-lg" : "px-2.5 py-0.5 text-xs rounded-full";
  return (
    <span
      title={`${info.long}: ${info.description}`}
      className={`inline-flex items-center border font-medium transition-colors duration-150 ${sizeClasses} ${info.classes}`}
    >
      {showLong ? info.long : info.short}
      {showLong && <span className="ml-1.5 opacity-60 font-normal text-xs">({info.short})</span>}
    </span>
  );
}
