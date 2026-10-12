import {
  MEAL_COST,
  type GameState,
  type Round1Choice,
  type VoteChoice,
} from "./types";

export const ROUND1_LABELS: Record<Round1Choice, string> = {
  work: "Travail",
  leisure: "Temps libre",
  training: "Formation",
};

export const VOTE_LABELS: Record<VoteChoice, string> = {
  taxes_all: "Impôts pour tous",
  robot_tax: "Taxe sur les robots",
  wealth_tax: "Taxe sur les grandes fortunes",
};

export function round1Distribution(state: GameState) {
  const total = state.participants.length;
  const counts: Record<Round1Choice, number> = {
    work: 0,
    leisure: 0,
    training: 0,
  };
  for (const decision of state.decisions) {
    if (decision.roundNumber === 1) counts[decision.choice] += 1;
  }
  const abstained = Math.max(0, total - Object.values(counts).reduce((a, b) => a + b, 0));
  return {
    counts,
    total,
    abstained,
    percents: {
      work: percent(counts.work, total),
      leisure: percent(counts.leisure, total),
      training: percent(counts.training, total),
    },
  };
}

export function mealStats(state: GameState) {
  const ate = state.participants.filter((p) => p.ateMeal === true).length;
  const starved = state.participants.filter((p) => p.ateMeal === false).length;
  const pending = state.participants.filter((p) => p.ateMeal === null).length;
  const average =
    state.participants.length === 0
      ? 0
      : Math.round(
          (state.participants.reduce((sum, p) => sum + p.currentBalance, 0) /
            state.participants.length) *
            10,
        ) / 10;
  const balances = state.participants.map((p) => p.currentBalance);
  const histogram: Record<number, number> = {};
  for (const balance of balances) {
    histogram[balance] = (histogram[balance] ?? 0) + 1;
  }
  return { ate, starved, pending, average, histogram, mealCost: MEAL_COST };
}

export function voteStats(state: GameState) {
  const counts: Record<VoteChoice, number> = {
    taxes_all: 0,
    robot_tax: 0,
    wealth_tax: 0,
  };
  for (const vote of state.votes) {
    counts[vote.choice] += 1;
  }
  const totalVotes = state.votes.length;
  const abstained = Math.max(0, state.participants.length - totalVotes);
  return {
    counts,
    totalVotes,
    abstained,
    percents: {
      taxes_all: percent(counts.taxes_all, totalVotes),
      robot_tax: percent(counts.robot_tax, totalVotes),
      wealth_tax: percent(counts.wealth_tax, totalVotes),
    },
  };
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part * 1000) / total) / 10;
}

export function remainingMs(roundEndsAt: number | null, now: number): number {
  if (roundEndsAt === null) return 0;
  return Math.max(0, roundEndsAt - now);
}
