import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/license/activate
 *
 * Validador profissional de acesso ao Painel. Aceita:
 *  - { mode: "password", email, password }  → login real no backend MSK
 *  - { mode: "license",  email, license }   → mesma licença usada no popup
 *
 * A validação é 100% no servidor. Nada é liberado só com JavaScript do cliente.
 */
const schema = z.union([
  z.object({
    mode: z.literal("password"),
    email: z.string().trim().email().max(255),
    password: z.string().min(6).max(200),
  }),
  z.object({
    mode: z.literal("license"),
    email: z.string().trim().email().max(255),
    license: z.string().trim().min(6).max(200),
  }),
]);

export const Route = createFileRoute("/api/license/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "cache-control": "no-store" };
        let input: z.infer<typeof schema>;
        try {
          input = schema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400, headers });
        }

        const {
          signInWithPassword,
          getLicenseByKey,
          verifySessionToken,
          getActiveLicenseForUser,
          httpStatusFor,
        } = await import("@/lib/msk/license.server");

        if (input.mode === "password") {
          const signIn = await signInWithPassword(input.email, input.password);
          if (!signIn.ok) {
            return Response.json(
              { ok: false, code: signIn.code },
              { status: signIn.code === "BACKEND_NOT_CONFIGURED" ? 503 : 401, headers },
            );
          }
          const user = await verifySessionToken(signIn.accessToken);
          if (!user) {
            return Response.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401, headers });
          }
          const license = await getActiveLicenseForUser(user.userId, signIn.accessToken);
          if (!license.active) {
            return Response.json(
              { ok: false, code: license.reason, license },
              { status: httpStatusFor(license.reason), headers },
            );
          }
          // O token devolvido é a sessão do próprio usuário — nenhuma chave do servidor.
          return Response.json(
            { ok: true, accessToken: signIn.accessToken, email: signIn.email, license },
            { headers },
          );
        }

        const license = await getLicenseByKey(input.email, input.license);
        if (!license.active) {
          return Response.json(
            { ok: false, code: license.reason, license },
            { status: httpStatusFor(license.reason), headers },
          );
        }
        return Response.json({ ok: true, email: input.email, license }, { headers });
      },
    },
  },
});
