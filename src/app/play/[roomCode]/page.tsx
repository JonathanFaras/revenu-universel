"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayerView } from "@/components/game/PlayerView";
import { useRoom } from "@/hooks/useRoom";
import { loadParticipantSession } from "@/lib/demo/repository";

export default function PlayPage() {
  const params = useParams<{ roomCode: string }>();
  const code = String(params.roomCode ?? "");
  const { state, loading, error, demo } = useRoom(code);
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const session = loadParticipantSession(code);
      setParticipantId(session?.participantId ?? null);
    }, 0);
    return () => clearTimeout(timer);
  }, [code]);

  if (loading) {
    return <p className="p-8 text-slate-400">Synchronisation…</p>;
  }
  if (error || !state) {
    return <p className="p-8 text-red-200">{error ?? "Salle introuvable."}</p>;
  }
  if (!participantId) {
    return (
      <main className="mx-auto max-w-md p-8">
        <p className="text-slate-200">Rejoignez d&apos;abord la salle avec un pseudo.</p>
        <Link className="mt-4 inline-block text-cyan-300" href={`/join?code=${code}`}>
          Aller à l&apos;écran d&apos;inscription
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6">
      <PlayerView state={state} participantId={participantId} demo={demo} />
    </main>
  );
}
