/**
 * MSK ACTIVE CONTEXT — estado ativo único compartilhado extensão ↔ painel.
 *
 * Regras:
 * - a EXTENSÃO detecta o contexto (projeto Lovable, repo, branch, run, skills, IA);
 * - o BACKEND valida/persiste (quando conectado) e é a fonte da verdade;
 * - o PAINEL apenas consome — nunca cria um segundo estado ativo.
 * - nenhum token/segredo trafega aqui.
 */

import { loadLocal, saveLocal, type MskProject } from "./core";

export interface ActiveContext {
  userId: string | null;
  projectId: string | null;
  lovableProjectId: string | null;
  lovableProjectName: string | null;
  lovableUrl: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  githubRepoId: string | null;
  githubRepoUrl: string | null;
  branch: string | null;
  previewUrl: string | null;
  previewProvider: PreviewProvider | null;
  productionUrl: string | null;
  conversationId: string | null;
  activeRunId: string | null;
  activeSkills: string[];
  aiProvider: string | null;
  aiModel: string | null;
  pinned: boolean;
  extensionVersion: string | null;
  updatedAt: string | null;
}

export type PreviewProvider = "lovable" | "msk" | "deployment" | "local" | "custom";

export type SyncState = "idle" | "syncing" | "ready" | "error";

export interface ContextSyncStatus {
  extension: SyncState;
  project: SyncState;
  github: SyncState;
  preview: SyncState;
  ai: SyncState;
  message: string | null;
}

export const EMPTY_CONTEXT: ActiveContext = {
  userId: null,
  projectId: null,
  lovableProjectId: null,
  lovableProjectName: null,
  lovableUrl: null,
  githubOwner: null,
  githubRepo: null,
  githubRepoId: null,
  githubRepoUrl: null,
  branch: null,
  previewUrl: null,
  previewProvider: null,
  productionUrl: null,
  conversationId: null,
  activeRunId: null,
  activeSkills: [],
  aiProvider: null,
  aiModel: null,
  pinned: false,
  extensionVersion: null,
  updatedAt: null,
};

const KEY = "active_context";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Normaliza um payload cru vindo da extensão (bridge ou handoff). */
export function normalizeContext(raw: Record<string, unknown> | null | undefined): ActiveContext {
  const r = raw ?? {};
  const repoFull = str(r["repository"]);
  const [ownerFromFull, repoFromFull] = (repoFull ?? "").split("/");
  return {
    userId: str(r["userId"]),
    projectId: str(r["projectId"]),
    lovableProjectId: str(r["lovableProjectId"]),
    lovableProjectName: str(r["lovableProjectName"]) ?? str(r["projectName"]),
    lovableUrl: str(r["lovableUrl"]),
    githubOwner: str(r["githubOwner"]) ?? str(ownerFromFull),
    githubRepo: str(r["githubRepo"]) ?? str(repoFromFull),
    githubRepoId: str(r["githubRepoId"]),
    githubRepoUrl: str(r["githubRepoUrl"]),
    branch: str(r["branch"]) ?? str(r["activeBranch"]),
    previewUrl: str(r["previewUrl"]),
    previewProvider: (str(r["previewProvider"]) as PreviewProvider | null) ?? null,
    productionUrl: str(r["productionUrl"]),
    conversationId: str(r["conversationId"]),
    activeRunId: str(r["activeRunId"]) ?? str(r["currentRunId"]),
    activeSkills: Array.isArray(r["activeSkills"])
      ? (r["activeSkills"] as unknown[]).map((s) => String(s)).filter(Boolean)
      : [],
    aiProvider: str(r["aiProvider"]),
    aiModel: str(r["aiModel"]),
    pinned: Boolean(r["pinned"]),
    extensionVersion: str(r["extensionVersion"]),
    updatedAt: str(r["updatedAt"]) ?? new Date().toISOString(),
  };
}

/** Mescla mantendo o contexto MAIS RECENTE por campo (nunca apaga com null). */
export function mergeContext(current: ActiveContext, incoming: ActiveContext): ActiveContext {
  const next: ActiveContext = { ...current };
  (Object.keys(incoming) as Array<keyof ActiveContext>).forEach((k) => {
    const value = incoming[k];
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    // @ts-expect-error atribuição homogênea campo a campo
    next[k] = value;
  });
  next.updatedAt = incoming.updatedAt ?? current.updatedAt;
  return next;
}

export function loadContext(): ActiveContext {
  return { ...EMPTY_CONTEXT, ...loadLocal<Partial<ActiveContext>>(KEY, {}) };
}

export function persistContext(ctx: ActiveContext) {
  saveLocal(KEY, ctx);
}

/** true quando `incoming` é mais recente que o contexto atual (item 29). */
export function isNewer(current: ActiveContext, incoming: ActiveContext): boolean {
  if (!current.updatedAt) return true;
  if (!incoming.updatedAt) return false;
  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt);
}

/* ------------------------------------------------------------------ */
/* Resolução de projeto (nunca escolher aleatoriamente)                 */
/* ------------------------------------------------------------------ */

export interface ProjectResolution {
  match: MskProject | null;
  candidates: MskProject[];
  status: "resolved" | "ambiguous" | "unknown" | "empty";
}

