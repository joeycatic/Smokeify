import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { generateVerificationCode, hashToken } from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";
import { checkRateLimit, getClientIp, LOGIN_RATE_LIMIT } from "@/lib/rateLimit";

const providers: NextAuthOptions["providers"] = [];

providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      const identifier = credentials?.email?.trim() ?? "";
      const identifierLower = identifier.toLowerCase();
      const password = credentials?.password ?? "";
      if (!identifier || !password) return null;

      const ip = getClientIp(req?.headers ?? new Headers());
      const ipLimit = await checkRateLimit({
        key: `login:ip:${ip}`,
        limit: LOGIN_RATE_LIMIT.ipLimit,
        windowMs: LOGIN_RATE_LIMIT.windowMs,
      });
      if (!ipLimit.allowed) {
        throw new Error("RATE_LIMIT");
      }

      const loginLimit = await checkRateLimit({
        key: `login:identifier:${identifierLower}`,
        limit: LOGIN_RATE_LIMIT.identifierLimit,
        windowMs: LOGIN_RATE_LIMIT.windowMs,
      });
      if (!loginLimit.allowed) {
        throw new Error("RATE_LIMIT");
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifierLower, mode: "insensitive" } },
            { name: { equals: identifier, mode: "insensitive" } },
          ],
        },
      });
      if (!user || !user.passwordHash || !user.email) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      if (!user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      const cookieStore = await cookies();
      const deviceToken = cookieStore.get("smokeify_device")?.value;
      if (deviceToken) {
        const tokenHash = hashToken(deviceToken);
        const device = await prisma.device.findUnique({
          where: {
            userId_tokenHash: {
              userId: user.id,
              tokenHash,
            },
          },
        });
        if (device) {
          await prisma.device.update({
            where: { id: device.id },
            data: { lastSeenAt: new Date() },
          });
          return user;
        }
      }

      const code = generateVerificationCode();
      const codeHash = hashToken(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.verificationCode.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash,
          purpose: "NEW_DEVICE",
          expiresAt,
        },
      });

      await sendVerificationCodeEmail({
        email: user.email,
        code,
        purpose: "NEW_DEVICE",
      });

      throw new Error("NEW_DEVICE");
    },
  })
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        return token;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "USER";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as "USER" | "ADMIN" | "STAFF") ?? "USER";
      }
      return session;
    },
  },
};
