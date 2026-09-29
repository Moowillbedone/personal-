export async function checkOwnerAuthorization(
  header: string | null,
  username: string,
  password: string,
): Promise<boolean> {
  if (!header?.startsWith("Basic ") || !username || password.length < 20)
    return false;
  let supplied: string;
  try {
    supplied = atob(header.slice(6));
  } catch {
    return false;
  }
  // Equal-sized digests avoid comparing a secret with early-exit string logic.
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(`${username}:${password}`)),
  ]);
  const a = new Uint8Array(actual),
    b = new Uint8Array(expected);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

export function isCrossOriginWrite(
  method: string,
  origin: string | null,
  fetchSite: string | null,
  requestOrigin: string,
): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;
  return (
    fetchSite === "cross-site" || (origin != null && origin !== requestOrigin)
  );
}
