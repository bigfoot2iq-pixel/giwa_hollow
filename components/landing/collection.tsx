import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HOME_COLLECTION } from "@/lib/art";

export function CollectionSection() {
  return (
    <section
      id="collection"
      className="section-shell scroll-mt-28 py-20 sm:py-28"
      aria-labelledby="collection-title"
    >
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow">NFT Collection</p>
          <h2
            id="collection-title"
            className="display mt-4 text-[clamp(2.2rem,4.8vw,3.7rem)] text-ink"
          >
            2,222 unique NFTs.
            <span className="block text-ink-mute">One community.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[13px] leading-7 text-ink-soft">
          Discover the first PFP collection on GIWA. Each NFT represents a part
          of the ARIWA ecosystem and its growing community.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {HOME_COLLECTION.map((piece) => (
          <figure
            key={piece.id}
            className="group relative aspect-square overflow-hidden rounded-[22px] border border-ink/10 bg-paper"
          >
            <Image
              src={piece.src}
              alt={piece.alt}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 23vw, 280px"
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[#0b0812]/85 via-[#0b0812]/25 to-transparent p-3 pt-12">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/70">
                #{String(piece.id).padStart(4, "0")}
              </span>
              <span className="text-[10px] font-semibold text-white">
                {piece.name}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-ink/[0.08] pt-5 sm:flex-row sm:items-center">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
          ERC-721 · 2,222 pieces · GIWA Sepolia
        </p>
        <Link href="/launchpad" className="btn-ink h-11 px-5 text-[11px]">
          Explore the Collection
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
