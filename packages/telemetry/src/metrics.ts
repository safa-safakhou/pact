function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

function safeMetricLabel(value: string): string {
  return /^[a-z0-9_-]{1,64}$/i.test(value) ? value : "unknown";
}

export class MetricRegistry {
  readonly #providerErrors = new Map<string, number>();
  readonly #queueLagSeconds = new Map<string, number>();
  #ready = 0;

  recordProviderError(provider: string, code: string): void {
    const key = `${safeMetricLabel(provider)}\u0000${safeMetricLabel(code)}`;
    this.#providerErrors.set(key, (this.#providerErrors.get(key) ?? 0) + 1);
  }

  setQueueLag(queue: string, seconds: number): void {
    this.#queueLagSeconds.set(safeMetricLabel(queue), Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  }

  setReady(ready: boolean): void {
    this.#ready = ready ? 1 : 0;
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP pact_ready Whether the process dependency probe is ready.",
      "# TYPE pact_ready gauge",
      `pact_ready ${this.#ready}`,
      "# HELP pact_queue_lag_seconds Age of the oldest ready item by queue.",
      "# TYPE pact_queue_lag_seconds gauge",
    ];
    for (const [queue, value] of [...this.#queueLagSeconds].sort()) {
      lines.push(`pact_queue_lag_seconds{queue="${escapeLabel(queue)}"} ${value}`);
    }
    lines.push(
      "# HELP pact_provider_errors_total Sanitized provider failures by provider and stable code.",
      "# TYPE pact_provider_errors_total counter",
    );
    for (const [key, value] of [...this.#providerErrors].sort()) {
      const [provider, code] = key.split("\u0000");
      lines.push(
        `pact_provider_errors_total{provider="${escapeLabel(provider ?? "unknown")}",code="${escapeLabel(code ?? "unknown")}"} ${value}`,
      );
    }
    return `${lines.join("\n")}\n`;
  }
}
