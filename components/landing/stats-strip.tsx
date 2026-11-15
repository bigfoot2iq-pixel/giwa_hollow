const STATS = [
  { value: "2,222", label: "soft residents", note: "one-off mixes" },
  { value: "ERC-20", label: "ARIWA token", note: "on-chain" },
  { value: "100%", label: "on-chain draws", note: "verifiable" },
  { value: "0", label: "custody", note: "your wallet" },
];

export function StatsStrip() {
  return (
    <section aria-label="ARIWA at a glance" className="border-y border-ink/[0.08] bg-paper/35">
      <div className="section-shell grid grid-cols-2 gap-px overflow-hidden py-0 sm:grid-cols-4">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className={`relative py-6 sm:py-7 ${
              index % 2 === 1 ? "pl-5 sm:pl-6" : "pr-5 sm:pr-6"
            } ${index > 0 ? "sm:border-l sm:border-ink/[0.08] sm:pl-6" : ""} ${
              index === 2 || index === 3 ? "border-t border-ink/[0.08] sm:border-t-0" : ""
            }`}
          >
            <p className="font-header text-[clamp(1.7rem,3.2vw,2.5rem)] font-extrabold tracking-[-0.05em] text-ink">
              {stat.value}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-iris">
              {stat.label}
            </p>
            <p className="mt-1.5 text-[10px] text-ink-mute">{stat.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
