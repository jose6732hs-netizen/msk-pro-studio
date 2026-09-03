/**
 * MSK — patch do popup/sidepanel da extensão (não altera nada do que já existe).
 *
 * Adiciona o botão "ABRIR PAINEL PROFISSIONAL" e o troca por "RENOVAR PLANO"
 * quando a licença não está ativa. Isto é apenas UX: a segurança real está no
 * backend (/api/license/status, /api/editor/*, middleware requireActiveLicense).
 *
 * Nenhum token, user_id, licença ou chave vai na URL.
 */
(function () {
  const EDITOR_URL = "https://msksystem.online/editor";
  const PLANS_URL = "https://msksystem.online/planos";
  const STATUS_URL = "https://msksystem.online/api/license/status";

  function mount() {
    if (document.getElementById("msk-open-panel")) return;
    const btn = document.createElement("button");
    btn.id = "msk-open-panel";
    btn.type = "button";
    btn.textContent = "ABRIR PAINEL PROFISSIONAL ↗";
    btn.style.cssText =
      "display:block;width:100%;margin:10px 0;padding:12px;border:0;border-radius:10px;" +
      "background:#39ff5f;color:#05130a;font-weight:700;letter-spacing:.04em;cursor:pointer";
    btn.addEventListener("click", () => {
      // Sem parâmetros sensíveis: o editor autentica pela sessão do SaaS.
      chrome.tabs.create({ url: EDITOR_URL });
    });
    document.body.appendChild(btn);
    refresh(btn);
  }

  function setRenew(btn) {
    btn.textContent = "RENOVAR PLANO";
    btn.style.background = "#2a2a2a";
    btn.style.color = "#fff";
    btn.onclick = () => chrome.tabs.create({ url: PLANS_URL });
  }

  async function refresh(btn) {
    try {
      const store = await chrome.storage.local.get(["mskAccessToken", "sb-access-token"]);
      const token = store.mskAccessToken || store["sb-access-token"];
      const res = await fetch(STATUS_URL, {
        headers: token ? { Authorization: "Bearer " + token } : {},
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.active) setRenew(btn);
    } catch {
      // Sem resposta do servidor: não prometer acesso.
      setRenew(btn);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
  setInterval(() => {
    const btn = document.getElementById("msk-open-panel");
    if (btn) refresh(btn);
  }, 60000);
})();
