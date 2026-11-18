import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { TELEGRAM_URL, TelegramLogo } from "@/components/layout/TelegramLink";

const FAQS = [
  {
    q: "What is ARIWA?",
    a: "ARIWA is a 2,222-piece collection of soft little residents on GIWA Sepolia. Around them sits a small world: a tradable token, raffles, a launchpad, and a leaderboard.",
  },
  {
    q: "How do I get ARIWA tokens?",
    a: "Connect your wallet on GIWA Sepolia and open the trade page. The AMM pool swaps testnet ETH for ARIWA at the live curve price, and the balance lands straight in your wallet.",
  },
  {
    q: "What can I do with ARIWA?",
    a: "ARIWA is the entry ticket to every raffle. It also appears on the leaderboard, so holding a little is its own small game.",
  },
  {
    q: "How are raffle winners chosen?",
    a: "Every raffle settles on-chain. The contract draws the winner when the countdown ends or the last spot fills, and the prize is sent to the winning wallet. The entries list and transaction hashes stay public.",
  },
  {
    q: "What is the launchpad?",
    a: "The launchpad is where the ARIWA collection lives on GIWA. It also hosts approved community collections. Builders can send a launch request with their supply, price, and preferred date.",
  },
  {
    q: "Is ARIWA worth anything?",
    a: "No. GIWA Sepolia is a testnet and ARIWA is an experimental plaything with no monetary value. Raffles and mints are on-chain and final, but nothing here is financial advice.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="section-shell scroll-mt-28 pb-20 sm:pb-28">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">FAQ</p>
          <h2 className="display mt-4 text-[clamp(2rem,4.4vw,3.1rem)] text-ink">
            The fine print,
            <span className="block text-ink-mute">without the fine print.</span>
          </h2>
          <p className="mt-4 max-w-sm text-[12px] leading-6 text-ink-mute">
            Everything about the collection, the token, the raffles, and the
            very small print at the bottom.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:text-[#229ED9]"
            >
              <TelegramLogo className="size-3.5 text-[#229ED9]" />
              Ask on Telegram <ArrowUpRight className="size-3" />
            </a>
            <a
              href="https://x.com/ARIWA_on_Giwa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:text-iris"
            >
              Ask on X <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>

        <div className="border-t border-ink/[0.08]">
          {FAQS.map((item, index) => (
            <details
              key={item.q}
              className="group border-b border-ink/[0.08]"
              open={index === 0}
            >
              <summary className="flex cursor-pointer items-start justify-between gap-6 py-5 text-sm font-medium text-ink transition hover:text-iris">
                <span className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[9px] text-ink-mute">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </span>
                <span className="accordion-plus mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink-mute transition-transform duration-300 group-hover:border-iris/30 group-hover:text-iris">
                  <Plus className="size-3" />
                </span>
              </summary>
              <div className="pb-5 pl-8 pr-10 text-[12px] leading-6 text-ink-soft">
                {item.a}
              </div>
            </details>
          ))}

          <p className="mt-6 text-[11px] leading-6 text-ink-mute">
            Still curious?{" "}
            <Link href="/raffles" className="font-semibold text-iris hover:underline">
              Explore the raffles
            </Link>{" "}
            and poke around.
          </p>
        </div>
      </div>
    </section>
  );
}
