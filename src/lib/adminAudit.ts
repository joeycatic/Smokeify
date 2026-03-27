import type { Prisma } from "@prisma/client";

export const ADMIN_AUDIT_PAGE_SIZE = 50;

export type AdminAuditFilters = {
  q: string;
  action: string;
  actor: string;
  target: string;
  page: number;
};

function readParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return typeof value === "string" ? value.trim() : "";
}

export function parseAdminAuditFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined
): AdminAuditFilters {
  const requestedPage = Number.parseInt(readParam(searchParams, "page"), 10);
  return {
    q: readParam(searchParams, "q"),
    action: readParam(searchParams, "action"),
    actor: readParam(searchParams, "actor"),
    target: readParam(searchParams, "target"),
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function buildAdminAuditWhere(filters: AdminAuditFilters): Prisma.AdminAuditLogWhereInput {
  const and: Prisma.AdminAuditLogWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { action: { contains: filters.q, mode: "insensitive" } },
        { summary: { contains: filters.q, mode: "insensitive" } },
        { actorEmail: { contains: filters.q, mode: "insensitive" } },
        { actorId: { contains: filters.q, mode: "insensitive" } },
        { targetType: { contains: filters.q, mode: "insensitive" } },
        { targetId: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.action) {
    and.push({
      action: { contains: filters.action, mode: "insensitive" },
    });
  }

  if (filters.actor) {
    and.push({
      OR: [
        { actorEmail: { contains: filters.actor, mode: "insensitive" } },
        { actorId: { contains: filters.actor, mode: "insensitive" } },
      ],
    });
  }

  if (filters.target) {
    const [targetType, ...targetIdParts] = filters.target.split(":");
    const targetId = targetIdParts.join(":").trim();

    if (targetType && targetId) {
      and.push({
        targetType: { equals: targetType, mode: "insensitive" },
        targetId: { equals: targetId },
      });
    } else {
      and.push({
        OR: [
          { targetType: { contains: filters.target, mode: "insensitive" } },
          { targetId: { contains: filters.target, mode: "insensitive" } },
        ],
      });
    }
  }

  return and.length ? { AND: and } : {};
}

function escapeCsvCell(value: string) {
  if (!value.includes('"') && !value.includes(",") && !value.includes("\n")) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeAdminAuditCsv(
  rows: Array<{
    action: string;
    actorEmail: string | null;
    actorId: string | null;
    targetType: string | null;
    targetId: string | null;
    summary: string | null;
    createdAt: Date;
  }>
) {
  const header = [
    "created_at",
    "action",
    "actor_email",
    "actor_id",
    "target_type",
    "target_id",
    "summary",
  ];

  const lines = rows.map((row) =>
    [
      row.createdAt.toISOString(),
      row.action,
      row.actorEmail ?? "",
      row.actorId ?? "",
      row.targetType ?? "",
      row.targetId ?? "",
      row.summary ?? "",
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}
