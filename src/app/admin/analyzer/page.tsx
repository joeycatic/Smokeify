import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminAnalyzerClient from "./AdminAnalyzerClient";

export default async function AdminAnalyzerPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminAnalyzerClient />
    </div>
  );
}
