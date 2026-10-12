"use client";

import { useMemo, useState } from "react";
import { TokenBalance } from "@/components/ui/TokenBalance";
import { Countdown } from "@/components/ui/Countdown";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { chooseAction, voteAction } from "@/lib/client/game-api";
import {
  mealMessage,
  ROUND1_OPTIONS,
  VOTE_OPTIONS,
} from "@/lib/game/copy";
import { PHASE_LABELS } from "@/lib/game/engine";
import type { GameState, Round1Choice, VoteChoice } from "@/lib/game/types";

export function PlayerView({
  state,
  participantId,
  demo,
}: {
  state: GameState;
  participantId: string;
  demo: boolean;
}) {
  const player = state.participants.find((p) => p.id === participantId);
  const decision = state.decisions.find(
    (d) => d.participantId === participantId && d.roundNumber === 1,
  );
  const vote = state.votes.find((v) => v.participantId === participantId);
  const txs = state.transactions
    .filter((t) => t.participantId === participantId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const history = useMemo(
    () =>
      txs.map((t) => ({
        ...t,
        label:
          t.reason === "allocation_initiale"
            ? "Revenu universel initial"
            : t.reason === "travail"
              ? "Gain travail"
              : t.reason === "formation"
                ? "Coût formation"
                : t.reason === "bonus_formation"
                  ? "Bonus formation"
                  : t.reason === "repas"
                    ? "Repas"
                    : t.reason,
      })),
    [txs],
  );

  if (!player) {
    return (
      <p className="text-slate-300">
        Session introuvable. Rejoignez à nouveau la salle.
      </p>
    );
  }

  async function choose(choice: Round1Choice) {
    setPending(true);
    setError(null);
    try {
      await chooseAction(state.room.code, participantId, choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Choix refusé");
    } finally {
      setPending(false);
    }
  }

  async function voteFor(choice: VoteChoice) {
    setPending(true);
    setError(null);
    try {
      await voteAction(state.room.code, participantId, choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote refusé");
    } finally {
      setPending(false);
    }
  }

  const phase = state.room.phase;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
            {player.nickname}
          </p>
          <h1 className="text-2xl font-semibold text-white">Revenu universel</h1>
          <p className="text-sm text-slate-400">{PHASE_LABELS[phase]}</p>
        </div>
        <TokenBalance value={player.currentBalance} compact />
      </header>
      <DemoBadge show={demo} />

      {phase === "round1_open" ? (
        <Countdown endsAt={state.room.roundEndsAt} />
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {phase === "lobby" || phase === "round1_paused" ? (
        <Empty
          title="En attente de l'animateur"
          text="Tes 5 jetons sont déjà crédités. Le choix s'ouvrira dans un instant."
        />
      ) : null}

      {phase === "round1_open" && !decision ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Le revenu arrive. Choisis une seule option.
          </p>
          {ROUND1_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={pending}
              onClick={() => choose(option.id)}
              className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/10 disabled:opacity-40"
            >
              <p className="text-lg font-semibold text-white">{option.title}</p>
              <p className="text-sm text-cyan-200">{option.subtitle}</p>
              <p className="mt-2 text-sm text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      ) : null}

      {decision && (phase === "round1_open" || phase === "round1_results") ? (
        <Empty
          title="Choix enregistré"
          text={`${ROUND1_OPTIONS.find((o) => o.id === decision.choice)?.title} — ton solde est de ${player.currentBalance} jetons.`}
        />
      ) : null}

      {phase === "round2_results" ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Les prix montent</h2>
          <p className="mt-3 text-base leading-7 text-slate-200">
            {mealMessage(player.currentBalance, player.ateMeal)}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Le repas coûte 6 jetons. Un solde insuffisant empêche de payer, sans
            jamais passer sous zéro.
          </p>
        </div>
      ) : null}

      {phase === "round3_open" && !vote ? (
        <div className="space-y-3">
          <p className="text-lg font-medium text-white">
            Pour financer ce revenu universel, qui doit payer ?
          </p>
          {VOTE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={pending}
              onClick={() => voteFor(option.id)}
              className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left hover:border-emerald-300/40 disabled:opacity-40"
            >
              <p className="text-lg font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-sm text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      ) : null}

      {vote && !state.room.votesRevealed ? (
        <Empty
          title="Vote enregistré"
          text="Les résultats restent masqués tant que l'animateur ne les a pas révélés."
        />
      ) : null}

      {state.room.votesRevealed ? (
        <Empty
          title="Merci d'avoir voté"
          text="Aucune option n'est désignée comme la meilleure : le vote ouvre le débat."
        />
      ) : null}

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
          Historique
        </h2>
        <ul className="space-y-2">
          {history.map((t) => (
            <li
              key={t.id}
              className="flex justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm"
            >
              <span className="text-slate-300">{t.label}</span>
              <span
                className={`font-mono ${t.amount >= 0 ? "text-emerald-300" : "text-orange-300"}`}
              >
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
