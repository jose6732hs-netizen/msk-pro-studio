import { useCallback, useEffect, useState } from "react";
import {
  FolderGit2,
  History,
  Link2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { MskProvider, useMsk } from "@/lib/msk/provider";
import { TopBar } from "./TopBar";
import { Preview } from "./Preview";
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
  | "conexoes"
  | "licenca"
  | "tutoriais";

const TABS: { key: TabKey; label: string; Icon: typeof MessageSquare }[] = [
  { key: "chat", label: "Chat", Icon: MessageSquare },
  { key: "projetos", label: "Projetos", Icon: FolderGit2 },
  { key: "historico", label: "Histórico", Icon: History },
  { key: "arquivos", label: "Arquivos", Icon: Paperclip },
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar onPublish={() => setPublishing(true)} />

      {!backendConfigured && (
        <div className="border-b border-border bg-surface px-4 py-2 text-center text-xs text-muted-foreground">
          {backendError ?? "Backend MSK não conectado"} — as integrações aparecem como “não
          conectado” até a configuração real.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="msk-scroll hidden w-[380px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <nav className="flex flex-wrap gap-1 border-b border-border p-2">
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
          <div className="msk-scroll min-h-0 flex-1 overflow-y-auto">
            <TabContent tab={tab} />
          </div>
        </aside>

        <main className="min-h-0 flex-1 p-3 md:p-4">
          <Preview />
        </main>

        <div className="msk-scroll min-h-0 border-t border-border lg:hidden">
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
          <div className="p-3">
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
