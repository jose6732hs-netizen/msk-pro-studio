import { createFileRoute } from "@tanstack/react-router";
import { httpStatusFor, licenseFromRequest } from "@/lib/msk/license.server";

/**
 * Guarda central de TODAS as rotas HTTP sensíveis do editor:
 * /api/editor/agent, /api/editor/projects, /api/editor/github,
 * /api/editor/attachments, /api/editor/publish, /api/editor/preview,
 * /api/editor/watermark, /api/editor/skills, /api/editor/history…
 *
 * Sem licença ativa: 403 { ok:false, code } e nenhum dado de projeto sai daqui.
 */
async function guarded(request: Request) {
  const license = await licenseFromRequest(request);
  if (!license.active) {
    return Response.json(
      { ok: false, code: license.reason },
      { status: httpStatusFor(license.reason), headers: { "cache-control": "no-store" } },
    );
  }
  const resource = new URL(request.url).pathname.replace("/api/editor/", "");
  return Response.json(
    {
      ok: true,
      resource,
      plan: license.planName,
      expiresAt: license.expiresAt,
      serverNow: license.serverNow,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/editor/$")({
  server: {
    handlers: {
      GET: ({ request }) => guarded(request),
      POST: ({ request }) => guarded(request),
      PATCH: ({ request }) => guarded(request),
      DELETE: ({ request }) => guarded(request),
    },
  },
});
