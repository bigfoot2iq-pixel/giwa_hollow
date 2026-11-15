import Link from "next/link";
import { ArrowUpRight, Coins, Ticket, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = {
  n: string;
  title: string;
  body: string;
  href: string;
  link: string;
  icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Bring a wallet",
    body: "Connect to GIWA Sepolia. If the network is missing, the faucet page adds it in one click.",
    href: "/faucet",
    link: "Add the network",
    icon: Wallet,
  },
  {
    n: "02",
    title: "Get your ARIWA",
    body: "Swap testnet ETH for ARIWA at the fixed-rate desk. It is the ticket to everything else.",
    href: "/trade",
    link: "Open the desk",
    icon: Coins,
  },
  {
    n: "03",
    title: "Pick a door",
    body: "Enter a raffle or mint a resident. Wins settle on-chain and land in your wallet.",
    href: "/raffles",
    link: "Enter a raffle",
    icon: Ticket,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section-shell scroll-mt-28 py-16 sm:py-24"
      aria-labelledby="how-title"
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">How it works</p>
          <h2
            id="how-title"
            className="display mt-4 max-w-xl text-[clamp(2rem,4.4vw,3.3rem)] text-ink"
          >
            Three steps.
            <span className="block text-ink-mute">No paperwork.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[12px] leading-6 text-ink-mute">
          No account, no email, no custody. Your wallet is the only membership
          card in the Hollow.
        </p>
      </div>

      <div className="relative mt-10 overflow-hidden rounded-[32px] border border-ink/[0.09] bg-paper/70 p-2 shadow-[0_34px_80px_-60px_rgba(39,33,50,0.6)] backdrop-blur dark:shadow-[0_34px_80px_-50px_rgba(0,0,0,0.9)]">
        <div className="relative grid gap-2 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-[16%] right-[16%] top-9 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(108,85,224,0.35),rgba(246,199,216,0.6),rgba(108,85,224,0.35),transparent)] md:block dark:bg-[linear-gradient(90deg,transparent,rgba(165,144,255,0.4),rgba(244,185,206,0.45),rgba(165,144,255,0.4),transparent)]"
          />
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.n}
                className="group relative rounded-[24px] px-6 py-7 transition-colors hover:bg-white/60 sm:px-7 dark:hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full border border-iris/20 bg-iris/[0.07] font-mono text-[11px] text-iris-deep">
                    {step.n}
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-full border border-ink/10 bg-paper text-ink-mute transition group-hover:border-iris/25 group-hover:text-iris">
                    <Icon className="size-4" />
                  </span>
                </div>
                <h3 className="mt-6 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-[12px] leading-6 text-ink-soft">
                  {step.body}
                </p>
                <Link
                  href={step.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute transition hover:text-iris"
                >
                  {step.link} <ArrowUpRight className="size-3" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
