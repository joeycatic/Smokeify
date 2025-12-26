import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "USER" | "ADMIN" | "STAFF";
    };
  }

  interface User {
    role: "USER" | "ADMIN" | "STAFF";
  }
}
