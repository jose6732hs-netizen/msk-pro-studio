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

  function mount() {
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
