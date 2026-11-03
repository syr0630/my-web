"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

type Props = {
  withLabel?: boolean;
  className?: string;
};

export function ThemeToggle({ withLabel = false, className = "" }: Props) {
  const { theme, mounted, toggleTheme } = useTheme();
  const nextLabel = theme === "light" ? "夜间" : "日间";
  const label = mounted
    ? `切换到${nextLabel}模式`
    : "切换日间 / 夜间模式";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        toggleTheme({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
    >
      {theme === "light" ? <SunIcon /> : <MoonIcon />}
      {withLabel ? (
        <span className="theme-toggle-label">{nextLabel}</span>
      ) : null}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
    </svg>
  );
}