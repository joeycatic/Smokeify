import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createSmokeifyDiscordLinkToken,
  isValidDiscordUserId,
  normalizeDiscordLinkChallenge,
} from "@/lib/discordLinkToken";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

type DiscordLinkRequestBody = {
  discordUserId?: unknown;
  challenge?: unknown;
};

const formatDiscordDisplayName = ({
  firstName,
  lastName,
  name,
}: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}) => {
  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  if (fullName) {
    return fullName;
  }

  const username = name?.trim();
  return username || undefined;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `account-discord-link:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userLimit = await checkRateLimit({
    key: `account-discord-link:user:${session.user.id}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!userLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as DiscordLinkRequestBody | null;
  if (!body) {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 },
    );
  }

  const discordUserId =
    typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
  if (!isValidDiscordUserId(discordUserId)) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige Discord User ID ein." },
      { status: 400 },
    );
  }

  const normalizedChallenge =
    typeof body.challenge === "string"
      ? normalizeDiscordLinkChallenge(body.challenge)
      : null;
  if (!normalizedChallenge) {
    return NextResponse.json(
      { error: "Der Challenge-Code muss das Format ABCD-EFGH haben." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Konto nicht gefunden." },
      { status: 404 },
    );
  }

  try {
    const { token, payload } = createSmokeifyDiscordLinkToken({
      discordUserId,
      challenge: normalizedChallenge,
      customerId: user.id,
      customerRef: user.name,
      displayName: formatDiscordDisplayName(user),
    });

    return NextResponse.json({
      token,
      instruction:
        "Kopiere dieses Token und führe in Discord `/account connect provider:Smokeify token:<token>` aus, bevor es abläuft.",
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SMOKEIFY_LINK_TOKEN_SECRET is not configured"
    ) {
      return NextResponse.json(
        { error: "Discord-Linking ist aktuell nicht verfügbar." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Der Link konnte nicht erstellt werden." },
      { status: 400 },
    );
  }
}
