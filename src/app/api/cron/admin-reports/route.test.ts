import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isCronRequestAuthorized: vi.fn(),
  runAutomationJobNow: vi.fn(),
}));

vi.mock("@/lib/cronAuth", () => ({
  isCronRequestAuthorized: mocks.isCronRequestAuthorized,
}));

vi.mock("@/lib/automationQueue", () => ({
  runAutomationJobNow: mocks.runAutomationJobNow,
}));

import { GET } from "./route";

describe("GET /api/cron/admin-reports", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("rejects unauthorized cron requests", async () => {
    mocks.isCronRequestAuthorized.mockReturnValue(false);

    const response = await GET(
      new Request("https://www.smokeify.de/api/cron/admin-reports", {
        headers: { "x-cron-secret": "wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.runAutomationJobNow).not.toHaveBeenCalled();
  });

  it("dispatches the admin report delivery automation for authorized requests", async () => {
    mocks.isCronRequestAuthorized.mockReturnValue(true);
    mocks.runAutomationJobNow.mockResolvedValue({
      job: { id: "job_1", status: "COMPLETED" },
      result: { data: { processed: 3, sent: 2, failed: 1 } },
      error: null,
    });

    const response = await GET(
      new Request("https://www.smokeify.de/api/cron/admin-reports", {
        headers: { "x-cron-secret": "test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.runAutomationJobNow).toHaveBeenCalledWith(
      expect.objectContaining({
        handler: "admin.report.delivery",
        scheduleKey: "admin-report-delivery",
        workerId: "cron-admin-report-delivery",
      }),
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        ok: true,
        processed: 3,
        sent: 2,
        failed: 1,
      }),
    );
  });
});
