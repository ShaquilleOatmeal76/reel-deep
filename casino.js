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
  if (id === "decor") { const n = decorData().own.length; return ["DECORATE THE BAR", null, n ? "YOU OWN " + n + " OF " + decorList().length + ". MAKE IT YOURS" : "LAMPS, SIGNS, A FISH TANK. 2,000 TO 40,000"]; }
  if (id === "round") return ["BUY A ROUND", tav().round === dayString() ? null : ROUND_PRICE, tav().round === dayString() ? "YOU GOT TODAY'S ROUND. CHEERS!" : "EVERYONE AT THE BAR SEES YOUR NAME TODAY"];
  if (id === "locker") { const n = LOCKER.filter(czOwn).length; return ["CAPTAIN'S LOCKER", null, n ? "YOU OWN " + n + " OF " + LOCKER.length + ". PRESTIGE GEAR" : "PRESTIGE GEAR. 10,000 TO 75,000 CHIPS"]; }
  return ["SHADY DEALER", null, "THREE THINGS. THIS WEEK ONLY. NEW STOCK IN " + dealerDaysLeft() + (dealerDaysLeft() === 1 ? " DAY" : " DAYS")];
}
function casinoOpen(id) {                                    // -> true if casino.js handles this id (tavern rows, chip shop rows, hub cards)
  if (id === "locker") { TAV.lkSay = null; openOverlay("locker"); }
  else if (id === "dealer") { TAV.dlSay = null; CZ.dl.tab = 0; CZ.dl.sel = 0; openOverlay("dealer"); }
  else if (id === "decor") { CZ.dc.say = ""; openOverlay("decor"); }
  else if (id === "round") buyRound();
  else if (HUBS[id]) { CZ.hub.sel = 0; openOverlay(id); }
  else if (GAME_OPEN[id]) GAME_OPEN[id]();
  else return false;
  return true;
}
// ===================================================================== Part 2
// The tavern's games grouped into two menus (TABLES and MACHINES) so the bar doesn't get longer as games are added, plus
// Line Snap (a crash game) and Bigger Fish (higher or lower). Later parts add their games to HUBS.
const HUBS = {
  tables: { title: "THE TABLES", say: "CARDS AND DICE", games: [["c21", "CATCH 21", "FISH CARDS TO 21"], ["bigger", "BIGGER FISH", "HIGHER OR LOWER?"], ["crown", "CROWN & ANCHOR", "THE SAILOR'S DICE"], ["cup", "TOURNAMENT", "WEEKLY CATCH 21"]] },
  machines: { title: "THE MACHINES", say: "PULL, DROP, SPIN", games: [["plinko", "PLINKO", "DROP A FISH, X25"], ["snap", "LINE SNAP", "CASH OUT IN TIME"], ["reel", "THE REEL DEAL", "SLOTS TO X250"], ["wheel", "SHIP'S WHEEL", "SPIN FOR X10"], ["treasure", "TREASURE DIVE", "DODGE JELLIES"], ["net", "NET HAUL", "PICK 5 FISH"]] },
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
  treasure: () => { tdOpen(); openOverlay("treasure"); },
  net: () => { nhOpen(); openOverlay("net"); },
  cup: () => { cupData(); CZ.cupMsg = ""; openOverlay("cup"); },
};
function hubHits(o) {
  const L = czL(), g0 = HUBS[o].games;
  const tight = g0.length > 6;                              // Nov 20, 2026: 7 games a menu
  return g0.map((gm, k) => L.w ? [gm[0], L.X + (k % 2) * 178, 30 + Math.floor(k / 2) * (tight ? 32 : 34), 170, 28, k] : tight ? [gm[0], L.X + 8, 26 + k * 19, 104, 16, k] : [gm[0], L.X + 8, 26 + k * 25, 104, 22, k]);
}
function drawHub(o) {
  const H = HUBS[o], L = czL();
  tavernBg();
  if (L.w) { text(H.title, L.X, 10, 1, GOLD, "left", null); chipsAt(L.X + 348, 10, "right"); }
  else { text(H.title, L.X + 60, 8, 1, GOLD, "center", null); g.save(); g.translate(L.X, 0); chipsLine(18); g.restore(); }
  const tight = H.games.length > 6;
  for (const [id, x, y, w, h, k] of hubHits(o)) { const gm = H.games[k], sel = k === CZ.hub.sel; if (!L.w && tight) btn(x, y, w, h, gm[1], sel ? GOLD : CHIP); else btn(x, y, w, h, gm[1], sel ? GOLD : CHIP, gm[2], sel ? WHITE : "#a0c8b4"); }
  if (L.w) { if (!tight) spr("oldman", L.X + 160, 140, false, 2); else spr("oldman", L.X + 286, 136, false, 2); text(H.say, tight ? L.X + 298 : L.X + 174, 180, 1, "#a08c70", "center", null); }
  else if (tight) text(H.games[CZ.hub.sel][2], L.X + 60, 168, 1, "#a0c8b4", "center", null), text(H.say, L.X + 60, 182, 1, "#a08c70", "center", null);
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
// Stake controls ("stake" / "bet") also get a MAX button just left of the +: its step is STAKE_MAX, so every game's
// existing handler (stakeStep(bet, v) or a CUP_BETS index + v) jumps straight to the most it allows.
const isStakeId = id => id === "stake" || id === "bet";
// Tapping the amount opens the type-a-bet box (STAKE_TYPE; Nov 19, 2026). Not for the tournament's fixed chip sizes ("bet").
function stakeCtl(h, id, x, y, w) { h.push([id, x, y, 16, 15, -1]); if (isStakeId(id)) { h.push([id, x + w - 42, y, 24, 15, STAKE_MAX]); if (id === "stake") h.push([id, x + 17, y, w - 60, 15, STAKE_TYPE]); } h.push([id, x + w - 16, y, 16, 15, 1]); }
function drawStakeCtl(x, y, w, val, col, lab) {               // lab STAKE / BET = a stake control with a MAX button
  const mx = lab === "STAKE" || lab === "BET";
  box(x, y, 16, 15, col); text("-", x + 8, y + 7, 1, col, "center", null);
  box(x + w - 16, y, 16, 15, col); text("+", x + w - 8, y + 7, 1, col, "center", null);
  if (mx) { box(x + w - 42, y, 24, 15, col); text("MAX", x + w - 30, y + 7, 1, col, "center", null); }
  const num = typeof val === "number" ? val : null, room = mx ? w - 60 : w - 34;   // the space between the buttons
  if (num !== null) val = fmtChips(num);
  let t = mx ? "BET " + val : lab ? lab + " " + val : val;
  if (textW(t, 1) > room) t = String(val);                   // big amounts (Nov 20, 2026): drop the word, then shorten
  if (textW(t, 1) > room && num !== null) t = fmtChips3(num);
  text(t, mx ? x + 16 + (w - 58) / 2 : x + w / 2, y + 7, 1, WHITE, "center", null);
}
const fmtX = m => "X" + (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.floor(m));
function czTitle(L, t, col) { if (L.w) { text(t, L.X, 8, 1, col || GOLD, "left", null); chipsAt(L.X + 348, 8, "right"); } else { text(t, L.X + 60, 8, 1, col || GOLD, "center", null); g.save(); g.translate(L.X, 0); chipsLine(19); g.restore(); } }
const MAX_WIN = 5000, maxWin = st => Math.max(MAX_WIN, Math.floor(st * MAX_WIN / BASE_STAKE));   // a big bet keeps the room a 75 bet had (x66)                                         // one bet never pays more than this

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
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
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
  c.msg = "LANDED AT " + fmtX(x) + "! +" + fmtChips(c.win, 1e6); play("chime");
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
  const m = Math.exp(SNAP_R * c.t), cap = maxWin(c.staked) / c.staked;
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
    else if (id === "go") { const reel = c.phase === "reel", ok = reel || tav().chips >= c.bet; btn(x, y, w, h, reel ? "CASH OUT " + fmtChips(Math.floor(c.staked * c.m), 1e6) : "REEL IN", reel ? GOLD : ok ? CHIP : GREY); }
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
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
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
  if (EDGE * c.M >= BF_CAP || bigCashNow(c) >= maxWin(c.staked)) bigCash(true);
}
function bigCash(capped) {
  const c = CZ.big; if (c.phase !== "play" || !c.n) { play("miss"); return; }
  c.win = Math.min(maxWin(c.staked), bigCashNow(c), Math.floor(c.staked * BF_CAP)); c.phase = "done";
  addChips(c.win, c.win > c.staked ? "win" : "");
  c.msg = (capped ? "MAXED OUT! +" : "CASHED OUT +") + fmtChips(c.win, 1e6); play("chime");
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
    text(c.phase === "play" ? "STREAK " + c.n : c.phase === "done" && c.win ? "WON " + fmtChips(c.win, 1e6) : "", X + 95, 128, 1, GOLD, "center", null);
    text(c.msg.slice(0, 30), X + 95, 144, 1, c.phase === "done" && !c.win ? "#ff8c8c" : WHITE, "center", null);
    ["WEIGHTS 1 TO 100", "TIES LOSE", "A LEGEND = RIGHT", "ABOUT 95% BACK"].forEach((l, i) => text(l, X + 292, 124 + i * 10, 1, "#8cc8a8", "center", null));
    text("UP: HEAVIER  DOWN: LIGHTER  SPACE: CASH", LW / 2, 172, 1, "#5a8a74", "center", null);
  } else {
    if (c.cur) fishCardBig(X + 35, 28, 50, 66, c.cur);
    else { rect("#1e285a", X + 35, 28, 50, 66); rect("#3c4a8a", X + 37, 30, 46, 62); }
    c.seen.slice(0, 2).forEach((q, i) => fishCardBig(X + (i ? 98 : 4), 46, 18, 24, q, true));
    text(c.phase === "play" ? "STREAK " + c.n : c.phase === "done" && c.win ? "WON " + fmtChips(c.win, 1e6) : "", X + 60, 102, 1, GOLD, "center", null);
    text(c.msg.slice(0, 19), X + 60, 114, 1, c.phase === "done" && !c.win ? "#ff8c8c" : WHITE, "center", null);
    text("TIES LOSE. 95% BACK", X + 60, 180, 1, "#5a8a74", "center", null);
  }
  for (const [id, x, y, w, h, v] of bigHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "deal") btn(x, y, w, h, "DEAL", tav().chips >= c.bet ? GOLD : GREY);
    else if (id === "hi" || id === "lo") { const p = bigP(c.cur.w, v), x2 = EDGE * c.M / p; btn(x, y, w, h, (L.w ? (v > 0 ? "HEAVIER " : "LIGHTER ") : (v > 0 ? "UP " : "DOWN ")) + fmtX(x2).replace(".00", ""), v > 0 ? CHIP : CYAN); }
    else if (id === "cash") btn(x, y, w, h, c.n ? "CASH OUT " + fmtChips(bigCashNow(c), 1e6) : "CALL ONE FIRST", c.n ? GOLD : GREY);
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
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet; c.on = c.pick;
  c.final = [0, 1, 2].map(() => Math.floor(Math.random() * 6)); c.phase = "roll"; c.t = 0; c.win = 0; c.msg = "ROLLING..."; play("tick");
}
function caSettle() {
  const c = CZ.ca; c.dice = c.final; c.phase = "done";
  const n = c.dice.filter(d => d === c.on).length; c.win = Math.round(c.staked * CA_PAY[n]);
  if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
  if (c.dice.every(d => d === 0)) tavAward("anchors");
  c.msg = n ? (n === 3 ? "THREE " + CA_FACES[c.on][1] + "S! +" : n === 2 ? "TWO! +" : "ONE! +") + fmtChips(c.win, 1e6) : "NO " + CA_FACES[c.on][1] + ". UNLUCKY"; play(n >= 2 ? "fanfare" : n ? "chime" : "miss");
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
// x8, shark x4, tuna x3, clown x2, minnow x2). Worked out exactly: 93.97% back from the reels, 25% of spins pay more than
// the stake; the shared progressive jackpot (part 6) adds about 1-3% on top (more when the pot is big), never past ~97%.
const RD_SYM = { L: [null, "LEGEND"], S: ["blacktip", "SHARK"], T: ["tuna", "TUNA"], K: ["clown", "CLOWN"], M: ["minnow", "MINNOW"], B: ["boot", "BOOT"], C: ["shrimp", "BAIT"], G: [null, "WEED"] };
const RD_W = { L: 1, S: 2, T: 3, K: 4, M: 5, B: 4, C: 1, G: 4 };
const RD_THREE = { L: 250, S: 60, T: 25, K: 12, M: 8, B: 3 }, RD_BAIT = [0, 1, 5, 20], RD_PAIR = { L: 8, S: 4, T: 3, K: 2, M: 2 };   // legend pair was x10 before the jackpot
const RD_STRIPS = [0, 1, 2].map(k => { const r = RNG(hashStr("reel deal " + k)), a = []; for (const [s0, n] of Object.entries(RD_W)) for (let i = 0; i < n; i++) a.push(s0); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
function rdPays(t) {                                         // -> multiple of the stake for symbols t (three letters)
  if (t[0] === t[1] && t[1] === t[2] && RD_THREE[t[0]]) return RD_THREE[t[0]];
  const nb = t.filter(x => x === "C").length; if (nb) return RD_BAIT[nb];
  for (const f of "LSTKM") if (t.filter(x => x === f).length === 2) return RD_PAIR[f];
  return 0;
}
// The symbols on the pay line for reel stops `st`. The window shows rows stop, stop+1, stop+2 and the pay line is
// the middle one (stop+1). Until Nov 19, 2026 the payout read the top row, so pairs and three of a kind you could
// see on the line paid nothing (and some spins paid for symbols above it). Payback is unchanged: every stop is equally likely.
const rdLine = st => st.map((s0, k) => RD_STRIPS[k][(s0 + 1) % 24]);
CZ.rd = null;
function rdOpen() { if (!CZ.rd) CZ.rd = { bet: 10, phase: "idle", stops: [0, 5, 10], off: [0, 0, 0], t: 0, msg: "PULL THE LEVER", win: 0, k: 0 }; }
function rdSpin() {
  const c = CZ.rd; if (c.phase === "spin") return;
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  c.final = [0, 1, 2].map(() => Math.floor(Math.random() * 24)); c.phase = "spin"; c.t = 0; c.win = 0; c.msg = ""; c.lever = 0.3; play("tick");
}
function rdSettle() {
  const c = CZ.rd, t = rdLine(c.final), x = rdPays(t);
  c.phase = "done"; c.win = Math.round(c.staked * x);
  if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
  if (t.every(q => q === "L")) tavAward("reeldeal");
  if (Math.random() < Math.min(1, c.staked / BASE_STAKE / JP_ODDS)) { jpWin(c); return; }
  c.msg = x >= 25 ? "BIG CATCH! +" + fmtChips(c.win, 1e6) : x > 1 ? "WIN! +" + fmtChips(c.win, 1e6) : x === 1 ? "BAIT: STAKE BACK" : "NOTHING. AGAIN?";
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
  const pot = jpPot(), jflash = c.jp && Math.floor(T * 6) % 2;
  text((L.w ? "JACKPOT " : "POT ") + pot, mx + cw / 2, my + 7, 1, jflash ? WHITE : GOLD, "center", null);   // the shared progressive jackpot
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
    text("BAIT: X1 / X5 / X20", L.X + 292, 166, 1, "#d8c8b0", "center", null); text("PAIRS: X2 TO X8", L.X + 292, 176, 1, "#d8c8b0", "center", null);
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
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
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
    const x = WH_SEG[c.seg]; c.phase = "done"; c.win = Math.round(c.staked * x);
    if (c.win) addChips(c.win, c.win > c.staked ? "win" : "");
    if (x === 10) tavAward("helmsman");
    c.msg = x === 10 ? "X10! TOP OF THE WHEEL! +" + fmtChips(c.win, 1e6) : x > 1 ? "X" + x + "! +" + fmtChips(c.win, 1e6) : x === 1 ? "X1: STAKE BACK" : "NOTHING. SPIN AGAIN?"; play(x >= 5 ? "fanfare" : x > 1 ? "chime" : x ? "tick" : "miss");
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

// ===================================================================== Part 4
// ---- TREASURE DIVE: 25 crates on the sea floor, 1 / 3 / 5 / 10 of them hiding a jellyfish. Open crates one at a time;
// each safe one raises the payout, a jelly loses the stake. After k safe crates the payout is 0.95 x C(25, k) / C(25 - j, k)
// (the fair odds of getting that far, with the edge taken once), so cashing out at any point pays back 95% on average.
// Max win 5,000 (cashes out for you). Title TREASURE HUNTER: 5 crates past 10 jellies.
const TD_J = [1, 3, 5, 10];
CZ.td = null;
const tdChoose = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
const tdMult = (k, j) => EDGE * tdChoose(25, k) / tdChoose(25 - j, k);
function tdOpen() { if (!CZ.td) CZ.td = { bet: 10, j: 3, phase: "stake", jel: [], open: [], k: 0, msg: "PICK HOW MANY JELLIES", win: 0, boom: -1 }; }
function tdStart() {
  const c = CZ.td; if (c.phase === "dive") return;
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  const a = Array.from({ length: 25 }, (x, i) => i); for (let i = 24; i > 0; i--) { const q = Math.floor(Math.random() * (i + 1)); [a[i], a[q]] = [a[q], a[i]]; }
  c.jel = a.slice(0, c.j); c.open = []; c.k = 0; c.boom = -1; c.phase = "dive"; c.win = 0; c.msg = "OPEN A CRATE"; play("plop");
}
const tdCashNow = c => Math.min(maxWin(c.staked), Math.floor(c.staked * tdMult(c.k, c.j)));
function tdPick(i) {
  const c = CZ.td; if (c.phase !== "dive" || c.open.includes(i)) return;
  c.open.push(i);
  if (c.jel.includes(i)) { c.boom = i; c.phase = "done"; c.win = 0; c.msg = "A JELLY! STUNG"; play("zap"); return; }
  c.k++; play("hit");
  if (c.j === 10 && c.k >= 5) tavAward("treasure");
  c.msg = "SAFE! " + fmtX(tdMult(c.k, c.j)).replace(".00", "");
  if (c.k >= 25 - c.j || tdCashNow(c) >= maxWin(c.staked)) tdCash(true);
}
function tdCash(auto) {
  const c = CZ.td; if (c.phase !== "dive" || !c.k) { play("miss"); return; }
  c.win = tdCashNow(c); c.phase = "done"; addChips(c.win, c.win > c.staked ? "win" : "");
  c.msg = (auto ? "ALL CLEAR! +" : "SURFACED WITH +") + fmtChips(c.win, 1e6); play("chime");
}
function tdGrid() { const L = czL(); return L.w ? { x: L.X + 8, y: 22, cw: 40, ch: 28, gap: 2 } : { x: L.X + 5, y: 27, cw: 21, ch: 17, gap: 1 }; }
function tdHits() {
  const L = czL(), G = tdGrid(), h = [];
  for (let i = 0; i < 25; i++) h.push(["crate", G.x + (i % 5) * (G.cw + G.gap), G.y + Math.floor(i / 5) * (G.ch + G.gap), G.cw, G.ch, i]);
  const px = L.w ? L.X + 236 : L.X + 4, py = L.w ? 30 : 120, pw = 112;
  if (CZ.td.phase === "dive") h.push(["cash", L.w ? px : L.X + 14, L.w ? py + 52 : 152, L.w ? pw : 92, L.w ? 26 : 18, 0]);
  else { stakeCtl(h, "stake", px, py, pw); stakeCtl(h, "jel", px, py + (L.w ? 22 : 16), pw); h.push(["go", L.w ? px : L.X + 14, L.w ? py + 46 : 155, L.w ? pw : 92, L.w ? 26 : 16, 0]); }
  return h;
}
function drawTd() {
  const c = CZ.td, L = czL(), X = L.X, t = T;
  rect("#0a1e3c", 0, 0, LW, LH); for (let k = 0; k < 12; k++) rect("#0e2850", ((k * 53 + Math.floor(t * 6)) % LW), 20 + (k * 37) % 170, 2, 2);
  czTitle(L, "TREASURE DIVE", CYAN);
  const G = tdGrid(), done = c.phase === "done";
  rect("#3c3020", G.x - 3, G.y - 3, 5 * (G.cw + G.gap) + 4, 5 * (G.ch + G.gap) + 4);
  for (const [id, x, y, w, h, i] of tdHits()) {
    if (id === "crate") {
      const op = c.open.includes(i), jel = c.jel.includes(i), show = op || (done && jel);
      if (!show) { rect("#8a5c38", x, y, w, h); rect("#6a4428", x, y + Math.floor(h / 2), w, 1); rect("#6a4428", x + Math.floor(w / 2), y, 1, h); outline(x, y, w, h, "#4a2e1c"); if (done) { g.globalAlpha = 0.5; rect("#0a1e3c", x, y, w, h); g.globalAlpha = 1; } }
      else if (jel) { rect(i === c.boom ? "#5a1428" : "#1e2a46", x, y, w, h); fitDraw(atlas, "jelly0", x + w / 2, y + h / 2, w - 4, h - 4, 2); }
      else { rect("#1e3c5a", x, y, w, h); disc(GOLD, x + w / 2, y + h / 2, Math.min(w, h) * 0.28); rect("#fff6c8", Math.round(x + w / 2 - 1), Math.round(y + h / 2 - 2), 2, 2); }
    } else if (id === "stake" && i < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "jel" && i < 0) drawStakeCtl(x, y, 112, c.j, "#ff8cd2", L.w ? "JELLIES" : "JELLY");
    else if (id === "go") btn(x, y, w, h, "DIVE", tav().chips >= c.bet ? GOLD : GREY);
    else if (id === "cash") btn(x, y, w, h, c.k ? "SURFACE " + tdCashNow(c) : "OPEN ONE FIRST", c.k ? GOLD : GREY);
  }
  if (L.w) {
    const py = 30;
    if (c.phase === "dive") { text("CRATES OPEN " + c.k, X + 292, py + 6, 1, WHITE, "center", null); text("NOW " + fmtX(tdMult(c.k, c.j)), X + 292, py + 20, 1, GOLD, "center", null); text("NEXT " + fmtX(tdMult(c.k + 1, c.j)), X + 292, py + 32, 1, CHIP, "center", null); }
    text(c.msg.slice(0, 18), X + 292, 116, 1, done && !c.win ? "#ff8c8c" : done ? GOLD : WHITE, "center", null);
    ["MORE JELLIES,", "BIGGER JUMPS", "ABOUT 95% BACK"].forEach((l, i) => text(l, X + 292, 140 + i * 10, 1, "#5a7aa0", "center", null));
    text("SPACE: DIVE/SURFACE  ARROWS: STAKE, JELLIES", X + 174, 180, 1, "#3c5a80", "center", null);
  } else {
    text(c.phase === "dive" ? fmtX(tdMult(c.k, c.j)) + "  NEXT " + fmtX(tdMult(c.k + 1, c.j)) : c.msg.slice(0, 19), X + 60, c.phase === "dive" ? 126 : 112, 1, c.phase === "dive" ? GOLD : done && !c.win ? "#ff8c8c" : WHITE, "center", null);
    if (c.phase === "dive") text(c.msg.slice(0, 19), X + 60, 138, 1, WHITE, "center", null);
    else text("ABOUT 95% BACK", X + 60, 180, 1, "#5a7aa0", "center", null);
  }
  text(c.phase === "dive" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function tdTap(rx, ly) {
  const c = CZ.td, h = hitAt(tdHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "dive") closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "crate") tdPick(v);
  else if (id === "cash") tdCash();
  else if (id === "go") tdStart();
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "jel") { c.j = TD_J[(TD_J.indexOf(c.j) + v + TD_J.length) % TD_J.length]; play("tick"); }
}
function tdKey(code, dir) {
  const c = CZ.td;
  if (c.phase === "dive") { if (code === "Space" || code === "Enter") tdCash(); return; }
  if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "ArrowUp" || code === "ArrowDown" || code === "KeyW" || code === "KeyS") { c.j = TD_J[(TD_J.indexOf(c.j) + (code === "ArrowUp" || code === "KeyW" ? 1 : -1) + TD_J.length) % TD_J.length]; play("tick"); }
  else if (code === "Space" || code === "Enter") tdStart();
}
EXTRA_OV.treasure = { draw: drawTd, tap: tdTap, key: tdKey, back: () => CZ.td && CZ.td.phase === "dive" ? "treasure" : "machines", music: true };

// ---- NET HAUL (keno): pick 5 of 20 fish, cast the net, it brings up 8. 3 matches pay x2, 4 pay x6, all 5 pay x40:
// 94.6% back, 30% of casts pay. Every cast draws on the spot (a shared midnight draw would be seeded from the date, so
// anyone reading the game's code could work out tomorrow's fish). Title FULL NET for all five.
const NH_FISH = ["minnow", "clown", "tuna", "squid", "crab", "shrimp", "blacktip", "koi", "puffer", "bass", "trout", "perch", "sword", "parrot", "ember", "boot", "anchor", "jelly0", "gboot", "bottle"].filter(f => DATA.atlas[f]);
const NH_PAY = [0, 0, 0, 2, 6, 40];
CZ.nh = null;
function nhOpen() { if (!CZ.nh) CZ.nh = { bet: 10, picks: [], phase: "pick", drawn: [], shown: 0, t: 0, msg: "PICK 5 FISH", win: 0, cur: 0 }; }
function nhQuick() { const c = CZ.nh; if (c.phase === "draw") return; const a = NH_FISH.map((f, i) => i); for (let i = a.length - 1; i > 0; i--) { const q = Math.floor(Math.random() * (i + 1)); [a[i], a[q]] = [a[q], a[i]]; } c.picks = a.slice(0, 5).sort((x, y) => x - y); c.drawn = []; c.phase = "pick"; c.msg = "QUICK PICK!"; play("tick"); }
function nhToggle(i) {
  const c = CZ.nh; if (c.phase === "draw") return;
  if (c.phase === "done") { c.phase = "pick"; c.drawn = []; }
  if (c.picks.includes(i)) c.picks = c.picks.filter(x => x !== i); else if (c.picks.length < 5) c.picks.push(i); else { play("miss"); return; }
  c.msg = c.picks.length < 5 ? "PICK " + (5 - c.picks.length) + " MORE" : "CAST THE NET!"; play("tick");
}
function nhCast() {
  const c = CZ.nh; if (c.phase === "draw") return;
  if (c.picks.length !== 5) { c.msg = "PICK 5 FISH FIRST"; play("miss"); return; }
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  const a = NH_FISH.map((f, i) => i); for (let i = a.length - 1; i > 0; i--) { const q = Math.floor(Math.random() * (i + 1)); [a[i], a[q]] = [a[q], a[i]]; }
  c.drawn = a.slice(0, 8); c.shown = 0; c.t = 0; c.phase = "draw"; c.win = 0; c.msg = "HAULING..."; play("plop");
}
function nhTick(dt) {
  const c = CZ.nh; if (!c || c.phase !== "draw") return;
  c.t += dt;
  const n = Math.min(8, Math.floor(c.t / 0.22));
  while (c.shown < n) { const f = c.drawn[c.shown++]; play(c.picks.includes(f) ? "hit" : "tick"); }
  if (c.t > 8 * 0.22 + 0.3) {
    const m = c.drawn.filter(f => c.picks.includes(f)).length, x = NH_PAY[m];
    c.phase = "done"; c.win = Math.round(c.staked * x); if (c.win) addChips(c.win, "win");
    if (m === 5) tavAward("fullnet");
    c.msg = m + " MATCHED" + (x ? "! +" + fmtChips(c.win, 1e6) : ". AGAIN?"); play(m === 5 ? "fanfare" : x ? "chime" : "miss");
  }
}
function nhHits() {
  const L = czL(), h = [];
  NH_FISH.forEach((f, i) => h.push(L.w ? ["fish", L.X + 4 + (i % 5) * 44, 22 + Math.floor(i / 5) * 30, 42, 28, i] : ["fish", L.X + 4 + (i % 5) * 23, 26 + Math.floor(i / 5) * 21, 21, 19, i]));
  if (L.w) { const px = L.X + 236; stakeCtl(h, "stake", px, 30, 112); h.push(["quick", px, 52, 112, 18, 0]); h.push(["cast", px, 74, 112, 26, 0]); }
  else { stakeCtl(h, "stake", L.X + 4, 128, 112); h.push(["quick", L.X + 4, 148, 44, 18, 0]); h.push(["cast", L.X + 52, 148, 64, 18, 0]); }
  return h;
}
function drawNh() {
  const c = CZ.nh, L = czL(), X = L.X;
  rect("#0e2a2a", 0, 0, LW, LH);
  czTitle(L, "NET HAUL", LIME);
  const caught = new Set(c.drawn.slice(0, c.phase === "draw" ? c.shown : c.drawn.length));
  for (const [id, x, y, w, h, v] of nhHits()) {
    if (id === "fish") {
      const pk = c.picks.includes(v), cg = caught.has(v), hit = pk && cg;
      rect(hit ? "#3c6a1e" : cg ? "#1e4a5a" : pk ? "#2a3c1e" : "#142828", x, y, w, h); outline(x, y, w, h, hit ? GOLD : pk ? LIME : cg ? CYAN : "#2a4a4a");
      fitDraw(atlas, NH_FISH[v], x + w / 2, y + h / 2, w - 6, h - 6, 2);
      if (cg) for (let k = 2; k < w - 1; k += 4) rect(hit ? GOLD : "#a0e6f0", x + k, y + 1, 1, h - 2);   // caught in the net
    } else if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, L.w ? "STAKE" : "BET");
    else if (id === "quick") btn(x, y, w, h, L.w ? "QUICK PICK" : "QUICK", c.phase === "draw" ? GREY : CYAN);
    else if (id === "cast") btn(x, y, w, h, L.w ? "CAST THE NET" : "CAST", c.phase !== "draw" && c.picks.length === 5 && tav().chips >= c.bet ? GOLD : GREY);
  }
  const m = c.drawn.slice(0, c.phase === "draw" ? c.shown : 8).filter(f => c.picks.includes(f)).length;
  if (L.w) {
    text(c.msg.slice(0, 18), X + 292, 112, 1, c.phase === "done" && c.win ? GOLD : WHITE, "center", null);
    if (c.drawn.length) text("MATCHED " + m + " OF 5", X + 292, 124, 1, LIME, "center", null);
    [["3 MATCH", "X2"], ["4 MATCH", "X6"], ["5 MATCH", "X40"]].forEach(([a, b0], i) => { text(a, X + 244, 142 + i * 10, 1, "#a0c8b4", "left", null); text(b0, X + 344, 142 + i * 10, 1, CHIP, "right", null); });
    text("NET BRINGS UP 8 OF 20. ABOUT 95% BACK", X + 112, 180, 1, "#3c6a6a", "center", null);
  } else {
    text(c.msg.slice(0, 19), X + 60, 118, 1, c.phase === "done" && c.win ? GOLD : WHITE, "center", null);
    text("3 X2  4 X6  5 X40", X + 60, 176, 1, "#a0c8b4", "center", null);
  }
  text(c.phase === "draw" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function nhTap(rx, ly) {
  const c = CZ.nh, h = hitAt(nhHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "draw") closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "fish") nhToggle(v);
  else if (c.phase === "draw") return;
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "quick") nhQuick();
  else if (id === "cast") nhCast();
}
function nhKey(code, dir) {
  const c = CZ.nh; if (c.phase === "draw") return;
  if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "KeyQ" || code === "ArrowUp" || code === "KeyW") nhQuick();
  else if (code === "Space" || code === "Enter") nhCast();
}
EXTRA_OV.net = { draw: drawNh, tap: nhTap, key: nhKey, back: () => CZ.nh && CZ.nh.phase === "draw" ? "net" : "machines", music: true };

// ===================================================================== Part 5
// ---- DECORATE THE BAR: your own Rusty Hook. Five spots (lamp, sign, fish tank, barrel, counter), three things each,
// 2,000-40,000 chips. Drawn in the bar on both widths (decorDraw is called from drawTavern / drawTavernWide). Looks only.
// Save: tav.decor { own: ["slot.i"...], eq: { slot: i } }.
const DECOR = {
  lamp: [["OIL LAMP", 2000], ["SHIP'S LANTERN", 6000], ["CHANDELIER", 25000]],
  sign: [["OPEN SIGN", 3000], ["NEON FISH", 8000], ["GOLD STAR", 20000]],
  tank: [["GOLDFISH BOWL", 4000], ["REEF TANK", 12000], ["SHARK TANK", 35000]],
  keg: [["WATER BARREL", 2000], ["GOLD KEG", 15000], ["TREASURE CHEST", 40000], ["TOURNEY CUP", 0]],   // the cup is won (weekly tournament), never sold
  counter: [["MAHOGANY BAR", 5000], ["MARBLE BAR", 18000], ["GOLDEN BAR", 30000]],
};
const DECOR_SLOTS = Object.keys(DECOR), DECOR_ALL = DECOR_SLOTS.flatMap(sl => DECOR[sl].map((it, i) => [sl, i, it[0], it[1]]));
const decorList = () => DECOR_ALL.filter(it => it[3] > 0 || decorOwn(it[0], it[1]));   // won things (price 0) show once you have them
const DECOR_NAME = { lamp: "LAMP", sign: "SIGN", tank: "FISH TANK", keg: "BARREL", counter: "THE BAR TOP" };
function decorData() { const q = tav(); if (!q.decor || typeof q.decor !== "object") q.decor = { own: [], eq: {} }; if (!Array.isArray(q.decor.own)) q.decor.own = []; if (!q.decor.eq) q.decor.eq = {}; return q.decor; }
const decorOwn = (sl, i) => decorData().own.includes(sl + "." + i);
const decorOn = (sl, i) => decorData().eq[sl] === i;
const flick = k => 0.75 + 0.25 * Math.sin(T * 9 + k) * Math.sin(T * 3.7 + k * 2);
// each draw takes the spot's anchor (x, y) in the bar picture
const DECOR_DRAW = {
  lamp: [
    (x, y) => { rect("#5a5a64", x + 3, y, 1, 4); rect("#c8a05a", x, y + 4, 7, 2); g.globalAlpha = flick(1); rect("#ffd27a", x + 2, y + 6, 3, 4); g.globalAlpha = 1; rect("#8a6a3a", x + 1, y + 10, 5, 1); },
    (x, y) => { rect("#5a5a64", x + 4, y, 1, 3); rect("#2a2a30", x + 1, y + 3, 7, 1); rect("#2a2a30", x + 1, y + 11, 7, 1); g.globalAlpha = flick(2); rect("#ffb43c", x + 2, y + 4, 5, 7); g.globalAlpha = 1; rect("#2a2a30", x + 1, y + 4, 1, 7); rect("#2a2a30", x + 7, y + 4, 1, 7); },
    (x, y) => { rect("#c8a05a", x + 6, y, 1, 3); rect(GOLD, x, y + 3, 13, 2); for (let k = 0; k < 4; k++) { rect(GOLD, x + k * 4, y + 5, 1, 3); g.globalAlpha = flick(k); rect("#fff6c8", x + k * 4 - 1, y + 8, 3, 3); g.globalAlpha = 1; } },
  ],
  sign: [
    (x, y) => { rect("#1e1420", x, y, 24, 10); g.globalAlpha = flick(3); text("OPEN", x + 12, y + 5, 1, "#ff6ec8", "center", null); g.globalAlpha = 1; },
    (x, y) => { rect("#14141e", x, y, 24, 10); g.globalAlpha = flick(4); const c = "#5ae6ff"; rect(c, x + 5, y + 3, 10, 1); rect(c, x + 5, y + 6, 10, 1); rect(c, x + 4, y + 4, 1, 2); rect(c, x + 15, y + 4, 2, 2); rect(c, x + 17, y + 3, 1, 1); rect(c, x + 17, y + 6, 1, 1); rect(c, x + 18, y + 2, 1, 2); rect(c, x + 18, y + 6, 1, 2); rect(c, x + 7, y + 4, 1, 1); g.globalAlpha = 1; },
    (x, y) => { rect("#1e1a10", x, y, 24, 10); g.globalAlpha = flick(5); poly(GOLD, [[x + 12, y + 1], [x + 14, y + 4], [x + 18, y + 4], [x + 15, y + 6], [x + 16, y + 9], [x + 12, y + 7], [x + 8, y + 9], [x + 9, y + 6], [x + 6, y + 4], [x + 10, y + 4]]); g.globalAlpha = 1; },
  ],
  tank: [
    (x, y) => { disc("#a0e6ff", x + 7, y + 5, 5); rect("#a0e6ff", x + 3, y + 1, 9, 1); rect(ORANGE, x + 5 + Math.round(Math.sin(T * 2) * 2), y + 5, 3, 2); },
    (x, y) => { rect("#2a8ac8", x, y, 18, 9); outline(x, y, 18, 9, "#c8c8d2"); rect("#e6c88c", x + 1, y + 7, 16, 1); rect("#ff6e8c", x + 3, y + 5, 1, 2); rect("#ff6e8c", x + 13, y + 4, 2, 3); fitDraw(atlas, "clown", x + 9 + Math.sin(T * 1.5) * 4, y + 4, 6, 4, 1); },
    (x, y) => { rect("#1e5a8c", x, y, 22, 10); outline(x, y, 22, 10, "#c8c8d2"); rect("#c8b48c", x + 1, y + 8, 20, 1); g.save(); if (Math.cos(T * 0.8) < 0) { g.translate(x * 2 + 22, 0); g.scale(-1, 1); } fitDraw(atlas, "blacktip", x + 11 + Math.sin(T * 0.8) * 4, y + 4, 12, 6, 1); g.restore(); },
  ],
  keg: [
    (x, y) => { rect("#7a5232", x, y, 10, 11); rect("#5a3a22", x, y + 2, 10, 1); rect("#5a3a22", x, y + 8, 10, 1); rect("#4a2e1c", x + 4, y + 5, 2, 2); },
    (x, y) => { rect("#c8962a", x, y, 10, 11); rect(GOLD, x, y + 2, 10, 1); rect(GOLD, x, y + 8, 10, 1); rect("#fff6c8", x + 2, y + 3, 1, 4); rect("#8a6a3a", x + 4, y + 5, 2, 2); },
    (x, y) => { rect("#6a4428", x, y + 3, 14, 8); rect("#8a5c38", x, y, 14, 4); rect(GOLD, x, y + 3, 14, 1); rect(GOLD, x + 6, y + 3, 2, 3); for (let k = 0; k < 3; k++) { g.globalAlpha = flick(k + 7); rect("#fff6c8", x + 2 + k * 5, y - 1, 1, 1); g.globalAlpha = 1; } },
    (x, y) => { rect(GOLD, x + 2, y, 8, 5); rect(GOLD, x, y + 1, 2, 3); rect(GOLD, x + 10, y + 1, 2, 3); rect("#c8962a", x + 5, y + 5, 2, 3); rect("#c8962a", x + 3, y + 8, 6, 3); rect("#fff6c8", x + 3, y + 1, 1, 3); },
  ],
};
const DECOR_BAR = [["#4a2414", "#7a3a22"], ["#b4b4be", "#e6e6f0"], ["#c8962a", "#ffd246"]];   // the counter: bar, top edge
// anchors: narrow bar (the 120 column) and the wide bar (relative to WX())
const DECOR_AT = { n: { lamp: [12, 10], sign: [94, 17], tank: [2, 50], keg: [106, 49] }, w: { lamp: [20, 4], sign: [140, 12], tank: [6, 61], keg: [152, 60] } };
function decorBar(wide) { const i = decorData().eq.counter; return typeof i === "number" && DECOR_BAR[i] ? DECOR_BAR[i] : null; }   // game.js asks this for the counter colours
function decorDraw(wide, x0, eq) {                             // draw the bar's decor; x0 = left edge of the bar picture
  eq = eq || decorData().eq;
  const A = DECOR_AT[wide ? "w" : "n"];
  for (const sl of ["lamp", "sign", "tank", "keg"]) { const i = eq[sl]; if (typeof i === "number" && DECOR_DRAW[sl][i]) DECOR_DRAW[sl][i](x0 + A[sl][0], A[sl][1]); }
  if (roundsToday().length || tav().round === dayString()) { const by = wide ? 66 : 54; for (const mx of wide ? [x0 + 60, x0 + 104] : [x0 + 32, x0 + 82]) { rect("#ffd246", mx, by, 4, 5); rect("#fffaf0", mx, by - 1, 4, 2); rect("#c8962a", mx + 4, by + 1, 1, 3); } }
}
CZ.dc = { sel: 0, say: "" };
function decorHits() {
  const L = czL(), per = L.w ? 15 : 6, page = Math.floor(CZ.dc.sel / per), h = [];
  decorList().slice(page * per, page * per + per).forEach((it, k) => h.push(L.w ? ["row", L.X, 22 + k * 11, 220, 10, page * per + k] : ["row", L.X + 4, 27 + k * 13, 112, 11, page * per + k]));
  if (L.w) h.push(["act", L.X + 228, 150, 120, 18, 0]);
  else { h.push(["page", L.X + 2, 2, 16, 13, -1]); h.push(["page", L.X + 102, 2, 16, 13, 1]); h.push(["act", L.X + 14, 163, 92, 14, 0]); }
  return h;
}
function decorPreview(x, y, it, h, crop) {                     // a little bar with the picked thing in it
  h = h || 64; crop = crop || 2;
  const eq = Object.assign({}, decorData().eq, { [it[0]]: it[1] });
  g.save(); g.beginPath(); g.rect(x, y, 120, h); g.clip(); g.translate(x, y - crop);
  for (let k = 0; k < 120; k += 8) rect(k % 16 ? "#2a1a12" : "#321f15", k, 0, 8, 70);
  rect("#4a2e1c", 32, 28, 56, 3); spr("oldman", 46, 30, false, 2);
  const bar = it[0] === "counter" ? DECOR_BAR[it[1]] : (typeof eq.counter === "number" ? DECOR_BAR[eq.counter] : null);
  rect(bar ? bar[0] : "#6a4428", 0, 60, 120, 9); rect(bar ? bar[1] : "#8a5c38", 0, 60, 120, 2);
  decorDraw(false, 0, eq); g.restore(); outline(x, y, 120, h, GOLD);
}
function drawDecor() {
  const L = czL(), X = L.X, it = decorList()[CZ.dc.sel], own = decorOwn(it[0], it[1]), on = decorOn(it[0], it[1]);
  const act = own ? (on ? "TAKE DOWN" : "PUT UP") : (tav().chips >= it[3] ? "BUY " : "NEEDS ") + it[3], col = own || tav().chips >= it[3] ? CHIP : GREY;
  tavernBg();
  czTitle(L, L.w ? "DECORATE THE BAR" : "DECORATE");
  for (const [id, x, y, w, h, v] of decorHits()) {
    if (id === "row") { const r = decorList()[v], sel = v === CZ.dc.sel, ow = decorOwn(r[0], r[1]); rect(sel ? "#5a3a22" : "#24160e", x, y, w, h); if (sel) outline(x, y, w, h, GOLD);
      text(L.w ? DECOR_NAME[r[0]] + ": " + r[2] : r[2].slice(0, 14), x + 3, y + 5, 1, sel ? WHITE : "#d8c8b0", "left", null);
      text(ow ? (decorOn(r[0], r[1]) ? "UP" : "*") : L.w ? r[3] : Math.floor(r[3] / 1000) + "K", x + w - 3, y + 5, 1, ow ? LIME : CHIP, "right", null); }
    else if (id === "page") { box(x, y, w, h, GOLD); text(v < 0 ? "<" : ">", x + 8, y + 6, 1, GOLD, "center", null); }
    else if (id === "act") { if (L.w) btn(x, y, w, h, act, col); else { box(x, y, w, h, col); text(act, x + w / 2, y + 7, 1, col, "center", null); } }
  }
  if (L.w) { decorPreview(X + 228, 22, it); text(it[2], X + 288, 98, 1, WHITE, "center", null); text(DECOR_NAME[it[0]], X + 288, 110, 1, GOLD, "center", null); text("ONE OF EACH ON SHOW", X + 288, 126, 1, "#a08c70", "center", null); text(CZ.dc.say, X + 288, 178, 1, "#a08c70", "center", null); }
  else { decorPreview(X, 106, it, 54, 8); text(CZ.dc.say || DECOR_NAME[it[0]], X + 60, 185, 1, "#a08c70", "center", null); }
  text("TAP HERE TO GO BACK", LW / 2, 194, 1, WHITE, "center", null);
}
function decorAct() {
  const it = decorList()[CZ.dc.sel], d = decorData(), key = it[0] + "." + it[1];
  if (d.own.includes(key)) { d.eq[it[0]] = d.eq[it[0]] === it[1] ? -1 : it[1]; saveStore(); play("select"); CZ.dc.say = d.eq[it[0]] === it[1] ? "LOOKS GOOD UP THERE" : "BACK IN THE CELLAR"; return; }
  if (tav().chips < it[3]) { play("miss"); CZ.dc.say = "COME BACK WITH CHIPS"; return; }
  addChips(-it[3]); chipsSpent(it[3]); d.own.push(key); d.eq[it[0]] = it[1]; saveStore(); play("fanfare"); CZ.dc.say = "THE OLD MAN APPROVES";
}
function decorTap(rx, ly) {
  const h = hitAt(decorHits(), rx, ly), per = czL().w ? 15 : 6, pages = Math.ceil(decorList().length / per);
  if (!h) { if (ly > 186) closeOverlay(); return; }
  if (h[0] === "row") { if (h[5] === CZ.dc.sel) decorAct(); else { CZ.dc.sel = h[5]; CZ.dc.say = ""; play("tick"); } }
  else if (h[0] === "page") { CZ.dc.sel = ((Math.floor(CZ.dc.sel / per) + h[5] + pages) % pages) * per; play("tick"); }
  else decorAct();
}
function decorKey(code, dir) {
  const n = decorList().length;
  if (code === "ArrowUp" || code === "KeyW" || dir < 0) CZ.dc.sel = (CZ.dc.sel - 1 + n) % n;
  else if (code === "ArrowDown" || code === "KeyS" || dir > 0) CZ.dc.sel = (CZ.dc.sel + 1) % n;
  else if (code === "Space" || code === "Enter") { decorAct(); return; }
  else return;
  CZ.dc.say = ""; play("tick");
}
EXTRA_OV.decor = { draw: drawDecor, tap: decorTap, key: decorKey, back: "chipshop", music: true };

// ---- BUY A ROUND: 1,000 chips, once a day. Your initials go up for everyone at the bar that day (shared path
// /casino/rounds/<day>, write-once entries {n, t}; needs the rules in database.rules.json). Title ON THE HOUSE: 10 rounds.
const ROUND_PRICE = 1000;
CZ.rounds = { day: "", names: [], at: 0 };
function roundsToday() {                                     // initials who bought a round today (loads now and then)
  const R = CZ.rounds, d = dayString(), now = Date.now();
  if (R.day !== d) { R.day = d; R.names = tav().round === d && store.name ? [store.name] : []; R.at = 0; }
  if (LB.url && now - R.at > 60000) {
    R.at = now;
    fetch(LB.url + "/casino/rounds/" + d + ".json").then(r => r.ok ? r.json() : null).then(v => { if (v && R.day === d) { const n = [...new Set(Object.values(v).filter(e => e && e.n).map(e => e.n))]; if (tav().round === d && store.name && !n.includes(store.name)) n.push(store.name); R.names = n; } }).catch(() => {});
  }
  return R.names;
}
function buyRound() {
  const q = tav(), d = dayString();
  if (q.round === d) { play("miss"); TAV.say = "YOU ALREADY GOT TODAY'S"; return; }
  if (q.chips < ROUND_PRICE) { play("miss"); TAV.say = "COME BACK WITH CHIPS"; return; }
  addChips(-ROUND_PRICE); chipsSpent(ROUND_PRICE); q.round = d; q.rounds = (q.rounds || 0) + 1; saveStore();
  if (q.rounds >= 10) tavAward("onthehouse");
  const R = CZ.rounds; roundsToday(); if (store.name && !R.names.includes(store.name)) R.names.push(store.name);
  if (LB.url && store.name) fetch(LB.url + "/casino/rounds/" + d + ".json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: store.name, t: Date.now() }) }).catch(() => {});
  TAV.show = 2.5; play("fanfare"); TAV.say = "A ROUND ON " + (store.name || "YOU") + "! CHEERS!"; S.overlay = "tavern";
}
let czLastOv = null;
function roundsAnnounce() {                                  // walking into the bar: say who's bought a round today
  if (S.overlay === "tavern" && czLastOv !== "tavern" && !["chipshop", "decor"].includes(czLastOv)) {
    const n = roundsToday().filter(x => x !== store.name);
    if (n.length) TAV.say = n.slice(0, 3).join(", ") + (n.length > 3 ? " AND MORE" : "") + " BOUGHT A ROUND TODAY. CHEERS!";
  }
  czLastOv = S.overlay;
}

// ===================================================================== Part 6
// ---- THE SHARED PROGRESSIVE JACKPOT on the Reel Deal. The pot grows on the clock for everyone: 5,000 + 250 an hour
// since anyone last hit it, capped at 50,000 (so no write per spin). Any spin can hit it, with chance (stake / 75) /
// 20,000; at the cap that adds 3.3% to the reels' 94%, so it never pays back more than ~97%. The winner writes a
// write-once record to /casino/jackpot {n, s, t} and everyone's pot starts again from that time. Without the shared
// database the pot is your own. Title MEGA JACKPOT.
const JP_BASE = 5000, JP_RATE = 250 / 3600000, JP_CAP = 50000, JP_ODDS = 20000;
CZ.jp = { last: 0, at: 0, who: "" };
function jpLast() {                                         // when the pot was last hit (shared, else your own)
  const q = tav(); if (!q.jpLast) { q.jpLast = Date.now(); saveStore(); }
  const now = Date.now();
  if (LB.url && now - CZ.jp.at > 60000) {
    CZ.jp.at = now;
    fetch(LB.url + '/casino/jackpot.json?orderBy="t"&limitToLast=1').then(r => r.ok ? r.json() : null).then(v => { const e = v && Object.values(v).filter(x => x && x.t)[0]; if (e) { CZ.jp.last = e.t; CZ.jp.who = e.n || ""; } }).catch(() => {});
  }
  return Math.max(CZ.jp.last || 0, q.jpWon || 0) || q.jpLast;
}
const jpPot = () => Math.min(JP_CAP, JP_BASE + Math.floor(Math.max(0, Date.now() - jpLast()) * JP_RATE));
function jpWin(c) {
  const pot = jpPot(), now = Date.now();
  addChips(pot, "win"); c.win += pot; c.jp = true;
  tav().jpWon = now; CZ.jp.last = now; CZ.jp.who = store.name || ""; saveStore();
  tavAward("megajack");
  if (LB.url && store.name) fetch(LB.url + "/casino/jackpot.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: store.name, s: pot, t: now }) }).catch(() => {});
  c.msg = "JACKPOT!!! +" + pot; TAV.show = 3; play("fanfare");
}

// ---- THE WEEKLY TOURNAMENT: Catch 21 for a trophy. Buy in for 1,000 chips, play 25 hands with a 1,000-point stack
// (bets 10-200 points, house rules: ties go to you, a natural pays 3 to 2, a legend wins at once). Everyone plays the same
// cards: hand h of week w is dealt from its own deck seeded by (w, h), so the best play wins, not the luckiest deal. One
// entry a week; your final stack goes to /casino/cup/<week>. When the week is over, the top 3 claim a prize on their next
// visit: TABLE CHAMP (1st) and PODIUM (top 3) titles, and the TOURNEY CUP for the bar (1st). Prizes are looks only.
const CUP_BUYIN = 1000, CUP_HANDS = 25, CUP_STACK = 1000, CUP_BETS = [10, 25, 50, 100, 200];
function cupData() {
  const q = tav(), wk = dealerWeek();
  if (!q.cup || q.cup.wk !== wk) q.cup = { wk, in: false, hand: 0, stack: CUP_STACK, bet: 50, cur: null, done: false };
  return q.cup;
}
function cupDeck(wk, h) { const r = RNG(hashStr("tourney " + wk + " " + h)), d = [];
  for (let i = 0; i < 24; i++) { const x = r.random(); if (x < 0.03) d.push([C21_LEG[Math.floor(r.random() * C21_LEG.length)], 0, "l"]); else d.push([C21_POOL[Math.floor(r.random() * C21_POOL.length)], 1 + Math.floor(r.random() * 11), r.random() < 0.08 ? "t" : ""]); }
  return d; }
const cupTake = (c, h) => { const card = cupDeck(c.wk, c.hand)[h.n++]; return card; };
function cupEnter() {
  const c = cupData();
  if (c.in) return;
  if (tav().chips < CUP_BUYIN) { play("miss"); CZ.cupMsg = "BUY-IN IS " + CUP_BUYIN + " CHIPS"; return; }
  addChips(-CUP_BUYIN); chipsSpent(CUP_BUYIN); c.in = true; saveStore(); CZ.cupMsg = "GOOD LUCK"; play("chime");
}
function cupDeal() {
  const c = cupData(); if (!c.in || c.done || c.cur) return;
  const bet = Math.min(c.bet, c.stack); c.stack -= bet;
  const h = { n: 0, bet, you: [], dealer: [], phase: "play", msg: "" }; c.cur = h;
  h.you = [cupTake(c, h), cupTake(c, h)]; h.dealer = [cupTake(c, h), cupTake(c, h)];
  const nat = x => x.length === 2 && c21Sum(x) === 21;
  if (h.you.some(q => q[2] === "l")) return cupEnd(2, "A LEGEND! YOU WIN");
  if (h.dealer.some(q => q[2] === "l")) return cupEnd(0, "HIS LEGEND WINS");
  if (nat(h.you)) return nat(h.dealer) ? cupEnd(1, "TWO 21S: A PUSH") : cupEnd(2.5, "CATCH 21! 3 TO 2");
  if (nat(h.dealer)) return cupEnd(0, "HE HAS 21");
  if (c21Sum(h.you) > 21) return cupEnd(0, "BUST ON THE DEAL");
  h.msg = "YOU HAVE " + c21Sum(h.you); saveStore(); play("tick");
}
function cupHit(dbl) {
  const c = cupData(), h = c.cur; if (!h || h.phase !== "play") return;
  if (dbl) { if (h.you.length !== 2 || c.stack < h.bet) { play("miss"); return; } c.stack -= h.bet; h.bet *= 2; }
  const q = cupTake(c, h); h.you.push(q); play("tick");
  if (q[2] === "l") return cupEnd(2, "A LEGEND! YOU WIN");
  const t = c21Sum(h.you);
  if (t > 21) return cupEnd(0, "BUST AT " + t);
  h.msg = "YOU HAVE " + t;
  if (dbl || t === 21) cupStand(); else saveStore();
}
function cupStand() { const h = cupData().cur; if (!h || h.phase !== "play") return; h.phase = "dealer"; h.t = 0; h.msg = "HIS TURN..."; }
function cupTick(dt) {
  const c = tav().cup, h = c && c.cur; if (!h || h.phase !== "dealer" || (h.t += dt) < 0.4) return;
  h.t = 0;
  const d = c21Sum(h.dealer), y = c21Sum(h.you);
  if (d < 17) { const q = cupTake(c, h); h.dealer.push(q); play("tick"); if (q[2] === "l") cupEnd(0, "HIS LEGEND WINS"); return; }
  if (d > 21) cupEnd(2, "HE BUSTS! YOU WIN"); else if (y >= d) cupEnd(2, y === d ? "A TIE GOES TO YOU" : "YOU WIN, " + y + " TO " + d); else cupEnd(0, "HE WINS, " + d + " TO " + y);
}
function cupEnd(mult, msg) {
  const c = cupData(), h = c.cur; h.phase = "over"; h.msg = msg; c.stack += Math.floor(h.bet * mult); c.hand++;
  play(mult > 1 ? "chime" : mult ? "tick" : "miss");
  if (c.hand >= CUP_HANDS || c.stack < CUP_BETS[0]) cupFinish();
  saveStore();
}
function cupNext() { const c = cupData(); if (c.cur && c.cur.phase === "over" && !c.done) { c.cur = null; c.bet = Math.min(c.bet, c.stack); saveStore(); } }
function cupFinish() {
  const c = cupData(); c.done = true;
  if (LB.url && store.name && c.stack > 0) fetch(LB.url + "/casino/cup/" + c.wk + ".json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: store.name, s: c.stack, t: Date.now() }) }).catch(() => {});
  CZ.cupB = {};                                              // reload the board
}
CZ.cupB = {}; CZ.cupMsg = "";
function cupBoard(wk) {                                      // -> {rows, msg} for that week (best score per name), loads in the background
  const B = CZ.cupB[wk] || (CZ.cupB[wk] = { rows: null, msg: LB.url ? "LOADING..." : "NO SHARED BOARD", at: 0 });   // messages fit 18 characters
  if (LB.url && Date.now() - B.at > 60000) {
    B.at = Date.now();
    fetch(LB.url + "/casino/cup/" + wk + '.json?orderBy="s"&limitToLast=20').then(r => { if (!r.ok) { B.msg = "NEW RULES NEEDED"; return null; } return r.json(); }).then(v => {
      if (v === null && B.msg !== "LOADING...") return;
      const best = {}; Object.values(v || {}).forEach(e => { if (e && e.n && e.s > (best[e.n] || 0)) best[e.n] = e.s; });
      B.rows = Object.entries(best).sort((a, b) => b[1] - a[1]).slice(0, 10); B.msg = "";
    }).catch(() => { B.msg = "BOARD IS OFFLINE"; });
  }
  return B;
}
function cupClaim() {                                         // last week's top 3 collect their prizes
  const q = tav(), last = dealerWeek() - 1;
  if (!store.name || (q.cupClaim || 0) >= last) return;
  const B = cupBoard(last); if (!B.rows) return;
  q.cupClaim = last;
  const rank = B.rows.findIndex(r => r[0] === store.name);
  if (rank === 0) { tavAward("tablechamp"); const d = decorData(); if (!d.own.includes("keg.3")) d.own.push("keg.3"); d.eq.keg = 3; CZ.cupMsg = "YOU WON LAST WEEK! A CUP FOR THE BAR"; }
  if (rank >= 0 && rank <= 2) { tavAward("podium"); if (rank) CZ.cupMsg = "#" + (rank + 1) + " LAST WEEK. WELL PLAYED"; }
  saveStore();
}
function cupHits() {
  const L = czL(), c = cupData(), h = [], px = L.w ? L.X + 236 : L.X + 4, pw = L.w ? 112 : 112;
  if (!c.in) h.push(["enter", L.w ? px : L.X + 14, L.w ? 120 : 150, L.w ? pw : 92, L.w ? 26 : 18, 0]);
  else if (c.done) {}
  else if (!c.cur) { stakeCtl(h, "bet", L.w ? px : L.X + 4, L.w ? 120 : 128, 112); h.push(["deal", L.w ? px : L.X + 14, L.w ? 142 : 148, L.w ? pw : 92, L.w ? 24 : 18, 0]); }
  else if (c.cur.phase === "play") { const y = L.w ? 120 : 140; [["hit", "HIT"], ["stand", "STAND"], ["double", L.w ? "DOUBLE" : "DBL"]].forEach(([id], i) => h.push([id, (L.w ? px : L.X + 2) + i * (L.w ? 38 : 39), y, L.w ? 36 : 37, 20, 0])); }
  else if (c.cur.phase === "over") h.push(["next", L.w ? px : L.X + 14, L.w ? 120 : 148, L.w ? pw : 92, L.w ? 24 : 18, 0]);
  return h;
}
function drawCup() {
  const L = czL(), X = L.X, c = cupData(), wk = c.wk, B = cupBoard(wk), cur = c.cur;
  cupClaim();
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  czTitle(L, L.w ? "THE WEEKLY TOURNAMENT" : "TOURNAMENT");
  const days = dealerDaysLeft() + (dealerDaysLeft() === 1 ? " DAY" : " DAYS");
  const board = (x, y, n, w) => { text("THIS WEEK", x + w / 2, y, 1, GOLD, "center", null); if (!B.rows) { text(B.msg, x + w / 2, y + 14, 1, GREY, "center", null); return; } if (!B.rows.length) text("NO SCORES YET", x + w / 2, y + 14, 1, GREY, "center", null);
    B.rows.slice(0, n).forEach(([nm, sc], i) => { const me = nm === store.name; text((i + 1) + ". " + nm, x + 2, y + 12 + i * 10, 1, me ? GOLD : i < 3 ? WHITE : "#a0c8b4", "left", null); text(sc, x + w - 2, y + 12 + i * 10, 1, me ? GOLD : CHIP, "right", null); }); };
  if (!c.in) {                                                // the lobby
    if (L.w) { ["BUY IN: " + CUP_BUYIN, "25 HANDS", "1,000 POINTS", "SAME CARDS FOR ALL", "TOP 3: TITLES", "#1: A CUP FOR", "THE BAR", "ENDS IN " + days].forEach((l, i) => text(l, X + 292, 24 + i * 10, 1, i === 7 ? GOLD : "#c8e6d2", "center", null)); board(X, 24, 10, 220); }
    else { ["BUY IN: " + CUP_BUYIN, "25 HANDS, 1,000 PTS", "SAME CARDS FOR ALL", "ENDS IN " + days].forEach((l, i) => text(l, X + 60, 28 + i * 10, 1, i === 3 ? GOLD : "#c8e6d2", "center", null)); board(X + 4, 74, 5, 112); }
  } else {
    const tx = L.w ? X + 4 : X + 4, k = L.w ? 2 : 1;
    const hn = Math.min(c.hand + (cur && cur.phase !== "over" ? 1 : 0), CUP_HANDS) + "/" + CUP_HANDS;
    text(L.w ? "HAND " + hn + "   STACK " + c.stack : hn + "   STACK " + c.stack, L.w ? X + 112 : X + 60, L.w ? 22 : 30, 1, GOLD, "center", null);
    if (cur) {
      g.save(); g.translate(tx, L.w ? 30 : 38); g.scale(k, k);
      text("HIM " + (cur.phase === "play" ? "?" : c21Sum(cur.dealer)), 0, 3, 1, "#c8e6d2", "left", null);
      cur.dealer.slice(0, 6).forEach((q, i) => fishCard(i * Math.min(18, 92 / Math.max(1, cur.dealer.length - 1)), 8, q, cur.phase === "play" && i === 1));
      text("YOU " + c21Sum(cur.you), 0, 42, 1, "#c8e6d2", "left", null);
      cur.you.slice(0, 6).forEach((q, i) => fishCard(i * Math.min(18, 92 / Math.max(1, cur.you.length - 1)), 47, q));
      g.restore();
      text(cur.msg.slice(0, 19), L.w ? X + 292 : X + 60, L.w ? 108 : 124, 1, cur.phase === "over" ? GOLD : WHITE, "center", null);
    } else if (c.done) { text("FINISHED WITH " + c.stack, L.w ? X + 112 : X + 60, L.w ? 60 : 50, 1, GOLD, "center", null); text(store.name ? "POSTED TO THE BOARD" : "SET YOUR INITIALS TO POST", L.w ? X + 112 : X + 60, L.w ? 74 : 62, 1, "#c8e6d2", "center", null); if (!L.w) board(X + 4, 74, 5, 112); }
    else text("PICK A BET AND DEAL", L.w ? X + 112 : X + 60, L.w ? 60 : 60, 1, WHITE, "center", null);
    if (L.w) board(X + 236, 24, 7, 112);
  }
  for (const [id, x, y, w, h, v] of cupHits()) {
    if (id === "enter") btn(x, y, w, h, "BUY IN " + CUP_BUYIN, tav().chips >= CUP_BUYIN ? GOLD : GREY);
    else if (id === "bet" && v < 0) drawStakeCtl(x, y, 112, Math.min(c.bet, c.stack), CHIP, "BET");
    else if (id === "deal") btn(x, y, w, h, "DEAL HAND", GOLD);
    else if (id === "next") btn(x, y, w, h, c.done ? "DONE" : "NEXT HAND", GOLD);
    else if (["hit", "stand", "double"].includes(id)) btn(x, y, w, h, id === "double" ? "DBL" : id.toUpperCase(), id === "double" && (cur.you.length !== 2 || c.stack < cur.bet) ? GREY : CHIP);
  }
  if (CZ.cupMsg && !c.cur) text(CZ.cupMsg.slice(0, L.w ? 36 : 19), L.w ? X + 174 : X + 60, 184, 1, "#a0c8b4", "center", null);
  text(cur && cur.phase === "dealer" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function cupTap(rx, ly) {
  const c = cupData(), h = hitAt(cupHits(), rx, ly);
  if (!h) { if (ly > 186) closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "enter") cupEnter();
  else if (id === "bet") { const i = CUP_BETS.indexOf(c.bet); c.bet = CUP_BETS[clamp((i < 0 ? 2 : i) + v, 0, CUP_BETS.length - 1)]; play("tick"); }
  else if (id === "deal") cupDeal();
  else if (id === "hit") cupHit(false);
  else if (id === "stand") cupStand();
  else if (id === "double") cupHit(true);
  else if (id === "next") cupNext();
}
function cupKey(code, dir) {
  const c = cupData(), cur = c.cur;
  if (!c.in) { if (code === "Space" || code === "Enter") cupEnter(); return; }
  if (cur && cur.phase === "play") { if (code === "Space" || code === "KeyH") cupHit(false); else if (code === "Enter" || code === "KeyS" || code === "ArrowDown") cupStand(); else if (code === "KeyD" || code === "ArrowUp") cupHit(true); return; }
  if (cur && cur.phase === "over") { if (code === "Space" || code === "Enter") cupNext(); return; }
  if (!cur && !c.done) { if (dir) { const i = CUP_BETS.indexOf(c.bet); c.bet = CUP_BETS[clamp((i < 0 ? 2 : i) + dir, 0, CUP_BETS.length - 1)]; play("tick"); } else if (code === "Space" || code === "Enter") cupDeal(); }
}
EXTRA_OV.cup = { draw: drawCup, tap: cupTap, key: cupKey, back: "tables", music: true };


// ===================================================================== Part 8 (Nov 20, 2026): four new games
// COMPASS ROSE (roulette), LIAR'S DICE and THE SHELL GAME at the TABLES; DOUBLOON PUSHER at the MACHINES.
const czLeave = (c, busy, self, hub) => (c && busy ? self : hub);

// ---- COMPASS ROSE: roulette on a 32-point compass plus one gold KRAKEN pocket where every bet loses (the house's share).
// 33 pockets. Pays (stake included): one point x31 (31/33 = 93.9%), a cardinal (3 points) x10.4, a quarter (8) x3.9, a half
// (16 points) x1.95, a colour (16 points) x1.95: each 94.5%. Bets stay on the table between spins until you clear them.
const CR_PTS = ["N", "NBE", "NNE", "NEBN", "NE", "NEBE", "ENE", "EBN", "E", "EBS", "ESE", "SEBE", "SE", "SEBS", "SSE", "SBE",
  "S", "SBW", "SSW", "SWBS", "SW", "SWBW", "WSW", "WBS", "W", "WBN", "WNW", "NWBW", "NW", "NWBN", "NNW", "NBW"];
const CR_N = 33, CR_K = 32;
const CR_TYPES = [["point", "POINT", "ONE POINT", 31], ["card", "CARDINAL", "N/E/S/W AND SIDES", 10.4], ["quart", "QUARTER", "8 POINTS IN A ROW", 3.9],
  ["half", "HALF", "16 POINTS", 1.95], ["col", "COLOUR", "RED OR BLUE", 1.95]];
const CR_OPTS = { card: ["N", "E", "S", "W"], quart: ["NE", "SE", "SW", "NW"], half: ["NORTH", "EAST", "SOUTH", "WEST"], col: ["RED", "BLUE"] };
const CR_HELP = { point: "ONE POINT. OR TAP THE WHEEL", card: "N = NBW, N AND NBE", quart: "NE = N UP TO E, AND SO ON",
  half: "NORTH = W UP TO E, 16 POINTS", col: "16 RED, 16 BLUE POCKETS" };
function crCovers(t, o, p) {
  if (p === CR_K) return false;                             // the KRAKEN takes everything
  if (t === "point") return p === o;
  if (t === "card") return [0, 1, 31].includes((p - o * 8 + 32) % 32);   // the cardinal and the point either side
  if (t === "quart") return Math.floor(p / 8) === o;
  if (t === "half") return (p - o * 8 + 40) % 32 < 16;
  return p % 2 === o;                                       // colour: 0 red (even), 1 blue (odd)
}
const crMult = t => CR_TYPES.find(q => q[0] === t)[3];
const crName = (t, o) => t === "point" ? CR_PTS[o] : CR_OPTS[t][o];
const crCol = p => p === CR_K ? "#e6b432" : p % 2 ? "#1e3a78" : "#b43232";
CZ.cr = null;
function crOpen() { if (!CZ.cr) CZ.cr = { bet: 10, type: 0, opt: { point: 0, card: 0, quart: 0, half: 0, col: 0 }, bets: [], phase: "bet", ang: 0, a0: 0, a1: 0, b0: 0, b1: 0, ball: 0, t: 0, res: -1, last: [], msg: "PLACE YOUR BETS", win: 0 }; }
const crTotal = () => CZ.cr.bets.reduce((a, b) => a + b.a, 0);
function crPlace(t, o) {
  const c = CZ.cr; if (c.phase === "spin") return;
  if (c.bet < 1 || tav().chips < crTotal() + c.bet) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  const b = c.bets.find(q => q.t === t && q.o === o);
  if (b) b.a += c.bet; else c.bets.push({ t, o, a: c.bet });
  c.msg = crName(t, o) + ": " + fmtChips(c.bets.find(q => q.t === t && q.o === o).a, 1e6); play("tick");
}
function crSpin() {
  const c = CZ.cr; if (c.phase === "spin") return;
  const tot = crTotal();
  if (!tot) { c.msg = "PLACE A BET FIRST"; play("miss"); return; }
  if (tav().chips < tot) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-tot); c.staked = tot;
  c.res = Math.floor(Math.random() * CR_N);
  c.a0 = c.ang; c.a1 = c.ang + Math.PI * 2 * (1.5 + Math.random());                 // the wheel turns one way...
  c.b0 = c.ball; const end = c.a1 + (c.res + 0.5) / CR_N * Math.PI * 2;             // ...the pearl the other, and stops on the pocket
  c.b1 = c.b0 - (((c.b0 - end) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI * 2 * 5;
  c.t = 0; c.phase = "spin"; c.msg = ""; c.win = 0; play("tick");
}
function crTick(dt) {
  const c = CZ.cr; if (!c || c.phase !== "spin") return;
  c.t += dt; const u = Math.min(1, c.t / 4), e = 1 - Math.pow(1 - u, 3);
  c.ang = c.a0 + (c.a1 - c.a0) * e; c.ball = c.b0 + (c.b1 - c.b0) * e;
  if (Math.random() < 0.25 * (1 - u)) play("tick", 0.4);
  if (u < 1) return;
  c.phase = "done"; c.last.unshift(c.res); c.last.length = Math.min(c.last.length, 6);
  let win = 0, point = false;
  for (const b of c.bets) if (crCovers(b.t, b.o, c.res)) { win += Math.min(maxWin(b.a), Math.round(b.a * crMult(b.t))); if (b.t === "point") point = true; }
  c.win = win;
  if (win) addChips(win, win > c.staked ? "win" : "");
  if (point) tavAward("navigator");
  const nm = c.res === CR_K ? "THE KRAKEN" : CR_PTS[c.res];
  c.msg = nm + (win ? "! +" + fmtChips(win, 1e6) : c.res === CR_K ? " TAKES IT ALL" : ". NO LUCK");
  play(win > c.staked ? "fanfare" : win ? "chime" : "miss");
}
function crWheel(cx, cy, r, c) {
  for (let i = 0; i < CR_N; i++) {
    const a0 = c.ang + i / CR_N * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / CR_N, covered = c.bets.some(b => crCovers(b.t, b.o, i));
    poly(crCol(i), [[cx + Math.cos(a0) * r * 0.62, cy + Math.sin(a0) * r * 0.62], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r], [cx + Math.cos(a1) * r * 0.62, cy + Math.sin(a1) * r * 0.62]]);
    if (covered && r >= 50) { const am = (a0 + a1) / 2; disc(CHIP, cx + Math.cos(am) * (r + 5), cy + Math.sin(am) * (r + 5), 2); }   // a chip on it
  }
  g.strokeStyle = "#5a3a22"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
  disc("#0e2a3a", cx, cy, Math.floor(r * 0.6));
  for (let k = 0; k < 8; k++) {                              // the rose
    const a = k * Math.PI / 4 - Math.PI / 2, len = (k % 2 ? 0.34 : 0.55) * r, w = 0.09 * r;
    poly(k % 2 ? "#a0b4c8" : "#f2ead8", [[cx + Math.cos(a) * len, cy + Math.sin(a) * len], [cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w], [cx, cy], [cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w]]);
  }
  disc(GOLD, cx, cy, Math.max(2, Math.floor(r * 0.06)));
  ["N", "E", "S", "W"].forEach((t, k) => { const a = c.ang + (k * 8 + 0.5) / CR_N * Math.PI * 2 - Math.PI / 2; text(t, cx + Math.cos(a) * r * 0.81, cy + Math.sin(a) * r * 0.81, 1, WHITE, "center", INK); });
  if (r >= 50) { const a = c.ang + (CR_K + 0.5) / CR_N * Math.PI * 2 - Math.PI / 2; fitDraw(atlas, "kraken", cx + Math.cos(a) * r * 0.81, cy + Math.sin(a) * r * 0.81, 10, 10, 1); }
  const sp = c.phase === "spin" ? Math.min(1, c.t / 4) : 1, br = r * (0.97 - 0.07 * Math.max(0, (sp - 0.7) / 0.3));
  const ba = c.ball - Math.PI / 2;
  if (c.phase !== "bet" || c.last.length) disc(WHITE, cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, Math.max(2, Math.round(r * 0.05)));
}
function crHits() {
  const L = czL(), c = CZ.cr, h = [], t = CR_TYPES[c.type][0];
  if (L.w) {
    const px = L.X + 172;
    CR_TYPES.forEach((q, i) => h.push(["type", px, 20 + i * 20, 176, 18, i]));
    if (t === "point") h.push(["prev", px, 132, 28, 14, -1], ["next", px + 92, 132, 28, 14, 1], ["place", px + 124, 132, 52, 14, 0]);
    else CR_OPTS[t].forEach((o, i, a) => h.push(["opt", px + i * (176 / a.length), 132, 176 / a.length - 2, 14, i]));
    stakeCtl(h, "stake", px, 162, 100); h.push(["clear", px + 102, 162, 36, 15, 0], ["spin", px + 140, 162, 36, 15, 0]);
    h.push(["wheel", L.X + 14, 20, 136, 136, 0]);
  } else {
    const X = L.X;
    CR_TYPES.forEach((q, i) => h.push(["type", X + 4, 108 + i * 10, 112, 9, i]));
    if (t === "point") h.push(["prev", X + 4, 159, 20, 11, -1], ["next", X + 60, 159, 20, 11, 1], ["place", X + 82, 159, 34, 11, 0]);
    else CR_OPTS[t].forEach((o, i, a) => h.push(["opt", X + 4 + i * (112 / a.length), 159, 112 / a.length - 2, 11, i]));
    stakeCtl(h, "stake", X + 2, 172, 80); h.push(["spin", X + 84, 172, 34, 15, 0], ["clear", X + 84, 97, 34, 9, 0]);
  }
  return h;
}
function drawCr() {
  const c = CZ.cr, L = czL(), X = L.X, t = CR_TYPES[c.type][0];
  rect("#0a1a30", 0, 0, LW, LH);
  czTitle(L, "COMPASS ROSE", GOLD);
  if (L.w) crWheel(X + 82, 88, 64, c); else crWheel(X + 60, 60, 33, c);
  const tot = crTotal();
  for (const [id, x, y, w, h, v] of crHits()) {
    if (id === "type") {
      const q = CR_TYPES[v], sel = v === c.type;
      if (L.w) { box(x, y, w, h, sel ? GOLD : "#2a4a6a"); text(q[1], x + 6, y + 5, 1, sel ? WHITE : "#a0b8d8", "left", null); text(q[2], x + 6, y + 13, 1, "#6a86ae", "left", null); text("X" + q[3], x + w - 6, y + 9, 1, GOLD, "right", null); }
      else { rect(sel ? "#3a3010" : "#12223a", x, y, w, h); outline(x, y, w, h, sel ? GOLD : "#2a4a6a"); text(v === 1 ? "N E S W" : q[1], x + 4, y + 5, 1, sel ? WHITE : "#a0b8d8", "left", null); text("X" + q[3], x + w - 3, y + 5, 1, GOLD, "right", null); }
    } else if (id === "opt") {
      const nm = CR_OPTS[t][v], on = c.bets.some(b => b.t === t && b.o === v);
      box(x, y, w, h, on ? GOLD : "#2a4a6a"); text(nm, x + w / 2, y + h / 2, 1, on ? GOLD : "#a0b8d8", "center", null);
    } else if (id === "prev" || id === "next") { box(x, y, w, h, "#2a4a6a"); text(id === "prev" ? "<" : ">", x + w / 2, y + h / 2, 1, WHITE, "center", null); if (id === "prev") text(CR_PTS[c.opt.point], x + w + (L.w ? 32 : 18), y + h / 2, 1, c.opt.point % 2 ? "#7a9ae6" : "#ff8080", "center", null); }
    else if (id === "place") btn(x, y, w, h, "PLACE", CHIP);
    else if (id === "stake" && v < 0) drawStakeCtl(x, y, w === 16 ? (L.w ? 100 : 80) : w, c.bet, CHIP, "BET");
    else if (id === "clear") { if (L.w || tot) { box(x, y, w, h, "#8ca0c8"); text("CLEAR", x + w / 2, y + h / 2, 1, "#8ca0c8", "center", null); } }
    else if (id === "spin") btn(x, y, w, h, "SPIN", c.phase === "spin" ? GREY : tot && tav().chips >= tot ? GOLD : GREY);
  }
  if (L.w) {
    const px = X + 172, desc = c.bets.map(b => crName(b.t, b.o) + " " + fmtChips(b.a)).join(", ");
    text(CR_HELP[t].slice(0, 29), px + 88, 124, 1, "#6a86ae", "center", null);
    text(c.phase === "spin" ? "NO MORE BETS" : (c.msg || "").slice(0, 29), px + 88, 152, 1, c.phase === "done" && c.win > (c.staked || 0) ? GOLD : WHITE, "center", null);
    text(tot ? "ON THE TABLE: " + fmtChips(tot, 1e6) : "NOTHING ON THE TABLE YET", X + 82, 162, 1, CHIP, "center", null);
    if (tot) text(desc.slice(0, 27), X + 82, 172, 1, "#5ab48c", "center", null);
    text("LAST:", X, 183, 1, "#8ca0c8", "left", null);
    c.last.slice(0, 4).forEach((p, i) => text(p === CR_K ? "KRAKEN" : CR_PTS[p], X + 34 + i * 34, 183, 1, p === CR_K ? "#e6b432" : p % 2 ? "#7a9ae6" : "#ff8080", "left", null));
  } else if (c.phase === "done" || c.phase === "spin" || !tot) text(c.phase === "spin" ? "NO MORE BETS" : (c.msg || "").slice(0, c.phase === "done" && tot ? 13 : 19), X + (c.phase === "done" && tot ? 4 : 60), 101, 1, c.phase === "done" && c.win ? GOLD : WHITE, c.phase === "done" && tot ? "left" : "center", null);
  else text("BETS " + fmtChips(tot), X + 4, 101, 1, WHITE, "left", null);
  text(c.phase === "spin" ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function crTap(rx, ly) {
  const c = CZ.cr, L = czL(), h = hitAt(crHits(), rx, ly);
  if (!h) { if (ly > 186 && c.phase !== "spin") closeOverlay(); return; }
  if (c.phase === "spin") return;
  const [id, , , , , v] = h, t = CR_TYPES[c.type][0];
  if (id === "type") { c.type = v; play("tick"); }
  else if (id === "opt") crPlace(t, v);
  else if (id === "prev" || id === "next") { c.opt.point = (c.opt.point + v + 32) % 32; play("tick"); }
  else if (id === "place") crPlace("point", c.opt.point);
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "clear") { c.bets = []; c.msg = "TABLE CLEARED"; play("tick"); }
  else if (id === "spin") crSpin();
  else if (id === "wheel") {                                // tap a pocket on the big wheel: a bet on that point
    const dx = rx - (L.X + 82), dy = ly - 88, d = Math.hypot(dx, dy);
    if (d < 64 * 0.6 || d > 68) return;
    const a = ((Math.atan2(dy, dx) + Math.PI / 2 - c.ang) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2), p = Math.floor(a / (Math.PI * 2) * CR_N);
    if (p === CR_K) { c.msg = "NOBODY BETS ON THE KRAKEN"; play("miss"); return; }
    c.type = 0; c.opt.point = p; crPlace("point", p);
  }
}
function crKey(code, dir) {
  const c = CZ.cr; if (c.phase === "spin") return;
  if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "ArrowUp" || code === "KeyW") { c.type = (c.type + 4) % 5; play("tick"); }
  else if (code === "ArrowDown" || code === "KeyS") { c.type = (c.type + 1) % 5; play("tick"); }
  else if (code === "Space") crSpin();
  else if (code === "Enter") { const t = CR_TYPES[c.type][0]; crPlace(t, c.opt[t]); }
}
EXTRA_OV.compass = { draw: drawCr, tap: crTap, key: crKey, back: () => czLeave(CZ.cr, CZ.cr && CZ.cr.phase === "spin", "compass", "tables"), music: true };

// ---- LIAR'S DICE against the old fisherman. Five dice each, 1s wild. Bid how many dice in BOTH cups show a face (2-6);
// each bid must raise the last (more dice, or the same number of a higher face). Call LIAR on his bid and the cups come
// up: if there are fewer than he said, he loses a die; otherwise you do. The loser starts the next round. Last one with
// dice wins: a win pays x1.85 (stake included). He plays the odds with a little bluff (`ldAI`). Against him the strongest
// bot strategy found (call only when a bid is under ~12% likely, never bluff) wins ~51%: about 94% back; a bot that plays
// exactly like him wins ~49%. tools/tests/test_casino7.py re-checks it.
const LD_PAY = 1.85, LD_NUM = ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const LD_TUNE = { call: 0.18, bluff: 0.03, noise: 0.08 };   // tuned by bot sweeps: at call 0.42 a cautious caller won 56%; now the best strategy found wins ~51%
const ldRoll = n => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
const ldCount = (d, f) => d.filter(x => x === f || x === 1).length;
function ldAtLeast(n, k) {                                  // P(at least k of n unknown dice show the face or a 1), p = 1/3
  if (k <= 0) return 1; if (k > n) return 0;
  let s = 0, c = 1;
  for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i >= k) s += c * Math.pow(1 / 3, i) * Math.pow(2 / 3, n - i); }
  return s;
}
const ldBidOK = (bid, q, f) => f >= 2 && f <= 6 && q >= 1 && (!bid || q > bid[0] || (q === bid[0] && f > bid[1]));
function ldAI(mine, otherN, bid, tune) {                    // -> ["liar"] or ["bid", q, f]; the old man's head (and the test bot's)
  const T = tune || LD_TUNE, total = mine.length + otherN;
  const p = (q, f) => ldAtLeast(otherN, q - ldCount(mine, f));
  if (bid && p(bid[0], bid[1]) < T.call + (Math.random() - 0.5) * T.noise * 2) return ["liar"];
  const cands = [];
  for (let f = 2; f <= 6; f++) for (const q of bid ? [bid[0], bid[0] + 1] : [Math.max(1, ldCount(mine, f) + Math.floor(otherN / 3))]) if (q <= total && ldBidOK(bid, q, f)) cands.push([q, f, p(q, f) + Math.random() * 0.05]);
  if (!cands.length) return ["liar"];
  cands.sort((a, b) => b[2] - a[2]);
  let pick = cands[0];
  if (Math.random() < T.bluff) { const ok = cands.filter(q => q[2] > 0.25); if (ok.length) pick = ok[Math.floor(Math.random() * ok.length)]; }
  if (bid && pick[2] < 0.3 && p(bid[0], bid[1]) < 0.55) return ["liar"];
  return ["bid", pick[0], pick[1]];
}
CZ.ld = null;
function ldOpen() { if (!CZ.ld) CZ.ld = { bet: 10, phase: "stake", you: [], him: [], bid: null, q: 1, f: 2, turn: "you", hist: [], msg: "PUT IN YOUR STAKE", say: "FANCY A GAME?", t: 0, fold: false }; }
function ldNewRound(c, starter) {
  c.you = ldRoll(c.you.length); c.him = ldRoll(c.him.length); c.bid = null; c.hist = []; c.turn = starter; c.phase = "play"; c.reveal = null;
  const best = [2, 3, 4, 5, 6].sort((a, b) => ldCount(c.you, b) - ldCount(c.you, a))[0];
  c.f = best; c.q = Math.max(1, ldCount(c.you, best)); c.t = 0.9;
  c.say = starter === "you" ? "YOU START." : "MY BID FIRST.";
}
function ldDeal() {
  const c = CZ.ld; if (c.phase === "play" || c.phase === "reveal") return;
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet; c.you = [0, 0, 0, 0, 0]; c.him = [0, 0, 0, 0, 0]; c.fold = false; c.msg = "";
  ldNewRound(c, "you"); play("tick");
}
function ldBid() {
  const c = CZ.ld; if (c.phase !== "play" || c.turn !== "you") return;
  if (!ldBidOK(c.bid, c.q, c.f)) { c.say = "RAISE IT, FRIEND"; play("miss"); return; }
  c.bid = [c.q, c.f, "you"]; c.hist.push(["YOU", c.q, c.f]); c.turn = "him"; c.t = 0.8 + Math.random() * 0.6; c.say = "HMM..."; c.fold = false; play("tick");
}
function ldLiar(who) {                                      // who called it: "you" or "him"
  const c = CZ.ld, [q, f] = c.bid, n = ldCount(c.you, f) + ldCount(c.him, f), right = n >= q;
  const loser = (right ? (who === "you" ? "you" : "him") : (who === "you" ? "him" : "you"));
  c.reveal = { q, f, n, loser, who }; c.phase = "reveal"; c.fold = false;
  c.say = who === "him" ? "LIAR!" : right ? "HA! THERE." : "...CAUGHT ME.";
  c.msg = (n === 1 ? "ONE " : LD_NUM[n] || n) + " " + f + (n === 1 ? "" : "S") + " WITH THE 1S. " + (loser === "you" ? "YOU LOSE A DIE" : "HE LOSES A DIE");
  play(loser === "you" ? "miss" : "chime");
}
function ldNext() {                                         // after a reveal: take the die, maybe end the game
  const c = CZ.ld, r = c.reveal; if (!r) return;
  if (r.loser === "you") c.you.pop(); else c.him.pop();
  if (!c.you.length || !c.him.length) {
    c.phase = "done"; c.reveal = null;
    if (c.him.length) { c.msg = "HE WINS. ANOTHER?"; c.say = "MAYBE NEXT TIME."; play("miss"); return; }
    const win = Math.min(maxWin(c.staked), Math.round(c.staked * LD_PAY));
    addChips(win, "win"); tav().ldWins = (tav().ldWins || 0) + 1; if (tav().ldWins >= 10) tavAward("liarliar");
    c.msg = "YOU WIN! +" + fmtChips(win, 1e6); c.say = "WELL PLAYED."; play("fanfare"); saveStore(); return;
  }
  ldNewRound(c, r.loser);
}
function ldFold() { const c = CZ.ld; c.phase = "done"; c.reveal = null; c.msg = "YOU FOLDED. STAKE LOST"; c.say = "SUIT YOURSELF."; play("miss"); }
function ldTick(dt) {
  const c = CZ.ld; if (!c || c.phase !== "play" || c.turn !== "him") return;
  c.t -= dt; if (c.t > 0) return;
  const a = ldAI(c.him, c.you.length, c.bid);
  if (a[0] === "liar") { ldLiar("him"); return; }
  c.bid = [a[1], a[2], "him"]; c.hist.push(["HIM", a[1], a[2]]); c.turn = "you";
  c.say = (LD_NUM[a[1]] || a[1]) + " " + a[2] + "S."; c.q = a[1]; c.f = a[2]; play("tick");
  if (!ldBidOK(c.bid, c.q, c.f)) { if (c.f < 6) c.f++; else c.q++; }       // start your next bid one step above his
}
const LD_PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
function ldDie(x, y, s, f, o) {
  o = o || {};
  rect(o.hide ? "#3a2a1e" : o.wild ? "#ffe9a0" : "#f2ead8", x, y, s, s); outline(x, y, s, s, o.hl ? GOLD : o.hide ? "#5a3a22" : "#8a7a60");
  if (o.hide) { text("?", x + s / 2, y + s / 2, s >= 14 ? 2 : 1, "#8a6a4a", "center", null); return; }
  const p = Math.max(2, Math.floor(s / 7)), g3 = (s - 2 * p - 2) / 2;
  for (const [cx, cy] of LD_PIPS[f]) rect(f === 1 ? "#c83c3c" : INK, Math.round(x + 1 + p / 2 + cx * g3), Math.round(y + 1 + p / 2 + cy * g3), p, p);
}
function ldBubble(x, y, w, t) { rect(WHITE, x, y, w, 13); rect(WHITE, x + 6, y + 13, 4, 3); text(t.slice(0, Math.floor((w - 4) / 6)), x + w / 2, y + 7, 1, INK, "center", null); }
function ldHits() {
  const L = czL(), c = CZ.ld, h = [], X = L.X, w = L.w;
  if (c.phase === "stake" || c.phase === "done") { if (w) { stakeCtl(h, "stake", X, 152, 120); h.push(["deal", X + 126, 150, 96, 20, 0]); } else { stakeCtl(h, "stake", X + 4, 136, 112); h.push(["deal", X + 14, 156, 92, 18, 0]); } }
  else if (c.phase === "reveal") h.push(w ? ["next", X + 60, 150, 102, 20, 0] : ["next", X + 14, 150, 92, 18, 0]);
  else if (w) h.push(["qm", X, 152, 16, 18, -1], ["qp", X + 70, 152, 16, 18, 1], ["fm", X + 92, 152, 16, 18, -1], ["fp", X + 132, 152, 16, 18, 1], ["bid", X + 154, 152, 32, 18, 0], ["liar", X + 190, 152, 32, 18, 0]);
  else h.push(["qm", X + 2, 116, 14, 16, -1], ["qp", X + 44, 116, 14, 16, 1], ["fm", X + 62, 116, 14, 16, -1], ["fp", X + 96, 116, 14, 16, 1], ["bid", X + 4, 138, 54, 18, 0], ["liar", X + 62, 138, 54, 18, 0]);
  return h;
}
function drawLd() {
  const c = CZ.ld, L = czL(), X = L.X, w = L.w;
  rect("#0e3a2a", 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  czTitle(L, "LIAR'S DICE", GOLD);
  const showHim = c.phase === "reveal" || (c.phase === "done" && c.him.length), r = c.reveal, f = r ? r.f : c.f, playing = c.phase !== "stake";
  const hl = d => !!r && (d === r.f || d === 1);
  if (w) {
    spr("oldman", X + 6, 22, false, 2); ldBubble(X + 44, 22, 150, c.say);
    text("HIS CUP", X + 44, 48, 1, "#a0c8b4", "left", null);
    c.him.forEach((d, i) => ldDie(X + 44 + i * 18, 55, 15, d || 1, { hide: !showHim || !d, wild: showHim && d === 1, hl: showHim && hl(d) }));
    rect("#0a2a1e", X, 80, 222, 22); outline(X, 80, 222, 22, "#2a6a4a");
    if (c.hist.length) c.hist.slice(-2).forEach(([who, q, fc], i) => { const x = X + 6 + i * 108; text(who + ":", x, 91, 1, who === "YOU" ? CYAN : GOLD, "left", null); text(q + " X", x + 30, 91, 1, WHITE, "left", null); ldDie(x + 52, 84, 13, fc); });
    else text(playing ? "NO BIDS YET" : "", X + 111, 91, 1, "#5a8a74", "center", null);
    text("YOUR CUP", X, 112, 1, "#a0c8b4", "left", null);
    c.you.forEach((d, i) => ldDie(X + 2 + i * 26, 120, 22, d || 1, { hide: !d, wild: d === 1, hl: r ? hl(d) : c.phase === "play" && (d === c.f || d === 1) }));
    if (playing) text("1S ARE WILD", X + 136, 131, 1, "#ffe9a0", "left", null);
    const px = X + 232, pw = 116;
    rect("#0a2a1e", px, 22, pw, 150); outline(px, 22, pw, 150, "#2a6a4a");
    text("HOW TO PLAY", px + pw / 2, 30, 1, GOLD, "center", null);
    ["BID HOW MANY DICE", "SHOW A FACE IN", "BOTH CUPS. 1S", "ARE WILD.", "", "RAISE THE BID OR", "CALL LIAR. WRONG", "ON A CALL: LOSE", "A DIE. LAST ONE", "WITH DICE WINS."].forEach((l, i) => text(l, px + 6, 44 + i * 9, 1, "#c8e6d2", "left", null));
    text(playing ? "DICE: YOU " + c.you.length + "  HIM " + c.him.length : "", px + pw / 2, 142, 1, WHITE, "center", null);
    text("STAKE " + fmtChips(c.staked && playing ? c.staked : c.bet, 1e6), px + pw / 2, 154, 1, WHITE, "center", null); text("WIN PAYS X" + LD_PAY, px + pw / 2, 164, 1, GOLD, "center", null);
  } else {
    spr("oldman", X + 2, 26, false, 1); ldBubble(X + 18, 26, 100, c.say);
    c.him.forEach((d, i) => ldDie(X + 26 + i * 13, 44, 11, d || 1, { hide: !showHim || !d, wild: showHim && d === 1, hl: showHim && hl(d) }));
    rect("#0a2a1e", X + 2, 60, 116, 14); outline(X + 2, 60, 116, 14, "#2a6a4a");
    const last = c.hist[c.hist.length - 1];
    if (last) { text((last[0] === "YOU" ? "YOUR BID: " : "HIS BID: ") + last[1] + " X", X + 8, 67, 1, last[0] === "YOU" ? CYAN : GOLD, "left", null); ldDie(X + (last[0] === "YOU" ? 96 : 90), 61, 12, last[2]); }
    else text(playing ? "NO BIDS YET" : "BEAT THE OLD MAN", X + 60, 67, 1, "#5a8a74", "center", null);
    text(playing ? "YOUR CUP. 1S WILD" : "5 DICE EACH, 1S WILD", X + 60, 82, 1, "#a0c8b4", "center", null);
    c.you.forEach((d, i) => ldDie(X + 5 + i * 23, 89, 19, d || 1, { hide: !d, wild: d === 1, hl: r ? hl(d) : c.phase === "play" && (d === c.f || d === 1) }));
  }
  const msgY = w ? 140 : 112;
  if (c.phase !== "play") text((c.msg || "").slice(0, w ? 36 : 19), w ? X + 111 : X + 60, w ? 182 : msgY, 1, c.phase === "done" && /WIN!/.test(c.msg) ? GOLD : WHITE, "center", null);
  for (const [id, x, y, bw, bh, v] of ldHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, w ? 120 : 112, c.bet, CHIP, "STAKE");
    else if (id === "deal") btn(x, y, bw, bh, c.phase === "done" ? "PLAY AGAIN" : "DEAL", tav().chips >= c.bet ? GOLD : GREY);
    else if (id === "next") btn(x, y, bw, bh, !c.you.length || !c.him.length || (r && ((r.loser === "you" && c.you.length === 1) || (r.loser === "him" && c.him.length === 1))) ? "FINISH" : "NEXT ROUND", GOLD);
    else if (id === "qm" || id === "qp" || id === "fm" || id === "fp") btn(x, y, bw, bh, id[1] === "m" ? (id[0] === "q" ? "-" : "<") : (id[0] === "q" ? "+" : ">"), CHIP);
    else if (id === "bid") btn(x, y, bw, bh, "BID", c.turn === "you" && ldBidOK(c.bid, c.q, c.f) ? GOLD : GREY);
    else if (id === "liar") btn(x, y, bw, bh, w ? "LIAR" : "LIAR!", c.turn === "you" && c.bid && c.bid[2] === "him" ? "#ff6e6e" : GREY);
  }
  if (c.phase === "play") {
    if (w) { rect(INK, X + 18, 152, 50, 18); outline(X + 18, 152, 50, 18, "#2a6a4a"); text(c.q + " X", X + 43, 161, 1, WHITE, "center", null); ldDie(X + 112, 153, 16, c.f);
      text(c.turn === "you" ? "YOU BID: " + (LD_NUM[c.q] || c.q) + " " + c.f + "S, COUNTING BOTH CUPS" : "HE'S THINKING...", X + 111, 178, 1, "#8cc8a8", "center", null); }
    else { text(c.q + " X", X + 30, 124, 1, WHITE, "center", null); ldDie(X + 79, 117, 14, c.f); text("DICE: YOU " + c.you.length + "  HIM " + c.him.length, X + 60, 166, 1, WHITE, "center", null); text("STAKE " + fmtChips(c.staked, 1e6) + " PAYS X" + LD_PAY, X + 60, 178, 1, GOLD, "center", null); }
  } else if (!w && c.phase === "reveal") text("DICE: YOU " + c.you.length + "  HIM " + c.him.length, X + 60, 176, 1, WHITE, "center", null);
  else if (!w) text("WIN PAYS X" + LD_PAY, X + 60, 178, 1, GOLD, "center", null);
  const live = c.phase === "play" || c.phase === "reveal";
  text(live ? (c.fold ? "TAP AGAIN TO FOLD (STAKE LOST)" : "TAP HERE TO FOLD").slice(0, w ? 40 : 19) : "TAP HERE TO LEAVE", LW / 2, 194, 1, live ? (c.fold ? "#ff8c8c" : WHITE) : WHITE, "center", null);
}
function ldTap(rx, ly) {
  const c = CZ.ld, h = hitAt(ldHits(), rx, ly);
  if (!h) {
    if (ly > 186) { if (c.phase === "play" || c.phase === "reveal") { if (c.fold) ldFold(); else { c.fold = true; play("tick"); } } else closeOverlay(); }
    return;
  }
  const [id, , , , , v] = h;
  c.fold = false;
  if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "deal") ldDeal();
  else if (id === "next") ldNext();
  else if (c.turn !== "you" || c.phase !== "play") return;
  else if (id === "qm" || id === "qp") { c.q = clamp(c.q + v, 1, c.you.length + c.him.length); play("tick"); }
  else if (id === "fm" || id === "fp") { c.f = (c.f - 2 + v + 5) % 5 + 2; play("tick"); }
  else if (id === "bid") ldBid();
  else if (id === "liar") { if (c.bid && c.bid[2] === "him") ldLiar("you"); else play("miss"); }
}
function ldKey(code, dir) {
  const c = CZ.ld;
  if (c.phase === "stake" || c.phase === "done") { if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); } else if (code === "Space" || code === "Enter") ldDeal(); return; }
  if (c.phase === "reveal") { if (code === "Space" || code === "Enter") ldNext(); return; }
  if (c.turn !== "you") return;
  if (dir) { c.f = (c.f - 2 + dir + 5) % 5 + 2; play("tick"); }
  else if (code === "ArrowUp" || code === "KeyW") { c.q = Math.min(c.you.length + c.him.length, c.q + 1); play("tick"); }
  else if (code === "ArrowDown" || code === "KeyS") { c.q = Math.max(1, c.q - 1); play("tick"); }
  else if (code === "Space" || code === "Enter") ldBid();
  else if (code === "KeyL") { if (c.bid && c.bid[2] === "him") ldLiar("you"); }
}
EXTRA_OV.liar = { draw: drawLd, tap: ldTap, key: ldKey, back: () => czLeave(CZ.ld, CZ.ld && (CZ.ld.phase === "play" || CZ.ld.phase === "reveal"), "liar", "tables"), music: true };

// ---- THE SHELL GAME. The old man shows the pearl, drops a shell over it and shuffles. Pick the shell with the pearl.
// Three speeds. At the end his hands cover the shells and SOMETIMES he swaps them again (an old con; the screen says so),
// so even perfect watching can't beat the house: someone who never loses track wins 1 - 2q/3 of the time, where q is how
// often he does it. SLOW x1.5 (q .55), FAST x2 (q .79), BLUR x2.75 (q .98) -> about 95% for a perfect watcher, less for
// a guesser (50% / 67% / 92%).
const SG_TIERS = [["SLOW", 1.5, 6, 0.55, 0.55], ["FAST", 2, 9, 0.33, 0.79], ["BLUR", 2.75, 12, 0.2, 0.98]];   // [name, pays, swaps, s a swap, q]
CZ.sg = null;
function sgOpen() { if (!CZ.sg) CZ.sg = { bet: 10, tier: 0, phase: "stake", slot: [0, 1, 2], pearl: 1, moves: [], mi: 0, t: 0, pick: -1, msg: "WATCH THE PEARL", say: "STEP RIGHT UP", won: 0 }; }
function sgStart() {
  const c = CZ.sg; if (!["stake", "done"].includes(c.phase)) return;
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; play("miss"); return; }
  addChips(-c.bet); c.staked = c.bet;
  const T = SG_TIERS[c.tier];
  c.slot = [0, 1, 2]; c.pearl = Math.floor(Math.random() * 3); c.pick = -1; c.won = 0;
  c.moves = Array.from({ length: T[2] }, () => { const a = Math.floor(Math.random() * 3); return [a, (a + 1 + Math.floor(Math.random() * 2)) % 3]; });   // pairs of slots
  c.flourish = Math.random() < T[4];
  c.mi = 0; c.t = 0; c.phase = "show"; c.msg = ""; c.say = "WATCH CLOSELY..."; play("tick");
}
function sgSwapSlots(c, a, b) { const i = c.slot.indexOf(a), j = c.slot.indexOf(b); c.slot[i] = b; c.slot[j] = a; }
function sgTick(dt) {
  const c = CZ.sg; if (!c || ["stake", "pick", "done"].includes(c.phase)) return;
  c.t += dt; const T = SG_TIERS[c.tier];
  if (c.phase === "show" && c.t > 1.4) { c.phase = "shuffle"; c.t = 0; }
  else if (c.phase === "shuffle" && c.t >= T[3]) {
    const [a, b] = c.moves[c.mi]; sgSwapSlots(c, a, b); c.mi++; c.t = 0; play("tick", 0.5);
    if (c.mi >= c.moves.length) { c.phase = "cover"; c.t = 0; c.say = "...AND A TWIST"; }
  } else if (c.phase === "cover" && c.t > 0.9) {
    if (c.flourish) { const p = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } c.slot = c.slot.map(s => p[s]); }
    c.phase = "pick"; c.t = 0; c.say = "WHERE IS IT?"; c.msg = "TAP A SHELL";
  }
}
function sgPick(k) {                                        // k = a slot, 0 to 2
  const c = CZ.sg; if (c.phase !== "pick") return;
  const shell = c.slot.indexOf(k); c.pick = k; c.phase = "done"; c.t = 0;
  if (shell === c.pearl) {
    const T = SG_TIERS[c.tier]; c.won = Math.min(maxWin(c.staked), Math.round(c.staked * T[1]));
    addChips(c.won, "win"); if (c.tier === 2) tavAward("sharpeye");
    c.msg = "THE PEARL! +" + fmtChips(c.won, 1e6); c.say = c.flourish ? "LUCKY GUESS." : "SHARP EYES."; play("fanfare");
  } else { c.msg = "EMPTY. AGAIN?"; c.say = "SO CLOSE."; play("miss"); }
}
function sgShellXY(c, shell, x0, sp, y0) {                  // where a shell is drawn right now (moving shells arc past each other)
  const s = c.slot[shell];
  let x = x0 + s * sp, y = y0;
  if (c.phase === "shuffle" && c.mi < c.moves.length) {
    const [a, b] = c.moves[c.mi], T = SG_TIERS[c.tier], u = Math.min(1, c.t / T[3]), e = u * u * (3 - 2 * u);
    if (s === a || s === b) { const to = s === a ? b : a; x = x0 + (s + (to - s) * e) * sp; y = y0 + Math.sin(e * Math.PI) * sp * 0.35 * (s === a ? -1 : 1); }
  }
  return [x, y];
}
function sgShell(x, y, w, lift) {                           // a scallop shell, w wide, sitting on y
  const h = Math.round(w * 0.62), top = y - h - lift;
  g.fillStyle = "#e8b48c"; g.beginPath(); g.moveTo(x - w / 2, y - lift); g.quadraticCurveTo(x - w / 2, top, x, top); g.quadraticCurveTo(x + w / 2, top, x + w / 2, y - lift); g.closePath(); g.fill();
  g.strokeStyle = "#a0644a"; g.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * w * 0.08, top + 2); g.lineTo(x + k * w * 0.2, y - lift - 1); g.stroke(); }
  rect("#a0644a", Math.round(x - w / 2), y - lift - 2, w, 2);
  rect("#c88c64", Math.round(x - w * 0.18), y - lift - 1, Math.round(w * 0.36), 3);   // the hinge
}
function sgHits() {
  const L = czL(), c = CZ.sg, h = [], X = L.X;
  if (L.w) {
    const x0 = X + 34, sp = 76;
    if (c.phase === "pick") for (let k = 0; k < 3; k++) h.push(["shell", x0 + k * sp - 30, 70, 60, 70, k]);
    if (["stake", "done"].includes(c.phase)) { SG_TIERS.forEach((t, i) => h.push(["tier", X + 236, 24 + i * 22, 112, 18, i])); stakeCtl(h, "stake", X + 236, 94, 112); h.push(["go", X + 236, 114, 112, 22, 0]); }
  } else {
    const x0 = X + 22, sp = 38;
    if (c.phase === "pick") for (let k = 0; k < 3; k++) h.push(["shell", x0 + k * sp - 17, 50, 34, 50, k]);
    if (["stake", "done"].includes(c.phase)) { SG_TIERS.forEach((t, i) => h.push(["tier", X + 4 + i * 38, 126, 36, 19, i])); stakeCtl(h, "stake", X + 4, 150, 112); h.push(["go", X + 14, 170, 92, 16, 0]); }
  }
  return h;
}
function drawSg() {
  const c = CZ.sg, L = czL(), X = L.X, w = L.w, T = SG_TIERS[c.tier];
  tavernBg();
  czTitle(L, "THE SHELL GAME", GOLD);
  const x0 = w ? X + 34 : X + 22, sp = w ? 76 : 38, y0 = w ? 132 : 92, sw = w ? 52 : 30;
  rect("#0e4a2e", w ? X : X + 2, w ? 64 : 42, w ? 228 : 116, w ? 84 : 58); outline(w ? X : X + 2, w ? 64 : 42, w ? 228 : 116, w ? 84 : 58, "#5a3a22");   // the felt
  if (w) { spr("oldman", X + 6, 22, false, 1); ldBubble(X + 30, 24, 150, c.say); }
  else ldBubble(X + 10, 26, 100, c.say);
  const showPearl = c.phase === "show" || c.phase === "done";
  for (let shell = 0; shell < 3; shell++) {
    const [x, y] = sgShellXY(c, shell, x0, sp, y0);
    const lift = c.phase === "show" && c.t > 0.15 && c.t < 1.15 && shell === c.pearl ? sw * 0.5 : c.phase === "done" && (c.slot[shell] === c.pick || shell === c.pearl) ? sw * 0.5 : 0;
    if (showPearl && shell === c.pearl && lift) { disc("#f6f2ea", x, y - Math.round(sw * 0.1), Math.max(2, Math.round(sw * 0.1))); rect(WHITE, Math.round(x - sw * 0.05), Math.round(y - sw * 0.15), 1, 1); }
    sgShell(x, y, sw, Math.round(lift));
    if (c.phase === "pick") text(String(c.slot[shell] + 1), x, y + (w ? 10 : 7), 1, "#a0c8b4", "center", null);
  }
  if (c.phase === "cover") {                                // his hands over all three shells
    const jig = Math.round(Math.sin(c.t * 30) * 2);
    for (let k = 0; k < 2; k++) {                             // two big hands, fingers spread over the felt
      const hx = Math.round(x0 + (k ? sp * 1.5 : sp * 0.5) + jig * (k ? -1 : 1)), hw = Math.round(sw * 1.5), hy = y0 - Math.round(sw * 0.85), hh = Math.round(sw * 0.55), fw = Math.max(2, Math.round(hw / 6));
      g.fillStyle = "#e6c8a0"; g.beginPath(); g.ellipse(hx, hy + hh * 0.6, hw / 2, hh * 0.6, 0, 0, Math.PI * 2); g.fill();
      for (let f = 0; f < 4; f++) { const fx = Math.round(hx - hw / 2 + fw * 0.6 + f * fw * 1.25); rect("#e6c8a0", fx, hy - Math.round(hh * 0.5), fw, Math.round(hh * 0.9)); rect("#c8a07a", fx + fw - 1, hy - Math.round(hh * 0.4), 1, Math.round(hh * 0.7)); }
      rect("#e6c8a0", k ? hx + Math.round(hw / 2) - fw : hx - Math.round(hw / 2), hy + Math.round(hh * 0.3), fw, Math.round(hh * 0.5));   // the thumb
      rect("#b4784a", hx - Math.round(hw / 2), hy + hh + 1, hw, 2);                                                                        // his sleeve cuff
    }
  }
  text(c.phase === "shuffle" ? T[0] + " SHUFFLE" : (c.msg || "").slice(0, w ? 36 : 19), w ? X + 114 : X + 60, w ? 160 : 110, 1, c.phase === "done" && c.won ? GOLD : WHITE, "center", null);
  for (const [id, x, y, bw, bh, v] of sgHits()) {
    if (id === "tier") { const t = SG_TIERS[v], sel = v === c.tier; box(x, y, bw, bh, sel ? GOLD : CHIP); text(w ? t[0] + "  X" + t[1] : t[0], x + bw / 2, y + (w ? bh / 2 : 5), 1, sel ? GOLD : "#a0c8b4", "center", null); if (!w) text("X" + t[1], x + bw / 2, y + 14, 1, sel ? WHITE : "#6a9a84", "center", null); }
    else if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, "STAKE");
    else if (id === "go") btn(x, y, bw, bh, c.phase === "done" ? "AGAIN" : "PLAY", tav().chips >= c.bet ? GOLD : GREY);
  }
  if (w) {
    ["AT THE END HIS", "HANDS COVER THE", "SHELLS. SOMETIMES", "HE SWAPS AGAIN.", "ABOUT 95% BACK"].forEach((l, i) => text(l, X + 292, 146 + i * 9, 1, "#a08c70", "center", null));
  }
  const busy = !["stake", "done"].includes(c.phase);
  text(busy ? "" : "TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function sgTap(rx, ly) {
  const c = CZ.sg, h = hitAt(sgHits(), rx, ly);
  if (!h) { if (ly > 186 && ["stake", "done"].includes(c.phase)) closeOverlay(); return; }
  const [id, , , , , v] = h;
  if (id === "shell") sgPick(v);
  else if (id === "tier") { c.tier = v; play("tick"); }
  else if (id === "stake") { c.bet = stakeStep(c.bet, v); play("tick"); }
  else if (id === "go") sgStart();
}
function sgKey(code, dir) {
  const c = CZ.sg;
  if (c.phase === "pick") { const k = { Digit1: 0, Digit2: 1, Digit3: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[code]; if (k !== undefined) sgPick(k); return; }
  if (!["stake", "done"].includes(c.phase)) return;
  if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); }
  else if (code === "ArrowUp" || code === "KeyW") { c.tier = (c.tier + 1) % 3; play("tick"); }
  else if (code === "Space" || code === "Enter") sgStart();
}
EXTRA_OV.shell = { draw: drawSg, tap: sgTap, key: sgKey, back: () => czLeave(CZ.sg, CZ.sg && !["stake", "done"].includes(CZ.sg.phase), "shell", "tables"), music: true };

