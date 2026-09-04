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
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-violet-500 transition-colors hover:bg-violet-800 hover:text-violet-300"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o que você quer..."
            rows={1}
            className="msk-scroll flex-1 resize-none bg-transparent text-sm text-violet-100 placeholder-violet-600 outline-none"
            style={{ minHeight: "36px", maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={toggleDictation}
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-all ${
              listening
                ? "bg-violet-600 text-violet-100 shadow-lg shadow-violet-500/30"
                : "text-violet-500 hover:bg-violet-800 hover:text-violet-300"
            }`}
            aria-label={listening ? "Parar ditado" : "Iniciar ditado por voz"}
          >
            <Mic className={`size-4 ${listening ? "animate-pulse" : ""}`} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || sending || !activeProject}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-violet-100 transition-all hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        {voiceError && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
            <TriangleAlert className="size-3" />
            {voiceError}
          </p>
        )}
        <p className="mt-1.5 text-center text-[10px] text-violet-700">
          AIO Studio — MSK Pro Edition
        </p>
      </div>
    </div>
  );
}