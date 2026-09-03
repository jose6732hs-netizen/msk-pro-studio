import { useCallback, useEffect, useState } from "react";
import type { MskNotification } from "./core";
import { MskEventBus, sendToExtension } from "./bridge";

export interface ExtensionNotification extends MskNotification {
  message?: string;
  source?: "extension-control-v2";
}

function normalize(value: unknown): ExtensionNotification[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const id = String(item["id"] ?? "").trim();
      if (!id) return null;
      const kindRaw = String(item["kind"] ?? "info").toLowerCase();
      const kind: MskNotification["kind"] =
        kindRaw === "error" || kindRaw === "warning" || kindRaw === "success"
          ? kindRaw
          : "info";
      return {
        id,
        title: String(item["title"] ?? "MSK SYSTEM").slice(0, 100),
        message: item["message"] ? String(item["message"]).slice(0, 700) : undefined,
        kind,
        created_at: String(item["created_at"] ?? new Date().toISOString()),
        read: Boolean(item["read"]),
        source: "extension-control-v2" as const,
      };
    })
    .filter((item): item is ExtensionNotification => Boolean(item));
}

export function useExtensionNotifications() {
  const [items, setItems] = useState<ExtensionNotification[]>([]);

  const refresh = useCallback(() => {
    sendToExtension("MSK_PANEL_NOTIFICATIONS_REQUEST" as never, { source: "panel" });
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    sendToExtension("MSK_PANEL_NOTIFICATION_READ" as never, { id });
  }, []);

  useEffect(() => {
    const offSync = MskEventBus.on("MSK_NOTIFICATIONS_SYNC" as never, (payload) => {
      setItems(normalize(payload["notifications"]));
    });
    const offRead = MskEventBus.on("MSK_NOTIFICATION_READ_RESULT" as never, (payload) => {
      if (payload["ok"] !== true) return;
      const id = String(payload["id"] ?? "");
      if (id) setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    });

    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offSync();
      offRead();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { items, refresh, markRead };
}
