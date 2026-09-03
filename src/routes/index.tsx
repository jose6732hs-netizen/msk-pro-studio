import { createFileRoute } from "@tanstack/react-router";
import { MskPanel } from "@/components/msk/PanelShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MSK Agente — Painel Profissional de Edição" },
      {
        name: "description",
        content:
          "Central completa de edição MSK Agente: chat com o agente, preview real, projetos Lovable, repositórios GitHub, histórico e publicação.",
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
  component: MskPanel,
});
