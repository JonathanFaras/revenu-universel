import {
  INITIAL_BALANCE,
  MEAL_COST,
  ROUND_1_DURATION_MS,
  TRAINING_BONUS,
  TRAINING_COST,
  WORK_GAIN,
  type Decision,
  type EngineResult,
  type GameState,
  type Participant,
  type Phase,
  type Round1Choice,
  type RoundNumber,
  type Transaction,
  type Vote,
  type VoteChoice,
  GameError,
} from "./types";
import { createId, createRoomCode, hashHostTokenSync } from "./ids";

function fail(state: GameState, error: GameError): EngineResult {
  return { ok: false, error, state };
}

function ok(state: GameState): EngineResult {
  return { ok: true, state };
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}

function cloneState(state: GameState): GameState {
  return {
    room: { ...state.room },
    participants: state.participants.map((p) => ({ ...p })),
    decisions: state.decisions.map((d) => ({ ...d })),
    transactions: state.transactions.map((t) => ({ ...t })),
    votes: state.votes.map((v) => ({ ...v })),
  };
}

function getParticipant(
  state: GameState,
  participantId: string,
): Participant | undefined {
  return state.participants.find((p) => p.id === participantId);
}

export function requireHost(state: GameState, hostToken: string): boolean {
  return state.room.hostTokenHash === hashHostTokenSync(hostToken);
}

function withExpiry(state: GameState, now: number): GameState {
  if (
    state.room.phase === "round1_open" &&
    state.room.roundEndsAt !== null &&
    now >= state.room.roundEndsAt
  ) {
    const next = cloneState(state);
    next.room.phase = "round1_results";
    next.room.roundEndsAt = next.room.roundEndsAt;
    return next;
  }
  return state;
}

function appendTransaction(
  state: GameState,
  input: {
    participantId: string;
    amount: number;
    reason: string;
    roundNumber: RoundNumber;
    idempotencyKey: string;
    now: number;
  },
): EngineResult {
  assertInteger(input.amount, "amount");
  if (state.transactions.some((t) => t.idempotencyKey === input.idempotencyKey)) {
    return fail(
      state,
      new GameError("DUPLICATE_TRANSACTION", "Transaction déjà enregistrée."),
    );
  }
  const participant = getParticipant(state, input.participantId);
  if (!participant) {
    return fail(
      state,
      new GameError("PARTICIPANT_NOT_FOUND", "Participant introuvable."),
    );
  }
  const nextBalance = participant.currentBalance + input.amount;
  assertInteger(nextBalance, "balance");
  if (nextBalance < 0) {
    return fail(
      state,
      new GameError("NEGATIVE_BALANCE", "Le solde ne peut pas être négatif."),
    );
  }
  const tx: Transaction = {
    id: createId(),
    roomId: state.room.id,
    participantId: input.participantId,
    roundNumber: input.roundNumber,
    amount: input.amount,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.now,
  };
  const next = cloneState(state);
  const target = next.participants.find((p) => p.id === input.participantId);
  if (!target) {
    return fail(
      state,
      new GameError("PARTICIPANT_NOT_FOUND", "Participant introuvable."),
    );
  }
  target.currentBalance = nextBalance;
  next.transactions.push(tx);
  return ok(next);
}

function creditInitial(
  state: GameState,
  participantId: string,
  now: number,
): EngineResult {
  return appendTransaction(state, {
    participantId,
    amount: INITIAL_BALANCE,
    reason: "allocation_initiale",
    roundNumber: 0,
    idempotencyKey: `init:${participantId}:${state.room.resetGeneration}`,
    now,
  });
}

export function createRoom(now: number, hostToken: string): GameState {
  return {
    room: {
      id: createId(),
      code: createRoomCode(),
      status: "lobby",
      currentRound: 0,
      phase: "lobby",
      roundStartedAt: null,
      roundEndsAt: null,
      pausedRemainingMs: null,
      votesRevealed: false,
      hostTokenHash: hashHostTokenSync(hostToken),
      resetGeneration: 0,
      createdAt: now,
    },
    participants: [],
    decisions: [],
    transactions: [],
    votes: [],
  };
}

