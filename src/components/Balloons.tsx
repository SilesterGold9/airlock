import { useEffect, useState } from "react";

const colors = ["#22c55e", "#facc15", "#f97316", "#ef4444", "#a855f7", "#38bdf8"];

export default function Balloons({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute bottom-0 animate-[balloon_2s_ease-out_forwards]"
          style={{
            left: `${12 + i * 11}%`,
            animationDelay: `${i * 120}ms`,
            background: colors[i % colors.length],
          } as React.CSSProperties & { animationDelay: string }}
        >
          <div className="w-6 h-8 rounded-full" style={{ background: colors[i % colors.length] }} />
          <div className="w-px h-6 bg-white/40 mx-auto" />
        </div>
      ))}
      <style>{`@keyframes balloon { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(-80vh) scale(1.1); opacity: 0; } }`}</style>
    </div>
  );
}
