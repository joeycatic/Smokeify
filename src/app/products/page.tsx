import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Navbar } from "@/components/Navbar";
import { getProducts } from "@/lib/shopify";
import DisplayProducts from "@/lib/displayProducts";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="bg-stone-200">
        <AnnouncementBar />
        <div className="mx-auto max-w-6xl px-6">
            <Navbar />

            <div className="text-center py-12">
                <h1 className="text-3xl font-bold mb-4" style={{ color: '#2f3e36' }}>
                    Our Products
                </h1>
                <div 
                    className="mx-auto mb-4 rounded-xl" 
                    style={{ width: '80px', height: '3px', backgroundColor: '#16a34a' }}
                ></div>
                <p className="text-stone-600 text-lg font-medium">
                    Premium equipment for professional results
                </p>
            </div>
            

            <DisplayProducts cols={4} />
        </div>
    </main>
  );
}