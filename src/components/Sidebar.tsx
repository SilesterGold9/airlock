import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogoIcon } from "./Logo";
import { useLocale, useT } from "../lib/i18n";

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  practice: "M8 5v14l11-7z",
  contest: "M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 3.5M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 3.5",
  stress: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
  recall: "M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6",
  techniques: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  journey: "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z",
  history: "M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2",
  import: "M16 16l-4-4-4 4M12 12v9M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3",
  guide: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
};

type Item = { to: string; labelKey: string; icon: string; end?: boolean };

const GROUPS: { groupKey: string; items: Item[] }[] = [
  {
    groupKey: "nav.group.train",
    items: [
      { to: "/", labelKey: "nav.practice", icon: ICONS.practice, end: true },
      { to: "/contest", labelKey: "nav.contest", icon: ICONS.contest },
      { to: "/stress", labelKey: "nav.stress", icon: ICONS.stress },
      { to: "/recall", labelKey: "nav.recall", icon: ICONS.recall },
    ],
  },
  {
    groupKey: "nav.group.progress",
    items: [
      { to: "/techniques", labelKey: "nav.techniques", icon: ICONS.techniques },
      { to: "/journey", labelKey: "nav.journey", icon: ICONS.journey },
      { to: "/history", labelKey: "nav.history", icon: ICONS.history },
    ],
  },
  {
    groupKey: "nav.group.manage",
    items: [
      { to: "/import", labelKey: "nav.import", icon: ICONS.import },
      { to: "/guide", labelKey: "nav.guide", icon: ICONS.guide },
      { to: "/settings", labelKey: "nav.settings", icon: ICONS.settings },
    ],
  },
];

const FLAT_ORDER = GROUPS.flatMap((g) => g.items.map((i) => i.to));

export default function Sidebar() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const displayName = (localStorage.getItem("airlock.displayName") || "").trim();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const n = Number(e.key);
      if (n < 1 || n > FLAT_ORDER.length) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      e.preventDefault();
      navigate(FLAT_ORDER[n - 1]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  let shortcut = 0;

  return (
    <aside data-tour="nav" className="w-52 shrink-0 bg-background border-r border-border flex flex-col min-h-0">
      <div className="flex items-center gap-1.5 px-3 h-12 shrink-0">
        <LogoIcon size={22} />
        <span className="font-mono font-bold text-[13px] tracking-tight">Airlock</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Primary">
        {GROUPS.map((group) => (
          <div key={group.groupKey} className="mt-3 first:mt-1">
            <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.groupKey)}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                shortcut += 1;
                const hint = shortcut;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={`${t(item.labelKey)} (Alt+${hint})`}
                      className={({ isActive }) =>
                        `px-2.5 h-8 flex items-center gap-2 rounded-md text-[13px] font-medium transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${
                          isActive
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                        }`
                      }
                    >
                      <Icon d={item.icon} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-border shrink-0 flex items-center gap-2">
        {displayName ? (
          <span
            title={displayName}
            className="w-7 h-7 rounded-full bg-ac/[0.15] border border-ac/30 text-ac text-xs font-semibold flex items-center justify-center select-none shrink-0"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <span className="w-7" />
        )}
        <button
          onClick={() => setLocale(locale === "en" ? "pt" : "en")}
          className="ml-auto text-[11px] font-medium px-2.5 h-7 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          title={locale === "en" ? t("app.switchToPt") : t("app.switchToEn")}
        >
          {locale === "en" ? "PT" : "EN"}
        </button>
      </div>
    </aside>
  );
}
