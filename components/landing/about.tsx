import { ArrowDownUp, Gem, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PILLARS: {
  icon: LucideIcon;
  title: string;
  note: string;
  tile: string;
}[] = [
  {
    icon: Gem,
    title: "2,222 NFTs",
    note: "Unique PFP residents, each with its own mix of traits.",
    tile: "bg-butter/45 text-butter-ink",
  },
  {
    icon: ArrowDownUp,
    title: "ARIWA token",
    note: "Trade and hold the token that connects the ecosystem.",
    tile: "bg-lilac/50 text-lilac-ink",
  },
  {
    icon: Users,
    title: "Community",
    note: "Rewards and launches built around holders.",
    tile: "bg-mint/45 text-mint-ink",
  },
];

export function About() {
  return (
    <section
      id="about"
      className="section-shell scroll-mt-28 py-20 sm:py-28"
      aria-labelledby="about-title"
    >
      <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:gap-20">
        <div>
          <p className="eyebrow">About ARIWA</p>
          <h2
            id="about-title"
            className="display mt-4 text-[clamp(2.2rem,4.8vw,3.7rem)] text-ink"
          >
            A new era begins
            <span className="block text-ink-mute">on GIWA.</span>
          </h2>
          <div className="mt-7 flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-10 bg-iris/40" />
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
              One collection. One ecosystem.
            </p>
          </div>
        </div>

        <div className="lg:pt-2">
          <p className="max-w-2xl text-[15px] leading-8 text-ink-soft">
            ARIWA is bringing together NFTs, token trading, community rewards,
            and NFT launches into one ecosystem.
          </p>
          <p className="mt-5 max-w-2xl text-[13.5px] leading-7 text-ink-mute">
            Built around a community of 2,222 NFT holders, ARIWA aims to create
            more opportunities for everyone involved.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.title}
                  className="rounded-[22px] border border-ink/[0.08] bg-paper/60 p-5 backdrop-blur"
                >
                  <span
                    className={`flex size-9 items-center justify-center rounded-xl ${pillar.tile}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <h3 className="mt-4 font-header text-[15px] font-extrabold tracking-[-0.02em] text-ink">
                    {pillar.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-ink-mute">
                    {pillar.note}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
