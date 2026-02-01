import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageLayout from "@/components/PageLayout";
import AdminEmailTestingClient from "./AdminEmailTestingClient";

export default async function AdminEmailTestingPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminEmailTestingClient />
      </div>
    </PageLayout>
  );
}
