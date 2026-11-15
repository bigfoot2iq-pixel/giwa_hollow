import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { NFT_PIECES, type NftPiece } from "@/lib/art";

const TICKET_FACES = [NFT_PIECES[1], NFT_PIECES[2], NFT_PIECES[5]];

export function RaffleSection() {
  return (
    <section
      id="raffle"
      className="section-shell scroll-mt-28 py-4 sm:py-6"
      aria-labelledby="raffle-title"
    >
      <div className="relative overflow-hidden rounded-[34px] border border-[#f0c3d5] bg-[linear-gradient(120deg,#fff2f6_0%,#fbe0ea_55%,#f7e3a0_100%)] p-7 sm:p-10 lg:p-14 dark:border-[#51283a] dark:bg-[linear-gradient(120deg,#241017_0%,#2f1621_55%,#332a12_100%)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-white/50 blur-3xl dark:bg-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-iris/10 blur-3xl"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.82fr] lg:gap-16">
          <div>
            <p className="eyebrow">Community Raffle</p>
            <h2
              id="raffle-title"
              className="display mt-4 text-[clamp(2.2rem,4.8vw,3.7rem)] text-ink"
            >
              The community
              <span className="block text-blush-ink">comes first.</span>
            </h2>
            <p className="mt-5 max-w-lg text-[13.5px] leading-7 text-ink-soft">
              We believe in rewarding the people who support ARIWA. Join our
              community raffles for opportunities to win exclusive rewards and
              participate in special giveaways.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/raffles" className="btn-ink h-11 px-5 text-[11px]">
                Join the Raffle
                <ArrowRight className="size-3.5" />
              </Link>
              <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
                <span className="live-dot" />
                On-chain draws
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[390px]">
            <div className="rotate-[-2deg] rounded-[28px] border border-ink/10 bg-paper p-4 shadow-[0_30px_60px_-38px_rgba(39,33,50,0.55)]">
              <div className="flex items-center justify-between gap-3 border-b border-dashed border-ink/15 pb-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-iris">
                  ARIWA raffle
                </span>
                <Ticket className="size-4 text-iris" />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {TICKET_FACES.map((piece) => (
                  <TicketFace key={piece.id} piece={piece} />
                ))}
              </div>

              <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-ink/15 pt-3">
                <div>
                  <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-ink-mute">
                    Rewards & giveaways
                  </p>
                  <p className="mt-1 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                    Win something soft.
                  </p>
                </div>
                <span className="rounded-full bg-iris/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-iris-deep">
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketFace({ piece }: { piece: NftPiece }) {
  return (
    <span className="relative aspect-square overflow-hidden rounded-xl border border-ink/10">
      <Image
        src={piece.src}
        alt={piece.alt}
        fill
        sizes="(max-width: 640px) 24vw, 110px"
        className="object-cover"
      />
    </span>
  );
}
