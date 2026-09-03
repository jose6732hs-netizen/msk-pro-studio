import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Clock, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { getLicenseStatus } from "@/lib/msk/license.functions";
import type { LicenseReason, LicenseResult } from "@/lib/msk/license.server";
import mskLogo from "@/assets/msk-logo.png.asset.json";

const PLANS_URL = "https://msksystem.online/planos";
const RENEW_URL = "https://msksystem.online/planos?renovar=1";
const POLL_MS = 60_000;

const MESSAGES: Record<LicenseReason, { title: string; body: string }> = {
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

/**
 * Camada única de licença. Nada do editor é renderizado antes da resposta
 * do SERVIDOR — sem flash de conteúdo protegido, sem bloqueio só visual.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenseResult | null>(null);
  const [checking, setChecking] = useState(false);
  const alerted = useRef<Set<string>>(new Set());
  const [alert, setAlert] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = (await getLicenseStatus()) as LicenseResult;
      setState(result);
    } catch {
      setState({
        active: false,
        reason: "UNAUTHENTICATED",
        serverNow: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Relógio local apenas VISUAL, ancorado no serverNow da última resposta.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useRemaining(state, tick);

  useEffect(() => {
    if (!state?.active || remaining === null) return;
    const steps: { key: string; limit: number; text: string }[] = [
      { key: "24h", limit: 86_400, text: "Seu plano expira em breve (menos de 24 horas)." },
      { key: "1h", limit: 3_600, text: "1 hora de acesso restante." },
      { key: "15m", limit: 900, text: "15 minutos restantes." },
      { key: "5m", limit: 300, text: "Seu editor será bloqueado em aproximadamente 5 minutos." },
    ];
    for (const s of steps) {
      if (remaining <= s.limit && !alerted.current.has(s.key)) {
        alerted.current.add(s.key);
        setAlert(s.text);
      }
    }
  }, [remaining, state]);

  // Expirou com o painel aberto: bloqueia sem esperar o refresh.
  useEffect(() => {
    if (state?.active && remaining !== null && remaining <= 0) void check();
  }, [remaining, state, check]);

  if (!state) return <Verifying />;
  if (!state.active) return <Blocked state={state} onRecheck={check} checking={checking} />;
  if (remaining !== null && remaining <= 0) return <Verifying />;

  return (
    <div className="flex min-h-screen flex-col">
      <LicenseBar state={state} remaining={remaining ?? state.remainingSeconds} />
      {alert && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs text-warning">
          <AlertTriangle className="size-3.5" />
          {alert}
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            fechar
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function useRemaining(state: LicenseResult | null, _tick: number): number | null {
  const anchor = useRef<{ serverNow: number; clientAt: number; expires: number } | null>(null);
  if (state?.active) {
    const serverNow = Date.parse(state.serverNow);
    const expires = Date.parse(state.expiresAt);
    if (!anchor.current || anchor.current.serverNow !== serverNow) {
      anchor.current = { serverNow, clientAt: Date.now(), expires };
    }
  } else {
    anchor.current = null;
  }
  if (!anchor.current) return null;
  const elapsed = Date.now() - anchor.current.clientAt;
  return Math.floor((anchor.current.expires - (anchor.current.serverNow + elapsed)) / 1000);
}

function format(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}min ${String(sec).padStart(2, "0")}s`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function LicenseBar({ state, remaining }: { state: LicenseResult & { active: true }; remaining: number }) {
  const total = Math.max(
    1,
    (Date.parse(state.expiresAt) - Date.parse(state.startsAt ?? state.serverNow)) / 1000,
  );
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const tone = pct > 20 ? "bg-primary" : pct > 10 ? "bg-warning" : "bg-destructive";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface px-4 py-2 text-[11px]">
      <span className="uppercase tracking-[0.18em] text-muted-foreground">Plano atual</span>
      <span className="font-semibold">{state.planName}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="size-3" />
        Tempo restante: <span className="font-mono text-foreground">{format(remaining)}</span>
      </span>
      <span className="text-muted-foreground">Expira em: {formatDate(state.expiresAt)}</span>
      <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Verifying() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src={mskLogo.url} alt="MSK Agente" className="msk-neon-ring size-16 rounded-full" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verificando acesso...
      </p>
    </div>
  );
}

function Blocked({
  state,
  onRecheck,
  checking,
}: {
  state: LicenseResult & { active: false };
  onRecheck: () => void;
  checking: boolean;
}) {
  const msg = MESSAGES[state.reason];
  const expired = state.reason === "LICENSE_EXPIRED";

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
              Plano: <span className="text-foreground">{state.planName ?? "—"}</span>
            </p>
            <p>
              Expirou em: <span className="text-foreground">{formatDate(state.expiresAt)}</span>
            </p>
          </div>
        )}

        {(state.reason === "UNAUTHENTICATED" || state.reason === "LICENSE_NOT_FOUND") && (
          <AccessForm onDone={onRecheck} />
        )}

        <a
          href={expired ? RENEW_URL : PLANS_URL}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {expired ? "RENOVAR AGORA" : "VER PLANOS"}
        </a>

        <p className="mt-4 text-xs text-muted-foreground">Já renovou?</p>
        <button
          type="button"
          onClick={onRecheck}
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

        {expired && (
          <a
            href={PLANS_URL}
            className="mt-3 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver planos
          </a>
        )}
      </div>
    </div>
  );
}
