import assert from "node:assert/strict";
import test from "node:test";
import { collectSocialWork, prioritySocialWork, rememberSocialOutcome, socialActionGuard } from "./social-work.mjs";

const self = "00000000-0000-4000-8000-000000000001",
  peer = "00000000-0000-4000-8000-000000000002";
test("incoming work persists across empty reads and leaves outgoing approval with the other owner", () => {
  const actor = { kingdomId: self };
  const work = collectSocialWork(
    actor,
    {},
    {
      interactions: {
        requests: [
          { id: "in", kingdomId: peer, direction: "incoming" },
          { id: "out", kingdomId: "other", direction: "outgoing" },
        ],
        messages: [{ id: "msg", senderKingdomId: peer, kingdomId: peer, body: "Counter rate?", sentGameTimeMs: "1" }],
      },
    },
  );
  assert.equal(
    socialActionGuard(actor, { kind: "game.contact.answer", requestId: "out", accept: true }, work).code,
    "CONTACT_REQUEST_NOT_INCOMING",
  );
  assert.equal(
    socialActionGuard(actor, { kind: "game.contact.answer", requestId: "in", accept: true }, work).code,
    undefined,
  );
  assert.equal(
    socialActionGuard(actor, { kind: "game.contact.request", recipientKingdomId: peer }, work).code,
    "REQUEST_EXISTS",
  );
  assert.equal(collectSocialWork(actor, {}, {}).pendingMessages[0].body, "Counter rate?");
});
test("only a committed reply clears pending work; duplicates without new work are refused", () => {
  const actor = { kingdomId: self };
  let work = collectSocialWork(
    actor,
    {},
    {
      interactions: {
        contacts: [{ kingdomId: peer }],
        messages: [{ id: "msg", senderKingdomId: peer, kingdomId: peer, body: "Counter rate?", sentGameTimeMs: "1" }],
      },
    },
  );
  const action = { kind: "game.message.send", recipientKingdomId: peer, body: "Agreed." };
  rememberSocialOutcome(actor, action, { code: "MESSAGE_QUEUE_FULL" }, socialActionGuard(actor, action, work));
  assert.equal(actor.socialAgenda[0].responded, false);
  rememberSocialOutcome(
    actor,
    action,
    { code: "COMMITTED", commandId: "receipt" },
    socialActionGuard(actor, action, work),
  );
  work = collectSocialWork(actor, {}, { interactions: { contacts: [{ kingdomId: peer }] } });
  assert.equal(work.pendingMessages.length, 0);
  assert.equal(socialActionGuard(actor, action, work).code, "DUPLICATE_MESSAGE");
  work = collectSocialWork(
    actor,
    {},
    {
      interactions: {
        contacts: [{ kingdomId: peer }],
        messages: [{ id: "new", senderKingdomId: peer, kingdomId: peer, body: "Confirm?", sentGameTimeMs: "2" }],
      },
    },
  );
  assert.equal(socialActionGuard(actor, action, work).code, undefined);
});
test("unchanged social denial is suppressed, while a new observed version permits recovery", () => {
  const actor = { kingdomId: self };
  const action = { kind: "game.supply.sign", offerId: "offer", version: 1 };
  let work = collectSocialWork(actor, {}, {});
  const guard = socialActionGuard(actor, action, work);
  rememberSocialOutcome(actor, action, { code: "INVALID_COMMAND" }, guard);
  assert.equal(socialActionGuard(actor, action, work).code, "REPEATED_DENIED_ACTION");
  work = collectSocialWork(actor, {}, { interactions: { supplyOffers: [{ id: "offer", version: 1 }] } });
  assert.equal(socialActionGuard(actor, action, work).code, undefined);
  assert.equal(prioritySocialWork(work).offers[0].id, "offer");
});
