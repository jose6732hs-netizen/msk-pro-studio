import { MSK_EVENTS, MskEventBus, sendToExtension } from "./bridge";
import {
  EMPTY_CONTEXT,
  contextToProject,
  loadContext,
  mergeContext,
  isNewer,
  normalizeContext,
  persistContext,
  resolvePreview,
  resolveProject,
  type ActiveContext,
  type ContextSyncStatus,
  type ProjectResolution,
  type ResolvedPreview,
} from "./active-context";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  backendConfigured,
  hydrateBackendConfig,

  createBus,
  emptySession,
  loadLocal,
  readHandoff,
  readHandoffProjects,
  saveLocal,
  uid,
  type Device,
  type MskAttachment,
  type MskLicense,
  type MskMessage,
  type MskNotification,
  type MskProject,
  type MskRun,
  type MskSession,
  type MskTutorial,
  type PreviewStatus,
} from "./core";
import {
  AgentService,
  AttachmentService,
  ConversationService,
  GitHubService,
  LicenseService,
  NotificationService,
  ProjectService,
  TutorialService,
  type GitHubState,
} from "./services";

interface MskState {
  backendConfigured: boolean;
  backendError: string | null;
  session: MskSession;
  projects: MskProject[];
  activeProject: MskProject | null;
  setActiveProject: (id: string | null) => void;
  addLocalProject: (p: Partial<MskProject> & { name: string }) => void;
  messages: MskMessage[];
  sendMessage: (text: string) => Promise<void>;
  runs: MskRun[];
  activeRun: MskRun | null;
  attachments: MskAttachment[];
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  notifications: MskNotification[];
  license: MskLicense | null;
  github: GitHubState;
  connectGithub: () => void;
  linkRepository: (repoFullName: string, branch?: string) => void;
  connectProjectUrl: (url: string) => string | null;
  extensionInstalled: boolean;
  tutorials: MskTutorial[];
  device: Device;
  setDevice: (d: Device) => void;
  zoom: number;
  setZoom: (z: number) => void;
  activeContext: ActiveContext;
  syncStatus: ContextSyncStatus;
  resolution: ProjectResolution;
  preview: ResolvedPreview;
  contextLoading: boolean;
  contextDismissed: boolean;
  registerContextProject: () => void;
  dismissContextProject: () => void;
  retrySync: () => void;
  previewStatus: PreviewStatus;
  previewKey: number;
  reloadPreview: () => void;
  loading: boolean;
}

const Ctx = createContext<MskState | null>(null);

export function useMsk(): MskState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMsk deve ser usado dentro de <MskProvider>");
  return ctx;
}

