import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `newsletter:ip:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const email = body.email?.trim() ?? "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Bitte eine gültige E-Mail angeben." },
      { status: 400 }
    );
  }

  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  const to = process.env.CONTACT_EMAIL?.trim() || "joey@smokeify.de";

  if (!server || !from || !to) {
    return NextResponse.json(
      { error: "Newsletter ist aktuell nicht verfügbar." },
      { status: 500 }
    );
  }

  const normalizedEmail = email.toLowerCase();
  const emailLimit = await checkRateLimit({
    key: `newsletter:email:${normalizedEmail}`,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Diese E-Mail wurde kürzlich angemeldet." },
      { status: 429 }
    );
  }
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { newsletterOptIn: true, newsletterOptInAt: new Date() },
      });
    }

    await tx.newsletterSubscriber.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        userId: existingUser?.id ?? null,
        subscribedAt: new Date(),
      },
      update: {
        userId: existingUser?.id ?? null,
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });
  });

  // DB subscription already committed — don't fail the user response if the
  // admin notification email fails. Log it and continue.
  try {
    const transporter = nodemailer.createTransport(server);
    await transporter.sendMail({
      to,
      from,
      subject: "Newsletter Anmeldung",
      text: `Neue Newsletter-Anmeldung: ${normalizedEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p><strong>Neue Newsletter-Anmeldung</strong></p>
          <p>${escapeHtml(normalizedEmail)}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[newsletter] admin notification email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
