"use client";

import { useState } from "react";
import Link from "next/link";

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
  const [profileStatus, setProfileStatus] = useState<
    "idle" | "saving" | "ok" | "error"
  >("idle");
  const [profileError, setProfileError] = useState("");

  const handleProfileSave = async () => {
    setProfileStatus("saving");
    setProfileError("");
    if (!firstName.trim() || !lastName.trim()) {
      setProfileStatus("error");
      setProfileError("Vorname und Nachname sind erforderlich.");
      return;
    }
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

  const inputClass =
    "w-full rounded-lg border border-black/10 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 outline-none transition-colors focus:border-[#44584c]/40 focus:bg-white focus:ring-2 focus:ring-[#44584c]/10";

  const labelClass = "block text-[11px] font-semibold tracking-wide text-stone-500 mb-1";

  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
      <h2 className="mb-6 text-sm font-semibold tracking-widest text-black/70">
        ACCOUNT AKTUALISIEREN
      </h2>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Personal info */}
        <div>
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-stone-400">
            PERSÖNLICHE DATEN
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Username *</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Vorname *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Nachname *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-black/6" />

        {/* Address */}
        <div>
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-stone-400">
            LIEFERADRESSE
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Straße</label>
              <input
                type="text"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Hausnummer</label>
              <input
                type="text"
                value={houseNumber}
                onChange={(event) => setHouseNumber(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Postleitzahl</label>
              <input
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Stadt</label>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Land</label>
              <input
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-1">
          {profileError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {profileError}
            </p>
          )}
          {profileStatus === "ok" && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Änderungen gespeichert.
            </p>
          )}
          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileStatus === "saving"}
            className="h-11 w-full rounded-lg bg-[#2f3e36] px-4 text-sm font-semibold text-white transition hover:bg-[#44584c] disabled:opacity-60 sm:h-12 sm:text-base"
          >
            {profileStatus === "saving" ? "Wird gespeichert..." : "Änderungen speichern"}
          </button>
          <Link
            href="/account/password"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-black/10 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/20 hover:bg-stone-50 sm:h-12 sm:text-base"
          >
            Passwort ändern
          </Link>
        </div>
      </div>
    </section>
  );
}
