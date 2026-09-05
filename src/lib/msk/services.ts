/**
 * Serviços do MSK Pro Studio.
 *
 * Regra: o painel e a extensão usam o MESMO backend MSK. Edição, GitHub e
 * seleção de repositório passam pelas Edge Functions reais do projeto.
 * Nenhum token GitHub, service-role ou chave de IA é devolvido ao browser.
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const projectSessions = new Map<string, string>();

function edgeUrl(slug: string, action?: string) {
  if (!MSK_BACKEND.url) throw new NotConnectedError("Supabase MSK");
  const base = `${MSK_BACKEND.url.replace(/\/$/, "")}/functions/v1/${slug}`;
  return action ? `${base}?action=${encodeURIComponent(action)}` : base;
}

function edgeHeaders(token: string | null, session?: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: MSK_BACKEND.anonKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(session ? { "x-msk-session": session } : {}),
  };
}

async function edgePost<T>(
  slug: string,
  action: string,
  token: string | null,
  body: Record<string, unknown>,
  session?: string | null,
): Promise<T> {
  if (!backendConfigured) throw new NotConnectedError("Backend MSK");
  if (!token) throw new Error("Sessão/licença MSK não encontrada. Abra o painel pela extensão.");
  const res = await fetch(edgeUrl(slug, action), {
    method: "POST",
    headers: edgeHeaders(token, session),
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { error: raw };
  }
  if (!res.ok) {
    const err = new Error(String(data["error"] ?? data["message"] ?? `MSK: HTTP ${res.status}`)) as Error & {
      code?: string;
      stage?: string;
      errorId?: string;
      status?: number;
    };
    err.code = String(data["code"] ?? "MSK_REQUEST_FAILED");
    if (data["stage"]) err.stage = String(data["stage"]);
    if (data["error_id"]) err.errorId = String(data["error_id"]);

    err.status = res.status;
    throw err;
  }
  return data as T;
}

function storeProjectSession(projectId: string, value: unknown) {
  const session = String(value ?? "").trim();
  if (!session) return;
  projectSessions.set(projectId, session);
  try {
    window.sessionStorage.setItem(`msk.github.session.${projectId}`, session);
  } catch {
    // memória da aba continua disponível
  }
}

function cachedProjectSession(projectId: string) {
  const memory = projectSessions.get(projectId);
  if (memory) return memory;
  try {
    const value = window.sessionStorage.getItem(`msk.github.session.${projectId}`) ?? "";
    if (value) projectSessions.set(projectId, value);
    return value;
  } catch {
    return "";
  }
}

interface GithubLicenseResponse {
  ok?: boolean;
  connected?: boolean;
  installation_known?: boolean;
  authorization_reused?: boolean;
  session_recovered?: boolean;
  recovered_existing_installation?: boolean;
  session_token?: string;
  repository?: string;
  installation_id?: number;
  requires_github_authorization?: boolean;
  authorize_url?: string;
  recovery_state?: string;
  code?: string;
  error?: string;
}

async function ensureProjectSession(token: string | null, lovableProjectId: string) {
  const cached = cachedProjectSession(lovableProjectId);
  if (cached) return cached;
  const status = await edgePost<GithubLicenseResponse>(
    "msk-agent-license",
    "status",
    token,
    { lovable_project_id: lovableProjectId },
  );
  storeProjectSession(lovableProjectId, status.session_token);
  const session = cachedProjectSession(lovableProjectId);
  if (!status.connected || !session) {
    const err = new Error(
      status.requires_github_authorization
        ? "Conecte o GitHub antes de editar."
        : "A sessão GitHub do projeto ainda não foi recuperada.",
    ) as Error & { code?: string };
    err.code = status.code ?? "MSK_SESSION_REQUIRED";
    throw err;
  }
  return session;
}

/* ------------------------------ Projetos ------------------------------ */

