import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, Palette, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Phase = {
  n: string;
  title: string;
  status: "Live" | "Next" | "Planned";
  icon: LucideIcon;
  body: string;
  chips: string[];
  tone: string;
  border: string;
};

const PHASES: Phase[] = [
  {
    n: "01",
    title: "Move in",
    status: "Live",
    icon: CircleDollarSign,
    body: "Connect a wallet, grab testnet gas, and pick up ARIWA on the trade desk. The token is the key to every room in ARIWA. No forms, no email — connect, trade, and you are already part of the place.",
    chips: ["Trade ARIWA", "Faucet", "Leaderboard"],
    tone: "tone-panel-butter",
    border: "tone-border-butter",
  },
  {
    n: "02",
    title: "Take a chance",
    status: "Live",
    icon: Ticket,
    body: "Enter platform raffles and take a chance. Draws settle on-chain and prizes go straight to the winner. Every draw is public, and every prize lands in the winner's wallet.",
    chips: ["Platform raffles", "On-chain draws", "Live prizes"],
    tone: "tone-panel-blush",
    border: "tone-border-blush",
  },
  {
    n: "03",
    title: "Make your own",
    status: "Next",
    icon: Palette,
    body: "The launchpad opens ARIWA to other builders. Request a collection, get it reviewed, and mint it to the same soft little world.",
    chips: ["Collection mints", "Builder requests", "More residents"],
    tone: "tone-panel-lilac",
    border: "tone-border-lilac",
  },
];

const STATUS_STYLE: Record<Phase["status"], string> = {
  Live: "border-success/25 bg-success/[0.08] text-success-ink",
  Next: "border-iris/25 bg-iris/[0.07] text-iris-deep",
  Planned: "border-ink/10 bg-ink/[0.04] text-ink-mute",
};

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="section-shell scroll-mt-28 py-16 sm:py-24"
      aria-labelledby="roadmap-title"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2
            id="roadmap-title"
            className="display mt-4 max-w-xl text-[clamp(2rem,4.4vw,3.3rem)] text-ink"
          >
            Built in small steps,
            <span className="block text-ink-mute">never in big promises.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[12px] leading-6 text-ink-mute">
          No mystery dates and no vapour. The rooms that exist are open now;
          everything else gets built in public.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PHASES.map((phase) => {
          const Icon = phase.icon;
          return (
            <div key={phase.n} className="relative">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full border border-ink/10 bg-paper font-mono text-[11px] text-ink-soft">
                  {phase.n}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-ink/15 to-transparent" />
              </div>

              <article
                className={`relative flex h-full flex-col overflow-hidden rounded-[26px] border ${phase.border} ${phase.tone} p-6`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-white/40 blur-2xl dark:bg-white/[0.05]"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <h3 className="font-header text-xl font-extrabold tracking-[-0.035em] text-ink">
                    {phase.title}
                  </h3>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white/50 text-ink-soft dark:border-white/10 dark:bg-white/[0.06]">
                    <Icon className="size-4" />
                  </span>
                </div>

                <p className="relative mt-3 flex-1 text-[12px] leading-6 text-ink-soft">
                  {phase.body}
                </p>

                <ul className="relative mt-5 flex flex-wrap gap-1.5 border-t border-ink/[0.08] pt-4">
                  {phase.chips.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-full border border-ink/10 bg-white/45 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-soft dark:border-white/10 dark:bg-white/[0.06]"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>

                <div className="relative mt-4 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] ${STATUS_STYLE[phase.status]}`}
                  >
                    {phase.status === "Live" && <span className="live-dot" />}
                    {phase.status}
                  </span>
                  <Link
                    href={phase.status === "Live" ? "/raffles" : "/create"}
                    className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-mute transition hover:text-iris"
                  >
                    {phase.status === "Live" ? "Step in" : "Peek ahead"}
                    <ArrowUpRight className="size-2.5" />
                  </Link>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
