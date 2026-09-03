import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import mskLogo from "@/assets/msk-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MSK Agente — Painel Profissional de Edição" },
      {
        name: "description",
        content:
          "Central de edição do MSK Agente: chat com o agente, preview real, projetos Lovable, repositórios GitHub e publicação, liberada por licença ativa.",
      },
      { property: "og:title", content: "MSK Agente — Painel Profissional" },
      {
        property: "og:description",
        content:
          "Edite seus projetos Lovable e repositórios GitHub em um painel profissional conectado ao MSK Agente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="msk-panel w-full max-w-lg p-10 text-center">
        <img
          src={mskLogo.url}
          alt="MSK Agente"
          className="msk-neon-ring mx-auto size-20 rounded-full"
        />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">MSK AGENTE</h1>
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Painel profissional
        </p>
        <p className="mt-5 text-sm text-muted-foreground">
          Central completa de edição dos seus projetos: chat com o agente, preview real,
          projetos Lovable, GitHub, anexos, histórico e publicação.
        </p>

        <Link
          to="/editor"
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          ABRIR PAINEL PROFISSIONAL
          <ArrowUpRight className="size-4" />
        </Link>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          O acesso ao editor é validado no servidor por licença ativa.
        </p>
      </div>
    </main>
  );
}
