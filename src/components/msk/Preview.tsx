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
    previewStatus,
    previewKey,
    reloadPreview,
  } = useMsk();
  const frameRef = useRef<HTMLDivElement>(null);
  const url = preview.url ?? PreviewService.url(activeProject);
  const lovable = lovableUrlFor(activeProject, activeContext);
  const github = githubUrlFor(activeProject, activeContext);
  const width = DEVICE_WIDTH[device];
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
          {device === "mobile" ? "iPhone 17" : device === "tablet" ? "Tablet" : "MacBook"}
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
        className="msk-scroll flex min-h-0 flex-1 items-stretch justify-center overflow-auto bg-background"
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
        ) : (
          <DeviceMockup device={device} width={width} zoom={zoom}>
            <iframe
              key={`${previewKey}-${activeProject?.id ?? "ctx"}-${url}`}
              src={PreviewService.bust(fullUrl ?? url)}
              title={`Preview de ${activeProject?.name ?? activeContext.lovableProjectName ?? "projeto ativo"}`}
              className="size-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </DeviceMockup>
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
  width,
  zoom,
  children,
}: {
  device: "desktop" | "tablet" | "mobile";
  width: number | null;
  zoom: number;
  children: React.ReactNode;
}) {
  const scale = { transform: `scale(${zoom})`, transformOrigin: "top center" } as const;

  if (device === "mobile") {
    /* iPhone — moldura reta e fina, vermelho sangue, câmera discreta. */
    const w = width ?? 390;
    return (
      <div style={scale} className="flex h-full items-center justify-center px-2">
        <div
          className="relative h-full max-h-full"
          style={{ width: `${w + 18}px`, maxWidth: "100%", aspectRatio: `${w + 18} / 900` }}
        >
          {/* Botões laterais */}
          <span className="absolute -left-[2px] top-[18%] h-6 w-[2px] rounded-l bg-[#4a060b]" />
          <span className="absolute -left-[2px] top-[26%] h-10 w-[2px] rounded-l bg-[#4a060b]" />
          <span className="absolute -left-[2px] top-[38%] h-10 w-[2px] rounded-l bg-[#4a060b]" />
          <span className="absolute -right-[2px] top-[30%] h-14 w-[2px] rounded-r bg-[#4a060b]" />
          {/* Moldura vermelho sangue */}
          <div
            className="h-full rounded-[48px] p-[2.5px] shadow-[0_24px_60px_-20px_rgba(120,0,10,0.65)]"
            style={{
              background:
                "linear-gradient(160deg,#d92b33 0%,#7c0910 30%,#4a040a 55%,#7c0910 80%,#d92b33 100%)",
            }}
          >
            <div className="h-full rounded-[46px] bg-[#1a0204] p-[7px]">
              <div className="relative size-full overflow-hidden rounded-[39px] bg-black">
                {/* Câmera frontal — furo discreto centralizado */}
                <span className="pointer-events-none absolute left-1/2 top-[12px] z-10 size-[14px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10">
                  <span className="absolute inset-[4px] rounded-full bg-[#12284a]" />
                </span>
                <div className="size-full">{children}</div>
                {/* Barra de gestos */}
                <span className="pointer-events-none absolute bottom-[7px] left-1/2 h-[4px] w-28 -translate-x-1/2 rounded-full bg-white/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (device === "tablet") {
    return (
      <div style={scale} className="flex h-full items-start justify-center py-2">
        <div
          className="h-full rounded-[28px] bg-neutral-900 p-[14px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
          style={{ width: `${(width ?? 768) + 28}px`, maxWidth: "100%" }}
        >
          <div className="relative size-full overflow-hidden rounded-[16px] bg-black">
            <span className="absolute left-1/2 top-[5px] z-10 size-[6px] -translate-x-1/2 rounded-full bg-neutral-700" />
            <div className="size-full">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop — preview 100%, sem moldura: o site ocupa a tela inteira.
  return (
    <div style={scale} className="size-full">
      <div className="size-full overflow-hidden bg-black">{children}</div>
    </div>
  );
}
