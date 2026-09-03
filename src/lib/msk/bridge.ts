/**
 * MSK BRIDGE — camada de comunicação segura Painel Profissional ↔ Extensão MSK.
 *
 * Regras:
 * - o painel só aceita mensagens do PRÓPRIO window (content script da extensão);
 * - o payload é mínimo: versão, projeto Lovable ativo, run ativo;
 * - nenhum token, licença completa ou segredo trafega por aqui;
 * - o BACKEND continua sendo a fonte de verdade — a bridge só traz contexto.
 */

export const MSK_BRIDGE_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Eventos padronizados                                                */
/* ------------------------------------------------------------------ */

export const MSK_EVENTS = {
  PANEL_HELLO: "MSK_PANEL_HELLO",
  PANEL_READY: "MSK_PANEL_READY",
  EXTENSION_READY: "MSK_EXTENSION_READY",
  ACTIVE_CONTEXT_UPDATED: "MSK_ACTIVE_CONTEXT_UPDATED",
  ACTIVE_PROJECT_CHANGED: "MSK_ACTIVE_PROJECT_CHANGED",
  PROJECT_CHANGED: "MSK_PROJECT_CHANGED",
  REPOSITORY_CHANGED: "MSK_REPOSITORY_CHANGED",
  BRANCH_CHANGED: "MSK_BRANCH_CHANGED",
  PREVIEW_CHANGED: "MSK_PREVIEW_CHANGED",
  CONVERSATION_CHANGED: "MSK_CONVERSATION_CHANGED",
  RUN_CHANGED: "MSK_RUN_CHANGED",
  SKILLS_CHANGED: "MSK_SKILLS_CHANGED",
  PANEL_PROJECT_SELECTED: "MSK_PANEL_PROJECT_SELECTED",
  PANEL_GITHUB_CONNECT: "MSK_PANEL_GITHUB_CONNECT",
  PANEL_GITHUB_STATUS: "MSK_PANEL_GITHUB_STATUS",
  GITHUB_STATUS: "MSK_GITHUB_STATUS",
  PANEL_CHAT_SEND: "MSK_PANEL_CHAT_SEND",
  CHAT_MESSAGE: "MSK_CHAT_MESSAGE",
  PANEL_REPOSITORY_SELECTED: "MSK_PANEL_REPOSITORY_SELECTED",
  PANEL_LIST_REPOS: "MSK_PANEL_LIST_REPOS",
  GITHUB_REPOS: "MSK_GITHUB_REPOS",

  PANEL_PROJECT_URL_SET: "MSK_PANEL_PROJECT_URL_SET",
  PANEL_DOWNLOAD_PROJECT: "MSK_PANEL_DOWNLOAD_PROJECT",
  PROJECT_DOWNLOAD_STATUS: "MSK_PROJECT_DOWNLOAD_STATUS",
  GITHUB_CONNECTED: "MSK_GITHUB_CONNECTED",
  RUN_CREATED: "MSK_RUN_CREATED",
  RUN_UPDATED: "MSK_RUN_UPDATED",
  RUN_COMPLETED: "MSK_RUN_COMPLETED",
  RUN_FAILED: "MSK_RUN_FAILED",
  ATTACHMENT_CREATED: "MSK_ATTACHMENT_CREATED",
  SKILLS_UPDATED: "MSK_SKILLS_UPDATED",
  LICENSE_UPDATED: "MSK_LICENSE_UPDATED",
  NOTIFICATION_CREATED: "MSK_NOTIFICATION_CREATED",
  EXTENSION_UPDATE_AVAILABLE: "MSK_EXTENSION_UPDATE_AVAILABLE",
} as const;

export type MskEventType = (typeof MSK_EVENTS)[keyof typeof MSK_EVENTS];

export interface MskBridgeEnvelope {
  channel: "msk-bridge";
  bridgeVersion: number;
  type: MskEventType;
  payload?: Record<string, unknown>;
}

