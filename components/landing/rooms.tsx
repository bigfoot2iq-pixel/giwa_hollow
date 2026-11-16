import Image from "next/image";
import Link from "next/link";
import { ArrowDownUp, ArrowUpRight, Droplets, Rocket, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NFT_PIECES } from "@/lib/art";

type Room = {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  panel: string;
  ink: string;
  art: number;
};

const ROOMS: Room[] = [
  {
    href: "/trade",
    eyebrow: "The market",
    title: "Trade ARIWA",
    body: "Swap ETH for ARIWA and back against a live x × y = k curve. Every order settles on-chain, instantly, with a red/green chart of the price.",
    cta: "Open the desk",
    icon: ArrowDownUp,
    panel: "tone-panel-lilac",
    ink: "text-lilac-ink",
    art: 2112,
  },
  {
    href: "/raffles",
    eyebrow: "The drawing room",
    title: "Enter raffles",
    body: "Platform raffles with fixed odds and on-chain draws. Prizes delivered straight to your wallet.",
    cta: "Browse raffles",
    icon: Ticket,
    panel: "tone-panel-blush",
    ink: "text-blush-ink",
    art: 777,
  },
  {
    href: "/launchpad",
    eyebrow: "The nursery",
    title: "Mint a resident",
    body: "Take home one of the 2,222. Every character is a one-off mix of skin, eye, mouth and hat.",
    cta: "Open launchpad",
    icon: Rocket,
    panel: "tone-panel-sky",
    ink: "text-sky-ink",
    art: 2222,
  },
  {
    href: "/faucet",
    eyebrow: "The well",
    title: "Grab testnet gas",
    body: "One click to add GIWA Sepolia, plus the official faucets for a drop of ETH when you run dry.",
    cta: "Open faucet",
    icon: Droplets,
    panel: "tone-panel-mint",
    ink: "text-mint-ink",
    art: 314,
  },
];

export function Rooms() {
  return (
    <section
      id="rooms"
      className="section-shell scroll-mt-28 py-16 sm:py-24"
      aria-labelledby="rooms-title"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">The rooms</p>
          <h2
            id="rooms-title"
            className="display mt-4 max-w-xl text-[clamp(2rem,4.4vw,3.3rem)] text-ink"
          >
            There is always
            <span className="block text-ink-mute">something to do.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[12px] leading-6 text-ink-mute">
          Four doors, one wallet. Everything is live on GIWA Sepolia and every
          action stays on-chain.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {ROOMS.map((room, index) => {
          const piece = NFT_PIECES.find((item) => item.id === room.art) ?? NFT_PIECES[0];
          const Icon = room.icon;
          const isLastOdd = ROOMS.length % 2 === 1 && index === ROOMS.length - 1;
          return (
            <Link
              key={room.href}
              href={room.href}
              className={`group relative overflow-hidden rounded-[26px] border border-ink/10 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-38px_rgba(39,33,50,0.55)] sm:p-7 dark:border-white/10 dark:hover:shadow-[0_28px_60px_-30px_rgba(0,0,0,0.85)] ${
                isLastOdd ? "md:col-span-2" : ""
              } ${room.panel}`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-white/45 blur-2xl dark:bg-white/[0.04]"
              />
              <div className="relative flex items-start justify-between gap-4">
                <span
                  className={`flex size-11 items-center justify-center rounded-2xl border border-ink/10 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] ${room.ink}`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/55 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-soft backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
                  Open
                  <ArrowUpRight className="size-2.5" />
                </span>
              </div>

              <div className="relative mt-5 max-w-[70%]">
                <p
                  className={`font-mono text-[9px] uppercase tracking-[0.2em] ${room.ink}`}
                >
                  {room.eyebrow}
                </p>
                <h3 className="mt-2 font-header text-2xl font-extrabold tracking-[-0.04em] text-ink">
                  {room.title}
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-ink-soft">{room.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink transition group-hover:gap-2.5">
                  {room.cta} <ArrowUpRight className="size-3" />
                </span>
              </div>

              <span className="absolute -bottom-5 -right-4 size-32 overflow-hidden rounded-full border-4 border-white/60 shadow-[0_18px_40px_-22px_rgba(39,33,50,0.55)] sm:size-40 dark:border-white/15 dark:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]">
                <Image
                  src={piece.src}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover object-[50%_35%] transition-transform duration-500 group-hover:scale-105"
                />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
