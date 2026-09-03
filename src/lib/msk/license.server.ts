/**
 * MSK AGENTE — fonte única de verdade da licença (SERVIDOR).
 *
 * Nada aqui roda no navegador. O relógio usado é sempre o do servidor/banco,
 * nunca o do computador do usuário. Nenhum segredo é devolvido ao frontend.
 */

export type LicenseReason =
  | "LICENSE_EXPIRED"
  | "LICENSE_SUSPENDED"
  | "LICENSE_REVOKED"
  | "LICENSE_NOT_FOUND"
  | "UNAUTHENTICATED"
  | "BACKEND_NOT_CONFIGURED";

export interface LicenseActive {
  active: true;
  licenseId: string | null;
  planId: string | null;
  planName: string;
  startsAt: string | null;
  expiresAt: string;
  serverNow: string;
  remainingSeconds: number;
}

export interface LicenseInactive {
  active: false;
  reason: LicenseReason;
  planName?: string | null;
  expiresAt?: string | null;
  serverNow: string;
}

export type LicenseResult = LicenseActive | LicenseInactive;

interface LicenseRow {
  id?: string | null;
  user_id?: string | null;
  plan_id?: string | null;
  plan?: string | null;
  plan_name?: string | null;
  status?: string | null;
  starts_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

function backend() {
  const env = process.env as Record<string, string | undefined>;
  const url = env["MSK_SUPABASE_URL"] ?? env["SUPABASE_URL"] ?? env["VITE_MSK_SUPABASE_URL"] ?? "";
  const anonKey =
    env["MSK_SUPABASE_ANON_KEY"] ??
    env["SUPABASE_PUBLISHABLE_KEY"] ??
    env["SUPABASE_ANON_KEY"] ??
    env["VITE_MSK_SUPABASE_ANON_KEY"] ??
    "";
  // Chave de serviço é opcional: quando existir, a leitura da licença ignora RLS
  // (útil para status administrativo). Nunca sai deste módulo.
  const serviceKey = env["MSK_SUPABASE_SERVICE_ROLE_KEY"] ?? env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return { url, anonKey, serviceKey, configured: Boolean(url && anonKey) };
}

/** Extrai o token de sessão do cabeçalho Authorization (nunca da query string). */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

/** Valida o token com o servidor de autenticação. O frontend nunca informa user_id. */
export async function verifySessionToken(
  token: string | null,
): Promise<{ userId: string; email: string | null } | null> {
  const { url, anonKey, configured } = backend();
  if (!configured || !token) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string | null };
  if (!user?.id) return null;
  return { userId: user.id, email: user.email ?? null };
}

function reasonForStatus(status: string): LicenseReason | null {
  const s = status.toLowerCase();
  if (["active", "trialing", "trial", "ativa", "ativo"].includes(s)) return null;
  if (["suspended", "blocked", "suspensa", "bloqueada"].includes(s)) return "LICENSE_SUSPENDED";
  if (["revoked", "cancelled", "canceled", "revogada", "cancelada"].includes(s))
    return "LICENSE_REVOKED";
  return "LICENSE_EXPIRED";
}

/**
 * Fonte única: devolve a licença efetiva do usuário conforme o horário do servidor.
 * `token` é o token de sessão já validado — usado para respeitar RLS quando não há
 * chave de serviço configurada.
 */
export async function getActiveLicenseForUser(
  userId: string,
  token: string | null,
): Promise<LicenseResult> {
  const { url, anonKey, serviceKey, configured } = backend();
  const serverNow = new Date().toISOString();
  if (!configured) return { active: false, reason: "BACKEND_NOT_CONFIGURED", serverNow };

  const key = serviceKey || anonKey;
  const auth = serviceKey ? serviceKey : token || anonKey;
  const query = `select=*&user_id=eq.${encodeURIComponent(userId)}&order=expires_at.desc&limit=1`;
  const res = await fetch(`${url}/rest/v1/licenses?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${auth}` },
  });
  if (!res.ok) return { active: false, reason: "LICENSE_NOT_FOUND", serverNow };

  const rows = (await res.json()) as LicenseRow[];
  const row = rows[0];
  if (!row) return { active: false, reason: "LICENSE_NOT_FOUND", serverNow };

  const planName = row.plan_name ?? row.plan ?? "MSK Agente";
  const expiresAt = row.expires_at ?? null;
  const statusReason = reasonForStatus(row.status ?? "");
  if (statusReason) {
    return { active: false, reason: statusReason, planName, expiresAt, serverNow };
  }
  if (!expiresAt) {
    return { active: false, reason: "LICENSE_EXPIRED", planName, expiresAt, serverNow };
  }

  // Relógio do SERVIDOR — o horário do cliente é irrelevante aqui.
  const now = Date.parse(serverNow);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end) || end <= now) {
    return { active: false, reason: "LICENSE_EXPIRED", planName, expiresAt, serverNow };
  }

  return {
    active: true,
    licenseId: row.id ?? null,
    planId: row.plan_id ?? null,
    planName,
    startsAt: row.starts_at ?? row.created_at ?? null,
    expiresAt,
    serverNow,
    remainingSeconds: Math.floor((end - now) / 1000),
  };
}

/** Verificação completa a partir de uma Request HTTP: sessão + licença. */
export async function licenseFromRequest(request: Request): Promise<LicenseResult> {
  const token = bearerFrom(request);
  const user = await verifySessionToken(token);
  if (!user) return { active: false, reason: "UNAUTHENTICATED", serverNow: new Date().toISOString() };
  return getActiveLicenseForUser(user.userId, token);
}

export function httpStatusFor(reason: LicenseReason): number {
  if (reason === "UNAUTHENTICATED") return 401;
  if (reason === "BACKEND_NOT_CONFIGURED") return 503;
  return 403;
}
