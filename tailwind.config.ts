import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        muted: "var(--muted)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Noto Sans SC", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow)",
      },
      borderRadius: {
        card: "var(--radius)",
      },
    },
  },
  plugins: [],
} satisfies Config;
