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

export type LicenseMetrics = Record<string, number> | null;

export interface LicenseActive {
  active: true;
  licenseId: string | null;
  planId: string | null;
  planName: string;
  startsAt: string | null;
  expiresAt: string;
  serverNow: string;
  remainingSeconds: number;
  /** Limites do plano cadastrados pelo Admin (ex.: { edicoes: 100, projetos: 10 }). */
  limits: LicenseMetrics;
  /** Uso real acumulado no período (ex.: { edicoes: 42, tokens: 35280 }). */
  usage: LicenseMetrics;
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
  limits?: unknown;
  usage?: unknown;
  plan_limits?: unknown;
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

/** Endpoint oficial do MSK System — mesma autoridade usada pelo popup da extensão. */
const MSK_SYSTEM = (process.env["MSK_SYSTEM_URL"] ?? "https://msksystem.online").replace(/\/+$/, "");

/** Lê o plano do usuário no backend MSK (tabela `plans`). Nunca expõe segredos. */
async function planRowForUser(userId: string, token: string | null): Promise<LicenseRow | null> {
  const { url, anonKey, serviceKey, configured } = backend();
  if (!configured) return null;
  const key = serviceKey || anonKey;
  const auth = serviceKey ? serviceKey : token || anonKey;
  const query = `select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const res = await fetch(`${url}/rest/v1/plans?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${auth}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  const limits = metrics({
    execucoes_mes: row["monthly_run_limit"],
    tokens_mes: row["monthly_token_limit"],
    deploys: row["deploy_limit"],
  });
  return {
    id: null,
    user_id: userId,
    plan_name: typeof row["tier"] === "string" ? String(row["tier"]).toUpperCase() : null,
    status: typeof row["status"] === "string" ? row["status"] : null,
    starts_at: (row["starts_at"] as string) ?? (row["created_at"] as string) ?? null,
    expires_at: (row["ends_at"] as string) ?? (row["valid_until"] as string) ?? null,
    limits,
  };
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
  const { configured } = backend();
  const serverNow = new Date().toISOString();
  if (!configured) return { active: false, reason: "BACKEND_NOT_CONFIGURED", serverNow };

  const row = await planRowForUser(userId, token);
  if (!row) return { active: false, reason: "LICENSE_NOT_FOUND", serverNow };
  return decideLicense(row, serverNow);
}

/** Normaliza colunas jsonb de limites/uso; ignora qualquer valor não numérico. */
function metrics(value: unknown): LicenseMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** Decide ativo/inativo a partir da linha da licença, sempre com o relógio do servidor. */
function decideLicense(row: LicenseRow, serverNow: string): LicenseResult {
  const planName = row.plan_name ?? row.plan ?? "MSK Agente";
  const expiresAt = row.expires_at ?? null;
  const statusReason = reasonForStatus(row.status ?? "");
  if (statusReason) {
    return { active: false, reason: statusReason, planName, expiresAt, serverNow };
  }
  if (!expiresAt) {
    return { active: false, reason: "LICENSE_EXPIRED", planName, expiresAt, serverNow };
  }

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
    limits: metrics(row.limits ?? row.plan_limits),
    usage: metrics(row.usage),
  };
}

/**
 * Licença validada por CHAVE + E-MAIL — exatamente o mesmo validador oficial usado
 * pelo popup da extensão (`/api/extension/license-identity`). A chave nunca é
 * devolvida ao frontend; só o resultado seguro.
 */
export async function getLicenseByKey(email: string, key: string): Promise<LicenseResult> {
  const serverNow = new Date().toISOString();
  const mail = email.trim().toLowerCase();
  const licenseKey = key.trim();
  if (!mail || !licenseKey) return { active: false, reason: "UNAUTHENTICATED", serverNow };

  let data: {
    ok?: boolean;
    active?: boolean;
    user_id?: string | null;
    license_id?: string | null;
    status?: string | null;
    expires_at?: string | null;
    code?: string | null;
  };
  try {
    const res = await fetch(`${MSK_SYSTEM}/api/extension/license-identity`, {
      method: "POST",
      headers: { Authorization: `Bearer ${licenseKey}`, "content-type": "application/json" },
      body: JSON.stringify({ email: mail }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { active: false, reason: "LICENSE_NOT_FOUND", serverNow };
  }

  if (!data?.ok || !data?.active) {
    const code = String(data?.code ?? "");
    const reason: LicenseReason =
      code === "LICENSE_EMAIL_MISMATCH" || code === "LICENSE_REQUIRED"
        ? "UNAUTHENTICATED"
        : code === "INSTALLATION_BLOCKED"
          ? "LICENSE_SUSPENDED"
          : data?.expires_at
            ? "LICENSE_EXPIRED"
            : "LICENSE_NOT_FOUND";
    return { active: false, reason, expiresAt: data?.expires_at ?? null, serverNow };
  }

  // Licença confirmada pelo MSK System. Plano/limites vêm do backend quando existirem.
  const plan = data.user_id ? await planRowForUser(String(data.user_id), null) : null;
  const row: LicenseRow = {
    id: data.license_id ?? null,
    user_id: data.user_id ?? null,
    plan_name: plan?.plan_name ?? "MSK Agente",
    status: data.status ?? "active",
    starts_at: plan?.starts_at ?? null,
    expires_at: data.expires_at ?? plan?.expires_at ?? null,
    limits: plan?.limits ?? null,
  };
  return decideLicense(row, serverNow);
}


/** Faz login por e-mail e senha no backend MSK e devolve o token de sessão do próprio usuário. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; accessToken: string; email: string | null } | { ok: false; code: string }> {
  const { url, anonKey, configured } = backend();
  if (!configured) return { ok: false, code: "BACKEND_NOT_CONFIGURED" };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res.ok) return { ok: false, code: "INVALID_CREDENTIALS" };
  const data = (await res.json()) as {
    access_token?: string;
    user?: { email?: string | null } | null;
  };
  if (!data.access_token) return { ok: false, code: "INVALID_CREDENTIALS" };
  return { ok: true, accessToken: data.access_token, email: data.user?.email ?? null };
}

/**
 * Verificação completa a partir de uma Request HTTP.
 * Aceita duas credenciais, ambas validadas no servidor:
 *  1. Authorization: Bearer <token de sessão>  (login por e-mail e senha)
 *  2. x-msk-email + x-msk-license              (mesma licença já validada no popup)
 */
export async function licenseFromRequest(request: Request): Promise<LicenseResult> {
  const token = bearerFrom(request);
  const user = await verifySessionToken(token);
  if (user) return getActiveLicenseForUser(user.userId, token);

  const email = request.headers.get("x-msk-email");
  const key = request.headers.get("x-msk-license");
  if (email && key) return getLicenseByKey(email, key);

  return { active: false, reason: "UNAUTHENTICATED", serverNow: new Date().toISOString() };
}

export function httpStatusFor(reason: LicenseReason): number {
  if (reason === "UNAUTHENTICATED") return 401;
  if (reason === "BACKEND_NOT_CONFIGURED") return 503;
  return 403;
}
