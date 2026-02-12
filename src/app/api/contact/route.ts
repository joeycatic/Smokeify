import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

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

  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({
    to,
    from,
    replyTo: email,
    subject: `Contact form - ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p>${message.replace(/\n/g, "<br />")}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
