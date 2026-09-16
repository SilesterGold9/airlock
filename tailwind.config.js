/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ac: "#22c55e",
        wa: "#ef4444",
        tle: "#f59e0b",
        re: "#a855f7",
        ce: "#64748b",
      },
    },
  },
  plugins: [],
};
