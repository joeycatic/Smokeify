import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";

export const runtime = "nodejs";

export const POST = withAdminRoute(async () =>
  adminJson(
    { error: "Stripe webhook reprocessing is disabled after the Viva migration." },
    { status: 410 },
  ),
);
