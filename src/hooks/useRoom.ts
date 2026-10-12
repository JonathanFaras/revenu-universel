"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/config";
import { getRoom, loadHostToken, subscribeToRoom } from "@/lib/demo/repository";
import type { GameState } from "@/lib/game/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function useRoom(code: string) {
  const upper = code.toUpperCase();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseEnabled = isSupabaseConfigured();

  const [prevUpper, setPrevUpper] = useState(upper);
  if (upper !== prevUpper) {
    setPrevUpper(upper);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;

    if (!supabaseEnabled) {
      const unsub = subscribeToRoom(upper, (next) => {
        if (cancelled) return;
        setState(next);
        setLoading(false);
        setError(next ? null : "Salle introuvable dans cette démonstration locale.");
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      queueMicrotask(() => {
        if (!cancelled) {
          setState(getRoom(upper));
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const hostToken = loadHostToken(upper);
      const response = await fetch(`/api/rooms/${upper}`, {
        headers: hostToken ? { "x-host-token": hostToken } : undefined,
      });
      if (cancelled) return;
      if (response.status === 503) {
        const local = getRoom(upper);
        setState(local);
        setError(local ? null : "Salle introuvable.");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError("Salle introuvable.");
        setState(null);
        setLoading(false);
        return;
      }
      const json = (await response.json()) as {
        room: GameState["room"];
        participants: GameState["participants"];
        decisions: GameState["decisions"];
        transactions: GameState["transactions"];
        votes: GameState["votes"];
      };
      setState({
        room: { ...json.room, hostTokenHash: json.room.hostTokenHash ?? "" },
        participants: json.participants,
        decisions: json.decisions,
        transactions: json.transactions,
        votes: json.votes,
      });
      setError(null);
      setLoading(false);
    };

    void load();
    const channel = supabase
      .channel(`room:${upper}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        void load();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decisions" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          void load();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [upper, supabaseEnabled]);

  return useMemo(
    () => ({ state, loading, error, demo: !supabaseEnabled }),
    [state, loading, error, supabaseEnabled],
  );
}