export function joinRoom(
  state: GameState,
  input: { nickname: string; now: number; isBot?: boolean; participantId?: string },
): EngineResult {
  const nickname = input.nickname.trim();
  if (nickname.length < 2 || nickname.length > 20) {
    return fail(
      state,
      new GameError("NICKNAME_INVALID", "Le pseudo doit contenir entre 2 et 20 caractères."),
    );
  }
  const current = withExpiry(state, input.now);
  const joinable =
    current.room.phase === "lobby" ||
    current.room.phase === "round1_open" ||
    current.room.phase === "round1_paused";
  if (!joinable) {
    return fail(
      current,
      new GameError("JOIN_CLOSED", "Les inscriptions sont closes."),
    );
  }
  const taken = current.participants.some(
    (p) => p.nickname.toLowerCase() === nickname.toLowerCase(),
  );
  if (taken) {
    return fail(current, new GameError("NICKNAME_TAKEN", "Ce pseudo est déjà pris."));
  }
  const participant: Participant = {
    id: input.participantId ?? createId(),
    roomId: current.room.id,
    nickname,
    initialBalance: INITIAL_BALANCE,
    currentBalance: 0,
    ateMeal: null,
    isBot: Boolean(input.isBot),
    connectedAt: input.now,
    createdAt: input.now,
  };
  const withPlayer: GameState = {
    ...current,
    participants: [...current.participants, participant],
  };
  return creditInitial(withPlayer, participant.id, input.now);
}

export function startRound1(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (state.room.phase !== "lobby" && state.room.phase !== "round1_results") {
    return fail(
      state,
      new GameError("INVALID_PHASE", "La manche 1 ne peut pas démarrer maintenant."),
    );
  }
  if (state.room.phase === "round1_results") {
    const reset = resetRound1Internal(state, now);
    if (!reset.ok) return reset;
    state = reset.state;
  }
  const next = cloneState(state);
  next.room.status = "in_progress";
  next.room.currentRound = 1;
  next.room.phase = "round1_open";
  next.room.roundStartedAt = now;
  next.room.roundEndsAt = now + ROUND_1_DURATION_MS;
  next.room.pausedRemainingMs = null;
  return ok(next);
}

export function pauseRound1(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const current = withExpiry(state, now);
  if (current.room.phase !== "round1_open" || current.room.roundEndsAt === null) {
    return fail(
      current,
      new GameError("INVALID_PHASE", "Aucune manche à mettre en pause."),
    );
  }
  const next = cloneState(current);
  next.room.phase = "round1_paused";
  next.room.pausedRemainingMs = Math.max(0, current.room.roundEndsAt - now);
  next.room.roundEndsAt = null;
  return ok(next);
}

export function resumeRound1(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (state.room.phase !== "round1_paused" || state.room.pausedRemainingMs === null) {
    return fail(state, new GameError("INVALID_PHASE", "La manche n'est pas en pause."));
  }
  const next = cloneState(state);
  next.room.phase = "round1_open";
  next.room.roundEndsAt = now + state.room.pausedRemainingMs;
  next.room.pausedRemainingMs = null;
  return ok(next);
}

export function closeRound1(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const current = withExpiry(state, now);
  if (
    current.room.phase !== "round1_open" &&
    current.room.phase !== "round1_paused" &&
    current.room.phase !== "round1_results"
  ) {
    return fail(
      current,
      new GameError("INVALID_PHASE", "La manche 1 n'est pas ouverte."),
    );
  }
  const next = cloneState(current);
  next.room.phase = "round1_results";
  next.room.roundEndsAt = now;
  next.room.pausedRemainingMs = null;
  return ok(next);
}

