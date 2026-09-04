/**
 * MSK AGENTE — núcleo do painel profissional.
 * Tipos, configuração de backend, cliente REST Supabase, sessão/handoff
 * com a extensão e persistência local de recuperação.
 *
 * Regra: nenhum segredo aqui. Só chave publicável e token de sessão do usuário.
 */

export type ConnectionState = "connected" | "disconnected" | "checking";

export type Device = "desktop" | "tablet" | "mobile";

export type PreviewStatus =
  | "synced"
  | "update-available"
  | "updating"
  | "error"
  | "empty";

export interface MskProject {
  id: string;
  lovable_project_id: string | null;
  name: string;
  lovable_url: string | null;
  preview_url: string | null;
  production_url: string | null;
  repository: string | null;
  branch: string | null;
  favorite?: boolean;
  active?: boolean;
  updated_at: string;
}

export interface MskMessage {
  id: string;
  project_id: string;
  role: "user" | "agent" | "system";
  content: string;
  created_at: string;
  attachments?: MskAttachment[];
  run_id?: string | null;
}

export type RunStepStatus = "pending" | "running" | "done" | "error";

export interface MskRunStep {
  key: string;
  label: string;
  status: RunStepStatus;
  detail?: string;
}

export interface MskRun {
  id: string;
  project_id: string;
  request: string;
  status: "queued" | "running" | "done" | "error";
  steps: MskRunStep[];
  summary?: string;
  files?: string[];
  commit_sha?: string | null;
  repository?: string | null;
  branch?: string | null;
  created_at: string;
  finished_at?: string | null;
  error?: string | null;
}

export type AttachmentStatus = "received" | "reading" | "analyzed" | "ready" | "error";

export interface MskAttachment {
  id: string;
  project_id: string | null;
  name: string;
  mime: string;
  size: number;
  status: AttachmentStatus;
  data_url?: string;
  text_preview?: string;
  created_at: string;
}

export interface MskNotification {
  id: string;
  title: string;
  kind: "success" | "warning" | "error" | "info";
  created_at: string;
  read: boolean;
}

export interface MskLicense {
  plan: string;
  expires_at: string | null;
  edits_used: number;
  edits_limit: number | null;
  ai_spend: number | null;
  files_sent: number;
  source: "backend" | "unknown";
}

export interface MskTutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  category: string;
  sort_order: number;
}

export interface MskSession {
  user_id: string | null;
  email: string | null;
  name: string | null;
  access_token: string | null;
  active_project_id: string | null;
  source: "extension" | "local" | "none";
}

/* ------------------------------------------------------------------ */
/* Configuração de backend                                             */
/* ------------------------------------------------------------------ */

const env = import.meta.env as Record<string, string | undefined>;

export const MSK_BACKEND = {
  url: env["VITE_MSK_SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "",
  anonKey:
    env["VITE_MSK_SUPABASE_ANON_KEY"] ??
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    env["VITE_SUPABASE_ANON_KEY"] ??
    "",
  api: env["VITE_MSK_API_URL"] ?? "https://msksystem.online",
};

// Live binding: atualizado após hidratar a configuração pública vinda do servidor.
export let backendConfigured = Boolean(MSK_BACKEND.url && MSK_BACKEND.anonKey);

let hydration: Promise<boolean> | null = null;

/**
 * Busca no servidor a configuração PÚBLICA do backend MSK (URL + chave publicável).
 * Nenhum segredo trafega: a chave anon é pública por definição e o RLS continua valendo.
 */
export function hydrateBackendConfig(): Promise<boolean> {
  if (backendConfigured) return Promise.resolve(true);
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const res = await fetch("/api/msk/config");
      if (!res.ok) return false;
      const data = (await res.json()) as { url?: string; anonKey?: string; api?: string };
      if (!data?.url || !data?.anonKey) return false;
      MSK_BACKEND.url = data.url;
      MSK_BACKEND.anonKey = data.anonKey;
      if (data.api) MSK_BACKEND.api = data.api;
      backendConfigured = true;
      return true;
    } catch {
      return false;
    }
  })();
  return hydration;
}


export class NotConnectedError extends Error {
  constructor(what = "Backend MSK") {
    super(`${what} não conectado.`);
    this.name = "NotConnectedError";
  }
}

/* ------------------------------------------------------------------ */
/* Cliente REST (PostgREST) — usado somente com backend configurado     */
/* ------------------------------------------------------------------ */

function restHeaders(token?: string | null): HeadersInit {
  return {
    apikey: MSK_BACKEND.anonKey,
    Authorization: `Bearer ${token || MSK_BACKEND.anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export async function dbSelect<T>(\n  table: string,
  query: string,
  token?: string | null,
): Promise<T[]> {
  if (!backendConfigured) throw new NotConnectedError();
  const res = await fetch(`${MSK_BACKEND.url}/rest/v1/${table}?${query}`, {
    headers: restHeaders(token),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function dbInsert<T>(\n  table: string,
  rows: unknown,
  token?: string | null,
): Promise<T[]> {
  if (!backendConfigured) throw new NotConnectedError();
  const res = await fetch(`${MSK_BACKEND.url}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function dbPatch<T>(\n  table: string,
  query: string,
  patch: unknown,
  token?: string | null,
): Promise<T[]> {
  if (!backendConfigured) throw new NotConnectedError();
  const res = await fetch(`${MSK_BACKEND.url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: restHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

/* ------------------------------------------------------------------ */
/* Persistência local (recuperação rápida / continuidade)              */
/* ------------------------------------------------------------------ */

const PREFIX = "msk.panel.";

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

/* ------------------------------------------------------------------ */
/* Canal de sincronização popup ↔ painel                                */
/* ------------------------------------------------------------------ */

export type MskBusEvent =
  | { type: "active-project"; projectId: string | null }
  | { type: "run-update"; run: MskRun }
  | { type: "message"; message: MskMessage }
  | { type: "session"; session: MskSession };

const CHANNEL = "msk-agente";

export function createBus(onEvent: (e: MskBusEvent) => void) {
  if (typeof window === "undefined") return { post: () => {}, close: () => {} };
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev) => onEvent(ev.data as MskBusEvent);
  } catch {
    channel = null;
  }
  const onWindowMessage = (ev: MessageEvent) => {
    const data = ev.data as { source?: string; payload?: MskBusEvent } | undefined;
    if (data && data.source === "msk-extension" && data.payload) {
      onEvent(data.payload);
    }
  };
  window.addEventListener("message", onWindowMessage);
  return {
    post(event: MskBusEvent) {
      if (channel) channel.postMessage(event);
      window.postMessage({ source: "msk-panel", payload: event }, "*");
    },
    close() {
      channel?.close();
      window.removeEventListener("message", onWindowMessage);
    },
  };
}