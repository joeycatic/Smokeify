import fs from "fs";
import { pathToFileURL } from "node:url";

const DEFAULT_URL = "https://bloomtech.de/Biobizz_1";
const DEFAULT_PRODUCT_URL = "https://bloomtech.de/BioBizz-Bio-Grow-250-ml";
const DEFAULT_LIMIT = 50;
const REQUEST_DELAY_MS = 500;
const DEFAULT_EMAIL_FIELD = "email";
const DEFAULT_PASSWORD_FIELD = "passwort";
const DEFAULT_LOGIN_URL = "https://bloomtech.de/Konto";
const DEFAULT_LOGIN_SUBMIT_FIELD = "login";
const DEFAULT_LOGIN_SUBMIT_VALUE = "1";
const DEFAULT_LOGIN_CHECK_REGEX =
  /(abmelden|logout|mein konto|mein kundenkonto)/i;
const STATUS_REGEX =
  /<span[^>]*class=["'][^"']*status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const PLANTPLANET_STATUS_REGEX =
  /<div[^>]*class=["'][^"']*status[^"']*["'][^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtmlEntities = (value) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });

const stripTags = (html) => {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  return withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
};

const normalizeText = (value) =>
  decodeHtmlEntities(value).replace(/\s+/g, " ").trim();

const countMatches = (value, regex) => {
  const matches = value.match(regex);
  return matches ? matches.length : 0;
};

const extractHrefFromTag = (tag) => {
  const match = tag.match(/\bhref=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const hasShortDescriptionBlock = (html) =>
  /class=["'][^"']*\bshortdesc\b/i.test(html);

const hasProductAttributesBlock = (html) =>
  /class=["'][^"']*\bproduct-attributes\b/i.test(html);

const hasSortingControls = (html) => /Sortierung=/.test(html);

const hasExactProductBuyForm = (html) => /id=["']buy_form["']/i.test(html);

const hasListingBuyForms = (html) =>
  countMatches(html, /id=["']buy_form_[^"']+["']/gi) >= 2;

const extractEcommercePageType = (html) => {
  const match = html.match(/ecomm_pagetype:\s*['"]([a-z]+)['"]/i);
  return match ? match[1].toLowerCase() : null;
};

const detectBloomtechPageKind = (html, text) => {
  const ecommercePageType = extractEcommercePageType(html);
  if (ecommercePageType === "product") return "product";
  if (ecommercePageType === "category") return "category";

  if (
    hasExactProductBuyForm(html) &&
    (hasShortDescriptionBlock(html) || hasProductAttributesBlock(html))
  ) {
    return "product";
  }

  const listingSignals = [
    hasSortingControls(html),
    hasListingBuyForms(html),
    countMatches(
      html,
      /<a\b(?=[^>]*href=["'][^"']+["'])(?=[^>]*class=["'][^"']*\bimg-w\b[^"']*["'])[^>]*>/gi
    ) >= 2,
    countMatches(
      html,
      /<a\b(?=[^>]*href=["'][^"']+["'])(?=[^>]*class=["'][^"']*\btitle\b[^"']*\bblock\b[^"']*\bh4\b[^"']*\bm0\b[^"']*["'])[^>]*>/gi
    ) >= 2,
  ].filter(Boolean).length;

  if (listingSignals > 0) return "category";

  if (
    hasExactProductBuyForm(html) &&
    /<meta[^>]*itemprop=["']price["']/i.test(html)
  ) {
    return "product";
  }

  if (isLikelyProductPage(text)) return "product";
  return "unknown";
};

const normalizeBloomtechListingLink = (raw, baseUrl) => {
  try {
    const url = new URL(raw, baseUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "bloomtech.de" && hostname !== "www.bloomtech.de") {
      return null;
    }
    if (url.search || url.hash) return null;
    if (url.pathname.endsWith("/favicon.ico") || url.pathname === "/favicon.ico") {
      return null;
    }
    if (url.pathname.startsWith("/media/")) return null;
    const lowerPath = url.pathname.toLowerCase();
    if (
      [
        "/konto",
        "/warenkorb",
        "/blog",
        "/kontakt",
        "/datenschutz",
        "/impressum",
        "/agb",
        "/widerruf",
        "/zahlung",
        "/versand",
        "/service",
        "/info",
      ].some((prefix) => lowerPath.startsWith(prefix))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const extractProductLinksFromCategory = (html, baseUrl) => {
  const links = new Set();
  const cardRegexes = [
    /<a\b(?=[^>]*href=["'][^"']+["'])(?=[^>]*class=["'][^"']*\bimg-w\b[^"']*["'])[^>]*>/gi,
    /<a\b(?=[^>]*href=["'][^"']+["'])(?=[^>]*class=["'][^"']*\btitle\b[^"']*\bblock\b[^"']*\bh4\b[^"']*\bm0\b[^"']*["'])[^>]*>/gi,
  ];

  for (const regex of cardRegexes) {
    let linkMatch;
    while ((linkMatch = regex.exec(html))) {
      const raw = extractHrefFromTag(linkMatch[0]);
      if (!raw) continue;
      const normalized = normalizeBloomtechListingLink(raw, baseUrl);
      if (!normalized) continue;
      links.add(normalized);
    }
  }

  return Array.from(links);
};

const extractProductLinksFromJsonLd = (html, baseUrl) => {
  const links = new Set();
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    const payload = match[1].trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        if (item["@type"] !== "ItemList") return;
        const list = Array.isArray(item.itemListElement)
          ? item.itemListElement
          : [];
        list.forEach((entry) => {
          if (!entry || typeof entry !== "object") return;
          const rawUrl =
            entry.url ||
            (entry.item && typeof entry.item === "object" ? entry.item.url : null);
          if (!rawUrl || typeof rawUrl !== "string") return;
          try {
            const url = new URL(rawUrl, baseUrl);
            if (url.hostname !== "bloomtech.de") return;
            if (url.search || url.hash) return;
            if (url.pathname.endsWith("/favicon.ico") || url.pathname === "/favicon.ico") {
              return;
            }
            links.add(url.toString());
          } catch {
            // ignore bad URLs
          }
        });
      });
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return Array.from(links);
};

const buildAllowedSlugSetFromCategory = (html) => {
  const set = new Set();
  const match = html.match(/data-product-slugs=["']([^"']+)["']/i);
  if (!match) return set;
  const payload = match[1];
  payload
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .forEach((slug) => set.add(slug));
  return set;
};

const isLikelyProductPage = (text) =>
  text.includes("Artikelnummer:") && text.includes("Beschreibung");

const extractTitle = (html) => {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return normalizeText(stripTags(h1Match[1]));
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? normalizeText(stripTags(titleMatch[1])) : "";
};

const extractField = (text, label) => {
  const regex = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
};

const normalizeGtin = (value) => {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (![8, 12, 13, 14].includes(digits.length)) return "";
  return digits;
};

const extractGtinFromText = (text) => {
  const candidates = [
    extractField(text, "GTIN"),
    extractField(text, "EAN"),
    extractField(text, "EAN-13"),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeGtin(candidate);
    if (normalized) return normalized;
  }
  return "";
};

const extractGtinFromTechnicalDetails = (technicalDetails) => {
  if (typeof technicalDetails !== "string" || !technicalDetails.trim()) return "";
  const match = technicalDetails.match(
    /(?:^|;\s*)(?:GTIN|EAN|EAN-13)\s*:\s*([0-9][0-9\s-]{6,20})/i
  );
  if (!match) return "";
  return normalizeGtin(match[1]);
};

const extractDescription = (text) => {
  const start = text.indexOf("Beschreibung");
  if (start === -1) return "";
  const after = text.slice(start + "Beschreibung".length).trim();
  const endMarkers = [
    "Preisverlauf",
    "Datenblatt",
    "Informationen zur Produktsicherheit",
    "Ähnliche Artikel",
    "Kunden kauften",
    "Oft dazu gekauft",
    "Artikelgewicht:",
  ];
  let endIndex = after.length;
  for (const marker of endMarkers) {
    const idx = after.indexOf(marker);
    if (idx !== -1 && idx < endIndex) endIndex = idx;
  }
  return after
    .slice(0, endIndex)
    .replace(/^[:\-\s]+/, "")
    .trim();
};

const extractPriceFromHtml = (html) => {
  const match = html.match(
    /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  if (!match) return null;
  const normalized = match[1].replace(",", ".").trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const extractSupplierImagesFromHtml = (html, pageUrl) => {
  const extractFromBloomtechGallery = () => {
    const extractDivBlockById = (markup, id) => {
      const openRegex = new RegExp(
        `<div[^>]*id=["']${id}["'][^>]*>`,
        "i"
      );
      const openMatch = openRegex.exec(markup);
      if (!openMatch || openMatch.index < 0) return "";

      const start = openMatch.index;
      const firstTagEnd = start + openMatch[0].length;
      let depth = 1;
      const divTagRegex = /<\/?div\b[^>]*>/gi;
      divTagRegex.lastIndex = firstTagEnd;

      let tagMatch;
      while ((tagMatch = divTagRegex.exec(markup))) {
        const tag = tagMatch[0];
        const isClosing = /^<\s*\/div/i.test(tag);
        if (isClosing) {
          depth -= 1;
          if (depth === 0) {
            return markup.slice(start, divTagRegex.lastIndex);
          }
        } else {
          depth += 1;
        }
      }

      return "";
    };

    const galleryHtml = extractDivBlockById(html, "gallery");
    if (!galleryHtml) return [];

    const urls = new Set();
    const addUrl = (raw) => {
      if (!raw || typeof raw !== "string") return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      try {
        const absolute = new URL(trimmed, pageUrl);
        if (!/^https?:$/i.test(absolute.protocol)) return;
        absolute.hash = "";
        const pathname = absolute.pathname.toLowerCase();
        if (!pathname.includes("/media/image/product/")) return;
        if (!/\.(jpe?g|png|webp|avif)$/i.test(pathname)) return;
        urls.add(absolute.toString());
      } catch {
        // ignore invalid URLs
      }
    };

    const gallerySignals = [
      /<div[^>]*id=["']gallery["'][^>]*>/i.test(galleryHtml),
      /class=["'][^"']*\bimg-ct\b[^"']*["']/i.test(galleryHtml),
      /data-index=["'][^"']+["']/i.test(galleryHtml),
    ];
    if (!gallerySignals.some(Boolean)) return [];

    const indexedGalleryImages = new Map();
    const dataHrefRegex =
      /<a[^>]*data-href=["']([^"']+)["'][^>]*data-index=["']([^"']+)["'][^>]*>/gi;
    let dataHrefMatch;
    while ((dataHrefMatch = dataHrefRegex.exec(galleryHtml))) {
      const rawUrl = dataHrefMatch[1];
      const rawIndex = Number(dataHrefMatch[2]);
      addUrl(rawUrl);
      if (!Number.isFinite(rawIndex)) continue;
      try {
        const absolute = new URL(rawUrl, pageUrl);
        absolute.hash = "";
        const pathname = absolute.pathname.toLowerCase();
        if (
          /^https?:$/i.test(absolute.protocol) &&
          pathname.includes("/media/image/product/") &&
          /\.(jpe?g|png|webp|avif)$/i.test(pathname)
        ) {
          indexedGalleryImages.set(rawIndex, absolute.toString());
        }
      } catch {
        // ignore invalid URLs
      }
    }

    const imgCtRegex =
      /<div[^>]*class=["'][^"']*\bimg-ct\b[^"']*["'][^>]*data-src=["']([^"']+)["'][^>]*>/gi;
    let imgCtMatch;
    while ((imgCtMatch = imgCtRegex.exec(galleryHtml))) {
      addUrl(imgCtMatch[1]);
    }

    const sourceRegex = /<source[^>]*srcset=["']([^"']+)["'][^>]*>/gi;
    let sourceMatch;
    while ((sourceMatch = sourceRegex.exec(galleryHtml))) {
      sourceMatch[1]
        .split(",")
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean)
        .forEach((entry) => addUrl(entry));
    }

    const pictureImgRegex =
      /<img[^>]*class=["'][^"']*\bproduct-image\b[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    let pictureImgMatch;
    while ((pictureImgMatch = pictureImgRegex.exec(galleryHtml))) {
      addUrl(pictureImgMatch[1]);
    }

    if (indexedGalleryImages.size > 0) {
      return Array.from(indexedGalleryImages.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
    }

    return Array.from(urls);
  };

  const rankAndDedupe = (rawUrls) => {
    const normalized = rawUrls
      .map((entry) => {
        try {
          const parsed = new URL(entry);
          const pathname = parsed.pathname.toLowerCase();
          let score = 0;
          if (/\/media\/image\/product\//i.test(pathname)) score += 120;
          if (/\/(lg|xl|original)\//i.test(pathname)) score += 40;
          if (/\/(sm|xs)\//i.test(pathname)) score -= 20;
          if (/\.webp$/i.test(pathname)) score += 5;
          return { url: parsed.toString(), pathname, score };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

    const seenFamilies = new Set();
    const unique = [];
    for (const entry of normalized) {
      const familyKey = entry.pathname
        .replace(/\/(xs|sm|md|lg|xl)\//gi, "/")
        .replace(/\.(jpe?g|png|webp|avif)$/i, "");
      if (seenFamilies.has(familyKey)) continue;
      seenFamilies.add(familyKey);
      unique.push(entry.url);
    }
    return unique;
  };

  const galleryImages = rankAndDedupe(extractFromBloomtechGallery());
  if (galleryImages.length > 0) return galleryImages;

  const candidates = new Map();
  const pagePath = (() => {
    try {
      return new URL(pageUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const slugTokens = pagePath
    .split("/")
    .pop()
    ?.split("-")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 4) ?? [];

  const blockedPathFragments = [
    "/media/image/category/",
    "/media/image/manufacturer/",
    "/media/image/storage/",
    "/favicon",
    "/mibew/",
    "sprite",
    "placeholder",
    "icon",
    "logo",
    "banner",
  ];

  const addCandidate = (raw, source) => {
    if (!raw || typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      const absolute = new URL(trimmed, pageUrl);
      if (!/^https?:$/i.test(absolute.protocol)) return;
      absolute.hash = "";
      const pathname = absolute.pathname.toLowerCase();
      if (!/\.(jpe?g|png|webp|avif)$/i.test(pathname)) return;
      if (blockedPathFragments.some((fragment) => pathname.includes(fragment))) {
        return;
      }
      const normalized = absolute.toString();
      const existing = candidates.get(normalized);
      if (existing) {
        existing.sources.add(source);
        return;
      }
      const productPathMatch = pathname.match(/\/media\/image\/product\/(\d+)\//);
      candidates.set(normalized, {
        url: normalized,
        pathname,
        productId: productPathMatch ? productPathMatch[1] : null,
        sources: new Set([source]),
      });
    } catch {
      // ignore invalid image URLs
    }
  };

  const ogRegex =
    /<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  let ogMatch;
  while ((ogMatch = ogRegex.exec(html))) {
    addCandidate(ogMatch[1], "og");
  }

  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html))) {
    const payload = scriptMatch[1].trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item["@type"] !== "Product") continue;
        const candidate = item.image;
        if (typeof candidate === "string") {
          addCandidate(candidate, "jsonld");
        } else if (Array.isArray(candidate)) {
          candidate.forEach((entry) => addCandidate(entry, "jsonld"));
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }

  const imgRegex =
    /<img[^>]*(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html))) {
    addCandidate(imgMatch[1], "img");
  }

  const srcsetRegex =
    /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  let srcsetMatch;
  while ((srcsetMatch = srcsetRegex.exec(html))) {
    srcsetMatch[1]
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .forEach((entry) => addCandidate(entry, "srcset"));
  }

  const allCandidates = Array.from(candidates.values());
  if (allCandidates.length === 0) return [];

  const strongProductIds = allCandidates
    .filter(
      (entry) =>
        entry.productId &&
        (entry.sources.has("og") || entry.sources.has("jsonld"))
    )
    .map((entry) => entry.productId);

  const selectedProductId = (() => {
    if (strongProductIds.length === 0) return null;
    const counts = new Map();
    strongProductIds.forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const scopedCandidates = selectedProductId
    ? allCandidates.filter((entry) => entry.productId === selectedProductId)
    : allCandidates.filter((entry) => entry.pathname.includes("/media/image/product/"));

  const scoringPool = scopedCandidates.length > 0 ? scopedCandidates : allCandidates;
  const scored = scoringPool
    .map((entry) => {
      const filename = entry.pathname.split("/").pop() ?? "";
      let score = 0;
      if (entry.sources.has("og")) score += 120;
      if (entry.sources.has("jsonld")) score += 100;
      if (entry.pathname.includes("/media/image/product/")) score += 80;
      if (/\/(lg|xl|original)\//i.test(entry.pathname)) score += 40;
      if (/\/(sm|xs)\//i.test(entry.pathname)) score -= 25;
      if (slugTokens.some((token) => filename.includes(token))) score += 30;
      return { url: entry.url, score };
    })
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

  return rankAndDedupe(scored.map((entry) => entry.url));
};

const extractManufacturerFromHtml = (html) => {
  const metaMatch = html.match(
    /<meta[^>]*itemprop=["']brand["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  if (metaMatch) {
    return normalizeText(metaMatch[1]);
  }
  const spanMatch = html.match(
    /<[^>]*itemprop=["']brand["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  );
  if (spanMatch) {
    return normalizeText(stripTags(spanMatch[1]));
  }
  const manufacturerMatch = html.match(
    /<[^>]*itemprop=["']manufacturer["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  );
  if (manufacturerMatch) {
    return normalizeText(stripTags(manufacturerMatch[1]));
  }
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    const payload = match[1].trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        if (type !== "Product") continue;
        const brand = item.brand;
        if (typeof brand === "string") return normalizeText(brand);
        if (brand && typeof brand === "object" && brand.name) {
          return normalizeText(String(brand.name));
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return "";
};

const slugifyHandle = (value) => {
  const normalized = decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "item";
};

const buildHandleBase = (title, manufacturer) => {
  const safeTitle = (title || "").trim();
  const safeManufacturer = (manufacturer || "").trim();
  if (safeTitle && safeManufacturer) {
    return `${safeTitle} ${safeManufacturer}`;
  }
  return safeTitle || safeManufacturer || "item";
};

const parseStockFromHtml = (html) => {
  const match = html.match(STATUS_REGEX);
  if (!match) return { statusText: null, quantity: null, inStock: null };
  const statusText = normalizeText(match[1]);
  const lower = statusText.toLowerCase();
  if (lower.includes("bald wieder auf lager")) {
    return { statusText, quantity: 0, inStock: false };
  }
  if (lower.includes("auf lager")) {
    const qtyMatch = statusText.match(/(\d+)/);
    if (!qtyMatch) return { statusText, quantity: null, inStock: true };
    return { statusText, quantity: Number(qtyMatch[1]), inStock: true };
  }
  return { statusText, quantity: 0, inStock: false };
};

const parseB2BHeadshopStock = (html) => {
  const match = html.match(STATUS_REGEX);
  const statusText = match ? normalizeText(match[1]) : "";
  const lower = statusText.toLowerCase();
  if (/sofort\s+verf(u|ü)gbar/.test(lower)) {
    return { statusText, quantity: 20, inStock: true };
  }

  const hasSchemaInStock =
    html.toLowerCase().includes('itemprop="availability"') &&
    html.toLowerCase().includes("schema.org/instock");
  if (hasSchemaInStock) {
    return { statusText: statusText || "InStock", quantity: 20, inStock: true };
  }

  if (!match) {
    return { statusText: null, quantity: null, inStock: null };
  }

  return { statusText, quantity: 0, inStock: false };
};

const parsePlantPlanetStock = (html) => {
  const match = html.match(PLANTPLANET_STATUS_REGEX);
  const statusText = match ? normalizeText(match[1]) : "";
  const lower = statusText.toLowerCase();
  if (!statusText) {
    return { statusText: null, quantity: null, inStock: null };
  }
  if (lower.includes("nicht auf lager")) {
    return { statusText, quantity: 0, inStock: false };
  }
  const qtyMatch = statusText.match(/(\d+)/);
  if (qtyMatch) {
    return { statusText, quantity: Number(qtyMatch[1]), inStock: true };
  }
  if (lower.includes("auf lager")) {
    return { statusText, quantity: null, inStock: true };
  }
  return { statusText, quantity: 0, inStock: false };
};

const parseStockForUrl = (url, html) => {
  const normalized = url.toLowerCase();
  if (normalized.includes("plantplanet.de")) {
    return parsePlantPlanetStock(html);
  }
  if (normalized.includes("b2b-headshop.de")) {
    return parseB2BHeadshopStock(html);
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("plantplanet.de")) {
      return parsePlantPlanetStock(html);
    }
    if (host.includes("b2b-headshop.de")) {
      return parseB2BHeadshopStock(html);
    }
  } catch {
    // ignore bad URL and fall back
  }
  return parseStockFromHtml(html);
};

const extractShortDescriptionFromHtml = (html) => {
  const match = html.match(
    /<div[^>]*class=["'][^"']*\bshortdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!match) return "";
  return normalizeText(stripTags(match[1]));
};

const buildShortDescription = (description) => {
  if (!description) return "";
  const sentenceEnd = description.indexOf(". ");
  const short =
    sentenceEnd > 0 ? description.slice(0, sentenceEnd + 1) : description;
  return short.length > 180 ? `${short.slice(0, 177).trim()}...` : short;
};

const buildTechnicalDetails = (text) => {
  const artikelnummer = extractField(text, "Artikelnummer");
  const gtin = extractField(text, "GTIN");
  const gewicht = extractField(text, "Artikelgewicht");
  const parts = [];
  if (artikelnummer) parts.push(`Artikelnummer: ${artikelnummer}`);
  if (gtin) parts.push(`GTIN: ${gtin}`);
  if (gewicht) parts.push(`Artikelgewicht: ${gewicht}`);
  return parts.join("; ");
};

const extractTechnicalDetailsFromHtml = (html) => {
  const match = html.match(
    /<ul[^>]*class=["'][^"']*\bproduct-attributes\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  );
  if (!match) return "";
  const items = match[1]
    .split(/<\/li>/i)
    .map((chunk) => normalizeText(stripTags(chunk)))
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const [rawKey, ...rest] = item.split(":");
    if (rest.length === 0) {
      const key = item.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      continue;
    }
    const key = rawKey.toLowerCase().replace(/\s+/g, " ").trim();
    const value = rest.join(":").trim();
    const valueKey = value.toLowerCase().replace(/\s+/g, "");
    const signature = `${key}:${valueKey}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(`${rawKey.trim()}: ${value}`);
  }
  return deduped.join("; ");
};

const extractSupplierWeightFromHtml = (html) => {
  const match = html.match(
    /<ul[^>]*class=["'][^"']*\bproduct-attributes\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!match) return { raw: "", grams: null };
  const text = normalizeText(stripTags(match[1]));
  const weightMatch = text.match(/Artikelgewicht[:\s]+([\d.,]+)\s*(kg|g)/i);
  if (!weightMatch) return { raw: "", grams: null };
  const rawValue = weightMatch[1].replace(",", ".").trim();
  const unit = weightMatch[2].toLowerCase();
  const amount = Number(rawValue);
  if (!Number.isFinite(amount)) return { raw: "", grams: null };
  const grams = unit === "kg" ? Math.round(amount * 1000) : Math.round(amount);
  return { raw: `${amount} ${unit}`, grams };
};

const createCookieJar = () => {
  const store = new Map();
  return {
    setFromSetCookieHeaders: (headers) => {
      headers.forEach((header) => {
        const [cookiePart] = header.split(";");
        const [name, ...rest] = cookiePart.split("=");
        if (!name) return;
        store.set(name.trim(), rest.join("=").trim());
      });
    },
    setFromCookieString: (value) => {
      value.split(";").forEach((pair) => {
        const [name, ...rest] = pair.split("=");
        if (!name) return;
        store.set(name.trim(), rest.join("=").trim());
      });
    },
    header: () =>
      Array.from(store.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    names: () => Array.from(store.keys()),
  };
};

const getSetCookieHeaders = (res) => {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  if (typeof res.headers.raw === "function") {
    return res.headers.raw()["set-cookie"] ?? [];
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
};

const fetchHtml = async (url, cookieJar) => {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifyImportPreview/1.0; +https://smokeify.local)",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      ...(cookieJar?.header() ? { cookie: cookieJar.header() } : {}),
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  if (cookieJar) {
    const setCookies = getSetCookieHeaders(res);
    if (setCookies.length > 0) {
      cookieJar.setFromSetCookieHeaders(setCookies);
    }
  }
  return res.text();
};

const parseHiddenInputs = (html) => {
  const inputs = {};
  const regex =
    /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html))) {
    inputs[match[1]] = match[2];
  }
  return inputs;
};

const parseFormAction = (html) => {
  const match = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
  return match ? match[1] : null;
};

const findLoginFormHtml = (html, { emailField, passwordField, submitField }) => {
  const formRegex = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html))) {
    const formHtml = match[0];
    const hasEmail = emailField
      ? new RegExp(`name=["']${emailField}["']`, "i").test(formHtml)
      : false;
    const hasPassword = passwordField
      ? new RegExp(`name=["']${passwordField}["']`, "i").test(formHtml)
      : false;
    const hasSubmit = submitField
      ? new RegExp(`name=["']${submitField}["']`, "i").test(formHtml)
      : false;
    if (hasPassword || (hasEmail && hasSubmit)) {
      return formHtml;
    }
  }
  return null;
};

const loginBloomtech = async (cookieJar, { dumpLogin, dumpLoginResponse } = {}) => {
  const loginUrl = process.env.BLOOMTECH_LOGIN_URL ?? DEFAULT_LOGIN_URL;
  const email = process.env.BLOOMTECH_EMAIL;
  const password = process.env.BLOOMTECH_PASSWORD;
  if (!loginUrl || !email || !password) {
    if (process.env.BLOOMTECH_DEBUG === "1") {
      console.log(
        "[preview] Login skipped. Missing BLOOMTECH_EMAIL or BLOOMTECH_PASSWORD."
      );
    }
    return;
  }

  const emailField = process.env.BLOOMTECH_EMAIL_FIELD ?? DEFAULT_EMAIL_FIELD;
  const passwordField =
    process.env.BLOOMTECH_PASSWORD_FIELD ?? DEFAULT_PASSWORD_FIELD;
  const submitField =
    process.env.BLOOMTECH_LOGIN_SUBMIT_FIELD ?? DEFAULT_LOGIN_SUBMIT_FIELD;
  const submitValue =
    process.env.BLOOMTECH_LOGIN_SUBMIT_VALUE ?? DEFAULT_LOGIN_SUBMIT_VALUE;
  const loginCheckRegex = new RegExp(
    process.env.BLOOMTECH_LOGIN_CHECK_REGEX ?? DEFAULT_LOGIN_CHECK_REGEX
  );

  const loginPageHtml = await fetchHtml(loginUrl, cookieJar);
  if (dumpLogin) {
    await fs.promises.writeFile(dumpLogin, loginPageHtml, "utf8");
  }
  const loginFormHtml =
    findLoginFormHtml(loginPageHtml, { emailField, passwordField, submitField }) ??
    loginPageHtml;
  const hiddenInputs = parseHiddenInputs(loginFormHtml);
  const action = parseFormAction(loginFormHtml);
  const postUrl = action ? new URL(action, loginUrl).toString() : loginUrl;

  const body = new URLSearchParams({
    ...hiddenInputs,
    [emailField]: email,
    [passwordField]: password,
    ...(submitField ? { [submitField]: submitValue } : {}),
  });

  const res = await fetch(postUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifyImportPreview/1.0; +https://smokeify.local)",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      ...(cookieJar.header() ? { cookie: cookieJar.header() } : {}),
    },
    body,
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }
  const setCookies = getSetCookieHeaders(res);
  if (setCookies.length > 0) {
    cookieJar.setFromSetCookieHeaders(setCookies);
  }
  if (dumpLoginResponse) {
    const responseHtml = await res.text();
    await fs.promises.writeFile(dumpLoginResponse, responseHtml, "utf8");
  }
  if (process.env.BLOOMTECH_DEBUG === "1") {
    console.log(`[preview] cookie names after login: ${cookieJar.names().join(", ")}`);
  }
  const accountHtml = await fetchHtml(loginUrl, cookieJar);
  if (!loginCheckRegex.test(accountHtml)) {
    console.warn("[preview] Login check failed. Prices may be guest prices.");
  }
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };
  const requestedMode = getValue("--mode");
  const mode = requestedMode === "product" ? "product" : "category";
  const url =
    getValue("--url") ?? (mode === "product" ? DEFAULT_PRODUCT_URL : DEFAULT_URL);
  const parsedLimit = Number(getValue("--limit") ?? DEFAULT_LIMIT);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.floor(parsedLimit)
      : DEFAULT_LIMIT;
  const out =
    getValue("--out") ?? "scripts/bloomtech/supplier-preview.json";
  const dumpCategory = getValue("--dump-category");
  const dumpAccount = getValue("--dump-account");
  const dumpLogin = getValue("--dump-login");
  const dumpLoginResponse = getValue("--dump-login-response");
  return {
    mode,
    url,
    limit,
    out,
    dumpCategory,
    dumpAccount,
    dumpLogin,
    dumpLoginResponse,
  };
};

const loadDotEnvFile = async () => {
  const envPath = " .env";
  const envFilePath = envPath.trim();
  if (fs.existsSync(envFilePath)) {
    const content = await fs.promises.readFile(envFilePath, "utf8");
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .forEach((line) => {
        const index = line.indexOf("=");
        if (index === -1) return;
        const key = line.slice(0, index).trim();
        if (!key || process.env[key]) return;
        let value = line.slice(index + 1).trim();
        if (
          (value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      });
  }
};

export const runBloomtechSupplierPreview = async ({
  mode = "category",
  url = mode === "product" ? DEFAULT_PRODUCT_URL : DEFAULT_URL,
  limit = DEFAULT_LIMIT,
  out = "scripts/bloomtech/supplier-preview.json",
  dumpCategory = null,
  dumpAccount = null,
  dumpLogin = null,
  dumpLoginResponse = null,
  loadEnvFile = true,
  persistOutput = true,
  logger = console,
} = {}) => {
  if (loadEnvFile) {
    await loadDotEnvFile();
  }
  const cookieJar = createCookieJar();
  const cookieOverride = process.env.BLOOMTECH_COOKIE;
  if (cookieOverride) {
    cookieJar.setFromCookieString(cookieOverride);
    if (process.env.BLOOMTECH_DEBUG === "1") {
      logger.log("[preview] Using BLOOMTECH_COOKIE auth.");
    }
  } else {
    await loginBloomtech(cookieJar, { dumpLogin, dumpLoginResponse });
  }
  if (dumpAccount) {
    const accountHtml = await fetchHtml(DEFAULT_LOGIN_URL, cookieJar);
    await fs.promises.writeFile(dumpAccount, accountHtml, "utf8");
  }
  const categoryHtml = await fetchHtml(url, cookieJar);
  if (dumpCategory) {
    await fs.promises.writeFile(dumpCategory, categoryHtml, "utf8");
  }
  const seedText = normalizeText(stripTags(categoryHtml));
  const seedKind = detectBloomtechPageKind(categoryHtml, seedText);
  let allowedSlugs = new Set();
  let jsonLdLinks = [];
  let productLinks = [];
  let links = [];
  let prefetchedPages = new Map();

  if (mode === "product") {
    if (seedKind !== "product") {
      throw new Error(
        "Provided URL is not a Bloomtech product page. Use the Bloomtech category scraper for listing URLs.",
      );
    }
    links = [url];
    prefetchedPages = new Map([[url, { html: categoryHtml, text: seedText }]]);
    logger.log(`[preview] source=product links=1 url=${url}`);
  } else {
    if (seedKind === "product") {
      throw new Error(
        "Provided URL is a Bloomtech product page. Use the Bloomtech product scraper for direct product links.",
      );
    }
    allowedSlugs = buildAllowedSlugSetFromCategory(categoryHtml);
    jsonLdLinks = extractProductLinksFromJsonLd(categoryHtml, url);
    productLinks = extractProductLinksFromCategory(categoryHtml, url);
    links = Array.from(new Set([...productLinks, ...jsonLdLinks]));
    if (allowedSlugs.size > 0) {
      links = links.filter((link) => {
        const slug = new URL(link).pathname.replace(/^\/+/, "");
        return allowedSlugs.has(slug);
      });
    }
    if (links.length === 0) {
      throw new Error(
        "No Bloomtech product links were found on this listing page. Use a category or brand listing URL that shows product cards.",
      );
    }
    logger.log(
      `[preview] source=category links=${links.length} jsonLd=${jsonLdLinks.length} productCards=${productLinks.length} url=${url}`,
    );
  }

  const previews = [];
  const handleCounts = new Map();
  let checked = 0;

  for (const link of links) {
    if (previews.length >= limit) break;
    try {
      const prefetchedPage = prefetchedPages.get(link);
      const html = prefetchedPage?.html ?? (await fetchHtml(link, cookieJar));
      const text = prefetchedPage?.text ?? normalizeText(stripTags(html));
      checked += 1;
      if (detectBloomtechPageKind(html, text) !== "product") {
        logger.warn(`[preview] Skipped ${link}: expected product page.`);
        continue;
      }
      if (allowedSlugs.size > 0) {
        const slug = new URL(link).pathname.replace(/^\/+/, "");
        if (!allowedSlugs.has(slug)) continue;
      }
      const title = extractTitle(html);
      const description = extractDescription(text);
      const shortDescription =
        extractShortDescriptionFromHtml(html) ||
        buildShortDescription(description);
      const technicalDetails =
        extractTechnicalDetailsFromHtml(html) || buildTechnicalDetails(text);
      const gtin =
        extractGtinFromTechnicalDetails(technicalDetails) || extractGtinFromText(text);
      const basePrice = extractPriceFromHtml(html);
      const price =
        typeof basePrice === "number"
          ? Math.round(basePrice * 1.19 * 100) / 100
          : null;
      const manufacturer = extractManufacturerFromHtml(html);
      const normalizedManufacturer = manufacturer.trim();
      let cleanedTitle = title;
      if (normalizedManufacturer) {
        const escaped = normalizedManufacturer.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const patterns = [
          new RegExp(`^${escaped}\\s+`, "i"),
          new RegExp(`\\s+${escaped}$`, "i"),
          new RegExp(`\\s+\\(${escaped}\\)$`, "i"),
          new RegExp(`\\s+-\\s+${escaped}$`, "i"),
          new RegExp(`\\s+by\\s+${escaped}$`, "i"),
        ];
        cleanedTitle = patterns.reduce(
          (acc, pattern) => acc.replace(pattern, ""),
          cleanedTitle
        );
        cleanedTitle = cleanedTitle.replace(/\s{2,}/g, " ").trim();
      }
      const stock = parseStockForUrl(link, html);
      const supplierWeight = extractSupplierWeightFromHtml(html);
      const supplierImages = extractSupplierImagesFromHtml(html, link);
      const handleBase = buildHandleBase(cleanedTitle || title, manufacturer);
      const handleSlug = slugifyHandle(handleBase);
      const nextIndex = (handleCounts.get(handleSlug) ?? 0) + 1;
      handleCounts.set(handleSlug, nextIndex);
      const handle = nextIndex === 1 ? handleSlug : `${handleSlug}-${nextIndex}`;
      previews.push({
        sourceUrl: link,
        title: cleanedTitle || title,
        manufacturer,
        handle,
        shortDescription,
        description,
        technicalDetails,
        gtin,
        price,
        stock,
        supplierWeight,
        supplierImages,
      });
      if (previews.length < limit) {
        await sleep(REQUEST_DELAY_MS);
      }
    } catch (error) {
      logger.warn(
        `[preview] Failed ${link}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const payload = {
    sourceMode: mode,
    sourceUrl: url,
    sourceCategory: url,
    ...(mode === "product" ? { sourceProduct: url } : {}),
    checkedLinks: checked,
    previewCount: previews.length,
    items: previews,
  };

  if (persistOutput && out) {
    await fs.promises.writeFile(out, JSON.stringify(payload, null, 2), "utf8");
  }
  logger.log(
    `Preview done. mode=${mode} checked=${checked} items=${previews.length}${persistOutput && out ? ` output=${out}` : ""}`,
  );
  return payload;
};

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runBloomtechSupplierPreview(parseArgs()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
