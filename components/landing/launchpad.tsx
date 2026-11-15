import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ART_TONES, NFT_PIECES } from "@/lib/art";

const STEPS = [
  {
    title: "Create",
    note: "Shape your collection and its story.",
  },
  {
    title: "Review",
    note: "Send a launch request for the team to review.",
  },
  {
    title: "Launch",
    note: "Mint your collection to the GIWA community.",
  },
];

const POINTS = [
  "Launch your own NFT collection.",
  "Discover new projects.",
  "Become part of the growing GIWA NFT ecosystem.",
];

export function LaunchpadSection() {
  const feature = NFT_PIECES[6];

  return (
    <section
      id="launchpad"
      className="section-shell scroll-mt-28 pb-20 pt-4 sm:pb-28 sm:pt-6"
      aria-labelledby="launchpad-title"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:gap-16">
        <div className="order-2 lg:order-1">
          <div className="ui-container relative overflow-hidden rounded-[32px] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-ink/[0.08] pb-4">
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-ink-mute">
                Launchpad preview
              </span>
              <span className="pill">
                <span className="live-dot" />
                Open for requests
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[220px] overflow-hidden rounded-[22px] border border-ink/10 sm:min-h-[240px]">
                <div className={`absolute inset-0 ${ART_TONES[feature.tone].panel}`} />
                <Image
                  src={feature.src}
                  alt={feature.alt}
                  fill
                  sizes="(max-width: 1024px) 45vw, 240px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0812]/85 via-[#0b0812]/20 to-transparent p-4 pt-12">
                  <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">
                    Your collection
                  </p>
                  <p className="mt-1 font-header text-xl font-extrabold tracking-[-0.03em] text-white">
                    Built on GIWA
                  </p>
                </div>
              </div>

              <ol className="flex flex-col gap-2">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex flex-1 flex-col justify-center rounded-[18px] border border-ink/[0.08] bg-paper/70 p-4"
                  >
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-iris">
                      0{index + 1}
                    </span>
                    <p className="mt-1 font-header text-base font-extrabold tracking-[-0.02em] text-ink">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-ink-mute">
                      {step.note}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="eyebrow">NFT Launchpad</p>
          <h2
            id="launchpad-title"
            className="display mt-4 text-[clamp(2.2rem,4.8vw,3.7rem)] text-ink"
          >
            Your collection
            <span className="block text-gradient">starts here.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[14px] leading-7 text-ink-soft">
            ARIWA is bringing an NFT Launchpad to GIWA, giving creators and
            communities the opportunity to launch their own NFT collections.
          </p>

          <ul className="mt-6 space-y-2.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-[12px] text-ink-soft">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-mint/35 text-mint-ink">
                  <Check className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/launchpad" className="btn-ink h-11 px-5 text-[11px]">
              Explore Launchpad
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/launchpad/request"
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition hover:text-iris"
            >
              Request a collection
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
