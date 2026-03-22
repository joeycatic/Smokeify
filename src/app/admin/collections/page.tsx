import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminCollectionsClient from "./AdminCollectionsClient";

export default async function AdminCollectionsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  return (
    <div className="mx-auto max-w-5xl px-2 py-2 text-stone-800">
      <AdminCollectionsClient />
    </div>
  );
}
