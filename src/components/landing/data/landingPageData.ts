export type CategoryCard = {
  name: string;
  count: number;
  href: string;
  highlighted?: boolean;
  tone?: "moss" | "clay" | "sky";
};

export type SocialProof = {
  rating: string;
  supportResponseTime: string;
  deliveryTime: string;
  quote: string;
  quoteAuthor: string;
};

export const socialProof: SocialProof = {
  rating: "4,8/5",
  supportResponseTime: "Antwort in unter 2h",
  deliveryTime: "2-4 Werktage im Schnitt",
  quote:
    "Endlich ein Shop, bei dem ich nicht fünf Tabs offen haben muss, um ein Setup zu verstehen.",
  quoteAuthor: "Mara, Berlin",
};
