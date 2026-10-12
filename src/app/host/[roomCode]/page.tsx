"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostPanel } from "@/components/game/HostPanel";
import { useRoom } from "@/hooks/useRoom";
import { loadHostToken } from "@/lib/demo/repository";

export default function HostRoomPage() {
  const params = useParams<{ roomCode: string }>();
  const code = String(params.roomCode ?? "");
  const { state, loading, error, demo } = useRoom(code);
  const [joinUrl, setJoinUrl] = useState("");
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setJoinUrl(`${window.location.origin}/join?code=${code.toUpperCase()}`);
      setIsHost(Boolean(loadHostToken(code)));
    }, 0);
    return () => clearTimeout(timer);
  }, [code]);

  if (loading) {
    return <p className="p-8 text-slate-400">Chargement de la salle…</p>;
  }
  if (error || !state) {
    return <p className="p-8 text-red-200">{error ?? "Salle introuvable."}</p>;
  }
  if (!isHost) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-white">Accès animateur requis</h1>
        <p className="mt-3 text-slate-300">
          Le code de salle ne suffit pas pour piloter la partie. Ouvrez cette page
          depuis l&apos;appareil qui a créé la salle.
        </p>
        <Link className="mt-6 inline-block text-cyan-300" href={`/screen/${code}`}>
          Voir la projection
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <HostPanel state={state} demo={demo} joinUrl={joinUrl} />
    </main>
  );
}
