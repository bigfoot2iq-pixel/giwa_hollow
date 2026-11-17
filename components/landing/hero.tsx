import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { NFT_PIECES, type NftPiece } from "@/lib/art";

const WALL = {
  feature: NFT_PIECES[0],
  tiles: [NFT_PIECES[1], NFT_PIECES[2], NFT_PIECES[3], NFT_PIECES[4]],
};

const ECOSYSTEM = ["NFTs", "Token", "Launchpad", "Community"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink/[0.08]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-32 -top-24 size-[540px] rounded-full bg-blush/30 blur-[130px] dark:bg-[#f6c7d8]/10" />
        <div className="absolute -left-40 bottom-0 size-[460px] rounded-full bg-mint/25 blur-[120px] dark:bg-[#b9e5ce]/10" />
      </div>

      <div className="section-shell relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-24 lg:pt-20">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-paper/65 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft backdrop-blur">
            <span className="live-dot" />
            The first PFP collection on GIWA
          </span>

          <h1 className="display mt-7 text-[clamp(3.1rem,6.4vw,5.5rem)] text-ink">
            Welcome to
            <span className="mt-1 block text-gradient">ARIWA.</span>
          </h1>

          <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-ink-soft">
            The first PFP NFT collection on GIWA, featuring 2,222 unique NFTs.
            More than just an NFT collection — ARIWA is building an ecosystem
            for its community.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="#collection" className="btn-ink">
              Explore Collection
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/trade" className="btn-soft">
              Trade ARIWA
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/[0.08] pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
            {ECOSYSTEM.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-4">
                {index > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-iris/35" />}
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3.5">
              <figure className="relative col-span-2 row-span-2 overflow-hidden rounded-[28px] border border-ink/10 bg-paper shadow-[0_28px_60px_-42px_rgba(39,33,50,0.55)]">
                <Image
                  src={WALL.feature.src}
                  alt={WALL.feature.alt}
                  fill
                  priority
                  sizes="(max-width: 640px) 62vw, (max-width: 1024px) 40vw, 370px"
                  className="object-cover"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0812]/85 via-[#0b0812]/25 to-transparent p-4 pt-16 sm:p-5 sm:pt-20">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/55">
                        ARIWA #{String(WALL.feature.id).padStart(4, "0")}
                      </p>
                      <p className="mt-1.5 font-header text-xl font-extrabold tracking-[-0.03em] text-white sm:text-2xl">
                        {WALL.feature.name}
                      </p>
                    </div>
                    <span className="hidden rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.14em] text-white/75 backdrop-blur sm:inline-flex">
                      Genesis
                    </span>
                  </div>
                </figcaption>
              </figure>

              {WALL.tiles.map((piece) => (
                <PortraitTile key={piece.id} piece={piece} />
              ))}

              <div className="flex flex-col justify-between rounded-[20px] border border-ink bg-ink p-3.5 text-cream sm:p-4">
                <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-cream/45">
                  Collection
                </span>
                <div>
                  <p className="font-header text-[clamp(1.35rem,2.7vw,1.9rem)] font-extrabold leading-none tracking-[-0.04em]">
                    2,222
                  </p>
                  <p className="mt-1.5 text-[9px] leading-4 text-cream/55">
                    unique residents on GIWA
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/[0.08] pt-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-mute">
                Selected from the collection
              </p>
              <Link
                href="#collection"
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition hover:text-iris"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PortraitTile({ piece }: { piece: NftPiece }) {
  return (
    <figure className="group relative aspect-square overflow-hidden rounded-[18px] border border-ink/10 bg-paper">
      <Image
        src={piece.src}
        alt={piece.alt}
        fill
        sizes="(max-width: 640px) 18vw, (max-width: 1024px) 14vw, 170px"
        className="object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
      />
    </figure>
  );
}
