import { useEffect, useRef, useState } from "react";

interface TimerProps {
  durationMinutes: number;
  onExpire?: () => void;
  compact?: boolean;
}

export default function Timer({ durationMinutes, onExpire, compact = false }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const low = secondsLeft < 300; // last 5 minutes

  return (
    <div
      className={`tabular-nums tracking-wider ${
        compact
          ? `text-sm font-semibold ${low ? "text-wa animate-pulse" : "text-foreground"}`
          : `text-3xl font-bold ${low ? "text-wa animate-pulse" : "text-foreground"}`
      }`}
    >
      {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}
