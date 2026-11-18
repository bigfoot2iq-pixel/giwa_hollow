import Image from "next/image";
import { HOME_EYE_PIECES } from "@/lib/art";

/**
 * A compact showcase of the eye — the ARIWA collection's defining trait — so
 * visitors see at a glance how much the art varies without leaving the home
 * page. Three residents: both eyes open, left closed, right closed.
 */
export function EyeDiversity() {
  return (
    <section
      id="eyes"
      className="section-shell scroll-mt-28 pb-20 pt-2 sm:pb-28"
      aria-labelledby="eyes-title"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow">Eye diversity</p>
          <h2
            id="eyes-title"
            className="display mt-4 text-[clamp(2rem,4.4vw,3.2rem)] text-ink"
          >
            Every resident
            <span className="block text-ink-mute">looks at you differently.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[13px] leading-7 text-ink-soft">
          The eyes are ARIWA&apos;s signature. Open, winked, or half-closed — no
          two residents greet you the same way.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {HOME_EYE_PIECES.map((piece) => (
          <figure
            key={piece.id}
            className="group relative overflow-hidden rounded-[26px] border border-ink/10 bg-paper"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-cream-2">
              <Image
                src={piece.src}
                alt={piece.alt}
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 30vw, 380px"
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
              />
              <span className="absolute left-4 top-4 rounded-full border border-ink/10 bg-paper/85 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur">
                {piece.name}
              </span>
            </div>
            <figcaption className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-header text-lg font-extrabold tracking-[-0.02em] text-ink">
                  {piece.label}
                </p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
                  {piece.eyes}
                </p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
