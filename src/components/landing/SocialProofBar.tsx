import { StarIcon } from "@heroicons/react/20/solid";
import type { SocialProof } from "@/components/landing/data/landingPageData";

export function SocialProofBar({ proof }: { proof: SocialProof }) {
  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[linear-gradient(120deg,var(--gv-lime-dim),var(--gv-lime))] py-7 text-white sm:py-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/8 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-[1280px] gap-5 px-4 sm:px-6 lg:grid-cols-[0.72fr_0.72fr_0.72fr_1.3fr] lg:items-center lg:px-8">
        <div>
          <div className="flex gap-1 text-[#ffd76b]" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => <StarIcon key={index} className="h-5 w-5" />)}
          </div>
          <p className="mt-2 font-[family:var(--font-syne)] text-2xl font-bold text-white">{proof.rating}</p>
          <p className="text-sm text-white/72">Kundenzufriedenheit</p>
        </div>
        <div className="border-t border-white/20 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="font-[family:var(--font-syne)] text-2xl font-bold text-white">{proof.supportResponseTime}</p>
          <p className="text-sm text-white/72">Support-Antwortzeit</p>
        </div>
        <div className="border-t border-white/20 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="font-[family:var(--font-syne)] text-2xl font-bold text-white">{proof.deliveryTime}</p>
          <p className="text-sm text-white/72">durchschnittliche Lieferung</p>
        </div>
        <blockquote className="border-t border-white/20 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="text-base leading-7 text-white">&ldquo;{proof.quote}&rdquo;</p>
          <footer className="mt-2 text-sm font-semibold text-[#ffd76b]">{proof.quoteAuthor}</footer>
        </blockquote>
      </div>
    </section>
  );
}
