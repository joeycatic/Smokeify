"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="smk-button-secondary inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold sm:w-auto"
    >
      Ausloggen
    </button>
  );
}
