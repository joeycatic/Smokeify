import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  buildPackingSlipPdf,
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

  const pdf = buildPackingSlipPdf(order);
  const filename = `lieferschein-${buildPackingSlipNumber(order).toLowerCase()}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
