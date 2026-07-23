"use client";

/**
 * Site-wide ambient backdrop for GIWA — a dark base with soft mint-teal glows.
 * Fixed behind all content so it reads as atmosphere, not noise.
 */
export function GiwaAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Deep base */}
      <div className="absolute inset-0 bg-[#07100d]" />
      {/* Mint-teal radial glows */}
      <div
        className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl opacity-[0.10]"
        style={{ background: "radial-gradient(circle, #2ee6a6 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[60vh] w-[60vh] rounded-full blur-3xl opacity-[0.08]"
        style={{ background: "radial-gradient(circle, #5eead4 0%, transparent 70%)" }}
      />
      {/* Subtle grid vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07100d]" />
    </div>
  );
}
