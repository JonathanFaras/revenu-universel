import { NextResponse } from "next/server";
import { createRoom } from "@/lib/game/engine";
import { createHostToken } from "@/lib/game/ids";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveGameState } from "@/lib/supabase/persist";

export async function POST() {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        demo: true,
        message:
          "Supabase n'est pas configuré. Utilisez le mode démonstration locale.",
      },
      { status: 503 },
    );
  }

  const hostToken = createHostToken();
  const state = createRoom(Date.now(), hostToken);
  await saveGameState(admin, null, state);
  return NextResponse.json({
    code: state.room.code,
    hostToken,
    roomId: state.room.id,
  });
}
