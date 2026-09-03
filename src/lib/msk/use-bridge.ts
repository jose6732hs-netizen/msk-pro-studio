import { useEffect, useState } from "react";
import {
  MSK_EVENTS,
  MskEventBus,
  UNKNOWN_EXTENSION,
  startBridge,
  type ExtensionStatus,
} from "./bridge";

/** Estado da extensão MSK detectada no navegador (bridge segura, sem segredos). */
export function useExtensionBridge(): ExtensionStatus {
  const [status, setStatus] = useState<ExtensionStatus>(UNKNOWN_EXTENSION);

  useEffect(() => {
    const stop = startBridge(setStatus);
    const off = MskEventBus.on(MSK_EVENTS.ACTIVE_PROJECT_CHANGED, (payload) => {
      setStatus((prev) => ({
        ...prev,
        activeLovableProjectId: (payload["lovableProjectId"] as string) ?? prev.activeLovableProjectId,
        activeLovableUrl: (payload["lovableUrl"] as string) ?? prev.activeLovableUrl,
      }));
    });
    return () => {
      off();
      stop();
    };
  }, []);

  return status;
}
