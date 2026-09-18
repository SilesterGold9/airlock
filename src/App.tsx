import { NavLink, Route, Routes, Navigate, useLocation } from "react-router-dom";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";
import Stress from "./pages/Stress";
import Import from "./pages/Import";
import History from "./pages/History";
import Techniques from "./pages/Techniques";
import Recall from "./pages/Recall";
import Journey from "./pages/Journey";
import Welcome from "./pages/Welcome";
import Settings from "./pages/Settings";
import { LogoIcon } from "./components/Logo";
import { useLocale, useT } from "./lib/i18n";
import Titlebar from "./components/Titlebar";

export default function App() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const location = useLocation();
  const onboarded = localStorage.getItem("airlock.onboarded") === "1";
  if (!onboarded && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }
  const displayName = (localStorage.getItem("airlock.displayName") || "").trim();
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Titlebar />
      <nav className="h-11 flex items-center gap-1 bg-background border-b border-border px-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 mr-1 shrink-0">
          <LogoIcon size={22} />
          <span className="font-mono font-bold text-[13px] tracking-tight">Airlock</span>
        </div>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />
        {[
          { to: "/", label: t("nav.practice") },
          { to: "/techniques", label: t("nav.techniques") },
          { to: "/recall", label: t("nav.recall") },
          { to: "/contest", label: t("nav.contest") },
          { to: "/stress", label: t("nav.stress") },
          { to: "/import", label: t("nav.import") },
          { to: "/history", label: t("nav.history") },
          { to: "/journey", label: t("nav.journey") },
          { to: "/settings", label: t("nav.settings") },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `px-2.5 h-7 flex items-center rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] shrink-0 ${
                isActive
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-2">
          {displayName && (
            <span
              title={displayName}
              className="w-6 h-6 rounded-full bg-ac/[0.15] border border-ac/30 text-ac text-[11px] font-semibold flex items-center justify-center select-none"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <button
            onClick={() => setLocale(locale === "en" ? "pt" : "en")}
            className="text-[11px] font-medium px-2.5 h-7 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            title={locale === "en" ? t("app.switchToPt") : t("app.switchToEn")}
          >
            {locale === "en" ? "PT" : "EN"}
          </button>
        </div>
      </nav>
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Practice />} />
          <Route path="/techniques" element={<Techniques />} />
          <Route path="/recall" element={<Recall />} />
          <Route path="/contest" element={<Contest />} />
          <Route path="/stress" element={<Stress />} />
          <Route path="/import" element={<Import />} />
          <Route path="/history" element={<History />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
