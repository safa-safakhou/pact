// Synthetic, credential-free PACT-shaped benchmark input; never a game-state mutation.
export function fixture(index = 0) {
  const self = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const facts = (amount, rate) => ({
    ordinaryWhole: String(amount),
    foundingAllowanceWhole: "200",
    rates: { net: { perHourWhole: String(rate) } },
  });
  const guide = {
    self: { kingdomId: self, handle: `benchmark-${index}` },
    state: "active",
    worldStatus: "active",
    asOfGameTimeMs: 1791504000000 + index * 60000,
    resources: {
      grain: { facts: facts(30 + index, 22) },
      iron: { facts: facts(20 + index, 20) },
      silver: { facts: facts(10 + index, 10) },
    },
    buildings: ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"].map((kind) => ({ kind, level: 1 })),
    builders: [
      { slot: 1, instructionId: null },
      { slot: 2, instructionId: null },
    ],
    constructionStockChecks: ["farm", "mine", "market"].map((building) => ({
      building,
      targetLevel: 2,
      stockAffordable: true,
      busy: false,
      costWhole: { iron: "50", silver: "25" },
    })),
    coldContactStock: { affordable: true, costWhole: "2" },
    contacts: [{ kingdomId: other, handle: "benchmark-neighbour" }],
    contactRequests: [],
    openSupplyOffers: [],
    activeSupplyContracts: [],
    mandate: {
      allowedActions: ["world.read", "building.queue", "message.send.contact", "contact.request", "supply.sign"],
      resourceLimitsMarked: { grain: "300000", iron: "300000", silver: "300000" },
      reserveFloorsMarked: { grain: "12000" },
    },
  };
  return {
    actor: { index, memory: {} },
    guide,
    peers: [
      { kingdomId: self, nickname: "Benchmark owner" },
      { kingdomId: other, nickname: "Benchmark neighbour" },
    ],
    conversations: [
      {
        counterpartyKingdomId: other,
        messages: [
          {
            sender: "counterparty",
            body: "[Local model] I can exchange 3 iron/hour for 3 grain/hour for one hour without bonds. Are you interested?",
          },
        ],
      },
    ],
  };
}
