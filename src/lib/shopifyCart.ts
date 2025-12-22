import "server-only";
import { shopifyFetch } from "@/lib/shopify";

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: { title: string; handle: string };
    image?: { url: string; altText?: string | null } | null;
    price: { amount: string; currencyCode: string };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  lines: CartLine[];
};

function mapCart(cart: any): ShopifyCart {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: (cart.lines?.edges ?? []).map((e: any) => e.node),
  };
}

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              image { url altText }
              price { amount currencyCode }
              product { title handle }
            }
          }
        }
      }
    }
  }
`;

export async function cartCreate(): Promise<ShopifyCart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartCreate {
      cartCreate {
        cart { ...CartFragment }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch<any>(query);
  const errors = data.cartCreate?.userErrors;
  if (errors?.length) throw new Error(errors[0].message);
  return mapCart(data.cartCreate.cart);
}

export async function cartGet(cartId: string): Promise<ShopifyCart | null> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    query CartGet($id: ID!) {
      cart(id: $id) { ...CartFragment }
    }
  `;
  const data = await shopifyFetch<any>(query, { id: cartId });
  if (!data.cart) return null;
  return mapCart(data.cart);
}

export async function cartLinesAdd(cartId: string, variantId: string, quantity: number) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...CartFragment }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch<any>(query, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  const errors = data.cartLinesAdd?.userErrors;
  if (errors?.length) throw new Error(errors[0].message);
  return mapCart(data.cartLinesAdd.cart);
}

export async function cartLinesUpdate(cartId: string, lineId: string, quantity: number) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ...CartFragment }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch<any>(query, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });
  const errors = data.cartLinesUpdate?.userErrors;
  if (errors?.length) throw new Error(errors[0].message);
  return mapCart(data.cartLinesUpdate.cart);
}

export async function cartLinesRemove(cartId: string, lineIds: string[]) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFragment }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch<any>(query, { cartId, lineIds });
  const errors = data.cartLinesRemove?.userErrors;
  if (errors?.length) throw new Error(errors[0].message);
  return mapCart(data.cartLinesRemove.cart);
}
