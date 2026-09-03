import { useCallback, useEffect, useState } from "react";
import { MskEventBus, sendToExtension } from "./bridge";

export interface ExtensionGateState {
  checking: boolean;
  blocked: boolean;
  code: string | null;
  message: string | null;
}

const INITIAL: ExtensionGateState = {
  checking: true,
  blocked: false,
  code: null,
  message: null,
};

export function useExtensionGate() {
  const [state, setState] = useState<ExtensionGateState>(INITIAL);

  const check = useCallback(() => {
    setState((prev) => ({ ...prev, checking: true }));
    sendToExtension("MSK_PANEL_GATE_CHECK" as never, { source: "panel" });
  }, []);

  useEffect(() => {
    const onStatus = (payload: Record<string, unknown>) => {
      const blocked = payload["blocked"] === true || payload["ok"] === false;
      setState({
        checking: false,
        blocked,
        code: payload["code"] ? String(payload["code"]) : null,
        message: payload["error"]
          ? String(payload["error"])
          : payload["reason"]
            ? String(payload["reason"])
            : blocked
              ? "A integridade da extensão MSK não pôde ser confirmada."
              : null,
      });
    };
    const offBlocked = MskEventBus.on("MSK_INTEGRATION_BLOCKED" as never, onStatus);
    const offStatus = MskEventBus.on("MSK_INTEGRATION_GATE_STATUS" as never, onStatus);
    const offReady = MskEventBus.on("MSK_INTEGRATION_READY" as never, () => {
      setState({ checking: false, blocked: false, code: null, message: null });
    });

    check();
    const timer = window.setTimeout(() => {
      // Sem extensão detectada/resposta, o backend/licença do painel continua sendo a autoridade.
      setState((prev) => (prev.checking ? { ...prev, checking: false } : prev));
    }, 2200);

    return () => {
      offBlocked();
      offStatus();
      offReady();
      window.clearTimeout(timer);
    };
  }, [check]);

  return { ...state, check };
}
