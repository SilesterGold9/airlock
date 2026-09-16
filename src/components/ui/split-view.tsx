import * as React from "react";

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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [percent, setPercent] = React.useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = Number(saved);
        if (!isNaN(n) && n > 10 && n < 90) return n;
      }
    }
    return initialPercent;
  });
  const dragging = React.useRef(false);

  React.useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, String(percent));
  }, [percent, storageKey]);

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const total = rect.width;
      let p = (x / total) * 100;
      const minLeftPct = (minLeft / total) * 100;
      const minRightPct = (minRight / total) * 100;
      p = Math.max(minLeftPct, Math.min(100 - minRightPct, p));
      setPercent(p);
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
        className="w-1 hover:w-1.5 bg-border hover:bg-brand cursor-col-resize shrink-0 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
        role="separator"
        aria-orientation="vertical"
      />
      <div style={{ width: `${100 - percent}%` }} className="min-w-0 overflow-hidden flex flex-col">
        {right}
      </div>
    </div>
  );
}
