import type { GameState } from "@/lib/game/types";

const STORAGE_KEY = "revenu-universel-demo-v1";
const CHANNEL_NAME = "revenu-universel-demo";

type StoreShape = {
  rooms: Record<string, GameState>;
};

function emptyStore(): StoreShape {
  return { rooms: {} };
}

function canUseBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readStore(): StoreShape {
  if (!canUseBrowser()) return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.rooms) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  if (!canUseBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ubi-demo-updated"));
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "sync" });
    channel.close();
  } catch {
    /* BroadcastChannel may be unavailable */
  }
}

export function getRoom(code: string): GameState | null {
  return readStore().rooms[code.toUpperCase()] ?? null;
}

export function saveRoom(state: GameState): GameState {
  const store = readStore();
  store.rooms[state.room.code] = state;
  writeStore(store);
  return state;
}

export function deleteRoom(code: string): void {
  const store = readStore();
  delete store.rooms[code.toUpperCase()];
  writeStore(store);
}

export function subscribeToRoom(
  code: string,
  onChange: (state: GameState | null) => void,
): () => void {
  if (!canUseBrowser()) return () => undefined;

  const emit = () => onChange(getRoom(code));
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("ubi-demo-updated", onCustom);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => emit();
  } catch {
    channel = null;
  }

  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("ubi-demo-updated", onCustom);
    channel?.close();
  };
}

export function hostStorageKey(code: string): string {
  return `ubi-host:${code.toUpperCase()}`;
}

export function participantStorageKey(code: string): string {
  return `ubi-player:${code.toUpperCase()}`;
}

export function saveHostToken(code: string, token: string): void {
  if (!canUseBrowser()) return;
  localStorage.setItem(hostStorageKey(code), token);
}

export function loadHostToken(code: string): string | null {
  if (!canUseBrowser()) return null;
  return localStorage.getItem(hostStorageKey(code));
}

export function saveParticipantSession(
  code: string,
  session: { participantId: string; nickname: string },
): void {
  if (!canUseBrowser()) return;
  localStorage.setItem(participantStorageKey(code), JSON.stringify(session));
}

export function loadParticipantSession(
  code: string,
): { participantId: string; nickname: string } | null {
  if (!canUseBrowser()) return null;
  const raw = localStorage.getItem(participantStorageKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { participantId: string; nickname: string };
  } catch {
    return null;
  }
}
