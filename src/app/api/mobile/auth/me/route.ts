import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMobileToken } from "@/lib/mobileToken";

export async function GET(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName,
    },
  });
}
