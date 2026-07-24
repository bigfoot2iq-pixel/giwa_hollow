"use client";

/**
 * Site-wide ambient backdrop for GIWA — a light base with soft blue glows.
 * Fixed behind all content so it reads as atmosphere, not noise.
 */
export function GiwaAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Deep base */}
      <div className="absolute inset-0 bg-[#f4f5f7]" />
      {/* Mint-teal radial glows */}
      <div
        className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl opacity-[0.10]"
        style={{ background: "radial-gradient(circle, #0062df 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[60vh] w-[60vh] rounded-full blur-3xl opacity-[0.08]"
        style={{ background: "radial-gradient(circle, #1375ec 0%, transparent 70%)" }}
      />
      {/* Subtle grid vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f4f5f7]" />
    </div>
  );
}
