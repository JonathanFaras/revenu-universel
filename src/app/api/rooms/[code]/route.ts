import { NextResponse } from "next/server";
import { requireHost } from "@/lib/game/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGameState } from "@/lib/supabase/persist";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ demo: true }, { status: 503 });
  }
  const state = await loadGameState(admin, code);
  if (!state) {
    return NextResponse.json({ error: "Salle introuvable" }, { status: 404 });
  }
  const hostToken = request.headers.get("x-host-token");
  const isHost = Boolean(hostToken && requireHost(state, hostToken));
  const revealVotes = state.room.votesRevealed || isHost;
  return NextResponse.json({
    room: {
      ...state.room,
      hostTokenHash: undefined,
    },
    participants: state.participants,
    decisions: state.decisions,
    transactions: state.transactions,
    votes: revealVotes ? state.votes : [],
    voteCount: state.votes.length,
  });
}
