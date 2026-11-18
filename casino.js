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
function casinoOpen(id) {
  if (id === "locker") { TAV.lkSay = null; openOverlay("locker"); }
  else if (id === "dealer") { TAV.dlSay = null; CZ.dl.tab = 0; CZ.dl.sel = 0; openOverlay("dealer"); }
}
window.CASINO = { LOCKER, DEALER, czIdx, czOwn, czBuy, dealerStock, dealerWeek, dealerDaysLeft, DEALER_ORDER, CZ, czShopHits };
