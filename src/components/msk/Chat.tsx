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
                : "bg-violet-900/80 border border-violet-800/40 text-violet-200"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-violet-400" : "text-violet-500"}`}>
              {m.role === "assistant" ? "MSK Agente" : "Você"}
            </p>
          </div>
        ))}

        {activeRun && <RunProgress run={activeRun} />}
        {lastFinished && <RunCard run={lastFinished} />}
        {sending && (
          <div className="max-w-[92%] rounded-xl bg-violet-900/80 border border-violet-800/40 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-violet-300">
              <Loader2 className="size-3.5 animate-spin" />
              Enviando...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {attachments.length > 0 && (
        <div className="relative z-10 border-t border-violet-800/50 bg-violet-950/95 px-3 py-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md bg-violet-900 px-2 py-1 text-[11px] text-violet-300"
              >
                <FileText className="size-3" />
                <span className="max-w-[120px] truncate">{att.name}</span>
                <span className="text-violet-500">({labelForStatus(att.status)})</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 text-violet-500 hover:text-red-400 transition-colors"
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
        <div className="relative z-10 border-t border-red-800/50 bg-red-950/90 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-red-400">
            <TriangleAlert className="size-3.5" />
            {voiceError}
          </p>
        </div>
      )}

      <div className="relative z-10 border-t border-violet-800/50 bg-violet-950/95 p-3">
        {blocked && (
          <div className="mb-2 flex items-center justify-center gap-2 rounded-md bg-amber-900/30 px-3 py-1.5 text-[11px] text-amber-400">
            <TriangleAlert className="size-3.5" />
            Licença inativa — funcionalidade restrita.
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <button
              onClick={toggleDictation}
              disabled={sending}
              className={`flex size-9 items-center justify-center rounded-lg transition-all ${
                listening
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "bg-violet-800 text-violet-300 hover:bg-violet-700"
              } disabled:opacity-40`}
              aria-label={listening ? "Parar transcrição" : "Iniciar transcrição por voz"}
            >
              {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              className="flex size-9 items-center justify-center rounded-lg bg-violet-800 text-violet-300 transition-colors hover:bg-violet-700 disabled:opacity-40"
              aria-label="Anexar arquivos"
            >
              <Paperclip className="size-4" />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva a alteração desejada..."
            rows={1}
            className="msk-input flex-1 resize-none rounded-xl border border-violet-700/60 bg-violet-900/80 px-4 py-2.5 text-sm text-violet-100 placeholder:text-violet-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 transition-all hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}