export function chooseRound1(
  state: GameState,
  input: { participantId: string; choice: Round1Choice; now: number },
): EngineResult {
  const current = withExpiry(state, input.now);
  if (current.room.phase !== "round1_open") {
    return fail(
      current,
      new GameError("ROUND_NOT_OPEN", "Les choix de la manche 1 sont fermés."),
    );
  }
  if (current.room.roundEndsAt !== null && input.now >= current.room.roundEndsAt) {
    return fail(
      current,
      new GameError("DEADLINE_PASSED", "Le temps est écoulé."),
    );
  }
  const participant = getParticipant(current, input.participantId);
  if (!participant) {
    return fail(
      current,
      new GameError("PARTICIPANT_NOT_FOUND", "Participant introuvable."),
    );
  }
  const already = current.decisions.some(
    (d) => d.participantId === input.participantId && d.roundNumber === 1,
  );
  if (already) {
    return fail(current, new GameError("ALREADY_CHOSEN", "Choix déjà enregistré."));
  }

  const decision: Decision = {
    id: createId(),
    roomId: current.room.id,
    participantId: input.participantId,
    roundNumber: 1,
    choice: input.choice,
    createdAt: input.now,
  };
  let next: GameState = {
    ...current,
    decisions: [...current.decisions, decision],
  };

  if (input.choice === "work") {
    const credited = appendTransaction(next, {
      participantId: input.participantId,
      amount: WORK_GAIN,
      reason: "travail",
      roundNumber: 1,
      idempotencyKey: `work:${input.participantId}:${current.room.resetGeneration}`,
      now: input.now,
    });
    if (!credited.ok) return credited;
    next = credited.state;
  }

  if (input.choice === "training") {
    const debited = appendTransaction(next, {
      participantId: input.participantId,
      amount: -TRAINING_COST,
      reason: "formation",
      roundNumber: 1,
      idempotencyKey: `training:${input.participantId}:${current.room.resetGeneration}`,
      now: input.now,
    });
    if (!debited.ok) return debited;
    next = debited.state;
  }

  return ok(next);
}

function resetRound1Internal(state: GameState, now: number): EngineResult {
  const next = cloneState(state);
  const round1Ids = new Set(
    next.decisions.filter((d) => d.roundNumber === 1).map((d) => d.participantId),
  );
  next.decisions = next.decisions.filter((d) => d.roundNumber !== 1);
  next.transactions = next.transactions.filter((t) => t.roundNumber !== 1);
  next.participants = next.participants.map((p) => {
    if (!round1Ids.has(p.id) && p.currentBalance === p.initialBalance) {
      return { ...p, ateMeal: null };
    }
    const kept = next.transactions
      .filter((t) => t.participantId === p.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...p, currentBalance: kept, ateMeal: null };
  });
  next.room.phase = "lobby";
  next.room.currentRound = 0;
  next.room.roundStartedAt = now;
  next.room.roundEndsAt = null;
  next.room.pausedRemainingMs = null;
  return ok(next);
}

export function resetRound1(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (
    state.room.phase !== "round1_open" &&
    state.room.phase !== "round1_paused" &&
    state.room.phase !== "round1_results"
  ) {
    return fail(
      state,
      new GameError("INVALID_PHASE", "La manche 1 ne peut pas être réinitialisée."),
    );
  }
  return resetRound1Internal(state, now);
}

function applyTrainingBonuses(state: GameState, now: number): EngineResult {
  let next = state;
  const trained = next.decisions.filter((d) => d.choice === "training");
  for (const decision of trained) {
    const key = `training-bonus:${decision.participantId}:${next.room.resetGeneration}`;
    if (next.transactions.some((t) => t.idempotencyKey === key)) {
      continue;
    }
    const credited = appendTransaction(next, {
      participantId: decision.participantId,
      amount: TRAINING_BONUS,
      reason: "bonus_formation",
      roundNumber: 2,
      idempotencyKey: key,
      now,
    });
    if (!credited.ok) return credited;
    next = credited.state;
  }
  return ok(next);
}

