/**
 * MSK — patch do popup/sidepanel (não altera nada do que já existe).
 *
 * 1. Adiciona uma BARRA COMPACTA no rodapé (não cobre o chat nem as mensagens):
 *    botão pequeno "PAINEL ↗" + relógio da licença na mesma linha.
 * 2. Ao abrir, VINCULA automaticamente ao painel: licença validada + contexto
 *    ativo (projeto Lovable, repositório GitHub, branch, preview) via
 *    chrome.scripting — nenhum token/segredo vai na URL.
 * 3. Sem licença ativa, o botão vira "RENOVAR".
 *
 * A segurança real é do servidor (/api/license/status e /api/editor/*).
 */
(function () {
  const EDITOR_URL = "https://msksystem.online/editor";
  const STATUS_URL = "https://msksystem.online/api/license/status";
  const PLANS_URL = "https://msksystem.online/planos";
  const BAR_H = 64;

  function linkedPayload(license) {
    return {
      email: String(license?.email || "").trim().toLowerCase(),
      key: String(license?.token || license?.license_key || "").trim(),
    };
  }

  /* ---------------- contexto ativo (projeto + GitHub) ---------------- */

  const pick = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        const nested = pick(v, keys);
        if (nested) return nested;
      }
    }
    return null;
  };

  async function readActiveContext() {
    let all = {};
    try {
      all = (await chrome.storage.local.get(null)) || {};
    } catch (e) {
      all = {};
    }
    const repoFull =
      pick(all, ["repository", "repoFullName", "fullName", "githubRepoFull"]) || null;
    const owner = pick(all, ["githubOwner", "owner", "repoOwner"]);
    const repo = pick(all, ["githubRepo", "repoName"]);
    const ctx = {
      userId: pick(all, ["userId", "user_id"]),
      projectId: pick(all, ["projectId", "project_id"]),
      lovableProjectId: pick(all, ["lovableProjectId", "lovable_project_id"]),
      lovableProjectName: pick(all, ["lovableProjectName", "projectName", "project_name"]),
      lovableUrl: pick(all, ["lovableUrl", "lovable_url"]),
      githubOwner: owner || (repoFull ? repoFull.split("/")[0] : null),
      githubRepo: repo || (repoFull ? repoFull.split("/")[1] : null),
      githubRepoUrl: pick(all, ["githubRepoUrl", "repoUrl", "html_url"]),
      branch: pick(all, ["branch", "activeBranch", "defaultBranch"]),
      previewUrl: pick(all, ["previewUrl", "preview_url"]),
      productionUrl: pick(all, ["productionUrl", "production_url"]),
      conversationId: pick(all, ["conversationId", "conversation_id"]),
      activeRunId: pick(all, ["activeRunId", "currentRunId"]),
      aiProvider: pick(all, ["aiProvider"]),
      aiModel: pick(all, ["aiModel"]),
      extensionVersion: chrome.runtime?.getManifest?.().version || null,
      updatedAt: new Date().toISOString(),
    };
    // fallback: pega o projeto Lovable a partir da aba ativa
    if (!ctx.lovableProjectId) {
      try {
        const tabs = await chrome.tabs.query({ url: "https://lovable.dev/projects/*" });
        const m = tabs?.[0]?.url?.match(/projects\/([0-9a-f-]{36})/i);
        if (m) {
          ctx.lovableProjectId = m[1];
          ctx.lovableUrl = tabs[0].url;
          if (!ctx.lovableProjectName && tabs[0].title)
            ctx.lovableProjectName = String(tabs[0].title).replace(/\s*[-–|].*$/, "").trim();
        }
      } catch (e) {
        /* sem permissão de tabs: segue sem fallback */
      }
    }
    // fallback 2: qualquer link de projeto aberto no PC (localhost, domínio próprio,
    // preview publicado etc.) deve refletir no preview do painel
    if (!ctx.previewUrl) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const u = tab?.url ? new URL(tab.url) : null;
        const isHttp = u && /^https?:$/.test(u.protocol);
        const isEditor = u && /(^|\.)lovable\.dev$/i.test(u.hostname);
        const isPanel = u && /msk-pro-studio\.lovable\.app$/i.test(u.hostname);
        if (isHttp && !isEditor && !isPanel) {
          ctx.previewUrl = u.origin + (u.pathname === "/" ? "" : u.pathname);
          if (!ctx.productionUrl && /^https:$/.test(u.protocol)) ctx.productionUrl = u.origin;
        }
      } catch (e) {
        /* sem permissão de tabs: segue sem fallback */
      }
    }
    const hasAny = Object.values(ctx).some(
      (v, i) => i < 12 && typeof v === "string" && v.length > 0,
    );
    return hasAny ? ctx : null;
  }

  function inject(tabId, payload, ctx) {
    if (!payload.email && !payload.key && !ctx) return;
    chrome.scripting.executeScript({
      target: { tabId },
      args: [payload, ctx],
      func: (lic, context) => {
        try {
          if (lic && lic.email && lic.key)
            localStorage.setItem("msk.panel.license", JSON.stringify(lic));
          if (context) {
            const prev = (() => {
              try {
                return JSON.parse(localStorage.getItem("msk.panel.active_context") || "{}");
              } catch (e) {
                return {};
              }
            })();
            const merged = { ...prev };
            Object.keys(context).forEach((k) => {
              if (context[k] !== null && context[k] !== undefined) merged[k] = context[k];
            });
            localStorage.setItem("msk.panel.active_context", JSON.stringify(merged));
          }
        } catch (e) {
          /* painel decide o que fazer */
        }
      },
    });
  }

  async function openPanel() {
    const stored = await chrome.storage.local.get(["mskLicense"]);
    const payload = linkedPayload(stored?.mskLicense);
    const ctx = await readActiveContext();
    const tab = await chrome.tabs.create({ url: EDITOR_URL });
    if (!tab?.id) return;
    const listener = (tabId, info) => {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      inject(tab.id, payload, ctx);
      chrome.tabs.reload(tab.id);
    };
    chrome.tabs.onUpdated.addListener(listener);
  }

  function setRenew(btn) {
    btn.textContent = "RENOVAR";
    btn.style.background = "#1f1f1f";
    btn.style.color = "#fff";
    btn.onclick = () => chrome.tabs.create({ url: PLANS_URL });
  }

  function setOpen(btn) {
    btn.textContent = "PAINEL ↗";
    btn.style.background = "#39ff5f";
    btn.style.color = "#05130a";
    btn.onclick = () => void openPanel();
  }

  async function refresh(btn) {
    const stored = await chrome.storage.local.get(["mskLicense"]);
    const lic = stored?.mskLicense;
    const active =
      lic && lic.active === true && (!lic.expires_at || Date.parse(lic.expires_at) > Date.now());
    if (active) setOpen(btn);
    else setRenew(btn);
  }

  // ---- Contador da licença (mesma fonte do painel: o backend) ----------------
  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const d = Math.floor(s / 86400);
    const p = (n) => String(n).padStart(2, "0");
    const h = p(Math.floor((s % 86400) / 3600));
    const m = p(Math.floor((s % 3600) / 60));
    const ss = p(s % 60);
    if (d > 0) return d + "d " + h + ":" + m + ":" + ss;
    if (Number(h) > 0) return h + ":" + m + ":" + ss;
    return m + ":" + ss;
  }

  const clock = { expires: 0, plan: "", active: false };

  async function syncLicense() {
    const stored = await chrome.storage.local.get(["mskLicense"]);
    const lic = stored?.mskLicense || {};
    const payload = linkedPayload(lic);
    if (!payload.email || !payload.key) {
      clock.active = false;
      return;
    }
    try {
      const res = await fetch(STATUS_URL, {
        headers: { "x-msk-email": payload.email, "x-msk-license": payload.key },
        cache: "no-store",
      });
      const data = await res.json();
      clock.active = data?.active === true;
      clock.plan = data?.planName || "MSK AGENTE";
      // Ancorado no relógio do SERVIDOR, não no do computador.
      clock.expires = clock.active
        ? Date.now() + Number(data.remainingSeconds || 0) * 1000
        : 0;
    } catch (e) {
      clock.active = false; // offline: sem contagem inventada
    }
  }

  function paintClock(el) {
    if (!clock.active) {
      el.textContent = "🔴 licença inativa";
      el.style.color = "#ff5f5f";
      return;
    }
    const left = (clock.expires - Date.now()) / 1000;
    const dot = left < 3600 ? "🔴" : left < 86400 ? "🟡" : "🟢";
    el.style.color = left < 3600 ? "#ff5f5f" : left < 86400 ? "#ffd75f" : "#39ff5f";
    el.textContent = dot + " " + fmt(left);
  }

  function mount() {
    if (document.getElementById("msk-panel-bar")) return;

    const bar = document.createElement("div");
    bar.id = "msk-panel-bar";
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:center;" +
      "gap:8px;height:28px;padding:0 8px;box-sizing:border-box;background:#050705;" +
      "border-top:1px solid #172a1b";

    const btn = document.createElement("button");
    btn.id = "msk-open-panel";
    btn.type = "button";
    btn.style.cssText =
      "flex:0 0 auto;border:0;border-radius:6px;padding:4px 10px;font:700 10px/1 system-ui,sans-serif;" +
      "letter-spacing:.04em;cursor:pointer";
    setOpen(btn);

    const clockEl = document.createElement("span");
    clockEl.id = "msk-license-clock";
    clockEl.style.cssText =
      "margin-left:auto;font:600 10px/1 ui-monospace,monospace;letter-spacing:.03em;white-space:nowrap";

    bar.appendChild(btn);
    bar.appendChild(clockEl);
    document.body.appendChild(bar);

    // Não cobre o chat nem a área de mensagens.
    const pad = document.body.style.paddingBottom;
    if (!pad || parseInt(pad, 10) < 28) document.body.style.paddingBottom = "28px";

    void refresh(btn);
    paintClock(clockEl);
    setInterval(() => paintClock(clockEl), 1000);
    void syncLicense().then(() => paintClock(clockEl));
    setInterval(() => void syncLicense(), 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  chrome.storage.onChanged.addListener((changes) => {
    const btn = document.getElementById("msk-open-panel");
    if (btn && changes.mskLicense) void refresh(btn);
  });
  setInterval(() => {
    const btn = document.getElementById("msk-open-panel");
    if (btn) void refresh(btn);
  }, 60000);
  void BAR_H;
})();
