import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Decision,
  GameState,
  Participant,
  Phase,
  Room,
  RoomStatus,
  Round1Choice,
  RoundNumber,
  Transaction,
  Vote,
  VoteChoice,
} from "@/lib/game/types";

function ts(value: string | null): number | null {
  return value ? new Date(value).getTime() : null;
}

function iso(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

export async function loadGameState(
  client: SupabaseClient,
  code: string,
): Promise<GameState | null> {
  const { data: roomRow, error } = await client
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error || !roomRow) return null;

  const roomId = roomRow.id as string;
  const [{ data: participants }, { data: decisions }, { data: transactions }, { data: votes }] =
    await Promise.all([
      client.from("participants").select("*").eq("room_id", roomId),
      client.from("decisions").select("*").eq("room_id", roomId),
      client.from("transactions").select("*").eq("room_id", roomId),
      client.from("votes").select("*").eq("room_id", roomId),
    ]);

  const room: Room = {
    id: roomRow.id,
    code: roomRow.code,
    status: roomRow.status as RoomStatus,
    currentRound: roomRow.current_round as RoundNumber,
    phase: roomRow.phase as Phase,
    roundStartedAt: ts(roomRow.round_started_at),
    roundEndsAt: ts(roomRow.round_ends_at),
    pausedRemainingMs: roomRow.paused_remaining_ms,
    votesRevealed: roomRow.votes_revealed,
    hostTokenHash: roomRow.host_token_hash,
    resetGeneration: roomRow.reset_generation,
    createdAt: ts(roomRow.created_at) ?? Date.now(),
  };

  return {
    room,
    participants: (participants ?? []).map(
      (p): Participant => ({
        id: p.id,
        roomId: p.room_id,
        nickname: p.nickname,
        initialBalance: p.initial_balance,
        currentBalance: p.current_balance,
        ateMeal: p.ate_meal,
        isBot: p.is_bot,
        connectedAt: ts(p.connected_at) ?? Date.now(),
        createdAt: ts(p.created_at) ?? Date.now(),
      }),
    ),
    decisions: (decisions ?? []).map(
      (d): Decision => ({
        id: d.id,
        roomId: d.room_id,
        participantId: d.participant_id,
        roundNumber: 1,
        choice: d.choice as Round1Choice,
        createdAt: ts(d.created_at) ?? Date.now(),
      }),
    ),
    transactions: (transactions ?? []).map(
      (t): Transaction => ({
        id: t.id,
        roomId: t.room_id,
        participantId: t.participant_id,
        roundNumber: t.round_number as RoundNumber,
        amount: t.amount,
        reason: t.reason,
        idempotencyKey: t.idempotency_key,
        createdAt: ts(t.created_at) ?? Date.now(),
      }),
    ),
    votes: (votes ?? []).map(
      (v): Vote => ({
        id: v.id,
        roomId: v.room_id,
        participantId: v.participant_id,
        choice: v.choice as VoteChoice,
        createdAt: ts(v.created_at) ?? Date.now(),
      }),
    ),
  };
}

export async function saveGameState(
  client: SupabaseClient,
  previous: GameState | null,
  next: GameState,
): Promise<void> {
  const room = next.room;
  const payload = {
    id: room.id,
    code: room.code,
    status: room.status,
    current_round: room.currentRound,
    phase: room.phase,
    round_started_at: iso(room.roundStartedAt),
    round_ends_at: iso(room.roundEndsAt),
    paused_remaining_ms: room.pausedRemainingMs,
    votes_revealed: room.votesRevealed,
    host_token_hash: room.hostTokenHash,
    reset_generation: room.resetGeneration,
    created_at: iso(room.createdAt),
  };

  const { error: roomError } = await client.from("rooms").upsert(payload);
  if (roomError) throw roomError;

  const prevP = new Set((previous?.participants ?? []).map((p) => p.id));
  const nextP = new Set(next.participants.map((p) => p.id));
  const removedParticipants = [...prevP].filter((id) => !nextP.has(id));
  if (removedParticipants.length) {
    await client.from("participants").delete().in("id", removedParticipants);
  }

  if (next.participants.length) {
    const { error } = await client.from("participants").upsert(
      next.participants.map((p) => ({
        id: p.id,
        room_id: p.roomId,
        nickname: p.nickname,
        initial_balance: p.initialBalance,
        current_balance: p.currentBalance,
        ate_meal: p.ateMeal,
        is_bot: p.isBot,
        connected_at: iso(p.connectedAt),
        created_at: iso(p.createdAt),
      })),
    );
    if (error) throw error;
  }

  await replaceChildren(client, "decisions", previous?.decisions ?? [], next.decisions, (d) => ({
    id: d.id,
    room_id: d.roomId,
    participant_id: d.participantId,
    round_number: d.roundNumber,
    choice: d.choice,
    created_at: iso(d.createdAt),
  }));

  await replaceChildren(
    client,
    "transactions",
    previous?.transactions ?? [],
    next.transactions,
    (t) => ({
      id: t.id,
      room_id: t.roomId,
      participant_id: t.participantId,
      round_number: t.roundNumber,
      amount: t.amount,
      reason: t.reason,
      idempotency_key: t.idempotencyKey,
      created_at: iso(t.createdAt),
    }),
  );

  await replaceChildren(client, "votes", previous?.votes ?? [], next.votes, (v) => ({
    id: v.id,
    room_id: v.roomId,
    participant_id: v.participantId,
    choice: v.choice,
    created_at: iso(v.createdAt),
  }));
}

async function replaceChildren<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  previous: T[],
  next: T[],
  map: (item: T) => Record<string, unknown>,
): Promise<void> {
  const prevIds = new Set(previous.map((i) => i.id));
  const nextIds = new Set(next.map((i) => i.id));
  const removed = [...prevIds].filter((id) => !nextIds.has(id));
  if (removed.length) {
    await client.from(table).delete().in("id", removed);
  }
  if (next.length) {
    const { error } = await client.from(table).upsert(next.map(map));
    if (error) throw error;
  }
}
