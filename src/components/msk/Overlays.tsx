import { CheckCircle2, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMsk } from "@/lib/msk/provider";
import { NotificationService, PublishService, type PublishStage } from "@/lib/msk/services";
import { timeAgo } from "@/lib/msk/core";

/* ------------------------------ Drag & drop ------------------------------ */

export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-6">
      <div className="msk-glass msk-neon-ring flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <Upload className="msk-neon-text size-8" />
        <p className="text-sm font-semibold uppercase tracking-[0.18em]">
          Solte o arquivo para enviar ao MSK
        </p>
        <p className="text-xs text-muted-foreground">
          PNG · JPG · WEBP · SVG · PDF · TXT · JSON · ZIP
        </p>
      </div>
    </div>
  );
}

export function AttachmentReceipt({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[61] flex items-center justify-center p-6">
      <div className="msk-glass msk-neon-ring flex flex-col items-center gap-2 rounded-2xl px-8 py-6 text-center">
        <div className="msk-neon-ring flex size-10 items-center justify-center rounded-xl bg-surface-raised">
          <span className="msk-neon-text font-mono text-xs font-bold">MSK</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <CheckCircle2 className="size-4" /> Arquivo recebido com sucesso
        </p>
        <p className="max-w-[240px] truncate text-xs text-muted-foreground">{name}</p>
      </div>
    </div>
  );
}

/* ------------------------------ Notificações ----------------------------- */

export function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const { notifications, session, backendConfigured } = useMsk();
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-2xl">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Notificações
        </p>
        <button type="button" onClick={onClose} aria-label="Fechar">
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="msk-scroll max-h-72 overflow-y-auto">
        {!backendConfigured && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Notificações vêm do backend MSK — ainda não conectado.
          </p>
        )}
        {backendConfigured && notifications.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Nada por aqui.</p>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => void NotificationService.markRead(session.access_token, n.id)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-secondary"
          >
            <span
              className={`mt-1 size-1.5 shrink-0 rounded-full ${
                n.kind === "error"
                  ? "bg-destructive"
                  : n.kind === "warning"
                    ? "bg-warning"
                    : "bg-primary"
              }`}
            />
            <span className="min-w-0">
              <span className="block truncate text-xs">{n.title}</span>
              <span className="block text-[10px] text-muted-foreground">
                {timeAgo(n.created_at)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Publicar -------------------------------- */

const STAGES: { key: PublishStage; label: string }[] = [
  { key: "preparing", label: "Preparando" },
  { key: "syncing", label: "Sincronizando" },
  { key: "publishing", label: "Publicando" },
  { key: "verifying", label: "Verificando" },
  { key: "published", label: "Publicado" },
];

export function PublishModal({ onClose }: { onClose: () => void }) {
  const { activeProject, session, runs } = useMsk();
  const [stage, setStage] = useState<PublishStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const lastCommit = runs.find((r) => r.commit_sha)?.commit_sha ?? null;

  async function publish() {
    if (!activeProject) return;
    setError(null);
    setStage("preparing");
    try {
      setStage("syncing");
      const result = await PublishService.publish(session.access_token, activeProject.id);
      setStage("verifying");
      setUrl(result.url);
      setStage("published");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Falha ao publicar");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4">
      <div className="msk-glass w-full max-w-md rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Publicar projeto</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <dl className="space-y-2 text-xs">
          <Row label="Projeto" value={activeProject?.name ?? "—"} />
          <Row label="Branch" value={activeProject?.branch ?? "—"} />
          <Row label="Último commit" value={lastCommit ? lastCommit.slice(0, 7) : "—"} />
          <Row
            label="Status"
            value={stage === "idle" ? "Pronto para publicar" : (STAGES.find((s) => s.key === stage)?.label ?? "Erro")}
          />
        </dl>

        {stage !== "idle" && stage !== "error" && (
          <ol className="mt-4 space-y-1.5">
            {STAGES.map((s) => {
              const order = STAGES.findIndex((x) => x.key === s.key);
              const current = STAGES.findIndex((x) => x.key === stage);
              const done = current > order || stage === "published";
              return (
                <li key={s.key} className="flex items-center gap-2 text-xs">
                  {done ? (
                    <CheckCircle2 className="size-3.5 text-primary" />
                  ) : current === order ? (
                    <Loader2 className="size-3.5 animate-spin text-azure" />
                  ) : (
                    <span className="size-3.5 rounded-full border border-border" />
                  )}
                  <span className={done ? "text-foreground" : "text-muted-foreground"}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block truncate text-xs text-primary underline"
          >
            {url}
          </a>
        )}

        <button
          type="button"
          onClick={() => void publish()}
          disabled={stage !== "idle" && stage !== "error"}
          className="mt-5 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Publicar agora
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
