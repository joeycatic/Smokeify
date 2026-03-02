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
    faq: [
      {
        question: "Was ist in der Anzucht am wichtigsten?",
        answer:
          "In der Anzucht sind vor allem konstante Bedingungen entscheidend: passende Feuchtigkeit, moderate Temperaturen und nicht zu aggressive Lichtintensität. Stabilität bringt hier mehr als extreme Werte.",
      },
      {
        question: "Welche Produkte reichen für einen sinnvollen Start?",
        answer:
          "Für den Einstieg genügen meist Anzuchtmedium, passende Beleuchtung und einfache Klima-Basics. So baust du ein übersichtliches Setup auf, das sich später gezielt erweitern lässt.",
      },
      {
        question: "Welche typischen Fehler sollte ich vermeiden?",
        answer:
          "Häufige Fehler sind Überwässerung, zu starke Beleuchtung und zu viele Änderungen auf einmal. Besser ist ein ruhiger Start mit kleinen Anpassungsschritten.",
      },
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
    faq: [
      {
        question: "Welche Bewässerung passt zu meinem Setup?",
        answer:
          "Für kleine Setups reicht oft manuelles Gießen mit passenden Hilfen. Bei mehreren Pflanzen oder wenig Zeit lohnt sich ein automatisches System, das gleichmäßiger arbeitet und den Alltag deutlich entlastet.",
      },
      {
        question: "Worauf sollte ich bei automatischer Bewässerung achten?",
        answer:
          "Wichtig sind ein passender Tank, zuverlässige Verteilung und die richtige Dimensionierung für Topfanzahl und Fläche. Starte lieber konservativ und teste dein System vor dem Dauerbetrieb.",
      },
      {
        question: "Wie vermeide ich Über- oder Unterwässerung?",
        answer:
          "Achte auf Substrat, Topfgröße und Gießintervall als Gesamtpaket. Gleichmäßige, moderate Wasserzufuhr ist meist besser als große Schwankungen zwischen sehr trocken und sehr nass.",
      },
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
    faq: [
      {
        question: "Welchen Dünger brauche ich für den Start?",
        answer:
          "Für den Einstieg sind klar strukturierte Basis-Schemata sinnvoll. Ein abgestimmtes Set für Wachstum und Blüte ist meist einfacher als viele Einzelprodukte auf einmal.",
      },
      {
        question: "Wie oft sollte ich düngen?",
        answer:
          "Starte mit einer moderaten Dosierung nach Herstellerangabe und beobachte die Pflanzenreaktion. Eine zu schnelle Erhöhung führt häufiger zu Problemen als ein vorsichtiger Start mit schrittweiser Anpassung.",
      },
      {
        question: "Kann ich verschiedene Dünger kombinieren?",
        answer:
          "Ja, aber nur mit klarem Plan. Kombiniere Produkte, die zusammen gedacht sind, und vermeide überlappende Additive ohne Bedarf. Weniger, aber sauber abgestimmt, funktioniert in der Praxis oft besser.",
      },
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
    faq: [
      {
        question: "Wie wähle ich das passende Substrat?",
        answer:
          "Achte auf Luftigkeit, Wasserhaltevermögen und darauf, wie häufig du pflegen kannst. Ein Substrat sollte zu deinem Gießrhythmus und deinem Setup passen.",
      },
      {
        question: "Welches Zubehör macht bei Substraten wirklich Sinn?",
        answer:
          "Sinnvoll sind vor allem Töpfe mit guter Drainage, Untersetzer und praktische Pflegehilfen. Diese Basics verbessern Handhabung und Stabilität im Alltag deutlich.",
      },
      {
        question: "Kann ich später auf ein anderes Substrat wechseln?",
        answer:
          "Ja, ein Wechsel ist möglich, sollte aber geplant und sauber umgesetzt werden. Am besten den Wechsel mit angepasster Bewässerung und Versorgung kombinieren.",
      },
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
    faq: [
      {
        question: "Worauf sollte ich bei Substraten achten?",
        answer:
          "Wichtige Faktoren sind Strukturstabilität, Luftanteil und Wasserführung. Ein gutes Substrat unterstützt Wurzelgesundheit und erleichtert die tägliche Pflege.",
      },
      {
        question: "Sind vorgedüngte Substrate für Einsteiger sinnvoll?",
        answer:
          "Vorgedüngte Varianten können den Einstieg erleichtern, weil die Grundversorgung schon enthalten ist. Zusätzliche Nährstoffe sollten dann schrittweise und nicht zu früh ergänzt werden.",
      },
      {
        question: "Wie erkenne ich, dass ein Substrat nicht passt?",
        answer:
          "Hinweise sind ungleichmäßige Trocknung, dauerhaft zu nasse Bereiche oder schlechte Wasseraufnahme. In solchen Fällen hilft meist ein besser abgestimmtes Substrat.",
      },
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
    faq: [
      {
        question: "Welches Zubehör sollte ich zuerst kaufen?",
        answer:
          "Starte mit Zubehör, das du täglich brauchst: saubere Aufbewahrung, einfache Messhilfen und Wartungs-Basics. Das bringt im Alltag den größten Nutzen.",
      },
      {
        question: "Wie stelle ich ein sinnvolles Zubehör-Set zusammen?",
        answer:
          "Wähle zuerst die Pflichtteile für dein bestehendes Setup und ergänze dann nach Bedarf. So vermeidest du Fehlkäufe und hältst dein Setup übersichtlich.",
      },
      {
        question: "Lohnt sich günstiges Zubehör?",
        answer:
          "Günstige Produkte können funktionieren, wenn Verarbeitung und Zuverlässigkeit passen. Bei intensiv genutzten Teilen lohnt sich oft die robustere Variante.",
      },
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
    faq: [
      {
        question: "Welches Headshop-Zubehör ist für Einsteiger sinnvoll?",
        answer:
          "Ein solider Einstieg sind Grinder, Papers, Filter Tips und eine passende Aufbewahrung. Damit deckst du die wichtigsten Basics alltagstauglich ab.",
      },
      {
        question: "Worauf sollte ich bei der Materialqualität achten?",
        answer:
          "Achte auf saubere Verarbeitung, robuste Materialien und gute Reinigbarkeit. Das sorgt für längere Haltbarkeit und ein besseres Nutzungserlebnis.",
      },
      {
        question: "Wie pflege ich Headshop-Zubehör richtig?",
        answer:
          "Regelmäßige Reinigung mit geeignetem Cleaner und warmem Wasser verhindert Rückstände und erhält Funktion sowie Geschmack deutlich besser.",
      },
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
    faq: [
      {
        question: "Wie finde ich die passende Lampe für meine Fläche?",
        answer:
          "Orientiere dich an der realen Anbaufläche und den Herstellerangaben zur Ausleuchtung. Eine passende Abdeckung ist in der Praxis wichtiger als reine Maximalleistung.",
      },
      {
        question: "Ist dimmbare Beleuchtung sinnvoll?",
        answer:
          "Ja, dimmbare Beleuchtung erleichtert die Anpassung an verschiedene Entwicklungsphasen. So kannst du zu hohe Intensität vermeiden und kontrollierter arbeiten.",
      },
      {
        question: "Wattzahl oder Effizienz – was zählt mehr?",
        answer:
          "Für stabile Ergebnisse sind Effizienz und gleichmäßige Lichtverteilung meist wichtiger als eine hohe reine Wattzahl.",
      },
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
    faq: [
      {
        question: "Warum ist Luftführung im Setup so wichtig?",
        answer:
          "Eine saubere Luftführung stabilisiert Temperatur und Feuchte, reduziert Stauwärme und unterstützt die Pflanzengesundheit.",
      },
      {
        question: "Wie kombiniere ich Abluft und Umluft richtig?",
        answer:
          "Abluft tauscht verbrauchte Luft aus, Umluft verteilt sie gleichmäßig im Setup. Erst das Zusammenspiel beider Komponenten schafft stabile Bedingungen.",
      },
      {
        question: "Worauf sollte ich bei Lüftern und Filtern achten?",
        answer:
          "Wichtig sind passende Leistung zur Fläche, Lautstärke und Regelbarkeit. Ein abgestimmtes System läuft ruhiger und zuverlässiger.",
      },
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
    faq: [
      {
        question: "Welche Messwerte sollte ich regelmäßig kontrollieren?",
        answer:
          "Besonders relevant sind Temperatur, Luftfeuchtigkeit und je nach Setup pH- bzw. EC-Werte. Diese Daten helfen dir, frühzeitig sinnvoll gegenzusteuern.",
      },
      {
        question: "Wie wichtig ist die Kalibrierung von Messgeräten?",
        answer:
          "Regelmäßige Kalibrierung ist entscheidend, damit Messwerte zuverlässig bleiben. Richte dich dabei immer nach den Intervallen des Herstellers.",
      },
      {
        question: "Warum sind präzise Messwerte so entscheidend?",
        answer:
          "Mit sauberen Messwerten triffst du gezielte Entscheidungen statt zu raten. Das reduziert Überkorrekturen und sorgt für stabilere Ergebnisse.",
      },
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
