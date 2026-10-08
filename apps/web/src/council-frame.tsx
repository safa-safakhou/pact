import { playHtml } from "@pact/mcp/play-view";
import { useEffect, useRef, useState } from "react";
import { isCouncilHumanLink } from "./council-links.js";

/** Only presentation reads and the human's cosmetic edit are bridged. No game/approval tool can execute here. */
export function CouncilFrame({
  request,
}: {
  request: (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1100);
  useEffect(() => {
    let ready = false;
    async function data(search = "", offset = 0) {
      return {
        ...(await request(`/v1/game/council?search=${encodeURIComponent(search)}&offset=${offset}`)),
        canCustomize: true,
        editCharacter: new URLSearchParams(location.search).get("envoy") === "edit",
      };
    }
    async function listener(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.jsonrpc !== "2.0") return;
      const m = event.data;
      const respond = (result: unknown, error?: unknown) =>
        frame.current?.contentWindow?.postMessage(
          {
            jsonrpc: "2.0",
            id: m.id,
            ...(error
              ? { error: { code: -32000, message: "The request could not be completed. Refresh PACT." } }
              : { result }),
          },
          "*",
        );
      try {
        if (m.method === "ui/initialize") {
          respond({
            protocolVersion: "2026-01-26",
            hostInfo: { name: "PACT web", version: "1" },
            hostCapabilities: { openLinks: {}, serverTools: {} },
          });
          return;
        }
        if (m.method === "ui/notifications/initialized" && !ready) {
          ready = true;
          frame.current?.contentWindow?.postMessage(
            { jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: await data() } },
            "*",
          );
          return;
        }
        if (m.method === "ui/notifications/size-changed") {
          const value = m.params?.height;
          if (typeof value === "number" && Number.isFinite(value)) setHeight(Math.max(400, Math.min(30000, value)));
          return;
        }
        if (m.method === "tools/call") {
          const a = m.params?.arguments ?? {};
          if (m.params?.name === "pact_play_view_v1") {
            respond({
              structuredContent: await data(
                typeof a.search === "string" ? a.search : "",
                Number.isSafeInteger(a.offset) ? a.offset : 0,
              ),
            });
            return;
          }
          if (m.params?.name === "pact_council_thread_v1") {
            const query = new URLSearchParams({ kingdomId: String(a.kingdomId ?? "") });
            if (a.beforeId !== undefined) {
              query.set("beforeId", String(a.beforeId));
              query.set("beforeGameTimeMs", String(a.beforeGameTimeMs));
            }
            respond({ structuredContent: await request(`/v1/game/council/thread?${query}`) });
            return;
          }
          if (m.params?.name === "pact_player_find_v1") {
            respond({ structuredContent: await request(`/v1/people/${encodeURIComponent(String(a.handle ?? ""))}`) });
            return;
          }
        }
        if (m.method === "pact/character.save") {
          respond(await request("/v1/game/council/character", "PUT", m.params));
          return;
        }
        if (m.method === "ui/open-link") {
          const url = new URL(String(m.params?.url ?? ""), location.origin);
          if (!isCouncilHumanLink(url, location.origin)) throw Error("INVALID_LINK");
          window.open(url.href, "_blank", "noopener,noreferrer");
          respond({});
          return;
        }
        if (m.id !== undefined) respond(null, true);
      } catch {
        respond(null, true);
      }
    }
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [request]);
  return (
    <iframe
      ref={frame}
      title="Your kingdom council"
      srcDoc={playHtml}
      sandbox="allow-scripts"
      style={{ width: "100%", height, border: 0, borderRadius: 12 }}
    />
  );
}
