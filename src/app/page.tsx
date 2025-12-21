import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f4f2] flex items-center justify-center">
      <div className="text-center">

        {/* Brand */}
        <h1 className="mb-10 text-3xl font-semibold tracking-[0.3em] text-stone-800">
          SMOKEIFY
        </h1>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link
            href="/store"
            className="
              px-10 py-4
              border border-stone-800
              text-sm uppercase tracking-widest
              bg-stone-500
              hover:bg-stone-800 hover:text-white
              transition
            "
          >
            Store
          </Link>

          <Link
            href="/customizer"
            className="
              px-10 py-4
              border border-stone-800
              text-sm uppercase tracking-widest
              bg-stone-500
              hover:bg-stone-800 hover:text-white
              transition
            "
          >
            Customizer
          </Link>
        </div>

      </div>
    </main>
  );
}
