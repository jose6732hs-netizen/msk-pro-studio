import { createFileRoute } from "@tanstack/react-router";
import { LicenseGate } from "@/components/msk/LicenseGate";
import { MskPanel } from "@/components/msk/PanelShell";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Editor MSK — Painel Profissional" },
      {
        name: "description",
        content:
          "Editor profissional do MSK Agente: chat, preview real, projetos, GitHub e publicação. Acesso exclusivo para licenças ativas.",
      },
      { property: "og:title", content: "Editor MSK — Painel Profissional" },
      {
        property: "og:description",
        content: "Editor profissional do MSK Agente, liberado apenas com licença ativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  return (
    <LicenseGate>
      <MskPanel />
    </LicenseGate>
  );
}
