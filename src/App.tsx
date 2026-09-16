import { NavLink, Route, Routes } from "react-router-dom";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <nav className="flex gap-1 bg-slate-900 border-b border-slate-800 px-3 py-2">
        {[
          { to: "/", label: "Practice" },
          { to: "/contest", label: "Contest" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded text-sm font-medium ${
                isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
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
