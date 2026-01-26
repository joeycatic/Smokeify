import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

const normalizeWebsite = (value?: string | null) => {
  if (typeof value !== "string") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, value: null };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, value: null };
  }
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const body = (await request.json()) as {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
    leadTimeDays?: number | null;
  };

  const updates: {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
    leadTimeDays?: number | null;
  } = {};

  if (typeof body.name !== "undefined") {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const existing = await prisma.supplier.findUnique({ where: { name } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    }
    updates.name = name;
  }

  if (typeof body.contactName !== "undefined") {
    updates.contactName = body.contactName?.trim() || null;
  }

  if (typeof body.email !== "undefined") {
    updates.email = body.email?.trim() || null;
  }

  if (typeof body.phone !== "undefined") {
    updates.phone = body.phone?.trim() || null;
  }

  if (typeof body.website !== "undefined") {
    const websiteResult = normalizeWebsite(body.website);
    if (!websiteResult.ok) {
      return NextResponse.json(
        { error: "Website must be a valid http(s) link" },
        { status: 400 }
      );
    }
    updates.website = websiteResult.value;
  }

  if (typeof body.notes !== "undefined") {
    updates.notes = body.notes?.trim() || null;
  }

  if (typeof body.leadTimeDays !== "undefined") {
    if (
      typeof body.leadTimeDays !== "number" ||
      !Number.isFinite(body.leadTimeDays) ||
      body.leadTimeDays < 0
    ) {
      return NextResponse.json(
        { error: "Lead time must be a non-negative number" },
        { status: 400 }
      );
    }
    updates.leadTimeDays = body.leadTimeDays;
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ supplier });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
