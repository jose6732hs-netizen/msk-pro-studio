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

function clientToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("msk:session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string | null };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

export const attachMskAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = clientToken();
  return token ? next({ headers: { Authorization: `Bearer ${token}` } }) : next();
});

export const requireActiveLicense = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { licenseFromRequest } = await import("./license.server");
    const license = await licenseFromRequest(getRequest());
    if (!license.active) throw new LicenseDeniedError(license.reason);
    return next({ context: { license } });
  },
);