// ---- DOUBLOON PUSHER: the arcade coin pusher, seen from above. Drop doubloons onto the shelf; the pusher shoves the pile
// forward. Doubloons that fall off the front are yours; ones that slip into the side gutters are the house's. Every
// doubloon carries the value it was dropped at, so changing your coin size can't pull out more than went in. Your shelf
// is saved (`tav.dp`), so leaving and coming back doesn't refill it. The gutters are tuned so a steady stream of drops
// pays back about 94% aiming dead centre, ~91% with the chute swinging and less near the edges (gutters 22 deep: 20 gave
// 96.6% in the middle, 26 gave 91%). tools/tests/test_casino7.py simulates thousands of drops at every aim.
const DP = { W: 100, D: 124, R: 4.6, GAP: 22, SIDE: 0, PUSH0: 8, PUSHA: 9, PUSHW: 1.5 };
CZ.dp = null;
function dpCoins() {                                        // the saved shelf: [[x, y, value]...]; a fresh one is full of house coins worth 1
  const q = tav();
  if (!q.dp || !Array.isArray(q.dp.c)) {                   // about as full as a shelf settles in play (~130 coins)
    const c = [], st = DP.R * 2 + 0.3;
    for (let y = 20, row = 0; y < DP.D - 12; y += st * 0.87, row++) for (let x = DP.R + 1 + (row % 2) * st / 2; x < DP.W - DP.R - 1; x += st) c.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, 1]);
    q.dp = { c, v: 1 };
  }
  return q.dp.c;
}
function dpOpen() {
  if (!CZ.dp) CZ.dp = { bet: 10, aim: 0.5, dir: 1, t: 0, coins: dpCoins().map(([x, y, v]) => ({ x, y, vx: 0, vy: 0, v })), falling: [], queue: 0, next: 0, win: 0, msg: "DROP A DOUBLOON", saved: 0, burst: [] };
}
const dpPushY = t => DP.PUSH0 + DP.PUSHA * (0.5 - 0.5 * Math.cos(t * DP.PUSHW * Math.PI));
// One physics step (dt = 1/60), shared by the screen and the tests. -> [paid value, house value]
function dpStep(s, dt) {
  s.t += dt;
  const py = dpPushY(s.t), pv = (py - dpPushY(s.t - dt)) / dt, R = DP.R, cs = s.coins;
  for (const c of cs) { c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.86; c.vy *= 0.86; }
  for (let it = 0; it < 4; it++) {
    for (const c of cs) if (c.y < py + R) { c.y = py + R; if (pv > 0) c.vy = Math.max(c.vy, pv); }
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), o = (2 * R - d) / 2, nx = dx / d, ny = dy / d;
      const aPin = a.y <= py + R + 0.01, bPin = b.y <= py + R + 0.01;     // the pusher face doesn't give way
      if (aPin && !bPin) { b.x += nx * o * 2; b.y += ny * o * 2; } else if (bPin && !aPin) { a.x -= nx * o * 2; a.y -= ny * o * 2; } else { a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; }
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) { const k = rv * 0.5; a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny; }
    }
    for (const c of cs) {                                   // walls: solid at the back, open gutters for the last GAP of the shelf
      if (c.y < DP.D - DP.GAP) { if (c.x < R) { c.x = R; c.vx = Math.abs(c.vx) * 0.3; } if (c.x > DP.W - R) { c.x = DP.W - R; c.vx = -Math.abs(c.vx) * 0.3; } }
    }
  }
  let paid = 0, house = 0;
  s.coins = cs.filter(c => {
    if (c.y > DP.D) { paid += c.v; s.falling && s.falling.push({ x: c.x, y: DP.D, t: 0, v: c.v, win: true }); return false; }
    if (c.x < -R * 0.2 || c.x > DP.W + R * 0.2) { house += c.v; s.falling && s.falling.push({ x: c.x, y: c.y, t: 0, v: c.v, win: false }); return false; }
    return true;
  });
  return [paid, house];
}
function dpDrop(s, x, v) { s.coins.push({ x: clamp(x, DP.R, DP.W - DP.R), y: dpPushY(s.t) + DP.R + 0.5, vx: (Math.random() - 0.5) * 6, vy: 18 + Math.random() * 10, v }); }
const dpAimX = s => DP.R + s.aim * (DP.W - 2 * DP.R);
function dpTry() {
  const c = CZ.dp;
  if (tav().chips < c.bet || c.bet < 1) { c.msg = "NOT ENOUGH CHIPS"; c.queue = 0; play("miss"); return false; }
  addChips(-c.bet); dpDrop(c, dpAimX(c) + (Math.random() - 0.5) * 10, c.bet); c.dirty = true; play("tick", 0.5); return true;
}
function dpTick(dt) {
  const c = CZ.dp; if (!c || S.overlay !== "pusher") return;
  c.aim += c.dir * dt * 0.45; if (c.aim > 1) { c.aim = 1; c.dir = -1; } if (c.aim < 0) { c.aim = 0; c.dir = 1; }   // the chute swings
  c.next -= dt; if (c.queue > 0 && c.next <= 0) { if (dpTry()) { c.queue--; c.next = 0.35; } }
  const steps = Math.min(4, Math.round(dt * 60)) || 1;
  for (let k = 0; k < steps; k++) {
    const [paid] = dpStep(c, 1 / 60);
    if (paid) { addChips(paid, "win"); c.win += paid; c.burst.push([c.t, paid]); c.msg = "+" + fmtChips(paid, 1e6); c.dirty = true; play("chime", 0.6); }
  }
  c.burst = c.burst.filter(b => c.t - b[0] < 1.5);
  if (c.burst.length >= 10) tavAward("pusher");
  for (const f of c.falling) f.t += dt;
  c.falling = c.falling.filter(f => f.t < 0.8);
  c.saved += dt; if (c.dirty && c.saved > 3) dpSave();
}
function dpSave() { const c = CZ.dp; if (!c) return; tav().dp = { c: c.coins.map(o => [Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10, o.v]), v: 1 }; c.dirty = false; c.saved = 0; saveStore(); }
function dpHits() {
  const L = czL(), h = [], X = L.X;
  if (L.w) { const px = X + 236; stakeCtl(h, "stake", px, 40, 112); h.push(["drop", px, 62, 112, 24, 0], ["drop5", px, 90, 112, 18, 0]); }
  else { stakeCtl(h, "stake", X + 4, 155, 112); h.push(["drop", X + 4, 173, 54, 14, 0], ["drop5", X + 62, 173, 54, 14, 0]); }
  return h;
}
function drawDp() {
  const c = CZ.dp, L = czL(), X = L.X, w = L.w, k = w ? 1.3 : 0.88, fx = w ? X + 40 : X + 16, fy = w ? 24 : 28;
  rect("#1a1208", 0, 0, LW, LH);
  czTitle(L, "DOUBLOON PUSHER", GOLD);
  const W = DP.W * k, D = DP.D * k, gy = fy + (DP.D - DP.GAP) * k;
  rect("#3a2414", fx - 4, fy - 4, W + 8, D + 4);             // the cabinet
  rect("#2a5a3a", fx, fy, W, D);                             // the shelf
  rect("#0a0a0a", fx - 4, gy, 4, D - (gy - fy)); rect("#0a0a0a", fx + W, gy, 4, D - (gy - fy));   // the gutters
  rect("#c89c3c", fx, fy + D, W, 2);                         // the front lip
  const py = dpPushY(c.t) * k;
  rect("#a07a3a", fx, fy, W, py); rect("#e6c46e", fx, fy + py - 2, W, 2);   // the pusher
  const ax = fx + dpAimX(c) * k;
  poly("#c8c8d2", [[ax - 4, fy - 4], [ax + 4, fy - 4], [ax, fy + 3]]);       // the chute
  const r = Math.max(2, Math.round(DP.R * k));
  for (const o of c.coins) { const big = o.v > c.bet; disc(o.v <= 1 ? "#b08a3a" : big ? "#ffe680" : GOLD, fx + o.x * k, fy + o.y * k, r); disc(o.v <= 1 ? "#8a6a2a" : "#c8961e", fx + o.x * k, fy + o.y * k, Math.max(1, r - 2)); }
  for (const f of c.falling) { const a = 1 - f.t / 0.8; g.globalAlpha = Math.max(0, a); disc(f.win ? GOLD : "#6a5a3a", fx + f.x * k, fy + f.y * k + f.t * 30, Math.max(1, Math.round(r * a))); g.globalAlpha = 1; if (f.win && f.t < 0.6 && f.v > 1) text("+" + fmtChips(f.v), fx + f.x * k, fy + D + 8 - f.t * 14, 1, GOLD, "center", null); }
  for (const [id, x, y, bw, bh, v] of dpHits()) {
    if (id === "stake" && v < 0) drawStakeCtl(x, y, 112, c.bet, CHIP, w ? "STAKE" : "BET");
    else if (id === "drop") btn(x, y, bw, bh, "DROP", tav().chips >= c.bet ? GOLD : GREY);
    else if (id === "drop5") btn(x, y, bw, bh, c.queue ? "DROPPING " + c.queue : "DROP 5", CHIP);
  }
  if (w) {
    const px = X + 236;
    text(c.msg.slice(0, 18), px + 56, 120, 1, /^\+/.test(c.msg) ? GOLD : WHITE, "center", null);
    text("THIS VISIT " + fmtChips(c.win, 1e6), px + 56, 132, 1, "#c8b48c", "center", null);
    ["FRONT EDGE: YOURS", "GUTTERS: HOUSE'S", "", "SPACE DROPS ONE", "UP DROPS FIVE"].forEach((l, i) => text(l, px + 56, 148 + i * 9, 1, "#8a7a5a", "center", null));
  } else text(c.msg.slice(0, 19), X + 60, 147, 1, /^\+/.test(c.msg) ? GOLD : WHITE, "center", null);
  text("TAP HERE TO LEAVE", LW / 2, 194, 1, WHITE, "center", null);
}
function dpTap(rx, ly) {
  const c = CZ.dp, h = hitAt(dpHits(), rx, ly);
  if (!h) { if (ly > 186) { dpSave(); closeOverlay(); } return; }
  if (h[0] === "stake") { c.bet = stakeStep(c.bet, h[5]); play("tick"); }
  else if (h[0] === "drop") dpTry();
  else if (h[0] === "drop5") { c.queue += 5; }
}
function dpKey(code, dir) { const c = CZ.dp; if (dir) { c.bet = stakeStep(c.bet, dir); play("tick"); } else if (code === "Space" || code === "Enter") dpTry(); else if (code === "ArrowUp" || code === "KeyW") c.queue += 5; }
EXTRA_OV.pusher = { draw: drawDp, tap: dpTap, key: dpKey, back: () => { dpSave(); return "machines"; }, music: true };

