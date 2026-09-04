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

function labelForStatus(s: string) {
  if (s === "uploading") return "enviando";
  if (s === "done") return "pronto";
  if (s === "error") return "erro";
  return s;
}

function RunProgress({ run }: { run: MskRun }) {
  const step = RUN_STEPS[run.step] ?? run.step;
  const pct = useMemo(() => {
    if (run.status === "done") return 100;
    if (run.status === "error") return 0;
    const idx = RUN_STEPS.indexOf(run.step as any);
    return Math.round(((idx + 0.5) / RUN_STEPS.length) * 100);
  }, [run.step, run.status]);

  return (
    <div className="msk-panel border border-violet-700/60 bg-violet-900/80 p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-violet-300">
          <CircleDashed className="size-3.5 animate-spin" />
          {step}
        </span>
        {run.status === "done" ? (
          <CheckCircle2 className="size-4 text-emerald-400" />
        ) : (
          <span className="text-violet-500">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-violet-950">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {run.error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          {run.error}
        </p>
      )}
    </div>
  );
}

function RunCard({ run }: { run: MskRun }) {
  const summary = run.summary ?? "Execução concluída.";
  const createdAt = timeAgo(run.created_at);

  return (
    <div className="msk-panel border border-emerald-800/50 bg-emerald-950/40 p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-emerald-300">{summary}</p>
          <p className="mt-1 text-[10px] text-emerald-600">{createdAt}</p>
        </div>
      </div>
      {run.output && (
        <div className="mt-2 flex items-center gap-1">
          <ExternalLink className="size-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-500">Alterações aplicadas</span>
        </div>
      )}
    </div>
  );
}

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    await addFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-violet-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${chatBgAsset.url})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/80 via-violet-950/90 to-violet-950/95" aria-hidden />
      
      <div className="relative z-10 border-b border-violet-800/50 bg-violet-950/90 p-3">
        <h1 className="text-sm font-medium text-orange-400">
          Central completa de edição dos seus projetos: chat com o agente, preview real, projetos Lovable, GitHub, anexos, histórico e publicação.
        </h1>
      </div>

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
                    className="flex items-center gap-1 rounded bg-violet-800/60 px-1.5 py-0.5 text-[10px] text-violet-300"
                  >
                    <FileText className="size-3" />
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {activeRun && <RunProgress run={activeRun} />}

        {lastFinished && (
          <RunCard run={lastFinished} />
        )}

        <div ref={endRef} />
      </div>

      {attachments.length > 0 && (
        <div className="border-t border-violet-800/40 bg-violet-950/80 p-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 rounded bg-violet-900 px-2 py-1 text-[11px] text-violet-300"
              >
                <FileText className="size-3" />
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="ml-1 rounded hover:bg-violet-800 p-0.5"
                  aria-label="Remover anexo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {voiceError && (
        <div className="mx-3 mb-1 rounded bg-red-900/60 border border-red-700/50 px-3 py-1.5 text-[11px] text-red-300">
          {voiceError}
        </div>
      )}

      <div className="border-t border-violet-800/50 bg-violet-950/90 p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="msk-input flex-1 resize-none rounded-lg border border-violet-700/50 bg-violet-900/70 px-3 py-2 text-sm text-violet-100 placeholder:text-violet-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            rows={2}
            placeholder="Descreva a alteração..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || !activeProject}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={toggleDictation}
              disabled={!activeProject}
              className={`rounded-lg p-2 transition-colors ${
                listening
                  ? "bg-orange-600 text-white hover:bg-orange-500"
                  : "bg-violet-800 text-violet-300 hover:bg-violet-700"
              } disabled:opacity-40`}
              aria-label={listening ? "Parar gravação" : "Iniciar gravação por voz"}
            >
              <Mic className="size-4" />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!activeProject}
              className="rounded-lg bg-violet-800 p-2 text-violet-300 transition-colors hover:bg-violet-700 disabled:opacity-40"
              aria-label="Anexar arquivos"
            >
              <Paperclip className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
          </div>
          <button
            onClick={submit}
            disabled={sending || !text.trim() || !activeProject}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-600 disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {blocked && (
          <p className="mt-2 text-center text-[11px] text-orange-400">
            Licença inativa. Assine para continuar editando.
          </p>
        )}
      </div>
    </div>
  );
}