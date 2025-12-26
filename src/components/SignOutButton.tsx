"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-black/20"
    >
      Sign out
    </button>
  );
}
