import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireActiveLicense } from "./license-middleware";
import type { LicenseResult } from "./license.server";

/**
 * Status da licença — única informação de licença que o frontend recebe.
 * Sem segredos, sem tokens, sempre com o horário do servidor.
 */
export const getLicenseStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<LicenseResult> => {
    const { licenseFromRequest } = await import("./license.server");
    return licenseFromRequest(getRequest());
  },
);

/**
 * Exemplo/guarda real de operação sensível do editor. Qualquer server function
 * que gere nova execução (IA, commit, publicação, upload…) deve usar
 * `.middleware([requireActiveLicense])` do mesmo jeito.
 */
export const authorizeEditorOperation = createServerFn({ method: "POST" })
  .middleware([requireActiveLicense])
  .inputValidator((data: { operation: string }) => ({
    operation: String(data?.operation ?? "").slice(0, 64),
  }))
  .handler(async ({ data, context }) => ({
    ok: true as const,
    operation: data.operation,
    // Nova execução só é autorizada até o expires_at real do servidor.
    authorizedUntil: context.license.expiresAt,
  }));
