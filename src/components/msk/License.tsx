import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, ExternalLink, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import mskLogo from "@/assets/msk-logo.png.asset.json";
import {
  formatCountdown,
  formatDateTime,
  formatLong,
  toneFor,
  useLicense,
  type LicenseTone,
} from "@/lib/msk/license-context";
import type { LicenseMetrics, LicenseReason } from "@/lib/msk/license.server";

const PLANS_URL = "https://msksystem.online/planos";
const RENEW_URL = "https://msksystem.online/planos?renovar=1";

const TONE_CLASS: Record<LicenseTone, { text: string; bar: string; dot: string; border: string }> = {
  normal: {
    text: "text-primary",
    bar: "bg-primary",
    dot: "bg-primary",
    border: "border-primary/40",
  },
  warning: {
    text: "text-warning",
    bar: "bg-warning",
    dot: "bg-warning",
    border: "border-warning/40",
  },
  critical: {
    text: "text-destructive",
    bar: "bg-destructive",
    dot: "bg-destructive",
    border: "border-destructive/50",
  },
};

const TONE_EMOJI: Record<LicenseTone, string> = {
  normal: "🟢",
  warning: "🟡",
  critical: "🔴",
};

/** Barra fina de tempo restante (tempo restante / duração total). */
export function LicenseProgress({ className = "" }: { className?: string }) {
  const { remainingPercentage, remainingSeconds } = useLicense();
  const tone = TONE_CLASS[toneFor(remainingPercentage, remainingSeconds)];
  const pct = remainingPercentage ?? 0;
  return (
    <div
      className={`h-1 overflow-hidden rounded-full bg-secondary ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tempo de licença restante"
    >
      <div className={`h-full ${tone.bar} transition-[width] duration-1000`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Selo de status curto (usado em painéis e listas). */
export function LicenseStatusBadge() {
  const { active, plan, remainingSeconds, remainingPercentage } = useLicense();
  const tone = TONE_CLASS[toneFor(remainingPercentage, remainingSeconds)];
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-2.5 py-1 text-[11px] text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        Licença inativa
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${tone.border} px-2.5 py-1 text-[11px] ${tone.text}`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {plan ?? "MSK Agente"} · {formatCountdown(remainingSeconds)}
    </span>
  );
}

/** Aviso discreto nos marcos de 24h / 1h / 15m / 5m. */
export function LicenseWarning() {
  const { active, remainingSeconds } = useLicense();
  const fired = useRef<Set<string>>(new Set());
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!active || remainingSeconds === null) return;
    const steps = [
      { key: "24h", limit: 86_400, text: "Sua licença expira em menos de 24 horas." },
      { key: "1h", limit: 3_600, text: "1 hora de acesso restante." },
      { key: "15m", limit: 900, text: "15 minutos restantes." },
      { key: "5m", limit: 300, text: "O editor será bloqueado em aproximadamente 5 minutos." },
    ];
    for (const s of steps) {
      if (remainingSeconds <= s.limit && !fired.current.has(s.key)) {
        fired.current.add(s.key);
        setText(s.text);
      }
    }
  }, [active, remainingSeconds]);

  if (!text) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs text-warning">
      <AlertTriangle className="size-3.5" />
      {text}
      <a href={RENEW_URL} className="underline underline-offset-4">
        renovar
      </a>
      <button
        type="button"
        onClick={() => setText(null)}
        className="ml-2 text-muted-foreground hover:text-foreground"
      >
        fechar
      </button>
    </div>
  );
}

/**
 * Contador regressivo permanente do topo. Visual apenas — o backend continua
 * decidindo o acesso a cada chamada.
 */
