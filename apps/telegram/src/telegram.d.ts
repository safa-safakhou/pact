interface TelegramMiniApp {
  readonly initData: string;
  ready(): void;
  expand(): void;
  openLink(url: string): void;
}

interface Window {
  readonly Telegram?: { readonly WebApp?: TelegramMiniApp };
}
