"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNow } from "@/hooks/useNow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Countdown } from "@/components/ui/Countdown";
import { BarChart } from "@/components/ui/BarChart";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { runHostAction } from "@/lib/client/game-api";
import {
  DISCUSSION_ROUND_1,
} from "@/lib/game/copy";
import { PHASE_LABELS } from "@/lib/game/engine";
import { mealStats, ROUND1_LABELS, round1Distribution, voteStats, VOTE_LABELS } from "@/lib/game/stats";
import type { GameState } from "@/lib/game/types";

export function HostPanel({
  state,
  demo,
  joinUrl,
}: {
  state: GameState;
  demo: boolean;
  joinUrl: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const now = useNow(500);
  const dist = useMemo(() => round1Distribution(state), [state]);
  const meals = useMemo(() => mealStats(state), [state]);
  const votes = useMemo(() => voteStats(state), [state]);
  const phase = state.room.phase;

  useEffect(() => {
    if (
      phase === "round1_open" &&
      state.room.roundEndsAt !== null &&
      now >= state.room.roundEndsAt
    ) {
      void runHostAction(state.room.code, "close_round_1").catch(() => undefined);
    }
  }, [phase, now, state.room.roundEndsAt, state.room.code]);

  async function act(type: Parameters<typeof runHostAction>[1]) {
    setBusy(type);
    setError(null);
    try {
      await runHostAction(state.room.code, type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
              Animateur
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Salle {state.room.code}
            </h1>
            <p className="mt-1 text-slate-400">{PHASE_LABELS[phase]}</p>
          </div>
          <DemoBadge show={demo} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Participants"
            value={String(state.participants.length)}
          />
          <StatCard label="Manche" value={String(state.room.currentRound || "—")} />
          <StatCard
            label="Votes"
            value={`${state.votes.length}/${state.participants.length}`}
          />
        </div>

        {(phase === "round1_open" || phase === "round1_paused") && (
          <Countdown
            endsAt={state.room.roundEndsAt}
            pausedMs={state.room.pausedRemainingMs}
            large
          />
        )}

        {error ? (
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {phase === "lobby" || phase === "round1_results" ? (
            <ActionButton
              disabled={Boolean(busy)}
              onClick={() => act("start_round_1")}
            >
              {phase === "lobby" ? "Démarrer la manche 1" : "Relancer la manche 1"}
            </ActionButton>
          ) : null}
          {phase === "round1_open" ? (
            <>
              <ActionButton onClick={() => act("pause")} disabled={Boolean(busy)}>
                <Pause className="h-4 w-4" /> Pause
              </ActionButton>
              <ActionButton onClick={() => act("close_round_1")} disabled={Boolean(busy)}>
                Clôturer les choix
              </ActionButton>
            </>
          ) : null}
          {phase === "round1_paused" ? (
            <ActionButton onClick={() => act("resume")} disabled={Boolean(busy)}>
              <Play className="h-4 w-4" /> Reprendre
            </ActionButton>
          ) : null}
          {phase === "round1_open" || phase === "round1_paused" || phase === "round1_results" ? (
            <ActionButton
              tone="ghost"
              onClick={() => act("reset_round_1")}
              disabled={Boolean(busy)}
            >
              Réinitialiser la manche 1
            </ActionButton>
          ) : null}
          {phase === "round1_results" ? (
            <ActionButton onClick={() => act("start_round_2")} disabled={Boolean(busy)}>
              Passer à la manche 2
            </ActionButton>
          ) : null}
          {phase === "round2_results" ? (
            <ActionButton onClick={() => act("start_round_3")} disabled={Boolean(busy)}>
              Passer à la manche 3
            </ActionButton>
          ) : null}
          {phase === "round3_open" ? (
            <>
              <ActionButton onClick={() => act("close_votes")} disabled={Boolean(busy)}>
                Clôturer le vote
              </ActionButton>
              <ActionButton onClick={() => act("reveal_votes")} disabled={Boolean(busy)}>
                Révéler les résultats
              </ActionButton>
            </>
          ) : null}
          {phase === "round3_closed" ? (
            <ActionButton onClick={() => act("reveal_votes")} disabled={Boolean(busy)}>
              Révéler les résultats
            </ActionButton>
          ) : null}
          {phase === "round3_revealed" ? (
            <ActionButton onClick={() => act("finish")} disabled={Boolean(busy)}>
              Terminer la partie
            </ActionButton>
          ) : null}
          {demo ? (
            <>
              <ActionButton tone="ghost" onClick={() => act("add_bots")} disabled={Boolean(busy)}>
                Ajouter des participants fictifs
              </ActionButton>
              {phase === "round1_open" ? (
                <ActionButton
                  tone="ghost"
                  onClick={() => act("simulate_bots")}
                  disabled={Boolean(busy)}
                >
                  Simuler les choix
                </ActionButton>
              ) : null}
              {phase === "round3_open" ? (
                <ActionButton
                  tone="ghost"
                  onClick={() => act("simulate_votes")}
                  disabled={Boolean(busy)}
                >
                  Simuler les votes
                </ActionButton>
              ) : null}
            </>
          ) : null}
          <ActionButton tone="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" /> Réinitialiser la partie
          </ActionButton>
          <a
            href={`/screen/${state.room.code}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm text-slate-200"
          >
            <Monitor className="h-4 w-4" /> Vue projection
          </a>
        </div>

        {phase === "round1_results" || phase === "round1_open" ? (
          <Card title="Répartition des choix">
            <BarChart
              items={[
                {
                  label: `${ROUND1_LABELS.work} (${dist.percents.work}%)`,
                  value: dist.counts.work,
                  color: "#22d3ee",
                },
                {
                  label: `${ROUND1_LABELS.leisure} (${dist.percents.leisure}%)`,
                  value: dist.counts.leisure,
                  color: "#34d399",
                },
                {
                  label: `${ROUND1_LABELS.training} (${dist.percents.training}%)`,
                  value: dist.counts.training,
                  color: "#fb923c",
                },
              ]}
            />
            <p className="mt-4 text-sm text-slate-400">
              Abstentions : {dist.abstained}
            </p>
            <p className="mt-3 text-sm text-cyan-200">{DISCUSSION_ROUND_1}</p>
          </Card>
        ) : null}

        {phase === "round2_results" || state.room.currentRound >= 2 ? (
          <Card title="Pouvoir d'achat">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini n={meals.ate} label="Ont pu manger" />
              <Mini n={meals.starved} label="N'ont pas pu" />
              <Mini n={meals.average} label="Solde moyen" />
            </div>
            <div className="mt-4 rounded-2xl bg-white/5 p-4 text-xs text-slate-300 space-y-1.5">
              <p>• <strong className="text-cyan-300">Travail :</strong> 8 − 6 = 2 jetons restants (a pu manger)</p>
              <p>• <strong className="text-emerald-300">Temps libre :</strong> 5 &lt; 6 = repas impossible (5 jetons restants, n&apos;a pas pu manger)</p>
              <p>• <strong className="text-orange-300">Formation :</strong> 3 + bonus 6 = 9 − 6 = 3 jetons restants (a pu manger et a gagné 3 jetons)</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Cette simulation relie revenu disponible, prix et pouvoir d&apos;achat. Elle
              n&apos;affirme pas qu&apos;une hausse des prix est nécessairement causée par un
              revenu universel.
            </p>
          </Card>
        ) : null}

        {state.room.votesRevealed ? (
          <Card title="Financement — résultats">
            <BarChart
              items={[
                {
                  label: `${VOTE_LABELS.taxes_all} (${votes.percents.taxes_all}%)`,
                  value: votes.counts.taxes_all,
                  color: "#22d3ee",
                },
                {
                  label: `${VOTE_LABELS.robot_tax} (${votes.percents.robot_tax}%)`,
                  value: votes.counts.robot_tax,
                  color: "#34d399",
                },
                {
                  label: `${VOTE_LABELS.wealth_tax} (${votes.percents.wealth_tax}%)`,
                  value: votes.counts.wealth_tax,
                  color: "#fb923c",
                },
              ]}
            />
            <p className="mt-3 text-sm text-slate-400">
              {votes.totalVotes} votes · {votes.abstained} n&apos;ont pas voté. Aucune
              réponse n&apos;est désignée comme la meilleure.
            </p>
          </Card>
        ) : null}
      </section>

      <aside className="space-y-6">
        <Card title="Rejoindre">
          <div className="flex justify-center rounded-3xl bg-white p-4">
            <QRCodeSVG value={joinUrl} size={180} />
          </div>
          <p className="mt-3 text-center font-mono text-2xl tracking-[0.3em] text-white">
            {state.room.code}
          </p>
          <p className="mt-2 break-all text-center text-xs text-slate-400">{joinUrl}</p>
        </Card>
        <Card title="Participants et soldes">
          {state.participants.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun participant pour le moment. Partagez le QR code.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-auto">
              {state.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-white">
                    {p.nickname}
                    {p.isBot ? (
                      <span className="ml-2 text-[10px] uppercase text-slate-500">
                        bot
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-sm text-cyan-200">
                    {p.currentBalance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser la partie ?"
        description="Les soldes, choix, votes et transactions seront effacés. Les participants resteront dans la salle."
        confirmLabel="Réinitialiser"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void act("reset_game");
        }}
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-sm uppercase tracking-[0.18em] text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-mono text-3xl text-white">{value}</p>
    </div>
  );
}

function Mini({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <p className="font-mono text-2xl text-white">{n}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-cyan-400 text-slate-950",
    ghost: "border border-white/10 text-slate-100",
    danger: "border border-orange-400/30 bg-orange-400/10 text-orange-100",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}
