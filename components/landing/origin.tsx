import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ART_TONES, NFT_PIECES } from "@/lib/art";

const STATS = [
  { label: "Residents", value: "2,222" },
  { label: "Traits", value: "5 layers" },
  { label: "Chain ID", value: "91342" },
];

const RULES = ["Keep it soft.", "Play fair.", "Never take the hat off."];

export function Origin() {
  const big = NFT_PIECES[1];
  const small = NFT_PIECES[6];

  return (
    <section
      id="origin"
      className="section-shell scroll-mt-28 py-16 sm:py-24"
      aria-labelledby="origin-title"
    >
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow">Origin</p>
          <h2
            id="origin-title"
            className="display mt-4 max-w-xl text-[clamp(2rem,4.4vw,3.3rem)] text-ink"
          >
            ARIWA is
            <span className="block text-ink-mute">small on purpose.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[13px] leading-7 text-ink-soft">
            Most crypto worlds shout. This one is a pocket. 2,222 residents,
            each with their own colour, their own knitted hat, and the same
            permanently curious eye.
          </p>
          <p className="mt-4 max-w-lg text-[13px] leading-7 text-ink-soft">
            It started as a collection. It grew into a place to trade, play, and
            launch. Everything runs on GIWA Sepolia — one wallet, a handful of
            rooms, and absolutely no velvet rope.
          </p>

          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-ink/[0.08] pt-5">
            {STATS.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
                  {item.label}
                </dt>
                <dd className="mt-2 font-mono text-[11px] leading-5 text-ink sm:text-xs">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/#how-it-works"
            className="mt-6 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:text-iris"
          >
            See how it works <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <div className="relative mx-auto w-full max-w-[460px] lg:mx-0 lg:ml-auto">
          <div
            aria-hidden="true"
            className="absolute -inset-x-3 -bottom-3 top-6 rounded-[34px] bg-[linear-gradient(150deg,#d8c9fa,#f6c7d8_55%,#f7e3a0)] opacity-70 blur-[2px] dark:bg-[linear-gradient(150deg,#332a4d,#3c1c29_55%,#3a3018)] dark:opacity-90"
          />

          <figure className="art-frame relative overflow-hidden rounded-[30px]">
            <div className={`relative aspect-square w-full overflow-hidden ${ART_TONES[big.tone].panel}`}>
              <Image
                src={big.src}
                alt={big.alt}
                fill
                sizes="(max-width: 640px) 88vw, 460px"
                className="object-cover object-[50%_38%]"
              />
              <span className="absolute left-4 top-4 rounded-full border border-ink/10 bg-paper/80 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.18em] text-ink-soft backdrop-blur">
                Resident {String(big.id).padStart(4, "0")}
              </span>
            </div>
            <figcaption className="flex items-end justify-between gap-4 p-5">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-iris">
                  {big.trait}
                </p>
                <p className="mt-1.5 font-header text-2xl font-extrabold tracking-[-0.04em] text-ink">
                  {big.name}
                </p>
                <p className="mt-1 text-[11px] text-ink-mute">{big.role}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-iris/10 text-iris">
                <Sparkles className="size-4" />
              </span>
            </figcaption>
          </figure>

          <div className="relative -mt-6 ml-5 w-[62%] rotate-[-4deg] rounded-2xl border border-ink/10 bg-paper/95 p-4 shadow-[0_22px_50px_-30px_rgba(39,33,50,0.6)] backdrop-blur sm:ml-8">
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink-mute">
              House rules
            </p>
            <ul className="mt-2 space-y-1">
              {RULES.map((rule, index) => (
                <li key={rule} className="flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className="font-mono text-[8px] text-iris">
                    0{index + 1}
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="absolute -right-3 top-8 hidden rotate-3 items-end gap-2 rounded-2xl border border-ink/10 bg-paper/90 p-2 shadow-lg backdrop-blur sm:flex">
            <span className={`relative size-14 overflow-hidden rounded-xl ${ART_TONES[small.tone].panel}`}>
              <Image src={small.src} alt="" width={112} height={112} className="size-full object-cover" />
            </span>
            <span className="pb-1 pr-1">
              <span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
                new in town
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold text-ink">{small.name}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