export interface ExtensionStatus {
  installed: boolean;
  checking: boolean;
  extensionVersion: string | null;
  bridgeVersion: number | null;
  compatible: boolean;
  activeLovableProjectId: string | null;
  activeLovableUrl: string | null;
  currentRunId: string | null;
  pinned: boolean;
}

export const UNKNOWN_EXTENSION: ExtensionStatus = {
  installed: false,
  checking: true,
  extensionVersion: null,
  bridgeVersion: null,
  compatible: true,
  activeLovableProjectId: null,
  activeLovableUrl: null,
  currentRunId: null,
  pinned: false,
};

/* ------------------------------------------------------------------ */
/* Event bus interno do frontend                                       */
/* ------------------------------------------------------------------ */

type Handler = (payload: Record<string, unknown>) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(type: MskEventType, handler: Handler) {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  emit(type: MskEventType, payload: Record<string, unknown> = {}) {
    this.handlers.get(type)?.forEach((h) => {
      try {
        h(payload);
      } catch {
        /* um handler com erro não pode derrubar os demais */
      }
    });
  }
}

/** Barramento único do painel — evita listeners espalhados pelos componentes. */
export const MskEventBus = new EventBus();

/* ------------------------------------------------------------------ */
/* Transporte (window.postMessage ↔ content script da extensão)         */
/* ------------------------------------------------------------------ */

function isEnvelope(value: unknown): value is MskBridgeEnvelope {
  const v = value as MskBridgeEnvelope | undefined;
  return Boolean(v && v.channel === "msk-bridge" && typeof v.type === "string");
}

/** Envia um evento para a extensão (o content script escuta no mesmo window). */
export function sendToExtension(type: MskEventType, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const envelope: MskBridgeEnvelope = {
    channel: "msk-bridge",
    bridgeVersion: MSK_BRIDGE_VERSION,
    type,
    payload,
  };
  window.postMessage(envelope, window.location.origin);
}

/**
 * Inicia a bridge: faz o handshake e repassa todos os eventos ao MskEventBus.
 * Retorna uma função de limpeza.
 */
export function startBridge(onStatus: (status: ExtensionStatus) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let settled = false;

  const onMessage = (event: MessageEvent) => {
    // Só aceitamos mensagens da própria página (content script injetado no domínio MSK).
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (!isEnvelope(event.data)) return;

    const { type, payload = {}, bridgeVersion } = event.data;

    if (type === MSK_EVENTS.EXTENSION_READY) {
      settled = true;
      onStatus({
        installed: true,
        checking: false,
        extensionVersion: (payload["extensionVersion"] as string) ?? null,
        bridgeVersion: bridgeVersion ?? null,
        compatible: (bridgeVersion ?? 0) >= MSK_BRIDGE_VERSION,
        activeLovableProjectId: (payload["activeLovableProjectId"] as string) ?? null,
        activeLovableUrl: (payload["activeLovableUrl"] as string) ?? null,
        currentRunId: (payload["currentRunId"] as string) ?? null,
        pinned: Boolean(payload["pinned"]),
      });

      // O EXTENSION_READY também carrega o ActiveContext completo.
      MskEventBus.emit(MSK_EVENTS.ACTIVE_CONTEXT_UPDATED, payload);
    }

    MskEventBus.emit(type, payload);
  };

  window.addEventListener("message", onMessage);

  // Handshake: PANEL_HELLO → (extensão) EXTENSION_READY
  sendToExtension(MSK_EVENTS.PANEL_HELLO, { bridgeVersion: MSK_BRIDGE_VERSION });
  const retry = window.setTimeout(() => {
    if (!settled) sendToExtension(MSK_EVENTS.PANEL_HELLO, { bridgeVersion: MSK_BRIDGE_VERSION });
  }, 400);
  const giveUp = window.setTimeout(() => {
    if (!settled) onStatus({ ...UNKNOWN_EXTENSION, checking: false });
  }, 1600);

  sendToExtension(MSK_EVENTS.PANEL_READY, { bridgeVersion: MSK_BRIDGE_VERSION });

  return () => {
    window.clearTimeout(retry);
    window.clearTimeout(giveUp);
    window.removeEventListener("message", onMessage);
  };
}
