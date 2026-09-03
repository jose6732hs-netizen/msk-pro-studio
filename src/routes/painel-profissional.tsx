import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias estável: /painel-profissional → /editor (mesma camada de licença).
export const Route = createFileRoute("/painel-profissional")({
  beforeLoad: () => {
    throw redirect({ to: "/editor" });
  },
});
