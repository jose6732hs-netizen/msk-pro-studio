import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLicense } from "@/lib/msk/license-context";
import { useMsk } from "@/lib/msk/provider";
import { AttachmentService } from "@/lib/msk/services";
import { RUN_STEPS, timeAgo, type MskRun } from "@/lib/msk/core";

export function Chat() {
  const {
    activeProject,
    messages,
    sendMessage,
    runs,
    activeRun,
    attachments,
    addFiles,
    removeAttachment,
  } = useMsk();
  const { ensureActive } = useLicense();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, runs.length, activeRun?.status]);

  const lastFinished = useMemo(
    () => runs.find((r) => r.status === "done") ?? null,
    [runs],
  );

  async function submit() {
    if (!text.trim() || !activeProject) return;
    setSending(true);
    // Nova execução só começa com licença confirmada pelo SERVIDOR.
    if (!(await ensureActive())) {
      setBlocked(true);
      setSending(false);
      return;
    }
    setBlocked(false);
    const value = text;
    setText("");
    await sendMessage(value);
    setSending(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="msk-scroll flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !activeRun && (
          <div className="msk-panel p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Peça uma alteração no seu projeto</p>
            <ul className="space-y-1">
              <li>“Mude o fundo da home para preto.”</li>
              <li>“Coloque essa imagem no banner.”</li>
              <li>“Corrija o erro deste print.”</li>
              <li>“Crie uma nova página de planos.”</li>
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-secondary"
                : "msk-panel bg-surface"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            {m.attachments && m.attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {m.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <FileText className="size-3" />
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</p>
          </div>
        ))}

        {activeRun && <RunProgress run={activeRun} />}
        {runs
          .filter((r) => r.status === "error")
          .slice(0, 1)
          .map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong className="block">Execução não iniciada</strong>
                {r.error}
              </span>
            </div>
          ))}
        {lastFinished && <RunCard run={lastFinished} />}
        <div ref={endRef} />
      </div>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="msk-panel flex items-center gap-1.5 px-2 py-1 text-[11px]"
            >
              <FileText className="size-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate">{a.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-primary">
                {labelForStatus(a.status)}
              </span>
              <button type="button" onClick={() => removeAttachment(a.id)} aria-label="Remover">
                <X className="size-3 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border p-3">
        <div className="msk-panel flex items-end gap-2 p-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Anexar arquivo"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={AttachmentService.accept}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            placeholder="Peça uma alteração no seu projeto..."
            className="msk-scroll max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || !activeProject || sending}
            className="rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-40"
            aria-label="Enviar"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {!activeProject && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Selecione um projeto para conversar com o MSK Agente.
          </p>
        )}
      </div>
    </div>
  );
}

function labelForStatus(status: string) {
  const map: Record<string, string> = {
    received: "Recebido",
    reading: "Lendo",
    analyzed: "Analisado",
    ready: "Pronto",
    error: "Erro",
  };
  return map[status] ?? status;
}

export function RunProgress({ run }: { run: MskRun }) {
  const steps = run.steps.length ? run.steps : RUN_STEPS.map((s) => ({ ...s, status: "pending" as const }));
  return (
    <div className="msk-panel p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="msk-dot-pulse size-2 rounded-full bg-primary" />
        <span className="font-medium">MSK executando</span>
      </div>
      <ol className="space-y-1">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            {s.status === "done" ? (
              <CheckCircle2 className="size-3.5 text-primary" />
            ) : s.status === "running" ? (
              <Loader2 className="size-3.5 animate-spin text-azure" />
            ) : s.status === "error" ? (
              <TriangleAlert className="size-3.5 text-destructive" />
            ) : (
              <CircleDashed className="size-3.5 text-muted-foreground" />
            )}
            <span className={s.status === "pending" ? "text-muted-foreground" : ""}>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RunCard({ run }: { run: MskRun }) {
  const { reloadPreview } = useMsk();
  const [open, setOpen] = useState(false);
  return (
    <div className="msk-panel msk-neon-ring p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Concluído por MSK</p>
      <p className="mt-1 text-sm">{run.summary ?? run.request}</p>
      {run.files && run.files.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
          {(open ? run.files : run.files.slice(0, 3)).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <div>Repositório: {run.repository ?? "—"}</div>
        <div>Branch: {run.branch ?? "—"}</div>
        <div>Commit: {run.commit_sha ? run.commit_sha.slice(0, 7) : "—"}</div>
        <div>{timeAgo(run.created_at)}</div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SmallBtn onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar resumo" : "Ver resumo completo"}
        </SmallBtn>
        {run.commit_sha && run.repository && (
          <a
            href={`https://github.com/${run.repository}/commit/${run.commit_sha}`}
            target="_blank"
            rel="noreferrer"
            className="msk-panel flex items-center gap-1 px-2 py-1 text-[11px] hover:text-foreground"
          >
            <ExternalLink className="size-3" /> Ver commit
          </a>
        )}
        <SmallBtn onClick={reloadPreview}>Atualizar preview</SmallBtn>
        <SmallBtn onClick={() => undefined} disabled title="Disponível quando o backend expõe revert">
          <RotateCcw className="mr-1 inline size-3" /> Desfazer
        </SmallBtn>
      </div>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="msk-panel px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}
