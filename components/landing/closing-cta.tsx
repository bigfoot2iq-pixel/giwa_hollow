import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { NFT_PIECES } from "@/lib/art";

const CLOUD = NFT_PIECES.find((piece) => piece.id === 2222) ?? NFT_PIECES[2];
const LUNA = NFT_PIECES.find((piece) => piece.id === 1000) ?? NFT_PIECES[4];

export function ClosingCta() {
  return (
    <section className="section-shell pb-16 sm:pb-24" aria-labelledby="closing-title">
      <div className="relative overflow-hidden rounded-[36px] border border-ink/[0.09] bg-[linear-gradient(130deg,#FBF0C9_0%,#FBE3EC_48%,#E1EEFB_100%)] px-6 py-12 shadow-[0_40px_90px_-70px_rgba(39,33,50,0.65)] sm:px-10 sm:py-16 dark:bg-[linear-gradient(130deg,#221c0f_0%,#2a1620_48%,#162230_100%)] dark:shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-white/45 blur-3xl dark:bg-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-iris/10 blur-3xl"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">Welcome home</p>
            <h2
              id="closing-title"
              className="display mt-5 max-w-2xl text-[clamp(2.1rem,5vw,3.8rem)] text-ink"
            >
              There is a spot for you
              <span className="block text-iris-deep">in the Hollow.</span>
            </h2>
            <p className="mt-5 max-w-lg text-[13px] leading-7 text-ink-soft">
              Get your first ARIWA, take a chance on a raffle, and pick the
              resident who looks most like your kind of trouble.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/trade" className="btn-ink">
                Buy your ARIWA
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://x.com/ARIWA_on_Giwa"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-soft"
              >
                Say hi on X
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>

            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
              No sign-up · no custody · GIWA Sepolia
            </p>
          </div>

          <div className="relative mx-auto flex h-[280px] w-full max-w-[420px] items-center justify-center sm:h-[320px]">
            <div
              aria-hidden="true"
              className="animate-breathe absolute size-[280px] rounded-full bg-blush/60 blur-2xl sm:size-[320px] dark:bg-[#f6c7d8]/20"
            />
            <div
              aria-hidden="true"
              className="absolute size-[282px] rounded-full border border-ink/10 sm:size-[322px]"
            />
            <div
              aria-hidden="true"
              className="animate-spin-slow absolute size-[246px] rounded-full border border-dashed border-ink/15 sm:size-[286px]"
            />

            <div className="relative size-[220px] overflow-hidden rounded-full border-[5px] border-paper shadow-[0_28px_60px_-30px_rgba(39,33,50,0.55)] sm:size-[250px] dark:border-white/15 dark:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.85)]">
              <Image
                src={CLOUD.src}
                alt={CLOUD.alt}
                fill
                sizes="250px"
                className="object-cover object-[50%_42%]"
              />
            </div>

            <div className="absolute -bottom-1 right-2 flex items-center gap-2 rounded-2xl border border-ink/10 bg-paper/90 p-2 shadow-[0_18px_40px_-24px_rgba(39,33,50,0.55)] backdrop-blur sm:right-0">
              <span className="relative size-12 overflow-hidden rounded-full border border-ink/10">
                <Image src={LUNA.src} alt="" width={96} height={96} className="size-full object-cover" />
              </span>
              <span className="pr-1.5">
                <span className="block font-mono text-[8px] uppercase tracking-[0.16em] text-ink-mute">
                  moved in
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-ink">
                  {LUNA.name} is waiting
                </span>
              </span>
            </div>

            <span className="absolute left-0 top-6 rotate-[-5deg] rounded-full border border-ink/10 bg-paper/85 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-iris-deep backdrop-blur">
              2,222 residents
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
