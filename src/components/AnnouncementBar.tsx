import {
  CheckBadgeIcon,
  TruckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export function AnnouncementBar() {
  const items = [
    { icon: <ArrowPathIcon className="h-4 w-4" />, text: "14 Tage Rückgabe" },
    {
      icon: <CheckBadgeIcon className="h-4 w-4" />,
      text: "Sichere Zahlung mit Stripe",
    },
    {
      icon: <TruckIcon className="h-4 w-4" />,
      text: "Kostenloser Versand ab 69 EUR",
    },
    {
      icon: <CheckBadgeIcon className="h-4 w-4" />,
      text: "15 EUR Mindestbestellwert",
    },
  ];
  const loopItems = [...items, ...items];

  return (
    <div className="fixed top-0 left-0 z-50 w-full bg-[#2f3e36] text-green-100 text-xs">
      <div className="mx-auto px-0">
        <div className="relative flex h-10 items-center overflow-hidden">
          <div className="announcement-marquee flex items-center">
            <div className="flex flex-none items-center gap-[120px]">
              {loopItems.map((item, idx) => (
                <Item key={`a-${idx}`} icon={item.icon}>
                  {item.text}
                </Item>
              ))}
            </div>
            <div className="flex flex-none w-[120px]" aria-hidden="true" />
            <div
              className="flex flex-none items-center gap-[120px]"
              aria-hidden="true"
            >
              {loopItems.map((item, idx) => (
                <Item key={`b-${idx}`} icon={item.icon}>
                  {item.text}
                </Item>
              ))}
            </div>
          </div>
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
    <div className="flex h-10 items-center gap-2 whitespace-nowrap">
      {icon}
      <span className="tracking-wide">{children}</span>
    </div>
  );
}
