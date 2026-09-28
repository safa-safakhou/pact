export async function readWebResponse(response: Response): Promise<Record<string, unknown>> {
  const bodyText = await response.text();
  if (!bodyText && response.ok) throw new Error("INVALID_RESPONSE");
  let value: Record<string, unknown> = {};
  try {
    value = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    if (response.ok) throw new Error("INVALID_RESPONSE");
  }
  if (!response.ok)
    throw new Error(String((value.error as { code?: string } | undefined)?.code ?? `HTTP_${response.status}`));
  return value;
}
