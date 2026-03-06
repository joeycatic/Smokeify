import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { authOptions } from "@/lib/auth";
import AdminDiscountsClient from "./AdminDiscountsClient";

export default async function AdminDiscountsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <AdminDiscountsClient />
      </div>
    </PageLayout>
  );
}
