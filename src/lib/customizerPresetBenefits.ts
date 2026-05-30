export type CustomizerPresetProfile = {
  title: string;
  description: string;
  benefitLabels: string[];
};

const DEFAULT_PROFILE: CustomizerPresetProfile = {
  title: "Manueller Builder",
  description: "Du priorisierst selbst und siehst Preis, Kompatibilität und nächste Schritte direkt im Verlauf.",
  benefitLabels: ["Selbst gewählt", "Klarer Check", "Flexibel erweiterbar"],
};

const PRESET_PROFILES: Record<string, CustomizerPresetProfile> = {
  beginner: {
    title: "Einfacher Start",
    description: "Der Fokus liegt auf einem sauberen Einstieg mit weniger Entscheidungsdruck und verständlichen Kernteilen.",
    benefitLabels: ["Einfacher Start", "Weniger Overkill", "Schnell einsatzbereit"],
  },
  compact: {
    title: "Kompakter Footprint",
    description: "Dieses Preset richtet das Setup auf kleinere Flächen und eine bewusst reduzierte Stellfläche aus.",
    benefitLabels: ["Kleine Fläche", "Weniger Footprint", "Platzbewusst"],
  },
  silent: {
    title: "Leiserer Betrieb",
    description: "Hier steht wohnraumfreundlicherer Betrieb mit ruhigerer Luftführung und mehr Reserve im Vordergrund.",
    benefitLabels: ["Leiser Betrieb", "Mehr Reserve", "Wohnraumfreundlicher"],
  },
  budget: {
    title: "Preis zuerst",
    description: "Das Preset hält den Einstieg schlank und priorisiert solide Basics vor teuren Upgrades.",
    benefitLabels: ["Preisbewusst", "Solide Basics", "Weniger Premium-Aufpreis"],
  },
  "premium-yield": {
    title: "Mehr Reserve",
    description: "Dieses Preset priorisiert stärkere Hauptkomponenten, hochwertigere Teile und mehr Upgrade-Spielraum.",
    benefitLabels: ["Mehr Reserve", "Upgrade-freundlich", "Leistungsstärker"],
  },
};

export function buildCustomizerPresetProfile(preset: string | null | undefined) {
  if (!preset) return DEFAULT_PROFILE;
  return PRESET_PROFILES[preset] ?? DEFAULT_PROFILE;
}

