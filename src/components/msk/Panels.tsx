import {
  Boxes,
  FileText,
  Github,
  Globe,
  Plug,
  Plus,
  Search,
  Sparkles,
  Star,
  Youtube,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMsk } from "@/lib/msk/provider";
import { BrandingService, GitHubService } from "@/lib/msk/services";
import { formatRemaining, timeAgo, type MskProject } from "@/lib/msk/core";

/* ------------------------------- Projetos -------------------------------- */

const FILTERS = ["Todos", "Recentes", "Favoritos", "Lovable", "GitHub"] as const;
type Filter = (typeof FILTERS)[number];

export function ProjectsPanel() {
  const { projects, activeProject, setActiveProject, addLocalProject, backendConfigured } =
    useMsk();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("Todos");

  const list = useMemo(() => {
    let out = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (filter === "Favoritos") out = out.filter((p) => p.favorite);
    if (filter === "Lovable") out = out.filter((p) => Boolean(p.lovable_project_id));
    if (filter === "GitHub") out = out.filter((p) => Boolean(p.repository));
    if (filter === "Recentes") out = [...out].slice(0, 8);
    return out;
  }, [projects, q, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <div className="msk-panel flex items-center gap-2 px-2 py-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar projetos..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="msk-scroll flex-1 space-y-2 overflow-y-auto p-3">
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {backendConfigured
              ? "Nenhum projeto encontrado."
              : "Backend MSK não conectado — adicione um projeto localmente para trabalhar agora."}
          </p>
        )}
        {list.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            active={activeProject?.id === p.id}
            onSelect={() => setActiveProject(p.id)}
          />
        ))}
        <NewProjectForm onCreate={addLocalProject} />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  active,
  onSelect,
}: {
  project: MskProject;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`msk-panel w-full p-3 text-left transition-colors hover:border-primary/50 ${
        active ? "msk-neon-ring" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{project.name}</p>
        {project.favorite && <Star className="size-3.5 text-warning" />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
        <Tag ok={Boolean(project.lovable_project_id)} label="Lovable" />
        <Tag ok={Boolean(project.repository)} label="GitHub" />
        <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
          {project.branch ?? "—"}
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Editado {timeAgo(project.updated_at)}
      </p>
    </button>
  );
}

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 ${
        ok ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
      }`}
    >
      {ok ? `${label} conectado` : `${label} —`}
    </span>
  );
}

function NewProjectForm({
  onCreate,
}: {
  onCreate: (p: { name: string; lovable_project_id?: string | null; preview_url?: string | null; repository?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lovableId, setLovableId] = useState("");
  const [preview, setPreview] = useState("");
  const [repo, setRepo] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="msk-panel flex w-full items-center justify-center gap-1.5 p-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" /> Novo projeto
      </button>
    );
  }

  return (
    <div className="msk-panel space-y-2 p-3">
      <Field label="Nome" value={name} onChange={setName} placeholder="MSK System" />
      <Field
        label="Lovable project_id"
        value={lovableId}
        onChange={setLovableId}
        placeholder="b21ea21d-..."
      />
      <Field
        label="Preview URL"
        value={preview}
        onChange={setPreview}
        placeholder="https://projeto.lovable.app"
      />
      <Field label="Repositório" value={repo} onChange={setRepo} placeholder="usuario/repo" />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onCreate({
              name: name.trim(),
              lovable_project_id: lovableId.trim() || null,
              preview_url: preview.trim() || null,
              repository: repo.trim() || null,
            });
            setOpen(false);
            setName("");
            setLovableId("");
            setPreview("");
            setRepo("");
          }}
          className="flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
      />
    </label>
  );
}

/* -------------------------------- Histórico ------------------------------- */

