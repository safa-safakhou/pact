import { describe, expect, it } from "vitest";
import { linkedGameTab } from "./game-navigation.js";

describe("human game destinations", () => {
  it.each(["?court=qwen_mv0r3xnz", "?invite=fixture", "?politics=fixture", "?council=introductions"])(
    "reveals People for %s",
    (search) => expect(linkedGameTab(search)).toBe("People"),
  );
  it.each(["?seal=fixture", "?post=fixture", "?chronicle=fixture", "?sealSource=fixture"])(
    "reveals Chronicle for %s",
    (search) => expect(linkedGameTab(search)).toBe("Chronicle"),
  );
  it.each(["?approval=fixture", "?inbox=fixture", "?notifications=fixture", "?envoy=edit"])(
    "reveals Envoy for %s",
    (search) => expect(linkedGameTab(search)).toBe("Envoy"),
  );
  it("keeps the normal Council entry collapsed for unrecognized destinations", () => {
    for (const search of ["", "?unrelated=fixture", "?council=unknown"]) expect(linkedGameTab(search)).toBeNull();
  });
});
