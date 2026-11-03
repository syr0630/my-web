import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/common/Icon";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: IconName;
  badge?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  badge,
  meta,
  children,
}: Props) {
  return (
    <header className="page-head">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="page-head-eyebrow">
            {icon ? <Icon name={icon} size={13} /> : null}
            {eyebrow}
          </p>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
        {children}
      </div>
      {badge ? <div className="page-head-badge">{badge}</div> : null}
    </header>
  );
}