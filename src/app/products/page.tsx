// app/products/page.tsx (Server Component)
import { getProducts } from "@/lib/catalog";
import ProductsClient from './ProductsClient';
import PageLayout from '@/components/PageLayout';

export default async function ProductsPage() {
  const products = await getProducts(500);
  
  return (
    <PageLayout>
      <ProductsClient initialProducts={products} />
    </PageLayout>
  );
}