export const ProjectService = {
  connected,
  async list(token: string | null): Promise<MskProject[]> {
    if (connected()) {
      try {
        return await dbSelect<MskProject>("projects", "select=*&order=updated_at.desc", token);
      } catch {
        // O painel continua com o handoff/cache da extensão se a tabela não existir.
      }
    }
    return loadLocal<MskProject[]>("projects", []);
  },
  saveLocalList(projects: MskProject[]) {
    saveLocal("projects", projects);
  },
  async setActive(token: string | null, projectId: string) {
    saveLocal("active_project_id", projectId);
    if (!connected()) return;
    await dbPatch("projects", `id=eq.${projectId}`, { active: true }, token).catch(() => {});
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
      try {
        return await dbSelect<MskMessage>(
          "agent_messages",
          `select=*&project_id=eq.${projectId}&order=created_at.asc`,
          token,
        );
      } catch {
        // mantém recuperação local quando o schema de conversa ainda não foi migrado
      }
    }
    return loadLocal<MskMessage[]>(`messages.${projectId}`, []);
  },
  async append(token: string | null, message: MskMessage): Promise<MskMessage> {
    if (connected()) {
      try {
        const [row] = await dbInsert<MskMessage>("agent_messages", message, token);
        return row ?? message;
      } catch {
        // não perde a conversa porque o cache local continua abaixo
      }
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

function completedRun(input: AgentRunInput, data: Record<string, unknown>, taskId: string): MskRun {
  const files = Array.isArray(data["files"]) ? data["files"].map(String) : [];
  return {
    id: String(data["task_id"] ?? taskId),
    project_id: input.projectId,
    request: input.prompt,
    status: "done",
    steps: [
      { key: "received", label: "Pedido recebido", status: "done" },
      { key: "locating_files", label: "Arquivos localizados", status: "done" },
      { key: "editing", label: "Edição aplicada", status: "done" },
      { key: "validating", label: "Alteração validada", status: "done" },
      { key: "committing", label: "Commit confirmado", status: "done" },
      { key: "preview", label: "Preview disponível para atualizar", status: "done" },
    ],
    summary: String(data["summary"] ?? data["assistant_message"] ?? "Alteração concluída."),
    files,
    commit_sha: data["commit_sha"] ? String(data["commit_sha"]) : null,
    repository: data["repository"] ? String(data["repository"]) : input.repository,
    branch: data["branch_used"] ? String(data["branch_used"]) : data["branch"] ? String(data["branch"]) : input.branch,
    created_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  };
}

export const AgentService = {
  connected,
  /** Mesmo executor da extensão: msk-agent?action=run. */
  async start(token: string | null, input: AgentRunInput): Promise<MskRun> {
    if (!connected()) throw new NotConnectedError("Orquestrador MSK");
    const lovableProjectId = String(input.lovableProjectId ?? "").trim();
    if (!UUID.test(lovableProjectId)) throw new Error("Projeto Lovable inválido ou não identificado.");
    if (!input.repository) throw new Error("Selecione o repositório GitHub do projeto antes de editar.");

    const session = await ensureProjectSession(token, lovableProjectId);
    const taskId = uid();
    const data = await edgePost<Record<string, unknown>>(
      "msk-agent",
      "run",
      token,
      {
        lovable_project_id: lovableProjectId,
        repository_url: input.repository,
        original_command: input.prompt,
        client_original_command: input.prompt,
        message: input.prompt,
        task_id: taskId,
        mode: "FAST_EDIT",
        attachment_ids: input.attachments.map((a) => a.id),
      },
      session,
    );
    if (data["completed"] !== true || !data["commit_sha"]) {
      throw new Error(String(data["error"] ?? "O MSK não confirmou o commit da alteração."));
    }
    return completedRun(input, data, taskId);
  },

  async chat(token: string | null, lovableProjectId: string, message: string) {
    const data = await edgePost<Record<string, unknown>>(
      "msk-agent",
      "chat",
      token,
      { lovable_project_id: lovableProjectId, message },
    );
    return String(data["assistant_message"] ?? data["message"] ?? "");
  },

  async taskStatus(token: string | null, lovableProjectId: string, taskId: string) {
    const session = await ensureProjectSession(token, lovableProjectId);
    return edgePost<Record<string, unknown>>(
      "msk-agent",
      "task-status",
      token,
      { lovable_project_id: lovableProjectId, task_id: taskId },
      session,
    );
  },

  async listRuns(token: string | null, projectId: string): Promise<MskRun[]> {
    if (connected()) {
      try {
        return await dbSelect<MskRun>(
          "agent_runs",
          `select=*&project_id=eq.${projectId}&order=created_at.desc&limit=100`,
          token,
        );
      } catch {
        // msk_tasks é a fonte atual do executor; cache abaixo preserva UX do painel
      }
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

export interface GitHubRepo {
  id?: number;
  full_name: string;
  name?: string;
  owner?: string;
  private?: boolean;
  default_branch?: string;
  html_url?: string;
  updated_at?: string;
  archived?: boolean;
}

export const GitHubService = {
  /** Mantido para compatibilidade; o fluxo real é obtido por connect(). */
  authorizeUrl(): string {
    return "https://msksystem.online";
  },

  async status(token: string | null, lovableProjectId: string): Promise<GithubLicenseResponse> {
    const data = await edgePost<GithubLicenseResponse>(
      "msk-agent-license",
      "status",
      token,
      { lovable_project_id: lovableProjectId },
      cachedProjectSession(lovableProjectId),
    );
    storeProjectSession(lovableProjectId, data.session_token);
    return data;
  },

  async connect(
    token: string | null,
    lovableProjectId: string,
    pageUrl?: string | null,
    repository?: string | null,
  ): Promise<GithubLicenseResponse> {
    const data = await edgePost<GithubLicenseResponse>(
      "msk-agent-license",
      "connect",
      token,
      {
        lovable_project_id: lovableProjectId,
        page_url: pageUrl ?? `https://lovable.dev/projects/${lovableProjectId}`,
        return_url: pageUrl ?? `https://lovable.dev/projects/${lovableProjectId}`,
        repository_url: repository ?? "",
      },
      cachedProjectSession(lovableProjectId),
    );
    storeProjectSession(lovableProjectId, data.session_token);
    return data;
  },

  async listRepositories(token: string | null, lovableProjectId: string): Promise<{
    connected: boolean;
    github_login: string | null;
    selected_repository: string | null;
    repositories: GitHubRepo[];
  }> {
    const session = await ensureProjectSession(token, lovableProjectId);
    const data = await edgePost<Record<string, unknown>>(
      "msk-agent-repositories",
      "list",
      token,
      { lovable_project_id: lovableProjectId },
      session,
    );
    return {
      connected: data["connected"] === true,
      github_login: data["github_login"] ? String(data["github_login"]) : null,
      selected_repository: data["selected_repository"] ? String(data["selected_repository"]) : null,
      repositories: Array.isArray(data["repositories"]) ? (data["repositories"] as GitHubRepo[]) : [],
    };
  },

  async selectRepository(token: string | null, lovableProjectId: string, repository: string) {
    const session = await ensureProjectSession(token, lovableProjectId);
    return edgePost<Record<string, unknown>>(
      "msk-agent-repositories",
      "select",
      token,
      { lovable_project_id: lovableProjectId, repository },
      session,
    );
  },

  async state(token: string | null, lovableProjectId?: string | null): Promise<GitHubState> {
    if (lovableProjectId && UUID.test(lovableProjectId)) {
      try {
        const status = await GitHubService.status(token, lovableProjectId);
        if (status.connected) {
          const repos = await GitHubService.listRepositories(token, lovableProjectId).catch(() => null);
          return {
            connected: true,
            user: repos?.github_login ?? null,
            repository: repos?.selected_repository ?? status.repository ?? null,
            branch:
              repos?.repositories.find((r) => r.full_name === repos.selected_repository)?.default_branch ??
              null,
            last_commit: null,
          };
        }
      } catch {
        // cai no estado local abaixo
      }
    }
    return { connected: false, user: null, repository: null, branch: null, last_commit: null };
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
  accept: ".png,.jpg,.jpeg,.webp,.svg,.pdf,.txt,.json,.zip,.md,.csv,application/pdf,image/*",
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
      if (file.type.startsWith("image/")) base.data_url = await toDataUrl(file);
      else if (TEXTUAL.includes(file.type) || /\.(txt|json|md|csv)$/i.test(file.name)) {
        base.text_preview = (await file.text()).slice(0, 20000);
      }
      base.status = "analyzed";
      return base;
    } catch {
      return { ...base, status: "error" };
    }
  },
  async upload(token: string | null, attachment: MskAttachment): Promise<MskAttachment> {
    if (!backendConfigured) throw new NotConnectedError("Armazenamento de anexos");
    try {
      const [row] = await dbInsert<MskAttachment>("agent_attachments", attachment, token);
      return row ?? attachment;
    } catch {
      // O upload multimodal da extensão continua sendo usado quando a tabela do painel não existe.
      return attachment;
    }
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
    try {
      const rows = await dbSelect<{
        plan: string;
        expires_at: string;
        edits_used: number;
        edits_limit: number | null;
        ai_spend: number | null;
        files_sent: number;
      }>("licenses", "select=*&order=expires_at.desc&limit=1", token);
      const row = rows[0];
      return row ? { ...row, source: "backend" } : null;
    } catch {
      return null;
    }
  },
};

/* --------------------------- Notificações ------------------------------ */

export const NotificationService = {
  async list(token: string | null): Promise<MskNotification[]> {
    if (!backendConfigured) return [];
    return dbSelect<MskNotification>("notifications", "select=*&order=created_at.desc&limit=50", token).catch(() => []);
  },
  async markRead(token: string | null, id: string) {
    if (!backendConfigured) return;
    await dbPatch("notifications", `id=eq.${id}`, { read: true }, token).catch(() => {});
  },
};

/* ----------------------------- Tutoriais ------------------------------- */

export const TutorialService = {
  async list(token: string | null): Promise<MskTutorial[]> {
    if (!backendConfigured) return [];
    return dbSelect<MskTutorial>("tutorial_links", "select=*&active=is.true&order=sort_order.asc", token).catch(() => []);
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
