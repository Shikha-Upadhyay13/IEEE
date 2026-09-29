// Verifies the caller's Supabase access token by asking Supabase Auth who it
// belongs to. This works with both legacy HS256 and newer asymmetric JWT
// signing keys without shipping a JWT secret to this service.

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of cache) if (entry.expires < now) cache.delete(token);
}, 5 * 60 * 1000).unref();

export function authConfig(env = process.env) {
  return {
    supabaseUrl: (env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    anonKey: env.SUPABASE_ANON_KEY ?? "",
    disabled: env.AI_AUTH_DISABLED === "true",
  };
}

export function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Resolves to { ok: true, userId } or { ok: false, status, error }.
 * `fetchImpl` is injectable for tests.
 */
export async function verifyRequest(req, config = authConfig(), fetchImpl = fetch) {
  if (config.disabled) return { ok: true, userId: null };
  if (!config.supabaseUrl || !config.anonKey) {
    return { ok: false, status: 503, error: "AI service auth is not configured (SUPABASE_URL / SUPABASE_ANON_KEY)." };
  }
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Sign in to use AI features." };

  const cached = cache.get(token);
  if (cached && cached.expires > Date.now()) return { ok: true, userId: cached.userId };

  let res;
  try {
    res = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, status: 503, error: "Couldn't reach the sign-in service. Try again shortly." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: 401, error: "Your session has expired. Sign in again." };
  }
  if (!res.ok) return { ok: false, status: 503, error: "Couldn't verify your session. Try again shortly." };
  const user = await res.json().catch(() => null);
  if (!user?.id) return { ok: false, status: 401, error: "Your session has expired. Sign in again." };

  cache.set(token, { userId: user.id, expires: Date.now() + CACHE_TTL_MS });
  return { ok: true, userId: user.id };
}

export function clearAuthCache() {
  cache.clear();
}
