/** A request ID selects a human review; it is never an approval credential. */
export function approvalReviewPath(approvalId: string, webBasePath = "/"): string {
  const path = new URL(webBasePath, "https://review.invalid").pathname;
  return `${path.replace(/\/$/, "")}/?approval=${encodeURIComponent(approvalId)}`;
}
