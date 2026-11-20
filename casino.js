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
  return g0.map((gm, k) => L.w ? [gm[0], L.X + (k % 2) * 178, 30 + Math.floor(k / 2) * 34, 170, 28, k] : [gm[0], L.X + 8, 26 + k * 25, 104, 22, k]);
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

function casinoTick(dt) { snapTick(dt); caTick(dt); rdTick(dt); whTick(dt); nhTick(dt); cupTick(dt); roundsAnnounce(); }

window.CASINO = { rdLine, DECOR, get DECOR_LIST() { return decorList(); }, DECOR_ALL, jpPot, jpLast, jpWin, JP_ODDS, JP_CAP, cupData, cupDeck, cupEnter, cupDeal, cupHit, cupStand, cupTick, cupNext, cupBoard, cupClaim, CUP_HANDS, decorData, decorDraw, decorBar, buyRound, roundsToday, ROUND_PRICE, tdMult, tdStart, tdPick, tdCash, NH_FISH, NH_PAY, nhQuick, nhToggle, nhCast, nhTick, get td() { return CZ.td; }, get nh() { return CZ.nh; }, CA_PAY, caRoll, caSettle, caTick, RD_STRIPS, rdPays, rdSpin, rdTick, WH_SEG, whSpin, whTick, get ca() { return CZ.ca; }, get rd() { return CZ.rd; }, get wh() { return CZ.wh; }, HUBS, GAME_OPEN, snapCrash, snapGo, snapCash, snapTick, bigP, bigCall, bigCash, bigDeal, BF_POOL, LOCKER, DEALER, czIdx, czOwn, czBuy, dealerStock, dealerWeek, dealerDaysLeft, DEALER_ORDER, CZ, czShopHits, get snap() { return CZ.snap; }, get big() { return CZ.big; } };
