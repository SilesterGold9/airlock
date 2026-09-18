import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]";

const variants: Record<Variant, string> = {
  primary: "bg-ac/[0.14] text-ac border border-ac/40 hover:bg-ac/[0.22] active:bg-ac/[0.28]",
  secondary: "bg-white/[0.08] text-foreground hover:bg-white/[0.12] border border-border",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
  success: "bg-ac text-white hover:bg-ac/90",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3",
  lg: "h-9 px-4",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function Button({ variant = "primary", size = "md", className = "", ...props }, ref) {
  return <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
});
