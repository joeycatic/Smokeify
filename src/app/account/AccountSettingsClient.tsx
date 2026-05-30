"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPinIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import DiscordLinkSection from "./DiscordLinkSection";
import { SHIPPING_ADDRESS_TYPES } from "@/lib/shippingAddress";

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
  initialShippingAddressType: string;
  initialPackstationNumber: string;
  initialPostNumber: string;
};

const inputClass =
  "smk-input h-12 w-full rounded-[18px] px-4 text-sm outline-none transition focus:border-[var(--smk-border-strong)] focus:bg-[rgba(255,255,255,0.08)] focus:ring-2 focus:ring-[rgba(233,188,116,0.12)]";

const labelClass =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]";

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
  initialShippingAddressType,
  initialPackstationNumber,
  initialPostNumber,
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
  const [shippingAddressType, setShippingAddressType] = useState(
    initialShippingAddressType === "PACKSTATION" ? "PACKSTATION" : "STREET",
  );
  const [packstationNumber, setPackstationNumber] = useState(
    initialPackstationNumber,
  );
  const [postNumber, setPostNumber] = useState(initialPostNumber);
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
          shippingAddressType,
          packstationNumber,
          postNumber,
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
    <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid gap-5">
        <div className="smk-surface rounded-[26px] px-4 py-5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(233,188,116,0.18)] bg-[rgba(233,188,116,0.1)] text-[var(--smk-accent-2)]">
              <UserCircleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                Persönlich
              </p>
              <p className="text-lg font-semibold text-[var(--smk-text)]">
                Basisdaten
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Username</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Vorname</label>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Nachname</label>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="smk-surface rounded-[26px] px-4 py-5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-[var(--smk-text)]">
              <MapPinIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                Versand
              </p>
              <p className="text-lg font-semibold text-[var(--smk-text)]">
                Lieferadresse
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Adressart</label>
              <div className="grid gap-3 md:grid-cols-2">
                {SHIPPING_ADDRESS_TYPES.map((value) => {
                  const active = shippingAddressType === value;
                  const title =
                    value === "PACKSTATION" ? "DHL Packstation" : "Straßenadresse";
                  const description =
                    value === "PACKSTATION"
                      ? "Packstation + Postnummer für DHL in Deutschland."
                      : "Klassische Lieferadresse mit Straße und Hausnummer.";
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setShippingAddressType(value);
                        if (value === "PACKSTATION" && !country.trim()) {
                          setCountry("DE");
                        }
                      }}
                      className={`rounded-[18px] border px-4 py-4 text-left transition ${
                        active
                          ? "border-[rgba(233,188,116,0.32)] bg-[rgba(233,188,116,0.1)]"
                          : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <p className="break-words text-sm font-semibold text-[var(--smk-text)]">
                        {title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--smk-text-muted)]">
                        {description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            {shippingAddressType === "PACKSTATION" ? (
              <>
                <div>
                  <label className={labelClass}>Packstation</label>
                  <input
                    type="text"
                    value={packstationNumber}
                    onChange={(event) => setPackstationNumber(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Postnummer</label>
                  <input
                    type="text"
                    value={postNumber}
                    onChange={(event) => setPostNumber(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
                disabled={shippingAddressType === "PACKSTATION"}
                className={inputClass}
              />
            </div>
            {shippingAddressType === "PACKSTATION" ? (
              <p className="md:col-span-2 rounded-[18px] border border-[rgba(233,188,116,0.16)] bg-[rgba(233,188,116,0.08)] px-4 py-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                Stripe Checkout übernimmt für Packstationen die Zeilen
                <span className="font-semibold text-[var(--smk-text)]">
                  {" "}Packstation {packstationNumber || "..."}
                </span>
                {" "}und
                <span className="font-semibold text-[var(--smk-text)]">
                  {" "}Postnummer {postNumber || "..."}
                </span>.
              </p>
            ) : null}
          </div>
        </div>

        <div className="smk-surface rounded-[26px] px-4 py-5 sm:px-5">
          <DiscordLinkSection />
        </div>

        {profileError ? (
          <p className="rounded-[18px] border border-[rgba(239,143,127,0.28)] bg-[rgba(62,26,24,0.82)] px-4 py-3 text-sm text-[#ef8f7f]">
            {profileError}
          </p>
        ) : null}
        {profileStatus === "ok" ? (
          <p className="rounded-[18px] border border-[rgba(127,207,150,0.26)] bg-[rgba(22,52,39,0.82)] px-4 py-3 text-sm text-[#9fe3b2]">
            Änderungen gespeichert.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileStatus === "saving"}
            className="smk-button-primary inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60 sm:w-auto"
          >
            {profileStatus === "saving" ? "Wird gespeichert..." : "Änderungen speichern"}
          </button>
          <Link
            href="/account/password"
            className="smk-button-secondary inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold sm:w-auto"
          >
            Passwort ändern
          </Link>
        </div>
      </div>
    </section>
  );
}
