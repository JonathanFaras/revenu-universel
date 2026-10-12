"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { isSupabaseConfigured } from "@/lib/config";
import { joinGame } from "@/lib/client/game-api";
import { nicknameSchema, roomCodeSchema } from "@/lib/game/validation";

function JoinForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = !isSupabaseConfigured();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsedCode = roomCodeSchema.safeParse(code);
    const parsedName = nicknameSchema.safeParse(nickname);
    if (!parsedCode.success) {
      setError(parsedCode.error.issues[0]?.message ?? "Code invalide");
      return;
    }
    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "Pseudo invalide");
      return;
    }
    setBusy(true);
    try {
      await joinGame(parsedCode.data, parsedName.data);
      router.push(`/play/${parsedCode.data}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
      <DemoBadge show={demo} />
      <h1 className="mt-6 text-3xl font-semibold text-white">Rejoindre</h1>
      <p className="mt-2 text-sm text-slate-400">
        Aucun compte n&apos;est nécessaire. Choisissez un pseudo.
      </p>
      <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Code de salle
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 font-mono text-2xl tracking-[0.3em] text-white outline-none focus:border-cyan-300"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Pseudo
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg text-white outline-none focus:border-cyan-300"
            maxLength={20}
          />
        </label>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-2xl bg-cyan-400 text-base font-medium text-slate-950 disabled:opacity-40"
        >
          {busy ? "Connexion…" : "Entrer dans la salle"}
        </button>
      </form>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Chargement…</p>}>
      <JoinForm />
    </Suspense>
  );
}
