"use client";

import { Countdown } from "@/components/ui/Countdown";
import { BarChart } from "@/components/ui/BarChart";
import { DemoBadge } from "@/components/ui/DemoBadge";
import {
  DISCUSSION_ROUND_1,
} from "@/lib/game/copy";
import { PHASE_LABELS } from "@/lib/game/engine";
import {
  mealStats,
  ROUND1_LABELS,
  round1Distribution,
  voteStats,
  VOTE_LABELS,
} from "@/lib/game/stats";
import type { GameState } from "@/lib/game/types";

export function ScreenView({ state, demo }: { state: GameState; demo: boolean }) {
  const dist = round1Distribution(state);
  const meals = mealStats(state);
  const votes = voteStats(state);

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Projection · {state.room.code}
          </p>
          <h1 className="text-5xl font-semibold text-white md:text-6xl">
            {PHASE_LABELS[state.room.phase]}
          </h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-5xl text-white">{state.participants.length}</p>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            participants
          </p>
        </div>
      </header>
      <DemoBadge show={demo} />

      {(state.room.phase === "round1_open" ||
        state.room.phase === "round1_paused") && (
        <Countdown
          endsAt={state.room.roundEndsAt}
          pausedMs={state.room.pausedRemainingMs}
          large
        />
      )}

      {state.room.phase === "lobby" ? (
        <p className="text-3xl text-slate-300">
          Scannez le QR code et rejoignez la salle {state.room.code}.
        </p>
      ) : null}

      {state.room.currentRound >= 1 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="mb-6 text-2xl text-white">Choix de la manche 1</h2>
          <BarChart
            items={[
              {
                label: `${ROUND1_LABELS.work} · ${dist.percents.work}%`,
                value: dist.counts.work,
                color: "#22d3ee",
              },
              {
                label: `${ROUND1_LABELS.leisure} · ${dist.percents.leisure}%`,
                value: dist.counts.leisure,
                color: "#34d399",
              },
              {
                label: `${ROUND1_LABELS.training} · ${dist.percents.training}%`,
                value: dist.counts.training,
                color: "#fb923c",
              },
            ]}
          />
          {state.room.phase === "round1_results" ? (
            <p className="mt-8 text-2xl text-cyan-100">{DISCUSSION_ROUND_1}</p>
          ) : null}
        </section>
      ) : null}

      {state.room.currentRound >= 2 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <BigStat value={meals.ate} label="Ont pu payer le repas" />
            <BigStat value={meals.starved} label="N'ont pas pu manger" />
            <BigStat value={meals.average} label="Solde moyen" />
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-slate-300">
            <p className="text-xl font-semibold text-white mb-2">Bilan de la manche 2 (Repas à 6 jetons) :</p>
            <p className="text-base text-slate-300">• <strong className="text-cyan-300">Travail :</strong> 8 − 6 = 2 jetons restants (a pu manger)</p>
            <p className="text-base text-slate-300">• <strong className="text-emerald-300">Temps libre :</strong> 5 &lt; 6 = repas impossible (5 jetons restants, n&apos;a pas pu manger)</p>
            <p className="text-base text-slate-300">• <strong className="text-orange-300">Formation :</strong> 3 + bonus 5 = 8 − 6 = 2 jetons restants (a pu manger grâce au bonus)</p>
          </div>
        </section>
      ) : null}

      {state.room.votesRevealed ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="mb-6 text-2xl text-white">Qui finance ?</h2>
          <BarChart
            items={[
              {
                label: VOTE_LABELS.taxes_all,
                value: votes.counts.taxes_all,
                color: "#22d3ee",
              },
              {
                label: VOTE_LABELS.robot_tax,
                value: votes.counts.robot_tax,
                color: "#34d399",
              },
              {
                label: VOTE_LABELS.wealth_tax,
                value: votes.counts.wealth_tax,
                color: "#fb923c",
              },
            ]}
          />
        </section>
      ) : state.room.currentRound === 3 ? (
        <p className="text-3xl text-slate-300">
          Vote en cours · {state.votes.length}/{state.participants.length} · résultats
          masqués
        </p>
      ) : null}
    </div>
  );
}

function BigStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <p className="font-mono text-6xl text-white">{value}</p>
      <p className="mt-2 text-lg text-slate-400">{label}</p>
    </div>
  );
}
