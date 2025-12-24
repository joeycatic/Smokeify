import {
  CheckBadgeIcon,
  TruckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export function AnnouncementBar() {
  return (
    <div className="w-full bg-[#2f3e36] text-green-100 text-xs">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-10 items-center justify-between gap-6">

          <Item icon={<ArrowPathIcon className="h-4 w-4" />}>
            14 Tage Rückgabe
          </Item>

          <Item icon={<CheckBadgeIcon className="h-4 w-4" />}>
            Top Onlineshop 2025–2026
          </Item>

          <Item icon={<TruckIcon className="h-4 w-4" />}>
            Kostenloser Versand ab 69€
          </Item>

          <Item icon={<CheckBadgeIcon className="h-4 w-4" />}>
            15€ Mindestbestellwert
          </Item>

        </div>
      </div>
    </div>
  );
}

function Item({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {icon}
      <span className="tracking-wide">{children}</span>
    </div>
  );
}
