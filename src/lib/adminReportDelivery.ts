import type { AdminReportDeliveryFrequency } from "@prisma/client";

export function parseAdminReportDeliveryFrequency(
  value: string | null | undefined
): AdminReportDeliveryFrequency | null {
  return value === "DAILY" || value === "WEEKLY" ? value : null;
}

export function parseAdminReportDeliveryWeekday(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : null;
}

export function parseAdminReportDeliveryHour(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

export function computeNextAdminReportDelivery({
  frequency,
  hour,
  weekday,
  from = new Date(),
}: {
  frequency: AdminReportDeliveryFrequency;
  hour: number;
  weekday?: number | null;
  from?: Date;
}) {
  const base = new Date(from);
  const candidate = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hour,
      0,
      0,
      0
    )
  );

  if (frequency === "DAILY") {
    if (candidate <= from) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
  }

  const normalizedWeekday = weekday ?? 1;
  const dayOffset =
    (normalizedWeekday - candidate.getUTCDay() + 7) % 7 ||
    (candidate <= from ? 7 : 0);
  candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
  if (candidate <= from) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate;
}

export function formatAdminReportDeliveryLabel({
  enabled,
  frequency,
  email,
  weekday,
  hour,
}: {
  enabled: boolean;
  frequency: AdminReportDeliveryFrequency | null;
  email: string | null;
  weekday: number | null;
  hour: number | null;
}) {
  if (!enabled || !frequency || !email || hour === null) {
    return "Not scheduled";
  }

  const weekdayLabel =
    frequency === "WEEKLY"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday ?? 1]
      : "Daily";
  return `${frequency === "DAILY" ? "Daily" : weekdayLabel} at ${String(hour).padStart(2, "0")}:00 UTC`;
}

export function buildAdminReportDeliveryEmail({
  reportName,
  reportUrl,
  currency,
  revenueCents,
  orderCount,
  averageOrderValueCents,
  customerCount,
}: {
  reportName: string;
  reportUrl: string;
  currency: string;
  revenueCents: number;
  orderCount: number;
  averageOrderValueCents: number;
  customerCount: number;
}) {
  const formatMoney = (amountCents: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);

  const subject = `Scheduled admin report: ${reportName}`;
  const text = [
    `Scheduled report: ${reportName}`,
    "",
    `Revenue: ${formatMoney(revenueCents)}`,
    `Orders: ${orderCount}`,
    `Average order value: ${formatMoney(averageOrderValueCents)}`,
    `Customers: ${customerCount}`,
    "",
    `Open report: ${reportUrl}`,
  ].join("\n");
  const html = `
    <div style="background:#08111d;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;line-height:1.6;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="padding:0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0f172a;border:1px solid rgba(148,163,184,0.16);border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:28px 28px 16px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#38bdf8;">Smokeify Admin</div>
                  <div style="margin-top:12px;font-size:28px;font-weight:700;color:#f8fafc;">${reportName}</div>
                  <div style="margin-top:8px;font-size:14px;color:#94a3b8;">Scheduled reporting snapshot delivered from the admin panel.</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 28px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0 12px;">
                    <tr>
                      <td style="padding:16px;border-radius:14px;background:#111c2f;color:#f8fafc;">Revenue<br /><strong style="font-size:20px;">${formatMoney(revenueCents)}</strong></td>
                      <td style="padding:16px;border-radius:14px;background:#111c2f;color:#f8fafc;">Orders<br /><strong style="font-size:20px;">${orderCount}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding:16px;border-radius:14px;background:#111c2f;color:#f8fafc;">AOV<br /><strong style="font-size:20px;">${formatMoney(averageOrderValueCents)}</strong></td>
                      <td style="padding:16px;border-radius:14px;background:#111c2f;color:#f8fafc;">Customers<br /><strong style="font-size:20px;">${customerCount}</strong></td>
                    </tr>
                  </table>
                  <div style="margin-top:20px;text-align:center;">
                    <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#38bdf8;color:#082f49;text-decoration:none;font-size:14px;font-weight:700;">Open report</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, text, html };
}
