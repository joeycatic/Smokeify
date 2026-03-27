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
  adminTotpEnabled: boolean;
  adminTotpPending: boolean;
  adminAccessDisabledAt: string | null;
  adminAccessDisableReason?: string | null;
  sessionCount: number;
  deviceCount: number;
};

type GovernanceAction =
  | "disable_admin_access"
  | "enable_admin_access"
  | "revoke_sessions"
  | "clear_trusted_devices";

type MfaAction =
  | "start_enrollment"
  | "view_pending_setup"
  | "confirm_enrollment"
  | "reset_mfa";

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

const GOVERNANCE_ACTION_COPY: Record<
  GovernanceAction,
  {
    title: string;
    description: string;
    buttonLabel: string;
    reasonLabel?: string;
    reasonPlaceholder?: string;
  }
> = {
  disable_admin_access: {
    title: "Disable admin access",
    description:
      "This immediately blocks admin entry for the account and clears existing admin sessions/devices.",
    buttonLabel: "Disable access",
    reasonLabel: "Reason",
    reasonPlaceholder: "Temporary leave, compromised account, rotation",
  },
  enable_admin_access: {
    title: "Re-enable admin access",
    description: "This restores admin entry for the account.",
    buttonLabel: "Enable access",
  },
  revoke_sessions: {
    title: "Revoke admin sessions",
    description: "This invalidates current sessions and forces the admin to sign in again.",
    buttonLabel: "Revoke sessions",
  },
  clear_trusted_devices: {
    title: "Clear trusted devices",
    description:
      "This removes remembered devices so the account must pass fresh device verification again.",
    buttonLabel: "Clear devices",
  },
};

const MFA_ACTION_COPY: Record<
  MfaAction,
  {
    title: string;
    description: string;
    buttonLabel: string;
  }
