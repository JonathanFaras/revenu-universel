"use client";

import { useParams } from "next/navigation";
import { ScreenView } from "@/components/game/ScreenView";
import { useRoom } from "@/hooks/useRoom";

export default function ScreenPage() {
  const params = useParams<{ roomCode: string }>();
  const code = String(params.roomCode ?? "");
  const { state, loading, error, demo } = useRoom(code);

  if (loading) {
    return <p className="p-8 text-slate-400">Chargement de la projection…</p>;
  }
  if (error || !state) {
    return <p className="p-8 text-red-200">{error ?? "Salle introuvable."}</p>;
  }

  return (
    <main className="flex-1 px-6 py-10 md:px-12">
      <ScreenView state={state} demo={demo} />
    </main>
  );
}
