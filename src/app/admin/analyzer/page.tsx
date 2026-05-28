import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminAnalyzerClient from "./AdminAnalyzerClient";

export default async function AdminAnalyzerPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

  return (
    <div className="w-full text-stone-800">
      <AdminAnalyzerClient />
    </div>
  );
}
