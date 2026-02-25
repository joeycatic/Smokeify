import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/newsletterToken";

const html = (title: string, message: string, isError = false) => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} – Smokeify</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f6f5f2;
      font-family: Arial, Helvetica, sans-serif;
      color: #1a2a22;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 14px;
      overflow: hidden;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    }
    .bar { height: 4px; background: #E4C56C; }
    .header {
      background: #2f3e36;
      padding: 28px 32px;
    }
    .header-brand {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #E4C56C;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.25;
    }
    .body {
      padding: 28px 32px;
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 16px;
      background: ${isError ? "#fee2e2" : "#dcfce7"};
    }
    p { font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 20px; }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background: #2f3e36;
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
    }
    .footer {
      padding: 16px 32px;
      border-top: 1px solid #f3f4f6;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="header">
      <div class="header-brand">Smokeify</div>
      <div class="header-title">${title}</div>
    </div>
    <div class="body">
      <div class="icon">${isError ? "✕" : "✓"}</div>
      <p>${message}</p>
      <a href="/" class="btn">Zurück zum Shop</a>
    </div>
    <div class="footer">© ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten</div>
  </div>
</body>
</html>`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = searchParams.get("token") ?? "";

  if (!email || !token) {
    return new NextResponse(
      html("Ungültiger Link", "Der Abmeldelink ist ungültig oder unvollständig.", true),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return new NextResponse(
      html("Ungültiger Link", "Der Abmeldelink ist ungültig oder abgelaufen.", true),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  await Promise.all([
    prisma.newsletterSubscriber.updateMany({
      where: { email },
      data: { unsubscribedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { email },
      data: { newsletterOptIn: false, newsletterOptInAt: null },
    }),
  ]);

  return new NextResponse(
    html(
      "Abgemeldet",
      "Du wurdest erfolgreich vom Smokeify-Newsletter abgemeldet. Du erhältst keine weiteren Marketing-E-Mails von uns."
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