function applyMeals(state: GameState, now: number): EngineResult {
  let next = cloneState(state);
  for (const participant of next.participants) {
    const key = `meal:${participant.id}:${next.room.resetGeneration}`;
    if (next.transactions.some((t) => t.idempotencyKey === key)) {
      continue;
    }
    if (participant.currentBalance >= MEAL_COST) {
      const paid = appendTransaction(next, {
        participantId: participant.id,
        amount: -MEAL_COST,
        reason: "repas",
        roundNumber: 2,
        idempotencyKey: key,
        now,
      });
      if (!paid.ok) return paid;
      next = paid.state;
      const updated = next.participants.find((p) => p.id === participant.id);
      if (updated) updated.ateMeal = true;
    } else {
      const updated = next.participants.find((p) => p.id === participant.id);
      if (updated) updated.ateMeal = false;
    }
  }
  return ok(next);
}

export function startRound2(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const current = withExpiry(state, now);
  if (current.room.phase !== "round1_results") {
    return fail(
      current,
      new GameError(
        "CANNOT_SKIP_ROUND",
        "La manche 2 ne peut commencer qu'après la clôture de la manche 1.",
      ),
    );
  }
  const bonuses = applyTrainingBonuses(current, now);
  if (!bonuses.ok) return bonuses;
  const meals = applyMeals(bonuses.state, now);
  if (!meals.ok) return meals;
  const next = cloneState(meals.state);
  next.room.currentRound = 2;
  next.room.phase = "round2_results";
  next.room.roundStartedAt = now;
  next.room.roundEndsAt = null;
  next.room.pausedRemainingMs = null;
  return ok(next);
}

export function startRound3(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (state.room.phase !== "round2_results") {
    return fail(
      state,
      new GameError(
        "CANNOT_SKIP_ROUND",
        "La manche 3 ne peut commencer qu'après la manche 2.",
      ),
    );
  }
  const next = cloneState(state);
  next.room.currentRound = 3;
  next.room.phase = "round3_open";
  next.room.votesRevealed = false;
  next.room.roundStartedAt = now;
  next.room.roundEndsAt = null;
  return ok(next);
}

export function castVote(
  state: GameState,
  input: { participantId: string; choice: VoteChoice; now: number },
): EngineResult {
  if (state.room.phase !== "round3_open") {
    return fail(
      state,
      new GameError("ROUND_NOT_OPEN", "Le vote n'est pas ouvert."),
    );
  }
  if (!getParticipant(state, input.participantId)) {
    return fail(
      state,
      new GameError("PARTICIPANT_NOT_FOUND", "Participant introuvable."),
    );
  }
  if (state.votes.some((v) => v.participantId === input.participantId)) {
    return fail(state, new GameError("ALREADY_VOTED", "Vous avez déjà voté."));
  }
  const vote: Vote = {
    id: createId(),
    roomId: state.room.id,
    participantId: input.participantId,
    choice: input.choice,
    createdAt: input.now,
  };
  return ok({
    ...state,
    votes: [...state.votes, vote],
  });
}

export function closeVotes(
  state: GameState,
  hostToken: string,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (state.room.phase !== "round3_open") {
    return fail(state, new GameError("INVALID_PHASE", "Le vote n'est pas ouvert."));
  }
  const next = cloneState(state);
  next.room.phase = "round3_closed";
  return ok(next);
}

export function revealVotes(
  state: GameState,
  hostToken: string,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  if (
    state.room.phase !== "round3_open" &&
    state.room.phase !== "round3_closed"
  ) {
    return fail(
      state,
      new GameError("INVALID_PHASE", "Les votes ne peuvent pas être révélés maintenant."),
    );
  }
  const next = cloneState(state);
  next.room.phase = "round3_revealed";
  next.room.votesRevealed = true;
  return ok(next);
}

export function finishGame(
  state: GameState,
  hostToken: string,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const next = cloneState(state);
  next.room.phase = "finished";
  next.room.status = "finished";
  return ok(next);
}

