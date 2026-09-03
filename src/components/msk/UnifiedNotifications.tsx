import { X } from "lucide-react";
import type { MskNotification } from "@/lib/msk/core";
import { timeAgo } from "@/lib/msk/core";
import { NotificationService } from "@/lib/msk/services";
import type { ExtensionNotification } from "@/lib/msk/use-extension-notifications";

export function UnifiedNotificationsPopover({
  onClose,
  backendNotifications,
  extensionNotifications,
  backendConfigured,
  sessionToken,
  onReadExtension,
}: {
  onClose: () => void;
  backendNotifications: MskNotification[];
  extensionNotifications: ExtensionNotification[];
  backendConfigured: boolean;
  sessionToken: string | null;
  onReadExtension: (id: string) => void;
}) {
  const merged = new Map<string, MskNotification | ExtensionNotification>();
  backendNotifications.forEach((n) => merged.set(n.id, n));
  extensionNotifications.forEach((n) => merged.set(n.id, n));
  const items = [...merged.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-2xl">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Notificações MSK
        </p>
        <button type="button" onClick={onClose} aria-label="Fechar">
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="msk-scroll max-h-72 overflow-y-auto">
        {!backendConfigured && extensionNotifications.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Aguardando conexão com o MSK System ou com a extensão.
          </p>
        )}
        {items.length === 0 && backendConfigured && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Nada por aqui.</p>
        )}
        {items.map((n) => {
          const ext = (n as ExtensionNotification).source === "extension-control-v2";
          return (
            <button
              key={`${ext ? "ext" : "db"}:${n.id}`}
              type="button"
              onClick={() => {
                if (ext) onReadExtension(n.id);
                else void NotificationService.markRead(sessionToken, n.id);
              }}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-secondary ${n.read ? "opacity-60" : ""}`}
            >
              <span
                className={`mt-1 size-1.5 shrink-0 rounded-full ${
                  n.kind === "error"
                    ? "bg-destructive"
                    : n.kind === "warning"
                      ? "bg-warning"
                      : "bg-primary"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{n.title}</span>
                {(n as ExtensionNotification).message && (
                  <span className="mt-0.5 block line-clamp-2 text-[10px] text-muted-foreground">
                    {(n as ExtensionNotification).message}
                  </span>
                )}
                <span className="block text-[10px] text-muted-foreground">
                  {ext ? "Extensão · " : "Painel · "}{timeAgo(n.created_at)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
