export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: { title: string; handle: string; manufacturer?: string | null };
    image?: { url: string; altText?: string | null } | null;
    shortDescription?: string | null;
    price: { amount: string; currencyCode: string };
  };
};

export type Cart = {
  id: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  lines: CartLine[];
};
