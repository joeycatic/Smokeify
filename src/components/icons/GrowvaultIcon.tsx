import type { ComponentType, SVGProps } from "react";

export const growvaultIconNames = [
  "package",
  "configurator",
  "analyzer",
] as const;

export type GrowvaultIconName = (typeof growvaultIconNames)[number];

type GrowvaultIconProps = SVGProps<SVGSVGElement> & {
  name: GrowvaultIconName;
  size?: number;
  label?: string;
};

function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
    </svg>
  );
}

function ConfiguratorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <line x1="21" x2="14" y1="6" y2="6" />
      <line x1="10" x2="3" y1="6" y2="6" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="18" y2="18" />
      <line x1="12" x2="3" y1="18" y2="18" />
      <line x1="12" x2="12" y1="4" y2="8" />
      <line x1="10" x2="10" y1="10" y2="14" />
      <line x1="14" x2="14" y1="16" y2="20" />
    </svg>
  );
}

function AnalyzerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="11" cy="11" r="3" />
      <path d="m15 15 3 3" />
    </svg>
  );
}

const iconMap: Record<GrowvaultIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  package: PackageIcon,
  configurator: ConfiguratorIcon,
  analyzer: AnalyzerIcon,
};

export function GrowvaultIcon({
  name,
  size = 24,
  className,
  label,
  strokeWidth = 1.9,
  ...props
}: GrowvaultIconProps) {
  const Icon = iconMap[name];

  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  );
}
