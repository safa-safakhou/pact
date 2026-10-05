/** One read at a time, only while visible. Hiding or disposal cancels future reads. */
export function startVisiblePolling(
  poll: () => Promise<void>,
  visibility: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">,
  timers: {
    setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
    clearTimeout(id: ReturnType<typeof setTimeout>): void;
  } = globalThis,
  intervalMs = 10_000,
) {
  let disposed = false,
    running = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = undefined;
  };
  const tick = async () => {
    clear();
    if (disposed || visibility.hidden || running) return;
    running = true;
    try {
      await poll();
    } finally {
      running = false;
      if (!disposed && !visibility.hidden)
        timer = timers.setTimeout(() => {
          void tick();
        }, intervalMs);
    }
  };
  const changed = () => {
    clear();
    if (!visibility.hidden) void tick();
  };
  visibility.addEventListener("visibilitychange", changed);
  void tick();
  return () => {
    disposed = true;
    clear();
    visibility.removeEventListener("visibilitychange", changed);
  };
}
