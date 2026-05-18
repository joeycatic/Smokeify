import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const isMissingNewsletterOfferColumnError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes(`column "newsletterOfferClaimedAt" does not exist`) ||
    error.message.includes(`column "newsletterOfferClaimedEmail" does not exist`));

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      eligible: true,
      claimed: false,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  const claimRows = user
    ? await prisma
        .$queryRaw<
          Array<{
            newsletterOfferClaimedAt: Date | null;
            newsletterOfferClaimedEmail: string | null;
          }>
        >`
          SELECT
            "newsletterOfferClaimedAt",
            "newsletterOfferClaimedEmail"
          FROM "User"
          WHERE id = ${userId}
          LIMIT 1
        `
        .catch((error) => {
          if (isMissingNewsletterOfferColumnError(error)) {
            return [];
          }
          throw error;
        })
    : [];

  const claim = claimRows[0] ?? {
    newsletterOfferClaimedAt: null,
    newsletterOfferClaimedEmail: null,
  };

  const claimed = Boolean(claim.newsletterOfferClaimedAt);
  return NextResponse.json({
    authenticated: true,
    eligible: !claimed,
    claimed,
    claimedEmail: claim.newsletterOfferClaimedEmail,
  });
}
