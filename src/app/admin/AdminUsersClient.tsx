"use client";

import { useEffect, useMemo, useState } from "react";
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
  basePath?: string;
  heading?: string;
  description?: string;
};

const ROLES: UserRow["role"][] = ["USER", "STAFF", "ADMIN"];

const ROLE_STYLES: Record<UserRow["role"], string> = {
  USER: "border-white/10 bg-white/[0.04] text-slate-300",
  STAFF: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  ADMIN: "border-violet-400/20 bg-violet-400/10 text-violet-200",
};

export default function AdminUsersClient({
  initialUsers,
  initialQuery,
  totalCount: initialTotalCount,
  currentPage,
  totalPages,
  pageSize,
  basePath = "/admin",
  heading = "Users",
  description = "Search, review and edit user access.",
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
  }, [currentPage, initialTotalCount, initialUsers]);

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
      router.replace(queryString ? `${basePath}?${queryString}` : basePath, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [basePath, query, router, searchParamsString]);

  const createdThisMonth = useMemo(() => {
    const now = new Date();
    return users.filter((user) => {
      const createdAt = new Date(user.createdAt);
      return (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth()
      );
    }).length;
  }, [users]);

  const adminsVisible = useMemo(
    () => users.filter((user) => user.role === "ADMIN").length,
    [users]
  );

  const updateRole = async (
    id: string,
    role: UserRow["role"],
    adminPassword: string
  ) => {
    setSavingId(id);
    setError("");
    const previousUsers = users;
    setUsers((list) => list.map((user) => (user.id === id ? { ...user, role } : user)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role, adminPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Role update failed.");
        setUsers(previousUsers);
      }
    } catch {
      setError("Role update failed.");
      setUsers(previousUsers);
    } finally {
      setSavingId(null);
    }
  };

  const confirmRoleChange = async () => {
    if (!roleConfirm) return;
    const adminPassword = rolePassword.trim();
    if (!adminPassword) {
      setRolePasswordError("Enter your admin password.");
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
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  return (
    <section className="admin-reveal space-y-5 rounded-[28px] border border-white/10 bg-[#090d12]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Access
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{heading}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <div className="grid min-w-[16rem] gap-2 sm:grid-cols-2">
          <StatChip label="Visible users" value={String(totalCount)} />
          <StatChip label="Admins visible" value={String(adminsVisible)} />
          <StatChip label="This month" value={String(createdThisMonth)} />
          <StatChip label="Page size" value={String(pageSize)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-[16rem] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
            <path
              d="M11 4a7 7 0 015.25 11.7l3.53 3.53a1 1 0 01-1.41 1.41l-3.53-3.53A7 7 0 1111 4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email, name, or role"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          Page {currentPage} / {totalPages}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#070a0f]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Identity</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="truncate font-semibold text-slate-100 underline-offset-4 hover:text-cyan-300 hover:underline"
                      >
                        {user.email ?? "Unknown email"}
                      </Link>
                      <div className="truncate text-xs text-slate-500">
                        {user.name ?? "No public name"}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ROLE_STYLES[user.role]}`}
                      >
                        {user.role}
                      </span>
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
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-100"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(user.createdAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
                    >
                      Open profile
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                    No users found for this query.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-100">{users.length}</span> of{" "}
          <span className="font-semibold text-slate-100">{totalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <PagerLink
            href={buildPageHref(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </PagerLink>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
            {currentPage} / {totalPages}
          </span>
          <PagerLink
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </PagerLink>
        </div>
      </div>

      {roleConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setRoleConfirm(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#090d12] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-semibold text-white">Confirm role change</h3>
            <p className="mt-2 text-sm text-slate-400">
              Enter your admin password to apply this access change.
            </p>
            <input
              type="password"
              value={rolePassword}
              onChange={(event) => {
                setRolePassword(event.target.value);
                if (rolePasswordError) setRolePasswordError("");
              }}
              className="mt-4 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Admin password"
            />
            {rolePasswordError ? (
              <p className="mt-2 text-xs text-red-300">{rolePasswordError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleConfirm(null)}
                className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRoleChange()}
                className="h-10 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      scroll={false}
      tabIndex={disabled ? -1 : 0}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
        }
      }}
      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600"
          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
      }`}
    >
      {children}
    </Link>
  );
}
