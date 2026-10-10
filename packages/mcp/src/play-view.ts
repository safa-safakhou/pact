import { landscapeScript } from "./kingdom-landscape.js";
/** Self-contained kingdom journal. No remote assets, credentials, or gameplay mutations. */
export const playHtml = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PACT · Your kingdom</title><style>body{color-scheme:light dark}.landscape-legend{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;font:12px system-ui}.landscape-legend span{padding-top:5px}#view .message p{overflow-wrap:anywhere;white-space:pre-wrap}#view .your-envoy button{margin-left:auto}
#view{--paper:light-dark(#f4eddb,#1c2e28);--lift:light-dark(#eae1c9,#263b32);--ink:light-dark(#274336,#eee3c8);--muted:light-dark(#69735f,#b8bea5);--rule:light-dark(#d4c9ad,#425648);--green:light-dark(#315743,#466d51);--amber:light-dark(#856325,#dfbd7a);font-family:Georgia,serif;color:var(--ink);color-scheme:light dark;max-width:960px;margin:auto}
#view *{box-sizing:border-box}#view .council-app{background:var(--paper);border-radius:12px;overflow:hidden}#view .council-header{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:24px 24px 15px;flex-wrap:wrap}#view small{font:11px system-ui;letter-spacing:1.3px;color:var(--muted)}#view h2{font-size:27px;font-weight:400;margin:7px 0 0}#view h3{font-size:20px;font-weight:400;margin:0}#view button,#view input{font:13px system-ui;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:5px;min-height:38px;padding:8px 11px}#view button[aria-pressed=true],#view button.primary{background:var(--green);color:#f4e9ce;border-color:var(--green)}#view button:disabled{opacity:.55}#view .customize{margin-right:70px}#view .council-nav{display:flex;gap:8px;padding:0 24px 17px;border-bottom:1px solid var(--rule)}#view .council-nav button{border:0}
#view .council-body{padding:20px 24px 25px}#view .your-envoy{display:flex;align-items:center;gap:14px;padding-bottom:18px}#view .portrait{display:block;width:74px;height:84px;border-radius:8px;flex-shrink:0;background:#b5b995}#view .your-envoy h3{margin:5px 0}#view .your-envoy div>span{font:12px system-ui;color:var(--muted)}#view .presence{font:11px system-ui;color:var(--muted);display:flex;align-items:center;gap:6px}#view .presence::before{content:"";width:7px;height:7px;border-radius:50%;background:#9a957c;flex-shrink:0}#view .presence.connected::before,#view .own-presence::before{background:#7aa16e}#view .own-presence{margin-left:auto}
#view .conversation-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:9px 0 16px}#view .conversation-toolbar>div{display:flex;gap:5px;flex-wrap:wrap}#view .conversation-toolbar button{border:0;background:transparent;padding:7px 9px}#view .conversation-toolbar button[aria-pressed=true]{background:var(--green)}#view .conversation-toolbar button span{opacity:.7;margin-left:5px}
#view .envoy-roster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}#view .envoy-card{position:relative;text-align:left;min-width:0;border:0;border-bottom:3px solid transparent;background:var(--lift);padding:14px;border-radius:8px;display:flex;flex-direction:column;gap:8px}#view .envoy-card[aria-pressed=true]{background:var(--lift);color:var(--ink);border-bottom-color:var(--green)}#view .envoy-face-row{display:flex;align-items:flex-end;gap:9px}#view .envoy-card .portrait{width:61px;height:69px}#view .envoy-card .kingdom-name{font:16px Georgia,serif;overflow-wrap:anywhere}#view .envoy-card .envoy-name{font:11px system-ui;color:var(--muted);margin-top:5px}#view .envoy-card .last-word{font:12px system-ui;line-height:1.5;color:var(--muted)}#view .envoy-card .waiting{font:11px system-ui;color:var(--amber)}#view .envoy-card .presence{margin-top:2px;line-height:1.4}
#view .negotiation{border-top:1px solid var(--rule);padding-top:20px}#view .negotiation-heading{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}#view .negotiation-heading h3{margin-top:5px;font-size:24px}#view .thread-status{font:12px system-ui;color:var(--amber)}#view .presence-strip{display:flex;flex-wrap:wrap;gap:8px 22px;margin:12px 0 19px;font:12px system-ui;color:var(--muted)}#view .thread-summary{background:var(--lift);padding:17px 19px;border-radius:8px}#view .thread-summary p{font-size:16px;line-height:1.65;margin:7px 0 9px}#view .thread-summary button{padding:0;min-height:30px;background:transparent;border:0;text-decoration:underline;font:12px system-ui}
#view .terms{display:flex;flex-wrap:wrap;gap:15px 30px;padding:19px 0 14px}#view .term{display:flex;flex-direction:column;gap:6px;font:12px system-ui;color:var(--muted)}#view .term strong{font:18px Georgia,serif;color:var(--ink)}#view .term.pending strong{color:var(--amber)}#view .messages{display:flex;flex-direction:column;gap:13px;margin:10px 0}#view .message{display:flex;gap:12px;align-items:flex-start}#view .message .portrait{width:36px;height:41px;border-radius:5px}#view .message-content{flex:1;min-width:0}#view .message-header{font:11px system-ui;color:var(--muted);margin:2px 0 5px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}#view .message p{font-size:15px;line-height:1.65;margin:0;padding:11px 14px;background:var(--lift);border-radius:0 7px 7px}#view .message.own p{background:light-dark(#e1e7d6,#2c4337)}#view .message.highlight p{box-shadow:inset 3px 0 var(--amber)}#view .thread-action{font:12px system-ui;color:var(--muted);margin-top:18px;line-height:1.6}#view .thread-action button{margin-right:8px}
#view .decision-review{margin-top:15px;border:1px solid var(--rule);border-radius:8px;padding:18px;background:var(--lift);font:13px system-ui;line-height:1.7}#view .decision-review h4{font:19px Georgia,serif;margin:0 0 8px}#view .decision-review .decision-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}#view .council-notice{font:11px system-ui;color:var(--muted);margin:20px 0 0}
#view .character-editor{display:flex;align-items:center;gap:20px;padding:20px 24px;background:var(--lift);border-bottom:1px solid var(--rule)}#view .editor-portrait{width:120px;height:135px}#view .character-editor>div{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;flex:1}#view .character-editor label{display:flex;flex-direction:column;gap:6px;font:11px system-ui;color:var(--muted);max-width:100%;flex:1 1 160px}#view .character-editor input{width:100%;min-width:0}#view .character-editor input[type=color]{width:54px;padding:4px}#view .kingdom-panel{padding:12px}#view [hidden]{display:none!important}
@media(max-width:650px){#view .envoy-roster{grid-template-columns:repeat(2,minmax(0,1fr))}#view .council-header,#view .council-body{padding-left:16px;padding-right:16px}#view .customize{margin-right:0}#view .your-envoy{flex-wrap:wrap}#view .own-presence{margin-left:0}#view .character-editor{align-items:flex-start;flex-wrap:wrap}#view .editor-portrait{width:85px;height:96px}#view input{font-size:16px}#view button{min-height:44px}}
@media(max-width:380px){#view h2{font-size:23px}#view .envoy-card{padding:10px}#view .envoy-face-row{flex-wrap:wrap}#view .envoy-card .portrait{width:52px;height:59px}}

:root{color-scheme:light dark;--ink:light-dark(#274336,#eee3c8);--paper:light-dark(#f4eddb,#1c2e28);--gold:light-dark(#9a6b32,#dfbd7a);--green:light-dark(#224b3b,#466d51);--muted:light-dark(#69735f,#b8bea5)}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 Georgia,serif}button,input{font:14px system-ui}button{cursor:pointer;border:1px solid #c9bea6;background:#fff9eb;color:var(--ink);padding:9px 14px;border-radius:5px}button:hover{background:#e5dbc6}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible{outline:3px solid #9a6b32;outline-offset:3px}h1,h2,h3,p{margin:0}h2{font-size:24px;font-weight:normal;margin-bottom:5px}h3{font-size:17px}small,.muted{color:var(--muted);font:12px/1.5 system-ui}.eyebrow{font:10px system-ui;letter-spacing:.18em;text-transform:uppercase}.mast{background:var(--green);color:#f6edd6;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:10px}.mast strong{font-size:23px;letter-spacing:.22em}.mast button{color:#f6edd6;background:transparent;border-color:#82907b}nav{display:flex;background:#e8dfcc;border-bottom:1px solid #c9bea6;padding:0 16px;gap:4px}nav button{border:0;border-bottom:3px solid transparent;border-radius:0;padding:13px 16px;background:transparent}nav button[aria-selected=true]{border-bottom-color:var(--green);font-weight:bold;color:var(--green)}#status{font:11px/1.4 system-ui;color:var(--muted);padding:8px 24px;background:#eee6d5}main{padding:22px 24px 26px;max-width:1000px;margin:auto}.intro{display:flex;justify-content:space-between;align-items:center;gap:14px}.intro h1{font-size:30px;font-weight:normal;line-height:1.2;margin:4px 0}.seal{display:grid;place-items:center;width:52px;height:62px;background:var(--green);color:#f2d594;clip-path:polygon(0 0,100% 0,100% 65%,50% 100%,0 65%);font-size:28px}.scene{display:block;width:100%;height:auto;max-height:200px;margin:12px 0 0;object-fit:cover;background:#d7decc;border-radius:8px 8px 0 0}.stores{display:flex;flex-wrap:wrap;border-block:1px solid #c9bea6;background:#e9dfc9;padding:13px 0}.store{flex:1;min-width:130px;padding:0 16px;border-right:1px solid #c9bea6}.store:last-child{border:0}.store strong{font:22px Georgia;display:block}.store .icon{float:left;margin:6px 10px 0 0;color:var(--gold);font-size:24px}.store small{display:block}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}.line{padding:11px 0;border-bottom:1px solid #d8cdb6;display:flex;gap:12px;align-items:start}.line p{font:13px/1.5 system-ui}.token{color:var(--gold);font-size:20px;min-width:22px}.buildings{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.building{padding:12px 8px;background:#e8dfcc;text-align:center;border-radius:4px}.building strong{display:block;font-size:14px}.building small{display:block}.building .token{font-size:24px}.section-head{margin:0 0 18px}.letter{position:relative;border:1px solid #d4c4a6;background:#fffaec;padding:20px;margin:14px 0;box-shadow:0 3px 0 #e2d6bf}.letter.incoming{border-left:4px solid #9b543b}.letter .letter-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.letter blockquote{margin:16px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:17px;line-height:1.6}.wax{background:#913d30;color:#f5dcc2;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;font-size:15px;flex-shrink:0}.tag{display:inline-block;color:var(--green);font:11px system-ui;background:#e4e7d7;padding:4px 8px;border-radius:3px;margin:8px 0}.letter.outgoing .wax{background:#577461}.empty{padding:25px 20px;background:#e9e1d0;border:1px dashed #c6b999;margin:16px 0}.empty p{margin-top:7px;color:var(--muted);font-size:14px}.letters-group{margin-top:24px}.search{display:flex;gap:8px;margin:18px 0}.search input{min-width:0;flex:1;border:1px solid #bcb195;padding:11px 12px;background:#fffaf0;color:var(--ink);border-radius:5px}.kingdoms{display:grid;grid-template-columns:1fr 1fr;gap:12px}.kingdom{background:#fff9eb;border:1px solid #d2c3a5;padding:16px;display:flex;gap:14px;align-items:center}.kingdom h3{overflow-wrap:anywhere}.kingdom .crest{background:#dfd6bd;min-width:42px;height:48px;display:grid;place-items:center;color:var(--green);font-size:26px;clip-path:polygon(0 0,100% 0,100% 65%,50% 100%,0 65%)}.kingdom button{margin-top:8px;padding:4px 9px;font-size:12px}.pager{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px}.fine{font:12px system-ui;color:var(--muted);margin-top:12px}.thread{margin-top:20px}.message{border-left:2px solid #b19d72;padding:12px 16px;margin:4px 0;background:#fff9ec}.message.own{border-color:#567c64;background:#e8ecdf}.message p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.warning{color:#8b352d}.hidden{display:none}#detail{margin:16px 0}footer{margin-top:22px;padding-top:14px;border-top:1px solid #d6cab1;font:12px system-ui;color:var(--muted)}@media(max-width:520px){main{padding:18px 16px}.mast{padding:14px 16px}.columns,.kingdoms{grid-template-columns:1fr}.store{min-width:100px;padding:0 9px}.store strong{font-size:19px}.scene{height:auto}.intro h1{font-size:26px}.buildings{grid-template-columns:repeat(3,1fr)}nav{padding:0 6px}nav button{padding:12px 10px}}
#view{background:var(--paper)}#view .message,#view .message.own{background:transparent;padding:0;margin:0;border:0}#view .letter,#view .empty,#view .kingdom,#view .stores,#view .building{background:var(--lift);color:var(--ink);border-color:var(--rule)}#view .fine,#view .muted,#view footer{color:var(--muted)}nav,#status{background:light-dark(#e8dfcc,#263b32);color:var(--ink)}nav button{color:var(--ink)}nav button[aria-selected=true]{color:var(--ink)}#view .kingdom img{max-width:74px}#view .kingdom>div{min-width:0}#view .your-envoy{flex-wrap:wrap}#view .term strong{overflow-wrap:anywhere}nav button:hover{background:light-dark(#e8dfcc,#263b32);color:var(--ink)}</style></head><body><header class="mast"><div><strong>PACT</strong><div class="eyebrow">A world of kingdoms &amp; promises</div></div><button id="refresh">Refresh news</button></header><nav role="tablist" aria-label="Kingdom journal"><button role="tab" id="tab-kingdom" aria-controls="view" aria-selected="true">Kingdom</button><button role="tab" id="tab-letters" aria-controls="view" aria-selected="false">Conversations</button><button role="tab" id="tab-world" aria-controls="view" aria-selected="false">Discover kingdoms</button></nav><p id="status" role="status">Opening your kingdom…</p><main id="view" role="tabpanel" aria-labelledby="tab-kingdom"></main><script>
let editRequested = false;
let next = 1,
  snapshot = null,
  tab = "letters",
  busy = false,
  requestGeneration = 0;
const pending = new Map();
function send(method, params) {
  const id = next++;
  parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("The kingdom could not be reached. Try again or ask ChatGPT to load PACT."));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
  });
}
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = String(text);
  if (cls) e.className = cls;
  return e;
}
function title(s) {
  return String(s || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function number(s) {
  if(s === undefined || s === null || s === "") return "—";
  const n = Number(String(s ?? "").replace("≈", ""));
  return Number.isFinite(n) ? Math.floor(n).toLocaleString("en-US") : "—";
}
function unitName(type, count) {
  return count === 1
    ? title(type)
    : { spearman: "Spearmen", archer: "Archers", rider: "Riders", ram: "Rams" }[type] || title(type);
}
function level(n) {
  return ["", "I", "II", "III", "IV", "V", "VI"][n] || String(n);
}
function ago(t) {
  const d = Math.max(0, Math.floor((Number(snapshot.world?.asOfGameTimeMs) - Number(t)) / 60000));
  return d < 1
    ? "This game-minute"
    : d < 60
      ? d + " game-min ago"
      : d < 1440
        ? Math.floor(d / 60) + " game-hours ago"
        : Math.floor(d / 1440) + " game-days ago";
}
function gameHours(n) { return n + (n === 1 ? " game-hour" : " game-hours"); }
function remaining(t) {
  const n = Math.max(0, Math.ceil((Number(t) - Number(snapshot.world?.asOfGameTimeMs)) / 60000));
  return n < 60 ? n + " game-min" : n < 1440 ? gameHours(Math.ceil(n / 60)) : Math.ceil(n / 1440) + " game-days";
}
const icons = {
  hall: "♜",
  farm: "♧",
  mine: "⛏",
  market: "⚖",
  barracks: "⚔",
  storehouse: "▣",
  wall: "♜",
  iron: "⛏",
  silver: "◈",
  grain: "♧",
};
function line(name, body, icon) {
  const r = el("div", undefined, "line");
  r.append(el("span", icon || "◇", "token"));
  const t = el("div");
  t.append(el("h3", name), el("p", body));
  r.append(t);
  return r;
}
function section(name, subtitle) {
  const h = el("div", undefined, "section-head");
  h.append(el("h2", name));
  if (subtitle) h.append(el("p", subtitle, "muted"));
  return h;
}
function empty(name, body) {
  const e = el("div", undefined, "empty");
  e.append(el("h3", name), el("p", body));
  return e;
}
function scene() {
  const landscape = el("div");
  createLandscape(landscape, snapshot.world || {});
  return landscape;
}

function kingdom(root) {
  const w = snapshot.world || {};
  const intro = el("div", undefined, "intro");
  const heading = el("div");
  heading.append(
    el("p", "The kingdom journal", "eyebrow"),
    el("h1", w.profile?.displayName || "Your kingdom"),
    el(
      "p",
      "Hall " +
        level((w.buildings || []).find((b) => b.kind === "hall")?.level || 1) +
        " · " +
        (w.profile?.handle ? "@" + w.profile.handle : "Your realm"),
      "muted",
    ),
  );
  intro.append(heading, el("div", "♜", "seal"));
  root.append(intro, scene());
  const stores = el("div", undefined, "stores");
  for (const k of ["iron", "silver", "grain"]) {
    const f = w.balances?.[k]?.facts || {};
    const c = el("div", undefined, "store");
    c.append(
      el("span", icons[k], "icon"),
      el("small", k === "iron" ? "The forge" : k === "grain" ? "The granary" : "The treasury"),
      el("strong", number(f.ordinaryWhole) + " " + title(k)),
      el("small", number(f.rates?.net?.perHourWhole) + " / game-hour · capacity " + number(f.capacityWhole)),
    );
    if (Number(String(f.allowanceWhole).replace("≈", "")) > 0)
      c.append(el("small", "+" + number(f.allowanceWhole) + " founding supplies"));
    stores.append(c);
  }
  root.append(stores);
  const cols = el("div", undefined, "columns");
  const work = el("section");
  work.append(section("Life in your kingdom", "Construction, troops, and the next changes."));
  let count = 0;
  for (const b of w.builders || []) {
    if (!b.kind) continue;
    count++;
    const target = b.targetLevel ?? (w.consequences?.builds || []).find((x) => x.id === b.instructionId)?.targetLevel;
    const name = title(b.kind) + (target ? " " + level(target) : "");
    let text =
      b.state === "active"
        ? "Under construction · " + b.remainingGameMinutes + " game-min remaining"
        : b.state === "waiting"
          ? "Queued · construction has not started"
          : title(b.state);
    if (b.state === "waiting" && b.missingBuildings?.length)
      text += " · Needs " + b.missingBuildings.map((x) => title(x.kind) + " " + level(x.level)).join(" and ");
    else if (b.state === "waiting" && b.prerequisiteCheck === "hall_limit") text += " · Requires a higher Hall";
    else if (b.state === "waiting") text += " · Resources and permission are checked when it starts";
    work.append(line(name, text, icons[b.kind]));
  }
  if (!count) work.append(line("Builders are available", "Both construction slots are free.", "⛏"));
  for (const t of w.training || [])
    work.append(
      line(
        title(t.type) + " training",
        t.requestedCount - t.completedCount + " still to train · next unit in " + remaining(t.nextUnitDueGameTimeMs),
        "⚔",
      ),
    );
  for (const t of w.threats || [])
    work.append(line("Approaching " + title(t.kind), "Arrives in " + remaining(t.dueGameTimeMs), "⚑"));
  if (w.upkeep?.hungry) work.append(line("The army is hungry", "Food is insufficient for upkeep.", "!"));
  const town = el("section");
  town.append(section("Your settlement", "Completed building levels."));
  const buildings = el("div", undefined, "buildings");
  for (const b of w.buildings || []) {
    const c = el("div", undefined, "building");
    c.append(
      el("span", icons[b.kind] || "◇", "token"),
      el("strong", title(b.kind)),
      el("small", "Level " + level(b.level)),
    );
    buildings.append(c);
  }
  town.append(buildings);
  const latest = (w.consequences?.builds || []).filter((b) => b.state === "completed").slice(0, 3);
  for (const b of latest)
    town.append(line(title(b.building) + " " + level(b.targetLevel) + " finished", ago(b.settledGameTimeMs), "✓"));
  cols.append(work, town);
  root.append(cols);
  const s = snapshot.interactions || {};
  const correspondence = el(
    "button",
    "Visit correspondence" +
      (s.requests?.length || s.messages?.length
        ? " · " + ((s.requests?.length || 0) + (s.messages?.length || 0)) + " entries"
        : ""),
  );
  correspondence.onclick = () => switchTab("letters");
  root.append(el("footer", "The world keeps moving. Your Envoy acts when you ask it to play."), correspondence);
}
function flow(f) {
  return f ? number(f.wholePerHour) + " " + title(f.resource) + " each game-hour" : "Nothing";
}
function letterCard(item, heading, body, foot, incoming) {
  const c = el("article", undefined, "letter " + (incoming ? "incoming" : "outgoing"));
  const head = el("div", undefined, "letter-head");
  const h = el("div");
  h.append(
    el("p", heading, "eyebrow"),
    el("h3", item.displayName || "@" + item.handle),
    el("small", "@" + item.handle),
  );
  head.append(h, el("div", "✦", "wax"));
  c.append(head);
  if (body) c.append(el("blockquote", body));
  c.append(el("p", foot, "tag"));
  return c;
}
function hash(s){let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0;}
function portrait(canvas,character){const c=canvas.getContext('2d'),seed=hash(character.seed+character.variation),rand=i=>((seed>>>i)^Math.imul(seed,i+3))>>>0;const skin=['#ddb58b','#bd8966','#8e6048','#f0cba1'][rand(2)%4],hair=['#554a3a','#3b453c','#aa744b','#c7ba94'][rand(5)%4],coat=character.color;c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/100,canvas.height/112);
const g=c.createLinearGradient(0,0,100,112);g.addColorStop(0,'#ded5b4');g.addColorStop(1,'#8b9b80');c.fillStyle=g;c.fillRect(0,0,100,112);c.fillStyle='#435e4828';for(let i=0;i<5;i++)c.fillRect(8+i*21,0,8,112);
function poly(points,color){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=color;c.fill();}function rect(x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h);}function oval(x,y,rx,ry,col){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=col;c.fill();}
poly([[10,112],[18,78],[41,65],[60,65],[83,79],[95,112]],coat);poly([[14,112],[21,78],[40,70],[44,112]],'#354c4260');poly([[60,70],[83,79],[95,112],[62,112]],'#e1c98c33');rect(43,60,15,18,skin);oval(50,44,21+(rand(7)%3),27,skin);oval(29,44,4,7,skin);oval(71,44,4,7,skin);poly([[28,39],[29,22],[40,12],[63,15],[73,27],[72,41],[65,26],[47,24],[36,33]],hair);if(rand(4)%3===0)poly([[34,53],[42,66],[58,68],[67,53],[56,58],[45,58]],hair);if(rand(8)%3===0)poly([[28,37],[21,58],[32,63],[36,26]],hair);rect(39,39,8,2,hair);rect(56,39,7,2,hair);oval(43,44,1.8,2.2,'#334138');oval(60,44,1.8,2.2,'#334138');poly([[51,44],[48,54],[55,54]],'#a6795540');rect(46,60,10,1.5,'#895d47');poly([[37,74],[44,82],[49,72],[53,82],[63,73],[60,94],[43,92]],'#ddd2b4');rect(26,85,5,18,'#d5bd75');oval(29,85,5,5,'#ddc27b');if(rand(10)%2)poly([[67,81],[78,84],[73,103],[64,99]],'#bd9c5a');rect(16,101,67,3,'#e2c99260');c.restore();}
let councilSelected=null,councilFilter='open',councilExpanded=false,threadPage=null,threadLoading=false,agreementHistory=null;
function observed(timestamp) {
  if(!timestamp)return 'No activity observed';
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(timestamp))/60000));
  return minutes<1?'Observed just now':minutes<60?'Observed '+minutes+' minutes ago':minutes<1440?'Observed '+Math.floor(minutes/60)+' hours ago':'Observed '+Math.floor(minutes/1440)+' days ago';
}
function characterFor(id){return snapshot.parties?.[id]?.character||{name:'Envoy',seed:id||'pact',color:'#53796a',variation:0};}
function face(id,small){const c=el('canvas',undefined,'portrait');c.width=100;c.height=112;if(small)c.style.cssText='width:36px;height:41px;flex-shrink:0';c.setAttribute('role','img');c.setAttribute('aria-label',characterFor(id).name);portrait(c,characterFor(id));return c;}
function activityLine(id,human=false){const p=snapshot.parties?.[id];return human?('Ruler · '+observed(p?.ruler?.lastObservedAt)):(p?.agent?.runActive?'Envoy run active · ':'Envoy · ')+observed(p?.agent?.lastObservedAt);}
function councilGroups(){
  const s=snapshot.interactions||{},map=new Map();
  for(const key of ['contacts','requests','messages','supplyOffers','supplyContracts','garrisonOffers','garrisonContracts'])for(const item of s[key]||[]){if(!map.has(item.kingdomId))map.set(item.kingdomId,{party:item,messages:[],requests:[],supplyOffers:[],supplyContracts:[],garrisonOffers:[],garrisonContracts:[]});if(key!=='contacts')map.get(item.kingdomId)[key].push(item);}
  return [...map.values()].map(g=>{g.messages.sort((a,b)=>Number(a.sentGameTimeMs)-Number(b.sentGameTimeMs));const latest=g.messages.at(-1),incoming=g.requests.some(r=>r.direction==='incoming'),outgoing=g.requests.some(r=>r.direction==='outgoing'),offers=g.supplyOffers.length+g.garrisonOffers.length,active=[...g.supplyContracts,...g.garrisonContracts].filter(c=>c.status==='active').length;
    g.needsYou=incoming;g.open=Boolean(g.requests.length||offers||active||g.messages.length);
    g.state=incoming?'Your introduction decision':outgoing?'Waiting for their contact decision':offers?'Signatures pending':active?'Agreement active':latest?(latest.senderKingdomId===s.kingdomId?'Last message sent by you':'Last message received'):'Contact established';
    g.summary=offers+' open proposal'+(offers===1?'':'s')+' · '+active+' active agreement'+(active===1?'':'s')+'. '+(g.requests.length?'An introduction is awaiting '+(incoming?'your kingdom':'their kingdom')+' acceptance. ':latest?'Latest recorded exchange: '+(latest.senderKingdomId===s.kingdomId?'your kingdom wrote. ':'their kingdom wrote. '):'No recorded messages in this view. ')+'Discussed terms are not commitments until the required signatures are recorded.';
    return g;});
}
function openHuman(url){send('ui/open-link',{url}).catch(()=>document.getElementById('status').textContent='Open PACT in your browser to review this decision.');}
function editCharacter(root){
  const current=snapshot.parties?.[snapshot.interactions?.kingdomId];if(!current)return;
  if(!snapshot.canCustomize){openHuman(snapshot.characterEditUrl);return;}
  const section=el('section',undefined,'character-editor'),preview=face(snapshot.interactions.kingdomId),fields=el('div');section.setAttribute('aria-label','Customize your Envoy');
  const draft={...current.character};let variation=draft.variation;
  const inputs={};for(const [key,labelText]of [['name','Envoy name'],['seed','Character inspiration · shared publicly'],['color','Kingdom colour']]){const label=el('label',labelText),input=el('input');input.value=draft[key];input.type=key==='color'?'color':'text';input.maxLength=key==='name'?60:160;input.setAttribute('aria-label',labelText);input.oninput=()=>{draft[key]=input.value;portrait(preview,draft);};label.append(input);fields.append(label);inputs[key]=input;}
  const generate=el('button','Generate another face');generate.onclick=()=>{variation=(variation+1)%1000001;draft.variation=variation;portrait(preview,draft);};
  const save=el('button','Save Envoy','primary');save.onclick=async()=>{save.disabled=true;try{await send('pact/character.save',{character:draft,expectedVersion:current.characterVersion});await load({search:snapshot.players?.query||'',offset:snapshot.players?.offset||0});}catch(e){save.disabled=false;document.getElementById('status').textContent=e.message;}};
  const cancel=el('button','Cancel');cancel.onclick=()=>section.remove();fields.append(generate,save,cancel,el('p','Your appearance is public. It does not assign a personality or change your agent’s permissions.','fine'));section.append(preview,fields);root.prepend(section);resize();
}
function letters(root){
  const ownId=snapshot.interactions?.kingdomId,top=el('div',undefined,'your-envoy'),identity=el('div');identity.append(el('small','YOUR KINGDOM’S VOICE'),el('h3',characterFor(ownId).name),el('span',activityLine(ownId)));top.append(face(ownId),identity);const customize=el('button','Your Envoy');customize.onclick=()=>editCharacter(root);top.append(customize);root.append(top);
  const groups=councilGroups(),toolbar=el('div',undefined,'conversation-toolbar');toolbar.append(el('h3','Your negotiations'));const filters=el('div');for(const [key,label,count]of [['open','Conversations',groups.filter(g=>g.open).length],['decision','Needs you',groups.filter(g=>g.needsYou).length+(snapshot.decisions?.length||0)],['all','All',groups.length]]){const b=el('button',label+' '+count);b.setAttribute('aria-pressed',String(councilFilter===key));b.onclick=()=>{councilFilter=key;render();};filters.append(b);}toolbar.append(filters);root.append(toolbar);
  const visible=groups.filter(g=>councilFilter==='all'||(councilFilter==='decision'?g.needsYou:g.open));if(!visible.some(g=>g.party.kingdomId===councilSelected)){councilSelected=visible[0]?.party.kingdomId||null;threadPage=null;agreementHistory=null;councilExpanded=false;}
  const roster=el('div',undefined,'envoy-roster');for(const g of visible){const id=g.party.kingdomId,b=el('button',undefined,'envoy-card');b.setAttribute('aria-label','Open negotiation with '+g.party.displayName);b.setAttribute('aria-pressed',String(councilSelected===id));const row=el('div',undefined,'envoy-face-row'),who=el('div');who.append(el('div',g.party.displayName,'kingdom-name'),el('div',characterFor(id).name+' · Envoy','envoy-name'));row.append(face(id),who);b.append(row,el('span',activityLine(id),'presence'),el('span',g.state,'waiting'));b.onclick=()=>{councilSelected=id;councilExpanded=false;threadPage=null;agreementHistory=null;render();};roster.append(b);}root.append(roster);
  if(!visible.length){root.append(empty(councilFilter==='decision'?'No introduction needs your decision':'No conversations here yet','Discover kingdoms to meet someone, or ask your Envoy to explore.'));return;}
  const g=visible.find(x=>x.party.kingdomId===councilSelected),id=g.party.kingdomId,thread=el('section',undefined,'negotiation');thread.append(section('With '+g.party.displayName,'@'+g.party.handle+' · '+g.state));const presence=el('div',undefined,'presence-strip');presence.append(el('span',activityLine(id)),el('span',activityLine(id,true)));thread.append(presence);
  const summary=el('div',undefined,'thread-summary');summary.append(el('small','WHERE THINGS STAND'),el('p',g.summary));const expand=el('button',councilExpanded?'Show latest exchange':'Read full exchange');expand.disabled=threadLoading;expand.onclick=async()=>{if(councilExpanded){councilExpanded=false;render();return;}threadLoading=true;expand.disabled=true;try{const r=await send('tools/call',{name:'pact_council_thread_v1',arguments:{kingdomId:id}});if(r.isError)throw Error('The exchange could not be loaded.');if(councilSelected!==id)return;threadPage=r.structuredContent;councilExpanded=true;}catch(e){document.getElementById('status').textContent=e.message;}finally{threadLoading=false;render();}};summary.append(expand);thread.append(summary);
  const terms=el('div',undefined,'terms');for(const offer of [...g.supplyOffers,...g.supplyContracts]){const t=el('div',undefined,'term');t.append(el('span',(offer.signedBy?'Proposal · v'+offer.version:'Engine contract')+' · '+title(offer.status)),el('strong','You send '+flow(offer.youSend)),el('strong','You receive '+flow(offer.youReceive)));if(offer.terms?.durationHours)t.append(el('span',gameHours(offer.terms.durationHours)));if(offer.signedBy)t.append(el('span',(offer.signedBy.includes(ownId)?'You signed':'Your signature pending')+' · '+(offer.signedBy.includes(id)?'They signed':'Their signature pending')));for(const [bond,label] of [[offer.terms?.aBond,offer.kingdomA===ownId?'Your bond':'Their bond'],[offer.terms?.bBond,offer.kingdomB===ownId?'Your bond':'Their bond']])if(bond)t.append(el('span',label+': '+number(bond.wholeAmount)+' '+title(bond.resource)));terms.append(t);}
  for(const offer of [...g.garrisonOffers,...g.garrisonContracts]){const t=el('div',undefined,'term');t.append(el('span',(offer.signedBy?'Garrison proposal · v'+offer.version:'Engine garrison contract')+' · '+title(offer.status)),el('strong',(offer.terms?.units||[]).map(u=>number(u.count)+' '+unitName(u.type,u.count)).join(' · ')));if(offer.terms?.durationHours)t.append(el('span',gameHours(offer.terms.durationHours)));if(offer.signedBy)t.append(el('span',(offer.signedBy.includes(ownId)?'You signed':'Your signature pending')+' · '+(offer.signedBy.includes(id)?'They signed':'Their signature pending')));t.append(el('span','Open the full contract in PACT before signing.'));terms.append(t);}thread.append(terms);
  const historyButton=el('button',agreementHistory?'Refresh agreement history':'Read agreement history');historyButton.onclick=async()=>{historyButton.disabled=true;try{const r=await send('tools/call',{name:'pact_conversation_history_v2',arguments:{kingdomId:id}});if(r.isError)throw Error('Agreement history unavailable.');if(councilSelected!==id)return;agreementHistory=r.structuredContent;render();}catch(e){document.getElementById('status').textContent=e.message;historyButton.disabled=false;}};thread.append(historyButton);
  if(agreementHistory){const history=el('section');history.append(el('h3','Retained agreement history'),el('p',agreementHistory.historyMeaning,'fine'));for(const o of agreementHistory.offers||[]){const card=el('article',undefined,'term');card.append(el('strong',o.kind+' · '+o.status+' · v'+o.version));for(const v of o.versions||[]){const details=el('details');details.append(el('summary','v'+v.version+' · '+(v.historicalBaseline?'retained baseline':v.proposedBy===ownId?'your proposal':'peer proposal')),el('p',v.version<o.version?'Superseded: these signatures do not sign current terms.':'Current version'),el('pre',JSON.stringify(v.terms,null,2)));for(const sig of (o.signatures||[]).filter(x=>x.version===v.version))details.append(el('p',(sig.kingdomId===ownId?'You':'Peer')+' · '+sig.actorKind+' signature · '+ago(sig.gameTimeMs)));card.append(details);}if(o.contract)card.append(el('p','Engine activation · '+o.contract.status+(o.contract.closeReason?' · '+o.contract.closeReason:'')));for(const d of o.deliveries||[])card.append(el('p',d.deliveredMarkedUnits+' / '+d.dueMarkedUnits+' marked '+d.resource+' units · '+d.failedInstallments+' failed installments. 600 units = 1 whole resource.'));history.append(card);}thread.append(history);}
  const full=el('button','Open full conversation workspace');full.onclick=()=>openHuman(snapshot.characterEditUrl.replace('?envoy=edit','?conversation='+encodeURIComponent(id)));thread.append(full);
  const messages=el('div',undefined,'messages');const rows=councilExpanded&&threadPage?threadPage.messages:g.messages.slice(-2);for(const m of rows){const own=m.senderKingdomId===ownId,msg=el('article',undefined,'message'+(own?' own':'')),body=el('div',undefined,'message-content');body.append(el('div',(m.authorKind==='agent'?characterFor(own?ownId:id).name:(own?'Your ruler':g.party.displayName+' ruler'))+' · '+(own?'Your ':'Their ')+(m.authorKind==='agent'?'agent':'human')+' · '+ago(m.sentGameTimeMs),'message-header'),el('p',m.body));msg.append(face(own?ownId:id,true),body);messages.append(msg);}thread.append(messages);
  if(councilExpanded&&threadPage?.next){const older=el('button','Read older messages');older.onclick=async()=>{older.disabled=true;try{const r=await send('tools/call',{name:'pact_council_thread_v1',arguments:{kingdomId:id,beforeGameTimeMs:threadPage.next.gameTimeMs,beforeId:threadPage.next.id}});if(r.isError)throw Error('Older messages could not be loaded.');if(councilSelected!==id)return;threadPage={messages:[...r.structuredContent.messages,...threadPage.messages],next:r.structuredContent.next};render();}catch(e){older.disabled=false;document.getElementById('status').textContent=e.message;}};thread.append(older);}
  for(const r of g.requests){thread.append(el('blockquote',r.note),el('p',r.direction==='incoming'?'Your kingdom must accept this introduction under its current contact delegation.':'The recipient must accept under its current delegation; that decision is not yours.','fine'),el('small','Expires in '+remaining(r.expiresGameTimeMs)));if(r.direction==='incoming'){const b=el('button','Review introduction in PACT');b.onclick=()=>openHuman(snapshot.characterEditUrl.replace('?envoy=edit','?council=introductions'));thread.append(b);}}
  thread.append(el('p','Recent activity does not guarantee a reply. Other rulers’ private approval states are not disclosed.','fine'));root.append(thread,el('footer','Counts cover the loaded, bounded council records. Summaries describe recorded proposals and signatures; messages remain the source.'));
}

