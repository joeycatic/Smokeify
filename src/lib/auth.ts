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
  ADMIN_LOGIN_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
} from "@/lib/rateLimit";

const providers: NextAuthOptions["providers"] = [];
const VERIFY_LOGIN_COOKIE = "smokeify_verify_login";
const FALLBACK_PASSWORD_HASH = bcrypt.hashSync("smokeify-admin-fallback", 10);

const isMissingUserColumnError = (error: unknown, column: string) =>
  error instanceof Error && error.message.includes(`column "User.${column}" does not exist`);

type LoginUserRecord = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  passwordHash: string | null;
  emailVerified: Date | null;
  role: "USER" | "ADMIN" | "STAFF";
  authVersion: number;
  adminTotpSecretEncrypted: string | null;
  adminTotpEnabledAt: Date | null;
  adminAccessDisabledAt: Date | null;
};

type AuthStateRecord = {
  role: "USER" | "ADMIN" | "STAFF";
  authVersion: number;
  adminTotpEnabledAt: Date | null;
  adminTotpSecretEncrypted: string | null;
  adminAccessDisabledAt: Date | null;
};

async function findUserForLoginWithGovernance(identifier: string): Promise<LoginUserRecord | null> {
  const identifierLower = identifier.toLowerCase();
  const candidates = Array.from(new Set([identifier, identifierLower]));

  try {
    return await prisma.user.findFirst({
      where: {
        OR: [
          { email: { in: candidates } },
          { name: { in: candidates } },
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
        adminAccessDisabledAt: true,
      },
    });
  } catch (error) {
    if (!isMissingUserColumnError(error, "adminAccessDisabledAt")) {
      throw error;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { in: candidates } },
          { name: { in: candidates } },
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

    return user ? { ...user, adminAccessDisabledAt: null } : null;
  }
}

async function getAuthStateByUserId(userId: string): Promise<AuthStateRecord | null> {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        authVersion: true,
        adminTotpEnabledAt: true,
        adminTotpSecretEncrypted: true,
        adminAccessDisabledAt: true,
      },
    });
  } catch (error) {
    if (!isMissingUserColumnError(error, "adminAccessDisabledAt")) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        authVersion: true,
        adminTotpEnabledAt: true,
        adminTotpSecretEncrypted: true,
      },
    });

    return user ? { ...user, adminAccessDisabledAt: null } : null;
  }
}

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

async function findUserForLogin(identifier: string) {
  return findUserForLoginWithGovernance(identifier);
}

function toAuthUser<T extends { adminAccessDisabledAt?: Date | null }>(user: T) {
  const { adminAccessDisabledAt, ...safeUser } = user;
  void adminAccessDisabledAt;
  return safeUser;
}

async function enforceCredentialRateLimit({
  headers,
  identifier,
  prefix,
  config,
}: {
  headers: Headers | Record<string, string | string[] | undefined> | undefined;
  identifier: string;
  prefix: string;
  config: {
    identifierLimit: number;
    ipLimit: number;
    windowMs: number;
    pairLimit?: number;
  };
}) {
  const ip = getClientIp(headers);
  const ipLimit = await checkRateLimit({
    key: `${prefix}:ip:${ip}`,
    limit: config.ipLimit,
    windowMs: config.windowMs,
  });
  if (!ipLimit.allowed) {
    throw new Error("RATE_LIMIT");
  }

  const identifierLimit = await checkRateLimit({
    key: `${prefix}:identifier:${identifier}`,
    limit: config.identifierLimit,
    windowMs: config.windowMs,
  });
  if (!identifierLimit.allowed) {
    throw new Error("RATE_LIMIT");
  }

  if (typeof config.pairLimit === "number") {
    const pairLimit = await checkRateLimit({
      key: `${prefix}:pair:${identifier}:${ip}`,
      limit: config.pairLimit,
      windowMs: config.windowMs,
    });
    if (!pairLimit.allowed) {
      throw new Error("RATE_LIMIT");
    }
  }
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

      await enforceCredentialRateLimit({
        headers: req?.headers ?? new Headers(),
        identifier: identifierLower,
        prefix: adminIntent ? "admin-login" : "login",
        config: adminIntent ? ADMIN_LOGIN_RATE_LIMIT : LOGIN_RATE_LIMIT,
      });

      const user = await findUserForLogin(identifier);

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

        if (user.adminAccessDisabledAt) {
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
          ...toAuthUser(user),
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
          return toAuthUser(user);
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
          return toAuthUser(user);
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

      const emailCandidates = Array.from(new Set([user.email, user.email.toLowerCase()]));
      await prisma.user.updateMany({
        where: {
          email: { in: emailCandidates },
          emailVerified: null,
        },
        data: { emailVerified: new Date() },
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await getAuthStateByUserId(String(user.id));
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
        token.adminAccessDisabledAt = dbUser.adminAccessDisabledAt?.getTime();
        if (dbUser.role === "ADMIN" && typeof user.adminVerifiedAt === "number") {
          token.adminVerifiedAt = user.adminVerifiedAt;
        } else {
          delete token.adminVerifiedAt;
        }
        token.invalidated = false;
        return token;
      }

      if (token.id) {
        const dbUser = await getAuthStateByUserId(String(token.id));
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
        token.adminAccessDisabledAt = dbUser.adminAccessDisabledAt?.getTime();
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
        if (typeof token.adminAccessDisabledAt === "number") {
          session.user.adminAccessDisabledAt = token.adminAccessDisabledAt;
        }
      }
      return session;
    },
  },
};
