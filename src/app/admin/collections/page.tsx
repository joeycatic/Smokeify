import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { authOptions } from "@/lib/auth";
import AdminCollectionsClient from "./AdminCollectionsClient";

export default async function AdminCollectionsPage() {
  const session = await getServerSession(authOptions);
  const isAdminOrStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!isAdminOrStaff) notFound();

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <AdminCollectionsClient />
      </div>
    </PageLayout>
  );
}