export function HistoryPanel() {
  const { runs } = useMsk();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="msk-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {runs.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma execução para este projeto ainda.</p>
      )}
      {runs.map((r) => (
        <div key={r.id} className="msk-panel p-3">
          <button
            type="button"
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
            className="w-full text-left"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {new Date(r.created_at).toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 truncate text-sm">{r.request}</p>
            <p className="mt-1 text-[11px]">
              <span
                className={
                  r.status === "done"
                    ? "text-primary"
                    : r.status === "error"
                      ? "text-destructive"
                      : "text-azure"
                }
              >
                {r.status === "done"
                  ? "✓ Concluído"
                  : r.status === "error"
                    ? "Erro"
                    : "Em execução"}
              </span>
              {r.files && <span className="text-muted-foreground"> · {r.files.length} arquivos</span>}
              {r.commit_sha && (
                <span className="text-muted-foreground"> · Commit {r.commit_sha.slice(0, 7)}</span>
              )}
            </p>
          </button>
          {openId === r.id && (
            <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              <p>{r.summary ?? "Sem resumo enviado pelo backend."}</p>
              {r.files?.map((f) => (
                <p key={f} className="font-mono">
                  {f}
                </p>
              ))}
              {r.error && <p className="text-destructive">{r.error}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Anexos --------------------------------- */

export function FilesPanel() {
  const { attachments, addFiles } = useMsk();
  return (
    <div className="msk-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <label className="msk-panel flex cursor-pointer flex-col items-center gap-1 border-dashed p-6 text-center text-xs text-muted-foreground hover:border-primary/50">
        <FileText className="size-5" />
        Arraste arquivos para qualquer lugar do painel ou clique para selecionar
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {attachments.map((a) => (
        <div key={a.id} className="msk-panel flex items-center gap-2 p-2 text-xs">
          {a.data_url ? (
            <img src={a.data_url} alt={a.name} className="size-9 rounded object-cover" />
          ) : (
            <FileText className="size-4 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{a.name}</span>
            <span className="block text-[10px] text-muted-foreground">
              {(a.size / 1024).toFixed(0)} KB · {a.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Conexões -------------------------------- */

export function ConnectionsPanel() {
  const { github, activeProject, session, backendConfigured } = useMsk();
  const [brandingState, setBrandingState] = useState<string | null>(null);

  async function removeBranding() {
    if (!activeProject) return;
    setBrandingState("Identificando projeto...");
    try {
      const res = await BrandingService.removeWatermark(session.access_token, activeProject.id);
      setBrandingState(res.ok ? `Finalizado — ${res.file ?? "CSS global"}` : "Não aplicado");
    } catch (err) {
      setBrandingState(err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div className="msk-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3" id="conexoes">
      <ConnectionCard
        icon={<Github className="size-4" />}
        title="GitHub"
        status={github.connected ? "Conectado" : "Não conectado"}
        ok={github.connected}
        lines={[
          `Usuário: ${github.user ?? "—"}`,
          `Repositório: ${github.repository ?? activeProject?.repository ?? "—"}`,
          `Branch: ${github.branch ?? activeProject?.branch ?? "—"}`,
          `Último commit: ${github.last_commit ?? "—"}`,
        ]}
        action={
          github.connected
            ? undefined
            : { label: "Conectar GitHub (OAuth)", href: GitHubService.authorizeUrl() }
        }
      />
      <ConnectionCard
        icon={<Globe className="size-4" />}
        title="Lovable"
        status={activeProject?.lovable_project_id ? "Projeto vinculado" : "Sem projeto"}
        ok={Boolean(activeProject?.lovable_project_id)}
        lines={[
          `project_id: ${activeProject?.lovable_project_id ?? "—"}`,
          `Preview: ${activeProject?.preview_url ?? "—"}`,
          `Produção: ${activeProject?.production_url ?? "—"}`,
        ]}
      />
      <ConnectionCard
        icon={<Plug className="size-4" />}
        title="Backend MSK / Supabase"
        status={backendConfigured ? "Conectado" : "Não conectado"}
        ok={backendConfigured}
        lines={[
          backendConfigured
            ? "Conversa, execuções, licença e notificações vêm do backend."
            : "Conecte o projeto Supabase do MSK para ativar dados reais.",
        ]}
      />

      <div className="msk-panel p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-accent" /> Remover marca d'água
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Usa o project_id ativo e procura o CSS global entre {BrandingService.candidates.length}{" "}
          caminhos possíveis.
        </p>
        <button
          type="button"
          onClick={() => void removeBranding()}
          disabled={!activeProject}
          className="mt-2 w-full rounded-md bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
        >
          Remover marca
        </button>
        {brandingState && (
          <p className="mt-2 text-[11px] text-muted-foreground">{brandingState}</p>
        )}
      </div>
    </div>
  );
}

function ConnectionCard({
  icon,
  title,
  status,
  ok,
  lines,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  ok: boolean;
  lines: string[];
  action?: { label: string; href: string } | undefined;
}) {
  return (
    <div className="msk-panel p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </p>
        <span className={`text-[11px] ${ok ? "text-primary" : "text-muted-foreground"}`}>
          {ok ? "✓" : "○"} {status}
        </span>
      </div>
      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        {lines.map((l) => (
          <p key={l} className="truncate">
            {l}
          </p>
        ))}
      </div>
      {action && (
        <a
          href={action.href}
          className="mt-2 block rounded-md bg-secondary py-1.5 text-center text-xs hover:bg-secondary/80"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

/* --------------------------- Licença / uso / tutoriais -------------------- */

export function LicensePanel() {
  const { license, session, backendConfigured } = useMsk();
  const remaining = formatRemaining(license?.expires_at ?? null);
  const barColor =
    remaining.level === "green"
      ? "bg-primary"
      : remaining.level === "yellow"
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="msk-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div className="msk-panel p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plano atual</p>
        <p className="mt-1 text-sm font-medium">
          {license?.plan ?? (backendConfigured ? "Sem licença registrada" : "Backend não conectado")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tempo restante: <span className="text-foreground">{remaining.label}</span>
        </p>
        {license?.expires_at && (
          <p className="text-[11px] text-muted-foreground">
            Expira: {new Date(license.expires_at).toLocaleString("pt-BR")}
          </p>
        )}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.round(remaining.ratio * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Tempo calculado pela data de expiração do servidor.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Edições"
          value={
            license ? `${license.edits_used} / ${license.edits_limit ?? "∞"}` : "—"
          }
        />
        <Metric
          label="IA"
          value={license?.ai_spend != null ? `R$ ${license.ai_spend.toFixed(2)}` : "—"}
        />
        <Metric label="Arquivos enviados" value={license ? String(license.files_sent) : "—"} />
        <Metric label="Sessão" value={session.email ?? "—"} />
      </div>

      <TutorialsPanel />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="msk-panel p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

export function TutorialsPanel() {
  const { tutorials, backendConfigured } = useMsk();
  return (
    <div className="msk-panel p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Youtube className="size-4 text-destructive" /> Tutoriais
      </p>
      {!backendConfigured && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Os vídeos vêm de <code>tutorial_links</code> no backend MSK.
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {tutorials.map((t) => (
          <li key={t.id}>
            <a
              href={t.youtube_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-secondary"
            >
              <Boxes className="size-3.5 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
