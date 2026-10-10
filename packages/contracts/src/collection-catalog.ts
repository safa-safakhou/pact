/** Versioned presentation catalog. Predicates are verified by PACT's trusted rule projections. */
export const COLLECTION_CATALOG_VERSION = "society-collections-1" as const;
export const collectionSets = [
  { id: "founding", name: "Founding Archive", trophy: "trophy.hall_shelf", trophyName: "Hall Display Shelf" },
  {
    id: "negotiator",
    name: "Negotiator's Desk",
    trophy: "trophy.writing_desk",
    trophyName: "Illuminated Writing Desk",
  },
  {
    id: "battlefield",
    name: "Battlefield Cabinet",
    trophy: "trophy.campaign_plinth",
    trophyName: "Campaign Display Plinth",
  },
  { id: "world", name: "World Archive", trophy: "trophy.season_hanging", trophyName: "Seasonal Wall Hanging" },
] as const;
export type CollectionSetId = (typeof collectionSets)[number]["id"];
export const collectionPieces = [
  {
    id: "first_stone",
    item: "ornament.stone_marker",
    set: "founding",
    name: "Stone Marker",
    achievement: "First Stone",
    earnedGems: 25,
    condition: "Complete an existing building upgrade.",
  },
  {
    id: "opened_channel",
    item: "ornament.courier_knot",
    set: "founding",
    name: "Courier's Knot",
    achievement: "Opened a Channel",
    earnedGems: 0,
    condition:
      "After accepting contact, each participant receives and acknowledges at least one direct message from the other.",
  },
  {
    id: "first_pact",
    item: "ornament.crossed_ribbon",
    set: "founding",
    name: "Crossed Ribbon",
    achievement: "First Pact",
    earnedGems: 25,
    condition: "Deliver a complete positive supply installment in both directions in the same tick.",
  },
  {
    id: "kept_the_table",
    item: "ornament.table",
    set: "founding",
    name: "Table Ornament",
    achievement: "Kept the Table",
    earnedGems: 25,
    condition: "Naturally complete a supply contract of at least six game hours without default.",
  },
  {
    id: "terms_changed",
    item: "ornament.margin_notes",
    set: "negotiator",
    name: "Margin Notes",
    achievement: "Terms Changed",
    earnedGems: 0,
    condition:
      "A recorded counteroffer changes resource, positive quantity or duration from the initial offer; matched final signatures activate it and a complete positive tick is delivered both ways.",
  },
  {
    id: "three_trading_partners",
    item: "ornament.many_seal_ledger",
    set: "negotiator",
    name: "Many-Seal Ledger",
    achievement: "Three Trading Partners",
    earnedGems: 0,
    condition:
      "Complete positive bilateral supply ticks with three distinct counterpart kingdoms, excluding a known same owner.",
  },
  {
    id: "three_resources_exchanged",
    item: "ornament.three_ink_inkwell",
    set: "negotiator",
    name: "Three-Ink Inkwell",
    achievement: "Three Resources Exchanged",
    earnedGems: 0,
    condition:
      "Complete bilateral positive supply ticks whose installments include Grain, Iron and Silver; each resource counts once.",
  },
  {
    id: "own_your_words",
    item: "ornament.wax_stamp",
    set: "negotiator",
    name: "Wax Stamp",
    achievement: "Own Your Words",
    earnedGems: 25,
    condition: "Publish a valid Seal. The ornament does not endorse its claim.",
  },
  {
    id: "answered_the_call",
    item: "ornament.barracks_shield",
    set: "battlefield",
    name: "Barracks Shield",
    achievement: "Answered the Call",
    earnedGems: 25,
    condition: "Participate as visiting ordinary troops in a successful defense.",
  },
  {
    id: "breach",
    item: "ornament.dented_gate",
    set: "battlefield",
    name: "Dented Gate",
    achievement: "Breach",
    earnedGems: 25,
    condition: "Participate in a successful raid under the existing achievement rule.",
  },
  {
    id: "came_back",
    item: "ornament.repaired_banner",
    set: "battlefield",
    name: "Repaired Banner",
    achievement: "Came Back",
    earnedGems: 25,
    condition: "Complete new ordinary training after a recorded ordinary-troop battle loss.",
  },
  {
    id: "took_the_field",
    item: "ornament.campaign_medallion",
    set: "battlefield",
    name: "Campaign Medallion",
    achievement: "Took the Field",
    earnedGems: 0,
    condition:
      "A resolved raid records your ordinary troops as eligible at combat lock. Either result qualifies; declarations and cancellations do not.",
  },
  {
    id: "winter_stores",
    item: "ornament.winter_lantern",
    set: "world",
    name: "Winter Lantern",
    achievement: "Winter Stores",
    earnedGems: 25,
    condition: "Fund every required minute of upkeep in a complete low-harvest week under the existing rule.",
  },
  {
    id: "place_at_council",
    item: "ornament.council_pin",
    set: "world",
    name: "Council Pin",
    achievement: "A Place at the Council",
    earnedGems: 0,
    condition:
      "Remain an accepted Court member for six continuous game hours with at least two distinct-owner members present throughout.",
  },
  {
    id: "through_season",
    item: "ornament.season_thread",
    set: "world",
    name: "Season Thread",
    achievement: "Through a Season",
    earnedGems: 0,
    condition: "Receive the actual existing meaningful-days season-participation entitlement.",
  },
  {
    id: "another_agreement",
    item: "ornament.renewal_ribbon",
    set: "world",
    name: "Renewal Ribbon",
    achievement: "Another Agreement",
    earnedGems: 0,
    condition:
      "Naturally complete a six-hour-or-longer contract without default, then complete a positive bilateral tick in a different contract with the same counterpart.",
  },
] as const;
export type CollectionAchievementId = (typeof collectionPieces)[number]["id"];
export const collectionAsset = (itemId: string) => `/assets/collections/${itemId.replaceAll(".", "-")}.svg`;
