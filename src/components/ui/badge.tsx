import * as React from "react";
import { useT } from "../../lib/i18n";

type BadgeVariant = "default" | "easy" | "medium" | "hard" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-card border-border text-foreground",
  easy: "text-difficulty-easy bg-difficulty-easy/12 border-difficulty-easy/20",
  medium: "text-difficulty-medium bg-difficulty-medium/14 border-difficulty-medium/20",
  hard: "text-difficulty-hard bg-difficulty-hard/12 border-difficulty-hard/20",
  outline: "text-muted-foreground border-border",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const t = useT();
  let variant: BadgeVariant = "medium";
  let label = `${difficulty}`;
  if (difficulty < 1000) {
    variant = "easy";
    label = `${t("difficulty.easy")} · ${difficulty}`;
  } else if (difficulty < 1600) {
    variant = "medium";
    label = `${t("difficulty.medium")} · ${difficulty}`;
  } else {
    variant = "hard";
    label = `${t("difficulty.hard")} · ${difficulty}`;
  }
  return <Badge variant={variant}>{label}</Badge>;
}
