export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  excerpt: string;
  readingTimeMin: number;
  cluster: "setup" | "diagnosis" | "climate" | "nutrition";
  tags: string[];
  featured?: boolean;
};

export const blogClusters: Array<{
  id: BlogPost["cluster"];
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "setup",
    label: "Setup",
    title: "Zelte, Licht und Kaufentscheidung",
    description:
      "Smokeify Guides für saubere Startentscheidungen, Konfigurator-Pfade und Produktvergleiche.",
  },
  {
    id: "diagnosis",
    label: "Analyse",
    title: "Pflanzenprobleme strukturiert prüfen",
    description:
      "Symptome lesen, Fotoanalyse vorbereiten und Maßnahmen mit Checks absichern.",
  },
  {
    id: "climate",
    label: "Klima",
    title: "Abluft, Temperatur und Luftfeuchte",
    description:
      "Pragmatische Wege zu stabiler Luftführung und weniger Stress im Zelt.",
  },
  {
    id: "nutrition",
    label: "Nährstoffe",
    title: "Dünger, pH und Medium",
    description:
      "Versorgung verstehen, Überkorrekturen vermeiden und Messwerte sinnvoll nutzen.",
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: "growbox-einsteiger-guide",
    title: "Pflanzenzelt Einsteiger Guide – Alles was du für den Start brauchst",
    description:
      "Der komplette Pflanzenzelt Einsteiger Guide: Welche Ausrüstung du brauchst, wie du die richtige Größe wählst und deine ersten Pflanzen erfolgreich anziehst.",
    publishedAt: "2026-02-23",
    excerpt:
      "Du willst zum ersten Mal ein Pflanzenzelt aufbauen, weißt aber nicht wo du anfangen sollst? In diesem Guide erklären wir dir Schritt für Schritt, welche Ausrüstung du brauchst und wie du häufige Anfängerfehler vermeidest.",
    readingTimeMin: 7,
    cluster: "setup",
    tags: ["Growbox", "Einsteiger", "Konfigurator"],
    featured: true,
  },
  {
    slug: "growbox-2-pflanzen",
    title: "Welches Pflanzenzelt für 2 Pflanzen? Größen & Empfehlungen 2026",
    description:
      "Du planst 2 Pflanzen in einem Pflanzenzelt? Wir erklären, welche Größe ideal ist, welche LED-Leistung du brauchst und worauf du beim Kauf achten solltest.",
    publishedAt: "2026-02-23",
    excerpt:
      "60×60 oder 80×80 cm? Die Zeltgröße macht für zwei Pflanzen einen großen Unterschied. Wir vergleichen die gängigsten Pflanzenzelt-Maße und erklären, welche Variante für deine Bedürfnisse am besten passt.",
    readingTimeMin: 5,
    cluster: "setup",
    tags: ["Zeltgröße", "Planung"],
  },
  {
    slug: "duenger-vergleich",
    title: "Dünger Vergleich Indoor: Flüssig, Granulat oder Tabs?",
    description:
      "Welcher Dünger ist der beste für deinen Indoor-Garten? Unser Vergleich erklärt NPK-Verhältnisse, phasenspezifische Ernährung und die häufigsten Düngungsfehler.",
    publishedAt: "2026-02-23",
    excerpt:
      "Flüssigdünger reagiert schnell, Granulat gibt langsam frei, Tabs sind unkompliziert – aber welcher Dünger passt am besten zu deinem Setup? Wir vergleichen die drei Haupttypen.",
    readingTimeMin: 5,
    cluster: "nutrition",
    tags: ["Dünger", "pH", "Medium"],
  },
  {
    slug: "pflanzenanalyse-gelbe-blaetter",
    title: "Gelbe Blätter analysieren: Smokeify Prüfpfad vor der Korrektur",
    description:
      "Gelbe Blätter können von pH, Licht, Wasser oder Nährstoffen kommen. Dieser Guide zeigt einen sicheren Prüfpfad für die Smokeify Pflanzenanalyse.",
    publishedAt: "2026-03-05",
    excerpt:
      "Bevor du Dünger erhöhst oder dein Setup umbaust, solltest du Symptome, Messwerte und Verlauf sauber trennen. So vermeidest du teure Überkorrekturen.",
    readingTimeMin: 6,
    cluster: "diagnosis",
    tags: ["Analyzer", "Mangel", "Checks"],
    featured: true,
  },
  {
    slug: "abluft-setup-guide",
    title: "Abluft im Growzelt: leise, passend und mit Reserve planen",
    description:
      "Wie du Lüfter, Filter und Schlauch sinnvoll dimensionierst und typische Abluft-Fehlkäufe vermeidest.",
    publishedAt: "2026-03-05",
    excerpt:
      "Abluft ist kein Einzelteil, sondern ein System. Dieser Smokeify Guide erklärt, wie Durchmesser, Filter und Lautstärke zusammenhängen.",
    readingTimeMin: 6,
    cluster: "climate",
    tags: ["Abluft", "Klima", "Lautstärke"],
  },
  {
    slug: "led-growlampen-vergleich",
    title: "LED Growlampen vergleichen: Fläche, Leistung und Alltag",
    description:
      "Smokeify Vergleichsleitfaden für LED-Lampen: Warum Wattzahl allein nicht reicht und welche Kriterien wirklich zählen.",
    publishedAt: "2026-03-06",
    excerpt:
      "LEDs wirken auf Datenblättern schnell ähnlich. Im echten Setup zählen Fläche, Dimmbarkeit, Wärme und wie gut die Lampe zur Box passt.",
    readingTimeMin: 6,
    cluster: "setup",
    tags: ["LED", "Vergleich", "Licht"],
  },
  {
    slug: "customizer-growbox-setup",
    title: "Growbox Setup mit dem Smokeify Konfigurator planen",
    description:
      "So nutzt du den Smokeify Konfigurator, um Zelt, Licht, Abluft und Zubehör als zusammenhängende Entscheidung zu planen.",
    publishedAt: "2026-03-06",
    excerpt:
      "Der Konfigurator ist kein Warenkorb-Trick, sondern ein Entscheidungshelfer. Er hilft dir, Kernkomponenten gemeinsam statt isoliert auszuwählen.",
    readingTimeMin: 5,
    cluster: "setup",
    tags: ["Konfigurator", "Setup", "Vergleich"],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
