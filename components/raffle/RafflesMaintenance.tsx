import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bell, Rocket, ShieldCheck } from "lucide-react";
import { NFT_PIECES } from "@/lib/art";

const NOTES = [
  {
    icon: Rocket,
    title: "Launchpad is open",
    text: "Mint a resident while the raffle room gets its refresh.",
  },
  {
    icon: ShieldCheck,
    title: "Everything stays put",
    text: "Existing on-chain raffles and prizes are untouched.",
  },
  {
    icon: Bell,
    title: "Back soon",
    text: "Follow ARIWA on X for the reopening announcement.",
  },
];

export function RafflesMaintenance() {
  const art = NFT_PIECES.find((piece) => piece.id === 2112) ?? NFT_PIECES[3];

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="ui-container overflow-hidden rounded-[30px]">
          <div className="relative overflow-hidden bg-[linear-gradient(130deg,#FBF0C9_0%,#FBE3EC_50%,#E1EEFB_100%)] px-6 py-10 sm:px-10 sm:py-12 dark:bg-[linear-gradient(130deg,#221c0f_0%,#2a1620_50%,#162230_100%)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/45 blur-3xl dark:bg-white/[0.04]"
            />
            <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <span className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-paper/80 shadow-[0_18px_40px_-22px_rgba(39,33,50,0.55)] dark:border-white/15">
                <Image src={art.src} alt={art.alt} fill sizes="96px" className="object-cover" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-iris-deep">
                  Temporary pause
                </p>
                <h1 className="mt-2 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink sm:text-4xl">
                  The raffle room is being fluffed
                </h1>
                <p className="mt-3 max-w-xl text-[12px] leading-6 text-ink-soft">
                  We are rebuilding the raffle experience right now. The page
                  will be back as soon as the cushions are plumped — thanks for
                  waiting.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-3">
              {NOTES.map((note) => {
                const Icon = note.icon;
                return (
                  <div
                    key={note.title}
                    className="rounded-2xl border border-ink/[0.08] bg-cream/50 p-4"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-paper text-iris">
                      <Icon className="size-4" />
                    </span>
                    <p className="mt-3 text-[12px] font-bold text-ink">{note.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink-mute">{note.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Link href="/launchpad" className="btn-ink h-11 px-5 text-[11px]">
                <Rocket className="size-4" />
                Go to launchpad
              </Link>
              <Link href="/home" className="btn-soft h-11 px-5 text-[11px]">
                <ArrowLeft className="size-3.5" />
                Home
              </Link>
              <a
                href="https://x.com/ARIWA_on_Giwa"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-soft h-11 px-5 text-[11px]"
              >
                Follow updates
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
