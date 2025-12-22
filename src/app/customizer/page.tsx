import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Navbar } from "@/components/Navbar";
import { getProducts } from "@/lib/shopify";
import DisplayProducts from "@/lib/displayProducts";
import PageLayout from "@/components/PageLayout";

export default async function CustomizerPage() {
  const products = await getProducts();

  return (
    <PageLayout>
        <h1>Placeholder</h1>
    </PageLayout>
  );
}