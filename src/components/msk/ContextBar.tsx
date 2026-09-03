import {
  Boxes,
  ExternalLink,
  GitBranch,
  Github,
  History,
  KeyRound,
  Loader2,
  Pin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useMsk } from "@/lib/msk/provider";
import { githubUrlFor, lovableUrlFor, type SyncState } from "@/lib/msk/active-context";

const TONE: Record<SyncState, string> = {
  ready: "bg-primary",
  syncing: "bg-yellow-400 animate-pulse",
  error: "bg-red-500",
  idle: "bg-muted-foreground/40",
};

function Row({ label, state, value }: { label: string; state: SyncState; value?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
      <span className={`size-1.5 rounded-full ${TONE[state]}`} />
      <span className="uppercase tracking-[0.12em]">{label}</span>
      {value && <span className="text-foreground">{value}</span>}
    </div>
  );
}

/** Barra de contexto ativo: sincronização extensão ↔ painel + atalhos rápidos. */
export function ContextBar({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const {
    activeProject,
    activeContext,
    syncStatus,
    resolution,
    contextLoading,
    contextDismissed,
    registerContextProject,
    dismissContextProject,
    retrySync,
    reloadPreview,
  } = useMsk();

  const lovable = lovableUrlFor(activeProject, activeContext);
  const github = githubUrlFor(activeProject, activeContext);
  const branch = activeProject?.branch ?? activeContext.branch ?? null;
  const repo =
    activeProject?.repository ??
    (activeContext.githubOwner && activeContext.githubRepo
      ? `${activeContext.githubOwner}/${activeContext.githubRepo}`
      : null);

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {contextLoading ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <Boxes className="size-3.5 text-primary" />
          )}
          <span className="truncate text-sm font-semibold text-foreground">
            {contextLoading
              ? "Conectando ao projeto..."
              : (activeProject?.name ?? activeContext.lovableProjectName ?? "Sem projeto ativo")}
          </span>
          {(activeProject?.lovable_project_id ?? activeContext.lovableProjectId) && (
            <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ID {(activeProject?.lovable_project_id ?? activeContext.lovableProjectId)!.slice(0, 8)}
            </span>
          )}
          {repo && (
            <span className="hidden shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
              <Github className="size-3" /> {repo}
            </span>
          )}
          {activeContext.pinned && (
            <span className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Pin className="size-3" /> fixado
            </span>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Row label="Extensão" state={syncStatus.extension} value={activeContext.extensionVersion} />
          <Row label="Projeto" state={contextLoading ? "syncing" : syncStatus.project} />
          <Row label="GitHub" state={syncStatus.github} value={repo} />
          {branch && <Row label="Branch" state="ready" value={branch} />}
          <Row
            label="IA"
            state={syncStatus.ai}
            value={
              activeContext.aiProvider
                ? `${activeContext.aiProvider}${activeContext.aiModel ? ` · ${activeContext.aiModel}` : ""}`
                : null
            }
          />
          <Row label="Preview" state={syncStatus.preview} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {lovable && (
            <a
              href={lovable}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Lovable <ExternalLink className="size-3" />
            </a>
          )}
          {github && (
            <a
              href={github}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Github className="size-3" /> GitHub
            </a>
          )}
          <button
            type="button"
            onClick={reloadPreview}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3" /> Preview
          </button>
          <button
            type="button"
            onClick={() => onOpenTab?.("historico")}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <History className="size-3" /> Histórico
          </button>
          <button
            type="button"
            onClick={() => onOpenTab?.("conexoes")}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="size-3" /> Cofre
          </button>
        </div>
      </div>

      {activeContext.activeSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-primary" />
          {activeContext.activeSkills.map((s) => (
            <span key={s} className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      {resolution.status === "ambiguous" && !ambiguityClosed && (
        <div className="relative rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 pr-7 text-[11px]">
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setAmbiguityClosed(true)}
            className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
          <p className="mb-1 text-foreground">
            Encontrei mais de uma configuração para este projeto. Selecione a correta:
          </p>
          <AmbiguityPicker hidden={hiddenCandidates} onHide={hideCandidate} />
        </div>
      )}


      {resolution.status === "unknown" && !contextDismissed && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-[11px]">
          <span className="text-foreground">
            Projeto novo detectado
            {activeContext.lovableProjectName ? `: ${activeContext.lovableProjectName}` : ""}
            {repo ? ` · ${repo}` : ""}
          </span>
          <button
            type="button"
            onClick={registerContextProject}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
          >
            Adicionar ao MSK
          </button>
          <button
            type="button"
            onClick={dismissContextProject}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
          >
            Não agora
          </button>
        </div>
      )}

      {syncStatus.project === "error" && resolution.status === "empty" && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px]">
          <span className="text-foreground">Não foi possível sincronizar o projeto ativo.</span>
          <button
            type="button"
            onClick={retrySync}
            className="rounded-md border border-border px-2 py-1 text-muted-foreground"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

function AmbiguityPicker() {
  const { resolution, setActiveProject } = useMsk();
  return (
    <div className="flex flex-wrap gap-1">
      {resolution.candidates.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setActiveProject(c.id)}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-foreground hover:bg-secondary"
        >
          {c.name}
          {c.branch && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="size-3" />
              {c.branch}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