// hook the four into the menus, the openers and the clock
HUBS.tables.games.push(["compass", "COMPASS ROSE", "ROULETTE, 32 POINTS"], ["liar", "LIAR'S DICE", "BLUFF THE OLD MAN"], ["shell", "SHELL GAME", "FIND THE PEARL"]);
HUBS.machines.games.push(["pusher", "DOUBLOON PUSHER", "PUSH THEM OFF"]);
Object.assign(GAME_OPEN, {
  compass: () => { crOpen(); openOverlay("compass"); }, liar: () => { ldOpen(); openOverlay("liar"); },
  shell: () => { sgOpen(); openOverlay("shell"); }, pusher: () => { dpOpen(); openOverlay("pusher"); },
});
Object.assign(STAKE_REF, { compass: () => [CZ.cr, "bet"], liar: () => [CZ.ld, "bet"], shell: () => [CZ.sg, "bet"], pusher: () => [CZ.dp, "bet"] });

function casinoTick(dt) { snapTick(dt); caTick(dt); rdTick(dt); whTick(dt); nhTick(dt); cupTick(dt); crTick(dt); ldTick(dt); sgTick(dt); dpTick(dt); roundsAnnounce(); }

window.CASINO = { rdLine, DECOR, get DECOR_LIST() { return decorList(); }, DECOR_ALL, jpPot, jpLast, jpWin, JP_ODDS, JP_CAP, cupData, cupDeck, cupEnter, cupDeal, cupHit, cupStand, cupTick, cupNext, cupBoard, cupClaim, CUP_HANDS, decorData, decorDraw, decorBar, buyRound, roundsToday, ROUND_PRICE, tdMult, tdStart, tdPick, tdCash, NH_FISH, NH_PAY, nhQuick, nhToggle, nhCast, nhTick, get td() { return CZ.td; }, get nh() { return CZ.nh; }, CA_PAY, caRoll, caSettle, caTick, RD_STRIPS, rdPays, rdSpin, rdTick, WH_SEG, whSpin, whTick, get ca() { return CZ.ca; }, get rd() { return CZ.rd; }, get wh() { return CZ.wh; }, HUBS, GAME_OPEN, snapCrash, snapGo, snapCash, snapTick, bigP, bigCall, bigCash, bigDeal, BF_POOL, LOCKER, DEALER, czIdx, czOwn, czBuy, dealerStock, dealerWeek, dealerDaysLeft, DEALER_ORDER, CZ, czShopHits, get snap() { return CZ.snap; }, get big() { return CZ.big; } };
