import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const parseRating = (value: unknown) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return null;
  const rounded = Math.round(rating);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
};

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  const [reviews, summary, userReview] = await Promise.all([
    prisma.review.findMany({
      where: { productId: id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
    prisma.review.aggregate({
      where: { productId: id, status: "APPROVED" },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    session?.user?.id
      ? prisma.review.findUnique({
          where: {
            productId_userId: { productId: id, userId: session.user.id },
          },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
      userName: review.guestName ?? review.user?.name ?? "Anonym",
    })),
    summary: {
      average: summary._avg.rating ?? 0,
      count: summary._count.rating ?? 0,
    },
    userReview: userReview
      ? {
          id: userReview.id,
          rating: userReview.rating,
          title: userReview.title,
          body: userReview.body,
          createdAt: userReview.createdAt.toISOString(),
        }
      : null,
    canReview: true,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `reviews:ip:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    rating?: number;
    title?: string;
    body?: string;
    name?: string;
  };

  const rating = parseRating(body.rating);
  const title = normalizeText(body.title);
  const content = normalizeText(body.body);
  const guestName = normalizeText(body.name).slice(0, 64) || null;

  if (!rating) {
    return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen." }, { status: 400 });
  }
  if (content.length < 10) {
    return NextResponse.json(
      { error: "Bewertungstext ist zu kurz (mindestens 10 Zeichen)." },
      { status: 400 }
    );
  }

  // Prevent duplicate reviews for logged-in users
  if (userId) {
    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: id, userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Du hast dieses Produkt bereits bewertet." }, { status: 409 });
    }
  }

  const created = await prisma.review.create({
    data: {
      productId: id,
      userId,
      guestName,
      rating,
      title: title || null,
      body: content,
      status: "APPROVED",
    },
  });

  return NextResponse.json({
    review: {
      id: created.id,
      rating: created.rating,
      title: created.title,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `reviews:patch:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: id, userId: session.user.id } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    rating?: number;
    title?: string;
    body?: string;
  };
  const rating = typeof body.rating === "undefined" ? null : parseRating(body.rating);
  const title = normalizeText(body.title);
  const content = normalizeText(body.body);

  if (rating === null && !title && !content) {
    return NextResponse.json({ error: "Keine Änderungen angegeben." }, { status: 400 });
  }
  if (rating === null && typeof body.rating !== "undefined") {
    return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen." }, { status: 400 });
  }
  if (content && content.length < 10) {
    return NextResponse.json(
      { error: "Bewertungstext ist zu kurz (mindestens 10 Zeichen)." },
      { status: 400 }
    );
  }

  const updated = await prisma.review.update({
    where: { id: existing.id },
    data: {
      rating: rating ?? existing.rating,
      title: title || null,
      body: content || existing.body,
    },
  });

  return NextResponse.json({
    review: {
      id: updated.id,
      rating: updated.rating,
      title: updated.title,
      body: updated.body,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
