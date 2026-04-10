import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  buildPackingSlipHtml,
  buildPackingSlipNumber,
  loadOrderDocumentData,
} from "@/lib/orderDocuments";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await loadOrderDocumentData(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const html = buildPackingSlipHtml(order);
  const filename = `beilegschein-${buildPackingSlipNumber(order).toLowerCase()}.html`;

  return new NextResponse(html, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
