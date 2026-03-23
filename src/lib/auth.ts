import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  decryptSensitiveValue,
  generateVerificationCode,
  hashToken,
  normalizeTotpCode,
  verifyTotpCode,
} from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";
import {
  checkRateLimit,
  getClientIp,
  LOGIN_RATE_LIMIT,
} from "@/lib/rateLimit";

const providers: NextAuthOptions["providers"] = [];
const VERIFY_LOGIN_COOKIE = "smokeify_verify_login";
const FALLBACK_PASSWORD_HASH = bcrypt.hashSync("smokeify-admin-fallback", 10);

function extractAdminTotpCode(credentials: Record<string, unknown> | undefined) {
  const candidates = [
    credentials?.totpCode,
    credentials?.authenticatorCode,
    credentials?.otp,
    credentials?.code,
    credentials?.token,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeTotpCode(candidate);
    }
  }

  return "";
}

providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      adminIntent: { label: "Admin Intent", type: "text" },
      totpCode: { label: "TOTP Code", type: "text" },
    },
    async authorize(credentials, req) {
      const identifier = credentials?.email?.trim() ?? "";
      const identifierLower = identifier.toLowerCase();
      const password = credentials?.password ?? "";
      const adminIntent = credentials?.adminIntent === "1";
      const totpCode = extractAdminTotpCode(credentials);
      if (!identifier) return null;

      if (!adminIntent) {
        const ip = getClientIp(req?.headers ?? new Headers());
        const rateLimitPrefix = "login";
        const ipLimit = await checkRateLimit({
          key: `${rateLimitPrefix}:ip:${ip}`,
          limit: LOGIN_RATE_LIMIT.ipLimit,
          windowMs: LOGIN_RATE_LIMIT.windowMs,
        });
        if (!ipLimit.allowed) {
          throw new Error("RATE_LIMIT");
        }

        const loginLimit = await checkRateLimit({
          key: `${rateLimitPrefix}:identifier:${identifierLower}`,
          limit: LOGIN_RATE_LIMIT.identifierLimit,
          windowMs: LOGIN_RATE_LIMIT.windowMs,
        });
        if (!loginLimit.allowed) {
          throw new Error("RATE_LIMIT");
        }
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifierLower, mode: "insensitive" } },
            { name: { equals: identifier, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          passwordHash: true,
          emailVerified: true,
          role: true,
          authVersion: true,
          adminTotpSecretEncrypted: true,
          adminTotpEnabledAt: true,
        },
      });

      if (adminIntent) {
        if (!password) {
          return null;
        }

        const passwordHash = user?.passwordHash ?? FALLBACK_PASSWORD_HASH;
        const valid = await bcrypt.compare(password, passwordHash);
        if (!user || !user.email || !valid) {
          return null;
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        if (user.role !== "ADMIN") {
          throw new Error("AccessDenied");
        }

        const adminTotpEnabled = Boolean(
          user.adminTotpEnabledAt && user.adminTotpSecretEncrypted
        );
        if (adminTotpEnabled) {
          if (!totpCode) {
            throw new Error("ADMIN_MFA_REQUIRED");
          }

          const secret = decryptSensitiveValue(user.adminTotpSecretEncrypted as string);
          if (!verifyTotpCode(secret, totpCode, Date.now(), 2)) {
            throw new Error("INVALID_TOTP");
          }
        }

        return {
          ...user,
          adminVerifiedAt: Date.now(),
          adminTotpEnabled,
        };
      }

      if (!user || !user.email) return null;

      const cookieStore = await cookies();
      const verifyLoginToken = cookieStore.get(VERIFY_LOGIN_COOKIE)?.value;
      if (!password && verifyLoginToken) {
        const now = new Date();
        const tokenHash = hashToken(verifyLoginToken);
        const oneTimeLogin = await prisma.verificationCode.findFirst({
          where: {
            userId: user.id,
            email: user.email,
            codeHash: tokenHash,
            expiresAt: { gt: now },
            purpose: { in: ["SIGNUP", "NEW_DEVICE"] },
          },
          orderBy: { createdAt: "desc" },
        });
        if (oneTimeLogin) {
          await prisma.verificationCode.delete({
            where: { id: oneTimeLogin.id },
          });
          return user;
        }
      }

      if (!password || !user.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      if (!user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

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

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user?.email) {
        return true;
      }

      await prisma.user.updateMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          emailVerified: null,
        },
        data: { emailVerified: new Date() },
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(user.id) },
          select: {
            role: true,
            authVersion: true,
            adminTotpEnabledAt: true,
            adminTotpSecretEncrypted: true,
          },
        });
        if (!dbUser) {
          token.invalidated = true;
          delete token.id;
          delete token.role;
          delete token.authVersion;
          delete token.adminVerifiedAt;
          return token;
        }
        token.id = user.id;
        token.role = dbUser.role;
        token.authVersion = dbUser.authVersion;
        token.adminTotpEnabled = Boolean(
          dbUser.adminTotpEnabledAt && dbUser.adminTotpSecretEncrypted
        );
        if (dbUser.role === "ADMIN" && typeof user.adminVerifiedAt === "number") {
          token.adminVerifiedAt = user.adminVerifiedAt;
        } else {
          delete token.adminVerifiedAt;
        }
        token.invalidated = false;
        return token;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            role: true,
            authVersion: true,
            adminTotpEnabledAt: true,
            adminTotpSecretEncrypted: true,
          },
        });
        if (!dbUser) {
          token.invalidated = true;
          delete token.id;
          delete token.role;
          delete token.authVersion;
          delete token.adminVerifiedAt;
          return token;
        }
        if (
          typeof token.authVersion === "number" &&
          token.authVersion !== dbUser.authVersion
        ) {
          token.invalidated = true;
          delete token.id;
          delete token.role;
          delete token.authVersion;
          delete token.adminVerifiedAt;
          return token;
        }
        token.role = dbUser.role;
        token.authVersion = dbUser.authVersion;
        token.adminTotpEnabled = Boolean(
          dbUser.adminTotpEnabledAt && dbUser.adminTotpSecretEncrypted
        );
        if (dbUser.role !== "ADMIN") {
          delete token.adminVerifiedAt;
        }
        token.invalidated = false;
      }

      return token;
    },
    session({ session, token }) {
      if (token.invalidated || !token.id) {
        return null as never;
      }
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as "USER" | "ADMIN" | "STAFF") ?? "USER";
        if (typeof token.adminVerifiedAt === "number") {
          session.user.adminVerifiedAt = token.adminVerifiedAt;
        }
        session.user.adminTotpEnabled = token.adminTotpEnabled === true;
      }
      return session;
    },
  },
};
