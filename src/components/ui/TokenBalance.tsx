import { Coins } from "lucide-react";

export function TokenBalance({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <Coins className="h-5 w-5 text-cyan-300" aria-hidden />
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">
          Solde
        </p>
        <p className="font-mono text-xl font-semibold text-white">
          {value} <span className="text-sm font-normal text-cyan-100/80">jetons</span>
        </p>
      </div>
    </div>
  );
}
