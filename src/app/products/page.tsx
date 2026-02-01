// app/products/page.tsx (Server Component)
import { getProducts } from "@/lib/catalog";
import ProductsClient from "./ProductsClient";
import PageLayout from "@/components/PageLayout";

export const revalidate = 0;

export default async function ProductsPage() {
  const products = await getProducts(500);
  
  return (
    <PageLayout>
      <ProductsClient initialProducts={products} />
    </PageLayout>
  );
}
