export interface MiniAppHost {
  readonly initData: string;
  readonly themeParams?: Readonly<Record<string, string | undefined>>;
  readonly viewportStableHeight?: number;
  readonly safeAreaInset?: Insets;
  readonly contentSafeAreaInset?: Insets;
  readonly BackButton?: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  onEvent?(event: string, callback: () => void): void;
  offEvent?(event: string, callback: () => void): void;
}
type Insets = { top: number; bottom: number; left: number; right: number };
/** Presentation only. No host field grants account authority. */
export function bindHost(host: MiniAppHost, style: Pick<CSSStyleDeclaration, "setProperty">): () => void {
  const apply = () => {
    const colors = {
      bg_color: "--tg-bg",
      text_color: "--tg-text",
      secondary_bg_color: "--tg-card",
      button_color: "--tg-button",
      button_text_color: "--tg-button-text",
    };
    for (const [key, variable] of Object.entries(colors)) {
      const color = host.themeParams?.[key];
      if (color && /^#[0-9a-f]{6}$/i.test(color)) style.setProperty(variable, color);
    }
    if (Number.isFinite(host.viewportStableHeight) && Number(host.viewportStableHeight) > 0)
      style.setProperty("--tg-stable-height", host.viewportStableHeight + "px");
    for (const edge of ["top", "bottom", "left", "right"] as const) {
      const values = [host.safeAreaInset?.[edge] ?? 0, host.contentSafeAreaInset?.[edge] ?? 0];
      const inset = Math.max(...values.map((v) => (Number.isFinite(v) ? Math.max(0, Math.min(v, 200)) : 0)));
      style.setProperty("--tg-safe-" + edge, inset + "px");
    }
  };
  const events = ["themeChanged", "viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"];
  apply();
  for (const event of events) host.onEvent?.(event, apply);
  host.ready();
  host.expand();
  return () => {
    for (const event of events) host.offEvent?.(event, apply);
    host.BackButton?.hide();
  };
}
export function subscribeBack(host: MiniAppHost, callback: () => void): () => void {
  host.BackButton?.onClick(callback);
  return () => host.BackButton?.offClick(callback);
}
