"use client";

import { remainingMs } from "@/lib/game/stats";
import { useNow } from "@/hooks/useNow";

export function Countdown({
  endsAt,
  pausedMs,
  large = false,
}: {
  endsAt: number | null;
  pausedMs?: number | null;
  large?: boolean;
}) {
  const now = useNow();
  const ms = pausedMs != null ? pausedMs : remainingMs(endsAt, now);
  const total = Math.ceil(ms / 1000);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-black/30 text-center font-mono tabular-nums ${
        large ? "px-10 py-8 text-7xl md:text-8xl" : "px-5 py-4 text-4xl"
      }`}
      aria-live="polite"
    >
      {mm}:{ss}
    </div>
  );
}
