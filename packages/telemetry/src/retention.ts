export const retentionClasses = {
  rawEdgeMetadata: { id: "raw_edge_metadata", retainDays: 7, containsIp: true, ipRetainDays: 7 },
  securityAudit: { id: "security_audit", retainDays: 90, containsIp: true, ipRetainDays: 7 },
  productAnalytics: { id: "product_analytics", retainDays: 90, containsIp: false },
  operational: { id: "operational", retainDays: 30, containsIp: false },
} as const;

export type RetentionClass = keyof typeof retentionClasses;
