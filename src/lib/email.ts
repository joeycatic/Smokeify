import nodemailer from "nodemailer";
import { sendResendEmail } from "@/lib/resend";
import {
  getStorefrontEmailBrand,
  type StorefrontEmailBrandMeta,
} from "@/lib/storefrontEmailBrand";
import { type StorefrontCode } from "@/lib/storefronts";

type SendCodeInput = {
  email: string;
  code: string;
  purpose: "SIGNUP" | "NEW_DEVICE" | "PASSWORD_RESET";
  actionUrl?: string | null;
  storefront?: StorefrontCode | null;
};

const purposeMeta = (
  purpose: SendCodeInput["purpose"],
  brand: StorefrontEmailBrandMeta
) => {
  if (purpose === "SIGNUP") {
    return {
      subject: `Dein ${brand.brandName} Bestätigungscode`,
      title: "Account bestätigen",
      subtitle: "Bitte bestätige deine E-Mail-Adresse.",
      codeLabel: "Dein Bestätigungscode",
      bodyNote: null,
    };
  }
  if (purpose === "NEW_DEVICE") {
    return {
      subject: `Neues Gerät erkannt – ${brand.brandName}`,
      title: "Neues Gerät",
      subtitle: "Wir haben eine Anmeldung von einem neuen Gerät erkannt.",
      codeLabel: "Dein Verifizierungscode",
      bodyNote:
        "Falls du dich nicht angemeldet hast, ändere bitte sofort dein Passwort.",
    };
  }
  return {
    subject: `Passwort zurücksetzen – ${brand.brandName}`,
    title: "Passwort zurücksetzen",
    subtitle: "Du hast einen Passwort-Reset angefragt.",
    codeLabel: "Dein Reset-Code",
    bodyNote:
      "Falls du keinen Reset angefragt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.",
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDisplayUrl = (value: string) =>
  escapeHtml(value)
    .replaceAll("://", "://<wbr>")
    .replaceAll("/", "/<wbr>")
    .replaceAll("?", "?<wbr>")
    .replaceAll("&amp;", "&amp;<wbr>")
    .replaceAll("=", "=<wbr>")
    .replaceAll("-", "-<wbr>");

export async function sendVerificationCodeEmail({
  email,
  code,
  purpose,
  actionUrl,
  storefront,
}: SendCodeInput) {
  const brand = getStorefrontEmailBrand(storefront ?? "MAIN");
  const meta = purposeMeta(purpose, brand);
  const resolvedActionUrl =
    purpose === "PASSWORD_RESET" && actionUrl?.trim() ? actionUrl.trim() : null;
  const escapedActionUrl = resolvedActionUrl ? escapeHtml(resolvedActionUrl) : null;
  const formattedActionUrl = resolvedActionUrl ? formatDisplayUrl(resolvedActionUrl) : null;

  const text = [
    meta.codeLabel + ":",
    code,
    "",
    resolvedActionUrl ? `Direktlink: ${resolvedActionUrl}` : "",
    "Dieser Code ist 10 Minuten gültig.",
    meta.bodyNote ?? "",
  ]
    .filter((l) => l !== null)
    .join("\n")
    .trim();

  const noteHtml = meta.bodyNote
    ? `<div style="margin-top:24px;padding:14px 16px;background:${brand.noticeBackgroundColor};border:1px solid ${brand.noticeBorderColor};border-left:3px solid ${brand.noticeBorderColor};border-radius:0 12px 12px 0;font-size:13px;color:${brand.textColor};line-height:1.6;">${escapeHtml(meta.bodyNote)}</div>`
    : "";
  const actionHtml = escapedActionUrl
    ? `<div style="margin:28px 0 18px;text-align:center;">
        <a href="${escapedActionUrl}" style="display:inline-block;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:700;border:1px solid ${brand.noticeBorderColor};">
          Passwort direkt zurücksetzen
        </a>
      </div>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:${brand.mutedTextColor};text-align:center;">
        Der Link öffnet die Reset-Seite bereits mit deiner E-Mail-Adresse und dem Code.
      </p>
      <div style="margin:0 0 18px;padding:14px 16px;background:${brand.panelBackgroundColor};border:1px solid ${brand.panelBorderColor};border-radius:12px;text-align:left;">
        <div style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${brand.subtleTextColor};">
          Direktlink
        </div>
        <a href="${escapedActionUrl}" style="display:inline-block;max-width:100%;font-size:11px;line-height:1.8;color:${brand.textColor};text-decoration:underline;word-break:break-all;">${formattedActionUrl}</a>
      </div>`
    : "";

  const html = `
<div style="background:${brand.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:${brand.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">

          <!-- Gold accent bar -->
          <tr>
            <td height="4" style="background-color:${brand.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:${brand.heroBackground};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${brand.heroLabelColor};margin-bottom:16px;">${escapeHtml(brand.brandName)}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">${escapeHtml(meta.title)}</div>
              <div style="font-size:14px;color:${brand.heroMutedTextColor};">${escapeHtml(meta.subtitle)}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:${brand.cardBackgroundColor};padding:36px 32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">

              <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${brand.mutedTextColor};margin-bottom:20px;">${escapeHtml(meta.codeLabel)}</div>

              <!-- Code display -->
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;background:${brand.panelBackgroundColor};border:2px solid ${brand.panelBorderColor};border-radius:12px;padding:22px 40px;">
                  <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:${brand.emphasisColor};font-family:monospace;">${escapeHtml(code)}</div>
                </div>
              </div>

              <p style="margin:0;font-size:14px;color:${brand.mutedTextColor};text-align:center;">
                Dieser Code ist <strong style="color:${brand.textColor};">10 Minuten</strong> gültig.
              </p>

              ${actionHtml}

              ${noteHtml}

            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid ${brand.cardBorderColor};text-align:center;">
              <div style="font-size:12px;color:${brand.footerTextColor};">
                © ${new Date().getFullYear()} ${escapeHtml(brand.brandName)} &nbsp;·&nbsp; Alle Rechte vorbehalten
              </div>
              <div style="margin-top:8px;font-size:11px;color:${brand.footerMutedTextColor};">
                ${escapeHtml(brand.footerDescription)}
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</div>`;

  if (process.env.RESEND_API_KEY) {
    await sendResendEmail({ to: email, subject: meta.subject, html, text });
    return;
  }

  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("Email server is not configured");
  }

  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({ to: email, from, subject: meta.subject, text, html });
}
