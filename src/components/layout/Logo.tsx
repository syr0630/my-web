import Link from "next/link";

type Props = {
  href?: string;
  showTagline?: boolean;
  size?: "sm" | "md";
};

export function Logo({ href = "/", showTagline = false, size = "md" }: Props) {
  const markSize = size === "md" ? 36 : 30;

  const content = (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 36 36"
        aria-hidden="true"
        focusable="false"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="10"
          fill="var(--tone-humanize)"
          stroke="color-mix(in srgb, var(--tone-humanize-ink) 26%, transparent)"
        />
        <path
          d="M8.5 13.5A2.5 2.5 0 0 1 11 11h5l2 2h7a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 25 27H11a2.5 2.5 0 0 1-2.5-2.5v-11Z"
          fill="var(--surface)"
          stroke="var(--tone-humanize-ink)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 16.5h19"
          stroke="var(--tone-humanize-ink)"
          strokeWidth="1.4"
          opacity="0.7"
        />
        <path
          d="M14 20.5h8M14 23.5h5"
          stroke="var(--tone-humanize-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={`font-bold tracking-[-0.04em] text-[var(--text)] ${
            size === "md" ? "text-lg" : "text-base"
          }`}
        >
          Draftly
        </span>
        {showTagline ? (
          <span className="mt-1 text-[10px] leading-snug text-muted">
            Polish your draft in seconds.
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <Link href={href} className="rounded-xl" aria-label="Draftly">
      {content}
    </Link>
  );
}