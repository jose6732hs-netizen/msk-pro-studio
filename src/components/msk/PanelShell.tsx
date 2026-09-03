import { useCallback, useEffect, useState } from "react";
import {
  FolderGit2,
  History,
  Link2,
  MessageSquare,
  MonitorSmartphone,
  PanelLeftOpen,
  PanelRightOpen,
  Paperclip,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

import { MskProvider, useMsk } from "@/lib/msk/provider";
import { TopBar } from "./TopBar";
import { ContextBar } from "./ContextBar";
import { Preview } from "./Preview";
import { PreviewSettingsPanel } from "./PreviewSettings";
import { Chat } from "./Chat";
import {
  ConnectionsPanel,
  FilesPanel,
  HistoryPanel,
  LicensePanel,
  ProjectsPanel,
  TutorialsPanel,
} from "./Panels";
import { DropOverlay, PublishModal } from "./Overlays";
import mskLogo from "@/assets/msk-logo.png.asset.json";

type TabKey =
  | "chat"
  | "projetos"
  | "historico"
  | "arquivos"
  | "preview"
  | "conexoes"
  | "licenca"
  | "tutoriais";

const TABS: { key: TabKey; label: string; Icon: typeof MessageSquare }[] = [
  { key: "chat", label: "Chat", Icon: MessageSquare },
  { key: "projetos", label: "Projetos", Icon: FolderGit2 },
  { key: "historico", label: "Histórico", Icon: History },
  { key: "arquivos", label: "Arquivos", Icon: Paperclip },
  { key: "preview", label: "Preview", Icon: MonitorSmartphone },
  { key: "conexoes", label: "Conexões", Icon: Link2 },
  { key: "licenca", label: "Licença", Icon: ShieldCheck },
  { key: "tutoriais", label: "Tutoriais", Icon: GraduationCap },
];

export function MskPanel() {
  return (
    <MskProvider>
      <PanelInner />
    </MskProvider>
  );
}

function PanelInner() {
  const { addFiles, backendConfigured, backendError } = useMsk();
  const [tab, setTab] = useState<TabKey>("chat");
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(380);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("msk.panel.chatWidth"));
    if (Number.isFinite(saved) && saved >= 320) setWidth(Math.min(saved, 900));
    setCollapsed(window.localStorage.getItem("msk.panel.chatCollapsed") === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("msk.panel.chatWidth", String(width));
    window.localStorage.setItem("msk.panel.chatCollapsed", collapsed ? "1" : "0");
  }, [width, collapsed]);

  const [resizing, setResizing] = useState(false);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    let last = 420;
    const onMove = (e: PointerEvent) => {
      const raw = window.innerWidth - e.clientX;
      const max = Math.max(360, Math.min(900, window.innerWidth - 320));
      if (raw < 220) {
        // arrastou para a borda direita: recolhe o chat
        setCollapsed(true);
        return;
      }
      setCollapsed(false);
      last = Math.min(Math.max(raw, 320), max);
      setWidth(last);
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);


  const onDrop = useCallback(
    (event: Event) => {
      const e = event as globalThis.DragEvent;
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  useEffect(() => {
    const onOver = (event: Event) => {
      event.preventDefault();
      setDragging(true);
    };
    const onLeave = (event: Event) => {
      const e = event as globalThis.DragEvent;
      if (!e.relatedTarget) setDragging(false);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onDrop]);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar onPublish={() => setPublishing(true)} />

      {!backendConfigured && (
        <div className="border-b border-border bg-surface px-4 py-2 text-center text-xs text-muted-foreground">
          {backendError ?? "Backend MSK não conectado"} — as integrações aparecem como “não
          conectado” até a configuração real.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Preview limpo: só a barra fina + o projeto, sem cards em cima. */}
          <Preview />
        </main>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar chat"
          onPointerDown={startResize}
          onDoubleClick={() => {
            setCollapsed(false);
            setWidth(420);
          }}
          className={`group order-2 hidden w-2 shrink-0 cursor-col-resize items-center justify-center transition-colors lg:flex ${
            resizing ? "bg-primary" : "bg-border hover:bg-primary/70"
          }`}
        >
          <span className="h-10 w-0.5 rounded-full bg-foreground/30 group-hover:bg-primary-foreground/60" />
        </div>

        <aside
          className={`msk-scroll order-3 hidden shrink-0 flex-col border-l border-border bg-sidebar lg:flex ${
            resizing ? "" : "transition-[width] duration-200 ease-out"
          }`}
          style={{ width: collapsed ? 52 : width }}
        >
          <div className="flex items-center gap-1 border-b border-border p-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expandir chat" : "Recolher chat"}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </button>
            {!collapsed && (
              <nav className="flex flex-wrap gap-1">
                {TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      tab === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </nav>
            )}
          </div>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 p-1">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => {
                    setTab(key);
                    setCollapsed(false);
                  }}
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          ) : (
            <div className="msk-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
              <TabContent tab={tab} />
            </div>
          )}
        </aside>

        <div className="msk-scroll order-4 min-h-0 border-t border-border lg:hidden">
          <nav className="msk-scroll flex gap-1 overflow-x-auto border-b border-border p-2">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  tab === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex min-h-[60vh] flex-col p-3">
            <TabContent tab={tab} />
          </div>
        </div>
      </div>


      <footer className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        <img src={mskLogo.url} alt="" className="size-5 rounded-full" />
        MSK AGENTE · Painel Profissional
      </footer>

      <DropOverlay visible={dragging} />
      {publishing && <PublishModal onClose={() => setPublishing(false)} />}
    </div>
  );
}

function TabContent({ tab }: { tab: TabKey }) {
  switch (tab) {
    case "chat":
      return <Chat />;
    case "projetos":
      return <ProjectsPanel />;
    case "historico":
      return <HistoryPanel />;
    case "arquivos":
      return <FilesPanel />;
    case "preview":
      return <PreviewSettingsPanel />;
    case "conexoes":
      return <ConnectionsPanel />;
    case "licenca":
      return <LicensePanel />;
    case "tutoriais":
      return <TutorialsPanel />;
    default:
      return null;
  }
}
