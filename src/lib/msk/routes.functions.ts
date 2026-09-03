import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Descobre as ETAPAS (rotas) reais do projeto a partir da URL do preview.
 * Só é chamada quando existe um projeto identificado — nada é assumido.
 * Ordem: sitemap.xml → links internos da home. Nunca inventa rotas.
 */
export const discoverProjectRoutes = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }) => {
    let origin: string;
    try {
      origin = new URL(data.url).origin;
    } catch {
      return { routes: [] as string[] };
    }

    const found = new Set<string>(["/"]);
    const add = (raw: string) => {
      if (!raw.startsWith("/") || raw.startsWith("//")) return;
      const clean = raw.split("#")[0]!.split("?")[0]!.replace(/\/+$/, "") || "/";
      if (clean.length > 40) return;
      found.add(clean);
    };

    try {
      const sitemap = await fetch(`${origin}/sitemap.xml`, { redirect: "follow" });
      if (sitemap.ok) {
        const xml = await sitemap.text();
        for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
          try {
            add(new URL(m[1]!).pathname);
          } catch {
            /* loc inválida */
          }
        }
      }
    } catch {
      /* sem sitemap */
    }

    if (found.size <= 1) {
      try {
        const home = await fetch(origin, { redirect: "follow" });
        if (home.ok) {
          const html = await home.text();
          for (const m of html.matchAll(/href=["'](\/[^"'>\s]*)["']/g)) add(m[1]!);
        }
      } catch {
        /* home indisponível */
      }
    }

    const routes = Array.from(found)
      .filter((r) => !/\.(css|js|png|jpe?g|svg|ico|webp|json|xml|txt|woff2?)$/i.test(r))
      .sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))
      .slice(0, 24);

    return { routes };
  });
