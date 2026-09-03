import { createFileRoute } from "@tanstack/react-router";

/**
 * Configuração PÚBLICA do backend MSK.
 * URL e publishable key podem chegar por env; o fallback abaixo é público e
 * mantém o painel ligado ao MESMO Supabase usado pelo MSK Agente.
 * Nenhuma service-role/secret key é exposta.
 */
export const Route = createFileRoute("/api/msk/config")({
  server: {
    handlers: {
      GET: async () => {
        const env = process.env as Record<string, string | undefined>;
        const url =
          env["MSK_SUPABASE_URL"] ??
          env["SUPABASE_URL"] ??
          "https://iybjfmhqbblrppqoodyf.supabase.co";
        const anonKey =
          env["MSK_SUPABASE_ANON_KEY"] ??
          env["SUPABASE_PUBLISHABLE_KEY"] ??
          env["SUPABASE_ANON_KEY"] ??
          "sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD";
        const api = env["MSK_SYSTEM_URL"] ?? "https://msksystem.online";

        return new Response(JSON.stringify({ configured: true, url, anonKey, api }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
