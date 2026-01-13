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
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
            Discounts
          </h1>
          <p className="text-sm text-stone-600">
            Create and manage Stripe promotion codes.
          </p>
        </div>
        <AdminDiscountsClient />
      </div>
    </PageLayout>
  );
}
