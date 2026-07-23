"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DateTimePickerProps {
  // datetime-local string: yyyy-MM-dd'T'HH:mm (same value a native input emits).
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const FMT = "yyyy-MM-dd'T'HH:mm";
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateTimePicker({
  value,
  onChange,
  className,
  placeholder = "Select date & time",
}: DateTimePickerProps) {
  const parsed = value ? new Date(value) : null;
  const sel = parsed && !isNaN(parsed.getTime()) ? parsed : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(sel ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  const time = sel ? format(sel, "HH:mm") : "12:00";
  const today = startOfDay(new Date());

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(view), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [view]);

  function emit(day: Date, hhmm: string) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h || 0, m || 0, 0, 0);
    onChange(format(d, FMT));
  }

  function pickDay(day: Date) {
    if (isBefore(day, today)) return;
    emit(day, time);
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded border border-[#0c1512]/10 bg-dark-navy px-4 py-3 text-left transition-colors hover:border-[#0c1512]/20 focus:outline-none focus:ring-1 focus:ring-[#0c1512]"
      >
        <span className={cn("flex items-center gap-2", sel ? "text-text-primary" : "text-muted-blue")}>
          <Calendar className="h-4 w-4 text-[#0c1512]" />
          {sel ? format(sel, "PP 'at' p") : placeholder}
        </span>
        <ChevronRight
          className={cn("h-4 w-4 text-muted-blue transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-full rounded border border-[#0c1512]/10 bg-[#0c1512] p-3 shadow-2xl animate-step">
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView((v) => subMonths(v, 1))}
              className="rounded p-1 text-muted-blue transition-colors hover:bg-[#0c1512]/5 hover:text-text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-text-primary">{format(view, "MMMM yyyy")}</span>
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v, 1))}
              className="rounded p-1 text-muted-blue transition-colors hover:bg-[#0c1512]/5 hover:text-text-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] font-bold uppercase text-muted-blue/60">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const disabled = isBefore(day, today);
              const isSel = sel && isSameDay(day, sel);
              const isToday = isSameDay(day, new Date());
              const outside = !isSameMonth(day, view);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded text-xs transition-colors",
                    isSel
                      ? "bg-[#0c1512] font-bold text-[#2ee6a6]"
                      : disabled
                        ? "cursor-not-allowed text-muted-blue/25"
                        : "text-text-primary hover:bg-[#0c1512]/10",
                    !isSel && outside && !disabled && "text-muted-blue/50",
                    !isSel && !disabled && isToday && "ring-1 ring-inset ring-[#0c1512]/40"
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time + confirm */}
          <div className="mt-3 flex items-center gap-2 border-t border-[#0c1512]/10 pt-3">
            <Clock className="h-4 w-4 shrink-0 text-[#0c1512]" />
            <input
              type="time"
              value={time}
              onChange={(e) => emit(sel ?? new Date(), e.target.value)}
              className="flex-1 rounded border border-[#0c1512]/10 bg-dark-navy px-3 py-2 text-sm text-text-primary [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#0c1512]"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-[#0c1512] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-text-primary transition-all hover:brightness-125"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
