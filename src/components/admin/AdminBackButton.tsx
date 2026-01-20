"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function AdminBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (!pathname?.startsWith("/admin") || pathname === "/admin") {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label="Zurueck"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Zurück
      </button>
    </div>
  );
}
