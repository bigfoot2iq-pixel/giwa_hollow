import { ArrowUpRight } from "lucide-react";

const X_URL = "https://x.com/ARIWA_on_Giwa";

export function FinalCta() {
  return (
    <section
      id="join"
      className="section-shell scroll-mt-28 pb-20 pt-10 sm:pb-28 sm:pt-14"
      aria-labelledby="final-title"
    >
      <div className="relative overflow-hidden rounded-[36px] bg-[#1d1826] px-6 py-16 text-center shadow-[0_40px_90px_-70px_rgba(20,15,30,0.9)] sm:px-12 sm:py-20 dark:border dark:border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
            backgroundSize: "30px 30px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-iris/20 blur-[110px]"
        />

        <div className="relative">
          <p className="inline-flex items-center gap-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.26em] text-iris-soft">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-iris-soft/70" />
            The next chapter
          </p>

          <h2
            id="final-title"
            className="display mx-auto mt-5 max-w-3xl text-[clamp(2.6rem,6vw,4.9rem)] text-white"
          >
            This is just
            <span className="block text-iris-soft">the beginning.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-[14px] leading-7 text-white/60">
            2,222 NFTs. One ecosystem. Endless possibilities. Welcome to ARIWA.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#f7e3a0] px-5 text-[12px] font-bold text-[#272132] transition hover:brightness-105"
            >
              Join Our Community
              <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-[12px] font-semibold text-white/80 backdrop-blur transition hover:border-white/30 hover:text-white"
            >
              Follow Us on X
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>

          <p className="mt-9 font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">
            ARIWA · GIWA Sepolia
          </p>
        </div>
      </div>
    </section>
  );
}
