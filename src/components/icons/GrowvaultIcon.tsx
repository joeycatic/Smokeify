import type { ComponentType, SVGProps } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BeakerIcon,
  BoltIcon,
  BookOpenIcon,
  CheckBadgeIcon,
  CloudIcon,
  CubeIcon,
  EyeDropperIcon,
  HomeModernIcon,
  KeyIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export const growvaultIconNames = [
  "leaf",
  "sprout",
  "tent",
  "light",
  "fan",
  "water",
  "gauge",
  "sensor",
  "soil",
  "configurator",
  "analyzer",
  "cart",
  "package",
  "truck",
  "shield",
  "check",
  "book",
  "sparkles",
  "filter",
  "search",
  "user",
  "admin",
] as const;

export type GrowvaultIconName = (typeof growvaultIconNames)[number];

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<GrowvaultIconName, IconComponent> = {
  leaf: SparklesIcon,
  sprout: SparklesIcon,
  tent: HomeModernIcon,
  light: LightBulbIcon,
  fan: ArrowPathIcon,
  water: EyeDropperIcon,
  gauge: ScaleIcon,
  sensor: CloudIcon,
  soil: BeakerIcon,
  configurator: AdjustmentsHorizontalIcon,
  analyzer: MagnifyingGlassIcon,
  cart: ShoppingBagIcon,
  package: CubeIcon,
  truck: TruckIcon,
  shield: ShieldCheckIcon,
  check: CheckBadgeIcon,
  book: BookOpenIcon,
  sparkles: SparklesIcon,
  filter: AdjustmentsHorizontalIcon,
  search: MagnifyingGlassIcon,
  user: UserIcon,
  admin: KeyIcon,
};

type GrowvaultIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: GrowvaultIconName;
  size?: number;
  label?: string;
};

export function GrowvaultIcon({
  name,
  size = 24,
  className,
  label,
  ...props
}: GrowvaultIconProps) {
  const Icon = iconMap[name] ?? BoltIcon;

  return (
    <Icon
      width={size}
      height={size}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  );
}
