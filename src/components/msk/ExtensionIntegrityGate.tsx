import type { ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useExtensionBridge } from "@/lib/msk/use-bridge";
import { useExtensionGate } from "@/lib/msk/use-extension-gate";

export function ExtensionIntegrityGate({ children }: { children: ReactNode }) {
  const extension = useExtensionBridge();
  const gate = useExtensionGate();

  // A ausência da extensão não substitui a autorização do backend/licença.
  // Bloqueamos o Editor quando uma extensão MSK conectada confirma adulteração/bypass.
  if (extension.installed && gate.blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="msk-glass w-full max-w-lg rounded-2xl border border-destructive/40 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">
            Guardião MSK
          </p>
          <h1 className="mt-2 text-xl font-semibold">Integridade da extensão alterada</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O Editor foi bloqueado porque a extensão conectada não passou pela verificação de integridade e licença.
            Reinstale a versão oficial e valide novamente.
          </p>
          {gate.code && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">{gate.code}</p>
          )}
          {gate.message && <p className="mt-1 text-xs text-destructive">{gate.message}</p>}
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={gate.check}
              disabled={gate.checking}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {gate.checking && <Loader2 className="size-3.5 animate-spin" />}
              VERIFICAR NOVAMENTE
            </button>
            <a
              href="https://msksystem.online"
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              MSK SYSTEM
            </a>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
