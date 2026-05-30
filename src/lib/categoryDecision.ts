import type { Product } from "@/data/types";
import { normalizeProductSearchText } from "@/lib/productSearch";
import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";
import { buildCategoryHref } from "@/lib/seoPages";

export type DecisionCategoryKey =
  | "tents"
  | "lights"
  | "ventilation"
  | "measurement"
  | "watering"
  | "propagation"
  | "substrate"
  | "generic";

export type CategoryDecisionCard = {
  id: string;
  label: string;
  title: string;
  reason: string;
  href: string;
};

export type CategoryDecisionGuide = {
  criteria: string[];
  differences: string[];
};

export type CategoryDecisionPrompt = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type ListingGuidanceAction = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type ListingGuidance = {
  eyebrow?: string;
  title: string;
  description: string;
  actions: ListingGuidanceAction[];
};

type CategoryResolution = {
  key: DecisionCategoryKey;
  handle: string | null;
  title: string;
};

type CardCandidate = {
  label: string;
  reason: string;
  score: (product: Product) => number;
};

type SearchIntent =
  | "analyzer"
  | "tents"
  | "lights"
  | "ventilation"
  | "measurement"
  | "watering"
  | null;

type ListingRecoveryInput = {
  categoryHandle?: string | null;
  categoryTitle?: string | null;
  searchQuery?: string | null;
  availableCategories?: Array<[string, string]>;
};

const CATEGORY_GROUPS: Array<{
  key: DecisionCategoryKey;
  title: string;
  handles: string[];
  tokens: string[];
}> = [
  {
    key: "tents",
    title: "Zelte",
    handles: ["zelte", "zelte-sets"],
    tokens: ["zelt", "growbox", "growzelt", "pflanzenzelt", "tent", "box"],
  },
  {
    key: "lights",
    title: "Licht",
    handles: ["licht"],
    tokens: ["licht", "led", "lampe", "growlight", "light", "board", "bar"],
  },
  {
    key: "ventilation",
    title: "Luft",
    handles: [
      "luft",
      "luft-sets",
      "rohrventilatoren",
      "luft-aktivkohlefilter",
      "lueftungsschlaeuche",
      "ventilatoren",
      "luftbefeuchter",
      "luftentfeuchter",
    ],
    tokens: [
      "abluft",
      "luefter",
      "luft",
      "filter",
      "aktivkohle",
      "ventilator",
      "fan",
      "inline",
    ],
  },
  {
    key: "measurement",
    title: "Messen",
    handles: ["messen", "ph-regulatoren"],
    tokens: ["messen", "messgeraet", "ph", "ec", "meter", "controller", "monitor"],
  },
  {
    key: "watering",
    title: "Bewässerung",
    handles: ["bewaesserung", "autopot", "wasserfilter-und-osmose"],
    tokens: ["bewaesserung", "watering", "autopot", "irrigation", "wasser", "osmose"],
  },
  {
    key: "propagation",
    title: "Anzucht",
    handles: ["anzucht", "anzucht-sets"],
    tokens: ["anzucht", "seedling", "clone", "steckling", "propagation"],
  },
  {
    key: "substrate",
    title: "Substrate & Zubehör",
    handles: ["substrate-und-zubehoer", "duenger", "erde", "toepfe"],
    tokens: ["substrat", "erde", "duenger", "naehrstoff", "toepfe", "soil", "fertilizer"],
  },
];

const ANALYZER_INTENT_TOKENS = [
  "blatt",
  "blaetter",
  "gelb",
  "gelbe",
  "mangel",
  "naehrstoffmangel",
  "flecken",
  "spot",
  "schimmel",
  "pilz",
  "krank",
  "symptom",
  "laeuse",
  "spinnmilben",
  "thripse",
];

const normalize = (value?: string | null) =>
  normalizeProductSearchText(value ?? "");

const getPrice = (product: Product) =>
  Number(product.priceRange?.minVariantPrice?.amount ?? 0);

const getReviewSignal = (product: Product) => {
  const count = product.reviewSummary?.count ?? 0;
  const average = product.reviewSummary?.average ?? 0;
  return Math.min(5, count / 6) + average / 2;
};

const getBestsellerSignal = (product: Product) =>
  Math.min(6, Math.max(0, (product.bestsellerScore ?? 0) / 12));

