/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();

const TOTAL_ORDERS = 150;
const TOTAL_CENTS = 2_300_000;
const CURRENCY = "EUR";
const TEST_SESSION_PREFIX = "test_session_";
const START_DATE = new Date("2026-01-06T08:00:00");
const END_DATE = new Date("2026-01-27T20:00:00");

const FIRST_NAMES = [
  "Anna",
  "Ben",
  "Clara",
  "David",
  "Elena",
  "Felix",
  "Greta",
  "Hanna",
  "Ivan",
  "Julia",
  "Karl",
  "Lena",
  "Mara",
  "Noah",
  "Oskar",
  "Paula",
  "Quinn",
  "Rosa",
  "Sven",
  "Tina",
  "Uwe",
  "Vera",
  "Willi",
  "Yara",
  "Zoe",
];

const LAST_NAMES = [
  "Becker",
  "Fischer",
  "Hartmann",
  "Klein",
  "Koch",
  "Kruger",
  "Lang",
  "Lehmann",
  "Meyer",
  "Neumann",
  "Peters",
  "Richter",
  "Schmidt",
  "Schneider",
  "Schulz",
  "Seidel",
  "Wagner",
  "Weber",
  "Wolf",
  "Zimmermann",
];

const DOMAINS = [
  "gmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com",
  "proton.me",
  "gmx.de",
  "web.de",
];
const GAMER_ADJECTIVES = [
  "shadow",
  "neon",
  "silent",
  "frost",
  "crimson",
  "pixel",
  "nova",
  "iron",
  "lunar",
  "blaze",
  "storm",
  "rapid",
  "ghost",
  "ember",
  "vivid",
  "swift",
  "atomic",
  "cosmic",
  "midnight",
  "solar",
];
const GAMER_NOUNS = [
  "fox",
  "raven",
  "wolf",
  "tiger",
  "eagle",
  "viper",
  "phantom",
  "rider",
  "hunter",
  "ninja",
  "wizard",
  "pilot",
  "spark",
  "blade",
  "orbit",
  "drift",
  "arc",
  "pulse",
  "quest",
  "echo",
];
const EXTRA_WORDS = [
  "mint",
  "ember",
  "opal",
  "honey",
  "ivy",
  "stormy",
  "pearl",
  "cinder",
  "echo",
  "river",
  "cedar",
  "sable",
  "maple",
  "glow",
  "drift",
  "nova",
  "ember",
  "dawn",
  "dusk",
  "breeze",
];
const CITIES = [
  "berlin",
  "hamburg",
  "muenchen",
  "koeln",
  "frankfurt",
  "leipzig",
  "bremen",
  "stuttgart",
  "duesseldorf",
  "dresden",
];
const randomLetters = (length) => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
};

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomDateBetween = (start, end) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const value = startMs + Math.random() * (endMs - startMs);
  return new Date(value);
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

const buildEmail = (index, usedEmails) => {
  const useGamerTag = Math.random() < 0.5;
  const domain = pickRandom(DOMAINS);
  let local = "";
  let attempt = 0;
  while (attempt < 20) {
    if (useGamerTag) {
      const adjective = pickRandom(GAMER_ADJECTIVES);
      const noun = pickRandom(GAMER_NOUNS);
      const extra = Math.random() < 0.35 ? pickRandom(EXTRA_WORDS) : "";
      const joiner = Math.random() < 0.25 ? "_" : Math.random() < 0.6 ? "." : "";
      const numberSuffix = Math.random() < 0.18 ? `${randomInt(1, 999)}` : "";
      const letterSuffix = Math.random() < 0.2 ? randomLetters(2) : "";
      local = slugify(`${adjective}${joiner}${noun}${extra}${letterSuffix}${numberSuffix}`);
    } else {
      const first = pickRandom(FIRST_NAMES);
      const last = pickRandom(LAST_NAMES);
      const middle = Math.random() < 0.4 ? `${pickRandom(FIRST_NAMES)[0]}.` : "";
      const city = Math.random() < 0.25 ? pickRandom(CITIES) : "";
      const extra = Math.random() < 0.3 ? pickRandom(EXTRA_WORDS) : "";
      const joiner = Math.random() < 0.3 ? "_" : Math.random() < 0.6 ? "." : "";
      const numberSuffix = Math.random() < 0.18 ? `${randomInt(1, 99)}` : "";
      const letterSuffix = Math.random() < 0.2 ? randomLetters(2) : "";
      local = slugify(
        `${first}${middle}${joiner}${last}${extra}${city}${letterSuffix}${numberSuffix}`
      );
    }
    const candidate = `${local}@${domain}`;
    if (!usedEmails.has(candidate)) {
      usedEmails.add(candidate);
      return candidate;
    }
    attempt += 1;
  }
  const fallback = `${local}.${index + 1}@${domain}`;
  usedEmails.add(fallback);
  return fallback;
};

