import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "USER" | "ADMIN" | "STAFF";
      adminVerifiedAt?: number;
      adminTotpEnabled?: boolean;
    };
  }

  interface User {
    role: "USER" | "ADMIN" | "STAFF";
    adminVerifiedAt?: number;
    adminTotpEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: "USER" | "ADMIN" | "STAFF";
    authVersion?: number;
    adminVerifiedAt?: number;
    adminTotpEnabled?: boolean;
    invalidated?: boolean;
  }
}
