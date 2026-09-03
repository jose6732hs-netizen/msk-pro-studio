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
 * Validador profissional de acesso: e-mail + senha OU e-mail + licença
 * (a mesma licença já validada no popup da extensão).
 * A credencial é verificada no SERVIDOR; aqui só guardamos o vínculo local.
 */
function AccessForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"password" | "license">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            setMode("license");
            setLinked(parsed.email);
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
      const body =
        mode === "password"
          ? { mode, email: email.trim(), password }
          : { mode, email: email.trim(), license: license.trim() };
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; accessToken?: string };
      if (!res.ok || !data.ok) {
        setError(ACCESS_ERRORS[data.code ?? ""] ?? "Não foi possível validar o acesso.");
        return;
      }
      if (mode === "password" && data.accessToken) {
        window.localStorage.setItem(
          "msk.panel.session",
          JSON.stringify({ access_token: data.accessToken, email: email.trim() }),
        );
      } else {
        window.localStorage.setItem(
          "msk.panel.license",
          JSON.stringify({ email: email.trim(), key: license.trim() }),
        );
      }
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

      <div className="grid grid-cols-2 gap-2">
        {(["password", "license"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors ${
              mode === m
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {m === "password" ? "E-mail e senha" : "Licença"}
          </button>
        ))}
      </div>

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

      {mode === "password" ? (
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Senha</span>
          <input
            type="password"
            required
            minLength={6}
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </label>
      ) : (
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Licença MSK
          </span>
          <input
            type="text"
            required
            minLength={6}
            maxLength={200}
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="Cole sua licença MSK"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </label>
      )}

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
