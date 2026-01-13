import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: "APPROVED" | "REJECTED";
    adminNote?: string;
  };

  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const requestRow = await prisma.returnRequest.findUnique({
    where: { id },
  });
  if (!requestRow) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: {
      status: body.status,
      adminNote: body.adminNote?.trim() || null,
    },
  });

  await prisma.order.update({
    where: { id: requestRow.orderId },
    data: {
      status:
        body.status === "APPROVED" ? "return_approved" : "return_rejected",
    },
  });

  return NextResponse.json({ request: updated });
}
