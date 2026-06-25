import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { listUnresolvedOrderAttributionRows } from "@/lib/adminAttribution";
import { getNewsletterAttributionDiagnostics } from "@/lib/adminNewsletter";
import AdminAttributionClient from "./AdminAttributionClient";

export default async function AdminAttributionPage() {
  if (!(await requireAdminScope(["ops.read", "marketing.read"]))) notFound();

  const [attributionSnapshot, newsletterDiagnostics] = await Promise.all([
    listUnresolvedOrderAttributionRows(),
    getNewsletterAttributionDiagnostics(),
  ]);

  return (
    <div className="w-full text-slate-100">
      <AdminAttributionClient
        initialRows={attributionSnapshot.rows}
        initialEvidenceCounts={attributionSnapshot.evidenceCounts}
        newsletterDiagnostics={newsletterDiagnostics}
      />
    </div>
  );
}
