import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ApprovalDecision, type ApprovalReviewData, approvalIsPending } from "./approval-review.js";

const review: ApprovalReviewData = {
  approvalId: "private-record-id",
  status: "pending",
  effectsSummary:
    "Queue market level 3 in builder slot 2; construction costs 120 Iron and 90 Silver if eligible when work starts. Founding allowance may cover some or all of the cost; an unstarted waiting instruction debits no stock. Human approval issues an exact one-use construction permit.",
  expiresAt: "2026-10-07T15:22:30.000Z",
  receipt: null,
};
function html(value: ApprovalReviewData, now = Date.parse("2026-10-07T15:20:00Z"), canWrite = true) {
  return renderToStaticMarkup(
    <ApprovalDecision
      review={value}
      now={now}
      busy={false}
      canWrite={canWrite}
      onDecide={() => {
        throw Error("render must not approve");
      }}
    />,
  );
}
it("shows the exact Market action and server cost, without a UUID or a manual preview step", () => {
  const output = html(review);
  expect(output).toContain("Upgrade market to level 3");
  expect(output).toContain("120 Iron + 90 Silver");
  expect(output).toContain("Approve: Upgrade market to level 3");
  expect(output).toContain("regular permissions stay the same");
  expect(output).not.toContain("private-record-id");
  expect(output).not.toContain("Preview");
});
it("removes approval controls at the exact deadline and explains recovery", () => {
  const now = Date.parse(review.expiresAt);
  expect(approvalIsPending(review, now)).toBe(false);
  const output = html(review, now);
  expect(output).toContain("request has expired");
  expect(output).toContain("fresh request");
  expect(output).not.toContain("<button");
});
it("does not offer another approval for a resolved request or claim construction is complete", () => {
  const output = html({ ...review, status: "approved", receipt: { code: "COMMITTED" } });
  expect(output).not.toContain("<button");
  expect(output).toContain("approval is not building completion");
});
it("disables decisions while the human connection cannot write", () => {
  expect(html(review, undefined, false)).toContain('disabled=""');
});
