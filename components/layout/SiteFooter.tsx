import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const PRODUCT = [
  { label: "Profile", href: "/profile" },
  { label: "Trade ARIWA", href: "/trade" },
  { label: "Launchpad", href: "/launchpad" },
  { label: "Create", href: "/create" },
  { label: "Faucet", href: "/faucet" },
  { label: "Leaderboard", href: "/leaderboard" },
];

const NETWORK = [
  { label: "GIWA Explorer", href: "https://sepolia-explorer.giwa.io" },
  { label: "GIWA faucet", href: "https://faucet.giwa.io" },
  { label: "Nodit faucet", href: "https://faucet.lambda256.io/giwa-sepolia" },
  { label: "GIWA docs", href: "https://docs.giwa.io" },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-ink/[0.08]">
      <div className="section-shell pb-10 pt-14 sm:pb-12 sm:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.35fr_0.7fr_0.7fr]">
          <div>
            <Link href="/home" className="inline-flex items-center gap-3" aria-label="ARIWA home">
              <span className="relative inline-flex size-11 overflow-hidden rounded-full border border-ink/10">
                <Image
                  src="/brand/ariwa-icon.webp"
                  alt=""
                  width={88}
                  height={88}
                  className="size-full object-cover"
                />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-header text-[14px] font-extrabold tracking-[0.2em] text-ink">
                  ARIWA
                </span>
              </span>
            </Link>

            <p className="mt-5 max-w-xs text-[12px] leading-6 text-ink-mute">
              2,222 unique NFTs on GIWA. Trade the token, launch a collection —
              and be part of the ecosystem.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="pill">
                <span className="live-dot" />
                GIWA Sepolia
              </span>
              <span className="pill">Chain 91342</span>
            </div>

            <a
              href="https://x.com/ARIWA_on_Giwa"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:text-iris"
            >
              Follow ARIWA <ArrowUpRight className="size-3" />
            </a>
          </div>

          <FooterColumn title="Product" links={PRODUCT} />
          <FooterColumn title="GIWA" links={NETWORK} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
            © {new Date().getFullYear()} ARIWA · An experimental plaything
          </p>
          <p className="max-w-xl text-[10px] leading-5 text-ink-mute sm:text-right">
            GIWA Sepolia is a testnet. ARIWA has no monetary value and nothing
            here is financial advice. Mints are on-chain and final.
          </p>
        </div>
      </div>

      <div className="pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <p className="translate-y-[16%] text-center font-header text-[clamp(4.5rem,15.5vw,14rem)] font-extrabold leading-[0.8] tracking-[-0.06em] text-ink/[0.045]">
          ARIWA
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            {link.href.startsWith("http") ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11.5px] text-ink-soft transition hover:text-iris"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-[11.5px] text-ink-soft transition hover:text-iris"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