export function resetGame(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const next = cloneState(state);
  next.room.resetGeneration += 1;
  next.room.status = "lobby";
  next.room.currentRound = 0;
  next.room.phase = "lobby";
  next.room.roundStartedAt = null;
  next.room.roundEndsAt = null;
  next.room.pausedRemainingMs = null;
  next.room.votesRevealed = false;
  next.decisions = [];
  next.votes = [];
  next.transactions = [];
  next.participants = next.participants.map((p) => ({
    ...p,
    currentBalance: 0,
    ateMeal: null,
  }));
  let credited: EngineResult = ok(next);
  for (const participant of next.participants) {
    if (!credited.ok) return credited;
    credited = creditInitial(credited.state, participant.id, now);
  }
  return credited;
}

export function addDemoBots(
  state: GameState,
  hostToken: string,
  now: number,
  count = 8,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const names = [
    "Léa",
    "Noah",
    "Inès",
    "Adam",
    "Chloé",
    "Yanis",
    "Sarah",
    "Liam",
    "Maya",
    "Hugo",
    "Nina",
    "Louis",
  ];
  let next: EngineResult = ok(state);
  for (let i = 0; i < count; i += 1) {
    if (!next.ok) return next;
    const nickname = `${names[i % names.length]}${i + 1}`;
    next = joinRoom(next.state, { nickname, now, isBot: true });
  }
  return next;
}

export function simulateBotChoices(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const current = withExpiry(state, now);
  const choices: Round1Choice[] = ["work", "leisure", "training"];
  let next: EngineResult = ok(current);
  const bots = current.participants.filter((p) => p.isBot);
  bots.forEach((bot, index) => {
    if (!next.ok) return;
    if (
      next.state.decisions.some(
        (d) => d.participantId === bot.id && d.roundNumber === 1,
      )
    ) {
      return;
    }
    next = chooseRound1(next.state, {
      participantId: bot.id,
      choice: choices[index % choices.length],
      now,
    });
  });
  return next;
}

export function simulateBotVotes(
  state: GameState,
  hostToken: string,
  now: number,
): EngineResult {
  if (!requireHost(state, hostToken)) {
    return fail(state, new GameError("INVALID_HOST", "Jeton animateur invalide."));
  }
  const choices: VoteChoice[] = ["taxes_all", "robot_tax", "wealth_tax"];
  let next: EngineResult = ok(state);
  state.participants
    .filter((p) => p.isBot)
    .forEach((bot, index) => {
      if (!next.ok) return;
      if (next.state.votes.some((v) => v.participantId === bot.id)) return;
      next = castVote(next.state, {
        participantId: bot.id,
        choice: choices[index % choices.length],
        now,
      });
    });
  return next;
}

export function getRound1Share(state: GameState, participantId: string) {
  return state.decisions.find(
    (d) => d.participantId === participantId && d.roundNumber === 1,
  );
}

export function expectedRound1Balance(choice: Round1Choice): number {
  if (choice === "work") return INITIAL_BALANCE + WORK_GAIN;
  if (choice === "training") return INITIAL_BALANCE - TRAINING_COST;
  return INITIAL_BALANCE;
}

export function mealOutcome(balanceBeforeMeal: number): {
  canEat: boolean;
  balanceAfter: number;
} {
  if (balanceBeforeMeal >= MEAL_COST) {
    return { canEat: true, balanceAfter: balanceBeforeMeal - MEAL_COST };
  }
  return { canEat: false, balanceAfter: balanceBeforeMeal };
}

export const PHASE_LABELS: Record<Phase, string> = {
  lobby: "Salle d'attente",
  round1_open: "Manche 1 — choix ouverts",
  round1_paused: "Manche 1 — en pause",
  round1_results: "Manche 1 — résultats",
  round2_results: "Manche 2 — les prix montent",
  round3_open: "Manche 3 — vote ouvert",
  round3_closed: "Manche 3 — vote clos",
  round3_revealed: "Manche 3 — résultats",
  finished: "Partie terminée",
};
