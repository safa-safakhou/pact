import { describe, expect, it, vi } from "vitest";
import { bindHost, type MiniAppHost, subscribeBack } from "./host.js";

describe("Telegram presentation contract", () => {
  it("updates stable viewport, themes and both safe areas; removes every listener on teardown", () => {
    const callbacks = new Map<string, () => void>();
    const props = new Map<string, string>();
    const host: MiniAppHost = {
      initData: "untrusted-not-authority",
      themeParams: { bg_color: "#123456", text_color: "url(evil)" },
      viewportStableHeight: 600,
      safeAreaInset: { top: 24, bottom: 30, left: 0, right: 0 },
      contentSafeAreaInset: { top: 56, bottom: 0, left: 8, right: 0 },
      ready: vi.fn(),
      expand: vi.fn(),
      openLink: vi.fn(),
      onEvent: (event, callback) => {
        callbacks.set(event, callback);
      },
      offEvent: (event, callback) => {
        if (callbacks.get(event) === callback) callbacks.delete(event);
      },
    };
    const cleanup = bindHost(host, {
      setProperty: (key, value) => {
        props.set(key, value ?? "");
      },
    });
    expect(props.get("--tg-bg")).toBe("#123456");
    expect(props.has("--tg-text")).toBe(false);
    expect(props.get("--tg-safe-top")).toBe("56px");
    expect(props.get("--tg-safe-bottom")).toBe("30px");
    expect(props.get("--tg-stable-height")).toBe("600px");
    expect(callbacks.size).toBe(4);
    expect(host.ready).toHaveBeenCalledOnce();
    cleanup();
    expect(callbacks.size).toBe(0);
  });
  it("binds and removes the same back handler without triggering a command", () => {
    const handler = vi.fn(),
      onClick = vi.fn(),
      offClick = vi.fn();
    const host: MiniAppHost = {
      initData: "",
      ready: vi.fn(),
      expand: vi.fn(),
      openLink: vi.fn(),
      BackButton: { show: vi.fn(), hide: vi.fn(), onClick, offClick },
    };
    const cleanup = subscribeBack(host, handler);
    expect(onClick).toHaveBeenCalledWith(handler);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
    expect(offClick).toHaveBeenCalledWith(handler);
  });
});
