"use client";

import LastStandContainer from "@/components/game/LastStandContainer";

const CONTROLS = [
  { keys: ["A", "D"], title: "Move", note: "Left / right" },
  { keys: ["W", "Space"], title: "Jump", note: "Leap over enemies" },
  { keys: ["J"], title: "Attack", note: "Hold for charged" },
  { keys: ["L", "Shift"], title: "Dodge", note: "Evade attacks" },
];

export default function GamePage() {
  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="eyebrow">The arcade</p>
        <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
          Last Stand
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
          Face the horde. Survive the waves. Claim your place on the
          leaderboard.
        </p>
      </div>

      <div className="ui-container hidden rounded-[26px] p-5 md:block lg:p-6">
        <h2 className="mb-4 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">
          Game controls
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CONTROLS.map((control) => (
            <div key={control.title} className="flex items-center gap-3">
              <div className="flex gap-1">
                {control.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex min-w-8 items-center justify-center rounded-lg border border-ink/10 bg-paper px-2 py-1.5 font-mono text-[10px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink">{control.title}</p>
                <p className="text-[10px] text-ink-mute">{control.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-container rounded-[24px] p-4 md:hidden">
        <h2 className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">
          Mobile controls
        </h2>
        <p className="text-[11px] text-ink-soft">
          Touch controls appear below the game canvas.
        </p>
      </div>

      <LastStandContainer />
    </div>
  );
}
