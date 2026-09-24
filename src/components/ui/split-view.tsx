import * as React from "react";
import { useT } from "../../lib/i18n";

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey?: string;
  initialPercent?: number;
  minLeft?: number;
  minRight?: number;
}

export function SplitView({
  left,
  right,
  storageKey,
  initialPercent = 50,
  minLeft = 320,
  minRight = 420,
}: SplitViewProps) {
  const t = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [percent, setPercent] = React.useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const n = Number(saved);
          if (!isNaN(n) && n > 10 && n < 90) return n;
        }
      } catch {
        // storage unavailable: fall through to default
      }
    }
    return initialPercent;
  });
  const dragging = React.useRef(false);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(percent));
    } catch {
      // ignore
    }
  }, [percent, storageKey]);

  function clamp(p: number, total: number): number {
    const minLeftPct = (minLeft / total) * 100;
    const minRightPct = (minRight / total) * 100;
    return Math.max(minLeftPct, Math.min(100 - minRightPct, p));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const total = containerRef.current?.getBoundingClientRect().width ?? 0;
    if (total <= 0) return;
    const step = (40 / total) * 100;
    setPercent((p) => clamp(p + (e.key === "ArrowRight" ? step : -step), total));
  }

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const total = rect.width;
      setPercent(clamp((x / total) * 100, total));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: `${percent}%` }} className="min-w-0 overflow-hidden flex flex-col">
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="w-1 hover:w-1.5 bg-border hover:bg-brand cursor-col-resize shrink-0 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:bg-brand"
        role="separator"
        aria-orientation="vertical"
        aria-label={t("split.resize")}
        aria-valuemin={10}
        aria-valuemax={90}
        aria-valuenow={Math.round(percent)}
      />
      <div style={{ width: `${100 - percent}%` }} className="min-w-0 overflow-hidden flex flex-col">
        {right}
      </div>
    </div>
  );
}
