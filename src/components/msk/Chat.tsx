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
            className="rounded p-1 text-violet-500 transition-colors hover:bg-violet-800/50 hover:text-violet-300"
            aria-label="Diminuir zoom"
            disabled={zoom <= 50}
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-violet-400">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="rounded p-1 text-violet-500 transition-colors hover:bg-violet-800/50 hover:text-violet-300"
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
        className="flex-1 overflow-auto p-4"
        style={{ maxHeight: isExpanded ? "none" : "400px" }}
      >
        {content && (
          <div
            className="mx-auto transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            {/* Render content based on type */}
            <div
              className="prose prose-invert prose-violet max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment Preview ───
interface AttachmentPreviewProps {
  file: Attachment;
  onRemove: (id: string) => void;
  onPreviewUpdate: (id: string) => Promise<void>;
}

function AttachmentPreview({ file, onRemove, onPreviewUpdate }: AttachmentPreviewProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePreviewUpdate = useCallback(async () => {
    if (file.status !== "ready") return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      await onPreviewUpdate(file.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }, [file.id, file.status, onPreviewUpdate]);

  const fileTypeIcon = useMemo(() => {
    const type = file.type.toLowerCase();
    if (type.startsWith("image/")) return Image;
    if (type.includes("pdf")) return FileText;
    return Paperclip;
  }, [file.type]);

  const Icon = fileTypeIcon;

  return (
    <div className="group relative rounded-lg border border-violet-700/40 bg-violet-900/40 p-3 transition-all hover:border-violet-600/60">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-800/50">
          <Icon className="size-5 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{file.name}</p>
          <p className="text-xs text-violet-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <div className="mt-2 flex items-center gap-2">
            {file.status === "uploading" && (
              <span className="flex items-center gap-1 text-xs text-violet-400">
                <Loader2 className="size-3 animate-spin" />
                Enviando...
              </span>
            )}
            {file.status === "ready" && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="size-3" />
                Pronto
              </span>
            )}
            {file.status === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <TriangleAlert className="size-3" />
                Erro no upload
              </span>
            )}
          </div>
        </div>
      </div>

      {/* File Actions */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {file.status === "ready" && (
          <button
            onClick={handlePreviewUpdate}
            disabled={isUpdating}
            className="rounded bg-violet-800/80 p-1.5 text-violet-400 transition-colors hover:bg-violet-700 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Atualizar prévia"
            title="Atualizar prévia"
          >
            <RotateCcw className={`size-3 ${isUpdating ? "animate-spin" : ""}`} />
          </button>
        )}
        <button
          onClick={() => onRemove(file.id)}
          className="rounded bg-red-900/80 p-1.5 text-red-400 transition-colors hover:bg-red-800 hover:text-red-200"
          aria-label="Remover arquivo"
          title="Remover"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* Preview Error */}
      {error && (
        <div className="mt-2 rounded bg-red-950/60 p-2">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={handlePreviewUpdate}
            className="mt-1 text-xs text-violet-400 underline transition-colors hover:text-violet-300"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Thumbnail Preview for Images */}
      {file.preview && (
        <div ref={previewRef} className="mt-3 overflow-hidden rounded">
          <img
            src={file.preview}
            alt={file.name}
            className="h-auto max-h-32 w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

// ─── Tela de Login ───
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Digite seu email para continuar.");
      return;
    }
    if (!password.trim()) {
      setError("Digite sua senha para continuar.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email inválido. Verifique o formato.");
      return;
    }

    setIsLoading(true);
    try {
      // Simula verificação de credenciais
      await new Promise((r) => setTimeout(r, 1200));
      onLogin();
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950 p-4">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 opacity-20 blur-sm" />

        <div className="relative rounded-2xl border border-violet-700/50 bg-gradient-to-b from-violet-950/95 to-purple-950/95 p-8 shadow-2xl backdrop-blur-sm">
          {/* Logo/Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/25">
              <Sparkles className="size-8 text-white" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">MSK Studio</h1>
            <p className="text-sm text-violet-300">Faça login para acessar a plataforma</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-800/50 p-3">
              <TriangleAlert className="size-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-medium text-violet-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-violet-700/50 bg-violet-900/50 py-3 pl-10 pr-4 text-sm text-white placeholder-violet-500 outline-none transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-medium text-violet-300">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-violet-700/50 bg-violet-900/50 py-3 pl-10 pr-12 text-sm text-white placeholder-violet-500 outline-none transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 transition-colors hover:text-violet-400 disabled:cursor-not-allowed"
                  disabled={isLoading}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:from-violet-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-violet-600">
            Ao continuar, você concorda com nossos termos de uso
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── File Upload Component ───
interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  uploadProgress: number;
}

function FileUpload({ onFilesSelected, isUploading, uploadProgress }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onFilesSelected]
  );

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all ${
        isDragging
          ? "border-violet-500 bg-violet-900/30"
          : "border-violet-700/40 bg-violet-950/20"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        accept="image/*,.pdf,.doc,.docx,.txt"
        disabled={isUploading}
      />
      <label
        htmlFor="file-upload"
        className={`flex flex-col items-center gap-3 cursor-pointer ${
          isUploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-violet-900/50">
          <Paperclip className="size-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm text-violet-300">
            {isDragging ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
          </p>
          <p className="mt-1 text-xs text-violet-600">
            Imagens, PDF, DOC, TXT (máx. 10MB)
          </p>
        </div>
      </label>

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-violet-400">Enviando...</span>
            <span className="text-violet-500">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ───
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-md bg-gradient-to-br from-violet-600 to-purple-600 text-white"
            : "rounded-bl-md border border-violet-800/50 bg-violet-950/60 text-violet-100"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-1 text-[10px] ${
            isUser ? "text-violet-200/60" : "text-violet-600"
          }`}
        >
          {message.timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        {/* Attachments in message */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1"
              >
                <Paperclip className="size-3 text-white/70" />
                <span className="text-xs text-white/90">{att.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Interface ───
function ChatInterface() {
  const { license } = useLicense();
  const msk = useMsk();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(
    null
  );
  const [currentRun, setCurrentRun] = useState<MskRun | null>(null);
  const [completedRuns, setCompletedRuns] = useState<MskRun[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Debounced preview update
  const debouncedPreviewUpdate = useDebounceCallback(
    useCallback(
      async (attachmentId: string) => {
        const attachment = attachments.find((a) => a.id === attachmentId);
        if (!attachment) return;

        setIsUpdatingPreview(true);
        setPreviewError(null);

        try {
          const result = await AttachmentService.getPreview(attachment);
          setPreviewContent(result.html);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao buscar prévia";
          setPreviewError(message);
          setToast({ message: "Não foi possível atualizar a prévia", type: "error" });
        } finally {
          setIsUpdatingPreview(false);
        }
      },
      [attachments]
    ),
    500
  ),
    500
  );

  // Handle file selection
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      const newAttachments: Attachment[] = files.map((file) => ({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size,
        status: "uploading" as const,
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);

      try {
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
          const uploaded = await AttachmentService.upload(files[i], {
            onProgress: (pct) => {
              setUploadProgress(Math.round((pct / 100) * ((i + 1) / files.length) * 100));
            },
          });

          setAttachments((prev) =>
            prev.map((att) =>
              att.id === newAttachments[i].id
                ? { ...att, id: uploaded.id, status: "ready" as const, url: uploaded.url }
                : att
            )
          );
        }

        setToast({ message: `${files.length} arquivo(s) enviado(s) com sucesso`, type: "success" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao enviar arquivos";
        setToast({ message, type: "error" });
        setAttachments((prev) =>
          prev.map((att) => (att.status === "uploading" ? { ...att, status: "error" as const } : att))
        );
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    []
  );

  // Handle attachment removal
  const handleRemoveAttachment = useCallback(
    async (id: string) => {
      const attachment = attachments.find((a) => a.id === id);
      if (attachment?.url) {
        try {
          await AttachmentService.delete(attachment.id);
        } catch {
          // Silent fail - file might already be deleted on server
        }
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [attachments]
  );

  // Handle preview update
  const handlePreviewUpdate = useCallback(
    async (id: string) => {
      try {
        await debouncedPreviewUpdate(id);
      } catch (err) {
        throw new Error("Não foi possível atualizar a prévia");
      }
    },
    [debouncedPreviewUpdate]
  );

  // Handle message submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedInput = input.trim();
      if (!trimmedInput && attachments.length === 0) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: trimmedInput,
        timestamp: new Date(),
        attachments: [...attachments],
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsGenerating(true);
      setPreviewError(null);

      // Simulate run creation
      const run: MskRun = {
        id: `run-${Date.now()}`,
        status: "running",
        step: "receiving",
        created_at: new Date().toISOString(),
      };
      setCurrentRun(run);

      // Simulate progress
      const steps = ["receiving", "processing", "generating", "finalizing"] as const;
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 800));
        setCurrentRun((prev) =>
          prev ? { ...prev, step: steps[i], status: i === steps.length - 1 ? "done" : "running" } : null
        );
        if (i === steps.length - 1) {
          setCompletedRuns((prev) => [
            ...prev,
            {
              ...run,
              status: "done",
              step: steps[i],
              summary: "Prévia atualizada com sucesso",
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }

      // Generate assistant response
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: "Aqui está a prévia atualizada do seu projeto. As alterações foram aplicadas conforme solicitado.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setAttachments([]);
      setIsGenerating(false);
      setCurrentRun(null);
      setToast({ message: "Prévia atualizada com sucesso!", type: "success" });
    },
    [input, attachments]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const readyAttachments = attachments.filter((a) => a.status === "ready");

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-violet-800/40 bg-violet-950/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">MSK Studio</h1>
            <p className="text-xs text-violet-400">
              {license ? `Plano ${license.plan}` : "Carregando..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-900/50 px-3 py-1 text-xs text-emerald-400">
            {license?.credits ?? 0} créditos
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex flex-1 flex-col border-r border-violet-800/40">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/20">
                  <Sparkles className="size-10 text-violet-400" />
                </div>
                <h2 className="mb-2 text-xl font-semibold text-white">
                  Bem-vindo ao MSK Studio
                </h2>
                <p className="max-w-md text-sm text-violet-400">
                  Envie uma mensagem ou anexe arquivos para começar a criar
                  prévias incríveis com inteligência artificial.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Current Run Progress */}
            {currentRun && (
              <div className="mt-4">
                <RunProgress run={currentRun} />
              </div>
            )}

            {/* Completed Runs */}
            {completedRuns.length > 0 && (
              <div className="mt-4 space-y-3">
                {completedRuns.map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="border-t border-violet-800/40 bg-violet-950/60 p-4">
              <p className="mb-3 text-xs font-medium text-violet-400">
                Anexos ({attachments.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attachments.map((file) => (
                  <AttachmentPreview
                    key={file.id}
                    file={file}
                    onRemove={handleRemoveAttachment}
                    onPreviewUpdate={handlePreviewUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-violet-800/40 bg-violet-950/80 p-4">
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Descreva o que você quer criar..."
                  rows={1}
                  disabled={isGenerating}
                  className="w-full resize-none rounded-xl border border-violet-700/50 bg-violet-900/50 px-4 py-3 pr-12 text-sm text-white placeholder-violet-500 outline-none transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute bottom-3 right-3 text-violet-500 transition-colors hover:text-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isGenerating || isUploading}
                  aria-label="Anexar arquivo"
                >
                  <Paperclip className="size-5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={isGenerating || isUploading || (!input.trim() && attachments.length === 0)}
                className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Enviar mensagem"
              >
                {isGenerating ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Send className="size-5" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="hidden w-1/2 flex-col border-l border-violet-800/40 p-4 lg:flex">
          <Preview
            content={previewContent}
            isUpdating={isUpdatingPreview}
            updateError={previewError}
            onRetry={() => {
              if (readyAttachments.length > 0) {
                handlePreviewUpdate(readyAttachments[0].id);
              }
            }}
          />
        </div>
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

// ─── Main Chat Component ───
export function Chat() {
  const { license, isLoading } = useLicense();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session
  useEffect(() => {
    const session = localStorage.getItem("msk_session");
    if (session) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = useCallback(() => {
    localStorage.setItem("msk_session", "active");
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("msk_session");
    setIsAuthenticated(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-violet-400" />
          <p className="text-sm text-violet-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div>
      <ChatInterface />
    </div>
  );
}

export default Chat;
