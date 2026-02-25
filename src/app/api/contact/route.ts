import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `contact:ip:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    message?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim();
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  const to = process.env.CONTACT_EMAIL?.trim() || "joey@smokeify.de";

  if (!server || !from || !to) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport(server);
    await transporter.sendMail({
      to,
      from,
      replyTo: email,
      subject: `Kontaktanfrage: ${escapeHtml(name)}`,
      text: `Von: ${name} <${email}>\n\n${message}`,
      html: `
<div style="background:#f6f5f2;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr><td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background-color:#2f3e36;padding:24px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:10px;">Smokeify</div>
              <div style="font-size:20px;font-weight:700;color:#ffffff;">Neue Kontaktanfrage</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:28px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <div style="margin-bottom:16px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">Von</div>
                <div style="font-size:15px;font-weight:600;color:#1a2a22;">${escapeHtml(name)}</div>
                <div style="font-size:14px;color:#6b7280;">${escapeHtml(email)}</div>
              </div>
              <div style="height:1px;background:#f3f4f6;margin:16px 0;"></div>
              <div>
                <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;">Nachricht</div>
                <div style="font-size:14px;color:#1a2a22;white-space:pre-wrap;line-height:1.7;">${escapeHtml(message).replace(/\n/g, "<br />")}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`,
    });
  } catch (err) {
    console.error("[contact] sendMail failed:", err);
    return NextResponse.json(
      { error: "Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
