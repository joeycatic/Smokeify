"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex h-11 w-full items-center justify-center rounded-md border border-black/15 bg-white px-5 text-sm font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90 sm:h-12 sm:w-auto sm:text-base"
    >
      Ausloggen
    </button>
  );
}
