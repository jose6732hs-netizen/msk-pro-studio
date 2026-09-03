/**
 * Camada de serviços do painel MSK.
 *
 * Cada serviço é um adapter: quando o backend MSK está conectado, ele fala com
 * o backend real (Supabase REST / MSK API). Quando não está, ele NÃO simula
 * sucesso — expõe `connected: false` e persiste localmente apenas o que é do
 * usuário (rascunhos, projetos manuais, histórico local de recuperação).
 */

import {
  MSK_BACKEND,
  NotConnectedError,
  backendConfigured,
  dbInsert,
  dbPatch,
  dbSelect,
  loadLocal,
  saveLocal,
  uid,
  type MskAttachment,
  type MskLicense,
  type MskMessage,
  type MskNotification,
  type MskProject,
  type MskRun,
  type MskTutorial,
} from "./core";

const connected = () => backendConfigured;

/* ------------------------------ Projetos ------------------------------ */

export const ProjectService = {
  connected,
  async list(token: string | null): Promise<MskProject[]> {
    if (connected()) {
      const rows = await dbSelect<MskProject & { project_connections?: unknown }>(
        "projects",
        "select=*&order=updated_at.desc",
        token,
      );
      return rows;
    }
    return loadLocal<MskProject[]>("projects", []);
  },
  saveLocalList(projects: MskProject[]) {
    saveLocal("projects", projects);
  },
  async setActive(token: string | null, projectId: string) {
    saveLocal("active_project_id", projectId);
    if (!connected()) return;
    await dbPatch("projects", `id=eq.${projectId}`, { active: true }, token);
  },
  upsertLocal(project: MskProject): MskProject[] {
    const list = loadLocal<MskProject[]>("projects", []);
    const next = [project, ...list.filter((p) => p.id !== project.id)];
    saveLocal("projects", next);
    return next;
  },
};

/* ------------------------------ Conversa ------------------------------ */

export const ConversationService = {
  connected,
  async list(token: string | null, projectId: string): Promise<MskMessage[]> {
    if (connected()) {
      return dbSelect<MskMessage>(
        "agent_messages",
        `select=*&project_id=eq.${projectId}&order=created_at.asc`,
        token,
      );
    }
    return loadLocal<MskMessage[]>(`messages.${projectId}`, []);
  },
  async append(token: string | null, message: MskMessage): Promise<MskMessage> {
    if (connected()) {
      const [row] = await dbInsert<MskMessage>("agent_messages", message, token);
      return row ?? message;
    }
    const key = `messages.${message.project_id}`;
    const list = loadLocal<MskMessage[]>(key, []);
    saveLocal(key, [...list, message]);
    return message;
  },
};

/* ------------------------------- Agente ------------------------------- */

export interface AgentRunInput {
  projectId: string;
  lovableProjectId: string | null;
  repository: string | null;
  branch: string | null;
  prompt: string;
  attachments: MskAttachment[];
}

export const AgentService = {
  connected,
  /**
   * Dispara a execução no orquestrador MSK existente (mesmo agente do popup).
   * Retorna o run criado pelo backend. Sem backend, lança NotConnectedError —
   * o painel mostra estado "não conectado" em vez de fingir execução.
   */
  async start(token: string | null, input: AgentRunInput): Promise<MskRun> {
    if (!connected()) throw new NotConnectedError("Orquestrador MSK");
    const res = await fetch(`${MSK_BACKEND.api}/api/agent/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Orquestrador MSK: ${res.status}`);
    return (await res.json()) as MskRun;
  },
  async listRuns(token: string | null, projectId: string): Promise<MskRun[]> {
    if (connected()) {
      return dbSelect<MskRun>(
        "agent_runs",
        `select=*&project_id=eq.${projectId}&order=created_at.desc&limit=100`,
        token,
      );
    }
    return loadLocal<MskRun[]>(`runs.${projectId}`, []);
  },
  saveLocalRun(run: MskRun) {
    const key = `runs.${run.project_id}`;
    const list = loadLocal<MskRun[]>(key, []);
    saveLocal(key, [run, ...list.filter((r) => r.id !== run.id)].slice(0, 100));
  },
};

/* ------------------------------- GitHub ------------------------------- */

export interface GitHubState {
  connected: boolean;
  user: string | null;
  repository: string | null;
  branch: string | null;
  last_commit: string | null;
}

export const GitHubService = {
  /** OAuth é server-side; o painel só inicia o fluxo, nunca guarda token. */
  authorizeUrl(): string {
    return `${MSK_BACKEND.api}/api/github/oauth/start?redirect=${encodeURIComponent(
      typeof window === "undefined" ? "" : window.location.href,
    )}`;
  },
  async state(token: string | null): Promise<GitHubState> {
    if (!backendConfigured) {
      return { connected: false, user: null, repository: null, branch: null, last_commit: null };
    }
    const rows = await dbSelect<{ provider: string; metadata: Record<string, string> }>(
      "user_connections",
      "select=provider,metadata&provider=eq.github&limit=1",
      token,
    );
    const meta = rows[0]?.metadata;
    if (!meta) {
      return { connected: false, user: null, repository: null, branch: null, last_commit: null };
    }
    return {
      connected: true,
      user: meta["user"] ?? null,
      repository: meta["repository"] ?? null,
      branch: meta["branch"] ?? null,
      last_commit: meta["last_commit"] ?? null,
    };
  },
};

