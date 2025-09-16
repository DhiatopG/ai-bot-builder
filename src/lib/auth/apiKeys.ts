// src/lib/auth/apiKeys.ts
import crypto from "crypto";

const SECRET = process.env.API_KEY_SIGNING_SECRET!;
if (!SECRET) throw new Error("Missing API_KEY_SIGNING_SECRET");

function sigFor(payload: string) {
  return crypto.createHmac("sha256", Buffer.from(SECRET, "hex"))
    .update(payload)
    .digest("base64url");
}

export function signApiKey(workspaceId: string, iat?: number) {
  const ts = iat ?? Math.floor(Date.now() / 1000);
  const payload = `${workspaceId}.${ts}`;
  const sig = sigFor(payload);
  return `apik_live.${workspaceId}.${ts}.${sig}`;
}

export function verifyApiKey(token?: string, maxAgeSec = 365 * 24 * 3600) {
  if (!token) return { ok: false as const, error: "missing" as const };
  if (!token.startsWith("apik_")) return { ok: false as const, error: "bad_prefix" as const };
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false as const, error: "bad_format" as const };
  const [, workspaceId, iatStr, sig] = parts;
  const payload = `${workspaceId}.${iatStr}`;
  const expected = sigFor(payload);

  // timing-safe signature check
  const goodSig = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!goodSig) return { ok: false as const, error: "bad_sig" as const };

  const iat = Number(iatStr);
  const age = Math.floor(Date.now() / 1000) - iat;
  if (!Number.isFinite(iat) || age < 0) return { ok: false as const, error: "bad_iat" as const };
  if (maxAgeSec && age > maxAgeSec) return { ok: false as const, error: "expired" as const };

  return { ok: true as const, workspaceId };
}
