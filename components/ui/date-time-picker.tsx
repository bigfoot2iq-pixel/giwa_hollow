"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// Approx panel height, used before the panel has mounted/measured.
const EST_PANEL_H = 360;

export function DateTimePicker({
  value,
  onChange,
  className,
  placeholder = "Select date & time",
}: DateTimePickerProps) {
  const parsed = value ? new Date(value) : null;
  const sel = parsed && !isNaN(parsed.getTime()) ? parsed : null;

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<Date>(sel ?? new Date());
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const time = sel ? format(sel, "HH:mm") : "12:00";
  const today = startOfDay(new Date());

  // Portals need the DOM — only render them after mount.
  useEffect(() => setMounted(true), []);

  // Position the (portaled, fixed) panel relative to the trigger. The panel is
  // rendered at document.body so it escapes any ancestor `overflow-hidden` /
  // scroll container / stacking context — those were clipping it before.
  function updatePosition() {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const gap = 8;
    const panelH = panelRef.current?.offsetHeight ?? EST_PANEL_H;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    // Prefer opening downward; flip up only when below is too tight and above roomier.
    let top =
      spaceBelow >= panelH + gap || spaceBelow >= spaceAbove
        ? r.bottom + gap
        : r.top - panelH - gap;
    // Keep it fully on-screen.
    top = Math.max(gap, Math.min(top, window.innerHeight - panelH - gap));
    setCoords({ top, left: r.left, width: r.width });
  }

  // Recompute on open, and while open on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // A second pass once the panel has real measured height.
    const raf = requestAnimationFrame(updatePosition);
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  // Close on outside click / Escape. Trigger and panel live in different DOM
  // subtrees now (panel is portaled), so check both.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
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

  const panel = (
    <div
      ref={panelRef}
      style={coords ? { top: coords.top, left: coords.left, width: coords.width } : { visibility: "hidden" }}
      className="fixed z-[100] rounded border border-[#edeef1] bg-[#ffffff] p-3 shadow-2xl animate-step"
    >
      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView((v) => subMonths(v, 1))}
          className="rounded p-1 text-muted-blue transition-colors hover:bg-[#f4f5f7] hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-text-primary">{format(view, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setView((v) => addMonths(v, 1))}
          className="rounded p-1 text-muted-blue transition-colors hover:bg-[#f4f5f7] hover:text-text-primary"
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
                  ? "bg-[#0062df] font-bold text-[#ffffff]"
                  : disabled
                    ? "cursor-not-allowed text-muted-blue/25"
                    : "text-text-primary hover:bg-[#f4f5f7]",
                !isSel && outside && !disabled && "text-muted-blue/50",
                !isSel && !disabled && isToday && "ring-1 ring-inset ring-[#0062df]/40"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time + confirm */}
      <div className="mt-3 flex items-center gap-2 border-t border-[#edeef1] pt-3">
        <Clock className="h-4 w-4 shrink-0 text-[#0062df]" />
        <input
          type="time"
          value={time}
          onChange={(e) => emit(sel ?? new Date(), e.target.value)}
          className="flex-1 rounded border border-[#edeef1] bg-dark-navy px-3 py-2 text-sm text-text-primary [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-[#0062df]"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded bg-[#0062df] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#ffffff] transition-all hover:brightness-125"
        >
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded border border-[#edeef1] bg-dark-navy px-4 py-3 text-left transition-colors hover:border-[#d6d8db] focus:outline-none focus:ring-1 focus:ring-[#0062df]"
      >
        <span className={cn("flex items-center gap-2", sel ? "text-text-primary" : "text-muted-blue")}>
          <Calendar className="h-4 w-4 text-[#0062df]" />
          {sel ? format(sel, "PP 'at' p") : placeholder}
        </span>
        <ChevronRight
          className={cn("h-4 w-4 text-muted-blue transition-transform", open && "rotate-90")}
        />
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
