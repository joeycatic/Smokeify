import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeShippingAddressType } from "@/lib/shippingAddress";

export type CheckoutUser = {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  shippingAddressType: string | null;
  packstationNumber: string | null;
  postNumber: string | null;
  loyaltyPointsBalance: number;
};

type CheckoutUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  shippingAddressType: string | null;
  packstationNumber: string | null;
  postNumber: string | null;
  loyaltyPointsBalance: number | bigint | null;
};

const toCheckoutUser = (row: CheckoutUserRow | null): CheckoutUser | null => {
  if (!row) return null;

  return {
    ...row,
    shippingAddressType: row.shippingAddressType
      ? normalizeShippingAddressType(row.shippingAddressType)
      : null,
    loyaltyPointsBalance: Number(row.loyaltyPointsBalance ?? 0),
  };
};

export const isMissingCheckoutAddressColumnError = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  ) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return [
    'column "shippingAddressType" does not exist',
    'column "packstationNumber" does not exist',
    'column "postNumber" does not exist',
    "shippingAddressType",
    "packstationNumber",
    "postNumber",
  ].some((pattern) => error.message.includes(pattern));
};

export const loadCheckoutUser = async (
  userId: string,
): Promise<CheckoutUser | null> => {
  try {
    const [user] = await prisma.$queryRaw<CheckoutUserRow[]>`
      SELECT
        id,
        email,
        name,
        "firstName",
        "lastName",
        street,
        "houseNumber",
        "postalCode",
        city,
        country,
        "shippingAddressType"::text AS "shippingAddressType",
        "packstationNumber",
        "postNumber",
        "loyaltyPointsBalance"
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;

    return toCheckoutUser(user ?? null);
  } catch (error) {
    if (!isMissingCheckoutAddressColumnError(error)) {
      throw error;
    }

    const [legacyUser] = await prisma.$queryRaw<CheckoutUserRow[]>`
      SELECT
        id,
        email,
        name,
        "firstName",
        "lastName",
        street,
        "houseNumber",
        "postalCode",
        city,
        country,
        "loyaltyPointsBalance"
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!legacyUser) return null;

    const normalizedLegacyUser = toCheckoutUser(legacyUser);
    if (!normalizedLegacyUser) return null;

    return {
      ...normalizedLegacyUser,
      shippingAddressType: null,
      packstationNumber: null,
      postNumber: null,
    };
  }
};
