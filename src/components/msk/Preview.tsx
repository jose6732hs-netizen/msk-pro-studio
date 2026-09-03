import { ExternalLink, Maximize2, Minus, Plus, RefreshCw, ScanLine } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { githubUrlFor, lovableUrlFor } from "@/lib/msk/active-context";
import { useMsk } from "@/lib/msk/provider";
import { PreviewService } from "@/lib/msk/services";
import { DEVICE_WIDTH } from "@/lib/msk/core";
import { StatusDot } from "./TopBar";

export function Preview() {
  const {
    activeProject,
    activeContext,
    preview,
    contextLoading,
    device,
    zoom,
    setZoom,
    previewStatus,
    previewKey,
    reloadPreview,
  } = useMsk();
  const frameRef = useRef<HTMLDivElement>(null);
  const url = preview.url ?? PreviewService.url(activeProject);
  const lovable = lovableUrlFor(activeProject, activeContext);
  const github = githubUrlFor(activeProject, activeContext);
  const width = DEVICE_WIDTH[device];

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Preview do projeto
        </p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <StatusDot status={previewStatus} />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Diminuir zoom" onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}>
            <Minus className="size-3.5" />
          </IconBtn>
          <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn label="Aumentar zoom" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
            <Plus className="size-3.5" />
          </IconBtn>
          <IconBtn label="100%" onClick={() => setZoom(1)}>
            <ScanLine className="size-3.5" />
          </IconBtn>
          <IconBtn
            label="Tela cheia"
            onClick={() => void frameRef.current?.requestFullscreen?.()}
          >
            <Maximize2 className="size-3.5" />
          </IconBtn>
          <IconBtn label="Recarregar preview" onClick={reloadPreview}>
            <RefreshCw className="size-3.5" />
          </IconBtn>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir preview em nova aba"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <div
        ref={frameRef}
        className="msk-scroll flex min-h-0 flex-1 items-stretch justify-center overflow-auto bg-background p-2"
      >
        {contextLoading ? (
          <EmptyState text="Conectando ao projeto ativo da extensão..." />
        ) : !activeProject && !url ? (
          <EmptyState text="Selecione um projeto para carregar o preview real." />
        ) : !url ? (
          <EmptyState
            text="Preview ainda não disponível para este projeto."
            actions={
              <>
                <ActionBtn onClick={reloadPreview}>Preparar preview</ActionBtn>
                {lovable && <ActionLink href={lovable}>Abrir Lovable</ActionLink>}
                {github && <ActionLink href={github}>Abrir repositório</ActionLink>}
              </>
            }
          />
        ) : (
          <div
            className="msk-panel h-full w-full overflow-hidden bg-surface shadow-lg"
            style={{
              width: width ? `${width}px` : "100%",
              maxWidth: "100%",
              height: "100%",
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          >
            <iframe
              key={`${previewKey}-${activeProject?.id ?? "ctx"}-${url}`}
              src={PreviewService.bust(url)}
              title={`Preview de ${activeProject.name}`}
              className="size-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function EmptyState({ text, actions }: { text: string; actions?: React.ReactNode }) {
  return (
    <div className="msk-panel flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 p-8">
      <p className="max-w-xs text-center text-sm text-muted-foreground">{text}</p>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

function ActionBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
    >
      {children}
    </button>
  );
}

function ActionLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {children}
    </a>
  );
}