const getProductText = (product: Product) =>
  normalize(
    [
      product.title,
      product.handle,
      product.shortDescription,
      product.manufacturer,
      product.growboxSize,
      product.tags.join(" "),
      ...product.categories.flatMap((category) => [
        category.handle,
        category.title,
        category.parent?.handle ?? "",
        category.parent?.title ?? "",
      ]),
    ].join(" "),
  );

const hasAnyToken = (product: Product, tokens: string[]) => {
  const haystack = getProductText(product);
  return tokens.some((token) => haystack.includes(normalize(token)));
};

const parseDimensions = (value?: string | null) => {
  if (!value) return null;
  const match = normalize(value).match(/(\d{2,4})\s*x\s*(\d{2,4})(?:\s*x\s*(\d{2,4}))?/);
  if (!match) return null;

  return {
    width: Number(match[1]),
    depth: Number(match[2]),
    height: match[3] ? Number(match[3]) : null,
  };
};

const getFootprintArea = (product: Product) => {
  const dimensions = parseDimensions(product.growboxSize ?? product.title);
  if (!dimensions) return null;
  return dimensions.width * dimensions.depth;
};

const getWatts = (product: Product) => {
  const match = normalize(
    [product.title, product.shortDescription, product.tags.join(" ")].join(" "),
  ).match(/(\d{2,4})\s*w/);
  return match ? Number(match[1]) : null;
};

const getDiameterSignal = (product: Product) => {
  const match = normalize(product.title).match(/(\d{3})\s*mm/);
  return match ? Number(match[1]) : null;
};

const scoreBudget = (product: Product, divisor: number) =>
  Number(product.availableForSale) * 5 + getReviewSignal(product) - getPrice(product) / divisor;

const scorePremium = (product: Product, divisor: number) =>
  getBestsellerSignal(product) * 1.8 +
  getReviewSignal(product) +
  getPrice(product) / divisor +
  Number(hasAnyToken(product, ["premium", "pro", "evo", "silent"])) * 1.5;

const scoreTentCompact = (product: Product) => {
  const area = getFootprintArea(product);
  const compactScore =
    area === null
      ? 0
      : area <= 3600
        ? 5
        : area <= 6400
          ? 4
          : area <= 10000
            ? 2
            : 0;

  return (
    compactScore +
    Number(hasAnyToken(product, ["kompakt", "compact", "mini"])) * 2 +
    getReviewSignal(product) -
    getPrice(product) / 850
  );
};

const scoreTentBeginner = (product: Product) =>
  Number(hasAnyToken(product, ["set", "kit", "komplett", "complete"])) * 4 +
  Number(hasAnyToken(product, ["silent", "leise"])) +
  scoreTentCompact(product) +
  Number(product.availableForSale);

const scoreLightBalanced = (product: Product) => {
  const watts = getWatts(product);
  const wattScore =
    watts === null ? 1 : watts >= 150 && watts <= 320 ? 4 : watts < 150 ? 2 : 3;

  return (
    wattScore +
    Number(hasAnyToken(product, ["dimm", "dimmbar", "full spectrum"])) * 2 +
    getReviewSignal(product) -
    getPrice(product) / 900
  );
};

const scoreLightUpgrade = (product: Product) => {
  const watts = getWatts(product);
  const wattScore = watts === null ? 0 : Math.min(6, watts / 120);
  return (
    wattScore +
    Number(hasAnyToken(product, ["bar", "board", "evo", "dimm", "dimmbar"])) * 2 +
    scorePremium(product, 260)
  );
};

const scoreVentQuiet = (product: Product) => {
  const diameter = getDiameterSignal(product);
  const reserveScore =
    diameter === null ? 0 : diameter >= 150 ? 3 : diameter >= 125 ? 2 : 1;

  return (
    reserveScore +
    Number(hasAnyToken(product, ["silent", "ec", "leise"])) * 3 +
    Number(hasAnyToken(product, ["set", "filter"])) +
    getReviewSignal(product) -
    getPrice(product) / 800
  );
};

const scoreVentReserve = (product: Product) => {
  const diameter = getDiameterSignal(product);
  return (
    (diameter === null ? 0 : Math.min(5, Math.max(0, diameter - 100) / 15)) +
    Number(hasAnyToken(product, ["set", "filter", "inline", "turbo"])) * 2 +
    scorePremium(product, 240)
  );
};

const scoreMeasurementStarter = (product: Product) =>
  Number(hasAnyToken(product, ["ph", "ec", "pen", "tester"])) * 3 +
  getReviewSignal(product) +
  scoreBudget(product, 120);

