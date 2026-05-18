import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyInvoiceToken } from "@/lib/invoiceLink";
import {
  buildInvoiceHtml,
  buildInvoiceNumber,
  loadOrderDocumentData,
} from "@/lib/orderDocuments";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");
  const expiresRaw = request.nextUrl.searchParams.get("expires");
  const expiresAt = expiresRaw ? Number(expiresRaw) : NaN;
  const hasValidToken =
    token && Number.isFinite(expiresAt)
      ? verifyInvoiceToken(id, expiresAt, token)
      : false;

  const session = hasValidToken ? null : await getServerSession(authOptions);
  if (!hasValidToken && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!hasValidToken) {
    const isAdmin = session?.user?.role === "ADMIN";
    if (!isAdmin && order.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const documentData = await loadOrderDocumentData(id);
  if (!documentData) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const html = buildInvoiceHtml(documentData);
  const invoiceNumber = buildInvoiceNumber(documentData);
  const filename = `rechnung-${invoiceNumber}.html`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
