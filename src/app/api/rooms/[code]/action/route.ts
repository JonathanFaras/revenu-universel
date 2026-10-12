import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addDemoBots,
  castVote,
  chooseRound1,
  closeRound1,
  closeVotes,
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
import { GameError } from "@/lib/game/types";
import {
  nicknameSchema,
  round1ChoiceSchema,
  voteChoiceSchema,
} from "@/lib/game/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGameState, saveGameState } from "@/lib/supabase/persist";

const payloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), nickname: nicknameSchema }),
  z.object({
    type: z.literal("choose"),
    participantId: z.string().uuid(),
    choice: round1ChoiceSchema,
  }),
  z.object({
    type: z.literal("vote"),
    participantId: z.string().uuid(),
    choice: voteChoiceSchema,
  }),
  z.object({ type: z.literal("start_round_1"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("pause"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("resume"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("close_round_1"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("reset_round_1"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("start_round_2"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("start_round_3"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("close_votes"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("reveal_votes"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("finish"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("reset_game"), hostToken: z.string().min(8) }),
  z.object({
    type: z.literal("add_bots"),
    hostToken: z.string().min(8),
    count: z.number().int().min(1).max(40).optional(),
  }),
  z.object({ type: z.literal("simulate_bots"), hostToken: z.string().min(8) }),
  z.object({ type: z.literal("simulate_votes"), hostToken: z.string().min(8) }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ demo: true }, { status: 503 });
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const previous = await loadGameState(admin, code);
  if (!previous) {
    return NextResponse.json({ error: "Salle introuvable" }, { status: 404 });
  }

  const now = Date.now();
  const action = parsed.data;
  let result;

  try {
    switch (action.type) {
      case "join":
        result = joinRoom(previous, { nickname: action.nickname, now });
        break;
      case "choose":
        result = chooseRound1(previous, {
          participantId: action.participantId,
          choice: action.choice,
          now,
        });
        break;
      case "vote":
        result = castVote(previous, {
          participantId: action.participantId,
          choice: action.choice,
          now,
        });
        break;
      case "start_round_1":
        result = startRound1(previous, action.hostToken, now);
        break;
      case "pause":
        result = pauseRound1(previous, action.hostToken, now);
        break;
      case "resume":
        result = resumeRound1(previous, action.hostToken, now);
        break;
      case "close_round_1":
        result = closeRound1(previous, action.hostToken, now);
        break;
      case "reset_round_1":
        result = resetRound1(previous, action.hostToken, now);
        break;
      case "start_round_2":
        result = startRound2(previous, action.hostToken, now);
        break;
      case "start_round_3":
        result = startRound3(previous, action.hostToken, now);
        break;
      case "close_votes":
        result = closeVotes(previous, action.hostToken);
        break;
      case "reveal_votes":
        result = revealVotes(previous, action.hostToken);
        break;
      case "finish":
        result = finishGame(previous, action.hostToken);
        break;
      case "reset_game":
        result = resetGame(previous, action.hostToken, now);
        break;
      case "add_bots":
        result = addDemoBots(previous, action.hostToken, now, action.count ?? 8);
        break;
      case "simulate_bots":
        result = simulateBotChoices(previous, action.hostToken, now);
        break;
      case "simulate_votes":
        result = simulateBotVotes(previous, action.hostToken, now);
        break;
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: 409 },
    );
  }

  await saveGameState(admin, previous, result.state);

  const joined =
    action.type === "join"
      ? result.state.participants[result.state.participants.length - 1]
      : null;

  return NextResponse.json({
    ok: true,
    participant: joined
      ? { id: joined.id, nickname: joined.nickname }
      : undefined,
  });
}
