/**
 * MSK — patch do popup/sidepanel (não altera nada do que já existe).
 *
 * 1. Adiciona o botão "ABRIR PAINEL PROFISSIONAL".
 * 2. Ao abrir, VINCULA automaticamente a licença já validada no popup:
 *    grava { email, key } em localStorage do painel via chrome.scripting —
 *    nenhum token, licença ou chave vai na URL.
 * 3. Sem licença ativa, o botão vira "RENOVAR PLANO".
 *
 * A segurança real é do servidor (/api/license/status e /api/editor/*).
 */
(function () {
  const EDITOR_URL = "https://msksystem.online/editor";
  const STATUS_URL = "https://msksystem.online/api/license/status";
  const PLANS_URL = "https://msksystem.online/planos";

  function linkedPayload(license) {
    return {
      email: String(license?.email || "").trim().toLowerCase(),
      key: String(license?.token || license?.license_key || "").trim(),
    };
  }

  function injectLink(tabId, payload) {
    if (!payload.email || !payload.key) return;
    chrome.scripting.executeScript({
      target: { tabId },
      args: [payload],
      func: (data) => {
        try {
          localStorage.setItem("msk.panel.license", JSON.stringify(data));
        } catch (e) {
          /* painel decide o que fazer */
        }
      },
    });
  }

  async function openPanel() {
    const stored = await chrome.storage.local.get(["mskLicense"]);
    const payload = linkedPayload(stored?.mskLicense);
    const tab = await chrome.tabs.create({ url: EDITOR_URL });
    if (!tab?.id) return;
    const listener = (tabId, info) => {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      injectLink(tab.id, payload);
      chrome.tabs.reload(tab.id);
    };
    chrome.tabs.onUpdated.addListener(listener);
  }

  function setRenew(btn) {
    btn.textContent = "RENOVAR PLANO";
    btn.style.background = "#1f1f1f";
    btn.style.color = "#fff";
    btn.onclick = () => chrome.tabs.create({ url: PLANS_URL });
  }

  function setOpen(btn) {
    btn.textContent = "ABRIR PAINEL PROFISSIONAL ↗";
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
    if (d > 0) return p(d) + " DIAS · " + h + ":" + m + ":" + ss;
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
      el.textContent = "🔴 LICENÇA INATIVA";
      el.style.color = "#ff5f5f";
      return;
    }
    const left = (clock.expires - Date.now()) / 1000;
    const dot = left < 3600 ? "🔴" : left < 86400 ? "🟡" : "🟢";
    el.style.color = left < 3600 ? "#ff5f5f" : left < 86400 ? "#ffd75f" : "#39ff5f";
    el.textContent = dot + " " + clock.plan + " · " + fmt(left) + " restantes";
  }

  function mountClock() {
    if (document.getElementById("msk-license-clock")) return;
    const el = document.createElement("div");
    el.id = "msk-license-clock";
    el.style.cssText =
      "margin:8px 12px 0;padding:8px 10px;border:1px solid #1f2a20;border-radius:10px;" +
      "background:#0a0f0b;font:600 11px/1.2 monospace;text-align:center;letter-spacing:.04em";
    document.body.appendChild(el);
    paintClock(el);
    setInterval(() => paintClock(el), 1000);
    void syncLicense().then(() => paintClock(el));
    setInterval(() => void syncLicense(), 60000);
  }

  function mount() {
    mountClock();
    if (document.getElementById("msk-open-panel")) return;
    const btn = document.createElement("button");
    btn.id = "msk-open-panel";
    btn.type = "button";
    btn.style.cssText =
      "display:block;width:calc(100% - 24px);margin:10px 12px;padding:12px;border:0;border-radius:10px;" +
      "font-weight:700;letter-spacing:.04em;cursor:pointer;font-size:12px";
    setOpen(btn);
    document.body.appendChild(btn);
    void refresh(btn);
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
})();
