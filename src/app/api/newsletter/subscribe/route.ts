import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
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
  const to = process.env.CONTACT_EMAIL?.trim() || "contact@smokeify.de";

  if (!server || !from || !to) {
    return NextResponse.json(
      { error: "Newsletter ist aktuell nicht verfügbar." },
      { status: 500 }
    );
  }

  const normalizedEmail = email.toLowerCase();
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

  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({
    to,
    from,
    replyTo: email,
    subject: "Newsletter Anmeldung",
    text: `Neue Newsletter-Anmeldung: ${normalizedEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p><strong>Neue Newsletter-Anmeldung</strong></p>
        <p>${normalizedEmail}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
