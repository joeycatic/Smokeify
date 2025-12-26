import { AnnouncementBar } from "@/components/AnnouncementBar";
import { HeroBanner } from "@/components/HeroBanner";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import { getProducts } from "@/lib/shopify";
import Link from "next/link";

export default async function StorePage() {
  const products = await getProducts();

  return (
    <main className="bg-stone-50">
      <AnnouncementBar />
      <div className="mx-auto max-w-6xl px-6">
        <Navbar />
        <HeroBanner />
        
        {/* Bestsellers Section */}
        <section className="pt-16 pb-12">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#2f3e36' }}>
              Bestseller
            </h2>
            <div 
              className="mx-auto mb-4 rounded-xl" 
              style={{ width: '80px', height: '4px', backgroundColor: '#16a34a' }}
            ></div>
            <p className="text-stone-600 text-lg font-medium">
              Our most popular products
            </p>
          </div>

          <DisplayProducts cols={4} />
        </section>

        {/* Optional: View All Button */}
        <div className="text-center pb-16">
          <Link 
            href="/products"
            className="inline-block px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            View All Products
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
