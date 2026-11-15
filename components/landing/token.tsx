import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const BULLETS = [
  "Buy and sell ARIWA.",
  "Track token price and market activity.",
  "Access the ARIWA trading experience.",
];

export function TokenSection() {
  return (
    <section
      id="token"
      className="section-shell scroll-mt-28 py-4 sm:py-6"
      aria-labelledby="token-title"
    >
      <div className="relative overflow-hidden rounded-[34px] bg-[#1d1826] text-white shadow-[0_40px_90px_-70px_rgba(20,15,30,0.9)] dark:border dark:border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
            backgroundSize: "30px 30px",
            maskImage: "radial-gradient(ellipse at 28% 10%, black 0%, transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-1/2 size-[420px] -translate-y-1/2 rounded-full bg-iris/20 blur-[110px]" />

        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:p-14">
          <div>
            <p className="inline-flex items-center gap-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.26em] text-iris-soft">
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-iris-soft/70" />
              ARIWA Token
            </p>

            <h2
              id="token-title"
              className="display mt-5 text-[clamp(2.3rem,4.8vw,3.8rem)] text-white"
            >
              Trade. Hold.
              <span className="block text-iris-soft">Be part of ARIWA.</span>
            </h2>

            <p className="mt-5 max-w-lg text-[14px] leading-7 text-white/60">
              Discover and trade the ARIWA token directly through our platform.
            </p>

            <ul className="mt-7 space-y-3">
              {BULLETS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[12.5px] text-white/70">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-iris/40 bg-iris/15 text-iris-soft">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/trade"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#f7e3a0] px-5 text-[12px] font-bold text-[#272132] transition hover:brightness-105"
            >
              Trade ARIWA
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[360px] rounded-[30px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
                  Token pass
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/60">
                  <span className="live-dot" />
                  Live
                </span>
              </div>

              <div className="mt-7 flex items-center gap-4">
                <span className="flex size-20 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(140deg,#b9acf5,#6c55e0)] font-header text-4xl font-extrabold text-white shadow-[0_18px_40px_-20px_rgba(108,85,224,0.9)]">
                  A
                </span>
                <div className="min-w-0">
                  <p className="font-header text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-white">
                    ARIWA
                  </p>
                  <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">
                    Ecosystem token
                  </p>
                </div>
              </div>

              <dl className="mt-7 divide-y divide-white/10 border-y border-white/10">
                <TokenRow label="Network" value="GIWA Sepolia" />
                <TokenRow label="Standard" value="ERC-20" />
                <TokenRow label="Access" value="Open to everyone" />
              </dl>

              <p className="mt-4 text-[10px] leading-5 text-white/40">
                Buy, sell, and follow the token from one place.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TokenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </dt>
      <dd className="text-[11px] font-medium text-white/80">{value}</dd>
    </div>
  );
}
