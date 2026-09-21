interface TelegramMiniApp {
  readonly initData: string;
  ready(): void;
  expand(): void;
}

interface Window {
  readonly Telegram?: { readonly WebApp?: TelegramMiniApp };
}
