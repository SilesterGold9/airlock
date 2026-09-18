import type { ReactNode } from "react";

export interface PanelTab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

// LeetCode-style panel tabs: icon + label with an animated underline.
export function PanelTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: PanelTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-2 h-11 border-b border-border shrink-0 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-2.5 h-11 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge}
            <span
              className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-foreground transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
                isActive ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// Slim 28px icon button used in workspace toolbars.
export function ToolButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shrink-0"
    >
      {children}
    </button>
  );
}
