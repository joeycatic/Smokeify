import { NextResponse } from "next/server";
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
    leadTimeDays?: number | null;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }

  const websiteResult = normalizeWebsite(body.website);
  if (!websiteResult.ok) {
    return NextResponse.json(
      { error: "Website must be a valid http(s) link" },
      { status: 400 }
    );
  }

  if (
    typeof body.leadTimeDays !== "undefined" &&
    (typeof body.leadTimeDays !== "number" ||
      !Number.isFinite(body.leadTimeDays) ||
      body.leadTimeDays < 0)
  ) {
    return NextResponse.json(
      { error: "Lead time must be a non-negative number" },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      contactName: body.contactName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      website: websiteResult.value,
      notes: body.notes?.trim() || null,
      leadTimeDays:
        typeof body.leadTimeDays === "number" ? body.leadTimeDays : null,
    },
  });

  return NextResponse.json({ supplier });
}
