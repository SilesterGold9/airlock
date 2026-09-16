import { NavLink, Route, Routes } from "react-router-dom";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-50 h-12 flex items-center gap-1 bg-background/80 backdrop-blur-md border-b border-border px-4 shrink-0">
        {[
          { to: "/", label: "Practice" },
          { to: "/contest", label: "Contest" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${
                isActive
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Practice />} />
          <Route path="/contest" element={<Contest />} />
        </Routes>
      </main>
    </div>
  );
}
