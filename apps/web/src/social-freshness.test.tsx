import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contactState, noticeDates, OutgoingContactHistory } from "./social-freshness.js";

describe("source-backed social expectations", () => {
  it("labels fresh, expired, undated and invalid notices without using wall time", () => {
    expect(
      noticeDates({ status: "published", publishedAt: "2026-10-03T10:00:00Z", expiresGameTimeMs: 600000 }),
    ).toContain("Unexpired as of server read");
    expect(
      noticeDates({ status: "expired", publishedAt: "2026-10-03T10:00:00Z", expiresGameTimeMs: 600000 }),
    ).toContain("Expired notice");
    expect(noticeDates({ status: "published" })).toContain("Freshness unknown");
    expect(noticeDates({ status: "published", publishedAt: "bad", expiresGameTimeMs: NaN })).toContain(
      "expiry unknown",
    );
  });
  it("keeps four recorded request states separate, including crossed but unsettled pending", () => {
    const r = { id: "fixture", status: "pending", handle: "real", expiresGameTimeMs: "600000" };
    expect(contactState(r, 0)).toContain("Response time unknown");
    expect(contactState(r, 600000)).toContain("Recorded pending; deadline passed");
    expect(contactState({ ...r, status: "accepted" }, 0)).toContain("recipient human recorded acceptance");
    expect(contactState({ ...r, status: "declined" }, 0)).toContain("respect");
    expect(contactState({ ...r, status: "expired" }, 0)).toContain("no acceptance");
  });
  it("retains explicit unavailable and empty history with no generated counterpart", () => {
    expect(renderToStaticMarkup(<OutgoingContactHistory entries={undefined} gameTimeMs={0} />)).toContain(
      "history unavailable",
    );
    expect(renderToStaticMarkup(<OutgoingContactHistory entries={[]} gameTimeMs={0} />)).toContain("leave and return");
    const html = renderToStaticMarkup(
      <OutgoingContactHistory
        entries={[{ id: "real", handle: "real", status: "pending", expiresGameTimeMs: "100" }]}
        gameTimeMs={0}
      />,
    );
    expect(html).toContain("waiting for the recipient human");
    expect(html).not.toContain("online");
  });
});
