export interface AdminOverview {
  generatedAt: string;
  since: string;
  hours: number;
  world: null | {
    status: string;
    rulesId: string;
    tick: string;
    gameTimeMs: string;
    nextTickDueAt: string;
    heartbeatAt: string;
    pausedAt: string | null;
  };
  identity: {
    players: number;
    administrators: number;
    joined: number;
    closing: number;
    active: number;
    security: { type: string; count: number }[];
  };
  game: {
    society: Record<string, number>;
    moderation: { open: number; overdue: number };
    collection: { cursor: string; pending: number };
  };
  economy: {
    resource: string;
    ordinary: string;
    allowance: string;
    locked: string;
    production: string;
    atCapacity: number;
  }[];
  agents: {
    runs: { status: string; count: number }[];
    usage: { calls: string; tokens: string; failed: number };
    leases: { kind: string; count: number }[];
    external: { observations: number; accounts: number };
    hosts: { id: string; heartbeatAt: string; available: boolean }[];
  };
  platform: {
    receipts: { code: string; count: number }[];
    trend: { hour: string; count: number }[];
    jobs: { failed: number; due: number; overdue: number };
    events: { id: string; type: string; occurredAt: string }[];
  };
}
export interface AdminKingdomPage {
  players: {
    id: string;
    handle: string;
    name: string;
    status: string;
    joinedAt: string;
    hall: number | null;
    lastActionGameTimeMs: string | null;
  }[];
  total: number;
  offset: number;
  pageSize: number;
}
