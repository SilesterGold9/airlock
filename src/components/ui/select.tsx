import * as React from "react";

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className = "", size = "md", children, ...props }, ref) => {
  const sizeClasses = size === "sm" ? "h-7 px-2.5 pr-7 text-xs" : "h-9 px-3 pr-8 text-sm";
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`flex w-full appearance-none rounded-lg border border-input bg-input text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-70">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
});
Select.displayName = "Select";
