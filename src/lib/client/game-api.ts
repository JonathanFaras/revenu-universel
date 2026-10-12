import {
  addDemoBots,
  castVote,
  chooseRound1,
  closeRound1,
  closeVotes,
  createRoom,
  finishGame,
  joinRoom,
  pauseRound1,
  resetGame,
  resetRound1,
  revealVotes,
  resumeRound1,
  simulateBotChoices,
  simulateBotVotes,
  startRound1,
  startRound2,
  startRound3,
} from "@/lib/game/engine";
import { createHostToken } from "@/lib/game/ids";
import type { Round1Choice, VoteChoice } from "@/lib/game/types";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getRoom,
  loadHostToken,
  saveHostToken,
  saveParticipantSession,
  saveRoom,
} from "@/lib/demo/repository";

export type HostAction =
  | "start_round_1"
  | "pause"
  | "resume"
  | "close_round_1"
  | "reset_round_1"
  | "start_round_2"
  | "start_round_3"
  | "close_votes"
  | "reveal_votes"
  | "finish"
  | "reset_game"
  | "add_bots"
  | "simulate_bots"
  | "simulate_votes";

async function postAction(code: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/rooms/${code}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as {
    error?: string;
    code?: string;
    demo?: boolean;
    participant?: { id: string; nickname: string };
  };
  if (response.status === 503 || json.demo) {
    return { fallback: true as const };
  }
  if (!response.ok) {
    throw new Error(json.error ?? "Action refusée");
  }
  return { fallback: false as const, participant: json.participant };
}

export async function createGame(): Promise<{
  code: string;
  hostToken: string;
  demo: boolean;
}> {
  if (isSupabaseConfigured()) {
    const response = await fetch("/api/rooms", { method: "POST" });
    const json = (await response.json()) as {
      code?: string;
      hostToken?: string;
      demo?: boolean;
      message?: string;
    };
    if (response.ok && json.code && json.hostToken) {
      saveHostToken(json.code, json.hostToken);
      return { code: json.code, hostToken: json.hostToken, demo: false };
    }
  }

  const hostToken = createHostToken();
  const state = createRoom(Date.now(), hostToken);
  saveRoom(state);
  saveHostToken(state.room.code, hostToken);
  return { code: state.room.code, hostToken, demo: true };
}

export async function joinGame(code: string, nickname: string) {
  const upper = code.toUpperCase();
  if (isSupabaseConfigured()) {
    const result = await postAction(upper, { type: "join", nickname });
    if (!result.fallback && result.participant) {
      saveParticipantSession(upper, {
        participantId: result.participant.id,
        nickname: result.participant.nickname,
      });
      return result.participant;
    }
  }

  const room = getRoom(upper);
  if (!room) throw new Error("Salle introuvable dans cette démonstration locale.");
  const joined = joinRoom(room, { nickname, now: Date.now() });
  if (!joined.ok) throw joined.error;
  saveRoom(joined.state);
  const player = joined.state.participants[joined.state.participants.length - 1];
  saveParticipantSession(upper, {
    participantId: player.id,
    nickname: player.nickname,
  });
  return { id: player.id, nickname: player.nickname };
}

export async function chooseAction(
  code: string,
  participantId: string,
  choice: Round1Choice,
) {
  const upper = code.toUpperCase();
  if (isSupabaseConfigured()) {
    const result = await postAction(upper, {
      type: "choose",
      participantId,
      choice,
    });
    if (!result.fallback) return;
  }
  const room = getRoom(upper);
  if (!room) throw new Error("Salle introuvable.");
  const next = chooseRound1(room, { participantId, choice, now: Date.now() });
  if (!next.ok) throw next.error;
  saveRoom(next.state);
}

export async function voteAction(
  code: string,
  participantId: string,
  choice: VoteChoice,
) {
  const upper = code.toUpperCase();
  if (isSupabaseConfigured()) {
    const result = await postAction(upper, { type: "vote", participantId, choice });
    if (!result.fallback) return;
  }
  const room = getRoom(upper);
  if (!room) throw new Error("Salle introuvable.");
  const next = castVote(room, { participantId, choice, now: Date.now() });
  if (!next.ok) throw next.error;
  saveRoom(next.state);
}

export async function runHostAction(
  code: string,
  type: HostAction,
  extra?: Record<string, unknown>,
) {
  const upper = code.toUpperCase();
  const hostToken = loadHostToken(upper);
  if (!hostToken) {
    throw new Error("Vous n'êtes pas l'animateur de cette salle.");
  }

  if (isSupabaseConfigured()) {
    const result = await postAction(upper, { type, hostToken, ...extra });
    if (!result.fallback) return;
  }

  const room = getRoom(upper);
  if (!room) throw new Error("Salle introuvable.");
  const now = Date.now();
  const next = (() => {
    switch (type) {
      case "start_round_1":
        return startRound1(room, hostToken, now);
      case "pause":
        return pauseRound1(room, hostToken, now);
      case "resume":
        return resumeRound1(room, hostToken, now);
      case "close_round_1":
        return closeRound1(room, hostToken, now);
      case "reset_round_1":
        return resetRound1(room, hostToken, now);
      case "start_round_2":
        return startRound2(room, hostToken, now);
      case "start_round_3":
        return startRound3(room, hostToken, now);
      case "close_votes":
        return closeVotes(room, hostToken);
      case "reveal_votes":
        return revealVotes(room, hostToken);
      case "finish":
        return finishGame(room, hostToken);
      case "reset_game":
        return resetGame(room, hostToken, now);
      case "add_bots":
        return addDemoBots(room, hostToken, now, 8);
      case "simulate_bots":
        return simulateBotChoices(room, hostToken, now);
      case "simulate_votes":
        return simulateBotVotes(room, hostToken, now);
      default:
        throw new Error("Action inconnue");
    }
  })();
  if (!next.ok) throw next.error;
  saveRoom(next.state);
}
