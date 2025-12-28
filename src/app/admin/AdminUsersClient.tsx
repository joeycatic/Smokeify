"use client";

import { useMemo, useState } from "react";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN" | "STAFF";
  createdAt: string;
};

type Props = {
  initialUsers: UserRow[];
};

const ROLES: UserRow["role"][] = ["USER", "STAFF", "ADMIN"];

export default function AdminUsersClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(q) ||
        user.name?.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
    );
  }, [users, query]);

  const updateRole = async (id: string, role: UserRow["role"]) => {
    setSavingId(id);
    setError("");
    const prev = users;
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, role } : u)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-t border-black/10">
                <td className="py-3 pr-3">{user.email ?? "-"}</td>
                <td className="py-3 pr-3">{user.name ?? "-"}</td>
                <td className="py-3 pr-3">
                  <select
                    value={user.role}
                    onChange={(event) =>
                      updateRole(user.id, event.target.value as UserRow["role"])
                    }
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
                <td className="py-3">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-stone-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
