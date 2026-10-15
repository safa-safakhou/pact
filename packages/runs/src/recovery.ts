/** Bounds the caller even if a provider ignores cancellation; late results cannot execute tools. */
export function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  late?: (value: T) => Promise<void>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let aborted = false;
    const abort = () => {
      aborted = true;
      reject(signal.reason ?? new Error("EXECUTION_ABORTED"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (aborted && late) void late(value).catch(() => {});
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
