import type { CustomizerPresetDefinition } from "@/lib/customizerPresetTypes";

export const CUSTOMIZER_PRESETS: readonly CustomizerPresetDefinition[] = [
  {
    slug: "beginner",
    title: "Einsteiger-Setup",
    summary: "Klarer Start mit ausgewogenem Licht, passender Abluft und einfachen Upgrades.",
    description:
      "Für den ersten sauberen Indoor-Run: verständlich, kompatibel und ohne unnötige Kostenfallen.",
    supportedSizeKeys: ["60x60", "80x80", "100x100"],
    defaultSizeKey: "80x80",
    reasonLabels: ["einsteigerfreundlich", "budget-sicher", "upgrade-ready"],
    explainer:
      "Dieses Preset priorisiert verlässliche Basics. Wenn du später mehr Leistung willst, kannst du Licht und Bewässerung gezielt aufrüsten.",
    selection: {
      size: {
        reason:
          "Die Zeltwahl bleibt bewusst nachvollziehbar: solide Basis, etablierte Formate und genügend Reserven für den Einstieg.",
        reasonLabels: ["einsteigerfreundlich"],
        preferredKeywords: ["homebox", "bloomstar", "diamondbox", "secret jardin"],
        priceBias: "balanced",
      },
      light: {
        reason:
          "Das Licht ist auf einen sauberen Start ausgelegt: genug Output für die Fläche, ohne direkt in teure High-End-Leistung zu springen.",
        reasonLabels: ["einsteigerfreundlich", "budget-sicher"],
        preferredKeywords: ["fluxshield", "helios", "420 v3", "300 watt"],
        avoidKeywords: ["720w", "evo8"],
        priceBias: "balanced",
      },
      vent: {
        reason:
          "Die Abluft bleibt unkompliziert: komplette Set-Lösung mit passendem Durchmesser und kalkulierbarer Lautstärke.",
        reasonLabels: ["einsteigerfreundlich"],
        preferredKeywords: ["luftfilter-set", "cloudline"],
        priceBias: "balanced",
        requireSet: true,
        preferredDiameter: "smallest",
      },
      extras: [
        {
          key: "starter-seedling",
          reason:
            "Ein kleines Anzucht-Set nimmt dir den Start ab und sorgt für weniger Reibung in den ersten Tagen.",
          reasonLabels: ["einsteigerfreundlich"],
          preferredKeywords: ["anzuchtset klein & eco"],
          priceBias: "budget",
        },
        {
          key: "starter-watering",
          reason:
            "Eine einfache Bewässerungserweiterung spart Handarbeit, ohne das Setup unnötig aufzublähen.",
          reasonLabels: ["pflegeleichter start"],
          preferredKeywords: [
            "system 1pot 1x 15l 47l tank starter-set",
            "system 2pot 2x 15l 47l tank starter-set",
            "easy2go kit",
          ],
          priceBias: "balanced",
        },
      ],
    },
  },
  {
    slug: "compact",
    title: "Kompaktes Zelt-Setup",
    summary: "Für kleine Flächen mit klarer Priorität auf Stellmaß und sauberem Gesamtpaket.",
    description:
      "Diese Auswahl hält das Setup bewusst klein und sortiert. Ideal, wenn Platz knapp ist und jeder Zentimeter zählt.",
    supportedSizeKeys: ["60x60", "80x80"],
    defaultSizeKey: "60x60",
    reasonLabels: ["kompakt", "platzsparend", "schnell-startklar"],
    explainer:
      "Die Produktauswahl bleibt auf kleine Footprints abgestimmt. Größere oder sperrige Komponenten werden bewusst aussortiert.",
    selection: {
      size: {
        reason:
          "Das Zelt bleibt eng an der gewählten Fläche, damit das Setup auch in kleineren Räumen sauber unterkommt.",
        reasonLabels: ["kompakt"],
        preferredKeywords: ["bloomstar", "homebox", "diamondbox"],
        priceBias: "budget",
      },
      light: {
        reason:
          "Das Licht fokussiert sich auf exakte Flächenabdeckung statt Überdimensionierung. Das spart Wärme und hält das Setup übersichtlich.",
        reasonLabels: ["kompakt", "effizient"],
        preferredKeywords: ["fluxshield", "habibi", "helios", "420 v3"],
        avoidKeywords: ["720w", "530w", "evo8"],
        priceBias: "budget",
      },
      vent: {
        reason:
          "Die Abluft priorisiert kompakte Sets mit kleinem Durchmesser, damit das Setup leichter integrierbar bleibt.",
        reasonLabels: ["kompakt"],
        preferredKeywords: ["luftfilter-set", "100mm"],
        priceBias: "budget",
        requireSet: true,
        preferredDiameter: "smallest",
      },
      extras: [
        {
          key: "compact-seedling",
          reason:
            "Das kleine Anzucht-Set ergänzt den Start, ohne zusätzlichen Platzbedarf oder unnötige Komplexität.",
          reasonLabels: ["kompakt"],
          preferredKeywords: ["anzuchtset klein & eco"],
          priceBias: "budget",
        },
        {
          key: "compact-watering",
          reason:
            "Ein simples Bewässerungs-Add-on hält den Alltag auf kleiner Fläche besser im Griff.",
          reasonLabels: ["platzsparend"],
          preferredKeywords: ["easy2go kit", "bodenfeuchtesensor"],
          priceBias: "balanced",
        },
      ],
    },
  },
  {
    slug: "silent",
    title: "Leises Setup",
    summary: "Weniger Luftwiderstand, ruhigere Abluft und Komponenten mit Reserven für einen entspannteren Betrieb.",
    description:
      "Gedacht für Räume, in denen Lautstärke mitentscheidet. Die Auswahl bevorzugt leisere Luftführung und weniger Stress im Dauerbetrieb.",
    supportedSizeKeys: ["80x80", "100x100", "120x120"],
    defaultSizeKey: "80x80",
    reasonLabels: ["leise", "wohnraumfreundlich", "ruhiger-betrieb"],
    explainer:
      "Das Preset bewertet die Luftführung höher als den absoluten Einstiegspreis. Größere Durchmesser und ruhigere Komponenten bekommen Vorrang.",
    selection: {
      size: {
        reason:
          "Die Zelte werden mit Blick auf saubere Luftführung und etwas Reserve bei Anschlüssen und Höhe ausgewählt.",
        reasonLabels: ["leise"],
        preferredKeywords: ["homebox", "cloudlab"],
        priceBias: "premium",
      },
      light: {
        reason:
          "Effiziente Beleuchtung reduziert unnötige Wärme und entlastet damit das gesamte Klimasetup.",
        reasonLabels: ["leise", "effizient"],
        preferredKeywords: ["sanlight", "fluxshield", "helios", "ionframe"],
        avoidKeywords: ["720w"],
        priceBias: "premium",
      },
      vent: {
        reason:
          "Die Abluft bevorzugt größere, leisere Setups mit weniger Widerstand und mehr Reserven im Dauerbetrieb.",
        reasonLabels: ["leise", "ruhiger-betrieb"],
        preferredKeywords: ["pro", "ac infinity", "luftfilter-set"],
        priceBias: "premium",
        requireSet: true,
        preferredDiameter: "largest",
      },
      extras: [
        {
          key: "silent-watering",
          reason:
            "Ein automatischeres Gießsetup reduziert Eingriffe und hält den Betrieb gleichmäßiger.",
          reasonLabels: ["pflegeleichter start"],
          preferredKeywords: ["easy2go kit", "bodenfeuchtesensor"],
          priceBias: "balanced",
        },
        {
          key: "silent-seedling",
          reason:
            "Ein kleines Anzucht-Set rundet das Setup ab, ohne zusätzlichen Klima- oder Gerätestress zu erzeugen.",
          reasonLabels: ["ruhiger-betrieb"],
          preferredKeywords: ["anzuchtset klein & eco"],
          priceBias: "budget",
        },
      ],
    },
  },
  {
    slug: "budget",
    title: "Budget-Setup",
    summary: "Maximaler Einstieg pro Euro, ohne die Basiskompatibilität zu opfern.",
    description:
      "Das Setup setzt konsequent auf Preis-Leistung. Nur dort wird mehr investiert, wo es für die Funktion wirklich nötig ist.",
    supportedSizeKeys: ["60x60", "80x80", "100x100"],
    defaultSizeKey: "60x60",
    reasonLabels: ["budget-sicher", "preisfokus", "solide-basics"],
    explainer:
      "Dieses Preset verschiebt das Budget zuerst in die Pflicht-Komponenten. Komfort-Upgrades bleiben bewusst schlank.",
    selection: {
      size: {
        reason:
          "Das Zelt wird streng nach Preis-Leistung gewählt, aber nur innerhalb sauber kompatibler Größenformate.",
        reasonLabels: ["budget-sicher"],
        preferredKeywords: ["bloomstar", "diamondbox", "secret jardin"],
        priceBias: "budget",
      },
      light: {
        reason:
          "Die Lichtwahl priorisiert solide Abdeckung bei möglichst niedrigem Einstiegspreis.",
        reasonLabels: ["budget-sicher", "preisfokus"],
        preferredKeywords: ["habibi", "fluxshield", "helios"],
        avoidKeywords: ["720w", "evo", "set 1.5"],
        priceBias: "budget",
      },
      vent: {
        reason:
          "Die Abluft bleibt beim günstigeren, kompatiblen Set und vermeidet unnötige Premium-Aufschläge.",
        reasonLabels: ["budget-sicher"],
        preferredKeywords: ["luftfilter-set", "100mm", "150mm"],
        priceBias: "budget",
        requireSet: true,
        preferredDiameter: "smallest",
      },
      extras: [
        {
          key: "budget-seedling",
          reason:
            "Das Extra bleibt klein und nützlich, damit der Warenkorb nicht mit Nebenartikeln vollläuft.",
          reasonLabels: ["preisfokus"],
          preferredKeywords: ["anzuchtset klein & eco"],
          priceBias: "budget",
        },
      ],
    },
  },
  {
    slug: "premium-yield",
    title: "Premium-Yield-Setup",
    summary: "Mehr Output, mehr Reserven und ein klarer Fokus auf hochwertige Hauptkomponenten.",
    description:
      "Dieses Preset zieht das Budget bewusst auf Ertrag, Lichtleistung und belastbare Hauptkomponenten.",
    supportedSizeKeys: ["80x80", "100x100", "120x120"],
    defaultSizeKey: "100x100",
    reasonLabels: ["premium", "ertrag-fokus", "upgrade-ready"],
    explainer:
      "Die Auswahl verschiebt Priorität weg vom Einstiegspreis hin zu Leistungsreserve, Build-Qualität und späteren Upgrades.",
    selection: {
      size: {
        reason:
          "Das Zelt wird mit Fokus auf hochwertige Basis und länger tragfähige Systemreserve ausgewählt.",
        reasonLabels: ["premium"],
        preferredKeywords: ["homebox", "cloudlab"],
        priceBias: "premium",
      },
      light: {
        reason:
          "Die Beleuchtung bekommt Priorität, weil sie den größten Hebel auf Flächenausleuchtung und Upgrade-Reserve hat.",
        reasonLabels: ["ertrag-fokus", "upgrade-ready"],
        preferredKeywords: ["sanlight", "ionframe", "spektra", "evo"],
        priceBias: "premium",
      },
      vent: {
        reason:
          "Die Abluft wird mit mehr Reserve gewählt, damit Klima und Geruch auch bei höherer Leistung sauber kontrollierbar bleiben.",
        reasonLabels: ["premium", "upgrade-ready"],
        preferredKeywords: ["pro", "ac infinity", "luftfilter-set"],
        priceBias: "premium",
        requireSet: true,
        preferredDiameter: "largest",
      },
      extras: [
        {
          key: "premium-watering",
          reason:
            "Die Bewässerung bekommt ein stärkeres Upgrade, damit das Setup nicht nur leistet, sondern auch stabiler im Alltag läuft.",
          reasonLabels: ["upgrade-ready"],
          preferredKeywords: [
            "bewässerungsbasis 4er-pack",
            "system 2pot 4x 8,5l 47l tank",
            "system 1pot 4x 15l 47l tank",
          ],
          priceBias: "premium",
        },
        {
          key: "premium-seedling",
          reason:
            "Ein kleines Anzucht-Add-on ergänzt das Setup, ohne den Fokus von den Hauptkomponenten wegzunehmen.",
          reasonLabels: ["ertrag-fokus"],
          preferredKeywords: ["anzuchtset klein & eco"],
          priceBias: "budget",
        },
      ],
    },
  },
] as const;

export function getCustomizerPreset(slug?: string | null) {
  if (!slug) return null;
  return CUSTOMIZER_PRESETS.find((preset) => preset.slug === slug) ?? null;
}

