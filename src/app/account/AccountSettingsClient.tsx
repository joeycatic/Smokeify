"use client";

import { useState } from "react";

type Props = {
  initialName: string;
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  initialStreet: string;
  initialHouseNumber: string;
  initialPostalCode: string;
  initialCity: string;
  initialCountry: string;
};

export default function AccountSettingsClient({
  initialName,
  initialEmail,
  initialFirstName,
  initialLastName,
  initialStreet,
  initialHouseNumber,
  initialPostalCode,
  initialCity,
  initialCountry,
}: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [street, setStreet] = useState(initialStreet);
  const [houseNumber, setHouseNumber] = useState(initialHouseNumber);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [city, setCity] = useState(initialCity);
  const [country, setCountry] = useState(initialCountry);
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  const handleProfileSave = async () => {
    setProfileStatus("saving");
    setProfileError("");
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          firstName,
          lastName,
          street,
          houseNumber,
          postalCode,
          city,
          country,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setProfileError(data.error ?? "Update failed");
        setProfileStatus("error");
        return;
      }
      setProfileStatus("ok");
      setTimeout(() => setProfileStatus("idle"), 1500);
    } catch {
      setProfileError("Update failed");
      setProfileStatus("error");
    }
  };

  const handlePasswordSave = async () => {
    setPasswordStatus("saving");
    setPasswordError("");
    if (!currentPassword || !newPassword) {
      setPasswordError("Bitte alle Felder ausfuellen.");
      setPasswordStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwoerter stimmen nicht ueberein.");
      setPasswordStatus("error");
      return;
    }
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setPasswordError(data.error ?? "Update failed");
        setPasswordStatus("error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("ok");
      setTimeout(() => setPasswordStatus("idle"), 1500);
    } catch {
      setPasswordError("Update failed");
      setPasswordStatus("error");
    }
  };

  return (
    <section className="rounded-xl border border-black/10 bg-white p-6">
      <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
        ACCOUNT SETTINGS
      </h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-black/60">
            PROFILE
          </p>
          <label className="block text-xs font-semibold text-stone-600">
            Username
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Street
          </label>
          <input
            type="text"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            House number
          </label>
          <input
            type="text"
            value={houseNumber}
            onChange={(event) => setHouseNumber(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Postcode
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Country
          </label>
          <input
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          {profileError && <p className="text-xs text-red-600">{profileError}</p>}
          {profileStatus === "ok" && (
            <p className="text-xs text-green-700">Updated.</p>
          )}
          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileStatus === "saving"}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {profileStatus === "saving" ? "Saving..." : "Save profile"}
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-black/60">
            PASSWORD
          </p>
          <label className="block text-xs font-semibold text-stone-600">
            Current password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
          {passwordStatus === "ok" && (
            <p className="text-xs text-green-700">Updated.</p>
          )}
          <button
            type="button"
            onClick={handlePasswordSave}
            disabled={passwordStatus === "saving"}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {passwordStatus === "saving" ? "Saving..." : "Change password"}
          </button>
        </div>
      </div>
    </section>
  );
}
