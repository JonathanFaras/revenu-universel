import { describe, expect, it } from "vitest";
import {
  addDemoBots,
  castVote,
  chooseRound1,
  closeRound1,
  createRoom,
  joinRoom,
  resetGame,
  startRound1,
  startRound2,
  startRound3,
} from "./engine";
import {
  INITIAL_BALANCE,
  MEAL_COST,
  TRAINING_BONUS,
  TRAINING_COST,
  WORK_GAIN,
} from "./types";

const HOST = "host-token-test-secret";
const NOW = 1_700_000_000_000;

function setupPlayer(choice?: "work" | "leisure" | "training") {
  const created = createRoom(NOW, HOST);
  const joined = joinRoom(created, {
    nickname: "Alex",
    now: NOW,
    participantId: "11111111-1111-4111-8111-111111111111",
  });
  if (!joined.ok) throw joined.error;
  const started = startRound1(joined.state, HOST, NOW);
  if (!started.ok) throw started.error;
  if (!choice) return { state: started.state, id: joined.state.participants[0].id };
  const chosen = chooseRound1(started.state, {
    participantId: joined.state.participants[0].id,
    choice,
    now: NOW + 1_000,
  });
  if (!chosen.ok) throw chosen.error;
  return { state: chosen.state, id: chosen.state.participants[0].id };
}

