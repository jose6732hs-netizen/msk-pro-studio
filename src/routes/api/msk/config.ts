import { createFileRoute } from "@tanstack/react-router";

/**
 * Configuração PÚBLICA do backend MSK (URL + chave publicável/anon).
 * A chave anon é pública por definição e o RLS continua sendo aplicado.
 * Nenhuma chave de serviço é exposta aqui.
 */
export const Route = createFileRoute("/api/msk/config")({
  server: {
    handlers: {
      GET: async () => {
        const env = process.env as Record<string, string | undefined>;
        const url = env["MSK_SUPABASE_URL"] ?? env["SUPABASE_URL"] ?? "";
        const anonKey =
          env["MSK_SUPABASE_ANON_KEY"] ??
          env["SUPABASE_PUBLISHABLE_KEY"] ??
          env["SUPABASE_ANON_KEY"] ??
          "";
        const api = env["MSK_SYSTEM_URL"] ?? "https://msksystem.online";
        if (!url || !anonKey) {
          return new Response(JSON.stringify({ configured: false }), {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
        return new Response(JSON.stringify({ configured: true, url, anonKey, api }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
