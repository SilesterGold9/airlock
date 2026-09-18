/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        brand: { DEFAULT: "#22c55e", foreground: "#020617" },
        ac: { DEFAULT: "#22c55e", soft: "rgba(34,197,94,0.15)" },
        wa: { DEFAULT: "hsl(var(--destructive))", soft: "hsl(var(--destructive) / 0.15)" },
        tle: { DEFAULT: "#fac31d", soft: "#fac31d26" },
        re: { DEFAULT: "#c477e5", soft: "#c477e526" },
        ce: { DEFAULT: "#64748b", soft: "#64748b26" },
        difficulty: {
          easy: "#00af9b",
          medium: "#ffc01e",
          hard: "#ff375f",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { transform: "translateY(4px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.2,0,0,1)",
        "slide-up": "slide-up 200ms cubic-bezier(0.2,0,0,1)",
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up": "accordion-up 200ms ease-out",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
