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
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  Image,
  AlertCircle,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDebounceCallback } from "use-debounce";
import chatBgAsset from "@/assets/msk-chat-bg.png.asset.json";
import { useLicense } from "@/lib/msk/license-context";
import { useMsk } from "@/lib/msk/provider";
import { AttachmentService } from "@/lib/msk/services";
import { RUN_STEPS, timeAgo, type MskRun, type Attachment } from "@/lib/msk/core";

function labelForStatus(s: string) {
  if (s === "uploading") return "enviando";
  if (s === "done") return "pronto";
  if (s === "error") return "erro";
  return s;
}

// ─── Toast Notification ───
interface ToastProps {
  message: string;
  type: "error" | "success" | "info";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    error: "bg-red-900/90 border-red-600/50",
    success: "bg-emerald-900/90 border-emerald-600/50",
    info: "bg-violet-900/90 border-violet-600/50",
  }[type];

  const iconColor = {
    error: "text-red-400",
    success: "text-emerald-400",
    info: "text-violet-400",
  }[type];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${bgColor}`}
      role="alert"
    >
      {type === "error" && <AlertCircle className={`size-5 ${iconColor}`} />}
      {type === "success" && <CheckCircle2 className={`size-5 ${iconColor}`} />}
      {type === "info" && <TriangleAlert className={`size-5 ${iconColor}`} />}
      <p className="text-sm text-white">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 text-violet-400 transition-colors hover:text-white"
        aria-label="Fechar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ─── Run Progress ───
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

// ─── Run Card ───
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

// ─── Preview Component ───
interface PreviewProps {
  content: string | null;
  isUpdating: boolean;
  updateError: string | null;
  onRetry: () => void;
}

function Preview({ content, isUpdating, updateError, onRetry }: PreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 50));
  }, []);

  if (!content && !isUpdating) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-violet-700/40 bg-violet-950/20 p-8 text-center">
        <Image className="mb-4 size-12 text-violet-600/50" />
        <p className="text-sm text-violet-400">Nenhuma prévia disponível</p>
        <p className="mt-1 text-xs text-violet-600">A prévia será exibida aqui após o upload</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col rounded-xl border border-violet-700/40 bg-violet-950/40">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between border-b border-violet-800/40 bg-violet-900/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <Image className="size-4 text-violet-400" />
          <span className="text-xs font-medium text-violet-300">Prévia</span>
          {isUpdating && (
            <span className="flex items-center gap-1 text-xs text-violet-500">
              <Loader2 className="size-3 animate-spin" />
              Atualizando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="rounded p-1 text-violet-500 transition-colors hover:bg-violet-800/50 hover:text-violet-300 disabled:opacity-50"
            aria-label="Diminuir zoom"
            disabled={zoom <= 50}
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-violet-400">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="rounded p-1 text-violet-500 transition-colors hover:bg-violet-800/50 hover:text-violet-300 disabled:opacity-50"
            aria-label="Aumentar zoom"
            disabled={zoom >= 200}
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 rounded p-1 text-violet-500 transition-colors hover:bg-violet-800/50 hover:text-violet-300"
            aria-label={isExpanded ? "Recolher" : "Expandir"}
          >
            <ChevronDown
              className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {updateError && (
        <div className="flex items-center justify-between border-b border-red-800/40 bg-red-950/60 px-4 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-400" />
            <span className="text-xs text-red-300">{updateError}</span>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-1 rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800/50"
          >
            <RotateCcw className="size-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Preview Content */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto p-4 ${isExpanded ? "max-h-none" : "max-h-96"}`}
      >
        {content ? (
          <div
            className="mx-auto transition-transform duration-200"
            style={{
              width: `${zoom}%`,
              transformOrigin: "top left",
            }}
          >
            <img
              src={content}
              alt="Prévia do documento"
              className="max-w-full rounded-lg shadow-lg"
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-violet-500" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment Preview ───
interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: () => void;
}

function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const isImage = attachment.type?.startsWith("image/");
  const isUploading = attachment.status === "uploading";
  const isError = attachment.status === "error";

  return (
    <div className="group relative inline-flex items-center gap-2 rounded-lg border bg-violet-900/40 px-3 py-2">
      {isImage && attachment.url ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          className="size-8 rounded object-cover"
        />
      ) : (
        <FileText className="size-4 text-violet-400" />
      )}
      <div className="flex flex-col">
        <span className="max-w-[120px] truncate text-xs text-violet-200">
          {attachment.name}
        </span>
        {isUploading && (
          <span className="flex items-center gap-1 text-[10px] text-violet-500">
            <Loader2 className="size-2.5 animate-spin" />
            Enviando...
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertCircle className="size-2.5" />
            Erro
          </span>
        )}
      </div>
      {!isUploading && (
        <button
          onClick={onRemove}
          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Remover anexo"
        >
          <X className="size-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Chat Component ───
export function Chat() {
  const { license, isLoading: isLicenseLoading } = useLicense();
  const {
    messages,
    isLoading,
    runs,
    submit,
    stop,
    addAttachment,
    removeAttachment,
    clearAttachments,
    uploadProgress,
    previewContent,
    updatePreview,
    previewError,
    clearPreview,
  } = useMsk();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatBg = chatBgAsset?.default ?? chatBgAsset;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, runs, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Sync attachments with context
  useEffect(() => {
    if (attachments.length > 0) {
      const latestAttachment = attachments[attachments.length - 1];
      addAttachment(latestAttachment);
    }
  }, [attachments]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const newAttachments: Attachment[] = [];

      for (const file of fileArray) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setToast({ message: `Arquivo ${file.name} é muito grande (máx. 10MB)`, type: "error" });
          continue;
        }

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
          setToast({ message: `Tipo de arquivo ${file.type} não suportado`, type: "error" });
          continue;
        }

        const attachment: Attachment = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          status: "uploading",
        };

        // Create local preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id ? { ...a, url: ev.target?.result as string } : a
              )
            );
          };
          reader.readAsDataURL(file);
        }

        newAttachments.push(attachment);
        setAttachments((prev) => [...prev, attachment]);

        // Simulate upload
        setTimeout(() => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id ? { ...a, status: "done" } : a
            )
          );
        }, 1000 + Math.random() * 1000);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addAttachment]
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      removeAttachment(id);
    },
    [removeAttachment]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() && attachments.length === 0) {
      setToast({ message: "Digite uma mensagem ou anexe um arquivo", type: "info" });
      return;
    }

    if (!license?.active) {
      setToast({ message: "Licença não ativa. Verifique sua assinatura.", type: "error" });
      return;
    }

    try {
      await submit(input.trim(), attachments);
      setInput("");
      setAttachments([]);
      clearAttachments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setToast({ message, type: "error" });
    }
  }, [input, attachments, license, submit, clearAttachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleRetryPreview = useCallback(() => {
    if (previewContent) {
      setIsPreviewUpdating(true);
      updatePreview(previewContent)
        .catch(() => {})
        .finally(() => setIsPreviewUpdating(false));
    }
  }, [previewContent, updatePreview]);

  const activeRun = runs.find((r) => r.status === "running" || r.status === "pending");
  const latestRun = runs[runs.length - 1];
  const isProcessing = isLoading || !!activeRun;

  if (isLicenseLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-violet-500" />
          <p className="text-sm text-violet-400">Carregando licença...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-violet-800/30 bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-950 shadow-2xl">
      {/* Background Pattern */}
      {chatBg && (
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{ backgroundImage: `url(${chatBg})` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-violet-800/40 bg-violet-900/60 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 shadow-lg shadow-violet-900/50">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">MSK AI Studio</h2>
            <p className="text-xs text-violet-400">Assistente de criação inteligente</p>
          </div>
        </div>
        {license && (
          <div className="flex items-center gap-2 rounded-full bg-emerald-950/60 px-3 py-1.5 border border-emerald-800/40">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300">{license.plan} Plan</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages Scroll */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !isProcessing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/20 to-violet-800/20 border border-violet-700/30">
                  <Sparkles className="size-8 text-violet-400" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-white">Bem-vindo ao MSK Studio</h3>
                <p className="max-w-sm text-sm text-violet-400">
                  Descreva o que você precisa criar ou anexe arquivos de referência.
                  Nossa IA vai transformar suas ideias em realidade.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[
                    "Criar landing page",
                    "Gerar componentes React",
                    "Desenhar海报",
                    "Escrever código",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="rounded-lg border border-violet-800/40 bg-violet-900/40 px-4 py-2 text-left text-xs text-violet-300 transition-all hover:border-violet-600/60 hover:bg-violet-800/40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-900/30"
                      : "bg-violet-900/60 text-violet-100 border border-violet-800/40 backdrop-blur-sm"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {msg.role === "assistant" && (
                      <Sparkles className="mt-1 size-4 shrink-0 text-violet-400" />
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-1.5 rounded bg-black/20 px-2 py-1 text-xs text-white/80"
                        >
                          <Paperclip className="size-3" />
                          <span className="max-w-[100px] truncate">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && !activeRun && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-violet-900/60 px-4 py-3 border border-violet-800/40">
                  <Loader2 className="size-4 animate-spin text-violet-400" />
                  <span className="text-sm text-violet-300">Pensando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Active Run Progress */}
          {activeRun && (
            <div className="px-6 py-2">
              <RunProgress run={activeRun} />
            </div>
          )}

          {/* Completed Runs */}
          {runs.filter((r) => r.status === "done" || r.status === "error").length > 0 && !activeRun && (
            <div className="space-y-2 px-6 py-2">
              {runs
                .filter((r) => r.status === "done" || r.status === "error")
                .slice(-3)
                .map((run, idx) => (
                  <RunCard key={run.id || idx} run={run} />
                ))}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-violet-800/40 bg-violet-900/40 p-4 backdrop-blur-sm">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <AttachmentPreview
                    key={att.id}
                    attachment={att}
                    onRemove={() => handleRemoveAttachment(att.id)}
                  />
                ))}
              </div>
            )}

            <div className="flex items-end gap-3">
              {/* File Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex size-10 items-center justify-center rounded-xl border border-violet-700/50 bg-violet-900/60 text-violet-400 transition-all hover:border-violet-500/60 hover:bg-violet-800/60 hover:text-violet-300"
                aria-label="Anexar arquivo"
                disabled={isProcessing}
              >
                <Paperclip className="size-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Text Input */}
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Descreva o que você quer criar..."
                  className="w-full resize-none rounded-xl border border-violet-700/50 bg-violet-950/60 px-4 py-3 text-sm text-white placeholder:text-violet-600 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  rows={1}
                  disabled={isProcessing}
                />
              </div>

              {/* Stop / Send Button */}
              {isProcessing ? (
                <button
                  onClick={stop}
                  className="flex size-10 items-center justify-center rounded-xl border border-red-700/50 bg-red-900/60 text-red-400 transition-all hover:border-red-500/60 hover:bg-red-800/60 hover:text-red-300"
                  aria-label="Parar"
                >
                  <Square className="size-5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() && attachments.length === 0}
                  className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-900/50 transition-all hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 disabled:hover:from-violet-600 disabled:hover:to-violet-700"
                  aria-label="Enviar"
                >
                  <Send className="size-5" />
                </button>
              )}
            </div>

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-violet-400 mb-1">
                  <span>Enviando arquivos...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-violet-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Preview Toggle */}
            {previewContent && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-violet-800/40 bg-violet-900/40 p-2">
                <div className="flex items-center gap-2">
                  <Image className="size-4 text-violet-400" />
                  <span className="text-xs text-violet-300">Prévia disponível</span>
                </div>
                <button
                  onClick={() => {
                    clearPreview();
                    setToast({ message: "Prévia removida", type: "info" });
                  }}
                  className="flex items-center gap-1 text-xs text-violet-400 transition-colors hover:text-violet-200"
                >
                  <Trash2 className="size-3" />
                  Limpar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        {previewContent && (
          <div className="w-96 border-l border-violet-800/40 p-4">
            <Preview
              content={previewContent}
              isUpdating={isPreviewUpdating}
              updateError={previewError}
              onRetry={handleRetryPreview}
            />
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}