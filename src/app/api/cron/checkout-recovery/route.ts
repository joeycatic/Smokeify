import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";
import {
  CHECKOUT_RECOVERY_SCHEDULE_KEY,
  getCheckoutRecoveryScheduleSnapshot,
} from "@/lib/checkoutRecoveryService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required." },
      { status: 500 },
    );
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  if (
    !isCronRequestAuthorized({
      authorizationHeader: authHeader,
      headerSecret,
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedule = await getCheckoutRecoveryScheduleSnapshot();
  if (schedule.status === "PAUSED") {
    return NextResponse.json({
      ok: true,
      paused: true,
      schedule: schedule.key,
      message: "Checkout recovery schedule is paused.",
    });
  }

  try {
    const automation = await runAutomationJobNow({
      handler: "checkout.recovery.run",
      scheduleKey: CHECKOUT_RECOVERY_SCHEDULE_KEY,
      payload: {
        bypassPaused: false,
      },
      dedupeKey: `checkout-recovery::${new Date().toISOString().slice(0, 16)}`,
      workerId: "cron-checkout-recovery",
      actor: {
        id: "automation",
        email: "automation@smokeify.local",
      },
    });
    if (!automation.result) {
      return NextResponse.json(
        {
          error: automation.error ?? "Checkout recovery run failed.",
          job: automation.job,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: automation.job,
      ...automation.result.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Checkout recovery run failed.",
      },
      { status: 500 },
    );
  }
}
