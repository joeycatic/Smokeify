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

  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
        ACCOUNT AKTUALISIEREN
      </h2>
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold tracking-widest text-black/60 mb-3">
          PROFIL
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Username *
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Vorname *
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Nachname *
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Straße
            </label>
            <input
              type="text"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Hausnummer
            </label>
            <input
              type="text"
              value={houseNumber}
              onChange={(event) => setHouseNumber(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Postleitzahl
            </label>
            <input
              type="text"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Stadt
            </label>
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600">
              Land
            </label>
            <input
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {profileError && (
            <p className="text-xs text-red-600">{profileError}</p>
          )}
          {profileStatus === "ok" && (
            <p className="text-xs text-green-700">Updated.</p>
          )}
          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileStatus === "saving"}
            className="h-11 w-full rounded-md bg-[#44584c] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:h-12 sm:text-base"
          >
            {profileStatus === "saving" ? "Saving..." : "Änderungen speichern"}
          </button>
          <Link
            href="/account/password"
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90 sm:h-12 sm:text-base"
          >
            Passwort ändern
          </Link>
        </div>
      </div>
    </section>
  );
}