> = {
  start_enrollment: {
    title: "Start MFA setup",
    description:
      "Generate a new authenticator secret for this admin account. The setup is only active after you confirm a valid authenticator code.",
    buttonLabel: "Generate secret",
  },
  view_pending_setup: {
    title: "Resume MFA setup",
    description:
      "Reveal the pending authenticator secret again so the admin can finish enrollment.",
    buttonLabel: "Show pending setup",
  },
  confirm_enrollment: {
    title: "Confirm MFA setup",
    description:
      "Scan the secret in an authenticator app, then enter the current 6-digit code to finish enrollment.",
    buttonLabel: "Confirm MFA",
  },
  reset_mfa: {
    title: "Reset MFA",
    description:
      "Remove the current authenticator setup and revoke active sessions so the admin must enroll again.",
    buttonLabel: "Reset MFA",
  },
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
  const [notice, setNotice] = useState("");
  const [roleConfirm, setRoleConfirm] = useState<{
    id: string;
    role: UserRow["role"];
  } | null>(null);
  const [rolePassword, setRolePassword] = useState("");
  const [rolePasswordError, setRolePasswordError] = useState("");
  const [governanceConfirm, setGovernanceConfirm] = useState<{
    id: string;
    action: GovernanceAction;
  } | null>(null);
  const [governancePassword, setGovernancePassword] = useState("");
  const [governanceReason, setGovernanceReason] = useState("");
  const [governanceError, setGovernanceError] = useState("");
  const [mfaDialog, setMfaDialog] = useState<{
    id: string;
    action: MfaAction;
    email: string | null;
    accountName?: string;
    secret?: string;
    otpAuthUrl?: string;
  } | null>(null);
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
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

  const adminUsers = useMemo(
    () => users.filter((user) => user.role === "ADMIN"),
    [users]
  );
  const enabledAdminsVisible = useMemo(
    () => adminUsers.filter((user) => !user.adminAccessDisabledAt).length,
    [adminUsers]
  );
  const mfaReadyAdminsVisible = useMemo(
    () => adminUsers.filter((user) => user.adminTotpEnabled).length,
    [adminUsers]
  );
  const mfaPendingAdminsVisible = useMemo(
    () => adminUsers.filter((user) => user.adminTotpPending).length,
    [adminUsers]
  );

  const mergeUser = (nextUser: Partial<UserRow> & { id: string }) => {
    setUsers((current) =>
      current.map((user) => (user.id === nextUser.id ? { ...user, ...nextUser } : user))
    );
  };

  const openMfaDialog = (nextDialog: {
    id: string;
    action: MfaAction;
    email: string | null;
  }) => {
    setMfaDialog(nextDialog);
    setMfaPassword("");
    setMfaCode("");
    setMfaError("");
  };

  const updateRole = async (
    id: string,
    role: UserRow["role"],
    adminPassword: string
  ) => {
    setSavingId(id);
    setError("");
    setNotice("");
    const previousUsers = users;
    setUsers((list) => list.map((user) => (user.id === id ? { ...user, role } : user)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role, adminPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: Partial<UserRow> & { id: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Role update failed.");
        setUsers(previousUsers);
        return;
      }
      if (data.user) {
        mergeUser(data.user);
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

  const runGovernanceAction = async () => {
    if (!governanceConfirm) return;
    const { id, action } = governanceConfirm;
    const adminPassword = governancePassword.trim();
    if (!adminPassword) {
      setGovernanceError("Enter your admin password.");
      return;
    }

    setSavingId(id);
    setError("");
    setNotice("");
    setGovernanceError("");

    try {
      const res = await fetch(`/api/admin/users/${id}/governance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminPassword,
          reason: governanceReason.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: Partial<UserRow> & { id: string };
      };
      if (!res.ok || !data.user) {
        setGovernanceError(data.error ?? "Governance action failed.");
        return;
      }
      mergeUser(data.user);
      setGovernanceConfirm(null);
      setGovernancePassword("");
      setGovernanceReason("");
      setGovernanceError("");
    } catch {
      setGovernanceError("Governance action failed.");
    } finally {
      setSavingId(null);
    }
  };

  const runMfaAction = async () => {
    if (!mfaDialog) return;

    const adminPassword = mfaPassword.trim();
    if (!adminPassword) {
      setMfaError("Enter your admin password.");
      return;
    }

    if (mfaDialog.action === "confirm_enrollment" && !mfaCode.trim()) {
      setMfaError("Enter the authenticator code.");
      return;
    }

    setSavingId(mfaDialog.id);
    setError("");
    setMfaError("");

    try {
      const res = await fetch(`/api/admin/users/${mfaDialog.id}/mfa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mfaDialog.action,
          adminPassword,
          code: mfaCode.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: Partial<UserRow> & { id: string };
        setup?: {
          accountName: string;
          secret: string;
          otpAuthUrl: string;
        };
      };
      if (!res.ok || !data.user) {
        setMfaError(data.error ?? "MFA action failed.");
        return;
      }

      mergeUser(data.user);

      if (data.setup) {
        setMfaDialog((current) =>
          current
            ? {
                ...current,
                action: "confirm_enrollment",
                accountName: data.setup?.accountName,
                secret: data.setup?.secret,
                otpAuthUrl: data.setup?.otpAuthUrl,
              }
            : current
        );
        setNotice("Authenticator setup generated. Confirm it with the current code.");
        setMfaCode("");
        return;
      }

      setNotice(
        mfaDialog.action === "reset_mfa" ? "MFA reset applied." : "MFA updated."
      );
      setMfaDialog(null);
      setMfaPassword("");
      setMfaCode("");
      setMfaError("");
    } catch {
      setMfaError("MFA action failed.");
    } finally {
      setSavingId(null);
    }
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
          <StatChip label="Admins visible" value={String(adminUsers.length)} />
          <StatChip label="Enabled admins" value={String(enabledAdminsVisible)} />
          <StatChip label="MFA ready" value={String(mfaReadyAdminsVisible)} />
          <StatChip label="MFA pending" value={String(mfaPendingAdminsVisible)} />
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
      {notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {adminUsers.length > 0 ? (
        <div className="space-y-3 rounded-[24px] border border-white/10 bg-[#070a0f] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Governance
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">Admin account controls</h3>
            </div>
            <div className="text-xs text-slate-500">
              Disable access, revoke sessions, and clear remembered devices.
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {adminUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {user.email ?? user.id}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {user.name ?? "No public name"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        user.adminAccessDisabledAt
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      }`}
                    >
                      {user.adminAccessDisabledAt ? "Access disabled" : "Access enabled"}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        user.adminTotpEnabled
                          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                          : user.adminTotpPending
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          : "border-rose-400/20 bg-rose-400/10 text-rose-200"
                      }`}
                    >
                      {user.adminTotpEnabled
                        ? "MFA enabled"
                        : user.adminTotpPending
                          ? "MFA pending"
                          : "MFA missing"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>{user.sessionCount} session(s)</span>
                  <span>{user.deviceCount} trusted device(s)</span>
                  <span>Created {new Date(user.createdAt).toLocaleDateString("de-DE")}</span>
                </div>

                {user.adminAccessDisabledAt ? (
                  <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-xs text-amber-100">
                    Disabled {new Date(user.adminAccessDisabledAt).toLocaleString("de-DE")}
                    {user.adminAccessDisableReason ? ` · ${user.adminAccessDisableReason}` : ""}
                  </div>
                ) : null}

                {user.adminTotpPending ? (
                  <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-3 text-xs text-cyan-100">
                    Authenticator setup is pending confirmation for this admin account.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openMfaDialog({
                        id: user.id,
                        email: user.email,
                        action:
                          user.adminTotpPending
                            ? "view_pending_setup"
                            : "start_enrollment",
                      })
                    }
                    disabled={savingId === user.id}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    {user.adminTotpPending
                      ? "Resume MFA setup"
                      : user.adminTotpEnabled
                        ? "Rotate MFA"
                        : "Start MFA setup"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openMfaDialog({
                        id: user.id,
                        email: user.email,
                        action: "reset_mfa",
                      })
                    }
                    disabled={
                      savingId === user.id ||
                      (!user.adminTotpEnabled && !user.adminTotpPending)
                    }
                    className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100"
                  >
                    Reset MFA
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGovernanceConfirm({
                        id: user.id,
                        action: user.adminAccessDisabledAt
                          ? "enable_admin_access"
                          : "disable_admin_access",
                      })
                    }
                    disabled={savingId === user.id}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      user.adminAccessDisabledAt
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-100"
                    }`}
                  >
                    {user.adminAccessDisabledAt ? "Enable access" : "Disable access"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGovernanceConfirm({ id: user.id, action: "revoke_sessions" })
                    }
                    disabled={savingId === user.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    Revoke sessions
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGovernanceConfirm({
                        id: user.id,
                        action: "clear_trusted_devices",
                      })
                    }
                    disabled={savingId === user.id}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    Clear devices
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                          const nextRole = event.target.value as UserRow["role"];
                          if (nextRole === user.role) return;
                          setRolePassword("");
                          setRolePasswordError("");
                          setRoleConfirm({
                            id: user.id,
                            role: nextRole,
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

      {governanceConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setGovernanceConfirm(null);
              setGovernancePassword("");
              setGovernanceReason("");
              setGovernanceError("");
            }}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#090d12] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-semibold text-white">
              {GOVERNANCE_ACTION_COPY[governanceConfirm.action].title}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              {GOVERNANCE_ACTION_COPY[governanceConfirm.action].description}
            </p>

            {GOVERNANCE_ACTION_COPY[governanceConfirm.action].reasonLabel ? (
              <label className="mt-4 block text-xs font-semibold text-slate-400">
                {GOVERNANCE_ACTION_COPY[governanceConfirm.action].reasonLabel}
                <input
                  type="text"
                  value={governanceReason}
                  onChange={(event) => setGovernanceReason(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder={
                    GOVERNANCE_ACTION_COPY[governanceConfirm.action].reasonPlaceholder
                  }
                />
              </label>
            ) : null}

            <input
              type="password"
              value={governancePassword}
              onChange={(event) => {
                setGovernancePassword(event.target.value);
                if (governanceError) setGovernanceError("");
              }}
              className="mt-4 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Admin password"
            />
            {governanceError ? (
              <p className="mt-2 text-xs text-red-300">{governanceError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setGovernanceConfirm(null);
                  setGovernancePassword("");
                  setGovernanceReason("");
                  setGovernanceError("");
                }}
                className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runGovernanceAction()}
                className="h-10 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950"
              >
                {GOVERNANCE_ACTION_COPY[governanceConfirm.action].buttonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mfaDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setMfaDialog(null);
              setMfaPassword("");
              setMfaCode("");
              setMfaError("");
            }}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-xl rounded-[28px] border border-white/10 bg-[#090d12] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-semibold text-white">
              {MFA_ACTION_COPY[mfaDialog.action].title}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              {MFA_ACTION_COPY[mfaDialog.action].description}
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              {mfaDialog.email ?? mfaDialog.id}
            </div>

            {mfaDialog.secret ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    Account label
                  </div>
                  <div className="mt-2 break-all rounded-xl border border-white/10 bg-[#050912] px-3 py-2 text-sm text-white">
                    {mfaDialog.accountName}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    Manual secret
                  </div>
                  <div className="mt-2 break-all rounded-xl border border-white/10 bg-[#050912] px-3 py-2 font-mono text-sm text-white">
                    {mfaDialog.secret}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    OTP auth URL
                  </div>
                  <div className="mt-2 break-all rounded-xl border border-white/10 bg-[#050912] px-3 py-2 text-xs text-slate-300">
                    {mfaDialog.otpAuthUrl}
                  </div>
                </div>
              </div>
            ) : null}

            <input
              type="password"
              value={mfaPassword}
              onChange={(event) => {
                setMfaPassword(event.target.value);
                if (mfaError) setMfaError("");
              }}
              className="mt-4 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Admin password"
            />

            {mfaDialog.action === "confirm_enrollment" ? (
              <input
                type="text"
                value={mfaCode}
                onChange={(event) => {
                  setMfaCode(event.target.value);
                  if (mfaError) setMfaError("");
                }}
                inputMode="numeric"
                className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
                placeholder="Authenticator code"
              />
            ) : null}

            {mfaError ? <p className="mt-2 text-xs text-red-300">{mfaError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMfaDialog(null);
                  setMfaPassword("");
                  setMfaCode("");
                  setMfaError("");
                }}
                className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runMfaAction()}
                className="h-10 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950"
              >
                {MFA_ACTION_COPY[mfaDialog.action].buttonLabel}
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
