import nodemailer from "nodemailer";
import { sendResendEmail } from "@/lib/resend";

type SendCodeInput = {
  email: string;
  code: string;
  purpose: "SIGNUP" | "NEW_DEVICE" | "PASSWORD_RESET";
};

const purposeMeta = (purpose: SendCodeInput["purpose"]) => {
  if (purpose === "SIGNUP") {
    return {
      subject: "Dein Smokeify Bestätigungscode",
      title: "Account bestätigen",
      subtitle: "Bitte bestätige deine E-Mail-Adresse.",
      codeLabel: "Dein Bestätigungscode",
      bodyNote: null,
    };
  }
  if (purpose === "NEW_DEVICE") {
    return {
      subject: "Neues Gerät erkannt – Smokeify",
      title: "Neues Gerät",
      subtitle: "Wir haben eine Anmeldung von einem neuen Gerät erkannt.",
      codeLabel: "Dein Verifizierungscode",
      bodyNote:
        "Falls du dich nicht angemeldet hast, ändere bitte sofort dein Passwort.",
    };
  }
  return {
    subject: "Passwort zurücksetzen – Smokeify",
    title: "Passwort zurücksetzen",
    subtitle: "Du hast einen Passwort-Reset angefragt.",
    codeLabel: "Dein Reset-Code",
    bodyNote:
      "Falls du keinen Reset angefragt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.",
  };
};

export async function sendVerificationCodeEmail({
  email,
  code,
  purpose,
}: SendCodeInput) {
  const meta = purposeMeta(purpose);

  const text = [
    meta.codeLabel + ":",
    code,
    "",
    "Dieser Code ist 10 Minuten gültig.",
    meta.bodyNote ?? "",
  ]
    .filter((l) => l !== null)
    .join("\n")
    .trim();

  const noteHtml = meta.bodyNote
    ? `<div style="margin-top:24px;padding:14px 16px;background:#fef3c7;border-left:3px solid #d97706;border-radius:0 8px 8px 0;font-size:13px;color:#92400e;line-height:1.5;">${meta.bodyNote}</div>`
    : "";

  const html = `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1a2a22;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">

          <!-- Gold accent bar -->
          <tr>
            <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color:#2f3e36;padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">${meta.title}</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.65);">${meta.subtitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">

              <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:20px;">${meta.codeLabel}</div>

              <!-- Code display -->
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:22px 40px;">
                  <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#2f3e36;font-family:monospace;">${code}</div>
                </div>
              </div>

              <p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">
                Dieser Code ist <strong style="color:#1a2a22;">10 Minuten</strong> gültig.
              </p>

              ${noteHtml}

            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten
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