export function LicenseCountdown() {
  const { active, plan, startsAt, expiresAt, remainingSeconds, remainingPercentage, limits, usage } =
    useLicense();
  const [open, setOpen] = useState(false);
  const tone = toneFor(remainingPercentage, remainingSeconds);
  const cls = TONE_CLASS[tone];
  const pulse = remainingSeconds !== null && remainingSeconds <= 300;

  if (!active) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Plano ${plan ?? "MSK"} · expira ${formatDateTime(expiresAt)}`}
        className={`msk-panel flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary ${pulse ? "msk-dot-pulse" : ""}`}
      >
        <span className={`size-1.5 rounded-full ${cls.dot}`} />
        <span className="leading-tight">
          <span className={`block font-mono text-[11px] font-semibold ${cls.text}`}>
            {formatCountdown(remainingSeconds)}
          </span>
          <span className="hidden text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
            {plan ?? "MSK Agente"}
          </span>
        </span>
        <span className="hidden w-16 md:block">
          <LicenseProgress />
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="msk-panel absolute right-0 top-[calc(100%+8px)] z-50 w-72 p-4 text-xs">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seu plano</p>
            <p className="mt-1 text-sm font-semibold">{plan ?? "MSK Agente"}</p>

            <div className="mt-3 space-y-1.5 text-muted-foreground">
              <Row label="Tempo restante" value={formatCountdown(remainingSeconds)} mono />
              <Row label="Equivalente a" value={formatLong(remainingSeconds)} />
              <Row label="Ativado" value={formatDateTime(startsAt)} />
              <Row label="Expira" value={formatDateTime(expiresAt)} />
            </div>

            <div className="mt-3">
              <LicenseProgress />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {Math.round(remainingPercentage ?? 0)}% restante
              </p>
            </div>

            <UsageList limits={limits} usage={usage} />

            <a
              href={PLANS_URL}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground"
            >
              GERENCIAR PLANO
              <ExternalLink className="size-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </p>
  );
}

function UsageList({ limits, usage }: { limits: LicenseMetrics; usage: LicenseMetrics }) {
  const keys = Array.from(new Set([...Object.keys(usage ?? {}), ...Object.keys(limits ?? {})]));
  if (!keys.length) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
        Uso e limites não informados pelo servidor.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-muted-foreground">
      <p className="text-[10px] uppercase tracking-[0.2em]">Uso do período</p>
      {keys.map((k) => (
        <Row
          key={k}
          label={k}
          value={
            limits?.[k] !== undefined
              ? `${usage?.[k] ?? 0} / ${limits[k]}`
              : String(usage?.[k] ?? 0)
          }
        />
      ))}
    </div>
  );
}

/** Tela final quando o servidor confirma que não há licença ativa. */
export function LicenseExpiredScreen({
  reason,
  planName,
  expiresAt,
  children,
}: {
  reason: LicenseReason;
  planName?: string | null;
  expiresAt?: string | null;
  children?: React.ReactNode;
}) {
  const { refresh, checking } = useLicense();
  const expired = reason === "LICENSE_EXPIRED";
  const msg = MESSAGES[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="msk-panel w-full max-w-md p-8 text-center">
        <img
          src={mskLogo.url}
          alt="MSK Agente"
          className="msk-neon-ring mx-auto size-16 rounded-full"
        />
        <p className="mt-5 text-sm font-semibold tracking-tight">MSK AGENTE</p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Painel profissional
        </p>

        <h1 className="msk-neon-text mt-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <ShieldOff className="size-4" />
          {msg.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{msg.body}</p>

        {expired && (
          <div className="mt-5 space-y-1 text-xs text-muted-foreground">
            <p>
              Plano: <span className="text-foreground">{planName ?? "—"}</span>
            </p>
            <p>
              Expirou em: <span className="text-foreground">{formatDateTime(expiresAt)}</span>
            </p>
          </div>
        )}

        {children}

        <a
          href={expired ? RENEW_URL : PLANS_URL}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {expired ? "RENOVAR AGORA" : "VER PLANOS"}
        </a>

        <p className="mt-4 text-xs text-muted-foreground">Já renovou?</p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={checking}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          VERIFICAR NOVAMENTE
        </button>
      </div>
    </div>
  );
}

/** Estado inicial: nunca mostrar contador salvo localmente como verdade. */
export function LicenseVerifying() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src={mskLogo.url} alt="MSK Agente" className="msk-neon-ring size-16 rounded-full" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4 animate-spin" />
        Verificando licença...
      </p>
    </div>
  );
}

export const MESSAGES: Record<LicenseReason, { title: string; body: string }> = {
  LICENSE_EXPIRED: {
    title: "Licença expirada",
    body: "Seu acesso ao Painel Profissional chegou ao fim.",
  },
  LICENSE_SUSPENDED: {
    title: "Licença suspensa",
    body: "Sua licença foi suspensa pela administração do MSK.",
  },
  LICENSE_REVOKED: {
    title: "Licença cancelada",
    body: "Sua licença foi cancelada ou revogada.",
  },
  LICENSE_NOT_FOUND: {
    title: "Acesso não disponível",
    body: "Você precisa de uma licença ativa para acessar o Editor MSK.",
  },
  UNAUTHENTICATED: {
    title: "Sessão necessária",
    body: "Entre com sua conta MSK para acessar o Painel Profissional.",
  },
  BACKEND_NOT_CONFIGURED: {
    title: "Acesso não disponível",
    body: "Não foi possível validar sua licença no servidor MSK.",
  },
};

export { TONE_EMOJI };
