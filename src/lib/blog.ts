export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  excerpt: string;
  readingTimeMin: number;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "growbox-einsteiger-guide",
    title: "Growbox Einsteiger Guide – Alles was du für den Start brauchst",
    description:
      "Der komplette Growbox Einsteiger Guide: Welche Ausrüstung du brauchst, wie du die richtige Größe wählst und deine ersten Pflanzen erfolgreich anziehst.",
    publishedAt: "2026-02-23",
    excerpt:
      "Du willst zum ersten Mal eine Growbox aufbauen, weißt aber nicht wo du anfangen sollst? In diesem Guide erklären wir dir Schritt für Schritt, welche Ausrüstung du brauchst und wie du häufige Anfängerfehler vermeidest.",
    readingTimeMin: 7,
  },
  {
    slug: "growbox-2-pflanzen",
    title: "Welche Growbox für 2 Pflanzen? Größen & Empfehlungen 2026",
    description:
      "Du planst 2 Pflanzen in einer Growbox? Wir erklären, welche Größe ideal ist, welche LED-Leistung du brauchst und worauf du beim Kauf achten solltest.",
    publishedAt: "2026-02-23",
    excerpt:
      "60×60 oder 80×80 cm? Die Boxgröße macht für zwei Pflanzen einen großen Unterschied. Wir vergleichen die gängigsten Growbox-Maße und erklären, welche Variante für deine Bedürfnisse am besten passt.",
    readingTimeMin: 5,
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
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
