import { useEffect, useState } from "react";
import { pactBaseUrl } from "./client-location.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Preferences = {
  categories: { id: string; label: string; critical: boolean }[];
  preferences: { category: string; channel: string; enabled: boolean }[];
  subscriptions: { id: string; created_at: string }[];
  webPushPublicKey: string | null;
};
export function NotificationSettings({ request, canWrite }: { request: Request; canWrite: boolean }) {
  const [data, setData] = useState<Preferences | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void request("/v1/notifications/preferences").then(
      (v) => {
        if (current) setData(v as unknown as Preferences);
      },
      () => {
        if (current) setError("Notification settings are unavailable. No permission was requested.");
      },
    );
    return () => {
      current = false;
    };
  }, [request]);
  async function run(action: () => Promise<unknown>) {
    if (!canWrite) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setData((await request("/v1/notifications/preferences")) as unknown as Preferences);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notification change failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="game-card">
      <summary>Optional notifications</summary>
      <p>
        Email and browser push start off. In-app history and security emails remain available. Alerts only point you to
        current game state; they never start an agent or approve an action.
      </p>
      {data?.categories.map((c) => (
        <fieldset key={c.id} disabled={!canWrite || busy}>
          <legend>{c.label}</legend>
          {(c.critical ? ["email", "webpush"] : ["webpush"]).map((channel) => (
            <label key={channel}>
              <input
                type="checkbox"
                checked={data.preferences.some((p) => p.category === c.id && p.channel === channel && p.enabled)}
                onChange={(e) =>
                  void run(() =>
                    request("/v1/notifications/preferences", "POST", {
                      category: c.id,
                      channel,
                      enabled: e.target.checked,
                    }),
                  )
                }
              />
              {channel === "email" ? "Email" : "Browser push"}
            </label>
          ))}
        </fieldset>
      ))}
      {data && (
        <button
          type="button"
          disabled={!canWrite || busy || !data.webPushPublicKey}
          onClick={() =>
            void run(async () => {
              if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window))
                throw new Error("Browser push is not supported here. Email and in-app history are available.");
              const permission = await Notification.requestPermission();
              if (permission !== "granted") throw new Error("Push permission was not granted. Nothing was registered.");
              const base = new URL(pactBaseUrl(), window.location.origin);
              const registration = await navigator.serviceWorker.register(new URL("notification-sw.js", base), {
                scope: base.pathname,
              });
              const subscription =
                (await registration.pushManager.getSubscription()) ??
                (await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: data.webPushPublicKey as string,
                }));
              const value = subscription.toJSON();
              try {
                await request("/v1/notifications/subscriptions", "POST", {
                  permission,
                  subscription: { endpoint: value.endpoint, keys: value.keys },
                });
              } catch (e) {
                await subscription.unsubscribe();
                throw e;
              }
            })
          }
        >
          Enable push on this browser
        </button>
      )}
      {data?.subscriptions.map((s) => (
        <p key={s.id}>
          Browser registered {new Date(s.created_at).toLocaleDateString()}{" "}
          <button
            type="button"
            disabled={!canWrite || busy}
            onClick={() =>
              void run(async () => {
                await request("/v1/notifications/subscriptions/" + s.id + "/revoke", "POST");
              })
            }
          >
            Revoke this browser subscription
          </button>
        </p>
      ))}
      {error && <p role="status">{error}</p>}
      <p>
        The first critical alert is prompt; further alerts in its category group for ten minutes. Routine browser alerts
        group for ten minutes. Lock-screen previews contain no message text or resource amounts.
      </p>
    </details>
  );
}
