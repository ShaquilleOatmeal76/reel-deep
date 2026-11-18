// casino.js: the Rusty Hook's chip economy update (Nov 18, 2026). Loaded after island.js and uses game.js's globals.
// Players were sitting on big chip stacks with nothing to buy, so this file adds places to spend chips and more ways to bet.
// Every game keeps the usual ~95% payback; nothing here changes score or makes secrets quicker; chips never become coins.
// Every screen is an EXTRA_OV overlay ({ draw, tap(rx, ly), key(code, dir), back, music }) laid out for both widths by one
// function: X / W = the 348-wide PC block (WX()) or the 120-wide phone column (OX).
//
// Part 1: the Captain's Locker (prestige gear at 10,000-75,000 chips) and the Shady Dealer (three things a week).

const czL = () => { const w = wideMenus(); return { w, X: w ? WX() : OX, W: w ? 348 : 120 }; };
const CZ = { lk: { sel: 0 }, dl: { sel: 0, tab: 0 } };
const DATA_LIST = { hat: "hats", pet: "pets", boat: "boats", flag: "flags", flair: "flair", hook: "hooks" };
function czIdx(kind, name) {                                  // a cosmetic's position in its list, looked up by name
  if (kind === "line") return LINES.findIndex(l => l[0] === name);
  if (kind === "trail") return TRAILS.findIndex(l => l[0] === name);
  return DATA[DATA_LIST[kind]].indexOf(name);
}
const KIND_NAME = { hat: "A HAT", pet: "A PET", boat: "A BOAT", flag: "A FLAG", flair: "FISH FLAIR", hook: "A HOOK", line: "A LINE", trail: "BUBBLES" };

// ---- the stock. [kind, name (as in data.js / LINES / TRAILS), price, what the old man says about it]
const LOCKER = [
  ["boat", "GOLDEN TRAWLER", 75000, "NAVY AND GOLD. THE FLAGSHIP"],
  ["boat", "BLACK PEARL", 50000, "BLACK HULL, PEARL TRIM"],
  ["pet", "KRAKEN", 40000, "IT CAME UP WITH THE ANCHOR"],
  ["hat", "CROWN JEWELS", 30000, "HEAVY IS THE HEAD"],
  ["pet", "GOLDEN SEAHORSE", 25000, "SOLID GOLD. PROBABLY"],
  ["hook", "LEVIATHAN HOOK", 20000, "BARBED, TEAL AND MEAN"],
  ["flair", "BIG RUBIES", 18000, "A RUBY FOR EVERY FISH"],
  ["line", "LANTERN LINE", 15000, "A WARM LIGHT RUNS DOWN IT"],
  ["trail", "DOUBLOONS", 15000, "PIRATE GOLD BUBBLES"],
  ["hat", "ADMIRAL'S HAT", 12000, "OUTRANKS EVERYONE"],
  ["trail", "EMERALDS", 12000, "GREEN AND GLITTERING"],
  ["line", "PEARL LINE", 10000, "A STRING OF PEARLS"],
  ["flag", "ROYAL STANDARD", 10000, "A FLAG FIT FOR A KING"],
];
// Append only: the weekly rotation walks this list in a fixed shuffled order, three a week, so every item comes back
// every eight weeks and nobody misses one for good.
const DEALER = [
  ["hat", "BOWLER", 4000, "FELL OFF A SHIP"], ["hat", "TRICORN", 6000, "DON'T ASK WHOSE"], ["hat", "STRAW HAT", 3000, "BARELY WORN"],
  ["hat", "JESTER CAP", 8000, "JINGLES. SORRY"], ["hat", "NIGHTCAP", 3000, "STILL WARM"], ["hat", "GOLD LAUREL", 9000, "NOT REAL GOLD. MAYBE"],
  ["pet", "LOBSTER", 6000, "BITES. A LITTLE"], ["pet", "SEAGULL", 5000, "IT WILL STEAL YOUR LUNCH"], ["pet", "OTTER", 7000, "FOUND IT IN A CRATE"],
  ["pet", "HERMIT CRAB", 4000, "BRINGS ITS OWN HOUSE"],
  ["flag", "DICE FLAG", 3000, "FOR GAMBLERS"], ["flag", "ANCHOR FLAG", 3000, "SOLID. DEPENDABLE"], ["flag", "LIGHTHOUSE", 4000, "SHINES, IN A WAY"],
  ["flag", "RED ROGER", 5000, "THE PIRATES WANT IT BACK"],
  ["flair", "BANDANAS", 4000, "FOR THE ROUGH FISH"], ["flair", "PEARLS", 6000, "FOR THE CLASSY FISH"], ["flair", "AVIATORS", 5000, "FOR THE COOL FISH"],
  ["line", "MIDNIGHT LINE", 3000, "DARK AS THE TRENCH"], ["line", "COPPER LINE", 3000, "SHINY. TURNS GREEN"], ["line", "SEAWEED LINE", 6000, "IT SWAYS"],
  ["trail", "SEA FOAM", 4000, "FRESH OFF THE WAVES"], ["trail", "INK CLOUD", 5000, "SQUID OWED ME ONE"],
  ["hook", "FISHBONE HOOK", 7000, "MADE FROM A FISH"], ["hook", "KEY HOOK", 5000, "OPENS NOTHING"],
];
const czOwn = it => store.own[it[0]].includes(czIdx(it[0], it[1]));
const czOn = it => store.eq[it[0]] === czIdx(it[0], it[1]);
function czWear(it) { const i = czIdx(it[0], it[1]); store.eq[it[0]] = store.eq[it[0]] === i ? 0 : i; saveStore(); play("select"); }
function czBuy(it, say) {                                     // -> true if bought
  const i = czIdx(it[0], it[1]);
  if (i < 0 || czOwn(it)) return false;
  if (tav().chips < it[2]) { play("miss"); say("COME BACK WITH CHIPS"); return false; }
  addChips(-it[2]); chipsSpent(it[2]);
  store.own[it[0]].push(i); store.eq[it[0]] = i; saveStore(); play("fanfare");
  if (LOCKER.every(czOwn)) tavAward("captain");
  return true;
}

