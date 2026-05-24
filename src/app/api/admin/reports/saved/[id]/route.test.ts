import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  isSameOrigin: vi.fn(),
  logAdminAction: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/adminCatalog", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/requestSecurity", () => ({
  isSameOrigin: mocks.isSameOrigin,
}));

vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: mocks.logAdminAction,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSavedReport: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

import { PATCH } from "./route";

const session = {
  user: {
    id: "admin_123",
    email: "admin@smokeify.com",
    role: "ADMIN",
  },
};

const buildRequest = (body: unknown) =>
  new NextRequest("https://www.smokeify.de/api/admin/reports/saved/report_1", {
    method: "PATCH",
    headers: {
      origin: "https://www.smokeify.de",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/reports/saved/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOrigin.mockReturnValue(true);
    mocks.requireAdmin.mockResolvedValue(session);
    mocks.findUnique.mockResolvedValue({
      id: "report_1",
      name: "Weekly finance",
      deliveryEmail: "legacy@smokeify.com",
    });
  });

  it("rejects invalid delivery recipients", async () => {
    const response = await PATCH(buildRequest({
      deliveryEnabled: true,
      deliveryRecipients: ["ops@smokeify.com", "not-an-email"],
      deliveryFrequency: "DAILY",
      deliveryHour: 8,
    }), {
      params: Promise.resolve({ id: "report_1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid delivery recipient: not-an-email",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("normalizes recipients before persisting the schedule", async () => {
    mocks.update.mockResolvedValue({
      id: "report_1",
      name: "Weekly finance",
    });

    const response = await PATCH(buildRequest({
      deliveryEnabled: true,
      deliveryRecipients: [
        " Ops@Smokeify.com ",
        "finance@smokeify.com",
        "ops@smokeify.com",
      ],
      deliveryFrequency: "WEEKLY",
      deliveryWeekday: 1,
      deliveryHour: 8,
    }), {
      params: Promise.resolve({ id: "report_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "report_1" },
        data: expect.objectContaining({
          deliveryEnabled: true,
          deliveryEmail: "ops@smokeify.com",
          deliveryRecipients: ["ops@smokeify.com", "finance@smokeify.com"],
          deliveryFrequency: "WEEKLY",
          deliveryWeekday: 1,
          deliveryHour: 8,
        }),
      }),
    );
    expect(mocks.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_report.schedule_updated",
        targetId: "report_1",
      }),
    );
  });
});
