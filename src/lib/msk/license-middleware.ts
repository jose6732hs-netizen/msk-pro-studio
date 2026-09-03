/**
 * Middleware central de licença.
 *
 * - `attachMskAuth`: fase cliente, envia o token de sessão no header Authorization
 *   (nunca na query string). Registrado globalmente em src/start.ts.
 * - `requireActiveLicense`: fase servidor, bloqueia qualquer server function
 *   sensível quando não há sessão válida ou licença ativa.
 */

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export class LicenseDeniedError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "LicenseDeniedError";
    this.code = code;
  }
}

function clientCredentials(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const headers: Record<string, string> = {};
  try {
    const raw = window.localStorage.getItem("msk.panel.session");
    const token = raw ? (JSON.parse(raw) as { access_token?: string | null }).access_token : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    /* sessão inválida: segue sem token */
  }
  try {
    // Vínculo automático com a licença já validada no popup da extensão.
    const raw = window.localStorage.getItem("msk.panel.license");
    if (raw) {
      const parsed = JSON.parse(raw) as { email?: string; key?: string };
      if (parsed.email && parsed.key) {
        headers["x-msk-email"] = parsed.email;
        headers["x-msk-license"] = parsed.key;
      }
    }
  } catch {
    /* licença inválida: segue sem vínculo */
  }
  return headers;
}

export const attachMskAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const headers = clientCredentials();
  return Object.keys(headers).length ? next({ headers }) : next();
});

export const requireActiveLicense = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { licenseFromRequest } = await import("./license.server");
    const license = await licenseFromRequest(getRequest());
    if (!license.active) throw new LicenseDeniedError(license.reason);
    return next({ context: { license } });
  },
);
