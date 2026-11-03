import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "pen"
  | "sparkles"
  | "checkBadge"
  | "scan"
  | "sliders"
  | "menu"
  | "close"
  | "copy"
  | "undo"
  | "redo"
  | "trash"
  | "arrowRight"
  | "globe"
  | "shield"
  | "info"
  | "alert"
  | "chevronDown"
  | "restore"
  | "refresh"
  | "play"
  | "pause"
  | "spark"
  | "lock"
  | "upload"
  | "download"
  | "clock"
  | "check"
  | "x"
  | "external"
  | "text"
  | "split"
  | "book"
  | "message"
  | "folder"
  | "loader";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.2V20a1 1 0 0 0 1 1h3.7v-5.6h3.6V21h3.7a1 1 0 0 0 1-1V9.2" />
    </>
  ),
  pen: (
    <>
      <path d="M16.3 3.9a1.6 1.6 0 0 1 2.3 0l1.5 1.5a1.6 1.6 0 0 1 0 2.3L8.1 19.7 3.8 21l1.2-4.4L16.3 3.9Z" />
      <path d="m14.2 6.1 3.7 3.7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.2 13.6 8 18.4 9.6 13.6 11.2 12 16l-1.6-4.8L5.6 9.6 10.4 8 12 3.2Z" />
      <path d="M18.4 15.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  checkBadge: (
    <>
      <path d="M9 12.4l2.1 2.1 4.1-4.4" />
      <path d="M12 3.2 14 5l2.7-.3 1 2.5 2.5 1-.3 2.7 1.7 2.1-1.7 2.1.3 2.7-2.5 1-1 2.5-2.7-.3L12 20.8 10 19l-2.7.3-1-2.5-2.5-1 .3-2.7L2.4 11l1.7-2.1-.3-2.7 2.5-1 1-2.5L10 5l2-1.8Z" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8.4V5.4a1.4 1.4 0 0 1 1.4-1.4h3" />
      <path d="M15.6 4h3A1.4 1.4 0 0 1 20 5.4v3" />
      <path d="M20 15.6v3a1.4 1.4 0 0 1-1.4 1.4h-3" />
      <path d="M8.4 20h-3A1.4 1.4 0 0 1 4 18.6v-3" />
      <path d="M8 12h8" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h8" />
      <path d="M16 7h4" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.4A1.9 1.9 0 0 0 13.6 4.5H6.4A1.9 1.9 0 0 0 4.5 6.4v7.2a1.9 1.9 0 0 0 1.9 1.9h2.1" />
    </>
  ),
  undo: (
    <>
      <path d="M9.5 14.5 4.5 9.5l5-5" />
      <path d="M4.5 9.5h9a6 6 0 0 1 0 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="m14.5 14.5 5-5-5-5" />
      <path d="M19.5 9.5h-9a6 6 0 0 0 0 12h3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5 6.1v5.2c0 4.4 2.9 7.5 7 9.1 4.1-1.6 7-4.7 7-9.1V6.1l-7-2.9Z" />
      <path d="m9.2 12.1 2 2 3.6-3.9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <path d="M12 7.9h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.9 17.2a1.9 1.9 0 0 0 1.7 2.9h14.8a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
      <path d="M12 9v4.2" />
      <path d="M12 16.6h.01" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  restore: (
    <>
      <path d="M4 4.5v5h5" />
      <path d="M4.8 9.5a7.8 7.8 0 1 1 1.6 7.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 5.5v5h-5" />
      <path d="M19.2 10.5a7.8 7.8 0 1 0-1.6 7.2" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M8.5 5v14" />
      <path d="M15.5 5v14" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 17.9 10.3 12.4 5 10.7 10.3 9 12 3.5Z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="m20 4-9 9" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  text: (
    <>
      <path d="M5 6h14" />
      <path d="M5 11h10" />
      <path d="M5 16h12" />
      <path d="M5 20h7" />
    </>
  ),
  split: (
    <>
      <path d="M4 5h16" />
      <path d="M12 5v14" />
      <path d="M7.5 9.5 4 13l3.5 3.5" />
      <path d="m16.5 9.5 3.5 3.5-3.5 3.5" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 4H11v16H6.5a2 2 0 0 0-2 1.5V5.5Z" />
      <path d="M19.5 5.5A2 2 0 0 0 17.5 4H13v16h4.5a2 2 0 0 1 2 1.5V5.5Z" />
      <path d="M7 8h1.5M15.5 8H17M7 12h1.5M15.5 12H17" />
    </>
  ),
  message: (
    <>
      <path d="M20 11.2a7.3 7.3 0 0 1-7.6 7.2 8.5 8.5 0 0 1-3.2-.7L4 20l1.7-4.4A7 7 0 0 1 4.8 11a7.3 7.3 0 0 1 7.6-7.2A7.3 7.3 0 0 1 20 11.2Z" />
      <path d="M8.5 10.5h7M8.5 13.5h4.5" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
      <path d="M3.5 10.5h17" />
    </>
  ),
  loader: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </>
  ),
};

type Props = {
  name: IconName;
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "name">;

export function Icon({ name, size = 20, className, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}