import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ART_TONES, NFT_PIECES } from "@/lib/art";

export function CollectionShelf() {
  return (
    <section
      id="residents"
      className="section-shell scroll-mt-28 py-16 sm:py-24"
      aria-labelledby="residents-title"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">The residents</p>
          <h2
            id="residents-title"
            className="display mt-4 max-w-xl text-[clamp(2rem,4.4vw,3.3rem)] text-ink"
          >
            Eight faces from
            <span className="block text-ink-mute">a very small world.</span>
          </h2>
        </div>
        <div className="max-w-sm">
          <p className="text-[12px] leading-6 text-ink-mute">
            Every resident is one eye, one wink, and a hat they will not take
            off. The rest is personality.
          </p>
          <Link
            href="/launchpad"
            className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:text-iris"
          >
            Mint the collection <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NFT_PIECES.map((piece, index) => {
          const tone = ART_TONES[piece.tone];
          return (
            <Link
              key={piece.id}
              href="/launchpad"
              className="group animate-rise"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <article className="art-frame flex h-full flex-col overflow-hidden rounded-[24px] transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_30px_60px_-36px_rgba(39,33,50,0.55)]">
                <div className={`relative aspect-square overflow-hidden ${tone.panel}`}>
                  <Image
                    src={piece.src}
                    alt={piece.alt}
                    fill
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 290px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-ink/10 bg-paper/80 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur">
                    #{String(piece.id).padStart(4, "0")}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 size-4 rounded-full border border-paper/70 shadow-[0_0_16px_rgba(39,33,50,0.35)]"
                    style={{
                      background: `radial-gradient(circle at 32% 28%, #fff 0%, ${piece.eye} 45%, #2b2438 100%)`,
                    }}
                  />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                        {piece.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-mute">{piece.role}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${tone.chip}`}>
                      {piece.trait}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-ink/[0.07] pt-3">
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-faint">
                      Resident
                    </span>
                    <span className="flex size-7 items-center justify-center rounded-full border border-ink/10 text-ink-mute transition group-hover:border-iris/30 group-hover:bg-iris/10 group-hover:text-iris">
                      <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