describe("soldes et manches", () => {
  it("crédite exactement 5 jetons à l'arrivée", () => {
    const room = createRoom(NOW, HOST);
    const joined = joinRoom(room, { nickname: "Alex", now: NOW });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const player = joined.state.participants[0];
    expect(player.initialBalance).toBe(INITIAL_BALANCE);
    expect(player.currentBalance).toBe(5);
    expect(joined.state.transactions[0]?.amount).toBe(5);
  });

  it("calcule Travail : 8 puis 2", () => {
    const { state, id } = setupPlayer("work");
    const player = state.participants.find((p) => p.id === id)!;
    expect(player.currentBalance).toBe(INITIAL_BALANCE + WORK_GAIN);
    expect(player.currentBalance).toBe(8);

    const closed = closeRound1(state, HOST, NOW + 40_000);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    const round2 = startRound2(closed.state, HOST, NOW + 41_000);
    expect(round2.ok).toBe(true);
    if (!round2.ok) return;
    const after = round2.state.participants[0];
    expect(after.currentBalance).toBe(2);
    expect(after.ateMeal).toBe(true);
  });

  it("calcule Temps libre : 5 puis impossibilité de payer", () => {
    const { state } = setupPlayer("leisure");
    expect(state.participants[0].currentBalance).toBe(5);
    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const round2 = startRound2(closed.state, HOST, NOW + 41_000);
    if (!round2.ok) throw round2.error;
    const after = round2.state.participants[0];
    expect(after.currentBalance).toBe(5);
    expect(after.ateMeal).toBe(false);
    expect(after.currentBalance).toBeGreaterThanOrEqual(0);
    expect(
      round2.state.transactions.some((t) => t.reason === "repas"),
    ).toBe(false);
  });

  it("calcule Formation : 3 puis 9 puis 3", () => {
    const { state } = setupPlayer("training");
    expect(state.participants[0].currentBalance).toBe(
      INITIAL_BALANCE - TRAINING_COST,
    );
    expect(state.participants[0].currentBalance).toBe(3);

    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const afterBonusOnly = closed.state;
    expect(afterBonusOnly.participants[0].currentBalance).toBe(3);

    const round2 = startRound2(closed.state, HOST, NOW + 41_000);
    if (!round2.ok) throw round2.error;
    const bonus = round2.state.transactions.find(
      (t) => t.reason === "bonus_formation",
    );
    const meal = round2.state.transactions.find((t) => t.reason === "repas");
    expect(bonus?.amount).toBe(TRAINING_BONUS);
    expect(meal?.amount).toBe(-MEAL_COST);
    expect(round2.state.participants[0].currentBalance).toBe(3);
    expect(round2.state.participants[0].ateMeal).toBe(true);
  });

  it("n'attribue le bonus de formation qu'une seule fois", () => {
    const { state } = setupPlayer("training");
    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const first = startRound2(closed.state, HOST, NOW + 41_000);
    if (!first.ok) throw first.error;
    const bonuses = first.state.transactions.filter(
      (t) => t.reason === "bonus_formation",
    );
    expect(bonuses).toHaveLength(1);

    const second = startRound2(first.state, HOST, NOW + 42_000);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("CANNOT_SKIP_ROUND");
    const still = first.state.transactions.filter(
      (t) => t.reason === "bonus_formation",
    );
    expect(still).toHaveLength(1);
  });

  it("refuse un paiement si le solde est insuffisant", () => {
    const { state } = setupPlayer("leisure");
    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const round2 = startRound2(closed.state, HOST, NOW + 41_000);
    if (!round2.ok) throw round2.error;
    expect(round2.state.participants[0].ateMeal).toBe(false);
    expect(round2.state.participants[0].currentBalance).toBe(5);
  });

  it("empêche de choisir après la clôture", () => {
    const { state, id } = setupPlayer();
    const closed = closeRound1(state, HOST, NOW + 5_000);
    if (!closed.ok) throw closed.error;
    const late = chooseRound1(closed.state, {
      participantId: id,
      choice: "work",
      now: NOW + 6_000,
    });
    expect(late.ok).toBe(false);
    if (late.ok) return;
    expect(late.error.code).toBe("ROUND_NOT_OPEN");
  });

  it("empêche de voter plusieurs fois", () => {
    const { state, id } = setupPlayer("work");
    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const round2 = startRound2(closed.state, HOST, NOW + 41_000);
    if (!round2.ok) throw round2.error;
    const round3 = startRound3(round2.state, HOST, NOW + 42_000);
    if (!round3.ok) throw round3.error;
    const first = castVote(round3.state, {
      participantId: id,
      choice: "robot_tax",
      now: NOW + 43_000,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = castVote(first.state, {
      participantId: id,
      choice: "wealth_tax",
      now: NOW + 44_000,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("ALREADY_VOTED");
    expect(first.state.votes).toHaveLength(1);
  });

  it("empêche de passer à la manche 3 avant la manche 2", () => {
    const { state } = setupPlayer("work");
    const skipped = startRound3(state, HOST, NOW + 2_000);
    expect(skipped.ok).toBe(false);
    if (skipped.ok) return;
    expect(skipped.error.code).toBe("CANNOT_SKIP_ROUND");

    const closed = closeRound1(state, HOST, NOW + 40_000);
    if (!closed.ok) throw closed.error;
    const still = startRound3(closed.state, HOST, NOW + 41_000);
    expect(still.ok).toBe(false);
    if (still.ok) return;
    expect(still.error.code).toBe("CANNOT_SKIP_ROUND");
  });

  it("résiste aux doubles soumissions et aux reconnexions", () => {
    const { state, id } = setupPlayer("work");
    const replay = chooseRound1(state, {
      participantId: id,
      choice: "leisure",
      now: NOW + 2_000,
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe("ALREADY_CHOSEN");
    expect(state.participants[0].currentBalance).toBe(8);
    expect(state.decisions).toHaveLength(1);

    const reconnect = joinRoom(state, {
      nickname: "Alex",
      now: NOW + 3_000,
    });
    expect(reconnect.ok).toBe(false);
    if (reconnect.ok) return;
    expect(reconnect.error.code).toBe("NICKNAME_TAKEN");
    expect(state.participants).toHaveLength(1);
  });

  it("n'autorise jamais un solde négatif", () => {
    const room = createRoom(NOW, HOST);
    const bots = addDemoBots(room, HOST, NOW, 1);
    if (!bots.ok) throw bots.error;
    expect(
      bots.state.participants.every((p) => p.currentBalance >= 0),
    ).toBe(true);
  });
});

describe("réinitialisation", () => {
  it("remet les soldes à 5 après reset complet", () => {
    const { state } = setupPlayer("work");
    const reset = resetGame(state, HOST, NOW + 80_000);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.state.room.phase).toBe("lobby");
    expect(reset.state.participants[0].currentBalance).toBe(5);
    expect(reset.state.decisions).toHaveLength(0);
    expect(reset.state.votes).toHaveLength(0);
  });
});
