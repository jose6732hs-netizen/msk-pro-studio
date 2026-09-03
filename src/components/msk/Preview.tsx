import {
  ExternalLink,
  Maximize2,
  ChevronDown,
  RefreshCw,
  Route,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { discoverProjectRoutes } from "@/lib/msk/routes.functions";
import { loadLocal, saveLocal } from "@/lib/msk/core";
import { githubUrlFor, lovableUrlFor } from "@/lib/msk/active-context";
import { useMsk } from "@/lib/msk/provider";
import { PreviewService } from "@/lib/msk/services";
import { StatusDot } from "./TopBar";

export function Preview() {
  const {
    activeProject,
    activeContext,
    preview,
    contextLoading,
    device,
    zoom,
    previewStatus,
    previewKey,
    reloadPreview,
  } = useMsk();
  const frameRef = useRef<HTMLDivElement>(null);
  const url = preview.url ?? PreviewService.url(activeProject);
  const lovable = lovableUrlFor(activeProject, activeContext);
  const github = githubUrlFor(activeProject, activeContext);
  const production = activeProject?.production_url ?? activeContext.productionUrl ?? null;

  /* ETAPAS DO SITE — descobertas do projeto real; nada é pré-definido. */
  const projectKey = activeProject?.id ?? activeContext.lovableProjectId ?? null;
  const routeKey = `routes:${projectKey ?? "none"}`;
  const [routes, setRoutes] = useState<string[]>([]);
  const [path, setPath] = useState("/");
  const [newRoute, setNewRoute] = useState("");
  const [routesOpen, setRoutesOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const discover = useServerFn(discoverProjectRoutes);

  useEffect(() => {
    setPath("/");
    setRoutesOpen(false);
    if (!projectKey) {
      setRoutes([]);
      return;
    }
    setRoutes(loadLocal<string[]>(routeKey, []));
  }, [projectKey, routeKey]);

  const applyRoutes = (next: string[]) => {
    const unique = Array.from(new Set(next.map(normalizePath)));
    setRoutes(unique);
    saveLocal(routeKey, unique);
  };

  // Identificou o projeto e tem preview: lê as rotas reais (sitemap/links).
  useEffect(() => {
    if (!projectKey || !url) return;
    if (loadLocal<string[]>(routeKey, []).length) return;
    let alive = true;
    setScanning(true);
    void discover({ data: { url } })
      .then((res) => {
        if (!alive) return;
        const found = (res as { routes: string[] }).routes ?? [];
        if (found.length) applyRoutes(found);
      })
      .catch(() => undefined)
      .finally(() => alive && setScanning(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, url, routeKey]);

  const fullUrl = useMemo(() => (url ? joinPath(url, path) : null), [url, path]);
  // Gera o cache-buster somente quando a URL muda ou o usuário pede recarga.
  // Antes, Date.now() era executado em todo render e fazia o iframe piscar.
  const iframeUrl = useMemo(
    () => (fullUrl ? PreviewService.bust(fullUrl) : null),
    [fullUrl, previewKey],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Barra fina única sobre o projeto: só status, etapa e ações essenciais. */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <StatusDot status={previewStatus} />
        {projectKey && (
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setRoutesOpen((v) => !v)}
              title="Etapas do site identificadas no projeto"
              className="flex max-w-[220px] items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-secondary"
            >
              <Route className="size-3 shrink-0 text-primary" />
              <span className="truncate">{path}</span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
            </button>
            {routesOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar etapas"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setRoutesOpen(false)}
                />
                <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl border border-border bg-surface p-2 shadow-2xl">
                  <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {scanning ? "Lendo etapas do projeto…" : "Etapas do site"}
                  </p>
                  <div className="msk-scroll max-h-56 overflow-y-auto">
                    {!routes.length && !scanning && (
                      <p className="px-1 py-2 text-[11px] text-muted-foreground">
                        Nenhuma etapa identificada ainda.
                      </p>
                    )}
                    {routes.map((r) => (
                      <span
                        key={r}
                        className={`group flex items-center justify-between gap-1 rounded-md px-2 py-1 text-[11px] ${
                          path === r ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left font-mono"
                          onClick={() => {
                            setPath(r);
                            setRoutesOpen(false);
                          }}
                        >
                          {r}
                        </button>
                        {r !== "/" && (
                          <button
                            type="button"
                            aria-label={`Remover ${r}`}
                            onClick={() => applyRoutes(routes.filter((x) => x !== r))}
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <form
                    className="mt-1 border-t border-border pt-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newRoute.trim()) return;
                      const value = normalizePath(newRoute);
                      applyRoutes([...routes, value]);
                      setPath(value);
                      setNewRoute("");
                      setRoutesOpen(false);
                    }}
                  >
                    <input
                      value={newRoute}
                      onChange={(e) => setNewRoute(e.target.value)}
                      placeholder="/nova-etapa"
                      aria-label="Adicionar etapa do projeto"
                      className="w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                  </form>
                </div>
              </>
            )}
          </div>
        )}
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {device === "mobile" ? "Mobile" : device === "tablet" ? "Tablet" : "Desktop"}
        </span>
        <IconBtn label="Recarregar preview" onClick={reloadPreview}>
          <RefreshCw className="size-3.5" />
        </IconBtn>
        <IconBtn
          label="Tela cheia"
          onClick={() => void frameRef.current?.requestFullscreen?.()}
        >
          <Maximize2 className="size-3.5" />
        </IconBtn>
        {url && (
          <a
            href={fullUrl ?? url}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir preview em nova aba"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div
        ref={frameRef}
        className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden bg-background"
      >
        {contextLoading ? (
          <EmptyState text="Conectando ao projeto ativo da extensão..." />
        ) : !activeProject && !url ? (
          <EmptyState text="Selecione um projeto na extensão ou cole a URL do projeto na aba Preview (painel lateral)." />
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
        ) : iframeUrl ? (
          <DeviceMockup device={device} zoom={zoom}>
            <iframe
              key={`${previewKey}-${activeProject?.id ?? "ctx"}-${fullUrl}`}
              src={iframeUrl}
              title={`Preview de ${activeProject?.name ?? activeContext.lovableProjectName ?? "projeto ativo"}`}
              className="size-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </DeviceMockup>
        ) : null}
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

function normalizePath(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "");
  if (!trimmed || trimmed === "/") return "/";
  return ("/" + trimmed.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
}

function joinPath(base: string, path: string): string {
  try {
    const u = new URL(base);
    u.pathname = path === "/" ? "/" : path;
    return u.toString();
  } catch {
    return base;
  }
}

function DeviceMockup({
  device,
  zoom,
  children,
}: {
  device: "desktop" | "tablet" | "mobile";
  zoom: number;
  children: React.ReactNode;
}) {
  const scale = { transform: `scale(${zoom})`, transformOrigin: "top center" } as const;
  const mobile = device === "mobile";
  const tablet = device === "tablet";

  // A árvore do iframe permanece idêntica nos três modos. Assim, trocar o
  // dispositivo só muda o enquadramento e não desmonta/recarrega o site.
  return (
    <div
      style={scale}
      className={`flex size-full items-center justify-center overflow-hidden ${
        device === "desktop" ? "p-0" : "p-2"
      }`}
    >
      <div
        className={`relative shrink-0 ${
          mobile
            ? "aspect-[11.6/19.2] h-full max-w-full"
            : tablet
              ? "aspect-[3/4] h-full max-w-full"
              : "size-full"
        }`}
      >
        <span className={`${mobile ? "block" : "hidden"} absolute -left-[3px] top-[16%] h-7 w-[3px] rounded-l bg-[#5a070d]`} />
        <span className={`${mobile ? "block" : "hidden"} absolute -left-[3px] top-[25%] h-11 w-[3px] rounded-l bg-[#5a070d]`} />
        <span className={`${mobile ? "block" : "hidden"} absolute -left-[3px] top-[37%] h-11 w-[3px] rounded-l bg-[#5a070d]`} />
        <span className={`${mobile ? "block" : "hidden"} absolute -right-[3px] top-[29%] h-16 w-[3px] rounded-r bg-[#5a070d]`} />
        <div
          className={`size-full overflow-hidden ${
            mobile
              ? "rounded-[46px] bg-gradient-to-br from-[#d92b33] via-[#4a040a] to-[#d92b33] p-[5px] shadow-[0_24px_60px_-20px_rgba(120,0,10,0.65)]"
              : tablet
                ? "rounded-[28px] bg-neutral-900 p-[12px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
                : "bg-black"
          }`}
        >
          <div
            className={`relative size-full overflow-hidden bg-black ${
              mobile ? "rounded-[39px] border-[8px] border-[#1a0204]" : tablet ? "rounded-[17px]" : ""
            }`}
          >
            <span className={`${mobile ? "flex" : "hidden"} pointer-events-none absolute left-1/2 top-[8px] z-10 h-[24px] w-[88px] -translate-x-1/2 items-center justify-start rounded-full bg-black pl-[7px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]`}>
              <span className="relative size-[13px] rounded-full bg-[#0b0f1a] ring-1 ring-white/15">
                <span className="absolute inset-[3px] rounded-full bg-[#12284a]" />
                <span className="absolute left-[2px] top-[1px] size-[3px] rounded-full bg-white/70" />
              </span>
            </span>
            <span className={`${tablet ? "block" : "hidden"} pointer-events-none absolute left-1/2 top-[4px] z-10 size-[6px] -translate-x-1/2 rounded-full bg-neutral-700`} />
            <div className="size-full overflow-hidden">{children}</div>
            <span className={`${mobile ? "block" : "hidden"} pointer-events-none absolute bottom-[5px] left-1/2 h-[4px] w-24 -translate-x-1/2 rounded-full bg-white/60`} />
          </div>
        </div>
      </div>
    </div>
  );
}