const buildLineItems = (variants) => {
  const items = [];
  const sorted = [...variants].sort((a, b) => a.priceCents - b.priceCents);
  const cheapest = sorted[0];
  if (!cheapest) return items;

  const maxItems = 1 + (Math.random() < 0.35 ? 1 : 0) + (Math.random() < 0.1 ? 1 : 0);
  let subtotal = 0;

  for (let i = 0; i < maxItems; i += 1) {
    let variant = pickRandom(variants);
    const maxQty = Math.min(3, Math.max(1, Math.floor(50000 / variant.priceCents)));
    const quantity = Math.min(1 + (Math.random() < 0.2 ? 1 : 0), maxQty);
    const lineTotal = variant.priceCents * quantity;
    items.push({ variant, quantity });
    subtotal += lineTotal;
  }

  if (items.length === 0) {
    items.push({ variant: cheapest, quantity: 1 });
  }

  return items;
};

const toOrderItem = (entry) => {
  const { variant, quantity } = entry;
  const unitAmount = variant.priceCents;
  const totalAmount = unitAmount * quantity;
  const imageUrl = variant.product.images[0]?.url ?? null;
  return {
    name: variant.product.title,
    quantity,
    unitAmount,
    totalAmount,
    taxAmount: 0,
    taxRateBasisPoints: null,
    currency: CURRENCY,
    imageUrl,
    productId: variant.product.id,
    variantId: variant.id,
  };
};

async function main() {
  const existing = await prisma.order.findMany({
    where: { stripeSessionId: { startsWith: TEST_SESSION_PREFIX } },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.order.deleteMany({
      where: { id: { in: existing.map((order) => order.id) } },
    });
  }

  const variants = await prisma.variant.findMany({
    where: { priceCents: { gt: 0 }, product: { status: "ACTIVE" } },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          images: { orderBy: { position: "asc" }, select: { url: true } },
        },
      },
    },
  });

  if (variants.length === 0) {
    throw new Error("No active variants with priceCents > 0 found.");
  }

  const createdOrderIds = [];
  const usedEmails = new Set();
  let runningTotal = 0;

  for (let i = 0; i < TOTAL_ORDERS; i += 1) {
    if (runningTotal >= TOTAL_CENTS) break;
    const email = buildEmail(i, usedEmails);
    const items = buildLineItems(variants);
    const orderItems = items.map(toOrderItem);
    const subtotal = orderItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const shipping = 0;
    const total = subtotal;
    const status = "fulfilled";
    const createdAt = randomDateBetween(START_DATE, END_DATE);

    const userCreatedAt = createdAt;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        role: "USER",
        createdAt: userCreatedAt,
        updatedAt: userCreatedAt,
      },
    });

    const created = await prisma.order.create({
      data: {
        userId: user.id,
        stripeSessionId: `${TEST_SESSION_PREFIX}${randomUUID()}`,
        stripePaymentIntent: null,
        status,
        paymentStatus: "paid",
        currency: CURRENCY,
        amountSubtotal: subtotal,
        amountTax: 0,
        amountShipping: shipping,
        amountDiscount: 0,
        amountTotal: total,
        customerEmail: email,
        createdAt,
        updatedAt: createdAt,
        items: { create: orderItems },
      },
      select: { id: true },
    });

    createdOrderIds.push(created.id);
    runningTotal += total;
  }

  const finalSum = await prisma.order.aggregate({
    where: { id: { in: createdOrderIds } },
    _sum: { amountTotal: true },
  });
  console.log(
    `Created ${createdOrderIds.length} orders. Total EUR: ${(finalSum._sum.amountTotal ?? 0) / 100}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
