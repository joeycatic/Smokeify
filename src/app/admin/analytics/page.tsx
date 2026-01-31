import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageLayout from "@/components/PageLayout";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const isAdminOrStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!isAdminOrStaff) notFound();

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminAnalyticsClient />
      </div>
    </PageLayout>
  );
}
