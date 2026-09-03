import { createFileRoute } from "@tanstack/react-router";
import { httpStatusFor, licenseFromRequest } from "@/lib/msk/license.server";

/**
 * GET /api/license/status
 * Só devolve informação segura (plano, expiração, horário do servidor).
 */
export const Route = createFileRoute("/api/license/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const license = await licenseFromRequest(request);
        return Response.json(license, {
          status: license.active ? 200 : httpStatusFor(license.reason),
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
