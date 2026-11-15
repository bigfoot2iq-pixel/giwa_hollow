import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Send } from "lucide-react";
import { ART_LIST } from "@/lib/art";

export function LaunchpadCta() {
  return (
    <section className="section-shell pb-24 pt-1 sm:pb-28">
      <div className="pastel-panel relative overflow-hidden rounded-[30px] border border-ink/[0.08] p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-24 size-56 rounded-full bg-white/50 blur-[70px] dark:bg-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-0 size-56 rounded-full bg-blush/35 blur-[80px] dark:bg-[#f6c7d8]/10"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="hidden -space-x-3 sm:flex">
              {ART_LIST.map((art) => (
                <span
                  key={art.src}
                  className="relative size-11 overflow-hidden rounded-full border-2 border-paper bg-cream-2 shadow-[0_8px_18px_-14px_rgba(39,33,50,0.7)] dark:border-white/15"
                >
                  <Image
                    src={art.src}
                    alt=""
                    fill
                    sizes="44px"
                    loading="lazy"
                    className="object-cover"
                  />
                </span>
              ))}
            </div>

            <div>
              <p className="eyebrow">For creators</p>
              <h2 className="mt-2 font-header text-[22px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[24px]">
                Launch your own collection on GIWA.
              </h2>
              <p className="mt-1.5 max-w-xl text-[11.5px] leading-5 text-ink-soft">
                Send us the art and the schedule. We handle the contract, the
                mint page, and the launch day.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/launchpad/request"
              className="btn-iris px-5 text-[11px]"
            >
              <Send className="size-3.5" />
              Submit a request
            </Link>
            <Link
              href="/home"
              className="inline-flex h-[52px] items-center gap-1.5 rounded-full border border-ink/10 bg-paper/60 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-iris"
            >
              Home
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
