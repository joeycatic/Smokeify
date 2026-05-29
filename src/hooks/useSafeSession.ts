"use client";

import { useContext } from "react";
import {
  SessionContext,
  type SessionContextValue,
} from "next-auth/react";

const fallbackSession: SessionContextValue = {
  data: null,
  status: "unauthenticated",
  update: async () => null,
};

export function useSafeSession(): SessionContextValue {
  return useContext(SessionContext) ?? fallbackSession;
}

