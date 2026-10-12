const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function createId(): string {
  return crypto.randomUUID();
}

export function createRoomCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

export function createHostToken(): string {
  return Array.from(randomBytes(24), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashHostToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function hashHostTokenSync(token: string): string {
  let h1 = 2166136261;
  let h2 = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h1 ^= token.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 ^= token.charCodeAt(token.length - 1 - i);
    h2 = Math.imul(h2, 16777619);
  }
  return `h-${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
