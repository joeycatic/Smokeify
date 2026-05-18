import "server-only";

import { Prisma } from "@prisma/client";
import {
  normalizeAdminSavedViewFilters,
  normalizeAdminSavedViewRoute,
} from "@/lib/adminSavedViewValidation";
import { prisma } from "@/lib/prisma";

export type AdminSavedViewPayload = {
  id: string;
  ownerId: string | null;
  ownerEmail: string | null;
  route: string;
  label: string;
  filters: Record<string, string>;
  storefrontScope: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminSavedViewActor = {
  id: string | null;
  email: string | null;
};

const serializeSavedView = (view: {
  id: string;
  ownerId: string | null;
  ownerEmail: string | null;
  route: string;
  label: string;
  filters: Prisma.JsonValue;
  storefrontScope: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminSavedViewPayload => ({
  id: view.id,
  ownerId: view.ownerId,
  ownerEmail: view.ownerEmail,
  route: view.route,
  label: view.label,
  filters:
    view.filters && typeof view.filters === "object" && !Array.isArray(view.filters)
      ? (view.filters as Record<string, string>)
      : {},
  storefrontScope: view.storefrontScope,
  pinned: view.pinned,
  createdAt: view.createdAt.toISOString(),
  updatedAt: view.updatedAt.toISOString(),
});

export { normalizeAdminSavedViewFilters, normalizeAdminSavedViewRoute };

export async function listAdminSavedViews(input: {
  actor: AdminSavedViewActor;
  route?: string | null;
}) {
  const route = normalizeAdminSavedViewRoute(input.route);
  const views = await prisma.adminSavedView.findMany({
    where: {
      ownerId: input.actor.id,
      ...(route ? { route } : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: route ? 16 : 32,
  });

  return views.map(serializeSavedView);
}

export async function createAdminSavedView(input: {
  actor: AdminSavedViewActor;
  route: string;
  label: string;
  filters?: Record<string, string>;
  storefrontScope?: string | null;
  pinned?: boolean;
}) {
  const route = normalizeAdminSavedViewRoute(input.route);
  if (!route) {
    throw new Error("Saved view route must be an admin route.");
  }
  const label = input.label.trim();
  if (!label) {
    throw new Error("Saved view label is required.");
  }

  const view = await prisma.adminSavedView.create({
    data: {
      ownerId: input.actor.id,
      ownerEmail: input.actor.email,
      route,
      label: label.slice(0, 80),
      filters: (input.filters ?? {}) as Prisma.InputJsonValue,
      storefrontScope: input.storefrontScope?.trim() || null,
      pinned: Boolean(input.pinned),
    },
  });

  return serializeSavedView(view);
}

export async function updateAdminSavedView(input: {
  actor: AdminSavedViewActor;
  id: string;
  label?: string;
  pinned?: boolean;
}) {
  const existing = await prisma.adminSavedView.findFirst({
    where: { id: input.id, ownerId: input.actor.id },
  });
  if (!existing) {
    throw new Error("Saved view not found.");
  }

  const view = await prisma.adminSavedView.update({
    where: { id: input.id },
    data: {
      ...(typeof input.label === "string"
        ? { label: input.label.trim().slice(0, 80) || existing.label }
        : {}),
      ...(typeof input.pinned === "boolean" ? { pinned: input.pinned } : {}),
    },
  });

  return serializeSavedView(view);
}

export async function deleteAdminSavedView(input: {
  actor: AdminSavedViewActor;
  id: string;
}) {
  const existing = await prisma.adminSavedView.findFirst({
    where: { id: input.id, ownerId: input.actor.id },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Saved view not found.");
  }

  await prisma.adminSavedView.delete({ where: { id: input.id } });
}
