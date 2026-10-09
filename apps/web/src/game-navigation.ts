export type GameTab = "Kingdom" | "Envoy" | "People" | "Chronicle";

export function linkedGameTab(search: string): GameTab | null {
  const query = new URLSearchParams(search);
  if (["seal", "post", "chronicle", "sealSource"].some((key) => query.has(key))) return "Chronicle";
  if (query.get("council") === "introductions" || ["court", "invite", "politics"].some((key) => query.has(key)))
    return "People";
  if (query.get("envoy") === "edit" || ["approval", "inbox", "notifications"].some((key) => query.has(key)))
    return "Envoy";
  return null;
}
