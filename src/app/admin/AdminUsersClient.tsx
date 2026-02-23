"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN" | "STAFF";
  createdAt: string;
};

type Props = {
  initialUsers: UserRow[];
  initialQuery: string;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

const ROLES: UserRow["role"][] = ["USER", "STAFF", "ADMIN"];

export default function AdminUsersClient({
  initialUsers,
  initialQuery,
  totalCount: initialTotalCount,
  currentPage,
  totalPages,
  pageSize,
}: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [query, setQuery] = useState(initialQuery);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [roleConfirm, setRoleConfirm] = useState<{
    id: string;
    role: UserRow["role"];
  } | null>(null);
  const [rolePassword, setRolePassword] = useState("");
  const [rolePasswordError, setRolePasswordError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    setUsers(initialUsers);
    setTotalCount(initialTotalCount);
  }, [initialUsers, initialTotalCount, currentPage]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    const current = new URLSearchParams(searchParamsString).get("q") ?? "";
    if (trimmed === current) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      if (trimmed) {
        params.set("q", trimmed);
        params.set("page", "1");
      } else {
        params.delete("q");
        params.delete("page");
      }
      const queryString = params.toString();
      router.replace(queryString ? `/admin?${queryString}` : "/admin", {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, router, searchParamsString]);

  const updateRole = async (
    id: string,
    role: UserRow["role"],
    adminPassword: string
  ) => {
    setSavingId(id);
    setError("");
    const prev = users;
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, role } : u)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role, adminPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        setUsers(prev);
      }
    } catch {
      setError("Update failed");
      setUsers(prev);
    } finally {
      setSavingId(null);
    }
  };

  const confirmRoleChange = async () => {
    if (!roleConfirm) return;
    const adminPassword = rolePassword.trim();
    if (!adminPassword) {
      setRolePasswordError("Bitte Admin-Passwort eingeben.");
      return;
    }
    const { id, role } = roleConfirm;
    setRoleConfirm(null);
    setRolePassword("");
    setRolePasswordError("");
    await updateRole(id, role, adminPassword);
  };

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(searchParamsString);
    const trimmed = query.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const queryString = params.toString();
    return queryString ? `/admin?${queryString}` : "/admin";
  };

  return (
    <section className="rounded-xl border border-black/10 bg-white p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold tracking-widest text-black/70">
          USERS
        </h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users..."
          className="h-10 w-full sm:max-w-xs rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30"
        />
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-black/50">
            <tr>
              <th className="pb-3">Email</th>
              <th className="pb-3">Username</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Created</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-black/10 hover:bg-stone-50 transition-colors">
                <td className="py-3 pr-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {user.email ?? "-"}
                  </Link>
                </td>
                <td className="py-3 pr-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {user.name ?? "-"}
                  </Link>
                </td>
                <td className="py-3 pr-3">
                  <select
                    value={user.role}
                    onChange={(event) => {
                      setRolePassword("");
                      setRolePasswordError("");
                      setRoleConfirm({
                        id: user.id,
                        role: event.target.value as UserRow["role"],
                      });
                    }}
                    disabled={savingId === user.id}
                    className="rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-semibold"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-3">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 text-stone-500 transition hover:border-black/20 hover:bg-stone-100 hover:text-stone-900"
                    title="Benutzer bearbeiten"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-stone-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <div>
          Showing{" "}
          <span className="font-semibold text-stone-700">{users.length}</span> of{" "}
          <span className="font-semibold text-stone-700">{totalCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={buildPageHref(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            scroll={false}
            className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
              currentPage <= 1
                ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100"
            }`}
            tabIndex={currentPage <= 1 ? -1 : 0}
            onClick={(event) => {
              if (currentPage <= 1) {
                event.preventDefault();
              }
            }}
          >
            Prev
          </Link>
          <span className="flex h-9 min-w-[5rem] items-center justify-center gap-0.5 text-center text-stone-500">
            <span>Page</span>
            <span className="font-semibold text-stone-700">{currentPage}</span>
            <span>of</span>
            <span className="font-semibold text-stone-700">{totalPages}</span>
          </span>
          <Link
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            scroll={false}
            className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
              currentPage >= totalPages
                ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100"
            }`}
            tabIndex={currentPage >= totalPages ? -1 : 0}
            onClick={(event) => {
              if (currentPage >= totalPages) {
                event.preventDefault();
              }
            }}
          >
            Next
          </Link>
        </div>
      </div>
      {roleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setRoleConfirm(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Role change bestaetigen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Bitte gib dein Admin-Passwort ein, um die Rolle zu aendern.
            </p>
            <input
              type="password"
              value={rolePassword}
              onChange={(event) => {
                setRolePassword(event.target.value);
                if (rolePasswordError) setRolePasswordError("");
              }}
              className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm outline-none focus:border-black/30"
              placeholder="Admin-Passwort"
            />
            {rolePasswordError && (
              <p className="mt-2 text-xs text-red-600">{rolePasswordError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleConfirm(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                className="h-10 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
              >
                Bestaetigen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
