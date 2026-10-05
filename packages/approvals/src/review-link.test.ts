import { describe, expect, it } from "vitest";
import { approvalReviewPath } from "./review-link.js";

describe("human review routing", () => {
  it("retains the application deployment path without granting approval", () => {
    expect(approvalReviewPath("request-id", "/pact")).toBe("/pact/?approval=request-id");
    expect(approvalReviewPath("request-id", "/pact/")).toBe("/pact/?approval=request-id");
    expect(approvalReviewPath("request-id")).toBe("/?approval=request-id");
    expect(approvalReviewPath("id&approve=true", "/")).toBe("/?approval=id%26approve%3Dtrue");
  });
});
