export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Airlock">
      <title>Airlock</title>
      <circle cx="64" cy="64" r="60" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
      <circle cx="64" cy="64" r="52" fill="none" stroke="#334155" strokeWidth="2" />
      <g fill="#475569">
        <circle cx="64" cy="10.5" r="3.4" />
        <circle cx="105.5" cy="26.5" r="3.4" />
        <circle cx="117.5" cy="64" r="3.4" />
        <circle cx="105.5" cy="101.5" r="3.4" />
        <circle cx="64" cy="117.5" r="3.4" />
        <circle cx="22.5" cy="101.5" r="3.4" />
        <circle cx="10.5" cy="64" r="3.4" />
        <circle cx="22.5" cy="26.5" r="3.4" />
      </g>
      <circle cx="64" cy="64" r="38" fill="#020617" />
      <circle cx="64" cy="64" r="38" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.35" />
      <path d="M46 50 L60 64 L46 78" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="68" y1="78" x2="86" y2="78" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

import { useT } from "../lib/i18n";

export function LogoWordmark({ width = 160 }: { width?: number }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={32} />
      <div className="flex flex-col leading-none">
        <span className="font-mono font-bold text-[16px] tracking-tight text-foreground">Airlock</span>
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground">{t("app.tagline")}</span>
      </div>
    </div>
  );
}