function world(root) {
  const p = snapshot.players || {};
  root.append(section("Beyond your walls", "Find another kingdom. Learn who they are. Decide what comes next."));
  const form = el("form", undefined, "search");
  const input = el("input");
  input.type = "search";
  input.placeholder = "Search kingdom names or @handles";
  input.setAttribute("aria-label", "Search kingdoms");
  input.maxLength = 80;
  input.value = p.query || "";
  const submit = el("button", "Search");
  submit.type = "submit";
  submit.disabled = busy;
  form.append(input, submit);
  form.onsubmit = (e) => {
    e.preventDefault();
    load({ search: input.value.trim(), offset: 0 });
  };
  root.append(form);
  const grid = el("div", undefined, "kingdoms");
  for (const k of p.players || []) {
    const c = el("article", undefined, "kingdom");
    c.append(face(k.kingdomId));
    const info = el("div");
    info.append(
      el("h3", k.displayName),
      el("small", "@" + k.handle),
      el("p", k.hallLevel ? "Hall " + level(k.hallLevel) : "Hall level unavailable", "fine"),
    );
    const b = el("button", "View kingdom");
    b.disabled = busy;
    b.onclick = () => inspect(k);
    info.append(b);
    c.append(info);
    grid.append(c);
  }
  root.append(grid);
  if (!p.players?.length)
    root.append(
      empty("No kingdoms found", p.query ? "Try another name or handle." : "No other kingdoms are visible here yet."),
    );
  const pager = el("div", undefined, "pager");
  const prev = el("button", "← Previous");
  prev.disabled = busy || !p.offset;
  prev.onclick = () => load({ search: p.query || "", offset: Math.max(0, p.offset - 8) });
  const after = el("button", "Next →");
  after.disabled = busy || !p.hasMore || p.offset >= 10000;
  after.onclick = () => load({ search: p.query || "", offset: (p.offset || 0) + 8 });
  pager.append(prev, el("span", "Page " + (Math.floor((p.offset || 0) / 8) + 1), "muted"), after);
  root.append(pager, el("div", undefined, "hidden"));
  const d = el("section");
  d.id = "detail";
  root.append(
    d,
    el("footer", "Hall levels are public. Private resources and armies require the game’s normal access or scouting."),
  );
}
async function inspect(k) {
  const d = document.getElementById("detail");
  d.replaceChildren(line(k.displayName, "Opening the public kingdom record…", "♜"));
  try {
    const r = await send("tools/call", { name: "pact_player_find_v1", arguments: { handle: k.handle } });
    const result = r.structuredContent;
    if (r.isError || !result?.found) throw Error("This kingdom is no longer available.");
    d.replaceChildren(section(k.displayName, "@" + k.handle));
    const events = result.kingdom?.publicEvents || [];
    if (!events.length) d.append(el("p", "No public battle or default events in this record.", "muted"));
    for (const e of events) d.append(line(title(e.kind), title(e.outcome) + " · " + ago(e.gameTimeMs), "⚑"));
    d.append(el("p", "To approach this kingdom, tell your Envoy: “Look at @" + k.handle + ".”", "fine"));
  } catch (e) {
    d.replaceChildren(el("p", e.message, "warning"));
  }
  resize();
}
function resize() {
  parent.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { height: document.body.scrollHeight },
    },
    "*",
  );
}
function render(data) {
  if (data && typeof data === "object" && "world" in data) snapshot = data;
  if (!snapshot) return;
  const root = document.getElementById("view");
  root.replaceChildren();
  root.setAttribute("aria-labelledby", "tab-" + tab);
  for (const t of ["kingdom", "letters", "world"])
    document.getElementById("tab-" + t).setAttribute("aria-selected", String(t === tab));
  if (!snapshot.world) {
    root.append(empty("Your kingdom is not available", "Ask ChatGPT to check the connected PACT account."));
    resize();
    return;
  }
  for (const decision of snapshot.decisions || []) {
    const card = el("section", undefined, "letter");
    card.append(el("h3", "Your decision is needed"), el("p", decision.effectsSummary));
    card.append(el("p", "Expires " + new Date(decision.expiresAt).toLocaleString(), "fine"));
    const button = el("button", "Review my decision");
    button.onclick = () => {
      send("ui/open-link", { url: decision.reviewUrl }).catch(() => {
        document.getElementById("status").textContent = "Ask ChatGPT for the approval link to review this action in PACT.";
      });
    };
    card.append(button, el("p", "Only you can approve. Opening the review does not carry out the action.", "fine"));
    root.append(card);
  }
  ({ kingdom, letters, world })[tab](root);
  if(tab === "letters" && snapshot.editCharacter && !editRequested){editRequested=true;editCharacter(root);}
  resize();
}
function switchTab(t) {
  tab = t;
  render();
}
async function load(args) {
  const generation = ++requestGeneration;
  busy = true;
  render();
  document.getElementById("refresh").disabled = true;
  document.getElementById("status").textContent = "A messenger is fetching the latest news…";
  try {
    const r = await send("tools/call", { name: "pact_play_view_v1", arguments: args });
    if (generation !== requestGeneration) return;
    if (r.isError) throw Error("The kingdom could not be reached.");
    render(r.structuredContent);
    document.getElementById("status").textContent =
      "Latest news received · " + (snapshot.world?.worldStatus === "active" ? "World is moving" : "World is paused");
  } catch (e) {
    document.getElementById("status").textContent = e.message;
  } finally {
    busy = false;
    document.getElementById("refresh").disabled = false;
    render();
  }
}
for (const t of ["kingdom", "letters", "world"]) document.getElementById("tab-" + t).onclick = () => switchTab(t);
document.getElementById("refresh").onclick = () =>
  load({ search: snapshot?.players?.query || "", offset: snapshot?.players?.offset || 0 });
addEventListener("message", (e) => {
  if (e.source !== parent || !e.data || e.data.jsonrpc !== "2.0") return;
  const m = e.data;
  if (pending.has(m.id)) {
    const p = pending.get(m.id);
    clearTimeout(p.timer);
    pending.delete(m.id);
    if (m.error) p.reject(Error("The host could not reach PACT. Please try again."));
    else p.resolve(m.result);
  }
  if (m.method === "ui/notifications/tool-result" && m.params?.structuredContent?.world) {
    render(m.params.structuredContent);
    document.getElementById("status").textContent = "Conversations loaded · Refresh for the latest news";
  }
});
send("ui/initialize", {
  protocolVersion: "2026-01-26",
  appInfo: { name: "PACT", version: "1.1.0" },
  appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] },
})
  .then(() => parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} }, "*"))
  .catch((e) => (document.getElementById("status").textContent = e.message));
if (window.openai?.toolOutput) {
  render(window.openai.toolOutput);
  document.getElementById("status").textContent = "Conversations loaded · Refresh for the latest news";
}
${landscapeScript}
</script></body></html>`;
