import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { LicenseProvider, useLicense } from "@/lib/msk/license-context";
import {
  LicenseCountdown,
  LicenseExpiredScreen,
  LicenseVerifying,
  LicenseWarning,
} from "./License";

/**
 * Mantém o mesmo vínculo que a extensão já validou disponível para os adapters
 * do painel. Não é token GitHub, service-role nem chave de IA: é a própria
 * licença do usuário, que o backend MSK revalida antes de cada operação.
 */
function syncPanelSessionFromLinkedLicense() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("msk.panel.license");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { email?: string; key?: string };
    const key = String(parsed.key ?? "").trim();
    if (!key) return;
    const existingRaw = window.localStorage.getItem("msk.panel.session");
    const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      "msk.panel.session",
      JSON.stringify({
        ...existing,
        user_id: existing["user_id"] ?? null,
        email: String(parsed.email ?? existing["email"] ?? "").trim() || null,
        name: existing["name"] ?? null,
        access_token: key,
        active_project_id: existing["active_project_id"] ?? null,
        source: "extension",
      }),
    );
  } catch {
    /* vínculo ausente/inválido: o servidor continuará bloqueando */
  }
}

/**
 * Camada única de licença. Nada do editor é renderizado antes da resposta
 * do SERVIDOR — sem flash de conteúdo protegido, sem bloqueio só visual.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  return (
    <LicenseProvider>
      <Gated>{children}</Gated>
    </LicenseProvider>
  );
}

function Gated({ children }: { children: ReactNode }) {
  const { loading, active, reason, raw, refresh } = useLicense();

  // A extensão injeta msk.panel.license antes de abrir o Editor. Fazemos o
  // handoff para o provider ANTES de montar o painel, evitando sessão nula.
  syncPanelSessionFromLinkedLicense();

  if (loading) return <LicenseVerifying />;
  if (!active) {
    const r = reason ?? "UNAUTHENTICATED";
    return (
      <LicenseExpiredScreen
        reason={r}
        planName={raw && !raw.active ? (raw.planName ?? null) : null}
        expiresAt={raw && !raw.active ? (raw.expiresAt ?? null) : null}
      >
        {(r === "UNAUTHENTICATED" || r === "LICENSE_NOT_FOUND") && (
          <AccessForm onDone={() => void refresh()} />
        )}
      </LicenseExpiredScreen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <LicenseWarning />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export { LicenseCountdown };

/**
 * Validador profissional de acesso: e-mail + licença MSK
 * (a mesma licença já validada no popup da extensão).
 * A credencial é verificada no SERVIDOR; aqui só guardamos o vínculo local.
 */
function AccessForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  // Vínculo automático: a extensão grava msk.panel.license neste domínio.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("msk.panel.license");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string; key?: string };
        if (parsed.email) {
          setEmail(parsed.email);
          if (parsed.key) {
            setLicense(parsed.key);
            setLinked(parsed.email);
            syncPanelSessionFromLinkedLicense();
          }
        }
      }
    } catch {
      /* sem vínculo salvo */
    }
  }, []);

  async function submit(event: import("react").FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cleanEmail = email.trim();
      const cleanLicense = license.trim();
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "license", email: cleanEmail, license: cleanLicense }),
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (!res.ok || !data.ok) {
        setError(ACCESS_ERRORS[data.code ?? ""] ?? "Não foi possível validar o acesso.");
        return;
      }
      window.localStorage.setItem(
        "msk.panel.license",
        JSON.stringify({ email: cleanEmail, key: cleanLicense }),
      );
      syncPanelSessionFromLinkedLicense();
      onDone();
    } catch {
      setError("Falha de conexão com o servidor MSK.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 text-left">
      {linked && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] text-primary">
          Licença vinculada pelo popup: {linked}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">E-mail</span>
        <input
          type="email"
          required
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seuemail@exemplo.com"
          className={inputClass}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Licença MSK
        </span>
        <input
          type="password"
          required
          minLength={6}
          maxLength={200}
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="MSK-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        VALIDAR E ENTRAR
      </button>
    </form>
  );
}

const ACCESS_ERRORS: Record<string, string> = {
  INVALID_INPUT: "Preencha os campos corretamente.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  UNAUTHENTICATED: "Credenciais não reconhecidas pelo MSK.",
  LICENSE_NOT_FOUND: "Nenhuma licença encontrada para este e-mail.",
  LICENSE_EXPIRED: "Licença expirada. Renove para continuar.",
  LICENSE_SUSPENDED: "Licença suspensa pela administração.",
  LICENSE_REVOKED: "Licença cancelada ou revogada.",
  BACKEND_NOT_CONFIGURED: "Servidor de licenças indisponível no momento.",
};