// ---- the Shady Dealer's week: weeks start on Monday (1 Jan 1970 was a Thursday), the same for everyone
const czDay = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const dealerWeek = () => Math.floor((czDay() + 3) / 7);
const dealerDaysLeft = () => 7 - ((czDay() + 3) % 7);
const DEALER_ORDER = (() => { const r = RNG(hashStr("shady dealer")), a = DEALER.map((x, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
const dealerStock = () => [0, 1, 2].map(k => DEALER[DEALER_ORDER[(dealerWeek() * 3 + k) % DEALER.length]]);
const dealerStash = () => DEALER.filter(czOwn);

// ---- one screen for both shops: a list on the left (or on top), the picked thing tried on, and a buy / wear button
function shopCfg(o) {
  if (o === "locker") return { title: "THE CAPTAIN'S LOCKER", col: GOLD, list: LOCKER, st: CZ.lk, say: TAV.lkSay || "ONLY THE FINEST", setSay: s => { TAV.lkSay = s; } };
  const st = CZ.dl, list = st.tab ? dealerStash() : dealerStock();
  return { title: "THE SHADY DEALER", col: "#c8a0ff", list, st, tabs: true, say: TAV.dlSay || (st.tab ? "STILL YOURS" : "NEW STOCK IN " + dealerDaysLeft() + (dealerDaysLeft() === 1 ? " DAY" : " DAYS")), setSay: s => { TAV.dlSay = s; } };
}
const SHOP_PER_W = 10, SHOP_PER_N = 5;
function czShopHits(o) {
  const c = shopCfg(o), L = czL(), per = L.w ? SHOP_PER_W : SHOP_PER_N, page = Math.floor(c.st.sel / per), h = [];
  if (L.w) {
    c.list.slice(page * per, page * per + per).forEach((it, k) => h.push(["row", L.X, 24 + k * 14, 220, 13, page * per + k]));
    if (c.list.length > per) { h.push(["page", L.X + 168, 2, 16, 13, -1]); h.push(["page", L.X + 204, 2, 16, 13, 1]); }
    if (c.tabs) { h.push(["tab", L.X, 150, 108, 18, 0]); h.push(["tab", L.X + 112, 150, 108, 18, 1]); }
    h.push(["act", L.X + 228, 150, 120, 18, 0]);
  } else {
    c.list.slice(page * per, page * per + per).forEach((it, k) => h.push(["row", L.X + 4, 27 + k * 14, 112, 12, page * per + k]));
    if (c.list.length > per) { h.push(["page", L.X + 2, 2, 16, 13, -1]); h.push(["page", L.X + 102, 2, 16, 13, 1]); }
    h.push(["act", L.X + 14, 152, 92, 14, 0]);
    if (c.tabs) { h.push(["tab", L.X + 4, 166, 54, 13, 0]); h.push(["tab", L.X + 62, 166, 54, 13, 1]); }
  }
  return h;
}
function czActLabel(it) {
  if (!it) return "";
  if (czOwn(it)) return czOn(it) ? "TAKE OFF" : "PUT ON";
  return (tav().chips >= it[2] ? "BUY " : "NEEDS ") + it[2];
}
function czTryOn(it, cx, wl, k, w) {                         // the item on you (hat, boat, pet, flag) or on its own
  const i = czIdx(it[0], it[1]);
  if (["hat", "boat", "pet", "flag"].includes(it[0])) {
    rect("#5aa0e6", cx - w / 2, wl - 22 * k, w, 22 * k); rect("#2a6ab4", cx - w / 2, wl, w, 12 * k);
    const eq = Object.assign({}, store.eq, { [it[0]]: i, mon: 0, mhat: 0, mpet: 0 });
    g.save(); g.translate(cx, wl); g.scale(k, k); angler(-24, 1, eq, 0); g.restore();
  } else if (it[0] === "flair") {                            // on a fish, where fish wear it
    const fid = "clown", [fw, fh] = sprSize(fid), [ax, ay] = wearAt("flair" + i, DATA.flairPos[i], fw, fh), [iw] = sprSize("flair" + i), kk = k * 2;
    g.save(); g.translate(cx - fw * kk / 2, wl - 6 * k - fh * kk / 2); g.scale(kk, kk); spr(fid, 0, 0); spr("flair" + i, ax, ay); g.restore();
  } else { g.save(); g.translate(cx - 11 * k, wl - 14 * k); g.scale(k, k); shopPreview(it[0], i, 0, 0, true); g.restore(); }
}
function drawCzShop(o) {
  const c = shopCfg(o), L = czL(), X = L.X, per = L.w ? SHOP_PER_W : SHOP_PER_N, pages = Math.max(1, Math.ceil(c.list.length / per));
  if (c.st.sel >= c.list.length) c.st.sel = Math.max(0, c.list.length - 1);
  const it = c.list[c.st.sel];
  tavernBg();
  if (L.w) {
    text(c.title, X, 8, 1, c.col, "left", null);
    if (pages > 1) text((Math.floor(c.st.sel / per) + 1) + "/" + pages, X + 194, 8, 1, "#d8c8b0", "center", null);
    chipsAt(X + 348, 8, "right");
    if (!c.list.length) text(c.st.tab ? "NOTHING FROM HIM YET" : "SOLD OUT", X + 110, 60, 1, GREY, "center", null);
    for (const [id, x, y, w, h, v] of czShopHits(o)) {
      if (id === "row") {
        const r = c.list[v], sel = v === c.st.sel, own = czOwn(r);
        rect(sel ? "#5a3a22" : "#24160e", x, y, w, h); if (sel) outline(x, y, w, h, c.col);
        text(r[1], x + 4, y + 6, 1, sel ? WHITE : "#d8c8b0", "left", null);
        text(own ? (czOn(r) ? "WEARING" : "YOURS") : r[2], x + w - 4, y + 6, 1, own ? LIME : CHIP, "right", null);
      } else if (id === "page") arrowBtn(x, y, w, h, v, c.col);
      else if (id === "tab") btn(x, y, w, h, v ? "YOUR STASH" : "THIS WEEK", c.st.tab === v ? c.col : "#5a4a6a");
    }
    const px = X + 228, pw = 120;
    rect("#1e120c", px, 22, pw, 70); outline(px, 22, pw, 70, c.col);
    if (it) { g.save(); g.beginPath(); g.rect(px + 1, 23, pw - 2, 68); g.clip(); czTryOn(it, px + pw / 2, 67, 2, pw - 2); g.restore(); }
    else spr("oldman", px + pw / 2 - 14, 30, false, 2);
    if (it) {
      text(it[1], px + pw / 2, 100, 1, WHITE, "center", null);
      text(KIND_NAME[it[0]], px + pw / 2, 110, 1, c.col, "center", null);
      wrap(it[3], 19).slice(0, 2).forEach((l, i) => text(l, px + pw / 2, 122 + i * 10, 1, "#e8dcc4", "center", null));
      const a = czActLabel(it); btn(px, 150, pw, 18, a, !czOwn(it) && tav().chips < it[2] ? GREY : CHIP);
    }
    text(c.say.slice(0, 36), X + 110, 176, 1, "#a08c70", "center", null);
    text("TAP HERE TO GO BACK", LW / 2, 194, 1, WHITE, "center", null);
    return;
  }
  g.save(); g.translate(X, 0);
  text(o === "locker" ? "THE LOCKER" : "THE DEALER", 60, 8, 1, c.col, "center", null);
  chipsLine(19);
  g.restore();
  for (const [id, x, y, w, h, v] of czShopHits(o)) {
    if (id === "row") {
      const r = c.list[v], sel = v === c.st.sel, own = czOwn(r);
      box(x, y, w, h, sel ? c.col : "#5a3a22"); text(r[1].slice(0, 14), x + 3, y + 6, 1, sel ? WHITE : "#d8c8b0", "left", null);
      text(own ? "*" : r[2] >= 10000 ? Math.floor(r[2] / 1000) + "K" : r[2], x + w - 3, y + 6, 1, own ? LIME : CHIP, "right", null);
    } else if (id === "page") { box(x, y, w, h, c.col); text(v < 0 ? "<" : ">", x + 8, y + 6, 1, c.col, "center", null); }
    else if (id === "act") { if (it) { const a = czActLabel(it); box(x, y, w, h, !czOwn(it) && tav().chips < it[2] ? GREY : CHIP); text(a, x + w / 2, y + 7, 1, !czOwn(it) && tav().chips < it[2] ? GREY : CHIP, "center", null); } }
    else if (id === "tab") { box(x, y, w, h, c.st.tab === v ? c.col : "#5a4a6a"); text(v ? "STASH" : "WEEK", x + w / 2, y + 6, 1, c.st.tab === v ? WHITE : GREY, "center", null); }
  }
  if (!c.list.length) text(c.st.tab ? "NOTHING YET" : "SOLD OUT", LW / 2, 60, 1, GREY, "center", null);
  if (it) {
    g.save(); g.beginPath(); g.rect(X + 4, 99, 112, 38); g.clip(); czTryOn(it, X + 60, 128, 1, 112); g.restore(); outline(X + 4, 99, 112, 38, c.col);
    text(wrap(it[3], 19)[0], LW / 2, 143, 1, "#e8dcc4", "center", null);
  }
  text(c.tabs ? (c.st.tab ? "STILL YOURS" : "NEW IN " + dealerDaysLeft() + (dealerDaysLeft() === 1 ? " DAY" : " DAYS")) : "PRESTIGE GEAR", LW / 2, 185, 1, "#a08c70", "center", null);
  text("TAP HERE TO GO BACK", LW / 2, 196, 1, WHITE, "center", null);
}
function czShopAct(o) {
  const c = shopCfg(o), it = c.list[c.st.sel];
  if (!it) { play("miss"); return; }
  if (czOwn(it)) czWear(it);
  else if (czBuy(it, c.setSay)) c.setSay(o === "locker" ? "A FINE CHOICE, CAPTAIN" : "YOU DIDN'T GET IT FROM ME");
}
function czShopTap(o, rx, ly) {
  const c = shopCfg(o), L = czL(), per = L.w ? SHOP_PER_W : SHOP_PER_N, pages = Math.max(1, Math.ceil(c.list.length / per));
  const h = hitAt(czShopHits(o), rx, ly);
  if (!h) { if (ly > 186) closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "row") { if (v === c.st.sel) czShopAct(o); else { c.st.sel = v; play("tick"); } }
  else if (id === "page") { const p = (Math.floor(c.st.sel / per) + v + pages) % pages; c.st.sel = Math.min(c.list.length - 1, p * per); play("tick"); }
  else if (id === "tab") { c.st.tab = v; c.st.sel = 0; TAV.dlSay = null; play("tick"); }
  else if (id === "act") czShopAct(o);
}
function czShopKey(o, code, dir) {
  const c = shopCfg(o), n = c.list.length;
  if (code === "ArrowUp" || code === "KeyW") { if (n) { c.st.sel = (c.st.sel - 1 + n) % n; play("tick"); } }
  else if (code === "ArrowDown" || code === "KeyS") { if (n) { c.st.sel = (c.st.sel + 1) % n; play("tick"); } }
  else if (dir && c.tabs) { c.st.tab = c.st.tab ? 0 : 1; c.st.sel = 0; TAV.dlSay = null; play("tick"); }
  else if (dir && n) { const per = czL().w ? SHOP_PER_W : SHOP_PER_N, pages = Math.ceil(n / per); c.st.sel = Math.min(n - 1, ((Math.floor(c.st.sel / per) + dir + pages) % pages) * per); play("tick"); }
  else if (code === "Space" || code === "Enter") czShopAct(o);
}
EXTRA_OV.locker = { draw: () => drawCzShop("locker"), tap: (rx, ly) => czShopTap("locker", rx, ly), key: (c, d) => czShopKey("locker", c, d), back: "chipshop", music: true };
EXTRA_OV.dealer = { draw: () => drawCzShop("dealer"), tap: (rx, ly) => czShopTap("dealer", rx, ly), key: (c, d) => czShopKey("dealer", c, d), back: "chipshop", music: true };

// ---- the two chip-shop rows (game.js asks these)
function casinoShopRow(id) {
  if (id === "locker") { const n = LOCKER.filter(czOwn).length; return ["CAPTAIN'S LOCKER", null, n ? "YOU OWN " + n + " OF " + LOCKER.length + ". PRESTIGE GEAR" : "PRESTIGE GEAR. 10,000 TO 75,000 CHIPS"]; }
  return ["SHADY DEALER", null, "THREE THINGS. THIS WEEK ONLY. NEW STOCK IN " + dealerDaysLeft() + (dealerDaysLeft() === 1 ? " DAY" : " DAYS")];
}
function casinoOpen(id) {                                    // -> true if casino.js handles this id (tavern rows, chip shop rows, hub cards)
  if (id === "locker") { TAV.lkSay = null; openOverlay("locker"); }
  else if (id === "dealer") { TAV.dlSay = null; CZ.dl.tab = 0; CZ.dl.sel = 0; openOverlay("dealer"); }
  else if (HUBS[id]) { CZ.hub.sel = 0; openOverlay(id); }
  else if (GAME_OPEN[id]) GAME_OPEN[id]();
  else return false;
  return true;
}
// ===================================================================== Part 2
// The tavern's games grouped into two menus (TABLES and MACHINES) so the bar doesn't get longer as games are added, plus
// Line Snap (a crash game) and Bigger Fish (higher or lower). Later parts add their games to HUBS.
const HUBS = {
  tables: { title: "THE TABLES", say: "CARDS AND DICE", games: [["c21", "CATCH 21", "FISH CARDS TO 21"], ["bigger", "BIGGER FISH", "HIGHER OR LOWER?"], ["crown", "CROWN & ANCHOR", "THE SAILOR'S DICE"]] },
  machines: { title: "THE MACHINES", say: "PULL, DROP, SPIN", games: [["plinko", "PLINKO", "DROP A FISH, X25"], ["snap", "LINE SNAP", "CASH OUT IN TIME"], ["reel", "THE REEL DEAL", "SLOTS, UP TO X250"], ["wheel", "SHIP'S WHEEL", "SPIN FOR X10"]] },
};
CZ.hub = { sel: 0 };
const GAME_OPEN = {
  c21: () => { if (!TAV.c21 || TAV.c21.vip) c21New(false); openOverlay("c21"); },
  plinko: () => { plinkoOpen(); openOverlay("plinko"); },
  snap: () => { snapOpen(); openOverlay("snap"); },
  bigger: () => { bigOpen(); openOverlay("bigger"); },
  crown: () => { caOpen(); openOverlay("crown"); },
  reel: () => { rdOpen(); openOverlay("reel"); },
  wheel: () => { whOpen(); openOverlay("wheel"); },
};
function hubHits(o) {
  const L = czL(), g0 = HUBS[o].games;
  return g0.map((gm, k) => L.w ? [gm[0], L.X + (k % 2) * 178, 30 + Math.floor(k / 2) * 34, 170, 28, k] : [gm[0], L.X + 8, 28 + k * 26, 104, 23, k]);
}
function drawHub(o) {
  const H = HUBS[o], L = czL();
  tavernBg();
  if (L.w) { text(H.title, L.X, 10, 1, GOLD, "left", null); chipsAt(L.X + 348, 10, "right"); }
  else { text(H.title, L.X + 60, 8, 1, GOLD, "center", null); g.save(); g.translate(L.X, 0); chipsLine(18); g.restore(); }
  for (const [id, x, y, w, h, k] of hubHits(o)) { const gm = H.games[k], sel = k === CZ.hub.sel; btn(x, y, w, h, gm[1], sel ? GOLD : CHIP, gm[2], sel ? WHITE : "#a0c8b4"); }
  if (L.w) { spr("oldman", L.X + 160, 140, false, 2); text(H.say, L.X + 174, 180, 1, "#a08c70", "center", null); }
  else text(H.say, L.X + 60, 184, 1, "#a08c70", "center", null);
  text("TAP HERE TO GO BACK", LW / 2, 194, 1, WHITE, "center", null);
}
function hubTap(o, rx, ly) { const h = hitAt(hubHits(o), rx, ly); if (h) { CZ.hub.sel = h[5]; GAME_OPEN[h[0]](); } else if (ly > 186) closeOverlay(); }
function hubKey(o, code, dir) {
  const n = HUBS[o].games.length, wide = czL().w;
  if (code === "ArrowUp" || code === "KeyW") CZ.hub.sel = (CZ.hub.sel - (wide ? 2 : 1) + n * 2) % n;
  else if (code === "ArrowDown" || code === "KeyS") CZ.hub.sel = (CZ.hub.sel + (wide ? 2 : 1)) % n;
  else if (dir) CZ.hub.sel = (CZ.hub.sel + dir + n) % n;
  else if (code === "Space" || code === "Enter") { GAME_OPEN[HUBS[o].games[CZ.hub.sel][0]](); return; }
  else return;
  play("tick");
}
for (const o of Object.keys(HUBS)) EXTRA_OV[o] = { draw: () => drawHub(o), tap: (rx, ly) => hubTap(o, rx, ly), key: (c, d) => hubKey(o, c, d), back: "tavern", music: true };

// ---- small shared pieces for the games: a stake control, a big button, chip-coloured result chips
function stakeCtl(h, id, x, y, w) { h.push([id, x, y, 16, 15, -1]); h.push([id, x + w - 16, y, 16, 15, 1]); }
function drawStakeCtl(x, y, w, val, col, lab) {
  box(x, y, 16, 15, col); text("-", x + 8, y + 7, 1, col, "center", null);
  box(x + w - 16, y, 16, 15, col); text("+", x + w - 8, y + 7, 1, col, "center", null);
  text(lab ? lab + " " + val : val, x + w / 2, y + 7, 1, WHITE, "center", null);
}
const fmtX = m => "X" + (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.floor(m));
function czTitle(L, t, col) { if (L.w) { text(t, L.X, 8, 1, col || GOLD, "left", null); chipsAt(L.X + 348, 8, "right"); } else { text(t, L.X + 60, 8, 1, col || GOLD, "center", null); g.save(); g.translate(L.X, 0); chipsLine(19); g.restore(); } }
const MAX_WIN = 5000;                                         // one bet never pays more than this

// ---- LINE SNAP. You hook a fish and the multiplier climbs as you reel; cash out any time, but the line can snap at any
// moment. The snap point M has P(M >= m) = 0.95 / m (5% snap at once), so cashing out at any m, or any auto cash-out,
// pays back 95% on average. The multiplier doubles about every 3 seconds. Max win 5,000 chips (cashes out for you).
const SNAP_R = Math.LN2 / 3, SNAP_AUTO = [0, 1.5, 2, 3, 5, 10, 25];
CZ.snap = null;
function snapOpen() { if (!CZ.snap) CZ.snap = { bet: 10, auto: 0, phase: "stake", m: 1, crash: 0, t: 0, hist: [], msg: "SET A STAKE AND REEL IN", win: 0, fish: "tuna", st: 0, k: 0 }; }
function snapCrash() { const u = Math.random(); return Math.min(1000, Math.max(1, 0.95 / (1 - u))); }   // 1 = snaps at once
function snapGo() {
  const c = CZ.snap;
  if (c.phase === "reel") { snapCash(c.m); return; }
  if (tav().chips < c.bet || c.bet < 5) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  c.crash = snapCrash(); c.m = 1; c.t = 0; c.phase = "reel"; c.win = 0; c.st = 0;
  c.fish = C21_POOL[Math.floor(Math.random() * C21_POOL.length)];
  c.msg = "REELING..."; play("plop");
  if (c.crash <= 1) snapBreak();
}
function snapCash(x) {
  const c = CZ.snap; if (c.phase !== "reel") return;
  c.m = x; c.win = Math.floor(c.staked * x); c.phase = "cashed"; c.st = 0;
  addChips(c.win, c.win > c.staked ? "win" : "");
  c.hist.unshift([x, 1]); c.hist.length = Math.min(c.hist.length, 12);
  c.msg = "LANDED AT " + fmtX(x) + "! +" + c.win; play("chime");
  if (x >= 50) tavAward("snaphappy");
}
function snapBreak() {
  const c = CZ.snap; c.m = c.crash; c.phase = "snap"; c.st = 0;
  c.hist.unshift([c.crash, 0]); c.hist.length = Math.min(c.hist.length, 12);
  c.msg = c.crash <= 1 ? "SNAPPED STRAIGHT AWAY!" : "SNAP! AT " + fmtX(c.crash); play("cz_snap");
}
function snapTick(dt) {
  const c = CZ.snap; if (!c) return;
  c.st += dt;
  if (c.phase !== "reel") return;
  c.t += dt; c.k += dt;
  const m = Math.exp(SNAP_R * c.t), cap = MAX_WIN / c.staked;
  const stop = [c.auto || Infinity, cap].reduce((a, b) => Math.min(a, b));
  if (stop <= c.crash && m >= stop) snapCash(stop);           // auto cash-out (or the max win) comes before a later snap
  else if (m >= c.crash) snapBreak();
  else { c.m = m; if (c.k > 0.12 / Math.min(4, 1 + Math.log(m))) { c.k = 0; play("reel"); } }
}
SOUNDS.cz_snap = [[1400, 0.05, "square", 0.25, 200], [160, 0.3, "sawtooth", 0.2, 50, 0.05]];
function snapHits() {
  const L = czL(), h = [];
  if (L.w) { const px = L.X + 236; stakeCtl(h, "stake", px, 40, 112); stakeCtl(h, "auto", px, 66, 112); h.push(["go", px, 96, 112, 26, 0]); }
  else { stakeCtl(h, "stake", L.X + 4, 120, 112); stakeCtl(h, "auto", L.X + 4, 138, 112); h.push(["go", L.X + 14, 157, 92, 18, 0]); }
  return h;
}
function snapScene(x, y, w, h) {                             // the rod, the line and the fish, in a box
  const c = CZ.snap, t = T;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  rect("#5aa0e6", x, y, w, h * 0.35); rect("#2a6ab4", x, y + h * 0.35, w, h * 0.65);
  for (let k = 0; k < 6; k++) rect("#3c7cc8", x + ((k * 47 + Math.floor(t * 12)) % w), y + h * 0.35 + 4 + (k * 13) % (h * 0.6), 6, 1);
  const tipX = x + 10, tipY = y + 6, lm = Math.log(Math.max(1, c.m)), far = Math.min(1, lm / Math.log(50));
  rect("#6a4428", x, y + 14, 14, 2); line("#8a5c38", x + 2, y + 15, tipX, tipY);       // the rod, from the corner
  let fx = x + w * (0.35 + 0.55 * far), fy = y + h * (0.5 + 0.35 * far);
  const ten = Math.min(1, lm / Math.log(20)), col = c.phase === "reel" ? "hsl(" + Math.floor(50 - 50 * ten) + ",100%," + Math.floor(85 - 25 * ten) + "%)" : WHITE;
  if (c.phase === "reel") { fx += Math.sin(t * 9) * (1 + 3 * ten); fy += Math.cos(t * 7) * (1 + 2 * ten); }
  if (c.phase === "cashed") { const u = Math.min(1, c.st / 0.8); fx = lerp(fx, tipX + 20, u); fy = lerp(fy, y + h * 0.25, u); }
  if (c.phase === "snap") { const u = Math.min(1, c.st / 1.2); fx += u * w * 0.5; line(WHITE, tipX, tipY, tipX + 20, tipY + 16 + u * 10); }
  else if (c.phase !== "stake") line(col, tipX, tipY, Math.round(fx), Math.round(fy - 2));
  if (c.phase !== "stake") fitDraw(atlas, c.fish, fx, fy, 30, 18, 2);
  g.restore();
}
function drawSnap() {
  const c = CZ.snap, L = czL(), X = L.X;
  rect("#08140f", 0, 0, LW, LH);
  czTitle(L, "LINE SNAP");
  const sx = L.w ? X : X, sy = L.w ? 20 : 26, sw = L.w ? 228 : 120, sh = L.w ? 110 : 70;
  snapScene(sx, sy, sw, sh); outline(sx, sy, sw, sh, CHIP);
  const mc = c.phase === "snap" ? RED : c.phase === "cashed" ? GOLD : WHITE;
  text(c.phase === "stake" ? "X1.00" : fmtX(c.m), sx + sw / 2 + (L.w ? 10 : 6), sy + (L.w ? 20 : 13), L.w ? 3 : 2, mc, "center", null);
  const hy = L.w ? 136 : 100;                                // the last results
  c.hist.slice(0, 6).forEach(([m, won], i) => { const s = fmtX(m), bw = L.w ? 36 : 18; box(sx + i * (bw + 2), hy, bw, 10, won ? CHIP : "#6a3030"); text(L.w ? s : Math.floor(m) + (m >= 10 ? "" : ""), sx + i * (bw + 2) + bw / 2, hy + 5, 1, won ? CHIP : "#ff8c8c", "center", null); });
  for (const [id, x, y, w, h, v] of snapHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, L.w ? 112 : 112, c.bet, c.phase === "reel" ? "#2a4a3c" : CHIP, L.w ? "STAKE" : "BET");
    else if (id === "auto" && v < 0) drawStakeCtl(x, y, 112, c.auto ? "X" + c.auto : "OFF", c.phase === "reel" ? "#2a4a3c" : "#8cc8a8", "AUTO");
    else if (id === "go") { const reel = c.phase === "reel", ok = reel || tav().chips >= c.bet; btn(x, y, w, h, reel ? "CASH OUT " + Math.floor(c.staked * c.m) : "REEL IN", reel ? GOLD : ok ? CHIP : GREY); }
  }
  text(c.msg.slice(0, L.w ? 56 : 19), L.w ? X + 114 : X + 60, L.w ? 158 : 185, 1, c.phase === "snap" ? "#ff8c8c" : c.phase === "cashed" ? GOLD : "#c8e6d2", "center", null);
  if (L.w) { text("CAN SNAP ANY TIME", X + 292, 136, 1, "#5a8a74", "center", null); text("ABOUT 95% BACK", X + 292, 146, 1, "#5a8a74", "center", null); text("SPACE: REEL / CASH OUT   UP/DOWN: AUTO", X + 174, 174, 1, "#5a8a74", "center", null); }
  text(c.phase === "reel" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function snapTap(rx, ly) {
  const c = CZ.snap, h = hitAt(snapHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "reel") closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "go") snapGo();
  else if (c.phase === "reel") return;
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "auto") { c.auto = SNAP_AUTO[(SNAP_AUTO.indexOf(c.auto) + v + SNAP_AUTO.length) % SNAP_AUTO.length]; play("tick"); }
}
function snapKey(code, dir) {
  const c = CZ.snap;
  if (code === "Space" || code === "Enter") snapGo();
  else if (c.phase === "reel") return;
  else if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "ArrowUp" || code === "ArrowDown" || code === "KeyW" || code === "KeyS") { const d = code === "ArrowUp" || code === "KeyW" ? 1 : -1; c.auto = SNAP_AUTO[(SNAP_AUTO.indexOf(c.auto) + d + SNAP_AUTO.length) % SNAP_AUTO.length]; play("tick"); }
}
EXTRA_OV.snap = { draw: drawSnap, tap: snapTap, key: snapKey, back: () => CZ.snap && CZ.snap.phase === "reel" ? "snap" : "machines", music: true };

// ---- BIGGER FISH. A fish card shows a weight from 1 to 100 lb; call whether the next is heavier or lighter. Ties lose.
// One card in 33 is a legendary, which always counts as right. Each right call multiplies the run by the fair odds
// (1 / chance of being right) and cashing out pays 0.95 x that, so the house edge is taken once, not every call: about
// 95% back however far you push. Cash out any time after one right call. Caps: x500 and 5,000 chips (cashes out for you).
const BF_N = 100, BF_LEG = 0.03, BF_CAP = 500;
const BF_POOL = C21_POOL.slice().sort((a, b) => SPEC[a][3][1] - SPEC[b][3][1]);   // light species for light cards
CZ.big = null;
function bigOpen() { if (!CZ.big) CZ.big = { bet: 10, phase: "stake", cur: null, seen: [], M: 1, n: 0, msg: "PLACE A BET AND DEAL", win: 0, st: 0 }; }
function bigCard(w) { return { id: BF_POOL[Math.min(BF_POOL.length - 1, Math.floor((w - 1) / BF_N * BF_POOL.length))], w, leg: false }; }
const bigP = (w, dir) => (1 - BF_LEG) * (dir > 0 ? BF_N - w : w - 1) / BF_N + BF_LEG;
const bigCashNow = c => Math.floor(c.staked * EDGE * c.M);
function bigDeal() {
  const c = CZ.big;
  if (tav().chips < c.bet || c.bet < 5) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  c.cur = bigCard(1 + Math.floor(Math.random() * BF_N)); c.seen = []; c.M = 1; c.n = 0; c.phase = "play"; c.win = 0; c.st = 0;
  c.msg = "HEAVIER OR LIGHTER?"; play("tick");
}
function bigCall(dir) {
  const c = CZ.big; if (c.phase !== "play") return;
  const p = bigP(c.cur.w, dir), prev = c.cur;
  let next, right;
  if (Math.random() < BF_LEG) { next = { id: C21_LEG[Math.floor(Math.random() * C21_LEG.length)], w: prev.w, leg: true }; right = true; }
  else { const w = 1 + Math.floor(Math.random() * BF_N); next = bigCard(w); right = dir > 0 ? w > prev.w : w < prev.w; }
  c.seen.unshift(prev); c.seen.length = Math.min(c.seen.length, 8); c.cur = next; c.st = 0;
  if (!right) { c.phase = "done"; c.win = 0; c.msg = next.w === prev.w ? "A TIE. THE HOUSE TAKES IT" : "WRONG! IT WAS " + next.w + " LB"; play("miss"); return; }
  c.M /= p; c.n++;
  if (c.n >= 10) tavAward("biggerfish");
  c.msg = next.leg ? "A LEGEND! COUNTS AS RIGHT" : "RIGHT! " + c.n + " IN A ROW"; play(next.leg ? "fanfare" : "hit");
  if (EDGE * c.M >= BF_CAP || bigCashNow(c) >= MAX_WIN) bigCash(true);
}
function bigCash(capped) {
  const c = CZ.big; if (c.phase !== "play" || !c.n) { play("miss"); return; }
  c.win = Math.min(MAX_WIN, bigCashNow(c), Math.floor(c.staked * BF_CAP)); c.phase = "done";
  addChips(c.win, c.win > c.staked ? "win" : "");
  c.msg = (capped ? "MAXED OUT! +" : "CASHED OUT +") + c.win; play("chime");
}
function bigHits() {
  const L = czL(), h = [];
  if (L.w) { const px = L.X + 236; if (CZ.big.phase === "play") { h.push(["hi", px, 30, 112, 24, 1]); h.push(["lo", px, 58, 112, 24, -1]); h.push(["cash", px, 90, 112, 22, 0]); } else { stakeCtl(h, "stake", px, 40, 112); h.push(["deal", px, 62, 112, 24, 0]); } }
  else if (CZ.big.phase === "play") { h.push(["hi", L.X + 4, 128, 55, 20, 1]); h.push(["lo", L.X + 61, 128, 55, 20, -1]); h.push(["cash", L.X + 14, 152, 92, 18, 0]); }
  else { stakeCtl(h, "stake", L.X + 4, 132, 112); h.push(["deal", L.X + 14, 152, 92, 18, 0]); }
  return h;
}
function fishCardBig(x, y, cw, chh, card, dim) {              // a big Bigger Fish card
  const leg = card.leg;
  g.save(); if (dim) g.globalAlpha = 0.55;
  rect(leg ? "#fff2c0" : "#f6f2e6", x, y, cw, chh); outline(x, y, cw, chh, leg ? GOLD : INK);
  text(leg ? "!" : card.w, x + 3, y + 5, 1, leg ? "#b0781a" : INK, "left", null);
  if (cw > 30) text(leg ? "LEGEND" : "LB", x + cw - 3, y + chh - 6, 1, leg ? "#b0781a" : "#8a8070", "right", null);
  fitDraw(atlas, card.id, x + cw / 2, y + chh / 2 + 1, cw - 8, chh - 16, cw > 30 ? 3 : 1);
  g.restore();
}
function drawBig() {
  const c = CZ.big, L = czL(), X = L.X;
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  czTitle(L, "BIGGER FISH");
  if (L.w) {
    if (c.cur) fishCardBig(X + 60, 26, 70, 92, c.cur);
    else { rect("#1e285a", X + 60, 26, 70, 92); rect("#3c4a8a", X + 63, 29, 64, 86); }
    c.seen.slice(0, 6).forEach((q, i) => fishCardBig(X + 4 + (i % 2) * 26, 26 + Math.floor(i / 2) * 32, 22, 28, q, true));
    text(c.phase === "play" ? "STREAK " + c.n : c.phase === "done" && c.win ? "WON " + c.win : "", X + 95, 128, 1, GOLD, "center", null);
    text(c.msg.slice(0, 30), X + 95, 144, 1, c.phase === "done" && !c.win ? "#ff8c8c" : WHITE, "center", null);
    ["WEIGHTS 1 TO 100", "TIES LOSE", "A LEGEND = RIGHT", "ABOUT 95% BACK"].forEach((l, i) => text(l, X + 292, 124 + i * 10, 1, "#8cc8a8", "center", null));
    text("UP: HEAVIER  DOWN: LIGHTER  SPACE: CASH", LW / 2, 172, 1, "#5a8a74", "center", null);
  } else {
    if (c.cur) fishCardBig(X + 35, 28, 50, 66, c.cur);
    else { rect("#1e285a", X + 35, 28, 50, 66); rect("#3c4a8a", X + 37, 30, 46, 62); }
    c.seen.slice(0, 2).forEach((q, i) => fishCardBig(X + (i ? 98 : 4), 46, 18, 24, q, true));
    text(c.phase === "play" ? "STREAK " + c.n : c.phase === "done" && c.win ? "WON " + c.win : "", X + 60, 102, 1, GOLD, "center", null);
    text(c.msg.slice(0, 19), X + 60, 114, 1, c.phase === "done" && !c.win ? "#ff8c8c" : WHITE, "center", null);
    text("TIES LOSE. 95% BACK", X + 60, 180, 1, "#5a8a74", "center", null);
  }
  for (const [id, x, y, w, h, v] of bigHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "deal") btn(x, y, w, h, "DEAL", tav().chips >= c.bet ? GOLD : GREY);
    else if (id === "hi" || id === "lo") { const p = bigP(c.cur.w, v), x2 = EDGE * c.M / p; btn(x, y, w, h, (L.w ? (v > 0 ? "HEAVIER " : "LIGHTER ") : (v > 0 ? "UP " : "DOWN ")) + fmtX(x2).replace(".00", ""), v > 0 ? CHIP : CYAN); }
    else if (id === "cash") btn(x, y, w, h, c.n ? "CASH OUT " + bigCashNow(c) : "CALL ONE FIRST", c.n ? GOLD : GREY);
  }
  text(c.phase === "play" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function bigTap(rx, ly) {
  const c = CZ.big, h = hitAt(bigHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "play") closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "deal") bigDeal();
  else if (id === "hi" || id === "lo") bigCall(v);
  else if (id === "cash") bigCash();
}
function bigKey(code, dir) {
  const c = CZ.big;
  if (c.phase === "play") {
    if (code === "ArrowUp" || code === "KeyW") bigCall(1);
    else if (code === "ArrowDown" || code === "KeyS") bigCall(-1);
    else if (code === "Space" || code === "Enter") bigCash();
  } else if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "Space" || code === "Enter") bigDeal();
}
EXTRA_OV.bigger = { draw: drawBig, tap: bigTap, key: bigKey, back: () => CZ.big && CZ.big.phase === "play" ? "bigger" : "tables", music: true };

// ===================================================================== Part 3
// ---- CROWN & ANCHOR, the old sailors' dice game. Three dice with six symbols; bet on one. One match pays x2 (even
// money), two x3, three x10: 205 / 216 = 94.9% back (the traditional x4 for three would be 92%). Title ANCHORS AWEIGH.
const CA_FACES = [["anchor", "ANCHOR"], ["hat3", "CROWN"], ["clown", "FISH"], ["blacktip", "SHARK"], ["boot", "BOOT"], ["jelly0", "JELLY"]], CA_PAY = [0, 2, 3, 10];
CZ.ca = null;
function caOpen() { if (!CZ.ca) CZ.ca = { bet: 10, pick: 0, phase: "bet", dice: [0, 1, 2], t: 0, msg: "PICK ONE AND ROLL", win: 0, k: 0 }; }
function caRoll() {
  const c = CZ.ca; if (c.phase === "roll") return;
  if (tav().chips < c.bet || c.bet < 5) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet; c.on = c.pick;
  c.final = [0, 1, 2].map(() => Math.floor(Math.random() * 6)); c.phase = "roll"; c.t = 0; c.win = 0; c.msg = "ROLLING..."; play("tick");
}
function caSettle() {
  const c = CZ.ca; c.dice = c.final; c.phase = "done";
  const n = c.dice.filter(d => d === c.on).length; c.win = Math.floor(c.staked * CA_PAY[n]);
  if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
  if (c.dice.every(d => d === 0)) tavAward("anchors");
  c.msg = n ? (n === 3 ? "THREE " + CA_FACES[c.on][1] + "S! +" : n === 2 ? "TWO! +" : "ONE! +") + c.win : "NO " + CA_FACES[c.on][1] + ". UNLUCKY"; play(n >= 2 ? "fanfare" : n ? "chime" : "miss");
}
function caTick(dt) { const c = CZ.ca; if (!c || c.phase !== "roll") return; c.t += dt; c.k += dt; if (c.k > 0.07) { c.k = 0; c.dice = c.dice.map(() => Math.floor(Math.random() * 6)); play("reel"); } if (c.t > 0.9) caSettle(); }
function caHits() {
  const L = czL(), h = [];
  if (L.w) { CA_FACES.forEach((f, i) => h.push(["face", L.X + (i % 3) * 76, 70 + Math.floor(i / 3) * 46, 72, 42, i])); const px = L.X + 236; stakeCtl(h, "stake", px, 70, 112); h.push(["roll", px, 92, 112, 26, 0]); }
  else { CA_FACES.forEach((f, i) => h.push(["face", L.X + 4 + (i % 3) * 38, 70 + Math.floor(i / 3) * 28, 36, 26, i])); stakeCtl(h, "stake", L.X + 4, 128, 112); h.push(["roll", L.X + 14, 148, 92, 18, 0]); }
  return h;
}
function caDie(x, y, sz, f) { rect("#f6f2e6", x, y, sz, sz); outline(x, y, sz, sz, INK); rect("#dcd4c0", x + 1, y + sz - 3, sz - 2, 2); fitDraw(atlas, CA_FACES[f][0], x + sz / 2, y + sz / 2 - 1, sz - 6, sz - 8, 3); }
function drawCa() {
  const c = CZ.ca, L = czL(), X = L.X;
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  czTitle(L, "CROWN & ANCHOR");
  const dz = L.w ? 34 : 28, dx = L.w ? X + 114 - (3 * dz + 16) / 2 : X + 60 - (3 * dz + 8) / 2;
  c.dice.forEach((f, i) => caDie(dx + i * (dz + (L.w ? 8 : 4)), L.w ? 22 : 26, dz, f));
  text(c.msg.slice(0, L.w ? 36 : 19), L.w ? X + 114 : X + 60, L.w ? 62 : 60, 1, c.phase === "done" && c.win ? GOLD : c.phase === "done" ? "#ff8c8c" : WHITE, "center", null);
  for (const [id, x, y, w, h, v] of caHits()) {
    if (id === "face") { const on = v === c.pick; rect(on ? "#1e6a46" : "#0a3a24", x, y, w, h); outline(x, y, w, h, on ? GOLD : "#2a7a5a"); fitDraw(atlas, CA_FACES[v][0], x + w / 2, y + h / 2 - (L.w ? 4 : 0), w - 10, h - (L.w ? 16 : 6), 3); if (L.w) text(CA_FACES[v][1], x + w / 2, y + h - 6, 1, on ? GOLD : "#a0c8b4", "center", null); }
    else if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "roll") btn(x, y, w, h, "ROLL", c.phase === "roll" ? GREY : tav().chips >= c.bet ? GOLD : GREY);
  }
  if (L.w) { ["ONE MATCH  X2", "TWO MATCH  X3", "THREE      X10", "ABOUT 95% BACK"].forEach((l, i) => text(l, X + 292, 128 + i * 10, 1, "#8cc8a8", "center", null)); text("ARROWS: PICK   UP/DOWN: STAKE   SPACE: ROLL", LW / 2, 176, 1, "#5a8a74", "center", null); }
  else text("1 X2  2 X3  3 X10", X + 60, 176, 1, "#8cc8a8", "center", null);
  text(c.phase === "roll" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function caTap(rx, ly) {
  const c = CZ.ca, h = hitAt(caHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "roll") closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (c.phase === "roll") return;
  if (id === "face") { c.pick = v; play("tick"); }
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "roll") caRoll();
}
function caKey(code, dir) {
  const c = CZ.ca; if (c.phase === "roll") return;
  if (dir) { c.pick = (c.pick + dir + 6) % 6; play("tick"); }
  else if (code === "ArrowUp" || code === "KeyW" || code === "ArrowDown" || code === "KeyS") { c.bet = stakeStep(c.bet, code === "ArrowUp" || code === "KeyW" ? 1 : -1); play("tick"); }
  else if (code === "Space" || code === "Enter") caRoll();
}
EXTRA_OV.crown = { draw: drawCa, tap: caTap, key: caKey, back: () => CZ.ca && CZ.ca.phase === "roll" ? "crown" : "tables", music: true };

// ---- THE REEL DEAL: a three-reel slot machine with fishing reels. Each reel has 24 stops (weights below, the same on
// every reel, each reel in its own fixed order). Pays on the middle line: three of a kind (legend x250, shark x60, tuna
// x25, clown x12, minnow x8, old boots x3), bait anywhere (1 = stake back, 2 = x5, 3 = x20), or two of one fish (legend
// x10, shark x4, tuna x3, clown x2, minnow x2). Worked out exactly: 94.97% back, 25% of spins pay more than the stake.
const RD_SYM = { L: [null, "LEGEND"], S: ["blacktip", "SHARK"], T: ["tuna", "TUNA"], K: ["clown", "CLOWN"], M: ["minnow", "MINNOW"], B: ["boot", "BOOT"], C: ["shrimp", "BAIT"], G: [null, "WEED"] };
const RD_W = { L: 1, S: 2, T: 3, K: 4, M: 5, B: 4, C: 1, G: 4 };
const RD_THREE = { L: 250, S: 60, T: 25, K: 12, M: 8, B: 3 }, RD_BAIT = [0, 1, 5, 20], RD_PAIR = { L: 10, S: 4, T: 3, K: 2, M: 2 };
const RD_STRIPS = [0, 1, 2].map(k => { const r = RNG(hashStr("reel deal " + k)), a = []; for (const [s0, n] of Object.entries(RD_W)) for (let i = 0; i < n; i++) a.push(s0); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
function rdPays(t) {                                         // -> multiple of the stake for symbols t (three letters)
  if (t[0] === t[1] && t[1] === t[2] && RD_THREE[t[0]]) return RD_THREE[t[0]];
  const nb = t.filter(x => x === "C").length; if (nb) return RD_BAIT[nb];
  for (const f of "LSTKM") if (t.filter(x => x === f).length === 2) return RD_PAIR[f];
  return 0;
}
CZ.rd = null;
function rdOpen() { if (!CZ.rd) CZ.rd = { bet: 10, phase: "idle", stops: [0, 5, 10], off: [0, 0, 0], t: 0, msg: "PULL THE LEVER", win: 0, k: 0 }; }
function rdSpin() {
  const c = CZ.rd; if (c.phase === "spin") return;
  if (tav().chips < c.bet || c.bet < 5) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  c.final = [0, 1, 2].map(() => Math.floor(Math.random() * 24)); c.phase = "spin"; c.t = 0; c.win = 0; c.msg = ""; c.lever = 0.3; play("tick");
}
function rdSettle() {
  const c = CZ.rd, t = c.final.map((s0, k) => RD_STRIPS[k][s0]), x = rdPays(t);
  c.phase = "done"; c.win = Math.floor(c.staked * x);
  if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
  if (t.every(q => q === "L")) tavAward("reeldeal");
  c.msg = x >= 25 ? "BIG CATCH! +" + c.win : x > 1 ? "WIN! +" + c.win : x === 1 ? "BAIT: STAKE BACK" : "NOTHING. AGAIN?";
  play(x >= 25 ? "fanfare" : x > 1 ? "chime" : x ? "tick" : "miss");
}
const RD_STOP = [0.8, 1.15, 1.5];
function rdTick(dt) {
  const c = CZ.rd; if (!c) return;
  if (c.lever > 0) c.lever = Math.max(0, c.lever - dt);
  if (c.phase !== "spin") return;
  c.t += dt; c.k += dt;
  for (let k = 0; k < 3; k++) { if (c.t < RD_STOP[k]) c.off[k] = (c.off[k] + dt * 18) % 24; else if (c.stops[k] !== c.final[k] || c.off[k]) { c.stops[k] = c.final[k]; c.off[k] = 0; play("hit"); } }
  if (c.k > 0.06) { c.k = 0; play("reel"); }
  if (c.t >= RD_STOP[2]) rdSettle();
}
function rdSymbol(sym, cx, cy, sz) {
  if (sym === "G") { for (let k = -1; k <= 1; k++) for (let y = 0; y < sz * 0.7; y += 2) rect("#46a046", cx + k * 4 + Math.round(Math.sin(y * 0.4 + k) * 1.5), cy + sz * 0.35 - y, 1, 2); return; }
  if (sym === "L") { disc("#fff2a0", cx, cy, sz * 0.42); fitDraw(atlas, C21_LEG[0], cx, cy, sz - 4, sz - 6, 2); return; }
  fitDraw(atlas, RD_SYM[sym][0], cx, cy, sz - 4, sz - 6, 2);
}
function rdHits() {
  const L = czL(), h = [];
  if (L.w) { const px = L.X + 236; stakeCtl(h, "stake", px, 30, 112); h.push(["spin", px, 52, 112, 26, 0]); h.push(["lever", L.X + 196, 26, 30, 110, 0]); }
  else { stakeCtl(h, "stake", L.X + 4, 130, 112); h.push(["spin", L.X + 14, 150, 92, 18, 0]); h.push(["lever", L.X + 104, 28, 16, 80, 0]); }
  return h;
}
function drawRd() {
  const c = CZ.rd, L = czL(), X = L.X;
  tavernBg();
  czTitle(L, "THE REEL DEAL", "#ff6e6e");
  const mx = L.w ? X + 8 : X + 4, my = L.w ? 22 : 26, cw = L.w ? 186 : 98, ch = L.w ? 116 : 84, sz = L.w ? 32 : 22;
  rect("#7a1e1e", mx, my, cw, ch); outline(mx, my, cw, ch, GOLD); rect("#5a1414", mx + 2, my + ch - 10, cw - 4, 8);
  text(L.w ? "~ THE REEL DEAL ~".replace(/~/g, "*") : "REEL DEAL", mx + cw / 2, my + 7, 1, GOLD, "center", null);
  const wx0 = mx + (L.w ? 12 : 6), wy = my + 15, ww = (cw - (L.w ? 24 : 12) - 8) / 3, wh = sz * 3;
  for (let k = 0; k < 3; k++) {
    const x = wx0 + k * (ww + 4);
    rect("#f6f2e6", x, wy, ww, wh); outline(x, wy, ww, wh, INK);
    g.save(); g.beginPath(); g.rect(x + 1, wy + 1, ww - 2, wh - 2); g.clip();
    const pos = c.phase === "spin" && c.t < RD_STOP[k] ? c.stops[k] + c.off[k] : c.stops[k], base = Math.floor(pos), fr = pos - base;
    for (let r = -1; r <= 2; r++) { const sym = RD_STRIPS[k][((base + r) % 24 + 24) % 24]; rdSymbol(sym, x + ww / 2, wy + sz / 2 + (r - fr) * sz + sz * 0, sz); }
    g.restore();
  }
  rect(c.phase === "done" && c.win > c.staked ? GOLD : "#e63246", wx0 - 3, wy + sz * 1.5 - 1, ww * 3 + 14, 1);   // the pay line (middle row)
  const lv = c.lever ? Math.sin((0.3 - c.lever) / 0.3 * Math.PI) : 0, lx = L.w ? X + 210 : X + 111, ly0 = L.w ? 40 : 34, llen = L.w ? 60 : 40;
  rect("#8a8aa0", lx - 1, ly0 + 8, 3, llen); disc("#e63246", lx, ly0 + lv * llen * 0.8, L.w ? 6 : 4);   // the lever
  text(c.msg.slice(0, L.w ? 30 : 19), L.w ? X + 101 : X + 60, L.w ? 150 : 120, 1, c.phase === "done" && c.win > c.staked ? GOLD : WHITE, "center", null);
  for (const [id, x, y, w, h, v] of rdHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "spin") btn(x, y, w, h, "SPIN", c.phase === "spin" ? GREY : tav().chips >= c.bet ? GOLD : GREY);
  }
  if (L.w) {
    const rows = [["L", "X250"], ["S", "X60"], ["T", "X25"], ["K", "X12"], ["M", "X8"], ["B", "X3"]];
    rows.forEach(([q, p0], i) => { const y = 92 + i * 12; for (let k = 0; k < 3; k++) rdSymbol(q, L.X + 248 + k * 16, y, 15); text(p0, L.X + 344, y, 1, CHIP, "right", null); });
    text("BAIT: X1 / X5 / X20", L.X + 292, 166, 1, "#d8c8b0", "center", null); text("PAIRS: X2 TO X10", L.X + 292, 176, 1, "#d8c8b0", "center", null);
    text("ABOUT 95% BACK", X + 101, 164, 1, "#a08c70", "center", null);
  } else text("3 LEGENDS X250", X + 60, 176, 1, "#d8c8b0", "center", null);
  text(c.phase === "spin" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function rdTap(rx, ly) {
  const c = CZ.rd, h = hitAt(rdHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "spin") closeOverlay(); return; }
  if (c.phase === "spin") return;
  if (h[0] === "stake") { c.bet = stakeStep(c.bet, h[5]); play("tick"); } else rdSpin();
}
function rdKey(code, dir) { const c = CZ.rd; if (c.phase === "spin") return; if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); } else if (code === "Space" || code === "Enter" || code === "ArrowDown") rdSpin(); }
EXTRA_OV.reel = { draw: drawRd, tap: rdTap, key: rdKey, back: () => CZ.rd && CZ.rd.phase === "spin" ? "reel" : "machines", music: true };

// ---- THE SHIP'S WHEEL: spin the helm. 40 segments: 24 x0, 8 x1 (stake back), 5 x2, 2 x5, 1 x10 -> 38 / 40 = 95% back.
const WH_NZ = [10, 1, 2, 1, 5, 1, 2, 1, 2, 1, 5, 1, 2, 1, 2, 1];
const WH_SEG = (() => { const a = new Array(40).fill(0); WH_NZ.forEach((v, k) => { a[Math.round(k * 2.5)] = v; }); return a; })();
const WH_COL = { 0: "#2a1e3c", 1: "#8c96c8", 2: "#46c88c", 5: "#ffd246", 10: "#f05050" };
CZ.wh = null;
function whOpen() { if (!CZ.wh) CZ.wh = { bet: 10, phase: "idle", ang: 0, a0: 0, a1: 0, t: 0, msg: "SPIN THE WHEEL", win: 0, seg: 0, k: 0, last: -1 }; }
function whSpin() {
  const c = CZ.wh; if (c.phase === "spin") return;
  if (tav().chips < c.bet || c.bet < 5) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  c.seg = Math.floor(Math.random() * 40);
  const segA = (c.seg + 0.5) / 40 * Math.PI * 2, jitter = (Math.random() - 0.5) * 0.8 * (Math.PI * 2 / 40);
  c.a0 = c.ang; c.a1 = c.ang - (c.ang % (Math.PI * 2)) + Math.PI * 2 * 4 + (Math.PI * 2 - segA) + jitter;   // the segment ends under the pointer at the top
  c.t = 0; c.phase = "spin"; c.win = 0; c.msg = ""; play("tick");
}
function whTick(dt) {
  const c = CZ.wh; if (!c || c.phase !== "spin") return;
  c.t += dt; const u = Math.min(1, c.t / 3), e = 1 - Math.pow(1 - u, 3);
  c.ang = c.a0 + (c.a1 - c.a0) * e;
  const under = Math.floor(((Math.PI * 2 - (c.ang % (Math.PI * 2))) % (Math.PI * 2)) / (Math.PI * 2) * 40) % 40;
  if (under !== c.last) { c.last = under; play("tick", 0.6); }
  if (u >= 1) {
    const x = WH_SEG[c.seg]; c.phase = "done"; c.win = Math.floor(c.staked * x);
    if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
    if (x === 10) tavAward("helmsman");
    c.msg = x === 10 ? "X10! TOP OF THE WHEEL! +" + c.win : x > 1 ? "X" + x + "! +" + c.win : x === 1 ? "X1: STAKE BACK" : "NOTHING. SPIN AGAIN?"; play(x >= 5 ? "fanfare" : x > 1 ? "chime" : x ? "tick" : "miss");
  }
}
function whHits() {
  const L = czL(), h = [];
  if (L.w) { const px = L.X + 236; stakeCtl(h, "stake", px, 40, 112); h.push(["spin", px, 62, 112, 26, 0]); }
  else { stakeCtl(h, "stake", L.X + 4, 130, 112); h.push(["spin", L.X + 14, 150, 92, 18, 0]); }
  return h;
}
function drawWheel(cx, cy, r, ang) {
  for (let i = 0; i < 40; i++) {
    const a0 = ang + i / 40 * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / 40;
    g.fillStyle = WH_COL[WH_SEG[i]]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
    if (WH_SEG[i] >= 2 && r >= 50) { const am = (a0 + a1) / 2; text(WH_SEG[i], cx + Math.cos(am) * r * 0.78, cy + Math.sin(am) * r * 0.78, 1, INK, "center", null); }
  }
  g.strokeStyle = "#8a5c38"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
  for (let k = 0; k < 8; k++) { const a = ang + k / 8 * Math.PI * 2; rect("#8a5c38", Math.round(cx + Math.cos(a) * (r + 5)) - 2, Math.round(cy + Math.sin(a) * (r + 5)) - 2, 4, 4); }   // the handles
  disc("#6a4428", cx, cy, Math.max(4, r * 0.16)); disc(GOLD, cx, cy, Math.max(2, r * 0.07));
  poly(WHITE, [[cx - 4, cy - r - 7], [cx + 4, cy - r - 7], [cx, cy - r + 2]]);                    // the pointer
}
function drawWh() {
  const c = CZ.wh, L = czL(), X = L.X;
  rect("#0e1a2e", 0, 0, LW, LH);
  czTitle(L, "SHIP'S WHEEL", CYAN);
  if (L.w) drawWheel(X + 108, 90, 58, c.ang); else drawWheel(X + 60, 74, 38, c.ang);
  text(c.msg.slice(0, L.w ? 36 : 19), L.w ? X + 108 : X + 60, L.w ? 166 : 122, 1, c.phase === "done" && c.win > c.staked ? GOLD : WHITE, "center", null);
  for (const [id, x, y, w, h, v] of whHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "spin") btn(x, y, w, h, "SPIN", c.phase === "spin" ? GREY : tav().chips >= c.bet ? GOLD : GREY);
  }
  if (L.w) { [[10, "1 IN 40"], [5, "2 IN 40"], [2, "5 IN 40"], [1, "8 IN 40"], [0, "24 IN 40"]].forEach(([v, n], i) => { rect(WH_COL[v], L.X + 240, 100 + i * 12, 8, 8); text("X" + v, L.X + 254, 104 + i * 12, 1, WHITE, "left", null); text(n, L.X + 344, 104 + i * 12, 1, "#8c96c8", "right", null); }); text("ABOUT 95% BACK", L.X + 292, 168, 1, "#5a7aa0", "center", null); }
  else text("X1-X10 ON 16 OF 40", X + 60, 176, 1, "#8c96c8", "center", null);
  text(c.phase === "spin" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function whTap(rx, ly) {
  const c = CZ.wh, h = hitAt(whHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "spin") closeOverlay(); return; }
  if (c.phase === "spin") return;
  if (h[0] === "stake") { c.bet = stakeStep(c.bet, h[5]); play("tick"); } else whSpin();
}
function whKey(code, dir) { const c = CZ.wh; if (c.phase === "spin") return; if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); } else if (code === "Space" || code === "Enter") whSpin(); }
EXTRA_OV.wheel = { draw: drawWh, tap: whTap, key: whKey, back: () => CZ.wh && CZ.wh.phase === "spin" ? "wheel" : "machines", music: true };

function casinoTick(dt) { snapTick(dt); caTick(dt); rdTick(dt); whTick(dt); }

window.CASINO = { CA_PAY, caRoll, caSettle, caTick, RD_STRIPS, rdPays, rdSpin, rdTick, WH_SEG, whSpin, whTick, get ca() { return CZ.ca; }, get rd() { return CZ.rd; }, get wh() { return CZ.wh; }, HUBS, GAME_OPEN, snapCrash, snapGo, snapCash, snapTick, bigP, bigCall, bigCash, bigDeal, BF_POOL, LOCKER, DEALER, czIdx, czOwn, czBuy, dealerStock, dealerWeek, dealerDaysLeft, DEALER_ORDER, CZ, czShopHits, get snap() { return CZ.snap; }, get big() { return CZ.big; } };
