export async function refreshGoogleAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Refresh failed: ${await res.text()}`);

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  return { accessToken: data.access_token, expiresAt };
}
