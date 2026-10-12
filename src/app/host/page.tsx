"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { isSupabaseConfigured } from "@/lib/config";
import { createGame } from "@/lib/client/game-api";

export default function HostHomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = !isSupabaseConfigured();

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const created = await createGame();
      router.push(`/host/${created.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
      <DemoBadge show={demo} />
      <h1 className="mt-6 text-4xl font-semibold text-white">Espace animateur</h1>
      <p className="mt-3 text-slate-300">
        Créez une salle, affichez le QR code, puis pilotez les trois manches depuis
        cet écran. Le code de salle ne suffit pas à administrer une partie : un
        jeton animateur est stocké uniquement sur cet appareil.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        className="mt-8 h-14 rounded-2xl bg-cyan-400 font-medium text-slate-950 disabled:opacity-40"
      >
        {busy ? "Création…" : "Créer une nouvelle partie"}
      </button>
    </main>
  );
}
