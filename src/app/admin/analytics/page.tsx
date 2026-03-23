import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export default async function AdminAnalyticsPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminAnalyticsClient />
    </div>
  );
}
