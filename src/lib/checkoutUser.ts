import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        shippingAddressType: true,
        packstationNumber: true,
        postNumber: true,
        loyaltyPointsBalance: true,
      },
    });
  } catch (error) {
    if (!isMissingCheckoutAddressColumnError(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        loyaltyPointsBalance: true,
      },
    });

    if (!legacyUser) return null;

    return {
      ...legacyUser,
      shippingAddressType: null,
      packstationNumber: null,
      postNumber: null,
    };
  }
};
