const DEFAULT_URL = "https://bloomtech.de/Biobizz_1";
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

const isProductPage = (html, text) => {
  if (/<meta[^>]*itemprop=["']price["']/i.test(html)) return true;
  if (/class=["'][^"']*\bshortdesc\b/i.test(html)) return true;
  if (/class=["'][^"']*\bproduct-attributes\b/i.test(html)) return true;
  if (STATUS_REGEX.test(html)) return true;
  return isLikelyProductPage(text);
};

const extractProductLinksFromCategory = (html, baseUrl) => {
  const links = new Set();
  const linkRegex =
    /<a[^>]*class=["'][^"']*\bimg-w\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html))) {
    const raw = linkMatch[1];
    try {
      const url = new URL(raw, baseUrl);
      if (url.hostname !== "bloomtech.de") continue;
      if (url.search || url.hash) continue;
      if (url.pathname.endsWith("/favicon.ico") || url.pathname === "/favicon.ico") {
        continue;
      }
      links.add(url.toString());
    } catch {
      // ignore bad URLs
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

const extractLinks = (html, baseUrl) => {
  const links = new Set();
  const regex = /href="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html))) {
    const raw = match[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:")) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (url.hostname !== "bloomtech.de") continue;
      if (url.search || url.hash) continue;
      if (
        url.pathname.endsWith("/favicon.ico") ||
        url.pathname === "/favicon.ico"
      ) {
        continue;
      }
      links.add(url.toString());
    } catch {
      // ignore bad URLs
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
  return after.slice(0, endIndex).trim();
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
  const url = getValue("--url") ?? DEFAULT_URL;
  const limit = Number(getValue("--limit") ?? DEFAULT_LIMIT);
  const out = getValue("--out") ?? "scripts/bloomtech-preview.json";
  const dumpCategory = getValue("--dump-category");
  const dumpAccount = getValue("--dump-account");
  const dumpLogin = getValue("--dump-login");
  const dumpLoginResponse = getValue("--dump-login-response");
  return { url, limit, out, dumpCategory, dumpAccount, dumpLogin, dumpLoginResponse };
};

const run = async () => {
  const {
    url,
    limit,
    out,
    dumpCategory,
    dumpAccount,
    dumpLogin,
    dumpLoginResponse,
  } = parseArgs();
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
  const cookieJar = createCookieJar();
  const cookieOverride = process.env.BLOOMTECH_COOKIE;
  if (cookieOverride) {
    cookieJar.setFromCookieString(cookieOverride);
    if (process.env.BLOOMTECH_DEBUG === "1") {
      console.log("[preview] Using BLOOMTECH_COOKIE auth.");
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
  const allowedSlugs = buildAllowedSlugSetFromCategory(categoryHtml);
  const jsonLdLinks = extractProductLinksFromJsonLd(categoryHtml, url);
  const productLinks = extractProductLinksFromCategory(categoryHtml, url);
  const mergedLinks = Array.from(new Set([...productLinks, ...jsonLdLinks]));
  const links =
    mergedLinks.length > 0 ? mergedLinks : extractLinks(categoryHtml, url);
  const requireHeuristic = mergedLinks.length === 0;
  console.log(
    `[preview] links jsonLd=${jsonLdLinks.length} productBoxes=${productLinks.length} fallback=${links.length}`
  );

  const previews = [];
  const handleCounts = new Map();
  let checked = 0;

  for (const link of links) {
    if (previews.length >= limit) break;
    try {
      if (link === url) continue;
      const html = await fetchHtml(link, cookieJar);
      const text = normalizeText(stripTags(html));
      checked += 1;
      if (requireHeuristic && !isLikelyProductPage(text)) continue;
      if (!isProductPage(html, text)) continue;
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
        price,
        stock,
        supplierWeight,
      });
      await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      console.warn(
        `[preview] Failed ${link}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const payload = {
    sourceCategory: url,
    checkedLinks: checked,
    previewCount: previews.length,
    items: previews,
  };

  await fs.promises.writeFile(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Preview done. checked=${checked} items=${previews.length} output=${out}`,
  );
};

import fs from "fs";

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
