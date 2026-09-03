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
    ];
    return () => offs.forEach((off) => off());
  }, []);

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
    [activeProject, attachments, session.access_token],
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