export function resolveProject(
  projects: MskProject[],
  ctx: ActiveContext,
): ProjectResolution {
  if (!ctx.projectId && !ctx.lovableProjectId && !ctx.githubRepo) {
    return { match: null, candidates: [], status: "empty" };
  }
  const repoFull =
    ctx.githubOwner && ctx.githubRepo ? `${ctx.githubOwner}/${ctx.githubRepo}` : null;

  const byId = projects.filter((p) => ctx.projectId && p.id === ctx.projectId);
  if (byId.length === 1 && byId[0]) return { match: byId[0], candidates: byId, status: "resolved" };

  const byLovable = projects.filter(
    (p) => ctx.lovableProjectId && p.lovable_project_id === ctx.lovableProjectId,
  );
  if (byLovable.length === 1 && byLovable[0])
    return { match: byLovable[0], candidates: byLovable, status: "resolved" };
  if (byLovable.length > 1) return { match: null, candidates: byLovable, status: "ambiguous" };

  const byRepo = projects.filter(
    (p) => repoFull && p.repository?.toLowerCase() === repoFull.toLowerCase(),
  );
  if (byRepo.length === 1 && byRepo[0])
    return { match: byRepo[0], candidates: byRepo, status: "resolved" };
  if (byRepo.length > 1) return { match: null, candidates: byRepo, status: "ambiguous" };

  return { match: null, candidates: [], status: "unknown" };
}

/** Projeto MSK derivado do contexto ativo (usado ao registrar projeto novo). */
export function contextToProject(ctx: ActiveContext): (Partial<MskProject> & { name: string }) | null {
  const repoFull =
    ctx.githubOwner && ctx.githubRepo ? `${ctx.githubOwner}/${ctx.githubRepo}` : null;
  const name = ctx.lovableProjectName ?? repoFull ?? ctx.lovableProjectId;
  if (!name) return null;
  const id = ctx.projectId ?? ctx.lovableProjectId;
  return {
    ...(id ? { id } : {}),
    lovable_project_id: ctx.lovableProjectId,
    name,
    lovable_url: ctx.lovableUrl,
    preview_url: ctx.previewUrl,
    production_url: ctx.productionUrl,
    repository: repoFull,
    branch: ctx.branch ?? "main",
  };
}

/* ------------------------------------------------------------------ */
/* Prioridade do preview (item 9) — nunca inventar URL                  */
/* ------------------------------------------------------------------ */

export interface ResolvedPreview {
  url: string | null;
  provider: PreviewProvider | null;
  reason: "ok" | "unavailable";
}

/**
 * URLs do editor Lovable (lovable.dev/projects/... e id-preview--*.lovable.app)
 * exigem sessão e renderizam a tela "Sign in to continue" dentro do iframe.
 * O preview público do sandbox é `<id>.lovableproject.com` — sempre convertemos.
 */
export function toEmbeddablePreview(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const id =
      /(^|\.)lovable\.dev$/i.test(u.hostname)
        ? u.pathname.match(/([0-9a-f-]{36})/i)?.[1]
        : /^id-preview--([0-9a-f-]{36})\.lovable\.app$/i.exec(u.hostname)?.[1];
    if (id) return `https://${id}.lovableproject.com`;
    return u.toString();
  } catch {
    return url;
  }
}

export function resolvePreview(
  project: MskProject | null,
  ctx: ActiveContext,
): ResolvedPreview {
  // 1. preview ativo configurado explicitamente para o projeto/contexto
  if (ctx.previewUrl && ctx.previewProvider)
    return { url: toEmbeddablePreview(ctx.previewUrl), provider: ctx.previewProvider, reason: "ok" };
  // 2. preview MSK do projeto
  if (project?.preview_url)
    return { url: toEmbeddablePreview(project.preview_url), provider: "msk", reason: "ok" };
  // 3. preview/deploy vindo do contexto sem provider declarado
  if (ctx.previewUrl)
    return { url: toEmbeddablePreview(ctx.previewUrl), provider: "deployment", reason: "ok" };
  // 4. preview Lovable derivado do ID do projeto identificado pela extensão
  const lovableId = project?.lovable_project_id ?? ctx.lovableProjectId;
  if (lovableId && /^[0-9a-f-]{36}$/i.test(lovableId))
    return {
      url: `https://${lovableId}.lovableproject.com`,
      provider: "lovable",
      reason: "ok",
    };
  const fromLovableUrl = toEmbeddablePreview(ctx.lovableUrl);
  if (fromLovableUrl && /lovableproject\.com$/i.test(new URL(fromLovableUrl).hostname))
    return { url: fromLovableUrl, provider: "lovable", reason: "ok" };
  // 5. produção
  const prod = project?.production_url ?? ctx.productionUrl;
  if (prod) return { url: prod, provider: "deployment", reason: "ok" };
  // 6. indisponível
  return { url: null, provider: null, reason: "unavailable" };
}


export function githubUrlFor(project: MskProject | null, ctx: ActiveContext): string | null {
  if (ctx.githubRepoUrl) return ctx.githubRepoUrl;
  const repo = project?.repository ?? (ctx.githubOwner && ctx.githubRepo ? `${ctx.githubOwner}/${ctx.githubRepo}` : null);
  return repo ? `https://github.com/${repo}` : null;
}

export function lovableUrlFor(project: MskProject | null, ctx: ActiveContext): string | null {
  if (project?.lovable_url) return project.lovable_url;
  if (ctx.lovableUrl) return ctx.lovableUrl;
  const id = project?.lovable_project_id ?? ctx.lovableProjectId;
  return id ? `https://lovable.dev/projects/${id}` : null;
}