export function MskProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MskSession>(emptySession);
  const [projects, setProjects] = useState<MskProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MskMessage[]>([]);
  const [runs, setRuns] = useState<MskRun[]>([]);
  const [attachments, setAttachments] = useState<MskAttachment[]>([]);
  const [notifications, setNotifications] = useState<MskNotification[]>([]);
  const [license, setLicense] = useState<MskLicense | null>(null);
  const [tutorials, setTutorials] = useState<MskTutorial[]>([]);
  const [github, setGithub] = useState<GitHubState>({
    connected: false,
    user: null,
    repository: null,
    branch: null,
    last_commit: null,
  });
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState(1);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("empty");
  const [previewKey, setPreviewKey] = useState(0);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContext, setActiveContext] = useState<ActiveContext>(EMPTY_CONTEXT);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<ContextSyncStatus>({
    extension: "idle",
    project: "idle",
    github: "idle",
    preview: "idle",
    ai: "idle",
    message: null,
  });
  const [syncNonce, setSyncNonce] = useState(0);
  const busRef = useRef<{ post: (e: never) => void; close: () => void } | null>(null);

  /* ---- Sessão / handoff da extensão ---- */
  useEffect(() => {
    const stored = loadLocal<MskSession>("session", emptySession);
    const handoff = readHandoff();
    const handoffProjects = readHandoffProjects();
    const next: MskSession = { ...stored, ...(handoff ?? {}) } as MskSession;
    setSession(next);
    saveLocal("session", next);

    // Projeto/repositório e histórico enviados pelo popup da extensão
    let merged: MskProject[] = [];
    for (const p of handoffProjects) merged = ProjectService.upsertLocal(p);
    if (merged.length) setProjects(merged);

    const fromHandoff = handoffProjects.at(-1)?.id ?? null;
    const active =
      fromHandoff ??
      next.active_project_id ??
      loadLocal<string | null>("active_project_id", null);
    setActiveId(active);
    if (active) saveLocal("active_project_id", active);

    // Contexto ativo persistido (cache) — o backend/extensão confirmam depois.
    const cached = loadContext();
    if (cached.updatedAt) setActiveContext(cached);
    const fromUrl = handoffProjects.at(-1);
    if (fromUrl) {
      const ctx = normalizeContext({
        projectId: fromUrl.id,
        lovableProjectId: fromUrl.lovable_project_id,
        lovableProjectName: fromUrl.name,
        lovableUrl: fromUrl.lovable_url,
        previewUrl: fromUrl.preview_url,
        productionUrl: fromUrl.production_url,
        repository: fromUrl.repository,
        branch: fromUrl.branch,
      });
      const merged = mergeContext(cached, ctx);
      setActiveContext(merged);
      persistContext(merged);
    }
  }, []);

  /* ---- Barramento popup ↔ painel ---- */
  useEffect(() => {
    const bus = createBus((e) => {
      if (e.type === "active-project") setActiveId(e.projectId);
      if (e.type === "run-update") {
        setRuns((prev) => [e.run, ...prev.filter((r) => r.id !== e.run.id)]);
        if (e.run.status === "done") setPreviewStatus("update-available");
      }
      if (e.type === "message") setMessages((prev) => [...prev, e.message]);
      if (e.type === "session") setSession(e.session);
    });
    busRef.current = bus as never;
    return () => bus.close();
  }, []);

  /* ---- MSK Bridge: contexto ativo da extensão ---- */
  useEffect(() => {
    const apply = (payload: Record<string, unknown>) => {
      const incoming = normalizeContext(payload);
      setActiveContext((prev) => {
        if (!isNewer(prev, incoming)) return prev;
        if (prev.pinned && incoming.lovableProjectId && incoming.lovableProjectId !== prev.lovableProjectId) {
          return prev; // projeto fixado: não trocar automaticamente
        }
        const changedProject =
          incoming.lovableProjectId && incoming.lovableProjectId !== prev.lovableProjectId;
        if (changedProject) {
          setContextLoading(true);
          setContextDismissed(false);
        }
        const merged = mergeContext(prev, incoming);
        persistContext(merged);
        return merged;
      });
      setSyncStatus((s) => ({ ...s, extension: "ready", project: "syncing", message: null }));
    };

    const offs = [
      MskEventBus.on(MSK_EVENTS.ACTIVE_CONTEXT_UPDATED, apply),
      MskEventBus.on(MSK_EVENTS.ACTIVE_PROJECT_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.PROJECT_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.REPOSITORY_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.BRANCH_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.PREVIEW_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.CONVERSATION_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.RUN_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.SKILLS_CHANGED, apply),
      MskEventBus.on(MSK_EVENTS.GITHUB_CONNECTED, (payload) => {
        setExtensionInstalled(true);
        const repo =
          (payload["repository"] as string) ??
          (payload["githubRepoFull"] as string) ??
          null;
        setGithub((prev) => ({
          connected: true,
          user: (payload["user"] as string) ?? prev.user,
          repository: repo ?? prev.repository,
          branch: (payload["branch"] as string) ?? prev.branch,
          last_commit: (payload["last_commit"] as string) ?? prev.last_commit,
        }));
        apply(payload);
      }),
      MskEventBus.on(MSK_EVENTS.GITHUB_STATUS, (payload) => {
        setExtensionInstalled(true);
        const repo =
          (payload["repository"] as string) ?? (payload["githubRepoFull"] as string) ?? null;
        setGithub((prev) => ({
          ...prev,
          connected: Boolean(payload["connected"] ?? repo),
          user: (payload["user"] as string) ?? prev.user,
          repository: repo ?? prev.repository,
          branch: (payload["branch"] as string) ?? prev.branch,
        }));
      }),
      MskEventBus.on(MSK_EVENTS.CHAT_MESSAGE, (payload) => {
        const content = (payload["content"] as string) ?? (payload["text"] as string) ?? "";
        if (!content.trim()) return;
        setMessages((prev) => [
          ...prev,
          {
            id: (payload["id"] as string) ?? uid(),
            project_id: (payload["projectId"] as string) ?? null,
            role: ((payload["role"] as string) ?? "assistant") as MskMessage["role"],
            content,
            created_at: (payload["createdAt"] as string) ?? new Date().toISOString(),
            attachments: [],
          },
        ]);
      }),

      // Execução real do agente (extensão → painel): progresso, conclusão e falha.
      MskEventBus.on(MSK_EVENTS.RUN_UPDATED, (payload) => {
        const runId = (payload["runId"] as string) ?? null;
        if (!runId) return;
        const stepKey = (payload["step"] as string) ?? "ai";
        const label = (payload["label"] as string) ?? "Processando";
        const stepStatus = ((payload["status"] as string) ?? "running") as MskRun["steps"][number]["status"];
        setRuns((prev) =>
          prev.map((r) => {
            if (r.id !== runId) return r;
            const rest = r.steps.filter((s) => s.key !== stepKey);
            const steps = [
              ...rest.map((s) =>
                s.status === "running" ? { ...s, status: "done" as const } : s,
              ),
              { key: stepKey, label, status: stepStatus },
            ];
            return { ...r, status: "running" as const, steps };
          }),
        );
      }),
      MskEventBus.on(MSK_EVENTS.RUN_COMPLETED, (payload) => {
        const runId = (payload["runId"] as string) ?? null;
        const content = (payload["message"] as string) ?? "Alterações aplicadas com sucesso.";
        const commits = Array.isArray(payload["commits"])
          ? (payload["commits"] as Array<Record<string, unknown>>)
          : [];
        const files = commits
          .map((c) => (c["path"] as string) ?? null)
          .filter((p): p is string => Boolean(p));
        const commitUrl =
          (commits[0]?.["url"] as string) ?? (commits[0]?.["html_url"] as string) ?? null;
        const commitSha =
          (commits[0]?.["sha"] as string) ?? (payload["commitSha"] as string) ?? null;
        const repository = (payload["repository"] as string) ?? null;
        const branch = (payload["branch"] as string) ?? null;

        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            project_id: (payload["projectId"] as string) ?? "",
            role: "agent" as const,
            content,
            created_at: new Date().toISOString(),
            attachments: [],
          },
        ]);
        setRuns((prev) => {
          const next = prev.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  status: "done" as const,
                  summary: content,
                  files: files.length ? files : (r.files ?? []),
                  commit_sha: commitSha,
                  repository: repository ?? r.repository,
                  branch: branch ?? r.branch,
                  finished_at: new Date().toISOString(),
                  steps: r.steps.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s,
                  ),
                }
              : r,
          );
          const done = next.find((r) => r.id === runId);
          if (done) AgentService.saveLocalRun(done);
          return next;
        });
        if (commitUrl || commitSha) {
          setGithub((prev) => ({ ...prev, last_commit: commitUrl ?? commitSha }));
        }
        // PREVIEW ATUALIZA: novo commit no GitHub → recarrega o preview do projeto.
        setPreviewStatus("update-available");
        setPreviewKey((k) => k + 1);
      }),
      MskEventBus.on(MSK_EVENTS.RUN_FAILED, (payload) => {
        const runId = (payload["runId"] as string) ?? null;
        const message = (payload["message"] as string) ?? "Falha na execução do agente.";
        setRuns((prev) => {
          const next = prev.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  status: "error" as const,
                  error: message,
                  finished_at: new Date().toISOString(),
                  steps: r.steps.map((s) =>
                    s.status === "running" ? { ...s, status: "error" as const } : s,
                  ),
                }
              : r,
          );
          const failed = next.find((r) => r.id === runId);
          if (failed) AgentService.saveLocalRun(failed);
          return next;
        });
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            project_id: "",
            role: "agent" as const,
            content: `Não consegui concluir: ${message}`,
            created_at: new Date().toISOString(),
            attachments: [],
          },
        ]);
      }),
      MskEventBus.on(MSK_EVENTS.EXTENSION_READY, () => {
        setExtensionInstalled(true);
        // pergunta à extensão se o GitHub oficial já está conectado
        sendToExtension(MSK_EVENTS.PANEL_GITHUB_STATUS, { source: "panel" });
      }),
      MskEventBus.on(MSK_EVENTS.ACTIVE_CONTEXT_UPDATED, () => setExtensionInstalled(true)),
    ];
    sendToExtension(MSK_EVENTS.PANEL_GITHUB_STATUS, { source: "panel" });
    return () => offs.forEach((off) => off());
  }, []);

  /* ---- GitHub conectado na extensão → reflete no editor ---- */
  useEffect(() => {
    const repo =
      activeContext.githubOwner && activeContext.githubRepo
        ? `${activeContext.githubOwner}/${activeContext.githubRepo}`
        : null;
    if (!repo) return;
    setGithub((prev) =>
      prev.connected && prev.repository === repo && prev.branch === (activeContext.branch ?? prev.branch)
        ? prev
        : {
            ...prev,
            connected: true,
            repository: repo,
            branch: activeContext.branch ?? prev.branch ?? "main",
          },
    );
  }, [activeContext.githubOwner, activeContext.githubRepo, activeContext.branch]);


  /* ---- Carga inicial ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await hydrateBackendConfig();
        const [p, gh, lic, notif, tut] = await Promise.all([

          ProjectService.list(session.access_token).catch(() =>
            loadLocal<MskProject[]>("projects", []),
          ),
          GitHubService.state(session.access_token).catch(() => github),
          LicenseService.get(session.access_token).catch(() => null),
          NotificationService.list(session.access_token).catch(() => []),
          TutorialService.list(session.access_token).catch(() => []),
        ]);
        if (cancelled) return;
        setProjects(p);
        setGithub(gh);
        setLicense(lic);
        setNotifications(notif);
        setTutorials(tut);
        setBackendError(backendConfigured ? null : "Backend MSK não conectado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token]);

  const activeProject = useMemo(
    () =>
      projects.find((p) => p.id === activeId) ??
      projects.find((p) => p.lovable_project_id === activeId) ??
      null,
    [projects, activeId],
  );

  /* ---- Conversa + execuções do projeto ativo ---- */
  useEffect(() => {
    if (!activeProject) {
      setMessages([]);
      setRuns([]);
      setPreviewStatus("empty");
      return;
    }
    let cancelled = false;
    (async () => {
      const [msgs, r] = await Promise.all([
        ConversationService.list(session.access_token, activeProject.id).catch(() => []),
        AgentService.listRuns(session.access_token, activeProject.id).catch(() => []),
      ]);
      if (cancelled) return;
      setMessages(msgs);
      setRuns(r);
      setPreviewStatus(activeProject.preview_url ? "synced" : "empty");
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject, session.access_token]);

  /* ---- Resolver projeto MSK a partir do contexto ativo ---- */
  const resolution = useMemo(
    () => resolveProject(projects, activeContext),
    [projects, activeContext],
  );

  useEffect(() => {
    if (resolution.status === "resolved" && resolution.match) {
      if (resolution.match.id !== activeId) {
        setActiveId(resolution.match.id);
        saveLocal("active_project_id", resolution.match.id);
      }
      setSyncStatus((s) => ({ ...s, project: "ready", message: null }));
      setContextLoading(false);
    } else if (resolution.status === "ambiguous") {
      setSyncStatus((s) => ({
        ...s,
        project: "error",
        message: "Mais de uma configuração encontrada para este projeto.",
      }));
      setContextLoading(false);
    } else if (resolution.status === "unknown") {
      setSyncStatus((s) => ({ ...s, project: "error", message: "Projeto ainda não registrado no MSK." }));
      setContextLoading(false);
    }
  }, [resolution, activeId, syncNonce]);

  const preview = useMemo(
    () => resolvePreview(activeProject, activeContext),
    [activeProject, activeContext],
  );

  useEffect(() => {
    setSyncStatus((s) => ({
      ...s,
      preview: preview.url ? "ready" : "error",
      github: activeProject?.repository || activeContext.githubRepo ? "ready" : "idle",
      ai: activeContext.aiProvider ? "ready" : "idle",
    }));
  }, [preview, activeProject, activeContext]);

  const registerContextProject = useCallback(() => {
    const draft = contextToProject(activeContext);
    if (!draft) return;
    const project: MskProject = {
      id: draft.id ?? uid(),
      lovable_project_id: draft.lovable_project_id ?? null,
      name: draft.name,
      lovable_url: draft.lovable_url ?? null,
      preview_url: draft.preview_url ?? null,
      production_url: draft.production_url ?? null,
      repository: draft.repository ?? null,
      branch: draft.branch ?? "main",
      updated_at: new Date().toISOString(),
    };
    setProjects(ProjectService.upsertLocal(project));
    setActiveId(project.id);
    saveLocal("active_project_id", project.id);
  }, [activeContext]);

  // Projeto/repositório vindos da extensão entram automaticamente no painel (1x por contexto).
  const autoRegisteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolution.status !== "unknown") return;
    const key = `${activeContext.lovableProjectId ?? ""}|${activeContext.githubRepo ?? ""}`;
    if (key === "|") return;
    if (autoRegisteredRef.current === key) return;
    autoRegisteredRef.current = key;
    registerContextProject();
  }, [resolution.status, activeContext.lovableProjectId, activeContext.githubRepo, registerContextProject]);


  const dismissContextProject = useCallback(() => setContextDismissed(true), []);


  const retrySync = useCallback(() => {
    setSyncStatus((s) => ({ ...s, project: "syncing", message: null }));
    setSyncNonce((n) => n + 1);
  }, []);

  const setActiveProject = useCallback((id: string | null) => {
    setActiveId(id);
    saveLocal("active_project_id", id);
    if (id) void ProjectService.setActive(null, id).catch(() => {});
    busRef.current?.post({ type: "active-project", projectId: id } as never);
    // Painel → extensão: mantém um único estado ativo.
    sendToExtension(MSK_EVENTS.PANEL_PROJECT_SELECTED, { projectId: id });
  }, []);

  const addLocalProject = useCallback((p: Partial<MskProject> & { name: string }) => {
    const project: MskProject = {
      id: p.id ?? uid(),
      lovable_project_id: p.lovable_project_id ?? null,
      name: p.name,
      lovable_url: p.lovable_url ?? null,
      preview_url: p.preview_url ?? null,
      production_url: p.production_url ?? null,
      repository: p.repository ?? null,
      branch: p.branch ?? "main",
      updated_at: new Date().toISOString(),
    };
    const next = ProjectService.upsertLocal(project);
    setProjects(next);
    setActiveId(project.id);
    saveLocal("active_project_id", project.id);
  }, []);

  const activeRun = useMemo(
    () => runs.find((r) => r.status === "running" || r.status === "queued") ?? null,
    [runs],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeProject || !text.trim()) return;
      const message: MskMessage = {
        id: uid(),
        project_id: activeProject.id,
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
        attachments,
      };
      setMessages((prev) => [...prev, message]);
      await ConversationService.append(session.access_token, message).catch(() => {});
      busRef.current?.post({ type: "message", message } as never);

      // Motor único: com a extensão instalada, quem executa é o MESMO agente do popup.
      if (extensionInstalled) {
        const run: MskRun = {
          id: message.id,
          project_id: activeProject.id,
          request: message.content,
          status: "running",
          steps: [
            { key: "received", label: "Pedido recebido", status: "done" },
            { key: "validating", label: "Validando licença, projeto e repositório", status: "running" },
          ],
          repository: activeProject.repository,
          branch: activeProject.branch,
          created_at: new Date().toISOString(),
        };
        setRuns((prev) => [run, ...prev]);
        AgentService.saveLocalRun(run);
        sendToExtension(MSK_EVENTS.PANEL_CHAT_SEND, {
          runId: run.id,
          messageId: message.id,
          projectId: activeProject.id,
          lovableProjectId: activeProject.lovable_project_id,
          conversationId: activeContext.conversationId,
          repository: activeProject.repository,
          branch: activeProject.branch,
          prompt: message.content,
          attachments: attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime })),
        });
        setAttachments([]);
        return;
      }

      try {

        const run = await AgentService.start(session.access_token, {
          projectId: activeProject.id,
          lovableProjectId: activeProject.lovable_project_id,
          repository: activeProject.repository,
          branch: activeProject.branch,
          prompt: message.content,
          attachments,
        });
        setRuns((prev) => [run, ...prev]);
        AgentService.saveLocalRun(run);
      } catch (err) {
        const failed: MskRun = {
          id: uid(),
          project_id: activeProject.id,
          request: message.content,
          status: "error",
          steps: [{ key: "received", label: "Pedido recebido", status: "done" }],
          created_at: new Date().toISOString(),
          error:
            err instanceof Error
              ? err.message
              : "Orquestrador MSK indisponível",
        };
        setRuns((prev) => [failed, ...prev]);
        AgentService.saveLocalRun(failed);
      }
      setAttachments([]);
    },
    [activeProject, attachments, session.access_token, extensionInstalled, activeContext.conversationId],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => AttachmentService.isAllowed(f));
      for (const file of list) {
        const received: MskAttachment = {
          id: uid(),
          project_id: activeProject?.id ?? null,
          name: file.name,
          mime: file.type,
          size: file.size,
          status: "received",
          created_at: new Date().toISOString(),
        };
        setAttachments((prev) => [...prev, received]);
        const parsed = await AttachmentService.read(file, activeProject?.id ?? null);
        setAttachments((prev) =>
          prev.map((a) => (a.id === received.id ? { ...parsed, id: received.id } : a)),
        );
        try {
          await AttachmentService.upload(session.access_token, { ...parsed, id: received.id });
          setAttachments((prev) =>
            prev.map((a) => (a.id === received.id ? { ...a, status: "ready" } : a)),
          );
        } catch {
          /* sem backend: o anexo fica local e a IA só o recebe após conectar */
        }
      }
    },
    [activeProject, session.access_token],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const reloadPreview = useCallback(() => {
    setPreviewStatus("updating");
    setPreviewKey((k) => k + 1);
    window.setTimeout(() => setPreviewStatus("synced"), 600);
  }, []);


  /* ---- GitHub: mesma conexão da extensão (OAuth server-side) ---- */
  const connectGithub = useCallback(() => {
    // já conectado (pela extensão ou pelo backend): nada a autorizar
    if (github.connected && github.repository) return;
    // 1) pede à extensão para abrir o MESMO fluxo OAuth do popup oficial
    sendToExtension(MSK_EVENTS.PANEL_GITHUB_CONNECT, { source: "panel", intent: "authorize" });
    // 2) fallback: se a extensão não responder, o painel abre o OAuth server-side
    window.setTimeout(() => {
      if (extensionInstalled) return;
      window.open(GitHubService.authorizeUrl(), "_blank", "noopener,noreferrer");
    }, 900);
  }, [extensionInstalled, github.connected, github.repository]);


  /** Repositório escolhido no editor → aplica no projeto ativo e sincroniza na extensão. */
  const linkRepository = useCallback(
    (repoFullName: string, branch?: string) => {
      const repo = repoFullName.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
      if (!repo.includes("/")) return;
      const nextBranch = branch?.trim() || activeProject?.branch || "main";
      setGithub((prev) => ({ ...prev, connected: true, repository: repo, branch: nextBranch }));
      setActiveContext((prev) => {
        const merged = mergeContext(prev, {
          ...prev,
          githubOwner: repo.split("/")[0] ?? null,
          githubRepo: repo.split("/")[1] ?? null,
          githubRepoUrl: `https://github.com/${repo}`,
          branch: nextBranch,
          updatedAt: new Date().toISOString(),
        } as ActiveContext);
        persistContext(merged);
        return merged;
      });
      if (activeProject) {
        const updated = { ...activeProject, repository: repo, branch: nextBranch, updated_at: new Date().toISOString() };
        setProjects(ProjectService.upsertLocal(updated));
      }
      sendToExtension(MSK_EVENTS.PANEL_REPOSITORY_SELECTED, { repository: repo, branch: nextBranch });
    },
    [activeProject],
  );

  /** Cola a URL do projeto (Lovable, preview ou domínio) → reflete no preview de verdade. */
  const connectProjectUrl = useCallback(
    (raw: string): string | null => {
      const input = raw.trim();
      if (!input) return null;
      let parsed: URL;
      try {
        parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
      } catch {
        return null;
      }
      const host = parsed.hostname;
      const lovableId =
        /lovable\.dev$/i.test(host) ? parsed.pathname.split("/").filter(Boolean).pop() ?? null : null;
      const previewUrl = lovableId
        ? `https://${lovableId}.lovableproject.com`
        : parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
      const name = lovableId ? `Projeto ${lovableId.slice(0, 8)}` : host;

      const project: MskProject = {
        id: uid(),
        lovable_project_id: lovableId,
        name,
        lovable_url: lovableId ? `https://lovable.dev/projects/${lovableId}` : null,
        preview_url: previewUrl,
        production_url: /lovable\.app$/i.test(host) ? parsed.origin : null,
        repository: activeProject?.repository ?? null,
        branch: activeProject?.branch ?? "main",
        updated_at: new Date().toISOString(),
      };
      const existing = projects.find(
        (p) => (lovableId && p.lovable_project_id === lovableId) || p.preview_url === previewUrl,
      );
      const finalProject = existing ? { ...existing, ...project, id: existing.id } : project;
      setProjects(ProjectService.upsertLocal(finalProject));
      setActiveId(finalProject.id);
      saveLocal("active_project_id", finalProject.id);
      setActiveContext((prev) => {
        const merged = mergeContext(prev, {
          ...prev,
          lovableProjectId: lovableId ?? prev.lovableProjectId,
          lovableProjectName: name,
          lovableUrl: finalProject.lovable_url,
          previewUrl,
          updatedAt: new Date().toISOString(),
        } as ActiveContext);
        persistContext(merged);
        return merged;
      });
      setPreviewKey((k) => k + 1);
      sendToExtension(MSK_EVENTS.PANEL_PROJECT_URL_SET, {
        projectId: finalProject.id,
        lovableProjectId: lovableId,
        previewUrl,
      });
      return previewUrl;
    },
    [activeProject, projects],
  );

  const value: MskState = {
    backendConfigured,
    backendError,
    session,
    projects,
    activeProject,
    setActiveProject,
    addLocalProject,
    messages,
    sendMessage,
    runs,
    activeRun,
    attachments,
    addFiles,
    removeAttachment,
    notifications,
    license,
    github,
    connectGithub,
    linkRepository,
    connectProjectUrl,
    extensionInstalled,
    tutorials,
    device,
    setDevice,
    zoom,
    setZoom,
    activeContext,
    syncStatus,
    resolution,
    preview,
    contextLoading,
    contextDismissed,
    registerContextProject,
    dismissContextProject,
    retrySync,
    previewStatus,
    previewKey,
    reloadPreview,
    loading,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
