import { useState } from "react";
import {
  ExternalLink,
  Github,
  Globe,
  Laptop,
  Minus,
  Plus,
  RefreshCw,
  ScanLine,
  Smartphone,
  Tablet,
} from "lucide-react";
import type React from "react";
import { useMsk } from "@/lib/msk/provider";
import { githubUrlFor, lovableUrlFor } from "@/lib/msk/active-context";
import { PreviewService } from "@/lib/msk/services";
import type { Device } from "@/lib/msk/core";

const DEVICES: { key: Device; label: string; Icon: typeof Laptop }[] = [
  { key: "desktop", label: "Desktop", Icon: Laptop },
  { key: "tablet", label: "Tablet", Icon: Tablet },
  { key: "mobile", label: "Mobile", Icon: Smartphone },
];

export function PreviewSettingsPanel() {
  const {
    activeProject,
    activeContext,
    preview,
    device,
    setDevice,
    zoom,
    setZoom,
    reloadPreview,
    connectProjectUrl,
  } = useMsk();
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const url = preview.url ?? PreviewService.url(activeProject);
  const lovable = lovableUrlFor(activeProject, activeContext);
  const github = githubUrlFor(activeProject, activeContext);
  const production = activeProject?.production_url ?? activeContext.productionUrl ?? null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const done = Boolean(connectProjectUrl(urlInput));
    setError(done ? null : "URL inválida");
    setOk(done);
    if (done) setUrlInput("");
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <Section title="Dispositivo">
        <div className="grid grid-cols-3 gap-1">
          {DEVICES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                device === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Zoom">
        <div className="flex items-center gap-2">
          <IconBtn label="Diminuir" onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}>
            <Minus className="size-3.5" />
          </IconBtn>
          <span className="w-12 text-center font-mono text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn label="Aumentar" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
            <Plus className="size-3.5" />
          </IconBtn>
          <IconBtn label="100%" onClick={() => setZoom(1)}>
            <ScanLine className="size-3.5" />
          </IconBtn>
          <button
            type="button"
            onClick={reloadPreview}
            className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3" /> Recarregar
          </button>
        </div>
      </Section>

      <Section title="URL do projeto">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setOk(false);
              setError(null);
            }}
            placeholder="https://lovable.dev/projects/... ou https://seusite.lovable.app"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-primary"
          />
          {error && <p className="text-[10px] text-destructive">{error}</p>}
          {ok && <p className="text-[10px] text-primary">Projeto refletido no preview.</p>}
          <button
            type="submit"
            className="rounded-md bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Refletir no preview
          </button>
        </form>
      </Section>

      <Section title="Atalhos">
        <div className="flex flex-col gap-1">
          {url && (
            <LinkRow href={url} Icon={ExternalLink}>
              Abrir preview em nova aba
            </LinkRow>
          )}
          {production && (
            <LinkRow href={production} Icon={Globe}>
              Ver projeto no ar
            </LinkRow>
          )}
          {lovable && (
            <LinkRow href={lovable} Icon={ExternalLink}>
              Abrir no Lovable
            </LinkRow>
          )}
          {github && (
            <LinkRow href={github} Icon={Github}>
              Abrir repositório
            </LinkRow>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="msk-panel flex flex-col gap-2 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {children}
    </div>
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
      className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function LinkRow({
  href,
  Icon,
  children,
}: {
  href: string;
  Icon: typeof Globe;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-3.5 text-primary" />
      <span className="truncate">{children}</span>
    </a>
  );
}
