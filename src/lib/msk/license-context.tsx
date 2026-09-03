import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getLicenseStatus } from "./license.functions";
import type { LicenseMetrics, LicenseReason, LicenseResult } from "./license.server";

const POLL_MS = 60_000;

export interface LicenseState {
  /** null enquanto o SERVIDOR ainda não respondeu (nunca assumir ativo). */
  loading: boolean;
  checking: boolean;
  active: boolean;
  reason: LicenseReason | null;
  plan: string | null;
  planId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  /** Segundos restantes — animação local ancorada no relógio do SERVIDOR. */
  remainingSeconds: number | null;
  /** 0–100: tempo restante / duração total da licença. */
  remainingPercentage: number | null;
  limits: LicenseMetrics;
  usage: LicenseMetrics;
  raw: LicenseResult | null;
  /** Revalida no servidor agora. */
  refresh: () => Promise<LicenseResult | null>;
  /**
   * Guarda para operação sensível (nova execução, projeto, upload, commit,
   * publicação). Revalida no servidor ANTES de liberar. O frontend é só visual:
   * as APIs verificam o expires_at real de novo.
   */
  ensureActive: () => Promise<boolean>;
}

const Ctx = createContext<LicenseState | null>(null);

export function useLicense(): LicenseState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLicense precisa estar dentro de <LicenseProvider>");
  return ctx;
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<LicenseResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [, setTick] = useState(0);
  const anchor = useRef<{ serverNow: number; clientAt: number; expires: number } | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const next = (await getLicenseStatus()) as LicenseResult;
      // Servidor sempre vence: reancora o contador visual.
      if (next.active && next.expiresAt) {
        anchor.current = {
          serverNow: Date.parse(next.serverNow),
          clientAt: Date.now(),
          expires: Date.parse(next.expiresAt),
        };
      } else {
        anchor.current = null;
      }
      setResult(next);
      return next;
    } catch {
      // Offline: mantém o último estado conhecido e tenta de novo no próximo ciclo.
      const fallback: LicenseResult = {
        active: false,
        reason: "UNAUTHENTICATED",
        serverNow: new Date().toISOString(),
      };
      setResult((prev) => prev ?? fallback);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Relógio visual: 1 tick por segundo, sempre derivado do serverNow ancorado.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!result?.active || !anchor.current) return null;
    const elapsed = Date.now() - anchor.current.clientAt;
    // Nunca negativo.
    return Math.max(0, Math.floor((anchor.current.expires - (anchor.current.serverNow + elapsed)) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, Math.floor(Date.now() / 1000)]);

  /**
   * Duração TOTAL do plano usada como denominador da barra de progresso.
   * Deve ser ESTÁVEL entre refreshs — senão a barra volta para ~100% a cada
   * sincronização com o servidor. Preferimos (expiresAt - startsAt); quando
   * o servidor não informa startsAt, usamos a primeira observação de
   * remainingSeconds persistida por expiresAt (sobrevive a reload e troca de
   * plano). Assim a barra diminui monotonicamente até 0 na expiração.
   */
  function baselineTotal(expiresAt: string, remaining: number): number {
    try {
      const key = `msk.panel.baseline.${expiresAt}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && n > 0) return n;
      }
      // Primeira observação: fixa a base aqui (maior remaining já visto).
      const prevKey = "msk.panel.baseline.last";
      const prev = window.localStorage.getItem(prevKey);
      const prevVal = prev ? JSON.parse(prev) as { expiresAt?: string; total?: number } : null;
      const total = prevVal?.expiresAt === expiresAt && prevVal?.total && prevVal.total > remaining
        ? prevVal.total
        : remaining;
      window.localStorage.setItem(key, String(total));
      window.localStorage.setItem(prevKey, JSON.stringify({ expiresAt, total }));
      return total;
    } catch {
      return remaining || 1;
    }
  }

  // Chegou a 00:00:00 com a página aberta: confirma no servidor imediatamente.
  const zeroed = useRef(false);
  useEffect(() => {
    if (remainingSeconds === 0 && result?.active && !zeroed.current) {
      zeroed.current = true;
      void refresh().finally(() => {
        zeroed.current = false;
      });
    }
  }, [remainingSeconds, result, refresh]);

  const ensureActive = useCallback(async () => {
    const next = await refresh();
    return Boolean(next?.active);
  }, [refresh]);

  const value = useMemo<LicenseState>(() => {
    const active = result?.active === true;
    const startsAt = active ? (result.startsAt ?? null) : null;
    const expiresAt = active ? result.expiresAt : (result?.expiresAt ?? null);
    let pct: number | null = null;
    if (active && remainingSeconds !== null && result.expiresAt) {
      const total =
        (Date.parse(result.expiresAt) - Date.parse(startsAt ?? result.serverNow)) / 1000;
      pct = total > 0 ? Math.max(0, Math.min(100, (remainingSeconds / total) * 100)) : null;
    }
    return {
      loading: result === null,
      checking,
      active,
      reason: result && !result.active ? result.reason : null,
      plan: (result?.active ? result.planName : result?.planName) ?? null,
      planId: active ? result.planId : null,
      startsAt,
      expiresAt,
      remainingSeconds,
      remainingPercentage: pct,
      limits: active ? result.limits : null,
      usage: active ? result.usage : null,
      raw: result,
      refresh,
      ensureActive,
    };
  }, [result, checking, remainingSeconds, refresh, ensureActive]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** DD DIAS · HH:MM:SS · HH:MM:SS · MM:SS conforme o tempo restante. */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "VITALÍCIA";
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${pad(days)} DIAS · ${pad(h)}:${pad(m)}:${pad(sec)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  if (m > 0) return `${pad(m)}:${pad(sec)}`;
  return `00:${pad(sec)}`;
}

export function formatLong(seconds: number | null): string {
  if (seconds === null) return "—";
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days} dia${days > 1 ? "s" : ""} ${h} hora${h === 1 ? "" : "s"}`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export type LicenseTone = "normal" | "warning" | "critical";

export function toneFor(pct: number | null, remaining: number | null): LicenseTone {
  if (remaining !== null && remaining <= 3600) return "critical";
  if (pct === null) return "normal";
  // Verde acima da metade, amarelo na metade, vermelho na reta final.
  if (pct <= 20) return "critical";
  if (pct <= 50) return "warning";
  return "normal";
}

