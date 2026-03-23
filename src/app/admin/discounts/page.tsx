import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminDiscountsClient from "./AdminDiscountsClient";

export default async function AdminDiscountsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-2 py-2 text-slate-100">
      <AdminDiscountsClient />
    </div>
  );
}
