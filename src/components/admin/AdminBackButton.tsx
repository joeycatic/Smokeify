"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type AdminBackButtonProps = {
  inline?: boolean;
  showOnCatalog?: boolean;
  showOnSuppliers?: boolean;
  showOnOrders?: boolean;
  showOnReturns?: boolean;
  showOnDiscounts?: boolean;
  showOnAnalytics?: boolean;
  showOnAudit?: boolean;
  className?: string;
};

export default function AdminBackButton({
  inline = false,
  showOnCatalog = false,
  showOnSuppliers = false,
  showOnOrders = false,
  showOnReturns = false,
  showOnDiscounts = false,
  showOnAnalytics = false,
  showOnAudit = false,
  className,
}: AdminBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (!pathname?.startsWith("/admin") || pathname === "/admin") {
    return null;
  }
  if (pathname === "/admin/catalog" && !showOnCatalog) {
    return null;
  }
  if (pathname === "/admin/suppliers" && !showOnSuppliers) {
    return null;
  }
  if (pathname === "/admin/orders" && !showOnOrders) {
    return null;
  }
  if (pathname === "/admin/returns" && !showOnReturns) {
    return null;
  }
  if (pathname === "/admin/discounts" && !showOnDiscounts) {
    return null;
  }
  if (pathname === "/admin/analytics" && !showOnAnalytics) {
    return null;
  }
  if (pathname === "/admin/audit" && !showOnAudit) {
    return null;
  }

  const buttonClassName = [
    "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={inline ? "contents" : "mt-4"}>
      <button
        type="button"
        onClick={() => {
          if (pathname === "/admin/catalog") {
            router.push("/admin");
          } else {
            router.back();
          }
        }}
        className={buttonClassName}
        aria-label="Zurueck"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Zurück
      </button>
    </div>
  );
}
