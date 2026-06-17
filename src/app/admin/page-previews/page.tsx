import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getAdminPagePreviews } from "@/lib/adminPagePreviews";
import AdminPagePreviewsClient from "./AdminPagePreviewsClient";

export default async function AdminPagePreviewsPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

  const previews = await getAdminPagePreviews();

  return <AdminPagePreviewsClient previews={previews} />;
}