/* ------------------------------ Preview ------------------------------- */

export const PreviewService = {
  url(project: MskProject | null): string | null {
    if (!project) return null;
    return project.preview_url ?? project.production_url ?? null;
  },
  bust(url: string): string {
    const u = new URL(url, typeof window === "undefined" ? "https://x" : window.location.href);
    u.searchParams.set("mskts", String(Date.now()));
    return u.toString();
  },
};

/* ----------------------------- Anexos --------------------------------- */

const TEXTUAL = ["application/json", "text/plain", "text/markdown"];

export const AttachmentService = {
  accept:
    ".png,.jpg,.jpeg,.webp,.svg,.pdf,.txt,.json,.zip,.md,.csv,application/pdf,image/*",
  isAllowed(file: File) {
    return /\.(png|jpe?g|webp|svg|pdf|txt|json|zip|md|csv)$/i.test(file.name);
  },
  async read(file: File, projectId: string | null): Promise<MskAttachment> {
    const base: MskAttachment = {
      id: uid(),
      project_id: projectId,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      status: "reading",
      created_at: new Date().toISOString(),
    };
    try {
      if (file.type.startsWith("image/")) {
        base.data_url = await toDataUrl(file);
      } else if (TEXTUAL.includes(file.type) || /\.(txt|json|md|csv)$/i.test(file.name)) {
        base.text_preview = (await file.text()).slice(0, 20000);
      }
      base.status = "analyzed";
      return base;
    } catch {
      return { ...base, status: "error" };
    }
  },
  /** Envia o anexo ao backend para a IA realmente ler o conteúdo. */
  async upload(token: string | null, attachment: MskAttachment): Promise<MskAttachment> {
    if (!backendConfigured) throw new NotConnectedError("Armazenamento de anexos");
    const [row] = await dbInsert<MskAttachment>("agent_attachments", attachment, token);
    return row ?? attachment;
  },
};

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ---------------------------- Licença / uso ---------------------------- */

export const LicenseService = {
  async get(token: string | null): Promise<MskLicense | null> {
    if (!backendConfigured) return null;
    const rows = await dbSelect<{
      plan: string;
      expires_at: string;
      edits_used: number;
      edits_limit: number | null;
      ai_spend: number | null;
      files_sent: number;
    }>("licenses", "select=*&order=expires_at.desc&limit=1", token);
    const row = rows[0];
    if (!row) return null;
    return { ...row, source: "backend" };
  },
};

/* --------------------------- Notificações ------------------------------ */

export const NotificationService = {
  async list(token: string | null): Promise<MskNotification[]> {
    if (!backendConfigured) return [];
    return dbSelect<MskNotification>(
      "notifications",
      "select=*&order=created_at.desc&limit=50",
      token,
    );
  },
  async markRead(token: string | null, id: string) {
    if (!backendConfigured) return;
    await dbPatch("notifications", `id=eq.${id}`, { read: true }, token);
  },
};

/* ----------------------------- Tutoriais ------------------------------- */

export const TutorialService = {
  async list(token: string | null): Promise<MskTutorial[]> {
    if (!backendConfigured) return [];
    return dbSelect<MskTutorial>(
      "tutorial_links",
      "select=*&active=is.true&order=sort_order.asc",
      token,
    );
  },
};

/* ----------------------------- Publicação ------------------------------ */

export type PublishStage =
  | "idle"
  | "preparing"
  | "syncing"
  | "publishing"
  | "verifying"
  | "published"
  | "error";

export const PublishService = {
  async publish(token: string | null, projectId: string): Promise<{ url: string }> {
    if (!backendConfigured) throw new NotConnectedError("Publicação");
    const res = await fetch(`${MSK_BACKEND.api}/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Publicação: ${res.status}`);
    return (await res.json()) as { url: string };
  },
};

/* -------------------------- Remover marca ------------------------------ */

export const BrandingService = {
  candidates: [
    "src/index.css",
    "src/styles.css",
    "src/App.css",
    "src/globals.css",
    "app/globals.css",
    "styles/globals.css",
  ],
  async removeWatermark(token: string | null, projectId: string) {
    if (!backendConfigured) throw new NotConnectedError("Remover marca");
    const res = await fetch(`${MSK_BACKEND.api}/api/projects/${projectId}/remove-branding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ candidates: BrandingService.candidates }),
    });
    if (!res.ok) throw new Error(`Remover marca: ${res.status}`);
    return (await res.json()) as { ok: boolean; file?: string };
  },
};
