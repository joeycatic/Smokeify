const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_STOREFRONT_TOKEN!;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-04";

const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store", // immer frische Daten
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("Shopify error", json.errors ?? json);
    throw new Error("Shopify API Error");
  }

  return json.data;
}

export async function getProducts(limit = 10) {
  const query = /* GraphQL */ `
  query Products($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          handle
          title
          vendor        # Hersteller
          productType   # "Kategorie" (optional)
          collections(first: 10) {  # Kategorien über Collections (empfohlen)
            edges {
              node {
                id
                handle
                title
              }
            }
          }
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;


  const data = await shopifyFetch<{ products: any }>(query, { first: limit });
  return data.products.edges.map((e: any) => e.node);
}