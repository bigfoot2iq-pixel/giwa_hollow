import { Clock } from "lucide-react";
import { useCountdown } from "@/lib/hooks/useCountdown";

interface CountdownTimerProps {
  endDate: string | Date;
  className?: string;
}

export function CountdownTimer({ endDate, className = "" }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(endDate);
  const showDays = Number(days) > 0;

  if (isExpired) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Clock className="size-3 text-ink-mute" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
          Ended
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Clock className="size-3 animate-pulse text-iris" />
      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold tabular-nums text-ink">
        {showDays && (
          <>
            <span>{days}d</span>
            <span className="text-ink-faint">:</span>
          </>
        )}
        <span>{hours}h</span>
        <span className="text-ink-faint">:</span>
        <span>{minutes}m</span>
        <span className="text-ink-faint">:</span>
        <span>{seconds}s</span>
      </div>
    </div>
  );
}
