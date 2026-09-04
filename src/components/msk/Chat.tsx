import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  Square,
  Paperclip,
  RotateCcw,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import chatBgAsset from "@/assets/msk-chat-bg.png.asset.json";
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
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Transcrição por voz (ditado): o texto cai direto na caixa de comando,
  // com ondas de áudio reagindo ao volume da voz em tempo real.
  async function toggleDictation() {
    if (listening) {
      recRef.current?.stop();
      stopStream();
      return;
    }
    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Seu navegador não suporta transcrição por voz.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("É preciso liberar o microfone para transcrever por voz.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let base = "";
    rec.onstart = () => {
      base = text ? text.trim() + " " : "";
      setVoiceError(null);
      setListening(true);
    };
    rec.onresult = (event: any) => {
      let out = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        out += event.results[i][0].transcript;
      }
      setText((base + out).replace(/\s+/g, " ").trimStart());
      if (event.results[event.results.length - 1].isFinal) {
        base = (base + out).replace(/\s+/g, " ") + " ";
      }
    };
    rec.onerror = () => {
      setVoiceError("Não foi possível capturar o áudio. Verifique o microfone.");
      setListening(false);
      stopStream();
    };
    rec.onend = () => {
      setListening(false);
      stopStream();
    };
    recRef.current = rec;
    rec.start();
  }

  useEffect(
    () => () => {
      recRef.current?.stop?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

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
    <div className="relative flex min-h-0 flex-1 flex-col bg-violet-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${chatBgAsset.url})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/80 via-violet-950/90 to-violet-950/95" aria-hidden />
      <div className="msk-scroll relative flex-1 space-y-3 overflow-y-auto p-3 bg-transparent">
        {messages.length === 0 && !activeRun && !sending && (
          <div className="msk-panel bg-violet-900 border border-violet-800 p-4 text-xs text-violet-200">
            <p className="mb-2 font-medium text-violet-100">Peça uma alteração no seu projeto</p>
            <ul className="space-y-1">
              <li>"Mude o fundo da home para preto."</li>
              <li>"Coloque essa imagem no banner."</li>
              <li>"Corrija o erro deste print."</li>
              <li>"Crie uma nova página de planos."</li>
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-violet-800 text-violet-100"
                : "bg-violet-900 border border-violet-800 text-violet-200"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            {m.attachments && m.attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {m.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-1 rounded-md bg-violet-800/60 px-1.5 py-0.5 text-[10px] text-violet-300"
                  >
                    <FileText className="size-3" />
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[10px] text-violet-400">{timeAgo(m.created_at)}</p>
          </div>
        ))}

        {activeRun && <RunProgress run={activeRun} />}
        {runs
          .filter((r) => r.status === "error")
          .slice(0, 1)
          .map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-xs text-violet-400"
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

      {blocked && (
        <p className="border-t border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-400">
          Sua licença expirou. Nenhuma nova execução foi iniciada.{" "}
          <a href="https://msksystem.online/planos?renovar=1" className="underline underline-offset-4">
            RENOVAR
          </a>
        </p>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-t border-violet-800 bg-violet-950/50 px-3 py-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-1.5 rounded-lg bg-violet-900 border border-violet-800 px-2 py-1 text-[11px] text-violet-200"
            >
              <FileText className="size-3 text-violet-500" />
              <span className="max-w-[120px] truncate">{a.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-violet-400">
                {labelForStatus(a.status)}
              </span>
              <button type="button" onClick={() => removeAttachment(a.id)} aria-label="Remover">
                <X className="size-3 text-violet-500 hover:text-violet-300" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-violet-800 bg-violet-950 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-violet-800 bg-violet-900 p-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-violet-400 transition-colors hover:bg-violet-800 hover:text-violet-200"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) {
                await AttachmentService.uploadFiles(files, addFiles);
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              listening
                ? "bg-violet-600 text-violet-100 animate-pulse"
                : "text-violet-400 hover:bg-violet-800 hover:text-violet-200"
            }`}
            onClick={toggleDictation}
            aria-label={listening ? "Parar ditado" : "Iniciar ditado"}
          >
            <Mic className="size-4" />
          </button>
          {voiceError && (
            <p className="absolute -top-6 left-0 text-[10px] text-red-400">{voiceError}</p>
          )}
          <textarea
            className="msk-input flex-1 resize-none rounded-lg bg-violet-950/50 px-3 py-2 text-sm text-violet-100 placeholder-violet-500 outline-none"
            placeholder="Descreva o que deseja..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || sending}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-violet-100 transition-all hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelForStatus(status: string) {
  switch (status) {
    case "uploading":
      return "Enviando";
    case "processing":
      return "Processando";
    case "done":
      return "Pronto";
    case "error":
      return "Erro";
    default:
      return status;
  }
}

function RunProgress({ run }: { run: MskRun }) {
  return (
    <div className="rounded-xl border border-violet-800 bg-violet-900/80 p-3">
      <div className="flex items-center justify-between text-xs text-violet-300">
        <span className="flex items-center gap-1.5">
          {run.status === "running" && <Loader2 className="size-3.5 animate-spin text-violet-400" />}
          {run.status === "pending" && <CircleDashed className="size-3.5 animate-pulse text-violet-400" />}
          {run.status === "done" && <CheckCircle2 className="size-3.5 text-green-500" />}
          {run.status === "error" && <TriangleAlert className="size-3.5 text-red-400" />}
          <span className="font-medium capitalize">{run.status}</span>
        </span>
        <span className="text-violet-500">{timeAgo(run.created_at)}</span>
      </div>
      {run.steps && run.steps.length > 0 && (
        <ol className="mt-2 space-y-1">
          {run.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-violet-300">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-violet-500" />
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RunCard({ run }: { run: MskRun }) {
  const { openProject } = useMsk();
  return (
    <div className="rounded-xl border border-violet-800 bg-violet-900 p-3">
      <p className="mb-2 text-xs font-medium text-violet-200">Execução concluída</p>
      <div className="flex flex-wrap gap-2">
        {run.artifacts?.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => openProject(a.url)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-800 px-2 py-1 text-[11px] text-violet-200 transition-colors hover:bg-violet-700"
          >
            <ExternalLink className="size-3 text-violet-400" />
            {a.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => openProject()}
          className="flex items-center gap-1.5 rounded-lg bg-violet-800 px-2 py-1 text-[11px] text-violet-200 transition-colors hover:bg-violet-700"
        >
          <RotateCcw className="size-3 text-violet-400" />
          Recarregar
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-violet-800 px-2 py-1 text-[11px] text-violet-200 transition-colors hover:bg-violet-700"
        >
          <Square className="size-3 text-violet-400" />
          Encerrar
        </button>
      </div>
    </div>
  );
}