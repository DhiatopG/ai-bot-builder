export async function revokeGoogleToken(token: string): Promise<"ok"|"already_revoked"|"error"> {
  if (!token) return "already_revoked";
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  if (res.status === 200) return "ok";
  if (res.status === 400) return "already_revoked"; // Google: treat as success
  return "error";
}
