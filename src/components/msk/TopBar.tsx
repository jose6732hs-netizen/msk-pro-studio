import {
  Bell,
  GitBranch,
  Github,
  Loader2,
  Monitor,
  Puzzle,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useState } from "react";
import mskLogo from "@/assets/msk-logo.png.asset.json";
import { useMsk } from "@/lib/msk/provider";
import { NotificationsPopover } from "./Overlays";
import { LicenseCountdown } from "./License";
import type { Device } from "@/lib/msk/core";
import { useExtensionBridge } from "@/lib/msk/use-bridge";

const DEVICES: { key: Device; label: string; Icon: typeof Monitor }[] = [
  { key: "desktop", label: "Desktop", Icon: Monitor },
  { key: "tablet", label: "Tablet", Icon: Tablet },
  { key: "mobile", label: "Mobile", Icon: Smartphone },
];

export function TopBar({ onPublish }: { onPublish: () => void }) {
  const {
    activeProject,
    github,
    connectGithub,
    device,
    setDevice,
    previewStatus,
    reloadPreview,
    notifications,
  } = useMsk();
  const { ensureActive } = useLicense();
  const [bellOpen, setBellOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shared, setShared] = useState(false);

  async function handleShare() {
    const url =
      activeProject?.preview_url ?? activeProject?.lovable_url ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: activeProject?.name ?? "MSK", url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      /* cancelado pelo usuário */
    }
  }

  // Operação sensível: revalida a licença no SERVIDOR antes de publicar.
  async function handlePublish() {
    setPublishing(true);
    try {
      if (await ensureActive()) onPublish();
    } finally {
      setPublishing(false);
    }
  }
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="msk-glass sticky top-0 z-40 flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 md:px-3">
      <div className="flex items-center gap-2">
        <img
          src={mskLogo.url}
          alt="MSK Agente"
          className="msk-neon-ring size-7 rounded-full bg-background object-contain"
        />
        
        <div className="leading-tight">
          <p className="text-xs font-semibold tracking-tight">MSK AGENTE</p>
          <p className="hidden text-[9px] uppercase tracking-[0.18em] text-muted-foreground lg:block">
            Painel profissional
          </p>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">
          {activeProject ? activeProject.name : "Nenhum projeto selecionado"}
        </p>
        <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          <GitBranch className="size-3" />
          {activeProject?.branch ?? "—"}
          <span className="mx-1">·</span>
          <StatusDot status={previewStatus} />
        </p>
      </div>

      <div className="msk-panel hidden items-center gap-0.5 p-0.5 sm:flex">
        {DEVICES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDevice(key)}
            aria-pressed={device === key}
            title={label}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
              device === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={reloadPreview}
        className="msk-panel flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        title="Atualizar preview"
      >
        {previewStatus === "updating" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw
            className={`size-3.5 ${previewStatus === "update-available" ? "text-primary" : ""}`}
          />
        )}
        <span className="hidden lg:inline">Atualizar</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (github.connected) {
            document.getElementById("conexoes")?.scrollIntoView({ behavior: "smooth" });
            return;
          }
          connectGithub();
        }}
        className="msk-panel flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors hover:text-foreground"
        title={
          github.connected
            ? `GitHub: ${github.repository ?? github.user ?? "conectado"}`
            : "Conectar GitHub (mesmo fluxo da extensão)"
        }
      >
        <Github className="size-3.5" />
        <span className={github.connected ? "text-primary" : "text-muted-foreground"}>
          {github.connected ? github.repository ?? "Conectado" : "Conectar GitHub"}
        </span>
      </button>


      <ExtensionBadge />

      <LicenseCountdown />


      <div className="relative">
        <button
          type="button"
          onClick={() => setBellOpen((v) => !v)}
          className="msk-panel relative flex items-center px-2 py-1 text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="size-3.5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
        {bellOpen && <NotificationsPopover onClose={() => setBellOpen(false)} />}
      </div>

    </header>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    synced: { label: "Preview sincronizado", cls: "bg-primary" },
    "update-available": { label: "Atualização disponível", cls: "bg-warning" },
    updating: { label: "Atualizando", cls: "bg-azure", pulse: true },
    error: { label: "Erro no preview", cls: "bg-destructive" },
    empty: { label: "Sem preview", cls: "bg-muted-foreground" },
  };
  const item = map[status] ?? map["empty"]!;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${item.cls} ${item.pulse ? "msk-dot-pulse" : ""}`} />
      {item.label}
    </span>
  );
}

/** Status da extensão MSK detectada via MSK Bridge (handshake seguro). */
function ExtensionBadge() {
  const ext = useExtensionBridge();
  const label = ext.checking
    ? "Verificando…"
    : ext.installed
      ? `Extensão v${ext.extensionVersion ?? "?"}`
      : "Extensão não detectada";
  const tone = ext.checking
    ? "text-muted-foreground"
    : ext.installed
      ? ext.compatible
        ? "text-primary"
        : "text-destructive"
      : "text-muted-foreground";
  return (
    <span
      className="msk-panel hidden items-center gap-1.5 px-2.5 py-1.5 text-xs sm:flex"
      title={
        ext.installed
          ? ext.compatible
            ? `MSK Extension conectada${ext.activeLovableProjectId ? ` · projeto ${ext.activeLovableProjectId}` : ""}`
            : "Sua extensão MSK precisa ser atualizada."
          : "Extensão MSK não detectada neste navegador."
      }
    >
      <Puzzle className="size-3.5" />
      <span className={tone}>{label}</span>
    </span>
  );
}
