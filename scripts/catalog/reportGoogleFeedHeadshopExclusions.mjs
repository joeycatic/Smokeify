import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES = new Set([
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "filter",
  "grinder",
  "kraeuterschale",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
]);

const GOOGLE_FEED_FORCE_INCLUDE_HANDLES = new Set([
  "homebox-ambient-q-80-plus",
  "secret-jardin-hydro-shoot-100-grow-set-100-100-200-cm",
  "secret-jardin-hydro-shoot-100-grow-set-120-120-200-cm",
  "secret-jardin-hydro-shoot-60-grow-set-60-60-158-cm",
  "secret-jardin-hydro-shoot-80-grow-set-80-80-188-cm",
]);

const HEADSHOP_SIGNAL_TERMS = [
  "headshop",
  "bong",
  "bongs",
  "pipe",
  "pipes",
  "grinder",
  "grinders",
  "papers",
  "rolling-tray",
  "vaporizer",
  "tubes",
  "kraeuterschale",
  "hash-bowl",
  "stash",
];

const classifyProduct = (product) => {
  const normalizedHandle = String(product.handle ?? "").toLowerCase();
  if (GOOGLE_FEED_FORCE_INCLUDE_HANDLES.has(normalizedHandle)) {
    return {
      excluded: false,
      forceIncluded: true,
      matchedCategoryHandles: [],
      matchedSignalTerms: [],
      reasons: ["force_include"],
    };
  }

  const categoryHandles = [
    product.mainCategory?.handle ?? "",
    product.mainCategory?.parent?.handle ?? "",
    ...product.categories.map(({ category }) => category.handle),
    ...product.categories.map(({ category }) => category.parent?.handle ?? ""),
  ]
    .map((entry) => String(entry).toLowerCase())
    .filter(Boolean);

  const matchedCategoryHandles = categoryHandles.filter((handle) =>
    GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(handle)
  );

  const headshopSignalHaystack = [
    product.handle,
    product.title,
    product.description ?? "",
    product.shortDescription ?? "",
    ...(product.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const matchedSignalTerms = HEADSHOP_SIGNAL_TERMS.filter((term) =>
    headshopSignalHaystack.includes(term)
  );

  const reasons = [];
  if (matchedCategoryHandles.length > 0) reasons.push("category_match");
  if (matchedSignalTerms.length > 0) reasons.push("term_match");

  return {
    excluded: reasons.length > 0,
    forceIncluded: false,
    matchedCategoryHandles: Array.from(new Set(matchedCategoryHandles)),
    matchedSignalTerms: Array.from(new Set(matchedSignalTerms)),
    reasons,
  };
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };
  const parsedLimit = Number(getValue("--limit") ?? "0");
  const format = (getValue("--format") ?? "json").toLowerCase();
  const only = (getValue("--only") ?? "both").toLowerCase();
  const out = getValue("--out");
  return {
    format:
      format === "summary" || format === "handles" || format === "json"
        ? format
        : "json",
    only: only === "included" || only === "excluded" || only === "both" ? only : "both",
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 0,
    out: out ? out.trim() : null,
  };
};

const applyLimit = (items, limit) => (limit > 0 ? items.slice(0, limit) : items);

const buildOutput = ({ format, only, limit, included, excluded, total }) => {
  const limitedIncluded = applyLimit(included, limit);
  const limitedExcluded = applyLimit(excluded, limit);

  if (format === "summary") {
    return JSON.stringify(
      {
        totals: {
          activeProducts: total,
          included: included.length,
          excluded: excluded.length,
        },
      },
      null,
      2
    );
  }

  if (format === "handles") {
    const lines = [];
    lines.push(`activeProducts=${total}`);
    lines.push(`included=${included.length}`);
    lines.push(`excluded=${excluded.length}`);
    if (only === "both" || only === "excluded") {
      lines.push("");
      lines.push("[excluded handles]");
      for (const item of limitedExcluded) {
        lines.push(item.handle);
      }
    }
    if (only === "both" || only === "included") {
      lines.push("");
      lines.push("[included handles]");
      for (const item of limitedIncluded) {
        lines.push(item.handle);
      }
    }
    return lines.join("\n");
  }

  return JSON.stringify(
    {
      totals: {
        activeProducts: total,
        included: included.length,
        excluded: excluded.length,
      },
      ...(only === "both" || only === "excluded"
        ? { excluded: limitedExcluded }
        : {}),
      ...(only === "both" || only === "included"
        ? { included: limitedIncluded }
        : {}),
      ...(limit > 0
        ? {
            note: `Lists limited to ${limit} item(s). Totals reflect full result set.`,
          }
        : {}),
    },
    null,
    2
  );
};

const writeOutput = (outPath, text) => {
  if (!outPath) {
    console.log(text);
    return;
  }
  const absolute = path.isAbsolute(outPath)
    ? outPath
    : path.join(process.cwd(), outPath);
  fs.writeFileSync(absolute, text, "utf8");
  console.log(`[report] Wrote output to ${absolute}`);
};

const run = async () => {
  const { format, only, limit, out } = parseArgs();
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      handle: true,
      description: true,
      shortDescription: true,
      tags: true,
      mainCategory: {
        select: {
          handle: true,
          parent: { select: { handle: true } },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              handle: true,
              parent: { select: { handle: true } },
            },
          },
        },
      },
    },
  });

  const included = [];
  const excluded = [];

  for (const product of products) {
    const result = classifyProduct(product);
    const row = {
      id: product.id,
      title: product.title,
      handle: product.handle,
      reasons: result.reasons,
      forceIncluded: result.forceIncluded,
      categoryMatches: result.matchedCategoryHandles,
      termMatches: result.matchedSignalTerms,
    };
    if (result.excluded) {
      excluded.push(row);
    } else {
      included.push(row);
    }
  }

  const output = buildOutput({
    format,
    only,
    limit,
    included,
    excluded,
    total: products.length,
  });
  writeOutput(out, output);
};

run()
  .catch((error) => {
    console.error("[report] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
