import { afterEach, expect, it, vi } from "vitest";
import { startVisiblePolling } from "./visible-polling.js";

afterEach(() => vi.useRealTimers());
it("polls serially while visible, resumes on return and disposes listeners/timers", async () => {
  vi.useFakeTimers();
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  let finish = () => {};
  const poll = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const stop = startVisiblePolling(poll, visibility as unknown as Document);
  expect(poll).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(poll).toHaveBeenCalledTimes(1);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event("visibilitychange"));
  finish();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(poll).toHaveBeenCalledTimes(1);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  expect(poll).toHaveBeenCalledTimes(2);
  finish();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(poll).toHaveBeenCalledTimes(3);
  stop();
  finish();
  await vi.advanceTimersByTimeAsync(30_000);
  visibility.dispatchEvent(new Event("visibilitychange"));
  expect(poll).toHaveBeenCalledTimes(3);
});
