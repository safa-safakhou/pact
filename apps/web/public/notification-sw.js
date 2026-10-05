/* Advisory notifications only. No private-page cache, game writes, or inference. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {}
  const body =
    typeof data.body === "string" ? data.body.slice(0, 160) : "Action is available. Open PACT to review your inbox.";
  const tag = typeof data.tag === "string" ? data.tag.slice(0, 32) : "pact";
  event.waitUntil(self.registration.showNotification("PACT", { body, tag }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(self.registration.scope);
  url.searchParams.set("inbox", "");
  event.waitUntil(self.clients.openWindow(url.href));
});
