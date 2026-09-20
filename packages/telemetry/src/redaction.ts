const redacted = "[REDACTED]";
const sensitiveKey =
  /^(authorization|cookie|setcookie|password|passwordhash|secret|token|accesstoken|refreshtoken|apikey|credential|email|prompt|message|messagebody|body|transcript|providerrequest|providerresponse)$/i;
const applicationErrorCodes = new Set([
  "AUTHENTICATION_FAILED",
  "AUTHORIZATION_FAILED",
  "23503",
  "23505",
  "23514",
  "40001",
  "40P01",
  "55P03",
  "57014",
  "CONFLICT",
  "DATABASE_ERROR",
  "PROVIDER_FAILED",
  "RATE_LIMITED",
  "TIMEOUT",
  "UNAVAILABLE",
  "UNEXPECTED_ERROR",
  "VALIDATION_ERROR",
  "XX000",
]);

function normalizedKey(key: string): string {
  return key.replaceAll(/[-_\s.]/g, "");
}

export function isSensitiveKey(key: string): boolean {
  return sensitiveKey.test(normalizedKey(key));
}

export function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (applicationErrorCodes.has(code) || /^FST_[A-Z0-9_]{1,60}$/.test(code)) return code;
  }
  return "UNEXPECTED_ERROR";
}

export function redactTelemetry(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (value instanceof Error) return { name: value.name, code: safeErrorCode(value) };
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactTelemetry(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? redacted : redactTelemetry(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") return value.slice(0, 512);
  return value;
}

export const fastifyRedactionPaths = [
  "authorization",
  "password",
  "token",
  "apiKey",
  "credential",
  "email",
  "prompt",
  "message",
  "messageBody",
  "body",
  "transcript",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.authorization",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.credential",
  "*.email",
  "*.prompt",
  "*.message",
  "*.messageBody",
  "*.body",
  "*.transcript",
] as const;
