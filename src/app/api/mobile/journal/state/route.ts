import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parseMobileToken } from "@/lib/mobileToken";
import { prisma } from "@/lib/prisma";

const JOURNAL_SETUP_NAME = "mobile-journal-state";

type JournalSnapshot = {
  tents: Array<Record<string, unknown>>;
  plants: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
};

type StoredJournalPayload = {
  revision: number;
  state: JournalSnapshot;
  updatedAt: string;
  lastOpId?: string;
};

const emptyState: JournalSnapshot = {
  tents: [],
  plants: [],
  entries: [],
};

const readStoredPayload = (value: unknown): StoredJournalPayload => {
  if (!value || typeof value !== "object") {
    return { revision: 0, state: emptyState, updatedAt: new Date(0).toISOString() };
  }
  const raw = value as Partial<StoredJournalPayload>;
  const state = raw.state && typeof raw.state === "object" ? raw.state : emptyState;
  return {
    revision: Number.isFinite(raw.revision) ? Number(raw.revision) : 0,
    state: {
      tents: Array.isArray((state as JournalSnapshot).tents) ? (state as JournalSnapshot).tents : [],
      plants: Array.isArray((state as JournalSnapshot).plants) ? (state as JournalSnapshot).plants : [],
      entries: Array.isArray((state as JournalSnapshot).entries) ? (state as JournalSnapshot).entries : [],
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
    lastOpId: typeof raw.lastOpId === "string" ? raw.lastOpId : undefined,
  };
};

export async function GET(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.savedSetup.findFirst({
    where: { userId: payload.sub, name: JOURNAL_SETUP_NAME },
    select: { data: true, updatedAt: true },
  });

  if (!row) {
    return NextResponse.json({
      revision: 0,
      state: emptyState,
      updatedAt: new Date(0).toISOString(),
    });
  }

  const stored = readStoredPayload(row.data);
  return NextResponse.json({
    revision: stored.revision,
    state: stored.state,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PUT(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    state?: JournalSnapshot;
    baseRevision?: number;
    opId?: string;
  };

  const state = body.state;
  if (!state || !Array.isArray(state.tents) || !Array.isArray(state.plants) || !Array.isArray(state.entries)) {
    return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const baseRevision =
    typeof body.baseRevision === "number" && Number.isFinite(body.baseRevision) ? Math.max(0, Math.floor(body.baseRevision)) : 0;
  const opId = typeof body.opId === "string" && body.opId.trim() ? body.opId.trim() : undefined;

  const current = await prisma.savedSetup.findFirst({
    where: { userId: payload.sub, name: JOURNAL_SETUP_NAME },
    select: { id: true, data: true, updatedAt: true },
  });
  const currentPayload = readStoredPayload(current?.data);

  if (opId && currentPayload.lastOpId === opId) {
    return NextResponse.json({
      ok: true,
      revision: currentPayload.revision,
      updatedAt: current?.updatedAt.toISOString() ?? new Date().toISOString(),
      deduped: true,
    });
  }

  if (baseRevision !== currentPayload.revision) {
    return NextResponse.json(
      {
        error: "Conflict",
        revision: currentPayload.revision,
        state: currentPayload.state,
        updatedAt: current?.updatedAt.toISOString() ?? new Date().toISOString(),
      },
      { status: 409 },
    );
  }

  const nextPayload: StoredJournalPayload = {
    revision: currentPayload.revision + 1,
    state,
    updatedAt: new Date().toISOString(),
    ...(opId ? { lastOpId: opId } : {}),
  };

  const written = current
    ? await prisma.savedSetup.update({
        where: { id: current.id },
        data: { data: nextPayload as unknown as Prisma.InputJsonValue },
        select: { updatedAt: true },
      })
    : await prisma.savedSetup.create({
        data: {
          userId: payload.sub,
          name: JOURNAL_SETUP_NAME,
          data: nextPayload as unknown as Prisma.InputJsonValue,
        },
        select: { updatedAt: true },
      });

  return NextResponse.json({
    ok: true,
    revision: nextPayload.revision,
    updatedAt: written.updatedAt.toISOString(),
  });
}
