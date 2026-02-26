export type SeoPageConfig = {
  slugParts: string[];
  title: string;
  description: string;
  copy?: string[];
  faq?: Array<{ question: string; answer: string }>;
  categoryHandle?: string;
  categoryHandleAliases?: string[];
  subcategoryHandle?: string;
  subcategoryHandleAliases?: string[];
  parentHandle?: string;
  growboxSize?: string;
};

export const seoPages: SeoPageConfig[] = [
  {
    slugParts: ["anzucht"],
    title: "Anzucht",
    description: "Alles für die Anzucht bei Smokeify.",
    copy: [
      "Starte sauber und kontrolliert: Für eine starke Anzucht zählen stabiles Klima, passende Feuchte und verlässliche Basics.",
      "Hier findest du Equipment, das einfach zu bedienen ist und dir konstante Ergebnisse liefert – vom ersten Samen bis zur kräftigen Jungpflanze.",
      "Wähle unkomplizierte Starterlösungen oder stelle dir dein Setup flexibel zusammen.",
    ],
    categoryHandle: "anzucht",
  },
  {
    slugParts: ["bewaesserung"],
    title: "Bewässerung",
    description: "Bewässerungslösungen für deine Pflanzen.",
    copy: [
      "Gleichmäßige Bewässerung ist der Schlüssel zu gesunden Pflanzen und stressfreiem Gießen.",
      "Ob manuell, automatisch oder als System: Wir bieten Lösungen, die zu deinem Alltag passen.",
      "Finde das passende Setup für Größe, Topfanzahl und Pflegeaufwand.",
    ],
    categoryHandle: "bewaesserung",
  },
  {
    slugParts: ["wasserfilter-und-osmose"],
    title: "Wasserfilter & Osmose",
    description:
      "Wasserfilter- und Osmose-Lösungen für stabile Wasserqualität im Indoor-Setup.",
    copy: [
      "Sauberes Wasser ist die Basis für kontrollierte Nährstoffgabe und gesunde Pflanzenentwicklung.",
      "Hier findest du Wasserfilter- und Osmose-Produkte für konstante Qualität und reproduzierbare Ergebnisse.",
      "Wähle Lösungen passend zu Wasserhärte, Durchfluss und deinem Setup.",
    ],
    categoryHandle: "wasserfilter-und-osmose",
  },
  {
    slugParts: ["autopot"],
    title: "Autopot",
    description:
      "Autopot Systeme und Zubehör für effiziente, automatisierte Bewässerung.",
    copy: [
      "Autopot-Systeme versorgen Pflanzen gleichmäßig und reduzieren täglichen Pflegeaufwand.",
      "Entdecke Komponenten und Sets für stabile Abläufe von Einsteiger- bis Pro-Setup.",
      "So baust du eine zuverlässige, skalierbare Bewässerung mit wenig Aufwand auf.",
    ],
    categoryHandle: "autopot",
  },
  {
    slugParts: ["duenger"],
    title: "Dünger",
    description: "Dünger & Nährstoffe bei Smokeify.",
    copy: [
      "Premium Nährstoffe, klar verständlich – für kräftiges Wachstum und stabile Erträge.",
      "Hier findest du abgestimmte Produkte für jede Phase, vom Start bis zur Ernte.",
      "Einfach dosieren, zuverlässig versorgen, sichtbar bessere Resultate.",
    ],
    categoryHandle: "duenger",
  },
  {
    slugParts: ["substrateundzubehoer"],
    title: "Substrate & Zubehör",
    description: "Substrate und Zubehör für dein Indoor-Setup.",
    copy: [
      "Substrate und passendes Zubehör bilden die Grundlage für ein stabiles, gut wartbares Setup.",
      "Hier findest du Produkte für Wurzelgesundheit, Handling und saubere Abläufe im Alltag.",
      "So kombinierst du die richtige Basis mit den passenden Ergänzungen für bessere Ergebnisse.",
    ],
    categoryHandle: "substrate-und-zubehoer",
    categoryHandleAliases: [
      "substrat-und-zubehoer",
      "substrateundzubehoer",
      "substratundzubehoer",
      "substrate-zubehoer",
      "substrat-zubehoer",
    ],
  },
  {
    slugParts: ["substrate"],
    title: "Substrate",
    description: "Substrate & Erden für dein Indoor-Setup.",
    copy: [
      "Das richtige Substrat schafft die Basis für gesundes Wurzelwachstum und stabile Pflanzenentwicklung.",
      "Wähle zwischen bewährten Erden und spezialisierten Mischungen passend zu deinem Anbauziel.",
      "Mit der passenden Struktur und Wasserhaltekapazität erleichterst du Pflege und Nährstoffversorgung.",
    ],
    categoryHandle: "substrate",
  },
  {
    slugParts: ["zubehoer"],
    title: "Zubehör",
    description: "Praktisches Zubehör für dein Indoor-Setup.",
    copy: [
      "Mit dem richtigen Zubehör wird dein Setup effizienter, sauberer und einfacher im Alltag.",
      "Von kleinen Helfern bis zu wichtigen Ergänzungen findest du hier alles für einen reibungslosen Betrieb.",
      "So optimierst du Pflege, Handling und Langlebigkeit deiner Ausrüstung.",
    ],
    categoryHandle: "zubehoer",
  },
  {
    slugParts: ["zelte"],
    title: "Zelte",
    description: "Zelte in allen Größen – perfekt für Einsteiger bis Pro-Setups.",
    copy: [
      "Zelte schaffen das ideale Klima auf kleinstem Raum – kontrolliert, effizient und leise.",
      "Wähle die Größe passend zu deinem Platz und deinem Ziel: kompakt für Einsteiger, großzügig für anspruchsvolle Setups.",
      "Robuste Materialien, saubere Verarbeitung und durchdachte Details – für langfristig zuverlässige Ergebnisse.",
    ],
    faq: [
      {
        question: "Welche Zeltgröße ist die richtige?",
        answer:
          "Das hängt von Platz und Ziel ab. Für den Einstieg reichen oft kompakte Größen wie 60x60 oder 80x80. Für größere Pflanzen oder mehr Ertrag eignen sich 100x100 oder mehr.",
      },
      {
        question: "Brauche ich zwingend ein Pflanzenzelt?",
        answer:
          "Ein Pflanzenzelt ist nicht zwingend, bietet aber kontrolliertes Klima, weniger Geruch und bessere Lichtausnutzung. Das sorgt für stabilere Ergebnisse.",
      },
      {
        question: "Welche Ausstattung ist wichtig?",
        answer:
          "Wichtig sind eine passende Beleuchtung, eine zuverlässige Abluft und gutes Zubehör. So bleibt Temperatur und Feuchte im idealen Bereich.",
      },
    ],
    categoryHandle: "zelte",
  },
  {
    slugParts: ["zelte-60x60"],
    title: "Zelte 60x60",
    description: "Zelte in der Größe 60x60.",
    categoryHandle: "zelte",
    growboxSize: "60x60",
  },
  {
    slugParts: ["zelte-80x80"],
    title: "Zelte 80x80",
    description: "Zelte in der Größe 80x80.",
    categoryHandle: "zelte",
    growboxSize: "80x80",
  },
  {
    slugParts: ["zelte-100x100"],
    title: "Zelte 100x100",
    description: "Zelte in der Größe 100x100.",
    categoryHandle: "zelte",
    growboxSize: "100x100",
  },
  {
    slugParts: ["zelte-120x120"],
    title: "Zelte 120x120",
    description: "Zelte in der Größe 120x120.",
    categoryHandle: "zelte",
    growboxSize: "120x120",
  },
  {
    slugParts: ["zelte-150x150"],
    title: "Zelte 150x150",
    description: "Zelte in der Größe 150x150.",
    categoryHandle: "zelte",
    growboxSize: "150x150",
  },
  {
    slugParts: ["zelte-200x200"],
    title: "Zelte 200x200",
    description: "Zelte in der Größe 200x200.",
    categoryHandle: "zelte",
    growboxSize: "200x200",
  },
  {
    slugParts: ["headshop"],
    title: "Headshop",
    description: "Headshop-Zubehör bei Smokeify.",
    copy: [
      "Ausgewähltes Headshop-Zubehör mit Fokus auf Qualität, Alltagstauglichkeit und Stil.",
      "Von Klassikern bis zu modernen Essentials – alles, was dein Setup komplett macht.",
      "Entdecke Zubehör, das langlebig ist und einfach gut aussieht.",
    ],
    categoryHandle: "headshop",
  },
  {
    slugParts: ["licht"],
    title: "Licht",
    description: "Beleuchtung für dein Setup.",
    copy: [
      "Das richtige Licht entscheidet über Wachstum, Gesundheit und Ertrag.",
      "Hier findest du effiziente Lösungen mit hoher Ausbeute, geringem Verbrauch und stabiler Performance.",
      "Wähle Licht passend zu Fläche, Pflanzenphase und gewünschter Intensität.",
    ],
    categoryHandle: "licht",
  },
  {
    slugParts: ["luft"],
    title: "Luft & Klima",
    description: "Abluft, Klima und Zubehör.",
    copy: [
      "Stabile Luftführung sorgt für gleichmäßige Bedingungen, gesunde Pflanzen und ein sauberes Klima.",
      "Von Abluft bis Umluft – finde leise, leistungsstarke Komponenten, die zu deinem Setup passen.",
      "Einfach kombinieren, zuverlässig betreiben, dauerhaft gute Ergebnisse.",
    ],
    categoryHandle: "luft",
  },
  {
    slugParts: ["messen"],
    title: "Messen",
    description: "Messgeräte für dein Indoor-Setup.",
    copy: [
      "Präzise Messwerte geben dir Kontrolle über Klima, Nährstoffe und Wasserqualität.",
      "Mit den richtigen Tools erkennst du früh, was deine Pflanzen brauchen.",
      "Einfach ablesen, sicher handeln, bessere Resultate.",
    ],
    categoryHandle: "messen",
  },
  {
    slugParts: ["anzucht", "sets"],
    title: "Anzucht Sets",
    description: "Anzucht-Sets für einen einfachen Start.",
    subcategoryHandle: "sets",
    parentHandle: "anzucht",
  },
  {
    slugParts: ["zelte", "sets"],
    title: "Zelte Sets",
    description: "Zelte-Sets für komplette Setups.",
    subcategoryHandle: "sets",
    parentHandle: "zelte",
  },
  {
    slugParts: ["headshop", "aschenbecher"],
    title: "Aschenbecher",
    description: "Aschenbecher aus dem Headshop Sortiment.",
    subcategoryHandle: "aschenbecher",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "aufbewahrung"],
    title: "Aufbewahrung",
    description: "Aufbewahrungslösungen aus dem Headshop.",
    subcategoryHandle: "aufbewahrung",
    subcategoryHandleAliases: ["aufbewahrungen", "aufbewhrung"],
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "bongs"],
    title: "Bongs",
    description: "Bongs aus dem Headshop Sortiment.",
    subcategoryHandle: "bongs",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "feuerzeuge"],
    title: "Feuerzeuge",
    description: "Feuerzeuge & Zubehör aus dem Headshop.",
    subcategoryHandle: "feuerzeuge",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "filter"],
    title: "Filter",
    description: "Filter und Filterzubehör im Headshop.",
    subcategoryHandle: "filter",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "grinder"],
    title: "Grinder",
    description: "Grinder in vielen Varianten.",
    subcategoryHandle: "grinder",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "kraeuterschale"],
    title: "Kräuterschale",
    description: "Kräuterschalen aus dem Headshop.",
    subcategoryHandle: "kraeuterschale",
    subcategoryHandleAliases: ["hash-bowl"],
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "papers"],
    title: "Papers",
    description: "Papers und Rolling Zubehör.",
    subcategoryHandle: "papers",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "pipes"],
    title: "Pipes",
    description: "Pipes & Pfeifen aus dem Headshop.",
    subcategoryHandle: "pipes",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "rolling-tray"],
    title: "Rolling Tray",
    description: "Rolling Trays aus dem Headshop.",
    subcategoryHandle: "rolling-tray",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "tubes"],
    title: "Tubes",
    description: "Tubes & Zubehör aus dem Headshop.",
    subcategoryHandle: "tubes",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "vaporizer"],
    title: "Vaporizer",
    description: "Vaporizer aus dem Headshop Sortiment.",
    subcategoryHandle: "vaporizer",
    parentHandle: "headshop",
  },
  {
    slugParts: ["headshop", "waagen"],
    title: "Waagen",
    description: "Waagen und Messhelfer im Headshop.",
    subcategoryHandle: "waagen",
    parentHandle: "headshop",
  },
  {
    slugParts: ["luft", "aktivkohlefilter"],
    title: "Aktivkohlefilter",
    description: "Aktivkohlefilter für saubere Abluft.",
    subcategoryHandle: "aktivkohlefilter",
    parentHandle: "luft",
  },
  {
    slugParts: ["luft", "luftbefeuchter"],
    title: "Luftbefeuchter",
    description: "Luftbefeuchter für dein Klima.",
    subcategoryHandle: "luftbefeuchter",
    parentHandle: "luft",
  },
  {
    slugParts: ["luftentfeuchter"],
    title: "Luftentfeuchter",
    description: "Luftentfeuchter für stabile Bedingungen.",
    subcategoryHandle: "luftentfeuchter",
    parentHandle: "luft",
  },
  {
    slugParts: ["luft", "lueftungsschlaeuche"],
    title: "Lüftungsschläuche",
    description: "Lüftungsschläuche und Zubehör.",
    subcategoryHandle: "lueftungsschlaeuche",
    parentHandle: "luft",
  },
  {
    slugParts: ["luft", "rohrventilatoren"],
    title: "Rohrventilatoren",
    description: "Rohrventilatoren für deine Abluft.",
    subcategoryHandle: "rohrventilatoren",
    parentHandle: "luft",
  },
  {
    slugParts: ["luft", "sets"],
    title: "Abluft Sets",
    description: "Abluft-Sets für ein komplettes System.",
    subcategoryHandle: "sets",
    parentHandle: "luft",
  },
  {
    slugParts: ["luft", "ventilatoren"],
    title: "Ventilatoren",
    description: "Ventilatoren für optimale Luftzirkulation.",
    subcategoryHandle: "ventilatoren",
    parentHandle: "luft",
  },
  {
    slugParts: ["messen", "ph-regulatoren"],
    title: "pH-Regulatoren",
    description: "pH-Regulatoren und Zubehör.",
    subcategoryHandle: "ph-regulatoren",
    parentHandle: "messen",
  },
];

export const seoPageBySlug = new Map(
  seoPages.map((page) => [page.slugParts.join("/"), page]),
);