const scoreMeasurementPrecision = (product: Product) =>
  Number(hasAnyToken(product, ["controller", "monitor", "digital", "pro"])) * 3 +
  getReviewSignal(product) +
  scorePremium(product, 300);

const scoreWateringAutomation = (product: Product) =>
  Number(hasAnyToken(product, ["autopot", "set", "kit", "system"])) * 4 +
  getReviewSignal(product) +
  scorePremium(product, 320);

const scorePropagationStarter = (product: Product) =>
  Number(hasAnyToken(product, ["set", "kit", "starter", "clone", "anzucht"])) * 4 +
  getReviewSignal(product) +
  scoreBudget(product, 150);

const scoreSubstrateBasics = (product: Product) =>
  Number(hasAnyToken(product, ["erde", "soil", "light mix", "all mix"])) * 4 +
  getReviewSignal(product) +
  scoreBudget(product, 180);

const getCardCandidates = (resolution: CategoryResolution): CardCandidate[] => {
  switch (resolution.key) {
    case "tents":
      return [
        {
          label: "Einsteiger",
          reason: "Reduziert Abstimmungsaufwand und bleibt für den ersten Grow überschaubar.",
          score: scoreTentBeginner,
        },
        {
          label: "Kompakt",
          reason: "Sinnvoll, wenn Stellfläche begrenzt ist oder du klein anfangen willst.",
          score: scoreTentCompact,
        },
        {
          label: "Budget",
          reason: "Hilft beim günstigen Start, ohne direkt auf Sets mit viel Reserve zu gehen.",
          score: (product) => scoreBudget(product, 120),
        },
        {
          label: "Premium",
          reason: "Mehr Reserve für stärkere Licht- und Luft-Setups oder spätere Upgrades.",
          score: (product) => scorePremium(product, 180),
        },
      ];
    case "lights":
      return [
        {
          label: "Ausgewogen",
          reason: "Solider Mittelweg aus Flächenabdeckung, Preis und Alltagstauglichkeit.",
          score: scoreLightBalanced,
        },
        {
          label: "Kompakt",
          reason: "Eher für kleinere Flächen, kurze Wege und schlankere Setups geeignet.",
          score: (product) => scoreLightBalanced(product) - (getWatts(product) ?? 220) / 240,
        },
        {
          label: "Budget",
          reason: "Guter Einstieg, wenn du zuerst eine funktionierende Grundbeleuchtung suchst.",
          score: (product) => scoreBudget(product, 150),
        },
        {
          label: "Ausbau",
          reason: "Interessant, wenn du später mehr Intensität oder flexiblere Steuerung willst.",
          score: scoreLightUpgrade,
        },
      ];
    case "ventilation":
      return [
        {
          label: "Leise",
          reason: "Praktisch, wenn Lautstärke im Alltag wichtiger ist als maximale Spitzenleistung.",
          score: scoreVentQuiet,
        },
        {
          label: "Set",
          reason: "Nimmt dir die Abstimmung zwischen Lüfter, Filter und Zubehör ab.",
          score: (product) =>
            Number(hasAnyToken(product, ["set", "filter", "komplett"])) * 5 +
            getReviewSignal(product) -
            getPrice(product) / 750,
        },
        {
          label: "Budget",
          reason: "Für einfache Abluft-Anforderungen mit klarer Preisgrenze.",
          score: (product) => scoreBudget(product, 140),
        },
        {
          label: "Reserve",
          reason: "Hilfreich, wenn du Hitze, Geruch und künftige Upgrades mit einplanst.",
          score: scoreVentReserve,
        },
      ];
    case "measurement":
      return [
        {
          label: "Einsteiger",
          reason: "Schneller Einstieg für die wichtigsten Kontrollwerte im Alltag.",
          score: scoreMeasurementStarter,
        },
        {
          label: "Präzise",
          reason: "Für Nutzer, die sauberer kalibrieren und genauer nachführen wollen.",
          score: scoreMeasurementPrecision,
        },
        {
          label: "Schnellstart",
          reason: "Hilft, wenn du ohne viel Einarbeitung direkt loslegen willst.",
          score: (product) =>
            Number(hasAnyToken(product, ["pen", "tester", "digital"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 170,
        },
        {
          label: "Budget",
          reason: "Reicht oft aus, wenn du nur die Kernwerte im Blick behalten willst.",
          score: (product) => scoreBudget(product, 170),
        },
      ];
    case "watering":
      return [
        {
          label: "Automatisiert",
          reason: "Spart Routinearbeit, wenn du Gießen planbarer machen willst.",
          score: scoreWateringAutomation,
        },
        {
          label: "Einsteiger",
          reason: "Für den ersten sauberen Bewässerungsaufbau ohne unnötige Komplexität.",
          score: (product) =>
            Number(hasAnyToken(product, ["starter", "set", "kit"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 200,
        },
        {
          label: "Wasserqualität",
          reason: "Hilft, wenn Wasseraufbereitung und Stabilität im Fokus stehen.",
          score: (product) =>
            Number(hasAnyToken(product, ["osmose", "filter", "wasser"])) * 4 +
            getReviewSignal(product) +
            scorePremium(product, 320),
        },
        {
          label: "Budget",
          reason: "Sinnvoll, wenn du erst den Basisfluss sauber aufsetzen willst.",
          score: (product) => scoreBudget(product, 220),
        },
      ];
    case "propagation":
      return [
        {
          label: "Starter",
          reason: "Nimmt dir beim ersten Durchlauf viel Abstimmung und Sucharbeit ab.",
          score: scorePropagationStarter,
        },
        {
          label: "Set",
          reason: "Sauber, wenn du lieber mit einem abgestimmten Paket startest.",
          score: (product) =>
            Number(hasAnyToken(product, ["set", "kit", "tray"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 160,
        },
        {
          label: "Kompakt",
          reason: "Gut für kleine Ecken, begrenzte Stellfläche und erste Testläufe.",
          score: (product) =>
            Number(hasAnyToken(product, ["mini", "compact", "kompakt"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 180,
        },
        {
          label: "Budget",
          reason: "Hält den Einstieg günstig, wenn du erstmal nur die Basics brauchst.",
          score: (product) => scoreBudget(product, 180),
        },
      ];
    case "substrate":
      return [
        {
          label: "Basis",
          reason: "Robuste Standardwahl für einen unkomplizierten Start.",
          score: scoreSubstrateBasics,
        },
        {
          label: "Pflege",
          reason: "Hilfreich, wenn du gezielt nach Nährstoff- oder Pflegeprodukten suchst.",
          score: (product) =>
            Number(hasAnyToken(product, ["duenger", "naehrstoff", "boost"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 220,
        },
        {
          label: "Ausbau",
          reason: "Für Nutzer, die das Medium oder die Fütterung feiner steuern wollen.",
          score: (product) =>
            Number(hasAnyToken(product, ["premium", "organic", "living"])) * 3 +
            scorePremium(product, 300),
        },
        {
          label: "Budget",
          reason: "Pragmatischer Einstieg, wenn erst die Grundversorgung stehen soll.",
          score: (product) => scoreBudget(product, 240),
        },
      ];
    default:
      return [
        {
          label: "Einsteiger",
          reason: "Saubere Standardwahl mit geringerem Fehlkauf-Risiko.",
          score: (product) =>
            Number(hasAnyToken(product, ["set", "kit", "starter", "complete"])) * 4 +
            getReviewSignal(product) +
            Number(product.availableForSale) -
            getPrice(product) / 900,
        },
        {
          label: "Kompakt",
          reason: "Für kleinere Setups, engere Räume oder klaren Fokus auf Übersicht.",
          score: (product) =>
            Number(hasAnyToken(product, ["kompakt", "compact", "mini"])) * 4 +
            getReviewSignal(product) -
            getPrice(product) / 950,
        },
        {
          label: "Budget",
          reason: "Hilfreich, wenn Preis und Verfügbarkeit zuerst zählen.",
          score: (product) => scoreBudget(product, 150),
        },
        {
          label: "Premium",
          reason: "Für Nutzer, die mehr Reserve, Ausstattung oder Upgrade-Spielraum wollen.",
          score: (product) => scorePremium(product, 220),
        },
      ];
  }
};

const pickCards = (products: Product[], candidates: CardCandidate[]) => {
  const availableProducts = products.filter((product) => product.availableForSale);
  const source = availableProducts.length > 0 ? availableProducts : products;
  const usedProductIds = new Set<string>();
  const cards: CategoryDecisionCard[] = [];

  for (const candidate of candidates) {
    const winner =
      [...source]
        .filter((product) => !usedProductIds.has(product.id))
        .sort((left, right) => candidate.score(right) - candidate.score(left))[0] ?? null;

    if (!winner) continue;

    usedProductIds.add(winner.id);
    cards.push({
      id: `${candidate.label}-${winner.id}`,
      label: candidate.label,
      title: winner.title,
      reason: candidate.reason,
      href: `/products/${winner.handle}`,
    });
  }

  return cards.slice(0, 4);
};

const buildIntentAction = (
  id: string,
  title: string,
  description: string,
  href: string,
): ListingGuidanceAction => ({
  id,
  title,
  description,
  href,
});

export function resolveDecisionCategory(
  categoryHandle?: string | null,
  categoryTitle?: string | null,
): CategoryResolution {
  const handle = normalize(categoryHandle);
  const title = normalize(categoryTitle);

  const matchedGroup = CATEGORY_GROUPS.find((group) => {
    const handleMatches = group.handles.some((entry) => handle.includes(normalize(entry)));
    const titleMatches = group.tokens.some(
      (token) => title.includes(normalize(token)) || handle.includes(normalize(token)),
    );
    return handleMatches || titleMatches;
  });

  if (matchedGroup) {
    return {
      key: matchedGroup.key,
      handle: categoryHandle ?? matchedGroup.handles[0] ?? null,
      title: categoryTitle ?? matchedGroup.title,
    };
  }

  return {
    key: "generic",
    handle: categoryHandle ?? null,
    title: categoryTitle ?? "Produkte",
  };
}

export function buildCategoryDecisionCards(
  products: Product[],
  options?: {
    categoryHandle?: string | null;
    categoryTitle?: string | null;
  },
) {
  if (products.length === 0) return [];
  const resolution = resolveDecisionCategory(options?.categoryHandle, options?.categoryTitle);
  return pickCards(products, getCardCandidates(resolution));
}

export function buildCategoryDecisionGuide(
  categoryHandle?: string | null,
  categoryTitle?: string | null,
): CategoryDecisionGuide | null {
  if (!categoryHandle && !categoryTitle) return null;

  const resolution = resolveDecisionCategory(categoryHandle, categoryTitle);

  switch (resolution.key) {
    case "tents":
      return {
        criteria: [
          "Plane zuerst Stellfläche, Höhe und den nötigen Abstand für Licht und Abluft zusammen.",
          "Wähle das Zeltmaß so, dass Lampenabdeckung, Filtergröße und Bewegungsraum später noch passen.",
          "Wenn Lautstärke wichtig ist, rechne lieber mit etwas Luftreserve statt nur mit dem Minimalmaß.",
        ],
        differences: [
          "Kleine Formate sind einfacher zu kontrollieren, größere Zelte geben mehr Reserven für Upgrades.",
          "Komplettsets sparen Abstimmungsaufwand, Einzelkomponenten geben dir mehr Freiheit bei Licht und Luft.",
          "Premium-Zelte lohnen sich eher, wenn Reißverschlüsse, Stabilität und häufige Umbauten relevant sind.",
        ],
      };
    case "lights":
      return {
        criteria: [
          "Vergleiche echte Leistungsaufnahme, Flächenabdeckung und Dimmbarkeit statt nur Marketing-Wattzahlen.",
          "Stimme die Lampe auf das Zeltmaß ab, damit Randbereiche nicht abfallen oder unnötig Hitze entsteht.",
          "Wenn du später aufrüsten willst, sind dimmbare oder modular gedachte Modelle meist entspannter.",
        ],
        differences: [
          "Kompaktere LEDs sind einfacher zu führen, stärkere Lampen verlangen mehr Abstand und Klimakontrolle.",
          "Budget-Leuchten funktionieren für den Einstieg, hochwertigere Modelle liefern oft gleichmäßigere Ausleuchtung.",
          "Mehr Leistung zahlt sich nur aus, wenn Zelt, Luftführung und Temperatur das Setup sauber tragen.",
        ],
      };
    case "ventilation":
      return {
        criteria: [
          "Plane Luftleistung immer zusammen mit Filterwiderstand, Rohrführung und gewünschter Lautstärke.",
          "Achte darauf, dass Rohrdurchmesser, Lüfter und Anschlüsse wirklich zusammenpassen.",
          "Wenn Geruchskontrolle wichtig ist, sollte der Filter nicht nur passen, sondern mit Reserve betrieben werden.",
        ],
        differences: [
          "Größere Systeme laufen im Alltag oft ruhiger, wenn du sie nicht dauerhaft am Limit fahren musst.",
          "Sets reduzieren Fehlkäufe, Einzelteile geben mehr Kontrolle über Lautstärke und Ausbaugrad.",
          "Ein günstiger Lüfter kann technisch reichen, fühlt sich im Dauerbetrieb aber oft rauer und lauter an.",
        ],
      };
    case "measurement":
      return {
        criteria: [
          "Überlege zuerst, welche Werte du wirklich regelmäßig messen willst: pH, EC, Klima oder alles zusammen.",
          "Kalibrierung und Lesbarkeit sind im Alltag oft wichtiger als eine überladene Featureliste.",
          "Wenn du mehrere Messpunkte im Blick behalten willst, lohnt sich Vergleich bei Sensoren und Displays besonders.",
        ],
        differences: [
          "Einfache Pens sind schnell und günstig, Controller oder Monitore liefern mehr Routine und Präzision.",
          "Günstige Geräte reichen für Basischecks, hochwertigere Modelle sparen oft Nerven bei der Nachführung.",
          "Die beste Wahl hängt davon ab, wie häufig du misst und wie fein du dein Setup wirklich steuerst.",
        ],
      };
    case "watering":
      return {
        criteria: [
          "Prüfe zuerst, ob du manuell gießen, automatisieren oder Wasserqualität aufbereiten willst.",
          "Automatische Systeme sollten zu Topfgröße, Medium und Platz im Zelt passen.",
          "Wenn dein Leitungswasser schwankt, ist Wasseraufbereitung oft wichtiger als das nächste Add-on.",
        ],
        differences: [
          "Starter-Systeme sind schnell einsatzbereit, modularere Lösungen wachsen besser mit deinem Setup mit.",
          "Autopot- und Kit-Lösungen sparen Routine, verlangen aber saubere Grundabstimmung.",
          "Wasserfilter oder Osmose lohnen sich vor allem dann, wenn das Ausgangswasser dein Bottleneck ist.",
        ],
      };
    case "propagation":
      return {
        criteria: [
          "Für Anzucht zählt zuerst ein kontrollierbares, einfaches Setup statt maximale Ausstattung.",
          "Prüfe, wie viel Stellfläche, Feuchte und Wärme du für Keimlinge oder Stecklinge wirklich bereitstellen kannst.",
          "Sets sind oft sinnvoller als lose Teile, wenn du die Anzucht nicht separat optimieren willst.",
        ],
        differences: [
          "Kompakte Lösungen sind günstiger und einfacher, größere Trays geben dir mehr Spielraum pro Durchlauf.",
          "Einsteiger-Sets sparen Sucharbeit, Speziallösungen lohnen sich eher bei wiederholter Anzucht.",
          "Die beste Wahl hängt davon ab, ob du gelegentlich vorziehst oder konstant mit Jungpflanzen arbeitest.",
        ],
      };
    case "substrate":
      return {
        criteria: [
          "Starte mit dem Medium oder Dünger, der zu deinem Bewässerungsstil und Erfahrungsstand passt.",
          "Überfrachte den Start nicht mit zu vielen Zusätzen, wenn die Basis noch nicht sauber läuft.",
          "Bei Töpfen und Erde zählt Passform zum gesamten Gieß- und Klimaverhalten stärker als Einzelpreise.",
        ],
        differences: [
          "Basismischungen und Standardsubstrate reduzieren Fehler, Spezialmedien geben dir mehr Stellschrauben.",
          "Günstige Basics reichen oft weit, Upgrades lohnen sich eher bei klarer Routine oder spezifischen Zielen.",
          "Die beste Wahl ergibt sich aus Medium, Gießrhythmus und gewünschter Eingriffstiefe im Grow.",
        ],
      };
    default:
      return {
        criteria: [
          `Achte bei ${resolution.title} zuerst auf Passform zum restlichen Setup und nicht nur auf Einzelpreise.`,
          "Vergleiche Verfügbarkeit, Bewertungsdichte und die wichtigsten Basisspezifikationen.",
          "Wenn du unsicher bist, starte mit robusten Standardoptionen und erweitere später gezielt.",
        ],
        differences: [
          "Einsteigerfreundliche Produkte sparen Interpretationsaufwand, Spezialprodukte geben mehr Kontrolle.",
          "Günstigere Modelle senken Einstiegskosten, hochwertigere Varianten sparen oft spätere Kompromisse.",
          "Die beste Wahl hängt weniger vom Einzelprodukt als vom gesamten Setup und deinem Nutzungsmuster ab.",
        ],
      };
  }
}

export function buildCategoryComparePrompt(
  categoryHandle?: string | null,
  categoryTitle?: string | null,
): CategoryDecisionPrompt | null {
  void categoryHandle;
  void categoryTitle;
  return null;
}

export function buildCategorySupportPrompt(
  categoryHandle?: string | null,
  categoryTitle?: string | null,
): CategoryDecisionPrompt | null {
  const resolution = resolveDecisionCategory(categoryHandle, categoryTitle);

  if (
    resolution.key === "tents" ||
    resolution.key === "lights" ||
    resolution.key === "ventilation"
  ) {
    return {
      title: "Noch unsicher beim kompletten Setup?",
      description:
        "Der Konfigurator führt Zelt, Licht und Luft als zusammenhängende Kaufentscheidung.",
      href: "/customizer",
      ctaLabel: "Zum Konfigurator",
    };
  }

  return null;
}

const detectSearchIntent = (query?: string | null): SearchIntent => {
  const normalized = normalize(query);
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter(Boolean);

  if (tokens.some((token) => ANALYZER_INTENT_TOKENS.includes(token))) {
    return "analyzer";
  }

  if (tokens.some((token) => CATEGORY_GROUPS[0]?.tokens.includes(token))) return "tents";
  if (tokens.some((token) => CATEGORY_GROUPS[1]?.tokens.includes(token))) return "lights";
  if (tokens.some((token) => CATEGORY_GROUPS[2]?.tokens.includes(token))) return "ventilation";
  if (tokens.some((token) => CATEGORY_GROUPS[3]?.tokens.includes(token))) return "measurement";
  if (tokens.some((token) => CATEGORY_GROUPS[4]?.tokens.includes(token))) return "watering";

  return null;
};

const dedupeActions = (actions: ListingGuidanceAction[]) =>
  Array.from(new Map(actions.map((action) => [action.href, action])).values()).slice(0, 3);

const buildIntentActions = (
  intent: SearchIntent,
  resolution: CategoryResolution,
): ListingGuidanceAction[] => {
  switch (intent) {
    case "analyzer":
      return [
        buildIntentAction(
          "analyzer",
          "Pflanzen-Analyzer öffnen",
          "Wenn du nach Symptomen oder Blattproblemen suchst, bringt dich die Diagnose schneller zur passenden Maßnahme.",
          PLANT_ANALYZER_PATH,
        ),
        buildIntentAction(
          "substrate",
          "Zu Dünger & Substraten",
          "Viele Symptomanfragen führen am Ende zu Pflege-, Nährstoff- oder Medium-Entscheidungen.",
          buildCategoryHref("substrate-und-zubehoer"),
        ),
      ];
    case "tents":
      return [
        buildIntentAction(
          "tent-category",
          "Zur Zelt-Kategorie",
          "Wenn du nach Growbox, Zelt oder Tent suchst, ist der direkte Kategorieeinstieg meist schneller.",
          buildCategoryHref("zelte"),
        ),
        buildIntentAction(
          "customizer",
          "Setup konfigurieren",
          "Bei Zeltfragen hilft dir der Konfigurator, Maße und Komponenten sauber zusammenzudenken.",
          "/customizer",
        ),
      ];
    case "lights":
      return [
        buildIntentAction(
          "light-category",
          "Zur Licht-Kategorie",
          "So grenzt du LEDs schneller nach Fläche und Budget ein.",
          buildCategoryHref("licht"),
        ),
        buildIntentAction(
          "light-customizer",
          "Setup planen",
          "Wenn Fläche und Lampenleistung zusammen gedacht werden sollen, ist der Konfigurator der klarere nächste Schritt.",
          "/customizer",
        ),
      ];
    case "ventilation":
      return [
        buildIntentAction(
          "vent-category",
          "Zur Luft-Kategorie",
          "Dort kannst du Lüfter, Filter und Sets gezielter eingrenzen.",
          buildCategoryHref("luft"),
        ),
        buildIntentAction(
          "vent-sets",
          "Komplette Luft-Sets ansehen",
          "Wenn du möglichst wenig abstimmen willst, sind Sets oft der schnellere Start.",
          buildCategoryHref("sets", { parentHandle: "luft" }),
        ),
      ];
    case "measurement":
      return [
        buildIntentAction(
          "measurement-category",
          "Zu Messen & pH",
          "Das bündelt pH-, EC- und Kontrollgeräte in einem klareren Einstieg.",
          buildCategoryHref("messen"),
        ),
      ];
    case "watering":
      return [
        buildIntentAction(
          "watering-category",
          "Zur Bewässerung",
          "So kommst du schneller zu Autopot, Wasserfiltern und passenden Bewässerungslösungen.",
          buildCategoryHref("bewaesserung"),
        ),
      ];
    default:
      return resolution.handle
        ? [
            buildIntentAction(
              "back-to-category",
              `${resolution.title} erneut öffnen`,
              "Starte ohne den Suchbegriff direkt in der passenden Kategorie.",
              buildCategoryHref(resolution.handle),
            ),
          ]
        : [];
  }
};

export function buildSearchIntentGuidance(
  searchQuery?: string | null,
  categoryHandle?: string | null,
  categoryTitle?: string | null,
): ListingGuidance | null {
  const intent = detectSearchIntent(searchQuery);
  if (!intent) return null;

  const resolution = resolveDecisionCategory(categoryHandle, categoryTitle);
  const actions = dedupeActions(buildIntentActions(intent, resolution));
  if (actions.length === 0) return null;

  return {
    eyebrow: "Schneller Einstieg",
    title:
      intent === "analyzer"
        ? "Diese Suche klingt eher nach einem Diagnose-Fall"
        : "Diese Suche lässt sich über eine klarere Kaufspur schneller lösen",
    description:
      intent === "analyzer"
        ? "Statt auf einzelne Produktnamen zu raten, kannst du Symptome, Unsicherheit und nächste Schritte direkt strukturieren."
        : "Wenn du direkt in die passende Kategorie oder in den Konfigurator springst, reduziert das unnötige Suchwege.",
    actions,
  };
}

export function buildNoResultsGuidance({
  categoryHandle,
  categoryTitle,
  searchQuery,
  availableCategories = [],
}: ListingRecoveryInput): ListingGuidance {
  const resolution = resolveDecisionCategory(categoryHandle, categoryTitle);
  const intent = detectSearchIntent(searchQuery);
  const actions: ListingGuidanceAction[] = [];

  actions.push(...buildIntentActions(intent, resolution));

  const suggestedCategory = availableCategories.find(
    ([handle]) => handle !== resolution.handle,
  );
  if (suggestedCategory) {
    actions.push(
      buildIntentAction(
        `category-${suggestedCategory[0]}`,
        `${suggestedCategory[1]} ausprobieren`,
        "Wenn dein erster Pfad zu eng war, bringt dich die benachbarte Kategorie oft schneller zu passenden Treffern.",
        buildCategoryHref(suggestedCategory[0]),
      ),
    );
  }

  switch (resolution.key) {
    case "tents":
      actions.push(
        buildIntentAction(
          "tent-customizer",
          "Mit dem Konfigurator starten",
          "Wenn Größe, Licht und Abluft zusammenhängen, ist der Konfigurator der sauberere Einstieg.",
          "/customizer",
        ),
        buildIntentAction(
          "tent-bestseller",
          "Bestseller ansehen",
          "Ein Blick auf ausgewählte Topseller ist oft schneller als blind alle Filter zu drehen.",
          "/bestseller",
        ),
      );
      break;
    case "lights":
      actions.push(
        buildIntentAction(
          "light-category",
          "Licht neu eingrenzen",
          "Öffne die Licht-Kategorie ohne die aktuelle Suchkombination noch einmal sauber.",
          buildCategoryHref("licht"),
        ),
      );
      break;
    case "ventilation":
      actions.push(
        buildIntentAction(
          "vent-category",
          "Zu Luft-Sets wechseln",
          "Wenn Einzelteile gerade nicht passen, sind Sets oft der einfachere nächste Schritt.",
          buildCategoryHref("sets", { parentHandle: "luft" }),
        ),
      );
      break;
    default:
      actions.push(
        buildIntentAction(
          "fallback-bestseller",
          "Zu den Bestsellern",
          "Wenn die aktuelle Kombination zu eng ist, helfen ausgewählte Topseller beim Neustart.",
          "/bestseller",
        ),
      );
      break;
  }

  return {
    eyebrow: "Nächster sinnvoller Schritt",
    title:
      intent === "analyzer"
        ? "Kein Direkttreffer für diese Symptombeschreibung"
        : "Keine passenden Treffer mit dieser Kombination",
    description:
      intent === "analyzer"
        ? "Bei Pflanzensymptomen ist der Analyzer meist hilfreicher als eine reine Produktsuche."
        : "Statt weiter im Leeren zu filtern, spring lieber in einen klareren Pfad mit höherer Kaufwahrscheinlichkeit.",
    actions: dedupeActions(actions),
  };
}

