/* REEL DEEP - browser edition.
   Pick a lure, drop the hook, dodge what you don't want, keep three fish.
   Drag (or A / D / arrow keys) to steer, tap PULSE (or Shift) to scatter fish,
   tap on green to land trophies and legendaries. */
"use strict";

const LH = 200, M = 6, UW = 120;                       // the screen is always 200 tall; menus are laid out 120 wide
const WW = DATA.waterW, BG_O = (WW - UW) / 2;          // the ocean picture is 480 wide, with the classic strip in its middle
let LW = UW, OX = 0;                                   // how wide the ocean is on this screen, and where the 120-wide menu column starts
const C = DATA.consts, SPECIES = DATA.species, ZONES = DATA.zones, LURES = DATA.lures;
const SPEC = {};
SPECIES.forEach(s => { SPEC[s[0]] = s; });           // [id, name, zone, [min lb, max lb], speed, pool weight, time of day, legendary]
const DEPTH_PX = C.MAX_M * M;
const TROPHY = "#ff6e3c", LEGEND = "#ffd246";            // trophies are red-orange, legendaries gold
const INK = "#1a1628", WHITE = "#fafaff", GOLD = "#ffd246", RED = "#f05050", CYAN = "#5ae6ff", LIME = "#82f082", ORANGE = "#ffa046", GREY = "#96a0c8";
const rgb = c => "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
const ZONE_COL = DATA.zoneCol.map(rgb);
// Zones by depth. The Coral Reef (Nov 19, 2026) was appended as zone 10, because saves, bets and tasks use zone numbers,
// but it sits between the Kelp Forest and Twilight. Anything that means "deeper" compares ZRANK, never the zone number.
const ZORD = ZONES.map((z, i) => i).sort((a, b) => ZONES[a][1] - ZONES[b][1]), ZRANK = [];
ZORD.forEach((z, r) => { ZRANK[z] = r; });
const REEF_Z = 10, FLOOR_Z = ZORD[ZORD.length - 1];
const zoneStep = (z, d) => ZORD[(ZRANK[z] + d + ZORD.length) % ZORD.length];   // the next (d = 1) or previous (d = -1) zone down
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpCol = (a, b, k) => rgb([0, 1, 2].map(i => Math.round(lerp(a[i], b[i], clamp(k, 0, 1)))));

const canvas = document.getElementById("game");
const g = canvas.getContext("2d");
g.imageSmoothingEnabled = false;
const dark = document.createElement("canvas");
dark.height = LH;
function resize() {                                    // the ocean fills whatever shape the window is, from phone portrait to widescreen
  if (S && S.state === "isle" && typeof ISLE !== "undefined" && ISLE) { isleResize(); return; }   // Driftwood Isle has its own screen (island.js)
  if (S && S.state === "siege" && typeof SG !== "undefined" && SG) { siegeResize(); return; }   // Siege of the Deep: 480x270 (siege.js)
  if (S && S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { wreckResize(); return; }   // WRECKONING: 480x270 (wreck.js)
  const a = window.innerWidth / window.innerHeight;
  LW = a >= UW / LH ? clamp(Math.round(LH * a), UW, WW) : UW;
  OX = Math.floor((LW - UW) / 2);
  canvas.width = dark.width = LW; canvas.height = LH;
  canvas.style.height = "min(100dvh, " + (100 * LH / LW) + "vw)";
  canvas.style.aspectRatio = LW + " / " + LH;
  g.imageSmoothingEnabled = false;
  if (S) S.hx = clamp(S.hx, 4, LW - 4);
}
const dg = dark.getContext("2d");
const atlas = new Image(), water = new Image();
let sil = null;                                        // the atlas as flat silhouettes, for fish not caught yet
let ghostAtlas = null;                                 // ...and as pale ghosts, for the witching hours
// The Konami code: each time it is entered, the next silly effect, for the rest of the session
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
const KON_FX = [["ducks", "RUBBER DUCKS"], ["googly", "GOOGLY EYES"], ["gameboy", "POCKET GREEN"], ["glasses", "COOL FISH"], ["disco", "DISCO WATER"], ["tiny", "TINY FISH"], ["mirror", "MIRROR MODE"], ["quack", "QUACK"]];
let KON = null, konBuf = [], swipeAt = null;              // the last few keys (or swipes) entered on the title screen, with the lure before each
function konamiKey(code) {                                 // -> true when this key finishes the code
  konBuf.push([code, S.lure]);
  if (konBuf.length > KONAMI.length) konBuf.shift();
  const keys = konBuf.map(k => k[0]), n = KONAMI.length;
  const typed = keys.length === n && keys.every((k, i) => k === KONAMI[i]);
  const touched = keys.length === n && keys.every((k, i) => i < n - 2 ? k === KONAMI[i] : k === "TAP");   // on a phone: eight swipes, then two taps
  if (!typed && !touched) return false;
  S.lure = konBuf[0][1]; konBuf = [];                      // the left-rights and the A don't change your lure
  const fx = KON_FX[store.sec.konami % KON_FX.length];
  KON = fx[0]; store.sec.konami++; saveStore();
  S.popups.push(["CODE: " + fx[1] + "!", 4.5, LIME]); play("fanfare"); S.flash = 0.25;
  findSecret("konami");
  return true;
}

// ------------------------------------------------------------------ helpers
function RNG(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: r,
    uniform: (lo, hi) => lo + (hi - lo) * r(),
    randint: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
    choice: arr => arr[Math.floor(r() * arr.length)],
    weighted(items, ws) {
      let t = r() * ws.reduce((x, y) => x + y, 0);
      for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t < 0) return items[i]; }
      return items[items.length - 1];
    },
  };
}
const rnd = (lo, hi) => lo + (hi - lo) * Math.random();

function rect(col, x, y, w, h) { g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), w, h); }
function disc(col, cx, cy, r, ctx) {
  ctx = ctx || g; ctx.fillStyle = col; cx = Math.floor(cx); cy = Math.floor(cy);
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
}
function ring(col, cx, cy, r) {
  g.fillStyle = col; cx = Math.floor(cx); cy = Math.floor(cy);
  const n = Math.max(8, Math.ceil(r * 6.3));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
}
function ell(col, x, y, w, h) {
  g.fillStyle = col;
  for (let i = 0; i < h; i++) {
    const k = (i + 0.5) / h * 2 - 1, hw = Math.sqrt(Math.max(0, 1 - k * k)) * w / 2;
    g.fillRect(Math.round(x + w / 2 - hw), Math.floor(y + i), Math.max(1, Math.round(hw * 2)), 1);
  }
}
function line(col, x0, y0, x1, y1) {
  g.fillStyle = col; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 2000; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function poly(col, pts) { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); }
function box(x, y, w, h, border) { rect(INK, x, y, w, h); g.fillStyle = border || WHITE; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }
const textW = (s, sc) => (s.length ? s.length * 6 * sc - sc : 0);
function glyphs(s, x, y, sc, col) {
  g.fillStyle = col;
  for (const ch of s) {
    const gl = DATA.glyphs[ch] || DATA.glyphs["?"];
    for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 5; rx++) if (gl[ry][rx] === "1") g.fillRect(x + rx * sc, y + ry * sc, sc, sc);
    x += 6 * sc;
  }
}
function text(s, x, y, sc, col, anchor, shadow) {
  s = String(s).toUpperCase(); sc = sc || 1;
  const w = textW(s, sc);
  const x0 = anchor === "left" ? Math.floor(x) : anchor === "right" ? Math.floor(x) - w : Math.floor(x) - (w >> 1);
  const y0 = Math.floor(y) - ((7 * sc) >> 1);
  if (shadow === undefined) shadow = INK;
  if (shadow) glyphs(s, x0 + sc, y0 + sc, sc, shadow);
  glyphs(s, x0, y0, sc, col || WHITE);
}
function sprSize(name, k) { const a = DATA.atlas[name]; return [Math.floor(a[2] * (k || 1)), Math.floor(a[3] * (k || 1))]; }
function spr(name, x, y, flip, k, img) {
  const a = DATA.atlas[name], [w, h] = sprSize(name, k);
  x = Math.floor(x); y = Math.floor(y);
  if (flip) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img || atlas, a[0], a[1], a[2], a[3], 0, 0, w, h); g.restore(); }
  else g.drawImage(img || atlas, a[0], a[1], a[2], a[3], x, y, w, h);
}

// -------------------------------------------------------------------- sound
let AC = null;
const SOUNDS = {                                       // [frequency, seconds, wave, volume, slide to, delay]
  plop: [[520, 0.16, "sine", 0.4, 160]], zap: [[1800, 0.06, "sawtooth", 0.2, 300], [120, 0.18, "square", 0.15, 60, 0.05]],
  reel: [[900, 0.02, "square", 0.06]], weigh: [[700, 0.05, "triangle", 0.3, 1000]], pulse: [[240, 0.1, "sine", 0.5, 900], [900, 0.25, "sine", 0.3, 300, 0.1]],
  hit: [[660, 0.04, "square", 0.2], [990, 0.08, "square", 0.2, 0, 0.04]], miss: [[200, 0.16, "sawtooth", 0.25, 110]], tick: [[1200, 0.02, "square", 0.12]],
  select: [[660, 0.05, "square", 0.15], [880, 0.07, "square", 0.15, 0, 0.05]], back: [[440, 0.06, "square", 0.15, 300]],
  chime: [[880, 0.08, "triangle", 0.3], [1320, 0.2, "triangle", 0.3, 0, 0.08]],
  fanfare: [[523, 0.09, "square", 0.2], [659, 0.09, "square", 0.2, 0, 0.09], [784, 0.09, "square", 0.2, 0, 0.18], [1047, 0.3, "square", 0.2, 0, 0.27]],
  thunder: [[70, 0.6, "sawtooth", 0.25, 40]],
  growl: [[90, 0.45, "sawtooth", 0.22, 60], [70, 0.4, "square", 0.1, 50, 0.1]], lunge: [[180, 0.18, "sawtooth", 0.25, 520]],   // a Flipside hunter sees you, then comes
};
function play(name, vol) {
  if (!AC || !SOUNDS[name]) return;
  for (const [f, dur, wave, v, slide, delay] of SOUNDS[name]) {
    const o = AC.createOscillator(), ga = AC.createGain(), t0 = AC.currentTime + (delay || 0);
    o.type = wave; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    ga.gain.setValueAtTime(v * (vol || 1) * 0.6, t0); ga.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(ga); ga.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
}
function catchSound(n) {
  if (KON === "quack") { SOUNDS.c = [[620, 0.07, "sawtooth", 0.25, 380], [560, 0.12, "sawtooth", 0.2, 300, 0.07]]; play("c"); return; } const f = [392, 440, 494, 523, 587, 659][Math.min(5, n)]; SOUNDS.c = [[f, 0.05, "triangle", 0.35], [f * 1.5, 0.12, "triangle", 0.3, 0, 0.05]]; play("c"); }

// --------------------------------------------------------------- saved data
let store = { log: {}, best: 0, name: "", lure: 0, coins: 0, seenHelp: false, mythic: 0, titles: ["rookie"],
  own: { char: [0], hat: [0], boat: [0], hook: [0], line: [0], trail: [0], flair: [0], pet: [0], flag: [0] },
  eq: { char: 0, hat: 0, boat: 0, hook: 0, line: 0, trail: 0, flair: 0, pet: 0, flag: 0, title: "rookie", mon: 0, mpet: 0, mhat: 0 }, tasks: null,   // mon/mpet/mhat: wear the monster forms
  dives: 0,                                              // dives finished, for things that open up with experience
  sec: { found: [], bottles: [], lastBottle: 0, konami: 0, mark: true, woke: false, sleeper: false, crack: false, crossed: false, beat: false, afterSleeper: 0 },
  flip: { log: {}, runs: 0, wins: 0, best: 0, mons: [] },   // the Flipside: creatures caught (for the Bestiary), trips made, best score, monster forms caught
  tav: { chips: 0, daily: "", claims: 0, bet: null, hist: [], fish: null, jukebox: false, songs: [], song: -1, stories: 0, magnet: 0, map: "", rumours: 0, carved: "", bhw: { d: "", line: 0 }, blife: [], spent: 0, decor: { own: [], eq: {} }, round: "", rounds: 0, jpLast: 0, jpWon: 0, cup: null, cupClaim: 0,
    stats: { stack: 0, win: 0, fast: 0, hands: 0, derbies: 0 }, posted: {}, postedAt: 0, names: {},
    fp: { cups: {}, best: {}, own: [], eq: {}, races: 0, wins: 0 } },   // the Rusty Hook; fp: FIN PRIX (finprix.js, fpData())
  ach: { sharks: 0, bit: 0, rel: 0, stung: 0, ghosts: 0, bounty: 0, bday: "" },
  isle: { planks: 0, rope: 0, sail: 0, compass: 0, built: 0, met: 0 } };   // Driftwood Isle (island.js): the raft so far   // counters for titles (Nov 18, 2026): sharks caught, fish lost to sharks, fish released, stings, ghosts caught, bounty days
try {
  const old = JSON.parse(localStorage.getItem("reeldeep") || "{}");
  store = Object.assign(store, old, { own: Object.assign(store.own, old.own || {}), eq: Object.assign(store.eq, old.eq || {}), sec: Object.assign(store.sec, old.sec || {}), tav: Object.assign(store.tav, old.tav || {}), flip: Object.assign(store.flip, old.flip || {}), ach: Object.assign(store.ach, old.ach || {}), isle: Object.assign(store.isle, old.isle || {}) });
  store.tav.stats = Object.assign({ stack: 0, win: 0, fast: 0, hands: 0, derbies: 0 }, store.tav.stats);
  if (!old.dives) store.dives = Math.max(store.dives || 0, Math.floor(Object.values(store.log).reduce((a, e) => a + (e.n || 0), 0) / 3));   // dives from before they were counted, roughly
} catch (e) { /* private window: play without saving */ }
function saveStore() { try { localStorage.setItem("reeldeep", JSON.stringify(store)); } catch (e) { /* ignore */ } }
const SHARKS = ["blacktip", "leopard", "mako", "hammer", "goblin", "lshark", "sleeper", "frill", "megalodon", "whitetip", "nurse"];   // touch one anywhere but its back half and it bites
const HIDDEN = ["poop", "gboot", "werewolf", "lucky"];                // the mythic and the secret catches never show in the log
const LOGGED = SPECIES.filter(s => !HIDDEN.includes(s[0]));

// ------------------------------------------------------------------ secrets
// Secret rewards live on the Secrets page only, never in the shop. They are appended past the shop's items:
const SHOP_N = { flag: 12, flair: 20, boat: 18, line: 14, hat: 26, pet: 14, trail: 12, hook: 14 };   // how many of each list the shop sells; anything after is a secret or Bestiary reward
// [id, name, what it was, reward: [kind, index] or ["title", id] or null]
const SECRETS = [
  ["bottle", "MESSAGE IN A BOTTLE", "FISHED A BOTTLE OUT OF THE SEA", ["flag", 12]],
  ["gboot", "GOLDEN BOOT", "FOUND THE LOST GOLD BOOT", ["flag", 13]],
  ["konami", "THE CODE", "UP UP DOWN DOWN...", ["flair", 20]],
  ["eclipse", "ECLIPSE", "WORE OUT THE SKY", ["flag", 14]],
  ["poke", "MAN OVERBOARD", "POKED YOUR SAILOR TOO MUCH", ["title", "soggy"]],
  ["mythic", "THE UNLOGGED FISH", "CAUGHT THE BROWN TROUT", ["title", "mythic"]],
  ["baiter", "THE RECIPE", "MINNOW, SQUID, SHRIMP", ["title", "baiter"]],
  ["friday", "FRIDAY 4:59", "THE FISH PARTIED EARLY", null],
  ["ghost", "THE WITCHING HOURS", "MET THE GHOST FISH", null],
  ["werewolf", "FULL MOON", "MET THE WEREWOLF FISH", null],
  ["thanks", "THANKSGIVING", "FISH IN THEIR FEATHERS", null],
  ["xmas", "DECEMBER", "SANTA HATS AND SNOW", null],
  ["newyear", "NEW YEAR", "FIREWORKS OVER THE BOAT", null],
  ["valentine", "VALENTINE'S DAY", "FISH IN PAIRS", null],
  ["stpat", "ST. PATRICK'S DAY", "MET THE LUCKY GOLDFISH", null],
  ["fools", "APRIL FOOLS", "EVERYTHING BACKWARDS", null],
  ["july4", "FOURTH OF JULY", "FIREWORKS OVER THE BOAT", null],
  ["october", "OCTOBER", "PUMPKINS AND GHOSTS", null],
  ["sleeper", "THE THING BELOW", "WOKE UP THE SLEEPER", null],
  ["crossing", "THE OTHER YOU", "CAUGHT YOURSELF", ["mark", 0]],
];
function findSecret(id) {                                  // -> true the first time; puts a note on screen and gives the reward
  if (store.sec.found.includes(id)) return false;
  const s = SECRETS.find(q => q[0] === id);
  if (!s) return false;
  store.sec.found.push(id);
  const rw = s[3];
  if (rw && rw[0] === "mark") { /* a setting, not an item */ }
  else if (rw && rw[0] === "title") award(rw[1]);
  else if (rw && !store.own[rw[0]].includes(rw[1])) store.own[rw[0]].push(rw[1]);
  saveStore();
  if (S) { S.popups.push(["SECRET FOUND!", 3.2, "#c8a0ff"]); play("fanfare"); }
  return true;
}

// Messages in bottles: notes from a lost angler. [text, when it can turn up]
const BOTTLES = [
  ["I LOST A GOLD BOOT DOWN BY THE WRECK. FINDERS KEEPERS.", "any"],
  ["THE SUN GETS TIRED IF YOU POKE IT TEN TIMES. SO DOES THE MOON.", "any"],
  ["YOUR LITTLE SAILOR HAS A TEMPER. TEN POKES AND SPLASH.", "any"],
  ["UP UP DOWN DOWN... I FORGET THE REST. THE DUCKS REMEMBER.", "any"],
  ["AT 4:59 ON A FRIDAY THE FISH START CELEBRATING EARLY.", "any"],
  ["AFTER MIDNIGHT, NOT EVERY FISH IS ALIVE.", "any"],
  ["WHEN THE MOON IS FULL, ONE FISH GROWS FUR.", "any"],
  ["MINNOW, SQUID, SHRIMP. EVERY GOOD ANGLER KNOWS THE RECIPE.", "any"],
  ["THERE IS A FISH NO LOG WILL ADMIT TO. YOU WILL SMELL IT FIRST.", "any"],
  ["SOMETHING SLEEPS UNDER THE FLOOR. IT ONLY WAKES FOR AN EMPTY HOOK.", "any"],
  ["THE BIG EYE HATES BEING PULSED. KNOCK AND RUN.", "any"],
  ["THE FLOOR IS NOT THE BOTTOM. IT NEVER WAS.", "sleeper"],
  ["WHEN THE SLEEPER FALLS, LOOK TO THE EDGE OF THE FLOOR. A HAIRLINE CRACK.", "stuck"],
  ["THE CRACK ONLY OPENS FOR A LIGHT. BRING THE GLOW AND KNOCK.", "sleeper"],
  ["DOWN THERE, DOWN IS UP. KEEP FALLING UNTIL YOU MEET YOURSELF.", "crossed"],
  ["I SAW MYSELF ON THE OTHER SIDE. HE WAS SMILING. I WASN'T.", "beat"],
];
function bottleOpen(i) {                                   // can bottle i turn up for this player yet?
  const w = BOTTLES[i][1], q = store.sec;
  return w === "any" || (w === "sleeper" && q.sleeper) || (w === "stuck" && q.sleeper && !q.crack && q.afterSleeper >= 10)
    || (w === "crossed" && q.crossed && !q.beat) || (w === "beat" && q.beat) || (w === "leak" && typeof siegeLeakBottle === "function" && siegeLeakBottle());
}
function pickBottle(rng) {                                 // a bottle not found yet if there is one, else any open one but the last
  const open = BOTTLES.map((b, i) => i).filter(bottleOpen);
  const fresh = open.filter(i => !store.sec.bottles.includes(i));
  const pool = fresh.length ? fresh : open.filter(i => i !== store.sec.lastBottle);
  return pool.length ? rng.choice(pool) : -1;
}
function wrap(txt, n) {                                    // break text into lines of up to n characters
  const out = [];
  let line = "";
  for (const w of txt.split(" ")) { if (line && (line + " " + w).length > n) { out.push(line); line = w; } else line = line ? line + " " + w : w; }
  if (line) out.push(line);
  return out;
}

// Time and date events, from the player's own clock. Topside only.
function moonPhase(ms) { const p = ((ms - 947182440000) / 86400000 / 29.530588853) % 1; return p < 0 ? p + 1 : p; }   // 0 new, 0.5 full
function events(now) {
  now = now || new Date();
  const mo = now.getMonth() + 1, d = now.getDate(), h = now.getHours(), mi = now.getMinutes(), wd = now.getDay(), ev = {};
  if (wd === 5 && h === 16 && mi === 59) ev.friday = true;
  if (h < 4) ev.ghost = true;
  if (Math.abs(moonPhase(now.getTime()) - 0.5) < 0.034) ev.fullmoon = true;
  if (mo === 11) {                                       // Thanksgiving week: Monday to Sunday around the fourth Thursday
    const thu = 1 + (4 - new Date(now.getFullYear(), 10, 1).getDay() + 7) % 7 + 21;
    if (d >= thu - 3 && d <= thu + 3) ev.thanks = true;
  }
  if (mo === 12) ev.xmas = true;
  if ((mo === 12 && d === 31) || (mo === 1 && d === 1)) ev.newyear = true;
  if (mo === 2 && d === 14) ev.valentine = true;
  if (mo === 3 && d === 17) ev.stpat = true;
  if (mo === 4 && d === 1) ev.fools = true;
  if (mo === 7 && d === 4) ev.july4 = true;
  if (mo === 10) ev.october = true;
  return ev;
}
let EV = events(), evAt = 0;                               // re-checked every few seconds

// Everything you can buy is for looks only. [name, price] per item; index 0 of each kind is the free default.
// Line colours: a plain colour, or "@name" for an animated one (see lineCol).
const LINES = [["WHITE LINE", 0, "#ecf0fa"], ["CYAN LINE", 400, "#5ae6ff"], ["PINK LINE", 400, "#ff8cd2"], ["LIME LINE", 500, "#82f082"], ["GOLD LINE", 1500, "#ffd246"], ["RAINBOW LINE", 5000, "@rainbow"],
  ["RED LINE", 400, "#f05050"], ["ORANGE LINE", 400, "#ffa046"], ["VIOLET LINE", 500, "#b48cff"], ["SILVER LINE", 800, "#c8d2e6"], ["SHADOW LINE", 900, "#3c3450"],
  ["FIRE LINE", 3000, "@fire"], ["ICE LINE", 2500, "@ice"], ["SPARKLE LINE", 4000, "@sparkle"],
  ["BILE LINE", 0, "@bile"], ["VEIN LINE", 0, "@vein"],         // Bestiary rewards, never sold
  ["CHIP LINE", 0, "@chip"],                                     // the Rusty Hook's, for chips
  ["JACKPOT LINE", 0, "@jackpot"], ["DICE LINE", 0, "@dice"],     // the Rusty Hook's Jackpot and High Stakes sets (Nov 18, 2026)
  ["LANTERN LINE", 0, "@lantern"], ["PEARL LINE", 0, "@pearl"],   // the Captain's Locker (casino.js)
  ["MIDNIGHT LINE", 0, "#283c8c"], ["COPPER LINE", 0, "#d2783c"], ["SEAWEED LINE", 0, "@kelp"]];   // the Shady Dealer
const TRAILS = [["BUBBLES", 0, ["#c8ecff"]], ["GOLD DUST", 1000, ["#ffd246", "#fff0a0"]], ["PINK FIZZ", 1000, ["#ff8cd2", "#ffd2f0"]], ["EMBERS", 1500, ["#ff965a", "#ffdc5a"]],
  ["STARDUST", 2000, ["#ffffff", "#5ae6ff", "#c8a0ff"]], ["RAINBOW FIZZ", 4000, ["#f05050", "#ffa046", "#ffd246", "#82f082", "#5ae6ff", "#c8a0ff"]],
  ["TOXIC", 1200, ["#82f082", "#c8ff5a", "#46c846"]], ["DEEP BLUE", 1000, ["#3c78ff", "#5ae6ff"]], ["CANDY", 1500, ["#ff8cd2", "#ffffff", "#5ae6ff"]],
  ["SHADOW", 1500, ["#3c3450", "#6e5a96"]], ["CONFETTI", 3000, ["#f05050", "#ffd246", "#5ae6ff", "#82f082", "#ff8cd2"]], ["GOLDEN RAIN", 5000, ["#ffd246", "#ffffff", "#ffb428"]],
  ["CHIP SPRAY", 0, ["#f05050", "#fafaff", "#ffd246"]],           // the Rusty Hook's, for chips
  ["CHERRY FIZZ", 0, ["#e63246", "#ff6e78", "#46c846", "#ffd246"]], ["TUMBLING DICE", 0, ["#fafaff", "#ffffff", "#e63246"]],   // Jackpot and High Stakes sets
  ["DOUBLOONS", 0, ["#ffc832", "#c88c1e", "#fff6c8"]], ["EMERALDS", 0, ["#46e68c", "#a0ffc8", "#1e9650"]],   // the Captain's Locker
  ["SEA FOAM", 0, ["#e6fff6", "#a0f0dc", "#ffffff"]], ["INK CLOUD", 0, ["#3c2850", "#6e5a96", "#14101e"]]];   // the Shady Dealer
const PRICE_CAP = 5000;                                  // Nov 18, 2026: nothing costs more than this (was up to 8,000)
const price = (names, list) => names.map((n, i) => [n, Math.min(PRICE_CAP, list[i])]);
// Prices are set so the good stuff takes weeks of regular play, not an afternoon.
const SHOP = [
  ["CHARACTER", "char", price(DATA.chars, [0, 500, 500, 1200, 1500, 1800, 1200, 1000, 2000, 1500, 1800, 1800, 6000, 4000, 3500, 2500, 2500, 3000, 4500, 3000, 6000, 5000])],
  ["HAT", "hat", price(DATA.hats.slice(0, SHOP_N.hat), [0, 300, 800, 4000, 1500, 400, 1000, 800, 3000, 2500, 500, 2000, 1000, 1800, 600, 1200, 900, 1500, 1800, 1200, 1400, 2500, 3500, 1400, 2200, 7500])],
  ["BOAT", "boat", price(DATA.boats.slice(0, SHOP_N.boat), [0, 700, 700, 1000, 1800, 1500, 4000, 8000, 1500, 1500, 3000, 2500, 5000, 3500, 4000, 3000, 2000, 4500])],
  ["PET", "pet", price(DATA.pets.slice(0, SHOP_N.pet), [0, 1500, 1500, 2500, 2500, 3000, 3000, 2000, 2500, 5000, 1800, 7000, 6000, 4500])],
  ["FLAG", "flag", price(DATA.flags.slice(0, SHOP_N.flag), [0, 600, 1500, 1200, 1500, 3000, 1500, 2000, 2500, 2000, 1500, 4000])],
  ["HOOK", "hook", price(DATA.hooks.slice(0, SHOP_N.hook), [0, 1200, 900, 1500, 1100, 1800, 2500, 1500, 5000, 3000, 2000, 2500, 1500, 3500])],
  ["LINE", "line", LINES.slice(0, SHOP_N.line).map(l => [l[0], l[1]])],
  ["BUBBLE TRAIL", "trail", TRAILS.slice(0, SHOP_N.trail).map(l => [l[0], l[1]])],
  ["FISH FLAIR", "flair", price(DATA.flair.slice(0, SHOP_N.flair), [0, 1200, 1500, 4000, 1000, 2000, 1800, 3000, 2500, 1200, 1500, 1000, 2000, 1200, 1800, 1500, 3500, 2500, 2000, 6000])],
];
// Titles are earned, never bought. [id, name, how to get it (null = a secret)]
const ZONE_TITLES = ["BEACH BUM", "KELP KEEPER", "TWILIGHT RANGER", "WRECK DIVER", "ABYSS WALKER", "CRYSTAL SEER", "VENT WARDEN", "BONE COLLECTOR", "TRENCH RAT", "FLOOR MANAGER", "REEF RAIDER"];
const TITLES = [["rookie", "ROOKIE", "WHERE EVERYONE STARTS"]]
  .concat(ZONES.slice(0, 10).map((z, i) => ["zone" + i, ZONE_TITLES[i], "LOG ALL OF " + z[0]]))
  .concat([["floor", "BOTTOM FEEDER", "TOUCH THE SEA FLOOR"], ["legends", "LEGEND HUNTER", "LOG EVERY LEGENDARY"], ["trophies", "TROPHY ROOM", "A TROPHY OF EVERY FISH"],
    ["all", "COMPLETIONIST", "LOG EVERY SPECIES"], ["baiter", "BAIT MASTER", null], ["mythic", "HOLY CRAP", null], ["soggy", "SOGGY", null],
    ["roller", "HIGH ROLLER", "1,000 TAVERN CHIPS"], ["shark", "CARD SHARK", "WIN 25 HANDS OF 21"], ["derbyking", "DERBY KING", "WIN 10 DERBY BETS"],
    ["longshot", "LONG SHOT", "WIN A X8 DIVE BET"], ["regular", "REGULAR", "TAKE FREE CHIPS 14 DAYS"],
    ["wakeup", "WAKE-UP CALL", "BEAT THE SLEEPER"], ["otherside", "THE OTHER SIDE", "BEAT THE GAME"]])
  .concat(["GAP KEEPER", "TOOTH FAIRY", "MARROW MINER", "BLISTER POPPER", "EYE SPY", "LAMPLIGHTER", "GHOST DECKHAND", "SHADOW BOXER", "KNOT TIER", "MIRROR MIRROR"]
    .map((n, i) => ["fzone" + i, n, "FILL " + DATA.flip.zones[i][0]]))
  .concat([["flegends", "MONSTER HUNTER", "EVERY FLIPSIDE LEGENDARY"], ["bestiary", "BESTIARY KEEPER", "FILL THE BESTIARY"], ["allofme", "ALL OF ME", "ALL 22 MONSTER FORMS"]])
  .concat([["pegleg", "PEG LEG", "HIT X25 IN PLINKO"], ["calledit", "CALLED IT", "HIT A DERBY TRIFECTA"]])
  .concat([["jaws", "JAWS", "CATCH ALL 11 SHARKS"], ["tailgater", "TAILGATER", "CATCH 25 SHARKS"], ["sharkbait", "SHARK BAIT", "LOSE 10 FISH TO SHARKS"],   // Nov 18, 2026
    ["release", "CATCH AND RELEASE", "LET 50 FISH GO"], ["hattrick", "HAT TRICK", "3 TROPHIES ON ONE HOOK"], ["maxed", "MAXED OUT", "HIT THE X5 BONUS CAP"],
    ["heavy", "HEAVYWEIGHT", "A 1,000 LB HAUL"], ["emptyhand", "EMPTY HANDED", "TOUCH FLOOR, EMPTY HOOK"], ["bountyhunter", "BOUNTY HUNTER", "BOUNTY FISH ON 7 DAYS"],
    ["jellylegs", "JELLY LEGS", "GET STUNG 25 TIMES"], ["lifer", "LIFER", "FINISH 500 DIVES"], ["nightowl", "NIGHT OWL", "CATCH 10 GHOST FISH"],
    ["topdog", "TOP DOG", "#1 ON THE DAILY BOARD"], ["jackpot", "JACKPOT", "X100 ON A SCRATCH CARD"], ["photo", "PHOTO FINISH", "WIN ON A PHOTO FINISH"]])
  .concat([["minnowcup", "MINNOW CHAMP", "FIN PRIX: MINNOW CUP GOLD"], ["reefcup", "REEF CHAMP", "FIN PRIX: REEF CUP GOLD"], ["deepcup", "DEEP CHAMP", "FIN PRIX: DEEP CUP GOLD"],   // FIN PRIX, Nov 18, 2026
    ["abysscup", "ABYSS CHAMP", null], ["finlegend", "FIN PRIX LEGEND", "GOLD IN EVERY CUP"]])
  .concat([["castaway", "CASTAWAY", "BUILD THE RAFT"]])                 // Driftwood Isle (island.js)
  .concat([["whale", "WHALE", "SPEND 100,000 CHIPS"], ["captain", "THE CAPTAIN", "OWN THE WHOLE LOCKER"]])   // casino.js, Nov 18, 2026
  .concat([["snaphappy", "SNAP HAPPY", "CASH OUT X50 IN LINE SNAP"], ["biggerfish", "BIGGER FISH", "10 RIGHT CALLS IN A ROW"]])
  .concat([["anchors", "ANCHORS AWEIGH", "ROLL THREE ANCHORS"], ["reeldeal", "THE REEL DEAL", "THREE LEGENDS ON THE REELS"], ["helmsman", "HELMSMAN", "HIT X10 ON THE WHEEL"]])
  .concat([["treasure", "TREASURE HUNTER", "5 CRATES PAST 10 JELLIES"], ["fullnet", "FULL NET", "ALL 5 IN NET HAUL"]])
  .concat([["onthehouse", "ON THE HOUSE", "BUY 10 ROUNDS"]])
  .concat([["megajack", "MEGA JACKPOT", "HIT THE REEL DEAL JACKPOT"], ["tablechamp", "TABLE CHAMP", "WIN A WEEKLY TOURNAMENT"], ["podium", "PODIUM", "TOP 3 IN A TOURNAMENT"]])
  .concat([["zone" + REEF_Z, ZONE_TITLES[REEF_Z], "LOG ALL OF " + ZONES[REEF_Z][0]]]);   // the Coral Reef, Nov 19, 2026
const FLIP_TITLES = TITLES.filter(t => /^fzone|^flegends$|^bestiary$|^allofme$/.test(t[0])).map(t => t[0]);   // these live in the Bestiary, not the shop
const SHOP_TITLE_IDS = TITLES.map((t, i) => i).filter(i => TITLES[i][0] !== "soggy" && !FLIP_TITLES.includes(TITLES[i][0]));   // SOGGY is a secret reward and lives on the Secrets page
const titleName = id => (TITLES.find(t => t[0] === id) || TITLES[0])[1];
function award(id) { if (store.titles.includes(id)) return false; store.titles.push(id); return true; }
function checkTitles(dive) {                               // -> names of titles earned just now
  const got = [], has = s => store.log[s[0]];
  const tryFor = (id, ok) => { if (ok && award(id)) got.push(titleName(id)); };
  ZONES.forEach((z, i) => tryFor("zone" + i, LOGGED.filter(s => s[2] === i).every(has)));
  tryFor("floor", dive.bottom);
  tryFor("legends", LOGGED.filter(s => s[7]).every(has));
  tryFor("trophies", LOGGED.filter(s => !s[7] && s[4] > 0).every(s => has(s) && has(s).star));
  tryFor("all", LOGGED.every(has));
  const ids = dive.catch.map(c => c[0]);
  tryFor("baiter", ["minnow", "squid", "shrimp"].every(b => ids.includes(b)));      // three classic baits on one hook
  tryFor("mythic", ids.includes("poop"));
  const A = store.ach;
  tryFor("jaws", SHARKS.every(id => store.log[id]));
  tryFor("tailgater", A.sharks >= 25);
  tryFor("sharkbait", A.bit >= 10);
  tryFor("release", A.rel >= 50);
  tryFor("hattrick", dive.catch.length === 3 && dive.catch.every(c => c[2]));
  tryFor("maxed", dive.mult >= 5);
  tryFor("heavy", dive.base >= 1000);
  tryFor("emptyhand", !!dive.emptyFloor);
  tryFor("bountyhunter", A.bounty >= 7);
  tryFor("jellylegs", A.stung >= 25);
  tryFor("lifer", store.dives + 1 >= 500);                   // counted before this dive is added
  tryFor("nightowl", A.ghosts >= 10);
  return got;
}

// Daily and weekly tasks: the same for everyone, paid in coins.
const weekString = () => { const d = new Date(), a = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + "-W" + Math.ceil(((d - a) / 86400000 + a.getDay() + 1) / 7); };
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function makeTasks(key, weekly) {
  const r = RNG(hashStr(key));
  const pool = weekly
    ? [["floor", 0, 3, 150], ["legend", 0, 3, 150], ["species", 0, 40, 120], ["weight", 0, 6000, 120], ["trophy", 0, 8, 130], ["zone", 8, 10, 140], ["zone", 7, 12, 120]]
    : [["zone", r.randint(3, 8), 6, 25], ["trophy", 0, 2, 30], ["depth", r.choice([600, 750, 900, 1000]), 0, 25], ["score", r.choice([300, 450, 600]), 0, 30],
       ["bounty", 0, 2, 20], ["set", 0, 1, 25], ["fish", 0, 15, 15]];
  const out = [];
  for (let n = weekly ? 2 : 3; n > 0; n--) { const t = pool.splice(Math.floor(r.random() * pool.length), 1)[0]; out.push({ k: t[0], a: t[1], n: t[2] || t[1], p: 0, r: t[3], done: false, seen: [] }); }
  return out;
}
function tasks() {                                         // today's and this week's, made fresh when the date rolls over
  const day = dayString(), wk = weekString();
  if (!store.tasks || store.tasks.v !== 2) store.tasks = { v: 2 };          // v2: harder tasks, smaller rewards
  if (store.tasks.day !== day) { store.tasks.day = day; store.tasks.d = makeTasks("d" + day, false); }
  if (store.tasks.week !== wk) { store.tasks.week = wk; store.tasks.w = makeTasks("w" + wk, true); }
  return store.tasks;
}
function taskText(t) {
  const zs = ["SHALLOWS", "KELP", "TWILIGHT", "WRECK", "ABYSS", "CAVES", "VENTS", "BONE YARD", "TRENCH", "FLOOR", "REEF"];
  return { zone: t.n + " " + zs[t.a] + " FISH", trophy: t.n > 1 ? "LAND " + t.n + " TROPHIES" : "LAND A TROPHY", depth: "DIVE TO " + t.a + " M", score: "ONE DIVE: " + t.a + " LB",
    bounty: "CATCH " + t.n + " BOUNTY FISH", set: "SET BONUS X2 OR MORE", fish: "CATCH " + t.n + " FISH", floor: t.n > 1 ? "FLOOR " + t.n + " TIMES" : "TOUCH THE FLOOR", legend: t.n > 1 ? "LAND " + t.n + " LEGENDS" : "LAND A LEGENDARY", species: "CATCH " + t.n + " SPECIES",
    weight: "HAUL " + t.n + " LB", }[t.k];
}
function progressTasks(dive) {                             // -> [text, coins] for each task finished by this dive
  const T_ = tasks(), done = [];
  for (const t of T_.d.concat(T_.w)) {
    if (t.done) continue;
    const ids = dive.catch.map(c => c[0]);
    if (t.k === "zone") t.p += ids.filter(i => SPEC[i][2] === t.a).length;
    else if (t.k === "trophy") t.p += dive.catch.filter(c => c[2]).length;
    else if (t.k === "depth") t.p = Math.max(t.p, Math.min(t.n, Math.floor(dive.reached)));
    else if (t.k === "score") t.p = Math.max(t.p, Math.min(t.n, dive.total));
    else if (t.k === "bounty") t.p += ids.filter(i => i === dive.bounty).length;
    else if (t.k === "set") t.p += dive.mult >= 2 ? 1 : 0;
    else if (t.k === "fish") t.p += ids.length;
    else if (t.k === "floor") t.p += dive.bottom ? 1 : 0;
    else if (t.k === "legend") t.p += ids.filter(i => SPEC[i][7]).length;
    else if (t.k === "species") { ids.forEach(i => { if (!t.seen.includes(i)) t.seen.push(i); }); t.p = t.seen.length; }
    else if (t.k === "weight") t.p += dive.total;
    if (t.p >= t.n) { t.p = t.n; t.done = true; store.coins += t.r; done.push([taskText(t), t.r]); }
  }
  return done;
}
function dayString(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function timeOfDay() { const h = new Date().getHours(); return h >= 5 && h < 11 ? "MORNING" : h >= 11 && h < 17 ? "DAY" : h >= 17 && h < 21 ? "DUSK" : "NIGHT"; }
function todaysBounty() {                              // one ordinary species is worth triple today, the same one for everybody
  const d = new Date(), n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const reef = n >= 20261120;                          // reef fish join the pool from Nov 20, 2026, so the day it went live kept its bounty
  const pool = SPECIES.filter(s => !s[7] && s[6] === null && s[4] > 0 && (s[2] <= 6 || (reef && s[2] === REEF_Z)) && s[5] >= 2 && !SHARKS.includes(s[0])).map(s => s[0]);   // sharks are left out so adding them didn't change the bounty
  return RNG(n * 7 + 1).choice(pool);
}
// The weather follows the clock, the same for everybody, so refreshing can't reroll it. Storms were whole clock hours,
// which meant a lunch-break session could be all storm (Kade, Nov 17, 2026). Now each 15 minutes is stormy about 1 time in
// 7, never two spells in a row: about 13% of the time, as before, in short bursts.
const STORM_MS = 15 * 60000, STORM_P = 0.15;
const stormBlock = b => RNG(b * 2654435761 + 17).random() < STORM_P;
function stormNow(ms) { const b = Math.floor((ms || Date.now()) / STORM_MS); return stormBlock(b) && !stormBlock(b - 1); }
function zoneOf(m) { for (const i of ZORD) if (m < ZONES[i][2]) return i; return FLOOR_Z; }

// ------------------------------------------------------------- leaderboard
const LB = {                                             // two lists in the database: /daily/<date> and /all, each entry {n, s, t, h, ti}
  url: (typeof LEADERBOARD_URL === "string" ? LEADERBOARD_URL : "").trim().replace(/\/+$/, ""),
  today: null, all: null, ftoday: null, fall: null, status: "", note: "",     // ftoday/fall: the Flipside board, under /flip
  async top(path) {                                      // best ten; falls back to reading the whole list if the database has no index yet
    let data = null;
    try { const r = await fetch(this.url + path + '.json?orderBy=%22s%22&limitToLast=10'); if (r.ok) data = await r.json(); } catch (e) { data = null; }
    if (data === null || (data && data.error)) data = await fetch(this.url + path + ".json").then(r => r.json());
    return Object.values(data || {}).filter(e => e && typeof e.s === "number" && typeof e.n === "string").sort((x, y) => y.s - x.s).slice(0, 10);
  },
  async load() {
    if (!this.url) return;
    this.status = "LOADING...";
    try {
      [this.today, this.all] = await Promise.all([this.top("/daily/" + dayString()), this.top("/all")]); this.status = "";
      if (store.sec.beat) [this.ftoday, this.fall] = await Promise.all([this.top("/flip/daily/" + dayString()), this.top("/flip/all")]);
    }
    catch (e) { this.status = "CAN'T REACH THE SCORES"; }
  },
  async submit(name, score, haul, title, pre) {               // pre: "/flip" for the Flipside board
    if (!this.url || !name || score <= 0) return;
    const body = JSON.stringify(Object.assign({ n: name, s: score, t: Date.now(), h: haul, ti: title }, store.sec.beat && store.sec.mark !== false ? { m: 1 } : {}));   // m: has beaten the game
    const post = path => fetch(this.url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    try {
      const [a, b] = await Promise.all([post((pre || "") + "/daily/" + dayString() + ".json"), post((pre || "") + "/all.json")]);
      this.note = a.ok && b.ok ? "" : "UPDATE THE DATABASE RULES";
    } catch (e) { this.status = "CAN'T REACH THE SCORES"; return; }
    await this.load();
    const top = !pre && this.today && this.today[0];
    if (top && top.n === name && top.s === score && award("topdog")) { saveStore(); if (S) S.popups.push(["NEW TITLE: TOP DOG", 5, GOLD]); }
  },
};
function packHaul(h, bottom) { return h.rows.map(r => r[0] + ":" + r[1] + (r[3] ? ":T" : "")).join(",") + "|" + h.mult + "|" + (bottom ? 1 : 0); }
function unpackFlipHaul(s) {                               // a Flipside board entry's catch: "id:lb[:T],...|mult"
  if (typeof s !== "string") return null;
  const [fish, mult] = s.split("|");
  return { fish: fish ? fish.split(",").map(f => f.split(":")).filter(f => FSPEC[f[0]]) : [], mult: +mult || 1 };
}
function unpackHaul(s) {
  if (typeof s !== "string") return null;
  const [fish, mult, bottom] = s.split("|");
  return { fish: fish ? fish.split(",").map(f => f.split(":")).filter(f => SPEC[f[0]]) : [], mult: +mult || 1, bottom: bottom === "1" };
}
// --------------------------------------------------------------------- game
let S = null, T = 0;

function newDive() {
  const seed = (Math.random() * 4294967296) >>> 0;
  S = {
    seed, rng: RNG(seed), tod: timeOfDay(), bounty: todaysBounty(), lure: clamp(store.lure | 0, 0, LURES.length - 1),
    storm: false, frenzy: null, whaleAt: null, whale: null,
    hx: LW / 2, hy: 4, cam: -74, path: [], catch: [], touchX: null, drift: 0, keys: new Set(),
    state: "title", stT: 0, msg: null, immune: 0, flash: 0, ring: null, fight: null, bottom: false, said: new Set(),
    bubbles: [], popups: [], overlay: store.seenHelp ? null : "help", logPage: 0, logSel: 0, tab: 0, scoreSel: -1, shopCat: 0, shopSel: 0, helpPage: 0,
    haul: null, zoneSeen: 0, prepared: false, eye: 0, reached: 0, resume: "down",
    chunks: {}, special: {},
    bPage: S ? S.bPage : 0, bSel: S ? S.bSel : 0, board: S ? S.board : 0, fhaul: null,
    realTod: timeOfDay(), eclipse: false, sunTaps: 0, poke: { n: 0, t: 9, fall: -1 }, bottle: null, bottleGot: -1,
  };
  EV = events();
  loseCastBet();
  S.storm = stormNow();                                  // weather comes from the clock, so refreshing can't reroll it
  const r = S.rng.random();                              // frenzies and whales are still rolled per dive, as before
  if (!S.storm && r >= 0.14 && r < 0.32) {
    let z = S.rng.randint(1, 8);
    if (z === 1 && S.rng.random() < 0.5) z = REEF_Z;      // the Kelp Forest's frenzies are shared with the Coral Reef
    const a = S.rng.uniform(ZONES[z][1] + 20, ZONES[z][2] - 50);
    const pool = SPECIES.filter(s => s[2] === z && s[4] > 0 && s[5] >= 3 && s[6] === null).map(s => s[0]);
    S.frenzy = [a, a + 30, S.rng.choice(pool), S.rng.choice([-1, 1])];
  } else if (!S.storm && r >= 0.32 && r < 0.45) S.whaleAt = S.rng.uniform(150, 420);
}
function noteEvents() {                                 // the first time a player meets each date or time event
  if (EV.ghost) findSecret("ghost");
  if (EV.fullmoon && S.realTod === "NIGHT") findSecret("werewolf");
  ["friday", "thanks", "xmas", "newyear", "valentine", "stpat", "fools", "july4", "october"].forEach(k => { if (EV[k]) findSecret(k); });
}
function setState(st, msg) { S.state = st; S.stT = 0; S.msg = msg || null; }

function cast() {                                        // the lure is chosen: stock the ocean for it and drop the hook
  if (!lureOK(S.lure)) S.lure = 0;
  const L = LURES[S.lure];
  [S.sink, S.steerK, S.pulses, S.trophyK, S.legendK, S.pull] = L.slice(3);
  store.lure = S.lure; saveStore();
  for (const s of SPECIES) {
    if (!s[7]) continue;
    const a = ZONES[s[2]][1], b = ZONES[s[2]][2], base = C.LEGEND_CHANCE[s[0]] !== undefined ? C.LEGEND_CHANCE[s[0]] : C.LEGEND_BASE;
    if (S.rng.random() < Math.min(0.6, base * S.legendK)) {
      let d, x;
      if (s[0] === "chest") { d = S.rng.uniform(326, 434) * M; x = S.rng.uniform(6, LW - 20); }
      else if (s[0] === "pearl") { d = DEPTH_PX - 16; x = OX + S.rng.uniform(20, 76); }
      else { d = S.rng.uniform(a + 12, b - 8) * M; x = S.rng.uniform(10, LW - 60); }
      const k = Math.floor(d / C.CHUNK);
      (S.special[k] = S.special[k] || []).push([s[0], d, x]);
    }
  }
  if (S.rng.random() < C.MYTHIC_CHANCE) {                  // once in a very long while...
    const d = S.rng.uniform(40, C.MAX_M - 60) * M, k = Math.floor(d / C.CHUNK);
    (S.special[k] = S.special[k] || []).push(["poop", d, S.rng.uniform(10, LW - 30)]);
  }
  const place = (fid, z, top, x) => {                   // put one special catch somewhere in zone z
    const d = S.rng.uniform(Math.max(ZONES[z][1], top || 0) + 6, ZONES[z][2] - 6) * M, k = Math.floor(d / C.CHUNK);
    (S.special[k] = S.special[k] || []).push([fid, d, x === undefined ? S.rng.uniform(10, LW - 24) : x]);
  };
  if (S.rng.random() < 0.01) {                             // the lost golden boot: around the Wreck, at a depth that changes weekly
    const d = bootDepth() * M + S.rng.uniform(-24, 24), k = Math.floor(d / C.CHUNK);
    (S.special[k] = S.special[k] || []).push(["gboot", d, S.rng.uniform(10, LW - 24)]);
  }
  if (EV.fullmoon && S.realTod === "NIGHT") place("werewolf", 2);
  if (EV.stpat) place("lucky", 0, 12);
  const magnet = tav().magnet > 0;
  if (magnet) { tav().magnet--; }
  if (tav().bet) tav().bet.cast = true;                    // the bet is on: leaving now loses it
  saveStore();
  if (S.rng.random() < (magnet ? 0.5 : 0.2)) {            // about one dive in five has a message in a bottle (half, with a magnet)
    const id = pickBottle(S.rng);
    if (id >= 0) S.bottle = { id, x: S.rng.uniform(10, LW - 20), y: S.rng.uniform(30, C.MAX_M - 80) * M, got: false };
  }
  if (typeof raftCast === "function") raftCast();          // raft planks, rope and sail (island.js)
  if (typeof siegeCast === "function") siegeCast();        // Flipside spawn, the leak (siege.js)
  noteEvents();
  S.prepared = true;
  setState("down");
  play("plop"); splash(S.hx, 0);
  if (S.storm) S.popups.push(["STORM! BIG FISH UP", 3.0, ORANGE]);
}

function chunk(i) {
  if (S.chunks[i]) return S.chunks[i];
  const out = [], top = i * C.CHUNK, m = top / M;
  if (m >= 10 && m < C.MAX_M - 4) {
    const rng = RNG(Math.imul(S.seed, 1000003) + i * 7919);
    const z = zoneOf(m), za = ZONES[z][1], zb = ZONES[z][2], hi = C.PER_CHUNK[z][1];
    const wide = Math.max(1, Math.round(LW / UW));         // a wider ocean holds proportionally more fish
    let n = 0;
    for (let q = 0; q < wide; q++) n += rng.randint(C.PER_CHUNK[z][0], hi);
    const fr = S.frenzy && S.frenzy[0] <= m && m < S.frenzy[1] ? S.frenzy : null;
    if (fr) n = (hi + 2) * wide;
    const erng = RNG(Math.imul(S.seed, 7) + i * 131);   // events roll on their own, so the ocean itself is unchanged
    const pairs = EV.valentine && !fr;
    if (pairs) n = Math.ceil(n / 2);                     // Valentine's: half as many fish, but every one has a partner
    for (let k = 0; k < n; k++) {
      let y = top + (k + 0.5) * C.CHUNK / n + rng.uniform(-4, 4), zz = z;
      const r1 = rng.random(), r2 = rng.random(), r3 = rng.random();
      if (z !== FLOOR_Z && zb - m < C.BLEND && r1 < 0.5 * (1 - (zb - m) / C.BLEND)) zz = zoneStep(z, 1);   // the next zone's fish drift up to meet you
      else if (ZRANK[z] > 0 && m - za < C.BLEND && r1 < 0.5 * (1 - (m - za) / C.BLEND)) zz = zoneStep(z, -1);
      if (!fr && r2 < C.JELLY_CHANCE[z]) {
        out.push({ id: "jelly", x: rng.uniform(8, LW - 20), y, v: rng.choice([-1, 1]) * rng.uniform(4, 9), ph: rng.uniform(0, 6), lb: 0, tr: false });
        continue;
      }
      let s;
      if (fr) s = SPEC[fr[2]];
      else { const pool = SPECIES.filter(q => q[2] === zz && q[5] && (q[6] === null || q[6] === S.tod)); s = rng.weighted(pool, pool.map(q => q[5])); }
      const still = s[4] === 0;
      const v = still ? 0 : (fr ? fr[3] : rng.choice([-1, 1])) * s[4] * rng.uniform(0.8, 1.25) * (1 + m / 1200);
      const tr = !still && r3 < C.TROPHY_CHANCE * S.trophyK * (S.storm && zz <= 1 ? 2 : 1);
      const lb = rng.randint(s[3][0], s[3][1]);
      if (s[0] === "tripod") { if (z !== FLOOR_Z) continue; y = DEPTH_PX - 12; }
      const f = { id: s[0], x: rng.uniform(0, LW - 20), y, v, ph: rng.uniform(0, 6), lb: tr ? lb * 4 + 6 : lb, tr };
      if (!still && (EV.ghost || EV.october) && erng.random() < (EV.ghost ? 0.3 : 0.12)) f.gh = 1;   // a ghost: drifts through the hook once
      out.push(f);
      if (pairs && !still) out.push({ id: s[0], x: f.x + (v > 0 ? -12 : 12), y: y + 7, v, ph: f.ph + 0.5, lb: erng.randint(s[3][0], s[3][1]), tr: false });
    }
    for (const [fid, d, x] of S.special[i] || []) {
      const s = SPEC[fid];
      out.push({ id: fid, x, y: d, v: s[4] === 0 ? 0 : rng.choice([-1, 1]) * s[4], ph: 0, lb: rng.randint(s[3][0], s[3][1]), tr: false });
    }
  }
  S.chunks[i] = out;
  return out;
}
function visible() {
  const out = [];
  if (!S.prepared) return out;
  const a = Math.floor(S.cam / C.CHUNK) - 1, b = Math.floor((S.cam + LH) / C.CHUNK) + 1;
  for (let i = Math.max(0, a); i <= b; i++) for (const f of chunk(i)) out.push([i, f]);
  return out;
}
const fishSprite = f => (f.id === "jelly" ? "jelly0" : f.id);
const fishSize = f => sprSize(fishSprite(f), f.tr ? 1.7 : 1);
function fishRect(f) { const [w, h] = fishSize(f); return [Math.floor(f.x) + 2, Math.floor(f.y - h / 2) + 2, w - 4, h - 4]; }
const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
function scare(f, dir, secs, gone) { f.fl = [dir, secs || 0.9, !!gone]; }
function removeFish(i, f) { const k = S.chunks[i].indexOf(f); if (k >= 0) S.chunks[i].splice(k, 1); }
function splash(x, y, n, col) { for (let k = 0; k < (n || 8); k++) S.bubbles.push([x + rnd(-3, 3), y, rnd(-26, 26), rnd(-60, -20), 0.5, col || WHITE, 90]); }
function say(key, txt, col, secs) { if (!S.said.has(key)) { S.said.add(key); S.popups.push([txt, secs || 2.2, col || CYAN]); } }

const FLOOR_SLOW = [12, 8, 18];                            // start slowing 12 m up, crawl the last 8 m at 18 px/s (3 m/s, about 3 s)
function pulse() {                                       // scatter everything near the hook
  if (S.state === "boss") { bossPulse(); return; }
  if (S.state === "flip") { if (LURES[S.lure][0] !== "angler") flipPulse(); return; }   // the Angler's Hook can't stun anything over there
  if (LURES[S.lure][0] === "angler") { release(); return; }
  if (!["down", "rise"].includes(S.state)) return;
  if (nearCrack()) { S.pulsed = true; knockCrack(); if (S.state === "flip" || S.toFlip || S.pulses <= 0) return; }   // knocking on the crack is free (Nov 19, 2026)
  if (S.pulses <= 0) return;
  S.pulsed = true;                                         // for the NO PULSES dive bet
  if (!S.catch.length && S.hy > (C.MAX_M - 20) * M && Math.abs(S.hx - (46 + OX)) < 34 && S.eye > 0.3) { S.pulses--; startBoss(false); return; }   // knock on the eye with an empty hook
  S.pulses--; S.ring = 0; S.immune = Math.max(S.immune, 0.5);
  play("pulse");
  for (const [i, f] of visible()) {
    if (Math.abs(f.y - S.hy) > 64 || C.FIXED.includes(f.id)) continue;
    const cx = f.x + fishSize(f)[0] / 2;
    if (Math.abs(cx - S.hx) > 100) continue;
    if (C.JUNK.includes(f.id)) { removeFish(i, f); splash(cx, f.y, 6, "#96826e"); }
    else scare(f, cx >= S.hx ? 1 : -1);
  }
}

// The Angler's Hook (Nov 18, 2026, replaced the Heavy Sinker): no pulse. Its button lets the last fish caught go, twice a
// dive, even after the hook fills (the line goes back down). With an empty hook it still wakes the Sleeper and knocks on the crack.
function release() {
  const live = ["down", "rise"].includes(S.state), full = S.fullUp && ["turn", "up"].includes(S.state);
  if (live && nearCrack()) { S.pulsed = true; knockCrack(); return; }      // free, like the pulse
  if (S.pulses <= 0 || !(live || full)) return;
  if (live && !S.catch.length && S.hy > (C.MAX_M - 20) * M && Math.abs(S.hx - (46 + OX)) < 34 && S.eye > 0.3) { S.pulses--; S.pulsed = true; startBoss(false); return; }
  if (!S.catch.length) { play("miss"); return; }
  const c = S.catch.pop();
  if (c.rise) S.riseN = Math.max(0, (S.riseN || 0) - 1);
  S.pulses--; S.pulsed = true; S.immune = Math.max(S.immune, 0.8);
  store.ach.rel++; saveStore();
  splash(S.hx, S.hy, 8, "#c8ecff"); play("plop");
  S.popups.push(["LET IT GO: " + SPEC[c[0]][1], 2.0, CYAN]);
  if (full) { S.fullUp = false; setState(S.resume || "down"); }
}
const lureOK = i => !(LURES[i][0] === "angler" && betHas("nopulse"));   // the NO PULSES bet greys out the Angler's Hook
const betBlocked = k => k === "nopulse" && LURES[S.lure][0] === "angler";                   // ...and the other way round
function pickLure(i, dir) {                                // choose a lure, skipping one that's greyed out
  for (let n = 0; n < LURES.length; n++, i = (i + (dir || 1) + LURES.length) % LURES.length) if (lureOK(i)) { S.lure = i; play("tick"); return; }
}
function steer(dt) {
  const speed = 118 * S.steerK;
  if (S.touchX !== null) S.hx += clamp(S.touchX - S.hx, -speed * dt, speed * dt);
  else if (heldDir("L", "R")) S.hx += heldDir("L", "R") * (KON === "mirror" ? -1 : 1) * speed * dt;   // read fresh every frame from the keys held
  else if (S.drift) { S.hx += S.drift * speed * 0.6 * dt; if (S.hx <= 4 || S.hx >= LW - 4) S.drift = -S.drift; }
  S.hx = clamp(S.hx, 4, LW - 4);
}

function swim(dt) {
  const gone = [];
  for (const [i, f] of visible()) {
    if (f.fl) {                                          // bolting away from a pulse (or for good)
      f.x += f.fl[0] * 150 * dt; f.fl[1] -= dt;
      if (f.fl[1] <= 0) { const fl = f.fl; f.fl = null; if (fl[2]) gone.push([i, f]); else if (f.v) f.v = -fl[0] * Math.abs(f.v); }
      continue;
    }
    if (S.fight && S.fight.f === f) continue;
    const near = S.pull && Math.abs(f.y - S.hy) < 70 && ["down", "rise"].includes(S.state);      // the glow draws everything in, jellyfish included
    if (f.id === "jelly") {
      f.x += f.v * dt;
      if (near) f.x += clamp(S.hx - (f.x + 5), -1, 1) * S.pull * 0.6 * dt;
      if (f.x < 4) f.v = Math.abs(f.v); else if (f.x > LW - 14) f.v = -Math.abs(f.v);
    }
    else if (f.v) {
      const w = fishSize(f)[0];
      f.x += f.v * dt;
      if (near) f.x += clamp(S.hx - (f.x + w / 2), -1, 1) * S.pull * dt;
      if (f.x < -6) f.v = Math.abs(f.v); else if (f.x > LW - w + 6) f.v = -Math.abs(f.v);
    }
  }
  gone.forEach(([i, f]) => removeFish(i, f));
}

function hookCheck() {                                   // whatever the hook is touching goes on it (or fights, or stings)
  const hook = [Math.floor(S.hx) - 2, Math.floor(S.hy) - 2, 5, 6], b = S.bottle;
  if (b && !b.got && Math.abs(S.hx - (b.x + 3)) < 7 && Math.abs(S.hy - b.y) < 9) {      // a bottle comes along without using a hook slot
    b.got = true; S.bottleGot = b.id; store.sec.lastBottle = b.id;
    if (!store.sec.bottles.includes(b.id)) store.sec.bottles.push(b.id);
    saveStore(); splash(S.hx, S.hy, 6, "#b4f0dc"); play("chime");
    S.popups.push(["A MESSAGE IN A BOTTLE!", 2.6, "#b4f0dc"]);
    findSecret("bottle");
  }
  if (typeof raftHook === "function") raftHook();          // raft parts come along like bottles (island.js)
  if (typeof siegeHook === "function") siegeHook();        // ...and so does the Flipside spawn (siege.js)
  if (S.hy <= 10 * M || S.immune > 0) return;
  for (const [i, f] of visible()) {
    const touch = overlap(hook, fishRect(f));
    if (f.gh === 2 && !touch) f.gh = 3;                   // the ghost has passed through; now it can be caught
    if (f.fl || !touch) continue;
    if (f.gh === 1) { f.gh = 2; say("ghost", "IT WENT RIGHT THROUGH!", "#dcf0ff"); continue; }
    if (f.gh === 2) continue;
    const legend = f.id !== "jelly" && SPEC[f.id][7];
    if (f.id === "jelly") { play("zap"); S.flash = 0.2; S.rising = false; S.stung = true; S.fullUp = false; store.ach.stung++; setState("turn", "ZAPPED!"); }     // dive over; you keep what's hooked
    else if (SHARKS.includes(f.id) && !fromBehind(f)) sharkBite(i, f);
    else if (S.catch.length >= C.CAPACITY) { if (!C.FIXED.includes(f.id)) scare(f, f.x + 6 >= S.hx ? 1 : -1, 0.6); continue; }   // the crack is calling: a full hook bumps fish off
    else if (legend && S.catch.some(c => SPEC[c[0]][7])) {
      if (C.FIXED.includes(f.id)) continue;
      scare(f, f.x + 10 >= S.hx ? 1 : -1, 2.0, true);
      S.popups.push(["ONE LEGEND PER HOOK", 1.8, GOLD]);
      continue;
    } else if (legend || f.tr) startFight(i, f);
    else land(i, f);
    break;
  }
}
const facesRight = f => (f.fl ? f.fl[0] > 0 : f.v >= 0) !== !!EV.fools;    // which way a fish's head points (as drawn)
function fromBehind(f) {                                   // is the hook on the back half of this fish?
  const r = fishRect(f), cx = r[0] + r[2] / 2;
  return (S.hx - cx) * (facesRight(f) ? 1 : -1) < 0;
}
function sharkBite(i, f) {                                 // a shark met head-on: it takes your last fish, or with nothing to take, ends the dive
  S.flash = 0.25; S.immune = 1.0; play("zap");
  scare(f, facesRight(f) ? 1 : -1, 1.6, true);
  if (S.catch.length) {
    const c = S.catch.pop();
    if (c.rise) S.riseN = Math.max(0, (S.riseN || 0) - 1);
    store.ach.bit++; S.bitten = (S.bitten || 0) + 1; saveStore();
    splash(S.hx, S.hy, 8, "#ff6a5a");
    S.popups.push(["CHOMP!", 2.0, RED], ["IT TOOK YOUR " + SPEC[c[0]][1], 2.4, RED]);
  } else {
    S.rising = false; S.fullUp = false; S.chomped = true;
    splash(S.hx, S.hy, 10, "#ff6a5a");
    setState("turn", "CHOMP!");
  }
}
function bottleXY(bt, cam, t) { return [Math.floor(bt.x + Math.sin(t * 0.9) * 3), Math.floor(bt.y - cam + Math.sin(t * 2) * 1.5) - 4]; }
function bottleTwinkle(bt, cam, t) {                       // a little four-point star that pops on and off beside the bottle
  const [bx, by] = bottleXY(bt, cam, t), ph = (t * 0.8) % 1;
  if (by < -16 || by > LH + 16 || ph > 0.45) return;
  const k = Math.floor(t * 0.8), sx = bx + [7, -2, 6, 0][k % 4], sy = by + [-2, 1, 9, -3][k % 4], r = ph < 0.15 || ph > 0.3 ? 1 : 2;
  rect(WHITE, sx, sy - r, 1, 2 * r + 1); rect(WHITE, sx - r, sy, 2 * r + 1, 1);
  if (r > 1) { g.globalAlpha = 0.5; rect("#bfffe6", sx - 1, sy - 1, 3, 3); g.globalAlpha = 1; rect(WHITE, sx, sy, 1, 1); }
}
function darknessAt(m) {
  const d = DATA.dark;
  if (m <= d[0][0]) return 0;
  for (let i = 1; i < d.length; i++) if (m <= d[i][0]) return lerp(d[i - 1][1], d[i][1], (m - d[i - 1][0]) / (d[i][0] - d[i - 1][0]));
  return d[d.length - 1][1];
}
function update(dt) {
  if (S.state === "flip" && FLIP) { flipUpdate(dt); S.shake = Math.max(0, (S.shake || 0) - dt); return; }
  if (S.state === "kart" && typeof KART !== "undefined" && KART) { kartUpdate(dt); return; }   // FIN PRIX (finprix.js)
  if (S.state === "isle" && typeof ISLE !== "undefined" && ISLE) { isleUpdate(dt); return; }   // Driftwood Isle (island.js)
  if (S.state === "siege" && typeof SG !== "undefined" && SG) { siegeUpdate(dt); return; }   // Siege of the Deep (siege.js)
  if (S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { wreckUpdate(dt); return; }   // WRECKONING (wreck.js)
  if (S.state === "boss" && BOSS) { bossUpdate(dt); S.popups.forEach(p => { p[1] -= dt; }); S.popups = S.popups.filter(p => p[1] > 0); S.flash = Math.max(0, S.flash - dt); return; }
  S.immune = Math.max(0, S.immune - dt); S.flash = Math.max(0, S.flash - dt);
  if (S.ring !== null) { S.ring += dt; if (S.ring > 0.5) S.ring = null; }
  for (const b of S.bubbles) { b[0] += b[2] * dt; b[1] += b[3] * dt; b[3] += b[6] * dt; b[4] -= dt; }
  S.bubbles = S.bubbles.filter(b => b[4] > 0);
  S.popups.forEach(p => { p[1] -= dt; });
  S.popups = S.popups.filter(p => p[1] > 0);
  swim(dt);
  const diving = ["down", "up", "fight", "rise"].includes(S.state);
  if (diving && Math.random() < 0.25) { const tc = TRAILS[store.eq.trail][2]; S.bubbles.push([S.hx + rnd(-2, 2), S.hy, rnd(-3, 3), -rnd(14, 30), 1.2, tc[Math.floor(Math.random() * tc.length)], 0]); }
  if (S.cam + LH > DEPTH_PX - 30 && Math.random() < 0.3) { const v = DATA.vents[Math.floor(Math.random() * DATA.vents.length)]; S.bubbles.push([v[0] - BG_O + OX + rnd(-1, 1), v[1], rnd(-4, 4), -rnd(20, 44), 1.4, "#ff965a", 0]); }
  if (S.whale) {
    const wh = S.whale;
    wh.x += wh.d * 70 * dt;
    for (const [, f] of visible()) {                     // everything gets out of its way
      if (Math.abs(f.y - wh.y) < 34 && !f.fl && !C.FIXED.includes(f.id) && !C.JUNK.includes(f.id)) {
        const nose = wh.x + (wh.d > 0 ? 128 : 0), k = (f.x + 6 - nose) * wh.d;
        if (k > -30 && k < 46) scare(f, wh.d, 1.2);
      }
    }
    if (wh.x < -150 || wh.x > LW + 20) S.whale = null;
  }
  if (S.state === "down") {
    steer(dt);
    let v = (56 + Math.min(70, S.hy / M * 0.09)) * S.sink;
    const left = C.BOTTOM_M - S.hy / M;                    // the last few metres: slow right down so there's time to line up on the eye or the crack
    if (left < FLOOR_SLOW[0]) v = FLOOR_SLOW[2] + (v - FLOOR_SLOW[2]) * clamp((left - FLOOR_SLOW[1]) / (FLOOR_SLOW[0] - FLOOR_SLOW[1]), 0, 1);
    S.hy += v * dt;
    while (S.path.length < Math.floor(S.hy / 8) + 1) S.path.push(S.hx);
    const m = S.hy / M, z = zoneOf(m);
    S.reached = Math.max(S.reached, m);
    if (ZRANK[z] > ZRANK[S.zoneSeen]) { S.zoneSeen = z; S.popups.push([ZONES[z][0], 2.0, CYAN]); play("chime", 0.5); }
    if (S.state === "down" && crackCalls()) say("calls", "THE CRACK CALLS THE LIGHT", "#c8a0ff", 3);
    if (S.frenzy && m > S.frenzy[0] - 10) say("frenzy", "FEEDING FRENZY!", ORANGE, 2.6);
    if (S.whaleAt && m > S.whaleAt - 22) {
      const d = S.rng.choice([-1, 1]);
      S.whale = { x: d > 0 ? -140 : LW + 12, y: S.whaleAt * M, d }; S.whaleAt = null;
      say("whale", "A WHALE PASSES", CYAN, 2.6);
    }
    hookCheck();
    if (S.state === "down" && S.hy >= C.BOTTOM_M * M) {
      S.freeRide = S.catch.length >= C.CAPACITY;          // only possible when the crack called you down
      S.hy = C.BOTTOM_M * M; S.bottom = !S.freeRide; play("chime");
      if (!S.catch.length) S.emptyFloor = true;
      S.rising = S.catch.length < C.CAPACITY || S.freeRide;   // room left on the hook: ride up slowly and keep fishing
      setState("turn", S.freeRide ? "THE CRACK IS NEAR" : "TOUCHED BOTTOM!");
    }
    S.cam += ((S.hy - 78) - S.cam) * Math.min(1, dt * 6);
  } else if (S.state === "rise") {                         // the slow ride up from the floor: still catching until the hook is full
    steer(dt);
    S.hy -= 78 * dt;
    S.path.length = Math.max(0, Math.min(S.path.length, Math.floor(S.hy / 8) + 1));
    hookCheck();
    S.cam += ((S.hy - 128) - S.cam) * Math.min(1, dt * 6);
    if (S.state === "rise" && S.freeRide && S.hy < (C.MAX_M - 26) * M) { S.fullUp = true; setState("up"); }   // past the crack with a full hook: reel in
    if (S.state === "rise" && S.hy <= 2) beginHaul();
  } else if (S.state === "fight") {
    if (fightTick(S.fight, dt)) loseFight("TOO SLOW! GOT AWAY");
  } else if (S.state === "turn") {
    if (S.stT > 0.75) {
      if (S.rising) { S.rising = false; S.resume = "rise"; setState("rise"); S.popups.push(["FISH ON THE WAY UP!", 2.6, LIME]); }
      else setState("up");
    }
  } else if (S.state === "up") {
    steer(dt);
    const v = 190 + Math.min(260, S.hy / M * 0.5);
    if (Math.floor(S.hy / 20) !== Math.floor((S.hy - v * dt) / 20)) play("reel", 0.5);
    S.hy -= v * dt;
    S.path.length = Math.max(0, Math.min(S.path.length, Math.floor(S.hy / 8) + 1));
    S.cam += ((S.hy - 128) - S.cam) * Math.min(1, dt * 7);
    if (S.hy <= 2) beginHaul();
  } else if (S.state === "haul") {
    S.cam += (-74 - S.cam) * Math.min(1, dt * 5);
    const h = S.haul;
    while (h.shown < h.n && S.stT > 0.5 + h.shown * 0.42) { h.shown++; play("weigh", 0.8); splash(LW / 2, 0, 5); }
    if (h.shown >= h.n && !h.fanfare && S.stT > h.end) { h.fanfare = true; play(h.sets.length || h.record ? "fanfare" : "chime"); h.news.forEach(n => S.popups.push(n)); }
  }
  if (S.state === "title") {
    S.cam = -74; S.storm = stormNow();                   // the sky changes on the hour even while waiting to cast
    const P = S.poke;
    P.t += dt;
    if (P.fall >= 0) {
      P.fall += dt;
      if (P.fall >= 0.6 && !P.splashed) { P.splashed = true; splash(OX + 84, 0, 14); play("plop"); findSecret("poke"); }
      if (P.fall >= 3.2) { P.fall = -1; P.n = 0; }
    }
    else if (P.t > 6) P.n = 0;                          // leave them alone long enough and they calm down
  }
  S.cam = Math.max(S.cam, -74);
}
function land(i, f) {
  removeFish(i, f);
  S.catch.push([f.id, f.lb, f.tr, Math.floor(S.hy / M)]);
  if (S.resume === "rise") { S.riseN = (S.riseN || 0) + 1; S.catch[S.catch.length - 1].rise = true; }  // caught on the slow ride up from the floor
  if (SHARKS.includes(f.id)) store.ach.sharks++;
  if (f.gh) store.ach.ghosts++;
  catchSound(S.catch.length - 1);
  splash(S.hx, S.hy, 6, "#c8ecff");
  const legend = SPEC[f.id][7];
  if (f.id === "gboot") { S.flash = 0.35; S.popups.push(["THE GOLDEN BOOT!", 2.6, GOLD]); play("fanfare"); }
  else if (f.id === "werewolf") { S.flash = 0.3; S.popups.push(["WEREWOLF FISH!", 2.6, "#c8a0ff"]); play("fanfare"); }
  else if (f.id === "lucky") { S.flash = 0.25; S.popups.push(["LUCKY GOLDFISH!", 2.4, LIME]); play("fanfare"); }
  else if (f.id === "poop") { S.flash = 0.5; S.popups.push(["MYTHIC!", 3, "#c8a0ff"], ["WHAT IS THAT?!", 3, "#c8a0ff"]); play("fanfare"); }
  else if (legend) { S.flash = 0.35; S.popups.push(["LEGENDARY!", 2.4, LEGEND], [SPEC[f.id][1], 2.4, LEGEND]); play("fanfare"); }
  else if (f.tr) { S.flash = 0.25; S.popups.push(["TROPHY " + SPEC[f.id][1] + "!", 2.2, TROPHY]); play("chime"); }
  if (S.catch.length >= C.CAPACITY && crackCalls()) { S.popups.push(["FULL HOOK. KEEP SINKING", 2.4, "#c8a0ff"]); if (S.state !== S.resume) setState(S.resume); }
  else if (S.catch.length >= C.CAPACITY) { S.fullUp = true; setState("turn", "FULL HOOK"); }   // fullUp: the Angler's Hook can still let one go
  else {
    if (!legend && !f.tr) S.popups.push(["HOOKED " + S.catch.length + "/" + C.CAPACITY, 1.0, GOLD]);
    if (S.state !== S.resume) setState(S.resume);
  }
}
// Big fish fight in four different ways, and every fight is on a clock.
const SLIPPERY = /EEL|SQUID|SERPENT|KRAKEN|LAMPREY|HAGFISH|OARFISH|OCTOPUS/;
function fightStyle(s) { return SLIPPERY.test(s[1]) ? "dart" : s[4] >= 30 ? "quick" : ZRANK[s[2]] >= ZRANK[4] ? "shrink" : "heavy"; }
const STYLE_HINT = { dart: "SLIPPERY: IT MOVES", quick: "FAST ONE!", shrink: "HURRY: IT SHRINKS", heavy: "HEAVY: MORE HITS" };
function newFight(need, style, lb) {                         // the timing bar: tap when the marker is on green
  const time = (style === "quick" ? 3.2 : 4.2) + need * 1.5, c = rnd(0.3, 0.7);
  return { need, style, hits: 0, miss: 0, pos: 0, dir: 1, shake: 0, ph: 0, base: c, time, left: time,
    speed: (1.0 + Math.min(0.9, lb / 500)) * (style === "quick" ? 1.7 : 1), win: [c, style === "shrink" ? 0.17 : 0.13] };
}
function fightTick(fg, dt) {                                 // -> true when time runs out
  fg.pos += fg.dir * fg.speed * dt;
  if (fg.pos >= 1 || fg.pos <= 0) { fg.pos = clamp(fg.pos, 0, 1); fg.dir = -fg.dir; }
  fg.shake = Math.max(0, fg.shake - dt);
  fg.left -= dt;
  if (fg.style === "shrink") fg.win[1] = Math.max(0.045, fg.win[1] - 0.035 * dt);       // the green zone closes while you wait
  if (fg.style === "dart") { fg.ph += dt * 3.2; fg.win[0] = clamp(fg.base + Math.sin(fg.ph) * 0.2, fg.win[1], 1 - fg.win[1]); }   // ...or will not hold still
  return fg.left <= 0;
}
function fightHit(fg) {                                      // a tap: -> "win", "hit", "miss" or "lost"
  if (Math.abs(fg.pos - fg.win[0]) <= fg.win[1]) {
    fg.hits++; fg.shake = 0.25; play("hit");
    if (fg.hits >= fg.need) return "win";
    fg.base = rnd(0.25, 0.75);
    fg.win = [fg.base, fg.style === "shrink" ? 0.17 : Math.max(0.08, 0.13 - 0.015 * fg.hits)]; fg.speed *= 1.1;
    return "hit";
  }
  fg.miss++; play("miss");
  return fg.miss >= 2 ? "lost" : "miss";
}
function startFight(i, f) {
  const s = SPEC[f.id], legend = s[7], style = fightStyle(s);
  let need = (legend ? 3 : 2) + (style === "heavy" ? 1 : 0) + (legend && ZRANK[s[2]] >= ZRANK[7] ? 1 : 0);
  if (C.FIXED.includes(f.id)) need = 2;
  S.fight = Object.assign(newFight(need, style, f.lb), { i, f });
  S.touchX = null;
  setState("fight"); play("select");
}
function loseFight(msg) {                                  // it throws the hook and bolts
  const fg = S.fight;
  S.fight = null;
  if (C.FIXED.includes(fg.f.id)) removeFish(fg.i, fg.f); else scare(fg.f, fg.f.x + 10 >= S.hx ? 1 : -1, 2.0, true);
  S.popups.push([msg, 1.8, RED]); S.immune = 1.0; play("miss"); setState(S.resume);
}
function fightTap() {
  const fg = S.fight, r = fightHit(fg);
  if (r === "win") { S.fight = null; S.immune = 0.5; land(fg.i, fg.f); }
  else if (r === "lost") loseFight("IT GOT AWAY!");
}
const SHORT = { "TROPHY CASE": "TROPHIES", "3 OF A KIND": "TRIPLE", "DEEP TRIO": "DEEP", "GRAND TOUR": "TOUR", "A PAIR": "PAIR" };
function beginHaul() {
  const rows = [];
  let newN = 0, recN = 0;
  if (S.catch.some(c => c[0] === S.bounty) && store.ach.bday !== dayString()) { store.ach.bounty++; store.ach.bday = dayString(); }
  for (const [fid, lb, tr] of S.catch) {
    const hot = fid === S.bounty;
    let tag = hot ? "X" + C.BOUNTY_X : "";
    if (HIDDEN.includes(fid)) { if (fid === "poop") store.mythic++; if (fid === "gboot") findSecret("gboot"); tag = "???"; }
    else {
      let e = store.log[fid];
      const isNew = !e;
      if (isNew) e = store.log[fid] = { n: 0, rec: 0 };
      const rec = lb > e.rec;
      e.n++; if (tr) e.star = true; if (rec) e.rec = lb;
      if (isNew) newN++; else if (rec) recN++;
      if (!hot) tag = isNew ? "NEW" : rec ? "REC" : "";
    }
    rows.push([fid, hot ? lb * C.BOUNTY_X : lb, tag, tr]);
  }
  // set bonuses add together: a pair (+0.5) and a grand tour (+1) make x2.5
  const ids = S.catch.map(c => c[0]), zones = ids.map(i => SPEC[i][2]), sets = [];
  if (ids.length === 3) {
    if (S.catch.every(c => c[2] || SPEC[c[0]][7])) sets.push([1, "TROPHY CASE"]);          // legendaries count as trophies here
    if (new Set(ids).size === 1) sets.push([2, "3 OF A KIND"]);
    if (zones.every(z => ZRANK[z] >= ZRANK[7])) sets.push([1, "DEEP TRIO"]);
    if (new Set(zones).size === 3) sets.push([1, "GRAND TOUR"]);
  }
  if (ids.length - new Set(ids).size === 1) sets.push([0.5, "A PAIR"]);
  const mult = Math.min(5, 1 + sets.reduce((a, s) => a + s[0], 0)), base = rows.reduce((a, r) => a + r[1], 0);
  const total = Math.round(base * mult) + (S.bottom ? C.BOTTOM_BONUS : 0);
  const extra = [];
  if (sets.length) { const long = sets.map(s => s[1]).join("+"), short = sets.map(s => SHORT[s[1]]).join("+"); extra.push([(sets.length === 1 ? long : short.length <= 13 ? short : sets.length + " BONUSES") + " X" + mult, LIME]); }
  if (S.bossWon) extra.push(["THE SLEEPER SLEEPS", "#c8a0ff"]);
  if (S.bottom) extra.push(["SEA FLOOR +" + C.BOTTOM_BONUS, CYAN]);
  const dive = { total, mult, base, emptyFloor: !!S.emptyFloor, catch: S.catch, reached: S.reached, bottom: S.bottom, sets, bounty: S.bounty, newN, recN,
    stung: !!S.stung, bitten: S.bitten || 0, wanted: wantedFish(), pulsed: !!S.pulsed, riseN: S.riseN || 0, last: tav().hist.length ? tav().hist[tav().hist.length - 1][0] : null,
    lastLow: tav().hist.length ? tav().hist[tav().hist.length - 1][0] < 0.5 * betLine() : false,
    best: store.best, board: LB.url && LB.today ? LB.today.map(e => e.s).sort((a, b) => b - a) : null };
  S.lastDive = dive;                                       // for the tests' dive bot
  let coins = total > 0 ? Math.floor(total / 20) + 1 : 0;   // /20 since Nov 18, 2026 (was /25)
  if (ids.includes("poop")) coins += 500;
  store.coins += coins;
  if (coins) extra.push(["+" + coins + " COINS +" + (2 + (S.reached >= 600 ? 3 : 0) + (S.bottom ? 5 : 0)) + " CHIPS", GOLD]);
  const news = progressTasks(dive).map(([, c]) => ["TASK DONE! +" + c + " COINS", 4, LIME]).concat(checkTitles(dive).map(n => ["NEW TITLE: " + n, 5, GOLD]));
  ["baiter", "mythic"].forEach(id => { if (store.titles.includes(id)) findSecret(id); });
  const q = tav(), chips = 2 + (S.reached >= 600 ? 3 : 0) + (S.bottom ? 5 : 0);       // a few chips per dive, more for deep ones
  const lineNow = betLine();
  q.hist.push([total, S.bottom ? 1 : 0, S.catch.some(c => c[2]) ? 1 : 0, S.catch.some(c => SPEC[c[0]][7]) ? 1 : 0, betMask(dive, lineNow), total < JUNK_K * lineNow ? 1 : 0]);
  if (q.hist.length > 20) q.hist.shift();
  betRecord(q.hist[q.hist.length - 1]);
  addChips(chips);
  const betNews = settleBet(dive);
  if (betNews) news.push(betNews);
  if (LOGGED.some(s => s[7] && store.log[s[0]])) earnSong(6);
  if (store.titles.includes("baiter")) earnSong(7);
  if (store.titles.includes("all")) earnSong(8);
  if (typeof crateAdd === "function") { const cr = crateAdd(S.catch); if (cr) extra.push([("CRATE: " + cr).slice(0, 19), "#d29c64"]); }   // Driftwood Isle: one fish to the island
  store.dives++;
  if (store.sec.sleeper && !store.sec.crack) store.sec.afterSleeper++;
  const record = total > store.best;
  if (record) store.best = total;
  saveStore();
  const n = rows.length + extra.length;
  S.haul = { deep: Math.floor(S.reached), rows, extra, n, total, mult, sets, news, shown: 0, record, fanfare: false, end: 0.5 + n * 0.42 + 0.3 };
  setState("haul"); splash(LW / 2, 0, 14); play("plop");
}
function finishDive() {
  const total = S.haul.total, packed = packHaul(S.haul, S.bottom), ti = titleName(store.eq.title);
  if (total > 0 && LB.url) {
    if (store.name) LB.submit(store.name, total, packed, ti);
    else askName(n => { if (n) LB.submit(n, total, packed, ti); });
  }
  const note = S.bottleGot, goFlip = S.toFlip;
  newDive();
  if (goFlip) { startFlip(0); return; }                    // the catch is banked; now through the crack
  if (note >= 0) { S.overlay = "note"; S.noteIdx = store.sec.bottles.indexOf(note); S.noteBack = null; }  // read the bottle's message once the dive is over
}
// --------------------------------------------------------------------- draw
function sunPos() {                                       // where the sun or moon sits, in screen pixels: [x, y, radius]
  const y0 = Math.floor(-S.cam) - 80;
  return [LW - 16, y0 + { MORNING: 60, DAY: 50, DUSK: 64, NIGHT: 50 }[S.realTod], 9];
}
function drawSky() {
  const t = T, night = S.eclipse || S.realTod === "NIGHT";
  let [top, bot] = { MORNING: [[255, 190, 150], [170, 214, 250]], DAY: [[90, 170, 250], [170, 222, 255]], DUSK: [[60, 50, 110], [250, 150, 90]], NIGHT: [[8, 12, 40], [30, 44, 96]] }[S.eclipse ? "NIGHT" : S.realTod];
  const mix = (c, k) => { top = [0, 1, 2].map(i => lerp(top[i], c[0][i], k)); bot = [0, 1, 2].map(i => lerp(bot[i], c[1][i], k)); };
  if (EV.october) mix([[20, 8, 30], [70, 30, 50]], 0.4);                   // October: a darker, spookier sky
  if (EV.thanks) mix([[top[0], top[1], top[2]], [240, 140, 60]], 0.35);       // Thanksgiving week: autumn colours
  if (S.storm) mix([[30, 34, 52], [70, 78, 100]], 0.72);
  const y0 = Math.floor(-S.cam) - 80;
  for (let i = 0; i < 14; i++) rect(lerpCol(top, bot, i / 13), 0, y0 + i * 6, LW, 6);
  if (y0 > 0) rect(lerpCol(top, top, 0), 0, 0, LW, y0);
  if (!S.storm) {
    const [sx, sy] = sunPos();
    if (night) {
      const r = RNG(9);
      for (let i = 0; i < Math.round(26 * LW / UW); i++) { const x = r.randint(0, LW - 1), y = r.randint(0, 59); if ((Math.floor(t * 2) + x) % 7) rect(WHITE, x, y0 + y, 1, 1); }
    }
    if (S.eclipse && S.realTod !== "NIGHT") {             // the sun, worn out: a black disc in a ring of fire
      disc("#ffdc78", sx, sy, 10); disc("#fff6c8", sx, sy, 9); disc("#05060f", sx, sy, 8);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * 0.5; rect("#ffdc78", sx + Math.round(Math.cos(a) * 12), sy + Math.round(Math.sin(a) * 12), 1, 1); }
    } else if (S.realTod === "NIGHT") {
      const col = S.eclipse ? "#c84a3c" : "#ececd6";     // tapped ten times at night, the moon turns blood red
      disc(col, sx, sy, 8);
      if (!EV.fullmoon && !S.eclipse) disc(lerpCol(top, bot, 0.58), sx + 3, sy - 2, 7);    // a crescent, except on real full-moon nights
    } else { disc("#ffec96", sx, sy, 9); disc("#fffad6", sx, sy, 6); }
  }
  const clouds = [[10, 14, 18], [50, 30, 14], [84, 44, 12]].concat(S.storm ? [[30, 8, 30], [70, 20, 26], [100, 12, 24]] : []);
  clouds.forEach(([cx, cy, w], i) => {
    const x = Math.floor((cx * LW / UW + t * (2 + i) * (S.storm ? 4 : 1)) % (LW + 30)) - 20, c = S.storm ? "#3c4256" : !night ? WHITE : "#5a6496";
    rect(c, x, y0 + cy, w, 3); rect(c, x + 3, y0 + cy - 2, w - 7, 2);
  });
  poly(lerpCol(bot, EV.thanks ? [140, 60, 30] : [30, 60, 90], 0.6), [[0, y0 + 80], [0, y0 + 70], [16, y0 + 62], [30, y0 + 72], [44, y0 + 80]]);
  if (EV.xmas) for (let i = 0; i < Math.round(30 * LW / UW); i++)                    // December snow
    rect(WHITE, Math.floor(i * 37 + Math.sin(t + i) * 4 + t * 3) % LW, y0 + Math.floor(i * 53 + t * (10 + i % 3 * 5)) % 82, 1, 1);
  if (EV.thanks) for (let i = 0; i < Math.round(8 * LW / UW); i++)                   // falling leaves
    rect(["#e66e32", "#c83c28", "#ffb43c"][i % 3], Math.floor(i * 41 + Math.sin(t * 1.3 + i) * 6 + t * 9) % LW, y0 + Math.floor(i * 29 + t * (7 + i % 4 * 2)) % 82, 2, 1);
  if (TAV.show > T && S.state === "title") fireworks(y0, ["#f05050", "#fafaff", "#ffd246"]);   // a show bought at the Rusty Hook
  if (EV.newyear || EV.july4) fireworks(y0, EV.july4 ? ["#f05050", "#fafaff", "#5a8cff"] : ["#ffd246", "#ff8cd2", "#5ae6ff", "#82f082"]);
  if (S.storm) {
    for (let i = 0; i < Math.round(26 * LW / UW); i++) rect("#aabedc", (i * 37 + Math.floor(t * 90)) % LW, y0 + (i * 53 + Math.floor(t * 220)) % 80, 1, 3);
    const ph = t % 3.7;
    if (ph < 0.1 || (ph > 0.18 && ph < 0.24)) {
      const bx = 20 + Math.floor(Math.floor(t / 3.7) * 47) % (LW - 40);
      line("#ffffdc", bx, y0 + 4, bx - 4, y0 + 24); line("#ffffdc", bx - 4, y0 + 24, bx + 3, y0 + 30); line("#ffffdc", bx + 3, y0 + 30, bx - 3, y0 + 56);
      S.flash = Math.max(S.flash, 0.06);
      if (ph < 0.03) play("thunder", 0.6);
    }
  }
}
function fireworks(y0, cols) {                             // bursts over the boat, worked out from the clock
  const n = Math.max(3, Math.round(3 * LW / UW));
  for (let k = 0; k < n; k++) {
    const per = 1.6 + (k % 3) * 0.3, u = (T + k * 0.53) % per / per, round = Math.floor((T + k * 0.53) / per);
    const cx = OX + 60 + ((k * 61 + round * 37) % (LW - 30)) - (LW >> 1) + 15, cy = y0 + 14 + (k * 17 + round * 11) % 28, col = cols[(k + round) % cols.length];
    if (u < 0.25) { rect("#ffe6b4", cx, cy + Math.round((0.25 - u) * 120), 1, 2); continue; }      // the rocket going up
    const r = Math.round((u - 0.25) * 30);
    if (u > 0.85 && (Math.floor(T * 20) + k) % 2) continue;
    if (u < 0.32) rect("#fffad6", cx - 1, cy - 1, 3, 3);                               // the flash
    for (let q = 0; q < 14; q++) { const a = q * Math.PI / 7, px = cx + Math.round(Math.cos(a) * r), py = cy + Math.round(Math.sin(a) * r * 0.8) + Math.round((u - 0.25) * 8); rect(col, px, py, 2, 2); rect(col, px - Math.round(Math.cos(a) * 3), py - Math.round(Math.sin(a) * 2), 1, 1); }
  }
}

// ------------------------------------------------------------- the Sleeper
// A boss arena under the sea floor. BOSS holds the fight (mock-up data for now).
let BOSS = null;
const SL_BODY = "#241a3a", SL_DARK = "#140e24", SL_LIGHT = "#3c2c5a", SL_TENT = "#5a3c7a", SL_SUCK = "#c8a0e6";
function slEye(x, y, r, open, hx, hy, cx, phase) {          // one of its eyes: closed is a seam, open is gold with a slit that follows the hook
  if (open >= 0.1 && phase >= 3) { g.globalAlpha = 0.35; disc("#ff3c3c", x, y, r + 5); g.globalAlpha = 1; }
  ell(SL_DARK, x - r - 3, y - Math.round(r * 0.65) - 2, r * 2 + 6, Math.round(r * 1.3) + 4);
  const sl = Math.abs(x - cx) < 3 ? 0 : x < cx ? 1 : -1, by = y - Math.round(r * 0.65) - 3, bw = r + 4;   // a heavy brow, slanted into a scowl
  if (sl) poly("#08040e", [[x - bw, by - 3 - sl * 3], [x + bw, by - 3 + sl * 3], [x + bw, by + 1 + sl * 3], [x - bw, by + 1 - sl * 3]]);
  else poly("#08040e", [[x - bw, by - 6], [x, by], [x + bw, by - 6], [x + bw, by - 2], [x, by + 4], [x - bw, by - 2]]);
  if (open < 0.1) { for (let k = -r; k <= r; k++) rect("#5a4a7e", x + k, y + Math.round(2 - k * k / (r * 4)), 1, 1); return; }
  const h = Math.max(2, Math.round(r * 1.3 * open));
  ell("#463e6e", x - r - 1, y - (h >> 1) - 1, r * 2 + 2, h + 2);
  ell("#fad246", x - r, y - (h >> 1), r * 2, h);
  ell("#ffeea0", x - r + 2, y - (h >> 1) + 1, Math.round(r * 0.8), Math.max(1, h >> 2));
  const px = x + Math.round(clamp((hx - x) / 10, -r / 2, r / 2)), py = y + Math.round(clamp((hy - y) / 20, -h / 4, h / 4));
  ell("#140a14", px - Math.max(1, r >> 2), py - (h >> 1) + 1, Math.max(2, r >> 1), Math.max(1, h - 2));
}
function slTentacle(t) {                                     // a tentacle sweeping in from one side: a chain of shrinking discs
  const n = 22, side = t.dir > 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = t.x + t.dir * i * 6, y = t.y + Math.sin(T * 3 + i * 0.45 + t.ph) * (3 + u * 6), r = Math.max(1, Math.round(9 * (1 - u * 0.85)));
    disc(SL_TENT, x, y, r);
    if (i % 2 === 0 && r > 2) disc(SL_SUCK, x, y + r - 2, 1);
    if (i === 0) disc(SL_DARK, x + side * 2, y, r - 2);
  }
}
// ------------------------------------------------------------ the Flipside
// Through the crack is an upside-down mirror of the ocean. The Crossing (drop 4) climbs its first three zones to the
// surface overhead, where a monster version of you waits in an upside-down boat. Catch yourself to beat the game.
// After that, the crack opens to the endgame (drop 5): the whole Flipside, all ten zones, in the dark, with hunters.
const FLIP_Z = DATA.flip.zones, FSPEC = Object.fromEntries(DATA.flip.species.map(s => [s[0], s]));
const HUNT = new Set(DATA.flip.hunters);
const FLIP_HOOK_Y = 140;                                   // the hook stays this far down the screen while the world rises past
// The endgame's knobs, bot-tuned (tools/tests/test_flipside.py) so a good player catches themselves on about 1 run in 5.
const FL_TUNE = { one: 0.3, two: 0.85, hunt: 0.3, huntZ: 0.04, jelly: 0.16, jellyZ: 0.015, sense: 70, wind: 0.45, charge: 112, chargeZ: 3, go: 1.4, rest: 2.4, maxHunt: 2,
  light: 34, glowLight: 46, legend: 0.35, trophy: 0.035 };
let FLIP = null;
// Test links: ?crossing (or ?crossing=top to start just below your other self), and ?flipside (or ?flipside=top) for the endgame.
// A practice run: nothing is saved.
const TEST_FLIP = (() => { try { const q = new URLSearchParams(location.search); return q.has("crossing") ? (q.get("crossing") === "top" ? 2 : 1) : 0; } catch (e) { return 0; } })();
const TEST_END = (() => { try { const q = new URLSearchParams(location.search); return q.has("flipside") ? (q.get("flipside") === "top" ? 2 : 1) : 0; } catch (e) { return 0; } })();
const flipZoneAt = m => { let z = 0; FLIP_Z.forEach((q, i) => { if (m >= q[1]) z = i; }); return z; };
const crackOpen = () => store.sec.beat || LURES[S.lure][0] === "glow";      // the first time, it only opens for a light
const nearCrack = () => store.sec.sleeper && S.hy > (C.MAX_M - 20) * M && Math.abs(S.hx - (OX + 108)) < 16;
// The crack calls the light (Nov 19, 2026): before you've beaten the game, on the glow lure, once you reach the Bone Yard a
// full hook no longer turns you back. Extra fish bump off and you keep sinking, and a full hook at the floor rides up slowly
// past the crack so you can knock. A floor reached that way doesn't count as touching bottom (no bonus, no floor bets).
const crackCalls = () => store.sec.sleeper && !store.sec.beat && LURES[S.lure][0] === "glow" && S.reached >= ZONES[7][1];
function knockCrack() {                                       // a pulse at the crack, from a dive
  if (!crackOpen()) { say("crack", "IT WANTS A LIGHT.", "#c8a0ff", 2.6); play("miss"); return; }
  S.flash = 0.5; play("thunder", 0.6);
  if (S.catch.length || S.bottom) { S.toFlip = true; S.popups.push(["THE CRACK OPENS...", 3, "#c8a0ff"]); beginHaul(); }   // your catch is weighed first
  else startFlip(0);
}
function startFlip(test, end) {
  if (end === undefined) end = !test && store.sec.beat;     // once you've beaten the game, the crack leads to the whole thing
  const L = (end ? FLIP_Z[FLIP_Z.length - 1][2] : DATA.flip.crossing) * M, Lu = LURES[S.lure];
  const seed = (Math.random() * 4294967296) >>> 0, rng = RNG(seed);
  if (!test) { store.sec.crack = true; saveStore(); }       // you've been through it
  FLIP = { test, end, seed, mode: "in", mt: 0, f: test === 2 ? L - 260 : 0, L, rng, chunks: {}, special: [], catch: [], pulses: Lu[0] === "angler" ? 0 : Lu[5], ring: null, scare: null, scared: false,
    zone: -1, sx: LW / 2, wet: 2, gone: new Set(), fight: null, safe: 0, flick: 1, flickT: 4, dim: 0, rise: 0 };
  S.sink = Lu[3]; S.steerK = Lu[4]; S.hx = LW / 2; syncKeys(); S.touchX = null; S.overlay = null; S.popups = [];
  FLIP_Z.slice(0, end ? FLIP_Z.length : 3).forEach((z, zi) => DATA.flip.species.filter(s => s[2] === zi && s[6]).forEach(s => {   // legendaries: each might be out there
    if (rng.random() < (end ? FL_TUNE.legend : 0.3)) FLIP.special.push({ id: s[0], x: rng.uniform(10, LW - 30), y: rng.uniform(z[1] + 6, z[2] - 6) * M, v: (rng.random() < 0.5 ? -1 : 1) * s[4], ph: rng.uniform(0, 6), lb: rng.randint(s[3][0], s[3][1]), leg: true });
  }));
  if (rng.random() < C.MYTHIC_CHANCE) FLIP.special.push({ id: DATA.flip.mythic, x: rng.uniform(10, LW - 30), y: rng.uniform(210, end ? 1100 : 320) * M, v: 18, ph: 0, lb: 40, myth: true });
  setState("flip"); flipDrone(true);
}
function flipChunk(i) {                                       // creatures and lurkers for one 72 px slice of the climb, made when first seen
  if (FLIP.chunks[i]) return FLIP.chunks[i];
  const F = FLIP, rng = RNG(Math.imul(i + 7, 2654435761) ^ F.seed), out = [], y0 = i * C.CHUNK, m = y0 / M;
  if (m < 4 || y0 > F.L - 70) return (F.chunks[i] = { fish: out, jelly: [] });
  const z = flipZoneAt(m), pool = DATA.flip.species.filter(s => s[2] === z && s[5] > 0 && !(F.end && HUNT.has(s[0]))), wsum = pool.reduce((a, s) => a + s[5], 0);
  const per = F.end ? (rng.random() < FL_TUNE.one ? 1 : rng.random() < FL_TUNE.two ? 2 : 3) : (rng.random() < 0.6 ? 1 : 2);   // the Crossing is the gentle one
  const n = Math.round(per * LW / UW);
  for (let k = 0; k < n; k++) {
    let r = rng.random() * wsum, s = pool[0];
    for (const q of pool) { r -= q[5]; if (r <= 0) { s = q; break; } }
    const c = { id: s[0], x: rng.uniform(0, LW - 20), y: y0 + rng.uniform(4, C.CHUNK - 4), v: (rng.random() < 0.5 ? -1 : 1) * s[4] * rng.uniform(0.8, 1.2), ph: rng.uniform(0, 6), lb: rng.randint(s[3][0], s[3][1]) };
    if (F.end && rng.random() < FL_TUNE.trophy) { c.tr = true; c.lb = Math.round(s[3][1] * 1.6); }      // a trophy: bigger, and it fights
    out.push(c);
  }
  const hunters = F.end ? DATA.flip.species.filter(s => s[2] === z && HUNT.has(s[0])) : [];
  for (let k = 0; hunters.length && k < 2; k++) {              // hunters find you: they turn up near your line, however wide the screen
    if (rng.random() >= (FL_TUNE.hunt + FL_TUNE.huntZ * z) * (k ? 0.35 : 1)) break;
    const s = hunters[Math.floor(rng.random() * hunters.length)];
    out.push({ id: s[0], x: clamp(S.hx + rng.uniform(-70, 70) - 6, 0, LW - 20), y: y0 + rng.uniform(4, C.CHUNK - 4), v: (rng.random() < 0.5 ? -1 : 1) * s[4] * rng.uniform(0.8, 1.2), ph: rng.uniform(0, 6), lb: rng.randint(s[3][0], s[3][1]), hunter: true });
  }
  if (rng.random() < 0.08) out.push({ id: rng.random() < 0.5 ? "ftooth" : "hairball", x: rng.uniform(0, LW - 10), y: y0 + rng.uniform(4, 60), v: 0, ph: 0, lb: 1 });
  const jelly = [];
  const jc = F.end ? (FL_TUNE.jelly + z * FL_TUNE.jellyZ) * Math.pow(LW / UW, 1.35)      // a wide screen has more room to dodge in, so a few more
    : Math.round(0.11 * LW / UW * 10) / 10;
  if (rng.random() < jc + (!F.end && z === 2 ? 0.04 : 0)) jelly.push({ x: rng.uniform(8, LW - 20), y: y0 + rng.uniform(8, 64), ph: rng.uniform(0, 6) });
  return (F.chunks[i] = { fish: out, jelly });
}
function flipVisible() {                                      // [chunk index, creature] for everything near the screen, specials included
  const lo = Math.floor((FLIP.f - 80) / C.CHUNK), hi = Math.floor((FLIP.f + FLIP_HOOK_Y + 30) / C.CHUNK), out = [];
  for (let i = Math.max(0, lo); i <= hi; i++) flipChunk(i).fish.forEach(c => { if (!FLIP.gone.has(c)) out.push(c); });
  FLIP.special.forEach(c => { if (!FLIP.gone.has(c) && Math.abs(c.y - FLIP.f) < 260) out.push(c); });
  return out;
}
function flipJellies() { const lo = Math.floor((FLIP.f - 80) / C.CHUNK), hi = Math.floor((FLIP.f + FLIP_HOOK_Y + 30) / C.CHUNK), out = []; for (let i = Math.max(0, lo); i <= hi; i++) out.push(...flipChunk(i).jelly); return out; }
const flipSY = y => FLIP_HOOK_Y - (y - FLIP.f);              // world height -> screen y
const flipK = c => (c.tr ? 1.5 : 1);
function flipRect(c) { const a = DATA.atlas["fc_" + c.id], k = flipK(c), w = Math.round(a[2] * k), h = Math.round(a[3] * k); return [c.x, flipSY(c.y) - (h >> 1), w, h]; }
const flipHookRect = () => [S.hx - 2, FLIP_HOOK_Y - 3, 5, 6];
function flipPulse() {
  if (!FLIP || FLIP.mode !== "climb" || FLIP.fight || FLIP.pulses <= 0) return;
  FLIP.pulses--; FLIP.ring = 0; play("pulse");
  for (const c of flipVisible()) {
    const [x, y, w, h] = flipRect(c), dx = x + w / 2 - S.hx, dy = y + h / 2 - FLIP_HOOK_Y;
    if (Math.hypot(dx, dy) >= 50) continue;
    if (c.hunter) { c.h = { m: "stun", t: 1.8 }; c.fl = 0; }  // a hunter is knocked senseless, and can be caught
    else { c.v = (dx < 0 ? -1 : 1) * Math.max(40, Math.abs(c.v) * 3); c.fl = 1; }
  }
  for (const j of flipJellies()) { const dx = j.x + 6 - S.hx; if (Math.abs(dx) < 50 && Math.abs(flipSY(j.y) - FLIP_HOOK_Y) < 50) j.x += dx < 0 ? -30 : 30; }
}
const flipTop = () => FLIP.L - 36;                            // where your other self's hook hangs
const flipHunting = () => flipVisible().filter(c => c.h && (c.h.m === "wind" || c.h.m === "go")).length;
function flipHunt(c, dt) {                                    // a hunter: notices the hook, winds up, lunges in a straight line. -> true if it grabbed you
  const F = FLIP, U = FL_TUNE, [x, y, w, h] = flipRect(c), dx = S.hx - (x + w / 2), dy = FLIP_HOOK_Y - (y + h / 2), d = Math.hypot(dx, dy), H = c.h;
  if (!H) {                                                   // it only comes down at you, out of the dark above
    if (!c.fl && d < U.sense && dy > 14 && Math.abs(dx) < dy * 1.2 && flipHunting() < U.maxHunt) { c.h = { m: "wind", t: U.wind }; c.v = Math.sign(dx || 1) * Math.abs(c.v); play("growl"); }
    return false;
  }
  H.t -= dt;
  if (H.m === "wind") {                                       // it has seen you: eyes go red, it shivers, then it goes
    if (H.t <= 0) { const k = (U.charge + U.chargeZ * Math.max(0, F.zone)) / Math.max(1, d); c.h = { m: "go", t: U.go, vx: dx * k, vs: dy * k }; c.v = Math.sign(dx || 1) * Math.abs(c.v); play("lunge"); }
    else c.y += F.rise * dt;                                  // it holds its place on screen while it winds up
  } else if (H.m === "go") {                                  // a straight line, aimed where you were: steer out of the way, or pulse it
    c.x += H.vx * dt; c.y += (F.rise - H.vs) * dt;
    const r = flipRect(c);
    if (F.safe <= 0 && overlap(flipHookRect(), [r[0] + 2, r[1] + 1, r[2] - 4, r[3] - 2])) return true;
    if (H.t <= 0) c.h = { m: "rest", t: U.rest };
  } else if (H.t <= 0) c.h = H.m === "stun" ? { m: "rest", t: 1 } : null;
  return false;
}
function flipLand(c) {                                        // on the hook
  const F = FLIP, sp = FSPEC[c.id];
  F.gone.add(c); F.catch.push([c.id, c.lb, c.tr ? 1 : 0]);
  if (sp[6] || c.myth || c.tr) play("fanfare"); else catchSound(F.catch.length);
  if (sp[6]) { S.flash = 0.3; S.popups.push([sp[1] + "!", 3, GOLD]); }
  else if (c.myth) { S.flash = 0.4; S.popups.push(["...THE PRETTY ONE?!", 3.5, "#ffd2f0"]); }
  else if (c.tr) S.popups.push(["TROPHY " + sp[1], 3, TROPHY]);
  if (F.catch.length === C.CAPACITY) S.popups.push(["HOOK FULL. KEEP GOING", 2.4, CYAN]);
}
const SLIMY = /EEL|WORM|LEECH|SLUG|THREAD|SQUID/;
function flipFight(c) {                                        // legendaries and trophies fight, as on top; the Flipside holds still while you do
  const sp = FSPEC[c.id], leg = sp[6], style = SLIMY.test(sp[1]) ? "dart" : sp[4] >= 22 ? "quick" : c.lb >= 60 ? "heavy" : "shrink";
  FLIP.fight = Object.assign(newFight((leg ? 3 : 2) + (style === "heavy" ? 1 : 0), style, c.lb), { c });
  S.touchX = null; play("select");
}
function flipFightTap() {
  const F = FLIP, fg = F.fight, r = fightHit(fg);
  if (r === "win") { F.fight = null; F.safe = 0.8; flipLand(fg.c); }
  else if (r === "lost") flipFightLost("IT GOT AWAY!");
}
function flipFightLost(msg) { const F = FLIP, c = F.fight.c; F.fight = null; F.safe = 0.8; c.v = (c.x + 6 < S.hx ? -1 : 1) * 60; c.fl = 1.5; S.popups.push([msg, 1.8, RED]); play("miss"); }
function flipFail(msg) { const F = FLIP; F.mode = "fail"; F.mt = 0; S.shake = 0.5; S.flash = 0.4; play("zap"); S.popups.push([msg, 3, ORANGE]); }
function flipUpdate(dt) {
  const F = FLIP;
  F.mt += dt;
  S.popups.forEach(p => { p[1] -= dt; }); S.popups = S.popups.filter(p => p[1] > 0); S.flash = Math.max(0, S.flash - dt);
  if (F.ring !== null) { F.ring += dt * 2; if (F.ring > 1) F.ring = null; }
  if (F.end) {                                                // the light flickers, and now and then nearly goes out
    if ((F.flickT -= dt) <= 0) { F.flickT = 5 + Math.random() * 9; F.dim = 0.3 + Math.random() * 0.6; }
    F.dim = Math.max(0, F.dim - dt);
    F.flick = F.dim > 0 ? 0.5 + 0.15 * Math.sin(T * 40) : 0.92 + 0.08 * Math.sin(T * 23) * Math.sin(T * 7.3);
  }
  if (F.mode === "in") { if (F.mt > 1.1) { F.mode = "climb"; F.mt = 0; S.popups.push([F.end ? "THE WHOLE FLIPSIDE" : "THE FLIPSIDE", 3, "#ff8ca0"]); } return; }
  if (F.mode === "meet") { if (F.mt > 2.6) { F.mode = "out"; F.mt = 0; S.flash = 1; play("thunder"); } return; }
  if (F.mode === "fail") { if (F.mt > 1.8) { F.mode = "out"; F.mt = 0; } return; }
  if (F.mode === "out") { if (F.mt > 1.2) endFlip(); return; }
  if (F.fight) { if (fightTick(F.fight, dt)) flipFightLost("TOO SLOW! GOT AWAY"); return; }
  steer(dt);
  F.safe = Math.max(0, F.safe - dt);
  const top = flipTop() - 2, f0 = F.f;
  if (F.f < top) F.f = Math.min(top, F.f + 62 * S.sink * dt);           // you keep falling; the world rises
  F.rise = (F.f - f0) / dt;
  const m = F.f / M, z = flipZoneAt(m);
  if (z !== F.zone && (F.end || z < 3)) {
    F.zone = z; S.popups = S.popups.filter(p => !FLIP_Z.some(q => q[0] === p[0])); S.popups.push([FLIP_Z[z][0], 2.6, "#ff8ca0"]);
    if (F.end && F.zone > 0 && LURES[S.lure][0] !== "angler") F.pulses = Math.min(LURES[S.lure][5], F.pulses + 1);   // each new zone gives back one pulse
  }
  if (!F.scared && F.f > F.L * 0.5) { F.scared = true; F.scare = 0; play("thunder", 0.8); SOUNDS.roar = [[70, 1.8, "sawtooth", 0.4, 30], [48, 2, "square", 0.25, 25, 0.2]]; play("roar"); }   // something huge passes behind you
  if (F.scare !== null) { F.scare += dt; if (F.scare > 5) F.scare = null; }
  if ((F.wet -= dt) <= 0) { F.wet = 1.5 + Math.random() * 3.5; flipSquelch(); }
  const glow = LURES[S.lure][8];
  for (const c of flipVisible()) {                            // creatures swim; the glow lure draws them in a little
    if (c.hunter && flipHunt(c, dt)) { flipFail("GRABBED BY " + (FSPEC[c.id][1].length > 12 ? "SOMETHING" : FSPEC[c.id][1])); return; }
    if (c.h && c.h.m !== "rest") continue;
    c.x += c.v * dt;
    if (c.fl) { c.fl -= dt; if (c.fl <= 0) { c.fl = 0; c.v = Math.sign(c.v) * Math.max(6, FSPEC[c.id][4]); } }
    if (glow && !c.fl) { const dx = S.hx - (c.x + 6), dy = FLIP_HOOK_Y - flipSY(c.y); if (Math.hypot(dx, dy) < glow * 2) c.x += Math.sign(dx) * 10 * dt; }
    if (c.x > LW + 24) c.x = -24; else if (c.x < -24) c.x = LW + 24;
  }
  const hook = flipHookRect();
  for (const j of flipJellies()) {                            // a flesh jelly ends the trip
    j.x += Math.sin(T * 0.7 + j.ph) * 6 * dt;
    if (glow) j.x += Math.sign(S.hx - j.x - 6) * 4 * dt;
    if (overlap(hook, [j.x + 2, flipSY(j.y) - 3, 9, 7])) { flipFail("A FLESH JELLY GOT YOU"); return; }
  }
  for (const c of flipVisible()) {                            // catching, or bumping off a full hook
    if (c.fl || (c.h && (c.h.m === "wind" || c.h.m === "go")) || !overlap(hook, flipRect(c))) continue;
    const sp = FSPEC[c.id], legOn = F.catch.some(q => FSPEC[q[0]][6]);
    if (F.catch.length >= C.CAPACITY || (sp[6] && legOn)) { c.v = (c.x + 6 < S.hx ? -1 : 1) * 60; c.fl = 0.8; c.h = null; play("tick"); continue; }
    if (F.end && (sp[6] || c.tr)) { flipFight(c); return; }
    flipLand(c);
  }
  if (F.f >= top - 1) {                                        // your other self dangles its hook: catch it
    const mx = LW / 2 + Math.sin(T * 0.9) * Math.min(40, LW * 0.3);
    if (Math.abs(S.hx - mx) < 5) { F.mode = "meet"; F.mt = 0; F.mx = mx; F.won = true; S.flash = 0.6; play("fanfare"); S.popups.push(["YOU CAUGHT YOURSELF", 4, "#ff8ca0"]); }
  }
}
function flipLogCatch(list) {
  list.forEach(([id, lb, tr]) => { const e = store.flip.log[id] || (store.flip.log[id] = { n: 0, rec: 0 }); e.n++; e.rec = Math.max(e.rec, lb); if (tr) e.star = true; });
}
function endFlip() {
  const F = FLIP;
  flipDrone(false);
  FLIP = null;
  newDive();
  if (F.test) { S.popups.push([F.won ? "TEST: YOU MADE IT" : "TEST OVER", 3, GREY]); return; }
  if (F.end) { endgameDone(F); return; }
  store.sec.crossed = true;
  if (F.won) {
    store.flip.runs++; store.flip.wins++;
    flipLogCatch(F.catch);
    const first = !store.sec.beat;
    store.sec.beat = true;
    findSecret("crossing");
    if (award("otherside")) S.popups.push(["NEW TITLE: THE OTHER SIDE", 5, GOLD]);
    earnSong(10);
    saveStore();
    if (first) { CRED = { y: 0, done: false }; S.overlay = "credits"; if (LB.url) LB.load(); }   // the credits roll the first time
    else S.popups.push(["YOU CAUGHT YOURSELF AGAIN", 3, "#ff8ca0"]);
  } else { store.flip.runs++; saveStore(); S.popups.push(["BACK ON TOP. FOR NOW.", 3, "#ff8ca0"]); }
}

// ---- the endgame's score, Bestiary and rewards
const BESTIARY = DATA.flip.species.filter(s => !DATA.flip.junk.includes(s[0]) && s[0] !== DATA.flip.mythic);   // the 123
const flipZoneFull = z => BESTIARY.filter(s => s[2] === z).every(s => store.flip.log[s[0]]);
const flipFullZones = () => FLIP_Z.filter((q, z) => flipZoneFull(z)).length;
const flipAllLegends = () => BESTIARY.filter(s => s[6]).every(s => store.flip.log[s[0]]);
// [id, name, how to earn it, earned?, what it gives: ["toggle", eq key] | [cosmetic kind, index] | ["title", id]]
const FLIP_REWARDS = [
  ["mon", "MONSTER FORM", "CATCH YOURSELF AS THIS CHARACTER", () => store.flip.mons.includes(store.eq.char), ["toggle", "mon"]],
  ["mpet", "MONSTER PETS", "FILL ANY FLIPSIDE ZONE", () => flipFullZones() >= 1, ["toggle", "mpet"]],
  ["bile", "BILE LINE", "FILL 5 FLIPSIDE ZONES", () => flipFullZones() >= 5, ["line", SHOP_N.line]],
  ["vein", "VEIN LINE", "EVERY FLIPSIDE LEGENDARY", flipAllLegends, ["line", SHOP_N.line + 1]],
  ["maw", "MAW BOAT", "FILL THE WHOLE BESTIARY", () => BESTIARY.every(s => store.flip.log[s[0]]), ["boat", SHOP_N.boat]],
  ["mhat", "MONSTER HATS", "ALL 22 MONSTER FORMS", () => store.flip.mons.length >= DATA.chars.length, ["toggle", "mhat"]],
].concat(FLIP_Z.map((z, i) => ["fzone" + i, titleName("fzone" + i), "FILL " + z[0], () => flipZoneFull(i), ["title", "fzone" + i]]))
  .concat([["flegends", "MONSTER HUNTER", "EVERY FLIPSIDE LEGENDARY", flipAllLegends, ["title", "flegends"]],
    ["bestiary", "BESTIARY KEEPER", "FILL THE WHOLE BESTIARY", () => BESTIARY.every(s => store.flip.log[s[0]]), ["title", "bestiary"]],
    ["allofme", "ALL OF ME", "ALL 22 MONSTER FORMS", () => store.flip.mons.length >= DATA.chars.length, ["title", "allofme"]]]);
function flipDone(id) { const r = FLIP_REWARDS.find(q => q[0] === id); return !!r && r[3](); }
const flipEarned = () => FLIP_REWARDS.filter(r => r[0] !== "mon" && r[3]()).map(r => r[0]);
function flipRewardWorn(rw) { return rw[0] === "toggle" ? !!store.eq[rw[1]] : rw[0] === "title" ? store.eq.title === rw[1] : store.eq[rw[0]] === rw[1]; }
function flipRewardToggle(r) {
  if (!r[3]()) { play("miss"); return; }
  const rw = r[4], on = flipRewardWorn(rw);
  if (rw[0] === "toggle") store.eq[rw[1]] = on ? 0 : 1;
  else if (rw[0] === "title") store.eq.title = on ? "rookie" : rw[1];
  else store.eq[rw[0]] = on ? 0 : rw[1];
  saveStore(); play("select");
}
function flipScore(list) {                                   // the creatures' weight times the same additive set bonuses as on top
  const ids = list.map(c => c[0]), zones = ids.map(i => FSPEC[i][2]), sets = [];
  if (ids.length === 3) {
    if (list.every(c => c[2] || FSPEC[c[0]][6])) sets.push([1, "TROPHY CASE"]);
    if (new Set(ids).size === 1) sets.push([2, "3 OF A KIND"]);
    if (Math.min(...zones) >= 7) sets.push([1, "TOP TRIO"]);          // the last three zones, nearest the surface
    if (new Set(zones).size === 3) sets.push([1, "GRAND TOUR"]);
  }
  if (ids.length - new Set(ids).size === 1) sets.push([0.5, "A PAIR"]);
  const mult = Math.min(5, 1 + sets.reduce((a, s) => a + s[0], 0)), base = list.reduce((a, c) => a + c[1], 0);
  return { sets, mult, total: Math.round(base * mult) };
}
function endgameDone(F) {
  store.flip.runs++;
  if (!F.won) { saveStore(); S.popups.push(["THE FLIPSIDE KEEPS IT ALL", 3, "#ff8ca0"]); return; }
  store.flip.wins++;
  const had = flipEarned(), news = [], ch = store.eq.char;
  const isNew = F.catch.map(([id]) => !store.flip.log[id]);
  flipLogCatch(F.catch);
  if (!store.flip.mons.includes(ch)) { store.flip.mons.push(ch); news.push(["MONSTER " + DATA.chars[ch] + "!", "#ff8ca0"]); }   // you caught yourself: now you can be that
  flipEarned().filter(id => !had.includes(id)).forEach(id => {
    const r = FLIP_REWARDS.find(q => q[0] === id), rw = r[4];
    if (rw[0] === "title") { award(rw[1]); news.push(["NEW TITLE: " + r[1], GOLD]); }
    else { if (rw[0] !== "toggle" && !store.own[rw[0]].includes(rw[1])) store.own[rw[0]].push(rw[1]); news.push(["UNLOCKED: " + r[1], GOLD]); }
  });
  const sc = flipScore(F.catch), record = sc.total > store.flip.best;
  if (record) store.flip.best = sc.total;
  saveStore();
  S.fhaul = { rows: F.catch.map((c, i) => [c[0], c[1], c[2], isNew[i]]), sets: sc.sets, mult: sc.mult, total: sc.total, record, news };
  S.overlay = "fhaul";
  const packed = F.catch.map(c => c[0] + ":" + c[1] + (c[2] ? ":T" : "")).join(",") + "|" + sc.mult, ti = titleName(store.eq.title);
  if (sc.total > 0 && LB.url) {
    if (store.name) LB.submit(store.name, sc.total, packed, ti, "/flip");
    else askName(n => { if (n) LB.submit(n, sc.total, packed, ti, "/flip"); });
  }
}

// ---- sound: a low drone and wet noises
let DRONE = null;
function flipDrone(on) {
  if (!AC) return;
  if (!on) { if (DRONE) { try { DRONE.g.gain.setTargetAtTime(0, AC.currentTime, 0.3); DRONE.o.forEach(o => o.stop(AC.currentTime + 1.5)); } catch (e) { /* already stopped */ } } DRONE = null; return; }
  if (DRONE) return;
  try {
    const g2 = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
    g2.gain.value = 0; g2.gain.setTargetAtTime(0.07, AC.currentTime, 1.2); lp.connect(g2); g2.connect(AC.destination);
    const o = [55, 55.6, 82.4].map(f => { const x = AC.createOscillator(); x.type = "sawtooth"; x.frequency.value = f; x.connect(lp); x.start(); return x; });
    DRONE = { g: g2, o };
  } catch (e) { DRONE = null; }
}
function flipSquelch() {
  if (!AC || AC.state !== "running") return;
  try {
    const len = Math.floor(AC.sampleRate * 0.25), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = AC.createBufferSource(), bp = AC.createBiquadFilter(), ga = AC.createGain(), t0 = AC.currentTime;
    src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 6; bp.frequency.setValueAtTime(300 + Math.random() * 300, t0); bp.frequency.exponentialRampToValueAtTime(900 + Math.random() * 600, t0 + 0.2);
    ga.gain.value = 0.25; src.connect(bp); bp.connect(ga); ga.connect(AC.destination); src.start();
  } catch (e) { /* no sound, no matter */ }
}

// ---- drawing
let darkC = null;
const LIGHTS = new Set(["facelantern", "dimbulb", "palelure", "lastlight", "drownedangler", "simmer", "wailingwisp"]);   // things that carry their own light
function flipDark(F) {
  if (!darkC || darkC.width !== LW) { darkC = document.createElement("canvas"); darkC.width = LW; darkC.height = LH; }
  const d = darkC.getContext("2d"), near = clamp((F.L - 36 - F.f) / (80 * M), 0, 1);     // it lifts a little near the surface
  d.globalCompositeOperation = "source-over"; d.clearRect(0, 0, LW, LH);
  d.fillStyle = "rgba(10,2,6," + (0.5 + 0.38 * near).toFixed(3) + ")"; d.fillRect(0, 0, LW, LH);
  d.globalCompositeOperation = "destination-out";
  const hole = (x, y, r) => { const gr = d.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.6, "rgba(0,0,0,0.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2); };
  hole(S.hx, FLIP_HOOK_Y, (LURES[S.lure][8] ? FL_TUNE.glowLight : FL_TUNE.light) * F.flick);
  const vis = flipVisible();
  vis.forEach(c => { if (LIGHTS.has(c.id)) { const [x, y, w, h] = flipRect(c); if (y > -20 && y < LH + 20) hole(x + w / 2, y + h / 2, 13 * F.flick); } });
  g.drawImage(darkC, 0, 0);
  g.globalAlpha = 0.3;                                         // flesh jellies give off a faint glow, so you can see them coming
  flipJellies().forEach(j => { const y = flipSY(j.y) + Math.round(Math.sin(T * 2 + j.ph) * 2); if (y > -20 && y < LH + 20) spr("flurker", j.x, y - 6); });
  g.globalAlpha = 1;
  vis.forEach(c => {                                           // and hunters' eyes shine: yellow while they look, red when they come
    if (!c.hunter || (c.h && c.h.m === "stun")) return;
    const [x, y, w, h] = flipRect(c), hot = c.h && (c.h.m === "wind" || c.h.m === "go"), ex = c.v < 0 ? x + 2 : x + w - 4, ey = y + Math.max(1, Math.floor(h / 3));
    if (y < -10 || y > LH + 10 || (!hot && Math.floor(T * 1.3 + c.ph) % 5 === 0)) return;    // they blink
    rect(hot ? "#ff3030" : "#ffd246", ex, ey, 1, 1); rect(hot ? "#ff3030" : "#ffd246", ex + (c.v < 0 ? 2 : -2), ey, 1, 1);
  });
}
let flipTint = null;
function drawFlip() {
  const F = FLIP, t = T;
  g.save();
  if (F.mode === "in" || F.mode === "out") {                 // the screen turns over
    const u = F.mode === "in" ? 1 - Math.min(1, F.mt / 1.1) : Math.min(1, F.mt / 1.2);
    g.translate(LW / 2, LH / 2); g.rotate(u * Math.PI); g.translate(-LW / 2, -LH / 2);
  }
  if (S.shake > 0) g.translate(Math.round(Math.sin(t * 50) * 2), 0);
  // the mirrored ocean: the topside at depth (1160 - height), flipped left to right, gone red
  const srcTop = DEPTH_PX - (F.f + FLIP_HOOK_Y), wW = DATA.waterW || water.width;
  rect("#120408", 0, 0, LW, LH);
  g.save(); g.translate(LW, 0); g.scale(-1, 1);
  const sy0 = Math.max(0, srcTop), dy0 = sy0 - srcTop;
  g.drawImage(water, Math.max(0, (wW - LW) >> 1), sy0, Math.min(LW, wW), LH - dy0, 0, dy0, LW, LH - dy0);
  g.restore();
  g.globalCompositeOperation = "color"; g.globalAlpha = 0.8; rect("#c83c50", 0, 0, LW, LH);       // gone red
  g.globalCompositeOperation = "screen"; g.globalAlpha = 1; rect("#5a1422", 0, 0, LW, LH);           // and lit like the topside, not like the deep
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  const k0 = Math.floor((F.f - 60) / C.CHUNK);
  for (let k = k0; k < k0 + 5; k++) {                          // vein strands and drifting motes, fixed to the world
    const r = RNG(k * 977 + 13);
    for (let q = 0; q < Math.round(2 * LW / UW); q++) {
      let x = r.uniform(0, LW); const y0 = flipSY(k * C.CHUNK + C.CHUNK), len = r.randint(20, 60);
      for (let j = 0; j < len; j++) { x += Math.sin(j * 0.25 + q + t * 0.6) * 0.5; rect(j % 7 === 3 ? "#be3c50" : "#8c1e32", x, y0 + j, 1, 1); }
    }
    for (let q = 0; q < Math.round(8 * LW / UW); q++) rect(q % 3 ? "#e68c96" : "#ffe678", (r.uniform(0, LW) + Math.sin(t + q) * 2) % LW, flipSY(k * C.CHUNK + r.uniform(0, C.CHUNK)), 1, 1);
  }
  if (F.scare !== null) {                                      // something enormous drifts past behind you, and leaves
    const u = F.scare / 5, x = -260 + u * (LW + 520), y = 70 + Math.sin(u * 3) * 10;
    g.globalAlpha = 0.55 * Math.sin(u * Math.PI);
    ell("#200810", x - 130, y - 40, 260, 80); ell("#200810", x + 90, y - 20, 90, 40);
    for (let k = 0; k < 6; k++) ell("#200810", x - 120 - k * 26, y + 20 + Math.sin(t * 2 + k) * 8, 30, 10);
    g.globalAlpha = 0.9 * Math.sin(u * Math.PI); disc("#ffd246", x + 100, y - 6, 4); rect(INK, x + 100, y - 9, 1, 6);
    g.globalAlpha = 1;
  }
  const cy = flipSY(0);                                        // the crack you came through, below you
  if (cy < LH + 20) { g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2); ell("#c8a0ff", LW / 2 - 14, cy - 5, 28, 12); g.globalAlpha = 1; line("#05030a", LW / 2, cy - 4, LW / 2 + 1, cy + 4); }
  flipJellies().forEach(j => { const y = flipSY(j.y) + Math.round(Math.sin(t * 2 + j.ph) * 2); if (y > -20 && y < LH + 20) spr("flurker", j.x, y - 6); });
  flipVisible().forEach(c => {
    const [x0, y, w] = flipRect(c), x = x0 + (c.h && c.h.m === "wind" ? Math.round(Math.sin(t * 60)) : 0);
    if (y < -24 || y > LH + 24) return;
    spr("fc_" + c.id, x, y, c.v < 0, flipK(c));
    if (c.h && c.h.m === "stun") for (let k = 0; k < 3; k++) rect("#ffe678", x + w / 2 + Math.cos(t * 6 + k * 2.1) * 5, y - 3 + Math.sin(t * 6 + k * 2.1) * 2, 1, 1);   // seeing stars
    if (c.tr && !FSPEC[c.id][6] && Math.floor(t * 3 + c.ph) % 3 === 0) rect(TROPHY, x + ((t * 20) % w), y - 1, 1, 1);
    if (FSPEC[c.id][6]) for (let k = 0; k < 3; k++) { const a = t * 3 + k * 2.1; rect(GOLD, x + w / 2 + Math.cos(a) * (w / 2 + 3), y + 4 + Math.sin(a) * 6, 1, 1); }
    if (c.myth) for (let k = 0; k < 4; k++) rect(WHITE, x + ((t * 30 + k * 7) % 14) - 2, y - 2 + ((k * 5 + Math.floor(t * 8)) % 10), 1, 1);
  });
  const top = flipSY(F.L);                                     // the surface overhead, and the other you
  if (top > -40) {
    rect("#1a0610", 0, 0, LW, Math.max(0, top));
    for (let x = 0; x < LW; x += 6) rect("#c8788c", x, top, 3, 1);
    const bx = Math.round(LW / 2 - 30), mx = F.mode === "meet" ? F.mx : LW / 2 + Math.sin(T * 0.9) * Math.min(40, LW * 0.3), my = flipSY(flipTop());
    g.save(); g.translate(0, top * 2 + 2); g.scale(1, -1);       // everything up there hangs upside down
    angler(bx, top - 9, Object.assign({}, store.eq, { flag: 0 }), top, true);    // a monster you, with a monster pet
    g.restore();
    for (let k = 0; k < Math.round(12 * LW / UW); k++) if ((k * 7 + Math.floor(T * 2)) % 5) rect("#5a1e2a", (k * 53) % LW, (k * 29) % Math.max(1, top), 1, 1);   // a dim sky up there
    line("#a0dc78", bx + 18, top + 22, mx, my);                 // its line, from its own hand down to you
    ring("#a0dc78", mx, my + 3, 2);
  }
  if (F.end) flipDark(F);                                      // the endgame is dark: only your light, and what glows
  // your line runs back down through the crack; your hook points up now
  line(lineCol(0), S.hx, LH, S.hx, FLIP_HOOK_Y + 4);
  g.save(); g.translate(S.hx + 3, FLIP_HOOK_Y + 3); g.rotate(Math.PI); spr("hook" + store.eq.hook, 0, 0); g.restore();
  F.catch.forEach(([id], i) => { const a = DATA.atlas["fc_" + id]; g.save(); g.translate(S.hx, FLIP_HOOK_Y + 8 + i * 5); g.rotate(Math.PI / 2); spr("fc_" + id, -2, -(a[3] >> 1)); g.restore(); });
  if (F.ring !== null) { const r = Math.floor(6 + F.ring * 46); ring("#ffb4c8", S.hx, FLIP_HOOK_Y, r); }
  g.restore();
  if (S.flash > 0) { g.globalAlpha = Math.min(1, S.flash); rect(F.mode === "out" ? WHITE : "#ffd2dc", 0, 0, LW, LH); g.globalAlpha = 1; }
  if (F.mode === "out") { g.globalAlpha = Math.min(1, F.mt / 1.2); rect(WHITE, 0, 0, LW, LH); g.globalAlpha = 1; }
  // the HUD stays the right way up
  if (F.mode === "climb" || F.mode === "meet" || F.mode === "fail") {
    const left = Math.max(0, Math.round((flipTop() - F.f) / M));
    text(left ? left + " M TO GO" : "CATCH YOURSELF", LW / 2, 8, 1, "#ff8ca0", "center");
    text("CATCH " + F.catch.length + "/" + C.CAPACITY, LW / 2, 18, 1, "#e6b4be", "center", null);
    if (LURES[S.lure][0] !== "angler") {                    // the Angler's Hook has no pulse over here
      box(2, 176, 36, 22, F.pulses ? "#ff8ca0" : "#5a3a46"); text("PULSE", 20, 183, 1, F.pulses ? "#ff8ca0" : "#7a5a66", "center", null);
      for (let k = 0; k < F.pulses; k++) rect("#ff8ca0", 8 + k * 9, 190, 6, 3);
    }
    if (F.test) { text("TEST", LW - 4, KEYS ? 182 : 192, 1, GREY, "right", null); if (KEYS) text("ESC: QUIT", LW - 4, 192, 1, GREY, "right", null); }
    if (F.fight) { g.save(); g.translate(OX, 0); drawFightBox(F.fight, FSPEC[F.fight.c.id][1], FSPEC[F.fight.c.id][6]); g.restore(); }
    S.popups.slice(-2).forEach((p, i) => { const tw = textW(p[0], 1); box(Math.floor(LW / 2 - tw / 2) - 4, 32 + i * 13, tw + 8, 11, p[2]); text(p[0], LW / 2, 37 + i * 13, 1, p[2], "center", null); });
  }
}

// ---- the credits, after catching yourself
const CREDITS = [["DIRECTED BY", "A VERY PATIENT FOX"], ["LEAD FISH WRANGLER", "WHOEVER IS READING THIS"], ["HEAD OF JELLYFISH RELATIONS", "PLEASE STOP TOUCHING THEM"],
  ["HOOK SHARPENING", "THE GOLD HOOK, WHO INSISTED"], ["CATERING", "WHATEVER THE GULPER DIDN'T EAT"], ["LEGAL COUNSEL", "THE KRAKEN'S LAWYERS (EIGHT OF THEM)"],
  ["WEATHER", "THE STORM, ON A PART-TIME BASIS"], ["QUALITY ASSURANCE", "EVERYONE WHO GOT ZAPPED"], ["ALARM CLOCK FOR THE SLEEPER", "YOU. IT IS STILL UPSET."],
  ["MOST CAUGHT FISH", "THE MINNOW, UNWILLINGLY"], ["WARDROBE", "THE PENGUIN WHO KEEPS BUYING HATS"], ["SPECIAL THANKS", "THE RUBBER DUCK, FOR LISTENING"],
  ["BOOT CONSULTANT", "THE GOLDEN BOOT, STILL MISSING ITS PAIR"], ["APPEARING COURTESY OF NOBODY WHO WILL ADMIT IT", "THE BROWN TROUT"],
  ["DISCLAIMER", "NO BOOTS WERE HARMED. ONE BOOT WAS HARMED."]];
let CRED = null;
function creditLines() {                                       // [text, colour, gap after]
  const out = [["REEL DEEP", GOLD, 18]];
  CREDITS.forEach(([role, who]) => { wrap(role, 19).forEach(l => out.push([l, "#a090c0", 0])); wrap(who, 19).forEach(l => out.push([l, WHITE, 0])); out[out.length - 1][2] = 10; });
  out.push(["PLAYTESTERS", "#a090c0", 0]);
  const names = [...new Set((LB.all || []).map(e => e.n))];
  (names.length ? names : ["EVERYONE ON THE", "ALL TIME BOARD"]).forEach(n => out.push([n, CYAN, 0]));
  out[out.length - 1][2] = 24;
  out.push(["THE END", GOLD, 12], ["THANK YOU FOR PLAYING.", WHITE, 4], ["THE OTHER YOU", "#ff8ca0", 0], ["SAYS HI.", "#ff8ca0", 0]);
  return out;
}
function drawCredits() {
  rect("#08040e", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const ls = creditLines(); let y = LH - CRED.y;
  for (const [s2, col, gap] of ls) { if (y > -10 && y < LH + 10) text(s2, 60, y, s2 === "REEL DEEP" ? 2 : 1, col, "center", null); y += 10 + gap + (s2 === "REEL DEEP" ? 10 : 0); }
  CRED.end = y;
  if (CRED.done) text("TAP TO CONTINUE", 60, 194, 1, GREY, "center", null);
  g.restore();
}
function creditsTick(dt) {
  if (!CRED || S.overlay !== "credits") return;
  if (CRED.end === undefined || CRED.end > LH / 2) CRED.y += dt * (CRED.fast ? 60 : 16); else CRED.done = true;
}

// The Sleeper's outline, one side mirrored: a lumpy skull, a neck, hunched shoulders, then arms sloping down to the claws.
const SL_PROF = [[0, 1], [0.1, 0.96], [0.2, 1.01], [0.3, 0.94], [0.38, 0.8], [0.44, 0.64], [0.52, 0.6], [0.6, 0.7], [0.68, 0.74], [0.76, 0.66], [0.84, 0.46], [0.92, 0.24], [1, 0.02]];
function slShape(u) { u = Math.min(1, Math.abs(u)); let i = 1; while (i < SL_PROF.length - 1 && SL_PROF[i][0] < u) i++; const [u0, h0] = SL_PROF[i - 1], [u1, h1] = SL_PROF[i], k = (u - u0) / (u1 - u0); return h0 + (h1 - h0) * (1 - Math.cos(k * Math.PI)) / 2; }
const slRX = () => Math.min(LW * 1.2, 190) / 2;
function slY(b, x) { return 200 - (200 - b.bodyY) * slShape((x - LW / 2) / slRX()) + Math.round(Math.sin(x * 0.7) * 0.8 + Math.sin(x * 0.23) * 1.2); }   // the top of its body at screen x

// ---- the fight. Reach the floor with an empty hook and pulse at the eye to wake it.
// Hard on purpose: three hits and you're thrown back; tuned with bots in tools/tests (see tools/README.md).
const SL_PHASES = [null,
  { body: 132, need: 4, eyes: [[0, 20, 14]] },
  { body: 124, need: 5, eyes: [[-24, 18, 11], [24, 18, 11]] },
  { body: 110, need: 5, eyes: [[-30, 20, 6], [30, 22, 6], [-12, 12, 5], [14, 14, 5], [0, 28, 6]] }];
const SL_TOTAL = 14, SL_REACH = 46, SL_SPEED = 95, SL_RECHARGE = 1.5;
// Tuned with tools/tests/test_sleeper.py. Kade: phases 1-2 were too easy (you could sit against its head), phase 3 far
// too hard. Now sweeps skim its head, hugging it gets you shrugged off, and phase 3 has fewer, slower attacks.
// Careful bot: reaches phase 3 in 80-90% of fights, wins 25-35%. Sloppy bot: past phase 1 in ~75%, wins ~1-2%.
// Parking against its head does clearly worse than playing properly. Re-run it after changing these.
const SL_TUNE = { tent: [0, 1.6, 1.2, 2.6], tentSpeed: [0, 225, 295, 270], double: [0, 0.25, 0.6, 0.25], ink: 4.5, ring: 4.0, ringSpeed: 72, ringGap: 2.0,
  lunge: 8, lungeWarn: 1.4, hug: 1.0, eye1: [2.0, 4.0], eye2: [1.3, 2.0], eye3: [1.25, 1.5] };   // eye1: open for, out of every; eye2: each eye open for, then the other after; eye3: open for, every
function slEyes(b) { b.hug = 0; b.shrugT = -1; b.lungeLift = 0; b.shrugLift = 0; b.eyes = SL_PHASES[b.phase].eyes.map(([x, dy, r]) => ({ x, dy, r, y: b.bodyY + dy, open: 0, want: 0, cool: 0 })); b.eyeT = 0; b.eyeIdx = -1; }
// Test link: add ?boss to the game's address to jump straight into the fight (?boss=2 or ?boss=3 starts at that phase).
// A test fight is a dream: no rewards, no crack, nothing saved. It restarts when it ends; Escape quits to the title.
const TEST_BOSS = (() => { try { const q = new URLSearchParams(location.search); return q.has("boss") ? clamp(parseInt(q.get("boss"), 10) || 1, 1, 3) : 0; } catch (e) { return 0; } })();
function startBoss(dream, test) {
  BOSS = { dream: !!dream, test: test || 0, mode: "wake", mt: 0, phase: 1, hits: 0, phaseHits: 0, hp: 1, lives: 3, charge: 1, hx: LW / 2, hy: 56, keys: new Set(), touch: null, inv: 0, shake: 2.2,
    base: 210, lift: 0, lungeLift: 0, shrugLift: 0, hug: 0, shrugT: -1, bodyY: 210, eyes: [], tentacles: [], warn: [], ink: [], rings: [], lunge: 0, lungeT: -1, ring: null, crack: false,
    rubble: Array.from({ length: 8 }, (_, i) => [Math.round(Math.random() * LW), 30 + i * 9, i * 7]), msg: "SOMETHING WAKES...", tm: { tent: 2.4, ink: 3, ring: 2, lunge: 4.5 } };
  if (test > 1) { BOSS.phase = test; BOSS.hits = SL_PHASES.slice(1, test).reduce((a, q) => a + q.need, 0); BOSS.hp = 1 - BOSS.hits / SL_TOTAL; BOSS.msg = "TEST: PHASE " + test; }
  else if (test) BOSS.msg = "TEST FIGHT";
  slEyes(BOSS);
  S.overlay = null; S.touchX = null; syncKeys(); setState("boss"); play("thunder"); SOUNDS.roar = [[90, 1.2, "sawtooth", 0.35, 40], [60, 1.4, "square", 0.2, 30, 0.1]]; play("roar");
  if (!dream && !store.sec.woke) { store.sec.woke = true; saveStore(); findSecret("sleeper"); }
}
function bossHurt(b) {
  if (b.inv > 0 || b.mode !== "fight") return;
  b.lives--; b.inv = 1.3; b.shake = 0.4; S.flash = 0.25; play("zap");
  if (b.lives <= 0) { b.mode = "lose"; b.mt = 0; b.msg = "THROWN BACK!"; b.tentacles = []; b.rings = []; play("miss"); }
}
function bossPulse() {
  const b = BOSS;
  if (!b || b.mode !== "fight" || b.charge < 1) return;
  b.charge = 0; b.ring = 0; play("pulse");
  for (const e of b.eyes) {
    if (e.open < 0.6 || Math.hypot(b.hx - (LW / 2 + e.x), b.hy - e.y) > SL_REACH + e.r) continue;
    e.open = 0; e.want = 0; e.cool = 0.9; b.hits++; b.phaseHits++; b.shake = 0.3; b.hp = 1 - b.hits / SL_TOTAL; play("hit");
    if (b.phaseHits >= SL_PHASES[b.phase].need) {
      b.tentacles = []; b.warn = []; b.rings = []; b.ink = []; b.lungeT = -1; b.lift = 0; b.shake = 1.4; play("roar");
      if (b.phase === 3) { b.mode = "win"; b.mt = 0; b.msg = "IT SINKS BACK DOWN"; b.crack = !b.dream; }
      else { b.mode = "roar"; b.mt = 0; b.phase++; b.phaseHits = 0; b.msg = b.phase === 2 ? "IT'S ANGRY!" : "IT'S FURIOUS!"; slEyes(b); }
    }
    break;                                                  // one eye per pulse
  }
}
function bossMove(b, dt) {
  let dx = 0, dy = 0;
  if (b.touch) { const tx = b.touch[0] - b.hx, ty = b.touch[1] - 14 - b.hy, d = Math.hypot(tx, ty); if (d > 1) { const v = Math.min(d, SL_SPEED * 1.35 * dt); dx = tx / d * v; dy = ty / d * v; } }
  else { for (const k of b.keys) { if (k === "L") dx -= 1; if (k === "R") dx += 1; if (k === "U") dy -= 1; if (k === "D") dy += 1; } const n = Math.hypot(dx, dy) || 1; dx = dx / n * SL_SPEED * dt; dy = dy / n * SL_SPEED * dt; }
  b.hx = clamp(b.hx + dx, 4, LW - 4); b.hy = Math.max(32, b.hy + dy);
  const floor = slY(b, b.hx) - 5;
  if (b.hy > floor) { if (b.lift > 2 && b.mode === "fight") bossHurt(b); b.hy = floor; }       // its body pushes you away; a lunge hurts
}
function tentPoints(t) {                                    // the tentacle's discs: [x, y, r]
  const out = [];
  for (let i = 0; i < 22; i++) { const u = i / 21; out.push([t.x + t.dir * i * 6, t.y + Math.sin(T * 3 + i * 0.45 + t.ph) * (3 + u * 6), Math.max(1, Math.round(9 * (1 - u * 0.85)))]); }
  return out;
}
function bossUpdate(dt) {
  const b = BOSS, P = SL_PHASES[b.phase], cx = LW / 2;
  b.mt += dt; b.shake = Math.max(0, b.shake - dt); b.inv = Math.max(0, b.inv - dt);
  if (b.ring !== null) { b.ring += dt * 2; if (b.ring > 1) b.ring = null; }
  b.charge = Math.min(1, b.charge + dt / SL_RECHARGE);
  bossMove(b, dt);
  if (b.mode === "wake" || b.mode === "roar") {             // rising up, or rising higher in a rage
    b.base += (P.body - b.base) * Math.min(1, dt * 2.5);
    if (b.mt > (b.mode === "wake" ? 2.4 : 1.6)) { b.mode = "fight"; b.msg = ""; b.base = P.body; }
  } else if (b.mode === "win") { b.base += dt * 60; if (b.mt > 3) endBoss(true); }
  else if (b.mode === "lose") { if (b.mt > 1.8) endBoss(false); }
  else {                                                     // the fight itself
    const ph = b.phase, tm = b.tm;
    b.eyeT += dt;                                            // which eyes are open
    const E1 = SL_TUNE.eye1, E2 = SL_TUNE.eye2, E3 = SL_TUNE.eye3;
    if (ph === 1) b.eyes[0].want = b.eyeT % E1[1] < E1[0] ? 1 : 0;
    else if (ph === 2) { const c = b.eyeT % (E2[1] * 2); b.eyes[0].want = c < E2[0] ? 1 : 0; b.eyes[1].want = c >= E2[1] && c < E2[1] + E2[0] ? 1 : 0; }
    else if (b.eyeT >= E3[1] || b.eyeIdx < 0) { b.eyeT = 0; let i; do i = Math.floor(Math.random() * b.eyes.length); while (i === b.eyeIdx); b.eyeIdx = i; b.eyes.forEach((e, k) => { e.want = k === i ? 1 : 0; }); }
    if (ph === 3 && b.eyeT > E3[0]) b.eyes.forEach(e => { e.want = 0; });
    if ((tm.tent -= dt) <= 0) {                              // tentacle sweeps, warned a moment before
      tm.tent = SL_TUNE.tent[ph] * (0.8 + Math.random() * 0.4);
      const sides = Math.random() < SL_TUNE.double[ph] ? [-1, 1] : [Math.random() < 0.5 ? -1 : 1], used = [];
      for (const sd of sides) {                              // a second tentacle only if there's room for a gap between them
        let y, n = 0;
        do y = 36 + Math.random() * Math.max(10, b.base - 42); while (used.some(u => Math.abs(u - y) < 30) && ++n < 20);
        if (n >= 20) break;
        used.push(y); b.warn.push({ sd, y, t: 0.75 });
      }
    }
    b.warn.forEach(w => { if ((w.t -= dt) <= 0) b.tentacles.push({ x: w.sd < 0 ? -132 : LW + 132, y: w.y, dir: w.sd < 0 ? 1 : -1, ph: Math.random() * 6, v: SL_TUNE.tentSpeed[ph] * (LW / 2 + 132) / (UW / 2 + 132) }); });   // reaches the middle at the same moment on any screen
    b.warn = b.warn.filter(w => w.t > 0);
    b.tentacles.forEach(t => { t.x += t.dir * t.v * dt; });
    b.tentacles = b.tentacles.filter(t => (t.dir > 0 ? t.x < LW + 10 : t.x > -10));
    if (ph >= 2 && (tm.ink -= dt) <= 0) { tm.ink = SL_TUNE.ink; for (let k = 0; k < 2; k++) b.ink.push([20 + Math.random() * (LW - 40), 40 + Math.random() * Math.max(10, b.base - 70), 18 + Math.random() * 6, 4]); }
    b.ink.forEach(q => { q[3] -= dt; }); b.ink = b.ink.filter(q => q[3] > 0);
    if (ph === 3 && (tm.ring -= dt) <= 0) { tm.ring = SL_TUNE.ring; b.rings.push({ r: 10, gap: -Math.PI / 2 + (Math.random() - 0.5) * 2.2 }); }   // shockwaves, each with a gap to slip through
    b.rings.forEach(r => { r.r += SL_TUNE.ringSpeed * dt; }); b.rings = b.rings.filter(r => r.r < 300);
    if (ph === 3) {                                           // the lunge: a rumble, then it surges up
      if (b.lungeT < 0 && (tm.lunge -= dt) <= 0) { tm.lunge = SL_TUNE.lunge; b.lungeT = 0; }
      if (b.lungeT >= 0) {
        b.lungeT += dt; const u = b.lungeT;
        const w = SL_TUNE.lungeWarn;
        if (u < w) { b.shake = 0.1; b.lungeLift = 0; } else if (u < w + 0.3) b.lungeLift = (u - w) / 0.3 * 70; else if (u < w + 0.65) b.lungeLift = 70; else if (u < w + 1.25) b.lungeLift = 70 * (1 - (u - w - 0.65) / 0.6); else { b.lungeLift = 0; b.lungeT = -1; }
        b.lunge = b.lungeLift > 5 ? 1 : 0;
      }
    }
    // Hug its body too long and it shrugs you off: a short rumble, then a heave that hurts.
    b.hug = b.hy > slY(b, b.hx) - 9 ? b.hug + dt : Math.max(0, b.hug - dt * 2);
    if (b.shrugT < 0 && b.lungeT < 0 && b.hug > SL_TUNE.hug) { b.shrugT = 0; b.hug = 0; }
    b.shrugLift = 0;
    if (b.shrugT >= 0) {
      const u = (b.shrugT += dt);
      if (u < 0.45) b.shake = 0.12; else if (u < 0.6) b.shrugLift = (u - 0.45) / 0.15 * 16; else if (u < 0.8) b.shrugLift = 16; else if (u < 1.1) b.shrugLift = 16 * (1 - (u - 0.8) / 0.3); else b.shrugT = -1;
    }
    b.lift = Math.max(b.lungeLift, b.shrugLift);
    for (const t of b.tentacles) for (const [x, y, r] of tentPoints(t)) if (Math.hypot(b.hx - x, b.hy - y) < r + 2) { bossHurt(b); break; }
    const ry = b.bodyY + 10;
    for (const r of b.rings) {
      const d = Math.hypot(b.hx - cx, b.hy - ry), a = Math.atan2(b.hy - ry, b.hx - cx);
      let da = Math.abs(a - r.gap); if (da > Math.PI) da = 2 * Math.PI - da;
      if (Math.abs(d - r.r) < 3.5 && da > SL_TUNE.ringGap / 2) bossHurt(b);
    }
  }
  b.bodyY = b.base - b.lift;
  b.eyes.forEach(e => { e.cool = Math.max(0, e.cool - dt); if (e.cool > 0) e.want = 0; e.open += (e.want - e.open) * Math.min(1, dt * 9); e.y = b.bodyY + e.dy; });
}
function endBoss(won) {
  const b = BOSS;
  BOSS = null;
  if (b.test) { newDive(); startBoss(true, b.test); BOSS.msg = won ? "YOU WON! AGAIN..." : "THROWN BACK. AGAIN..."; return; }   // test fights go round again
  if (b.dream) { newDive(); S.overlay = "tavern"; TAV.say = won ? "NOT BAD. FOR A DREAM." : "WAKE UP, KID."; return; }
  S.catch = []; S.rising = false; S.immune = 99;
  if (won) {
    S.bossWon = true;
    if (!store.sec.sleeper) { store.sec.sleeper = true; S.popups.push(["THE FLOOR CRACKS...", 4, "#c8a0ff"]); }
    if (award("wakeup")) S.popups.push(["NEW TITLE: WAKE-UP CALL", 5, GOLD]);
    earnSong(9); saveStore();
  } else { S.bottom = false; S.popups.push(["NOTHING TO SHOW FOR IT", 2.6, ORANGE]); }
  setState("up");
}
function drawCrack(cam) {                                    // once the Sleeper is beaten: a faint crack in the floor, off to one side
  if (!store.sec.sleeper) return;
  const x0 = OX + 108, fy = Math.floor(DEPTH_PX + 6 - cam);
  if (fy < -20 || fy > LH + 20) return;
  g.globalAlpha = 0.22 + 0.15 * Math.sin(T * 1.7); ell("#c8a0ff", x0 - 6, fy - 4, 12, 9); g.globalAlpha = 1;
  [[0, -2], [1, 1], [-1, 3], [1, 5], [0, 8]].forEach(([dx, dy], i, a) => { if (i) line("#08040e", x0 + a[i - 1][0], fy + a[i - 1][1], x0 + dx, fy + dy); });
}
function drawBoss() {                                        // the arena, the Sleeper, its attacks and the fight's HUD
  const b = BOSS, t = T, cx = LW / 2, shake = b.shake > 0 ? Math.round(Math.sin(t * 50) * 2) : 0;
  g.save(); g.translate(shake, 0);
  for (let i = 0; i < 14; i++) rect(lerpCol([18, 14, 40], [8, 6, 20], i / 13), 0, i * 15, LW, 15);       // the deep water around it
  for (let k = 0; k < Math.round(30 * LW / UW); k++) if ((k * 7 + Math.floor(t * 2)) % 9) rect("#3a3060", (k * 53) % LW, (k * 37 + Math.floor(t * 4 * (1 + k % 3))) % 180, 1, 1);   // drifting specks
  const top = b.bodyY, BW = Math.min(LW * 1.2, 190), RX = BW / 2, RY = 200 - top;   // the body: a horned, spiked hulk rising out of the floor, the same size on any screen
  const olY = x => slY(b, x);
  const edgeAt = u => { const x = cx + u * RX, y = olY(x), d = (olY(x + 2) - olY(x - 2)) / 4, n = Math.hypot(1, d); return [x, y, d / n, -1 / n]; };   // a point on the outline and its outward normal
  if (b.phase > 0) {
    [[-1, 0.9], [1, 1.1], [-1, 1.35]].forEach(([sd, k], i) => {                          // tentacles writhing up from behind it
      for (let j = 0; j < 16; j++) {
        const u = j / 15, x = cx + sd * (RX * k - j * 1.5) + Math.sin(t * 1.6 + j * 0.5 + i * 2) * (2 + u * 9), y = 196 - j * (RY * 0.07 + 3);
        disc(j % 3 ? "#1c1430" : "#2a1e44", x, y, Math.max(1, Math.round(7 - u * 6)));
      }
    });
    for (const [u, L] of [[-0.86, 8], [-0.72, 12], [-0.62, 15], [-0.16, 10], [0, 14], [0.16, 10], [0.62, 15], [0.72, 12], [0.86, 8]]) {   // spikes on its skull and shoulders
      const [x, y, nx, ny] = edgeAt(u);
      poly("#3c2c5c", [[x - ny * 5, y + nx * 5], [x + nx * L, y + ny * L], [x + ny * 5, y - nx * 5]]);
      line("#6a5a92", x - ny * 4, y + nx * 4, x + nx * L, y + ny * L);
      poly("#b4a4d4", [[x + nx * (L - 4) - ny, y + ny * (L - 4) + nx], [x + nx * L, y + ny * L], [x + nx * (L - 4) + ny, y + ny * (L - 4) - nx]]);
    }
    [-1, 1].forEach(sd => {                                                               // two curling horns
      const [hx0, hy0] = edgeAt(sd * 0.33);
      for (let j = 0; j < 14; j++) { const u = j / 13, x = hx0 + sd * (j * 2.2 - u * u * 10), y = hy0 - j * 2.4 + u * u * 4; disc(j % 3 === 2 ? "#a89c84" : "#d8ccb0", x, y, Math.max(1, Math.round(5 - u * 4))); }
    });
    const pts = [[cx - RX - 2, 201]];
    for (let x = Math.floor(cx - RX); x <= cx + RX; x += 2) pts.push([x, olY(x)]);
    pts.push([cx + RX + 2, 201]);
    poly(SL_DARK, pts.map(([x, y]) => [x + (x < cx ? -2 : 2), y - 2]));                // a dark rim, then the hide
    poly(SL_BODY, pts);
    for (let x = Math.floor(cx - RX); x <= cx + RX; x += 2) rect("#2e2248", x, olY(x) + 1, 2, 2);                       // light catching the top edge
    for (let k = 0; k < 10; k++) { const [rx, ry] = edgeAt(-0.9 + k * 0.2); ell(SL_LIGHT, rx - 4, ry + 5, 8, 3); }     // crust
    for (let k = 0; k < 6; k++) { const x = cx + ((k * 47) % 90 - 45) * BW / 120, y = top + 12 + (k * 29) % Math.max(8, RY - 30); if (y > olY(x) + 4) { disc("#5a4a7e", x, y, 2); rect("#2a1e44", x, y, 1, 1); } }   // barnacles
    if (b.phase >= 2) {                                                                   // veins that glow once it is angry
      g.globalAlpha = 0.45 + 0.35 * Math.sin(t * (b.phase >= 3 ? 9 : 4));
      [[-0.32, 0], [0.3, 1], [-0.1, 2], [0.12, 3]].forEach(([fx, i]) => { let x = cx + fx * BW, y = olY(x) + 5 + i * 3; for (let j = 0; j < 7; j++) { const nx = x + ((i + j) % 2 ? 4 : -3), ny = y + 5; line("#ff3c8c", x, y, nx, ny); x = nx; y = ny; } });
      g.globalAlpha = 1;
    }
    const my = Math.min(190, top + RY * 0.68), mw = Math.round(BW * 0.26), open = b.phase < 2 ? 0 : b.lunge > 0 ? 12 : 5;   // the mouth, never quite shut
    if (open) { ell("#0a0612", cx - mw, my - open, mw * 2, open * 2); g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5); ell("#8c1e3c", cx - mw * 0.6, my - open * 0.5, mw * 1.2, open); g.globalAlpha = 1; }
    else for (let k = -mw; k <= mw; k++) rect("#0a0612", cx + k, my + Math.round(Math.abs(Math.sin(k * 0.5)) * 2), 1, 2);
    for (let k = -mw + 4; k < mw - 3; k += 6) { poly("#e6e0d0", [[cx + k, my - open], [cx + k + 2, my - open + 4], [cx + k + 4, my - open]]); poly("#e6e0d0", [[cx + k + 3, my + open + 1], [cx + k + 5, my + open - 3], [cx + k + 7, my + open + 1]]); }
    [-1, 1].forEach(sd => {                                                               // big fangs at the corners, showing even when shut
      const fx = cx + sd * (mw - 5);
      poly("#f0eadc", [[fx - 3, my - open], [fx, my - open + 9], [fx + 3, my - open]]);
      poly("#f0eadc", [[fx - 2 + sd * 6, my + open + 2], [fx + sd * 6, my + open - 7], [fx + 2 + sd * 6, my + open + 2]]);
    });
    if (b.lunge > 0) for (let k = 0; k < 3; k++) rect("#a0c8dc", cx - mw + 8 + k * mw * 0.7, my + open, 1, 3 + Math.round((t * 8 + k * 3) % 6));   // drool
    [-1, 1].forEach(sd => {                                                               // claws gripping the floor
      const kx = cx + sd * (RX - 4);
      ell(SL_BODY, kx - 10, 178, 20, 14); ell(SL_DARK, kx - 10, 186, 20, 6);
      for (let j = 0; j < 3; j++) { const x = kx - sd * 6 + sd * j * 6; poly("#d8ccb0", [[x - 2, 186], [x + sd * 4, 194], [x + 2, 186]]); }
    });
    b.eyes.forEach(e => slEye(cx + e.x, e.y, e.r, e.open, b.hx, b.hy, cx, b.phase));
  }
  for (let x = 0; x < LW; x += 1) { const h = Math.round(4 + 3 * Math.sin(x * 0.21) + 2 * Math.sin(x * 0.07 + 2)); rect("#10102a", x, 194 - h, 1, h + 6); }   // the floor
  if (b.crack) {                                             // the crack it leaves behind: faint, and off to one side
    const x0 = Math.round(LW * 0.86), gl = 0.35 + 0.25 * Math.sin(t * 2);
    g.globalAlpha = gl; ell("#c8a0ff", x0 - 9, 182, 18, 14); g.globalAlpha = 1;
    [[0, 184], [2, 187], [-1, 190], [1, 193], [-2, 196]].forEach(([dx, dy], i, a) => { if (i) line("#05030a", x0 + a[i - 1][0], a[i - 1][1], x0 + dx, dy); });
    rect("#e6d2ff", x0, 189, 1, 1);
  }
  (b.rubble || []).forEach(r => rect("#4a4070", r[0], r[1] + Math.round((t * 30 + r[2]) % 40), 2, 2));
  b.tentacles.forEach(slTentacle);
  b.rings.forEach(r => {                                    // shockwaves, each with a gap to slip through
    for (let a = 0; a < Math.PI * 2; a += 1 / Math.max(8, r.r)) {
      let da = Math.abs(a - Math.PI * 2 * (a > Math.PI ? 1 : 0) - r.gap); if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < SL_TUNE.ringGap / 2) continue;
      rect("#c8a0ff", cx + Math.cos(a) * r.r, top + 10 + Math.sin(a) * r.r, 2, 2);
      if (r.r > 6) rect("#5a3c7a", cx + Math.cos(a) * (r.r - 3), top + 10 + Math.sin(a) * (r.r - 3), 1, 1);
    }
  });
  (b.warn || []).forEach(w => { if (Math.floor(T * 10) % 2) { const x = w.sd < 0 ? 6 : LW - 10; box(x - 2, w.y - 6, 8, 12, RED); text("!", x + 2, w.y, 1, RED, "center", null); } });   // a tentacle is coming
  b.ink.forEach(([x, y, r]) => { for (let k = 0; k < 6; k++) disc(k % 2 ? "#05040c" : "#0c0818", x + Math.round(Math.cos(k * 1.1) * r * 0.5), y + Math.round(Math.sin(k * 1.7) * r * 0.4), Math.round(r * (0.6 + (k % 3) * 0.15))); });
  line(lineCol(0), b.hx, 0, b.hx, b.hy - 4);               // the hook, free to move in any direction now
  if (!(b.inv > 0 && Math.floor(T * 14) % 2)) spr("hook" + store.eq.hook, b.hx - 1, b.hy - 4);
  if (b.ring !== null && b.ring !== undefined) { const r = Math.floor(6 + b.ring * SL_REACH); ring(CYAN, b.hx, b.hy, r); if (r > 10) ring(WHITE, b.hx, b.hy, r - 5); }
  g.restore();
  text("THE SLEEPER", LW / 2, 7, 1, "#c8a0ff", "center");                                   // the HUD
  const bw = Math.min(110, LW - 60), bx = Math.round(LW / 2 - bw / 2);
  rect(INK, bx - 1, 13, bw + 2, 5); rect("#3c1e3c", bx, 14, bw, 3); rect(b.phase >= 3 ? RED : b.phase === 2 ? ORANGE : "#c8a0ff", bx, 14, Math.round(bw * b.hp), 3);
  [1, 2].forEach(k => rect(INK, bx + Math.round(bw * k / 3), 13, 1, 5));
  text(["", "WAKING", "ANGRY", "FURIOUS"][b.phase] || "", LW / 2, 24, 1, b.phase >= 3 ? RED : "#a090c0", "center", null);
  for (let k = 0; k < 3; k++) { const x = 4 + k * 8; if (k < b.lives) spr("hook" + store.eq.hook, x, 21); else rect("#3c3450", x + 1, 24, 3, 1); }   // hits you can still take
  const k = clamp(b.charge, 0, 1);
  box(2, 176, 36, 22, k >= 1 ? CYAN : "#505678"); text("PULSE", 20, 183, 1, k >= 1 ? CYAN : "#6e7496", "center", null);
  rect("#3c4264", 6, 190, 28, 3); rect(k >= 1 ? CYAN : "#5a8ca0", 6, 190, Math.round(28 * k), 3);
  if (b.test) { text("TEST", LW - 4, KEYS ? 182 : 192, 1, GREY, "right", null); if (KEYS) text("ESC: QUIT", LW - 4, 192, 1, GREY, "right", null); }
  else if (b.dream) { g.globalAlpha = 0.14; rect("#78b4ff", 0, 0, LW, LH); g.globalAlpha = 1; text("A DREAM", LW - 4, 192, 1, "#a0c8ff", "right", null); }
  if (b.msg) { const tw = textW(b.msg, 1); box(Math.round(LW / 2 - tw / 2) - 5, 40, tw + 10, 13, GOLD); text(b.msg, LW / 2, 46, 1, GOLD, "center", null); }
}
function drawGiant() {                                   // something very large is asleep in the sea floor. It notices the hook.
  const ey = Math.floor(DEPTH_PX + 52 - S.cam);
  if (ey > LH + 20) { S.eye = 0; return; }
  const want = ["down", "turn", "fight", "rise"].includes(S.state) && S.hy > (C.MAX_M - 16) * M ? 1 : 0;
  S.eye += (want - S.eye) * 0.08;
  const ex = 46 + OX, k = S.eye;
  ell("#1e1a3c", ex - 17, ey - 9, 34, 18);
  if (k < 0.08) { for (let x = -13; x <= 13; x++) rect("#463e6e", ex + x, ey + Math.round(3 - x * x / 60), 1, 1); return; }
  const h = Math.max(2, Math.floor(14 * k));
  ell("#463e6e", ex - 15, ey - (h >> 1) - 1, 30, h + 2);
  ell("#fad246", ex - 14, ey - (h >> 1), 28, h);
  const px = ex + Math.floor(clamp((S.hx - ex) / 8, -6, 6));
  ell("#140a14", px - 2, ey - (h >> 1) + 1, 5, Math.max(1, h - 2));
}

// The Coral Reef (Nov 19, 2026): its coral is painted into the ocean picture; here its anemones sway and the light dances.
const REEF_ANEM = (DATA.reef || { anem: [] }).anem, REEF_COLS = (DATA.reef || { cols: [] }).cols.map(rgb);
function drawReef(cam, t) {
  const top = ZONES[REEF_Z][1], bot = ZONES[REEF_Z][2], m0 = cam / M, m1 = (cam + LH) / M;
  if (m1 < top - 4 || m0 > bot + 4) return;
  const mMid = (cam + 100) / M, k = clamp(Math.min(mMid - top + 8, bot + 8 - mMid) / 16, 0, 1);
  if (k > 0 && !S.storm) {                               // light from the surface, rippling down through clear water
    g.globalAlpha = 0.07 * k;
    for (let i = 0; i < Math.ceil(LW / 40) + 2; i++) {
      const x = i * 40 - 20 + Math.floor(Math.sin(t * 0.5 + i * 1.7) * 6), w = 8 + (i * 5) % 3 * 4;
      poly("#fff", [[x, 0], [x + w, 0], [x + w - 34, LH], [x - 34, LH]]);
    }
    g.globalAlpha = 0.18 * k;
    for (let i = 0; i < 6; i++) { const x = ((i * 67 + Math.floor(t * 9)) % (LW + 20)) - 10, y = (i * 41 + Math.floor(Math.sin(t + i) * 8)) % LH; rect("#fff", x, y, 6, 1); }
    g.globalAlpha = 1;
  }
  const dx = BG_O - OX;
  for (let i = 0; i < REEF_ANEM.length; i++) {           // anemones: a tuft of tentacles waving in the current
    const [ax, ay, ci] = REEF_ANEM[i], x = ax - dx, y = ay - cam;
    if (x < -8 || x > LW + 8 || y < -12 || y > LH + 4) continue;
    const c = REEF_COLS[ci] || "#ff7896";
    for (let j = -2; j <= 2; j++) {
      let px = x + j * 2, py = y;
      for (let s = 0; s < 4; s++) { px += Math.sin(t * 1.6 + i + s * 0.6) * 0.8 + j * 0.3; py -= 2; rect(s === 3 ? WHITE : c, Math.round(px), Math.round(py), 1, 2); }
    }
    rect(c, x - 4, y - 1, 9, 2);
  }
}

function draw() {
  if (S.state === "kart" && typeof KART !== "undefined" && KART) { drawKart(); return; }
  if (S.state === "isle" && typeof ISLE !== "undefined" && ISLE) { drawIsle(); return; }
  if (S.state === "siege" && typeof SG !== "undefined" && SG) { drawSiege(); return; }
  if (S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { drawWreck(); return; }
  if (S.state === "boss" && BOSS) { drawBoss(); return; }
  if (S.state === "flip" && FLIP) { drawFlip(); return; }
  const t = T, cam = S.cam, wl = Math.round(-cam), srcY = Math.max(0, Math.round(cam));
  g.save();
  if (KON === "mirror") { g.translate(LW, 0); g.scale(-1, 1); }           // the world flips; menus and buttons stay readable
  rect("#010106", 0, 0, LW, LH);
  const hgt = Math.min(LH - Math.max(0, wl), DATA.waterH - srcY);
  if (hgt > 0) g.drawImage(water, BG_O - OX, srcY, LW, hgt, 0, Math.max(0, wl), LW, hgt);
  if (wl > 0) drawSky();
  const mMid = (cam + 100) / M;
  if (mMid < 90 && !S.storm) {                           // sun rays
    g.globalAlpha = 0.1 * clamp(1 - mMid / 90, 0, 1);
    for (let i = 0; i < Math.ceil(LW / 32); i++) { const x = 10 + i * 32 + Math.floor(Math.sin(t * 0.6 + i) * 4), y = Math.max(0, wl); poly("#fff", [[x, y], [x + 12, y], [x - 26, LH], [x - 52, LH]]); }
    g.globalAlpha = 1;
  }
  const kelp = [3, 9, 15, 21, LW - 21, LW - 15, LW - 9, LW - 3, 27, LW - 27];
  for (let x = 52; x < LW - 50; x += 23) kelp.push(x + (x * 7) % 9);          // a wide ocean has kelp out in the open too
  for (let i = 0; i < kelp.length; i++) {                // kelp: starts sparse, thickens, thins out again
    const base = kelp[i], topM = i < 10 ? 92 + (i * 7) % 5 * 7 : 112 + (i * 7) % 5 * 9, endM = Math.min(i < 10 ? 216 - (i * 3) % 5 * 13 : 200 - (i * 3) % 5 * 11, 166 + (i * 5) % 4 * 3);   // kelp gives way to the Coral Reef
    const y0 = Math.max(topM * M, Math.floor(cam / 4) * 4);
    for (let wy = y0; wy < Math.min(endM * M, Math.floor(cam) + LH + 4); wy += 4) {
      const x = base + Math.sin(wy * 0.045 + t * 1.4 + i) * 3, sy = wy - cam;
      rect(i % 2 ? "#1e7846" : "#2c9654", x, sy, 2, 4);
      if ((wy / 4 + i) % 3 === 0) rect("#50be64", Math.floor(x) + (i % 2 ? 2 : -2), sy, 2, 2);
    }
  }
  drawReef(cam, t);
  if (S.whale) spr("whale", S.whale.x, S.whale.y - 22 - cam + Math.sin(t * 1.5) * 3, S.whale.d < 0);
  drawGiant();
  drawCrack(cam);
  const vis = visible();
  for (const [, f] of vis) {
    const sy = f.y - cam;
    if (f.id === "jelly") { const fr = "jelly" + (Math.floor(t * 2 + f.ph) % 2); spr(fr, f.x, sy - sprSize(fr)[1] / 2 + Math.sin(t * 2 + f.ph) * 3); continue; }
    const right = (f.fl ? f.fl[0] > 0 : f.v >= 0) !== !!EV.fools, [w, h] = fishSize(f);     // April Fools: everyone swims backwards
    let x = Math.floor(f.x);
    const y = Math.floor(sy - h / 2 + Math.sin(t * 3 + f.ph) * 1.5);
    if (S.fight && S.fight.f === f) x += Math.floor(Math.sin(t * 40) * (S.fight.shake > 0 ? 3 : 1));
    const leg = SPEC[f.id][7], pulse = 0.5 + 0.5 * Math.sin(t * 4 + f.ph);
    if (leg) {                                           // a legendary sits in a pulsing gold aura...
      g.globalAlpha = 0.18 + 0.16 * pulse; ell(LEGEND, x - 6, y - 5, w + 12, h + 10);
      g.globalAlpha = 0.22 + 0.14 * pulse; ell("#fff6c8", x - 2, y - 1, w + 4, h + 2);
      g.globalAlpha = 1;
    }
    if (f.gh) g.globalAlpha = f.gh === 3 ? 0.7 : 0.4 + 0.1 * Math.sin(t * 5 + f.ph);   // ghosts are pale and see-through
    fishBody(f.id, x, y, w, h, right, f.tr ? 1.7 : 1, f.gh ? ghostAtlas : null, f.ph);
    g.globalAlpha = 1;
    if (leg) {                                           // ...with gold stars circling it
      const cx = x + w / 2, cy = y + h / 2;
      for (let k = 0; k < 4; k++) {
        const a = t * 2.4 + k * Math.PI / 2, px = Math.round(cx + Math.cos(a) * (w / 2 + 5)), py = Math.round(cy + Math.sin(a) * (h / 2 + 4));
        rect(LEGEND, px - 1, py, 3, 1); rect(LEGEND, px, py - 1, 1, 3); rect(WHITE, px, py, 1, 1);
      }
    } else if (f.tr) {                                   // a trophy is big and throws red-orange sparkles
      for (let k = 0; k < 3; k++) if (Math.floor(t * 6 + k * 2 + f.ph) % 3 === 0) {
        const px = x + (k * 37 + Math.floor(t * 3)) % Math.max(1, w), py = y + (k * 23 + Math.floor(t * 5)) % Math.max(1, h);
        rect(TROPHY, px - 1, py, 3, 1); rect(TROPHY, px, py - 1, 1, 3); rect(WHITE, px, py, 1, 1);
      }
    }
    if (f.id === S.bounty && Math.floor(t * 3) % 2) { const bx = x + (w >> 1); rect(INK, bx - 2, y - 7, 5, 6); rect(GOLD, bx - 1, y - 6, 3, 4); rect(INK, bx, y - 5, 1, 2); }   // today's bounty wears a tag
  }
  const bt = S.bottle;
  if (bt && !bt.got && S.prepared) {                       // a message in a bottle: it glows and twinkles so it's easy to spot
    const [bx, by] = bottleXY(bt, cam, t), [bw, bh] = sprSize("bottle"), cx = bx + bw / 2, cy = by + bh / 2, pu = 0.5 + 0.5 * Math.sin(t * 4);
    if (by > -16 && by < LH + 16) {
      g.globalAlpha = 0.16 + 0.14 * pu; disc("#bfffe6", cx, cy, Math.round(7 + 3 * pu));
      g.globalAlpha = 0.3 + 0.2 * pu; disc("#eafff6", cx, cy, 4); g.globalAlpha = 1;
      spr("bottle", bx, by);
    }
  }
  if (typeof raftDraw === "function") raftDraw(cam, t);
  if (typeof siegeDraw === "function") siegeDraw(cam, t);
  const diving = ["down", "turn", "up", "fight", "rise"].includes(S.state);
  if (diving) {                                          // the line, the hook and whatever is on it
    const pts = wl > -20 ? [[OX + 63, wl - 13]] : [];
    S.path.forEach((x, i) => { const sy = i * 8 - cam; if (sy >= -8 && sy <= S.hy - cam) pts.push([x, sy]); });
    pts.push([S.hx, S.hy - cam - 4]);
    for (let i = 1; i < pts.length; i++) line(lineCol(i), pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    const hx = Math.floor(S.hx), hy = Math.floor(S.hy - cam), lid = LURES[S.lure][0];
    if (EV.fools) { const [hw, hh] = sprSize("hook" + store.eq.hook); g.save(); g.translate(hx - 1 + hw, hy - 4 + hh); g.rotate(Math.PI); spr("hook" + store.eq.hook, 0, 0); g.restore(); }
    else spr("hook" + store.eq.hook, hx - 1, hy - 4);
    if (lid === "angler") { rect("#c8ecff", hx - 2, hy - 8, 5, 1); rect("#c8ecff", hx - 2, hy - 8, 1, 2); rect("#c8ecff", hx + 2, hy - 8, 1, 2); }
    else if (lid === "glow") disc(Math.floor(t * 6) % 2 ? "#fffa96" : "#ffdc5a", hx, hy - 6, 2);
    else if (lid === "sonar") rect(CYAN, hx - 1, hy - 8, 3, 2);
    S.catch.forEach(([fid, , tr], i) => {                // the bunch dangles nose-up
      const a = DATA.atlas[fid], [w, h] = sprSize(fid, tr ? 1.7 : 1), ox = (i % 2 ? -1 : 1) * (2 + (i % 3)) + Math.sin(t * 9 + i * 1.7) * 1.5;
      g.save(); g.translate(Math.floor(hx + ox - h / 2), hy + 2 + i * 4 + w); g.rotate(-Math.PI / 2);
      g.drawImage(atlas, a[0], a[1], a[2], a[3], 0, 0, w, h); flair(w, h); g.restore();
    });
    if (S.ring !== null) { const r = Math.floor(8 + S.ring * 130); ring(CYAN, hx, hy, r); if (r > 12) ring(WHITE, hx, hy, r - 8); }
  }
  for (const b of S.bubbles) {
    const sy = Math.floor(b[1] - cam);
    if (sy < 0 || sy >= LH || b[0] < 0 || b[0] >= LW) continue;
    if (EV.valentine && !b[6]) { const x = Math.floor(b[0]); rect("#ff8cd2", x - 1, sy, 1, 1); rect("#ff8cd2", x + 1, sy, 1, 1); rect("#ff8cd2", x - 1, sy + 1, 3, 1); rect("#ff8cd2", x, sy + 2, 1, 1); }   // Valentine's: heart bubbles
    else rect(b[5], b[0], sy, b[6] ? 2 : 1, b[6] ? 2 : 1);
  }
  // darkness: the deeper you go the less you see, except around lights
  const a = darknessAt(diving ? S.hy / M : 0);
  if (a > 0.02) {
    dg.globalCompositeOperation = "source-over"; dg.clearRect(0, 0, LW, LH);
    dg.fillStyle = "rgba(0,0,8," + a + ")"; dg.fillRect(0, 0, LW, LH);
    const lights = [[Math.floor(S.hx), Math.floor(S.hy - cam), LURES[S.lure][0] === "glow" ? 74 : 58]];
    for (const [, f] of vis) if (C.GLOWS.includes(f.id) || f.tr) {
      const w = fishSize(f)[0], lx = f.id === "angler" ? f.x + (f.v >= 0 ? w - 3 : 3) : f.x + w / 2;
      lights.push([Math.floor(lx), Math.floor(f.y - cam), SPEC[f.id] && SPEC[f.id][7] ? 30 : 18]);
    }
    DATA.vents.forEach(v => lights.push([v[0] - BG_O + OX, Math.floor(v[1] - cam), 16]));
    if (bt && !bt.got && S.prepared) { const [bx, by] = bottleXY(bt, cam, t); lights.push([Math.floor(bx + 3), Math.floor(by + 4), Math.round(20 + 4 * Math.sin(t * 4))]); }   // a bottle glows
    if (typeof raftLights === "function") raftLights(lights, cam, t);
    if (typeof siegeLights === "function") siegeLights(lights, cam, t);
    if (store.sec.sleeper) lights.push([OX + 108, Math.floor(DEPTH_PX + 6 - cam), crackCalls() ? Math.round(18 + 4 * Math.sin(t * 3)) : 10]);       // the crack glows, faintly
    if (S.eye > 0.05) lights.push([46 + OX, Math.floor(DEPTH_PX + 52 - cam), 20]);
    for (const gl of DATA.glows) if (gl[1] > cam - 20 && gl[1] < cam + LH + 20) lights.push([gl[0] - BG_O + OX, Math.floor(gl[1] - cam), gl[2]]);   // crystals and vent mouths
    dg.globalCompositeOperation = "destination-out";
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,0.45)", x, y, r, dg));
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,1)", x, y, Math.floor(r * 0.68), dg));
    g.drawImage(dark, 0, 0);
  }
  if (bt && !bt.got && S.prepared && diving) bottleTwinkle(bt, cam, t);   // on top of the dark, so it shows at any depth
  if (wl > -30) {                                        // the surface, boat and angler
    for (let x = 0; x < LW; x += 4) rect(WHITE, x + Math.floor(t * 3) % 4, wl + Math.floor(Math.sin(t * 2 + x * 0.3) * (S.storm ? 2.4 : 1.2)), 2, 1);
    const bob = Math.floor(Math.sin(t * (S.storm ? 3.4 : 2)) * (S.storm ? 3 : 1.5));
    drawShack(wl, tavOpen());
    if (typeof raftScene === "function") raftScene(wl);       // the shipwright's pier and the raft (island.js)
    if (typeof siegeScene === "function") siegeScene(wl);     // the Admiral's gunboat, the leak count (siege.js)
    angler(OX + 30, wl - 9 + bob, store.eq, wl);
    line("#785432", OX + 50, wl - 12 + bob, OX + 63, wl - 22 + bob);
    if (["title", "haul"].includes(S.state)) line(lineCol(0), OX + 63, wl - 22 + bob, OX + 63, wl + 2);
  }
  if (KON === "disco" && wl < LH) {                       // disco water: moving bands of colour
    g.globalAlpha = 0.16;
    for (let x = 0; x < LW; x += 12) rect("hsl(" + Math.floor((x * 3 + t * 200) % 360) + ",100%,60%)", x, Math.max(0, wl + 2), 12, LH);
    g.globalAlpha = 1;
  }
  if (S.flash > 0) { g.globalAlpha = 0.6 * Math.min(1, S.flash / 0.2); rect("#ffffc8", 0, 0, LW, LH); g.globalAlpha = 1; }
  g.restore();
  const ov = (wideMenus() && WIDE[S.overlay] && WIDE[S.overlay].draw) || { derbytable: drawDerbyTable, plinko: drawPlinko, credits: drawCredits, vip: drawVip, scratch: drawScratch, rename: drawRename, tavern: drawTavern, c21: drawC21, derby: drawDerby, bet: drawBet, chipshop: drawChipShop, story: drawStory, jukebox: drawJukebox, myfish: drawMyFish, pit: drawPit, tavboard: drawTavBoard, more: drawMore, fhaul: drawFHaul, bestiary: drawBestiary, secrets: drawSecrets, note: drawNote, log: drawLog, scores: drawScores, shop: drawShop, tasks: drawTasks, help: drawHelp }[S.overlay] || (EXTRA_OV[S.overlay] && EXTRA_OV[S.overlay].draw);
  (ov || drawHud)();
  if (KON === "gameboy") {                                 // four shades of green, like an old handheld
    try {                                                  // (a page opened straight from disk can't read its own pixels; just skip it there)
      const im = g.getImageData(0, 0, LW, LH), d = im.data, pal = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
      for (let i = 0; i < d.length; i += 4) { const p = pal[Math.min(3, (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) >> 6)]; d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; }
      g.putImageData(im, 0, 0);
    } catch (e) { KON = null; }
  }
}

// ------------------------------------------------------------ the Rusty Hook
// A betting side game with its own currency, tavern chips. Chips and coins never convert, and nothing chips buy
// changes your score. The tavern opens after a player's 20th dive; betting on a dive works from the start.
const CHIP = "#5ad2a0", WOOD = "#7a5232", FELT = "#0e4a2e";
const TAV_OPEN_AT = 20, DAILY_CHIPS = 50, MAX_STAKE = Infinity, EDGE = 0.95;     // no table limit since Nov 19, 2026 (Kade: "let them play how they will"; was 75, VIP 200)
const BASE_STAKE = 75;    // the old limit: jackpot odds and win caps are still scaled from it, so a big bet keeps the same odds as a 75 bet
// Chip amounts for the screen (Nov 20, 2026: past a billion). Under `room` (10,000) the whole number; above it 3 figures and a
// letter: 12.3K, 456K, 7.89M, 1.5B, 42T, 3.1Q. Chips are plain numbers, exact up to about 9 quadrillion (CHIP_TOP).
const CHIP_UNITS = [[1e15, "Q"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
function fmtChips(n, room) {
  n = Math.round(n || 0);
  if (Math.abs(n) < (room || 10000)) return String(n);
  const neg = n < 0 ? "-" : "", a = Math.abs(n), [u, l] = CHIP_UNITS.find(q => a >= q[0]) || [1, ""], v = a / u;
  return neg + (v < 10 ? Math.floor(v * 100) / 100 : v < 100 ? Math.floor(v * 10) / 10 : Math.floor(v)) + l;
}
function fmtChips3(n) {                                       // at most 3 characters: 999, 45K, .1M, 12M, .5B, 3B...
  n = Math.round(n || 0);
  if (n < 1000) return String(n);
  const U = CHIP_UNITS.slice().reverse();
  for (let i = 0; i < U.length; i++) { const v = n / U[i][0]; if (v < 100 || i === U.length - 1) return Math.floor(v) + U[i][1]; if (v < 1000 && U[i + 1]) return "." + Math.floor(v / 100) + U[i + 1][1]; }
  return String(n);
}
const CHIP_TOP = Number.MAX_SAFE_INTEGER;     // the house keeps about 5% over time
const tav = () => store.tav;
const tavOpen = () => store.dives >= TAV_OPEN_AT;
let TAV = { say: "WHAT'LL IT BE?", c21: null, derby: null, bet: null, shopSel: 0, songSel: 0, board: 0, boards: {}, story: 0, ticker: 0 };
function chipIcon(x, y) { disc(CHIP, x, y, 3); rect("#2a7a5a", x - 1, y - 1, 3, 3); rect(WHITE, x - 2, y - 2, 1, 1); }
function addChips(n, why) {                                 // -> n; also keeps the records and titles about chips
  const q = tav();
  q.chips = clamp(Math.round(q.chips + n), 0, CHIP_TOP);   // whole chips, never past what a number holds exactly
  if (q.chips > q.stats.stack) q.stats.stack = q.chips;
  if (n > 0 && why === "win" && n > q.stats.win) q.stats.win = n;
  tavTitles(); saveStore(); tavPost();
  return n;
}
const today = () => dayString();
function dailyReady() { return tav().daily !== today(); }
function claimDaily() {                                     // the free daily stack, so nobody runs out for good
  if (!dailyReady()) return false;
  tav().daily = today(); tav().claims++;
  addChips(DAILY_CHIPS);
  return true;
}
const STAKE_MAX = 1e18;                                       // MAX BET buttons pass this as the step: stakeStep clamps it to the table max (or your chips). Was 1e6, which capped ALL IN at a million
// bigger stakes move in bigger steps; past 50,000 the step is 5% of the stake's size (Nov 20, 2026: 1B moves by 50M, not 2,500)
const stakeInc = st => st < 5 ? 1 : st < 100 ? 5 : st < 500 ? 25 : st < 2000 ? 100 : st < 10000 ? 500 : st < 50000 ? 2500 : 5 * Math.pow(10, Math.floor(Math.log10(st)) - 2);
const STAKE_TYPE = 0.5;     // a "step" that means: tap on the stake itself to type an amount (Nov 19, 2026; any whole number, not just 5s)
function stakeStep(st, d, max) {
  const top = Math.max(1, Math.min(max || MAX_STAKE, tav().chips));
  if (d === STAKE_TYPE) { askStake(st, top); return st; }
  let n;
  if (Math.abs(d) > 1) n = st + d;                                         // MAX: all in
  else if (d > 0) { const k = stakeInc(st); n = Math.floor(st / k) * k + k; }   // + and - land on the step grid (37 -> 40 / 35)
  else if (d < 0) { const k = stakeInc(st - 1); n = Math.ceil(st / k) * k - k; }
  else n = st;
  return clamp(Math.round(n), 1, top);
}

// ---- betting on your own dive
// Anti-tanking (Nov 18, 2026): players found that bets were priced from their last 20 dives, so they threw dives on purpose
// until an easy bet showed a long-shot price (or the line dropped), then dived properly. Now playing badly can't make a bet
// pay better: each bet is priced from your whole record (`tav.blife`, every real dive since this update, pulled toward the
// starting odds), never below 90% of its starting odds. Twenty dodged dives barely move a long record, and junk dives don't
// count at all. (The last 20 dives alone were too jumpy: pricing from the best of several noisy guesses paid honest players
// only ~75%.) The line never drops below 80% of its
// high-water mark, which fades about 2% a real day (tanking can't speed that up). A junk dive (under a quarter of the line)
// is left out of all of it, and a bet riding on a junk dive is void: no bet pays for a bad dive.
const BET_CAP = 25, HW_FADE = 0.98, JUNK_K = 0.25;
// Only bets a short, thrown dive could win are voided on a junk dive (Nov 19, 2026). Before, every bet was, so a real dive
// cut short at depth (a jellyfish, a shark) voided bets it had already won, like PAST 900 M or A TROPHY. Pricing still
// leaves junk dives out for every bet, so tanking can't move the odds.
const JUNK_VOID = new Set(["odd", "seven", "pair", "triple", "onezone", "tight", "heavylast", "clean", "nopulse", "all10", "bounty", "record",
  "nobites", "stairs", "downhill", "twins", "balanced"]);
const junkVoids = k => JUNK_VOID.has(k);
const junkRow = r => r[5] === 1;                            // 6th field of a history row: a junk dive (rows from before have none)
function betHW() { const q = tav(); if (!q.bhw || typeof q.bhw !== "object") q.bhw = { d: "", line: 0 }; return q.bhw; }
function betLife() { const q = tav(); if (!Array.isArray(q.blife)) q.blife = []; return q.blife; }   // [[real dives it could be judged on, wins]] per bet
function hwFade() { const h = betHW(); if (!h.d) return 1; const n = Math.round((new Date(dayString()) - new Date(h.d)) / 864e5); return n > 0 ? Math.pow(HW_FADE, n) : 1; }
function lineRaw() {                                        // the middle of your recent real dives, or null with fewer than 5
  const h = tav().hist.filter(r => !junkRow(r)).map(r => r[0]).sort((a, b) => a - b);
  return h.length < 5 ? null : h[h.length >> 1];
}
function betLine() {                                        // over / under line, to the nearest 10
  const raw = lineRaw(), hw = betHW().line * hwFade();
  if (raw === null && !hw) return 150;
  return Math.max(30, Math.round(Math.max(raw === null ? 150 : raw, 0.8 * hw) / 10) * 10);
}
function betRecord(row) {                                   // after every dive: the lifetime record and the line's high-water mark
  const h = betHW(), f = hwFade(), L = betLife();
  if (!junkRow(row) && typeof row[4] === "string") {
    const [w, sk] = row[4].split("|");
    BETS.forEach((b, i) => { if ((sk || "").includes(MASK_CH[i])) return; const e = L[i] || (L[i] = [0, 0]); e[0]++; if (w.includes(MASK_CH[i])) e[1]++; });
  }
  const raw = lineRaw();
  h.line = Math.round(Math.max(h.line * f, raw === null ? 0 : raw));
  h.d = dayString();
}
// ---- Bet on your dive (rotating since Nov 17, 2026): a pool of 50 bets, five on the board at a time (two safer, two
// medium, one long shot), a fresh board after every dive. The board is seeded by the dive count, so reopening the panel
// can't reroll it. Every bet is priced from your own last 20 dives: each dive's history row keeps, as its 5th field, the
// bets that dive would have won (betMask). Rows from before this update only count for the five old bets. New bets start
// from `prior` and move toward your real record. No bet pays for a bad dive (UNDER only counts on a real, deep dive).
// BETS is append-only: history rows refer to bets by position. [id, label (13 chars max), what it means (19 max),
// prior chance, test(dive, line) -> true / false / null (null = can't tell: the stake comes back)]
const ZONE_N = i => d => d.catch.some(c => SPEC[c[0]][2] === i);
const FULL = d => d.catch.length === C.CAPACITY;
const isLeg = c => !!SPEC[c[0]][7];
// Fish families for the dive bets (Nov 20, 2026). Lists of fish ids; a fish may be in two (the lantern shark glows).
const FAMS = {
  shark: ["shark", "blacktip", "leopard", "mako", "hammer", "goblin", "lshark", "whitetip", "nurse", "sleeper", "frill", "megalodon"],
  ink: ["squid", "octo", "cuttle", "nautilus", "vampire", "glimmer", "embers", "bigfin", "dumbo", "kraken", "colossal", "trueking"],
  eel: ["eel", "conger", "glasseel", "magma", "cusk", "faceless", "lamprey", "hagfish", "phantom"],
  shell: ["crab", "lobster", "mantis", "isopod", "geode", "yeti", "shrimp", "spider", "amphipod", "gcrab", "ironsnail"],
  ray: ["ray", "opal", "scald", "sunray", "pmanta"],
  glow: ["lantern", "hatchet", "flash", "angler", "dragon", "loosejaw", "lshark", "dread"],
};
const famN = (d, f) => d.catch.filter(c => FAMS[f].includes(c[0])).length;
const zoneRun = d => { if (!FULL(d)) return false; const r = [...new Set(d.catch.map(c => ZRANK[SPEC[c[0]][2]]))].sort((a, b) => a - b); return r.length === 3 && r[2] - r[0] === 2; };
const BETS = [
  ["over", "OVER {L} LB", "SCORE OVER THE LINE", 0.5, (d, L) => d.total > L],
  ["under", "UNDER {L} LB", "3 FISH BELOW 400 M", 0.45, (d, L) => d.total >= L ? false : FULL(d) && d.catch.every(c => (c[3] || 0) >= 400) ? true : null],
  ["floor", "TOUCH FLOOR", "FLOOR IS AT 1158 M", 0.3, d => d.bottom],
  ["trophy", "A TROPHY", "LAND A TROPHY FISH", 0.25, d => d.catch.some(c => c[2])],
  ["legend", "A LEGENDARY", "LAND A LEGENDARY", 0.08, d => d.catch.some(isLeg)],
  ["over2", "OVER {2L} LB", "DOUBLE THE LINE", 0.12, (d, L) => d.total > 2 * L],
  ["over15", "OVER {1.5L} LB", "1.5X THE LINE", 0.25, (d, L) => d.total > Math.round(1.5 * L / 10) * 10],
  ["online", "ON THE LINE", "WITHIN 15 OF {L} LB", 0.12, (d, L) => d.catch.length > 0 && Math.abs(d.total - L) <= 15],
  ["fish50", "50 LB FISH", "ONE FISH 50 LB+", 0.3, d => d.catch.some(c => c[1] >= 50)],
  ["fish200", "200 LB FISH", "ONE FISH 200 LB+", 0.06, d => d.catch.some(c => c[1] >= 200)],
  ["all10", "ALL OVER 10", "3 FISH, EACH 10 LB+", 0.3, d => FULL(d) && d.catch.every(c => c[1] >= 10)],
  ["beatlast", "BEAT LAST", "BEAT YOUR LAST DIVE", 0.45, d => d.last === null || d.lastLow ? null : d.total > d.last],   // void after a thrown dive
  ["odd", "ODD TOTAL", "AN ODD SCORE", 0.5, d => d.total > 0 && d.total % 2 === 1],
  ["seven", "ENDS IN 7", "SCORE ENDS IN 7", 0.1, d => d.total % 10 === 7],
  ["heavylast", "HEAVY LAST", "BIGGEST FISH LAST", 0.33, d => FULL(d) && d.catch[2][1] >= Math.max(...d.catch.map(c => c[1]))],
  ["d600", "PAST 600 M", "DIVE BELOW 600 M", 0.5, d => d.reached >= 600],
  ["d900", "PAST 900 M", "DIVE BELOW 900 M", 0.35, d => d.reached >= 900],
  ["floor3", "FLOOR+3 FISH", "1158 M, FULL HOOK", 0.15, d => d.bottom && FULL(d)],
  ["deephook", "DEEP HOOK", "ALL 3 BELOW 500 M", 0.2, d => FULL(d) && d.catch.every(c => (c[3] || 0) >= 500)],
  ["rise", "ON THE RISE", "CATCH ON THE WAY UP", 0.2, d => d.riseN > 0],
  ["tight", "TIGHT HOOK", "3 FISH WITHIN 50 M", 0.25, d => FULL(d) && Math.max(...d.catch.map(c => c[3] || 0)) - Math.min(...d.catch.map(c => c[3] || 0)) <= 50],
  ["z3", "WRECK FISH", "WRECK, 320-440 M", 0.4, ZONE_N(3)],
  ["z4", "ABYSS FISH", "ABYSS, 440-570 M", 0.35, ZONE_N(4)],
  ["z5", "CAVE FISH", "CAVES, 570-700 M", 0.3, ZONE_N(5)],
  ["z6", "VENT FISH", "VENTS, 700-830 M", 0.25, ZONE_N(6)],
  ["z7", "BONE FISH", "BONE YD, 830-960 M", 0.2, ZONE_N(7)],
  ["z8", "TRENCH FISH", "TRENCH, 960-1110 M", 0.15, ZONE_N(8)],
  ["z9", "FLOOR FISH", "FLOOR ZONE, 1110 M+", 0.12, ZONE_N(9)],
  ["onezone", "ONE ZONE", "3 FISH, SAME ZONE", 0.12, d => FULL(d) && new Set(d.catch.map(c => SPEC[c[0]][2])).size === 1],
  ["tour", "3 ZONES", "3 FISH, 3 ZONES", 0.3, d => d.sets.some(x => x[1] === "GRAND TOUR")],
  ["deeptrio", "DEEP TRIO", "3 FISH FROM 830 M+", 0.08, d => d.sets.some(x => x[1] === "DEEP TRIO")],
  ["trophy2", "2 TROPHIES", "TWO TROPHY FISH", 0.04, d => d.catch.filter(c => c[2]).length >= 2],
  ["pair", "A PAIR", "TWO OF ONE SPECIES", 0.15, d => d.catch.length - new Set(d.catch.map(c => c[0])).size >= 1],
  ["triple", "3 OF A KIND", "3 OF ONE SPECIES", 0.02, d => FULL(d) && new Set(d.catch.map(c => c[0])).size === 1],
  ["bounty", "BOUNTY FISH", "TODAY'S BOUNTY FISH", 0.12, d => d.catch.some(c => c[0] === d.bounty)],
  ["newsp", "NEW SPECIES", "NEW TO YOUR LOG", 0.2, d => d.newN > 0],
  ["record", "FISH RECORD", "BEAT A FISH RECORD", 0.25, d => d.recN > 0],
  ["setx2", "SET X2", "SET BONUS X2+", 0.2, d => d.mult >= 2],
  ["setx3", "SET X3", "SET BONUS X3+", 0.04, d => d.mult >= 3],
  ["clean", "CLEAN DIVE", "FULL HOOK, NO STING", 0.6, d => FULL(d) && !d.stung],
  ["pb", "NEW BEST", "BEAT YOUR BEST", 0.04, d => d.total > d.best],
  ["top10", "TODAY TOP 10", "MAKE TODAY'S TOP 10", 0.25, d => !d.board ? null : d.total > 0 && (d.board.length < 10 || d.total > d.board[9])],
  ["beat1", "TODAY'S #1", "BEAT TODAY'S LEADER", 0.06, d => !d.board ? null : d.total > 0 && (!d.board.length || d.total > d.board[0])],
  ["floortr", "FLOOR+TROPHY", "1158 M AND A TROPHY", 0.08, d => d.bottom && d.catch.some(c => c[2])],
  ["floorlg", "FLOOR+LEGEND", "1158 M AND A LEGEND", 0.03, d => d.bottom && d.catch.some(isLeg)],
  ["lgtr", "LEGEND+TROPHY", "ONE OF EACH", 0.02, d => d.catch.some(isLeg) && d.catch.some(c => c[2] && !isLeg(c))],
  ["trbounty", "TROPHY+BOUNTY", "A TROPHY AND BOUNTY", 0.03, d => d.catch.some(c => c[2]) && d.catch.some(c => c[0] === d.bounty)],
  ["newtr", "NEW+TROPHY", "NEW SPECIES, TROPHY", 0.05, d => d.newN > 0 && d.catch.some(c => c[2])],
  ["deepover", "900 M+OVER", "900 M AND OVER {L}", 0.2, (d, L) => d.reached >= 900 && d.total > L],
  ["nopulse", "NO PULSES", "FULL HOOK, NO PULSE", 0.3, d => FULL(d) && !d.pulsed],
  // Nov 20, 2026: fish families, combos, shapes and the WANTED fish. Priors measured with tools/tests/dive_bot.js.
  ["fshark", "A SHARK", "ANY SHARK", 0.454, d => famN(d, "shark") >= 1],
  ["fink", "INK SLINGER", "SQUID OR OCTOPUS", 0.656, d => famN(d, "ink") >= 1],
  ["feel", "SLIPPERY", "ANY EEL", 0.64, d => famN(d, "eel") >= 1],
  ["fshell", "SHELLFISH", "CRAB/LOBSTER/SHRIMP", 0.663, d => famN(d, "shell") >= 1],
  ["fray", "A RAY", "ANY RAY", 0.535, d => famN(d, "ray") >= 1],
  ["fglow", "LIGHTS ON", "A GLOWING FISH", 0.603, d => famN(d, "glow") >= 1],
  ["surfturf", "SURF+TURF", "SHARK + SHELLFISH", 0.349, d => famN(d, "shark") >= 1 && famN(d, "shell") >= 1],
  ["calamari", "CALAMARI", "2 SQUID/OCTOPUS", 0.558, d => famN(d, "ink") >= 2],
  ["sushi", "SUSHI ROLL", "AN EEL AND A SQUID", 0.211, d => famN(d, "eel") >= 1 && famN(d, "ink") >= 1],
  ["sharkweek", "SHARK WEEK", "2 SHARKS", 0.396, d => famN(d, "shark") >= 2],
  ["boil", "SEAFOOD BOIL", "SHELL, INK AND EEL", 0.12, d => famN(d, "shell") >= 1 && famN(d, "ink") >= 1 && famN(d, "eel") >= 1],
  ["nobites", "NO BITES", "FULL HOOK, NO BITES", 0.92, d => FULL(d) && !d.bitten],
  ["stairs", "STAIRCASE", "EACH FISH HEAVIER", 0.149, d => FULL(d) && d.catch[0][1] < d.catch[1][1] && d.catch[1][1] < d.catch[2][1]],
  ["downhill", "DOWNHILL", "EACH FISH LIGHTER", 0.17, d => FULL(d) && d.catch[0][1] > d.catch[1][1] && d.catch[1][1] > d.catch[2][1]],
  ["twins", "TWINS", "2 FISH WITHIN 2 LB", 0.218, d => d.catch.some((a, i) => d.catch.some((b, j) => j > i && a[1] >= 10 && b[1] >= 10 && Math.abs(a[1] - b[1]) <= 2))],
  ["balanced", "BALANCED", "3 FISH WITHIN 10 LB", 0.082, d => FULL(d) && d.catch.every(c => c[1] >= 20) && Math.max(...d.catch.map(c => c[1])) - Math.min(...d.catch.map(c => c[1])) <= 10],
  ["fish100", "100 LB FISH", "ONE FISH 100 LB+", 0.251, d => d.catch.some(c => c[1] >= 100)],
  ["bookends", "BOOKENDS", "ABOVE 400+BELOW 900", 0.133, d => d.catch.some(c => (c[3] || 0) < 400) && d.catch.some(c => (c[3] || 0) >= 900)],
  ["neighbours", "NEIGHBOURS", "3 ZONES IN A ROW", 0.12, zoneRun],
  ["postcard", "POSTCARD", "REEF FISH + FLOOR", 0.2, d => d.bottom && d.catch.some(c => SPEC[c[0]][2] === REEF_Z)],
  ["bounty2", "BOUNTY X2", "TWO BOUNTY FISH", 0.15, d => d.catch.filter(c => c[0] === d.bounty).length >= 2],
  ["wanted", "WANTED", "THE WANTED FISH", 0.1, d => !d.wanted ? null : d.catch.some(c => c[0] === d.wanted)],
];
const BET_I = Object.fromEntries(BETS.map((b, i) => [b[0], i]));
// One character per bet in each history row (Nov 20, 2026: extended past 64 for the new bets; "|" splits the row, so it's
// never used, and neither are quotes or backslashes). Old rows only use the first 64, which keep their meaning.
const MASK_CH = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_!#$%&()*+,./:;<=>?@[]^{}~";
function betMask(dive, line) {                              // -> "w..|v.." bets this dive won | bets it couldn't decide
  let won = "", skip = "";
  BETS.forEach((b, i) => { const r = b[4](dive, line); if (r === null) skip += MASK_CH[i]; else if (r) won += MASK_CH[i]; });
  return won + "|" + skip;
}
function windowChance(i) {                                  // your record on bet i over your recent real dives, pulled lightly toward the prior
  const id = BETS[i][0], old = { over: r => r[0] > betLine(), floor: r => !!r[1], trophy: r => !!r[2], legend: r => !!r[3] }[id];
  let n = 0, hit = 0;
  for (const r of tav().hist) {
    if (junkRow(r)) continue;                                // thrown dives don't count
    if (typeof r[4] === "string") { const [w, sk] = r[4].split("|"); if ((sk || "").includes(MASK_CH[i])) continue; n++; if (w.includes(MASK_CH[i])) hit++; }
    else if (old) { n++; if (old(r)) hit++; }                // rows from before the rotating bets
  }
  const k = 3;
  return (hit + k * BETS[i][3]) / (n + k);
}
const LIFE_K = 10, PRIOR_FLOOR = 0.9;
function lifeChance(i) { const e = betLife()[i] || [0, 0]; return (e[1] + LIFE_K * BETS[i][3]) / (e[0] + LIFE_K); }

// ---- WANTED (Nov 20, 2026): one named fish per board, from Twilight down, never a legendary or a time-of-day fish. The fish
// is seeded by the dive count like the board, so reopening can't reroll it. WANTED_P is how often a dive lands each fish
// (measured with tools/tests/dive_bot.js); your own record scales it (`tav.wrec` = [fish expected, fish caught] over real
// WANTED bets you've settled), never below 0.9x. Hunting a fish on purpose works, so the more WANTED bets you win, the less they pay you.
const WANTED_P = {
  amethyst: 0.411, amphipod: 0.318, angler: 0.471, ash: 0.383, barracuda: 0.374, barreleye: 0.306, bigfin: 0.188,
  blob: 0.364, boneeater: 0.507, bonefish: 0.397, bonito: 0.285, cavefish: 0.49, cinder: 0.474, conger: 0.35,
  cusk: 0.413, dragon: 0.483, dumbo: 0.06, eel: 0.391, embers: 0.347, faceless: 0.334, fangtooth: 0.478, frill: 0.193,
  gcrab: 0.072, geode: 0.409, glasseel: 0.414, glimmer: 0.316, goblin: 0.218, grenadier: 0.481, grouper: 0.499,
  gulper: 0.455, hagfish: 0.503, hammer: 0.144, hatchet: 0.432, ironsnail: 0.293, isopod: 0.401, lamprey: 0.467,
  lantern: 0.287, lionfish: 0.437, lizard: 0.441, lobster: 0.402, loosejaw: 0.382, lshark: 0.183, magma: 0.51,
  mahi: 0.35, mako: 0.111, nautilus: 0.265, oarfish: 0.178, octo: 0.341, opal: 0.389, prism: 0.487, quartz: 0.406,
  ratfish: 0.398, ray: 0.168, scald: 0.406, seapig: 0.073, shard: 0.456, shark: 0.19, shrimp: 0.492, skull: 0.35,
  sleeper: 0.185, snailfish: 0.346, snapper: 0.416, spider: 0.331, squid: 0.339, sulfur: 0.447, swallower: 0.327,
  sword: 0.256, telescope: 0.274, tripod: 0.093, tuna: 0.395, vampire: 0.314, viper: 0.531, wolf: 0.337, yeti: 0.447
};                                        // filled from the bot run below this block
function wantedPool() { return Object.keys(WANTED_P).filter(id => SPEC[id] && SPEC[id][6] === null && !SPEC[id][7]); }
function wantedFish() {
  const pool = wantedPool();
  if (!pool.length) return null;
  return pool[Math.floor(RNG(hashStr("wanted" + (store.dives || 0) + (store.name || ""))).random() * pool.length)];
}
function wrec() { const q = tav(); if (!Array.isArray(q.wrec)) q.wrec = [0, 0]; return q.wrec; }
const wantedK = () => { const w = wrec(); return clamp((w[1] + 3) / (w[0] + 3), PRIOR_FLOOR, 1.6); };
function wantedRecord(fish, won) {                          // after a settled WANTED bet (alone or in a parlay)
  if (!WANTED_P[fish]) return;
  const w = wrec(); w[0] = Math.round((w[0] + WANTED_P[fish]) * 1000) / 1000; if (won) w[1]++;
}
// Your record on the bets you actually take (Nov 20, 2026): `tav.btake` = {betId: [settled, won]}. Family and WANTED bets reward
// going after them, so a bet you keep winning when you take it gets priced from that, not just from every dive you've made.
const TAKE_K = 8;
function btake() { const q = tav(); if (!q.btake || typeof q.btake !== "object") q.btake = {}; return q.btake; }
function takeChance(i) { const e = btake()[BETS[i][0]] || [0, 0]; return (e[1] + TAKE_K * BETS[i][3]) / (e[0] + TAKE_K); }
function betChance(i, w) {                                  // the chance a bet is priced at
  if (BETS[i][0] === "wanted") { w = w || wantedFish(); return clamp((WANTED_P[w] || BETS[i][3]) * wantedK(), 0.01, 0.9); }
  return clamp(Math.max(PRIOR_FLOOR * BETS[i][3], lifeChance(i), takeChance(i)), 0.01, 0.97);
}
const betPays = q => { const x = EDGE / q; return Math.min(BET_CAP, Math.max(1.1, x >= 10 ? Math.floor(x) : Math.floor(x * 10) / 10)); };

// ---- Parlays (Nov 20, 2026): tick 2 or 3 bets; all must win. Priced as the product of each bet's own chance times how much
// those bets go together (PAIR_LIFT, measured with the dive bot: PAST 900 M and TRENCH FISH come together far more often
// than chance; STAIRCASE and DOWNHILL never do). A WANTED leg uses its fish's zone ("Z" + zone). Any leg void = stake back.
// PARLAY_EDGE: good dives win several bets at once in ways the pairs miss, so parlays are priced 9% likelier; measured on a
// separate batch of bot dives, 2- and 3-bet parlays then pay back about 95%. Past x100 a parlay can't be placed.
const PARLAY_CAP = 100, PARLAY_MAX = 3, PARLAY_EDGE = 1.09;
const PAIR_LIFT = {
  "Z0+balanced": 0.22, "Z0+beatlast": 0.84, "Z0+boil": 0.46, "Z0+bookends": 2.41, "Z0+bounty": 6.95, "Z0+d600": 0.79,
  "Z0+d900": 0.73, "Z0+deephook": 0, "Z0+deepover": 0.57, "Z0+deeptrio": 0, "Z0+downhill": 0.63, "Z0+feel": 0.6,
  "Z0+fglow": 0.54, "Z0+fish100": 0.66, "Z0+fish200": 0.74, "Z0+floor": 0.5, "Z0+floor3": 0.55, "Z0+fray": 1.67,
  "Z0+fshark": 0.65, "Z0+fshell": 0.6, "Z0+heavylast": 1.17, "Z0+legend": 1.7, "Z0+lgtr": 2.39, "Z0+neighbours": 0.36,
  "Z0+nopulse": 1.17, "Z0+odd": 0.82, "Z0+onezone": 0.34, "Z0+online": 0.82, "Z0+over": 0.73, "Z0+over15": 0.84,
  "Z0+over2": 0.7, "Z0+pair": 0.4, "Z0+pb": 0.59, "Z0+postcard": 0.5, "Z0+record": 1.25, "Z0+rise": 0.52,
  "Z0+setx3": 1.23, "Z0+seven": 0.53, "Z0+stairs": 1.33, "Z0+sushi": 0.48, "Z0+tight": 0.3, "Z0+tour": 1.87,
  "Z0+trbounty": 6.65, "Z0+triple": 0.42, "Z0+trophy": 1.68, "Z0+trophy2": 2.19, "Z0+twins": 0.62, "Z0+under": 0,
  "Z0+z5": 0.86, "Z0+z6": 0.63, "Z0+z7": 0.48, "Z0+z8": 0.59, "Z0+z9": 0.8, "Z1+all10": 0.83, "Z1+balanced": 0.67,
  "Z1+beatlast": 0.83, "Z1+boil": 0.47, "Z1+bookends": 2.42, "Z1+bounty": 0.72, "Z1+calamari": 0.53, "Z1+d600": 0.82,
  "Z1+d900": 0.73, "Z1+deephook": 0, "Z1+deepover": 0.71, "Z1+deeptrio": 0, "Z1+downhill": 0.75, "Z1+feel": 0.77,
  "Z1+fglow": 0.53, "Z1+fink": 0.65, "Z1+fish100": 1.19, "Z1+fish200": 0.61, "Z1+fish50": 1.14, "Z1+floor": 0.49,
  "Z1+floor3": 0.61, "Z1+floorlg": 0.79, "Z1+floortr": 0.78, "Z1+fray": 0.71, "Z1+fshark": 0.8, "Z1+fshell": 0.72,
  "Z1+legend": 1.87, "Z1+lgtr": 2.11, "Z1+onezone": 0.26, "Z1+online": 0.87, "Z1+over2": 0.75, "Z1+pair": 0.45,
  "Z1+pb": 1.34, "Z1+postcard": 0.78, "Z1+record": 1.26, "Z1+rise": 0.57, "Z1+seven": 1.43, "Z1+sushi": 0.76,
  "Z1+tight": 0.34, "Z1+tour": 1.79, "Z1+trbounty": 0.79, "Z1+triple": 0.65, "Z1+trophy": 1.42, "Z1+trophy2": 1.86,
  "Z1+twins": 0.84, "Z1+under": 0, "Z1+z4": 0.8, "Z1+z5": 0.63, "Z1+z6": 0.87, "Z1+z7": 0.81, "Z1+z8": 0.63,
  "Z1+z9": 0.66, "Z10+all10": 0.78, "Z10+balanced": 0.24, "Z10+bookends": 2.22, "Z10+bounty": 0.55,
  "Z10+calamari": 1.53, "Z10+d600": 0.73, "Z10+d900": 0.68, "Z10+deephook": 0, "Z10+deepover": 0.71, "Z10+deeptrio": 0,
  "Z10+feel": 0.74, "Z10+fglow": 0.84, "Z10+fink": 0.82, "Z10+fish100": 1.47, "Z10+fish200": 0.54, "Z10+fish50": 1.16,
  "Z10+floor": 0.34, "Z10+floor3": 0.46, "Z10+floorlg": 0.66, "Z10+floortr": 0.52, "Z10+fray": 2.29, "Z10+fshark": 1.4,
  "Z10+fshell": 0.88, "Z10+legend": 1.97, "Z10+lgtr": 2.21, "Z10+neighbours": 1.56, "Z10+nopulse": 1.14,
  "Z10+odd": 0.82, "Z10+onezone": 0.23, "Z10+over2": 0.82, "Z10+pair": 0.54, "Z10+pb": 0.74, "Z10+postcard": 5.8,
  "Z10+record": 1.3, "Z10+rise": 0.41, "Z10+seven": 1.22, "Z10+surfturf": 1.58, "Z10+sushi": 0.65, "Z10+tight": 0.35,
  "Z10+tour": 1.85, "Z10+trbounty": 0.6, "Z10+triple": 0.67, "Z10+trophy": 1.37, "Z10+trophy2": 2.06,
  "Z10+twins": 0.71, "Z10+under": 0, "Z10+z3": 1.16, "Z10+z4": 0.86, "Z10+z5": 0.79, "Z10+z6": 0.64, "Z10+z7": 0.72,
  "Z10+z8": 0.51, "Z10+z9": 0.61, "Z2+balanced": 0.21, "Z2+beatlast": 0.82, "Z2+boil": 0.4, "Z2+bookends": 2.08,
  "Z2+bounty": 1.35, "Z2+d600": 0.7, "Z2+d900": 0.63, "Z2+deephook": 0, "Z2+deepover": 0.66, "Z2+deeptrio": 0,
  "Z2+downhill": 1.22, "Z2+feel": 0.66, "Z2+fglow": 1.52, "Z2+fish100": 1.18, "Z2+fish200": 0.64, "Z2+fish50": 1.22,
  "Z2+floor": 0.52, "Z2+floor3": 0.59, "Z2+floortr": 0.75, "Z2+fray": 1.75, "Z2+fshark": 3.54, "Z2+fshell": 0.58,
  "Z2+legend": 1.6, "Z2+lgtr": 1.69, "Z2+neighbours": 1.57, "Z2+nopulse": 1.12, "Z2+onezone": 0.44, "Z2+online": 0.87,
  "Z2+pair": 0.62, "Z2+pb": 0.65, "Z2+postcard": 0.45, "Z2+record": 1.29, "Z2+rise": 0.56, "Z2+setx3": 1.46,
  "Z2+seven": 1.16, "Z2+stairs": 0.84, "Z2+surfturf": 2.22, "Z2+tight": 0.54, "Z2+tour": 1.73, "Z2+trbounty": 1.32,
  "Z2+trophy": 1.26, "Z2+trophy2": 1.57, "Z2+twins": 0.68, "Z2+under": 0, "Z2+z3": 1.4, "Z2+z4": 0.84, "Z2+z5": 0.75,
  "Z2+z6": 0.59, "Z2+z7": 0.6, "Z2+z8": 0.57, "Z2+z9": 0.6, "Z3+balanced": 0.22, "Z3+beatlast": 0.74,
  "Z3+bookends": 1.43, "Z3+calamari": 1.46, "Z3+d600": 0.74, "Z3+d900": 0.65, "Z3+deephook": 0, "Z3+deepover": 0.61,
  "Z3+deeptrio": 0, "Z3+downhill": 1.32, "Z3+feel": 1.56, "Z3+fish200": 0.41, "Z3+fish50": 1.2, "Z3+floor": 0.46,
  "Z3+floor3": 0.52, "Z3+floortr": 0.52, "Z3+fshark": 0.74, "Z3+fshell": 0.75, "Z3+legend": 1.38, "Z3+lgtr": 1.56,
  "Z3+neighbours": 1.53, "Z3+nopulse": 1.17, "Z3+onezone": 0.33, "Z3+over15": 0.79, "Z3+over2": 0.7, "Z3+pair": 0.59,
  "Z3+postcard": 0.68, "Z3+record": 1.32, "Z3+rise": 0.5, "Z3+setx3": 1.38, "Z3+seven": 1.18, "Z3+surfturf": 0.84,
  "Z3+sushi": 1.4, "Z3+tight": 0.41, "Z3+tour": 1.77, "Z3+trbounty": 0.84, "Z3+triple": 0.74, "Z3+trophy": 1.36,
  "Z3+trophy2": 1.81, "Z3+twins": 0.73, "Z3+under": 0.68, "Z3+z3": 7.98, "Z3+z6": 0.67, "Z3+z7": 0.57, "Z3+z8": 0.4,
  "Z3+z9": 0.61, "Z4+balanced": 0.3, "Z4+beatlast": 0.85, "Z4+boil": 0.48, "Z4+bookends": 0.55, "Z4+bounty": 0.69,
  "Z4+d600": 0.81, "Z4+d900": 0.75, "Z4+deephook": 0.65, "Z4+deepover": 0.71, "Z4+deeptrio": 0, "Z4+feel": 0.75,
  "Z4+fglow": 3.28, "Z4+fink": 0.86, "Z4+fish200": 1.28, "Z4+floor": 0.58, "Z4+floor3": 0.68, "Z4+floorlg": 0.44,
  "Z4+fshark": 1.4, "Z4+fshell": 0.66, "Z4+heavylast": 1.12, "Z4+lgtr": 1.27, "Z4+neighbours": 1.26,
  "Z4+onezone": 0.38, "Z4+online": 0.79, "Z4+pair": 0.7, "Z4+pb": 1.14, "Z4+postcard": 0.72, "Z4+record": 1.15,
  "Z4+rise": 0.67, "Z4+stairs": 1.19, "Z4+surfturf": 0.7, "Z4+sushi": 0.63, "Z4+tight": 0.46, "Z4+tour": 1.66,
  "Z4+trbounty": 0.64, "Z4+triple": 0.57, "Z4+trophy": 1.29, "Z4+trophy2": 1.65, "Z4+under": 1.15, "Z4+z4": 5.54,
  "Z4+z6": 0.63, "Z4+z7": 0.73, "Z4+z8": 0.53, "Z4+z9": 0.73, "Z5+balanced": 0.78, "Z5+boil": 1.41,
  "Z5+bookends": 0.39, "Z5+bounty": 0.77, "Z5+d900": 0.69, "Z5+deephook": 1.26, "Z5+deepover": 0.76, "Z5+deeptrio": 0,
  "Z5+fglow": 0.58, "Z5+floor": 0.58, "Z5+floor3": 0.7, "Z5+floorlg": 0.82, "Z5+floortr": 0.78, "Z5+fray": 2,
  "Z5+fshark": 0.45, "Z5+heavylast": 1.21, "Z5+lgtr": 1.22, "Z5+neighbours": 1.49, "Z5+onezone": 0.58,
  "Z5+over2": 1.16, "Z5+pair": 0.88, "Z5+postcard": 0.59, "Z5+record": 1.14, "Z5+rise": 0.62, "Z5+seven": 1.22,
  "Z5+stairs": 1.23, "Z5+surfturf": 0.75, "Z5+tight": 0.72, "Z5+tour": 1.62, "Z5+trbounty": 0.85, "Z5+triple": 0.63,
  "Z5+trophy": 1.19, "Z5+trophy2": 1.54, "Z5+under": 1.15, "Z5+z5": 6.36, "Z5+z7": 0.58, "Z5+z8": 0.59, "Z5+z9": 0.65,
  "Z6+boil": 1.67, "Z6+bookends": 0.49, "Z6+bounty": 0.43, "Z6+calamari": 1.22, "Z6+d600": 1.16, "Z6+d900": 0.7,
  "Z6+deephook": 1.3, "Z6+deepover": 0.81, "Z6+deeptrio": 0, "Z6+feel": 1.38, "Z6+fglow": 0.62, "Z6+floor": 0.62,
  "Z6+floor3": 0.72, "Z6+floorlg": 0.6, "Z6+fray": 2.28, "Z6+fshark": 0.5, "Z6+fshell": 1.45, "Z6+heavylast": 1.13,
  "Z6+legend": 0.8, "Z6+neighbours": 1.43, "Z6+onezone": 0.68, "Z6+pair": 0.74, "Z6+postcard": 0.52, "Z6+rise": 0.71,
  "Z6+setx2": 0.81, "Z6+setx3": 0.83, "Z6+seven": 1.16, "Z6+sushi": 1.51, "Z6+tight": 0.82, "Z6+tour": 1.45,
  "Z6+trbounty": 0.48, "Z6+triple": 0.82, "Z6+trophy2": 1.15, "Z6+under": 1.18, "Z6+z3": 0.67, "Z6+z4": 0.63,
  "Z6+z6": 5.16, "Z6+z7": 0.82, "Z6+z8": 0.55, "Z6+z9": 0.69, "Z7+all10": 1.14, "Z7+balanced": 1.73,
  "Z7+beatlast": 1.3, "Z7+boil": 1.74, "Z7+bounty": 0.43, "Z7+calamari": 0.32, "Z7+d600": 1.16, "Z7+d900": 1.14,
  "Z7+deephook": 1.35, "Z7+deepover": 1.29, "Z7+deeptrio": 1.72, "Z7+feel": 2.13, "Z7+fglow": 0.68, "Z7+fink": 0.73,
  "Z7+floor": 0.77, "Z7+floorlg": 0.43, "Z7+floortr": 0.74, "Z7+fray": 0.34, "Z7+fshark": 1.12, "Z7+legend": 0.75,
  "Z7+neighbours": 2.34, "Z7+odd": 0.61, "Z7+onezone": 0.55, "Z7+over": 1.27, "Z7+over15": 1.25, "Z7+over2": 1.34,
  "Z7+pair": 0.56, "Z7+pb": 1.26, "Z7+postcard": 0.57, "Z7+rise": 0.85, "Z7+setx2": 1.51, "Z7+setx3": 1.75,
  "Z7+seven": 0.59, "Z7+stairs": 1.15, "Z7+surfturf": 1.32, "Z7+sushi": 2.09, "Z7+tight": 0.73, "Z7+tour": 1.48,
  "Z7+trbounty": 0.48, "Z7+triple": 0.55, "Z7+twins": 1.16, "Z7+z3": 0.57, "Z7+z4": 0.73, "Z7+z5": 0.58, "Z7+z6": 0.82,
  "Z7+z7": 3.93, "Z7+z9": 0.82, "Z8+all10": 1.14, "Z8+beatlast": 1.67, "Z8+bookends": 1.18, "Z8+bounty": 0.48,
  "Z8+calamari": 0.61, "Z8+d600": 1.16, "Z8+d900": 1.48, "Z8+deephook": 1.43, "Z8+deepover": 1.82, "Z8+deeptrio": 1.94,
  "Z8+feel": 1.19, "Z8+fglow": 1.76, "Z8+fink": 1.14, "Z8+fish100": 1.17, "Z8+fish200": 1.44, "Z8+fish50": 1.2,
  "Z8+floor": 0.88, "Z8+floorlg": 0.85, "Z8+fray": 0.58, "Z8+heavylast": 1.13, "Z8+legend": 0.84, "Z8+lgtr": 0.82,
  "Z8+neighbours": 2.28, "Z8+odd": 0.53, "Z8+onezone": 0.62, "Z8+online": 1.23, "Z8+over": 1.5, "Z8+over15": 1.63,
  "Z8+over2": 1.72, "Z8+pair": 0.63, "Z8+pb": 1.47, "Z8+postcard": 0.78, "Z8+setx2": 1.55, "Z8+setx3": 1.75,
  "Z8+seven": 0.39, "Z8+stairs": 1.17, "Z8+surfturf": 1.43, "Z8+sushi": 1.26, "Z8+tight": 0.76, "Z8+tour": 1.4,
  "Z8+trbounty": 0.43, "Z8+triple": 0.61, "Z8+twins": 0.86, "Z8+under": 0.76, "Z8+z3": 0.4, "Z8+z4": 0.53,
  "Z8+z5": 0.59, "Z8+z6": 0.55, "Z8+z8": 4.47, "Z9+beatlast": 1.18, "Z9+boil": 1.21, "Z9+bookends": 1.46,
  "Z9+bounty": 0.48, "Z9+bounty2": 0.67, "Z9+d600": 1.16, "Z9+d900": 1.48, "Z9+deepover": 1.49, "Z9+deeptrio": 1.32,
  "Z9+feel": 0.73, "Z9+fglow": 0.66, "Z9+fink": 1.24, "Z9+fish200": 1.36, "Z9+floor": 1.92, "Z9+floor3": 1.96,
  "Z9+floorlg": 1.85, "Z9+floortr": 1.85, "Z9+fray": 0.36, "Z9+fshark": 0.52, "Z9+fshell": 1.25, "Z9+neighbours": 0.85,
  "Z9+nopulse": 0.86, "Z9+onezone": 0.57, "Z9+over": 1.23, "Z9+over15": 1.29, "Z9+over2": 1.33, "Z9+pb": 1.38,
  "Z9+postcard": 1.58, "Z9+rise": 1.94, "Z9+setx2": 1.14, "Z9+seven": 0.86, "Z9+sharkweek": 0.57, "Z9+tight": 0.53,
  "Z9+trbounty": 0.54, "Z9+triple": 0.56, "Z9+trophy2": 0.81, "Z9+under": 0.83, "Z9+z3": 0.61, "Z9+z4": 0.73,
  "Z9+z5": 0.65, "Z9+z6": 0.69, "Z9+z7": 0.82, "Z9+z9": 2, "all10+balanced": 1.22, "all10+boil": 1.16,
  "all10+bounty": 0.64, "all10+bounty2": 0.55, "all10+deephook": 1.2, "all10+deepover": 1.13, "all10+deeptrio": 1.23,
  "all10+floor": 0.8, "all10+floor3": 1.15, "all10+floorlg": 0.88, "all10+online": 1.14, "all10+over": 1.13,
  "all10+over2": 1.12, "all10+setx2": 1.13, "all10+setx3": 1.19, "all10+seven": 0.87, "all10+sharkweek": 1.12,
  "all10+sushi": 1.13, "all10+trbounty": 0.73, "all10+trophy2": 1.16, "all10+twins": 1.14, "all10+z7": 1.14,
  "all10+z8": 1.14, "balanced+beatlast": 0.76, "balanced+bookends": 0.4, "balanced+bounty": 0.78,
  "balanced+calamari": 1.17, "balanced+d600": 1.14, "balanced+deephook": 1.8, "balanced+deepover": 0.63,
  "balanced+deeptrio": 2.35, "balanced+downhill": 0.62, "balanced+feel": 1.59, "balanced+fglow": 0.77,
  "balanced+fink": 0.86, "balanced+fish100": 0.05, "balanced+fish200": 0.05, "balanced+fish50": 0.08,
  "balanced+floor": 0.73, "balanced+floorlg": 0.16, "balanced+floortr": 0.17, "balanced+fray": 0.62,
  "balanced+fshark": 0.5, "balanced+heavylast": 1.32, "balanced+legend": 0.05, "balanced+lgtr": 0.08,
  "balanced+odd": 1.21, "balanced+onezone": 2.1, "balanced+online": 1.17, "balanced+over": 0.62,
  "balanced+over15": 0.24, "balanced+over2": 0.14, "balanced+pair": 2.61, "balanced+pb": 0.34,
  "balanced+postcard": 0.55, "balanced+record": 0.55, "balanced+setx2": 1.31, "balanced+setx3": 1.68,
  "balanced+surfturf": 0.65, "balanced+sushi": 1.19, "balanced+tight": 2.03, "balanced+tour": 0.47,
  "balanced+trbounty": 0.85, "balanced+triple": 3.49, "balanced+trophy": 0.29, "balanced+trophy2": 0.13,
  "balanced+twins": 3.42, "balanced+under": 1.57, "balanced+z3": 0.22, "balanced+z4": 0.3, "balanced+z5": 0.78,
  "balanced+z7": 1.73, "beatlast+boil": 1.29, "beatlast+bookends": 1.57, "beatlast+bounty": 0.79,
  "beatlast+calamari": 0.63, "beatlast+d600": 1.55, "beatlast+d900": 1.79, "beatlast+deephook": 1.69,
  "beatlast+deepover": 3.23, "beatlast+deeptrio": 2.34, "beatlast+feel": 1.38, "beatlast+fink": 1.2,
  "beatlast+fish100": 2.72, "beatlast+fish200": 3.52, "beatlast+fish50": 2.25, "beatlast+floor": 1.51,
  "beatlast+floor3": 2, "beatlast+floorlg": 3.15, "beatlast+floortr": 2.17, "beatlast+fshark": 1.33,
  "beatlast+legend": 2.46, "beatlast+lgtr": 3.23, "beatlast+neighbours": 1.97, "beatlast+odd": 0.58,
  "beatlast+onezone": 0.88, "beatlast+online": 1.55, "beatlast+over": 3.19, "beatlast+over15": 3.62,
  "beatlast+over2": 3.77, "beatlast+pair": 0.87, "beatlast+pb": 3.8, "beatlast+postcard": 1.87,
  "beatlast+record": 1.14, "beatlast+rise": 1.81, "beatlast+setx2": 2.23, "beatlast+setx3": 2.54,
  "beatlast+seven": 0.27, "beatlast+surfturf": 0.64, "beatlast+sushi": 1.28, "beatlast+tight": 0.82,
  "beatlast+tour": 2.16, "beatlast+trophy": 1.68, "beatlast+trophy2": 2.49, "beatlast+twins": 0.67,
  "beatlast+under": 0.32, "beatlast+z3": 0.67, "beatlast+z5": 1.33, "beatlast+z6": 1.28, "beatlast+z7": 1.93,
  "beatlast+z8": 2.52, "beatlast+z9": 1.72, "boil+bookends": 0.86, "boil+d600": 1.43, "boil+d900": 1.18,
  "boil+deephook": 1.85, "boil+deepover": 1.19, "boil+deeptrio": 1.36, "boil+downhill": 1.48, "boil+feel": 3.86,
  "boil+fglow": 0.35, "boil+fink": 3.5, "boil+fish100": 0.86, "boil+fish200": 0.46, "boil+fish50": 1.13,
  "boil+floor": 1.5, "boil+floor3": 2.01, "boil+floortr": 1.97, "boil+fray": 0.58, "boil+fshell": 3.27,
  "boil+heavylast": 0.82, "boil+legend": 0.3, "boil+lgtr": 0.54, "boil+odd": 0.57, "boil+onezone": 0.53,
  "boil+over": 1.36, "boil+over15": 1.36, "boil+pair": 0.32, "boil+rise": 1.77, "boil+setx2": 1.55,
  "boil+stairs": 0.72, "boil+sushi": 10.02, "boil+tight": 0.72, "boil+tour": 1.45, "boil+trophy": 1.25,
  "boil+trophy2": 1.21, "boil+twins": 0.83, "boil+z3": 1.57, "boil+z4": 0.45, "boil+z5": 1.45, "boil+z6": 2.19,
  "boil+z7": 2.05, "boil+z8": 1.3, "boil+z9": 1.44, "bookends+bounty": 1.36, "bookends+calamari": 1.2,
  "bookends+d600": 1.64, "bookends+d900": 2.18, "bookends+deephook": 0, "bookends+deepover": 2.08,
  "bookends+deeptrio": 0, "bookends+downhill": 0.79, "bookends+fglow": 0.76, "bookends+fish100": 1.76,
  "bookends+fish200": 1.42, "bookends+fish50": 1.63, "bookends+floor": 1.41, "bookends+floor3": 1.79,
  "bookends+floorlg": 2.3, "bookends+floortr": 2.2, "bookends+fray": 0.87, "bookends+fshell": 1.23,
  "bookends+legend": 2.19, "bookends+lgtr": 2.92, "bookends+neighbours": 0.13, "bookends+odd": 0.78,
  "bookends+onezone": 0, "bookends+online": 1.36, "bookends+over": 1.71, "bookends+over15": 1.82,
  "bookends+over2": 1.63, "bookends+pair": 0.47, "bookends+pb": 1.89, "bookends+postcard": 4.27,
  "bookends+record": 1.24, "bookends+rise": 1.62, "bookends+setx2": 1.59, "bookends+setx3": 0.83,
  "bookends+seven": 0.87, "bookends+stairs": 1.23, "bookends+surfturf": 1.94, "bookends+sushi": 1.23,
  "bookends+tight": 0, "bookends+tour": 2.88, "bookends+trbounty": 1.74, "bookends+triple": 0.26,
  "bookends+trophy": 1.88, "bookends+trophy2": 2.34, "bookends+twins": 0.77, "bookends+under": 0, "bookends+z3": 1.33,
  "bookends+z4": 0.58, "bookends+z5": 0.47, "bookends+z6": 0.66, "bookends+z7": 1.42, "bookends+z8": 1.76,
  "bookends+z9": 2.15, "bounty+d600": 0.46, "bounty+d900": 0.47, "bounty+deephook": 0.1, "bounty+deepover": 0.52,
  "bounty+deeptrio": 0.18, "bounty+downhill": 0.47, "bounty+feel": 0.66, "bounty+fglow": 0.59, "bounty+fink": 0.58,
  "bounty+fish100": 0.71, "bounty+fish200": 0.74, "bounty+fish50": 0.73, "bounty+floor": 0.47, "bounty+floor3": 0.62,
  "bounty+floorlg": 0.84, "bounty+fshell": 0.29, "bounty+heavylast": 0.81, "bounty+legend": 1.33, "bounty+lgtr": 2.01,
  "bounty+neighbours": 0.64, "bounty+nopulse": 1.25, "bounty+onezone": 1.38, "bounty+online": 0.52,
  "bounty+over15": 1.21, "bounty+over2": 0.87, "bounty+pair": 0.81, "bounty+pb": 0.66, "bounty+record": 1.13,
  "bounty+rise": 0.54, "bounty+setx2": 0.75, "bounty+setx3": 0.56, "bounty+seven": 0.77, "bounty+stairs": 0.65,
  "bounty+sushi": 0.78, "bounty+tour": 1.14, "bounty+trophy": 1.78, "bounty+trophy2": 1.76, "bounty+twins": 0.58,
  "bounty+under": 0.26, "bounty+z4": 0.69, "bounty+z5": 0.77, "bounty+z6": 0.43, "bounty+z7": 0.43, "bounty+z8": 0.48,
  "bounty+z9": 0.48, "bounty2+d600": 0.32, "bounty2+d900": 0.38, "bounty2+deephook": 0.46, "bounty2+deepover": 0.6,
  "bounty2+deeptrio": 0.64, "bounty2+feel": 0.58, "bounty2+fink": 0.55, "bounty2+fish100": 0.53,
  "bounty2+fish50": 0.63, "bounty2+floor": 0.64, "bounty2+fshell": 0.53, "bounty2+nopulse": 1.14, "bounty2+over": 0.55,
  "bounty2+setx2": 0.45, "bounty2+tour": 0.6, "bounty2+trophy": 1.13, "bounty2+z4": 0.64, "bounty2+z7": 0.63,
  "bounty2+z8": 0.67, "bounty2+z9": 0.46, "calamari+deepover": 1.39, "calamari+deeptrio": 0.78,
  "calamari+downhill": 0.71, "calamari+feel": 0.34, "calamari+fglow": 0.42, "calamari+fink": 4.02,
  "calamari+fish200": 0.79, "calamari+fish50": 0.86, "calamari+floor3": 1.5, "calamari+fshark": 1.23,
  "calamari+fshell": 0.65, "calamari+heavylast": 1.25, "calamari+legend": 0.87, "calamari+lgtr": 0.68,
  "calamari+odd": 1.35, "calamari+onezone": 1.31, "calamari+online": 1.93, "calamari+over": 1.36,
  "calamari+over2": 0.77, "calamari+pair": 3.27, "calamari+rise": 1.26, "calamari+setx2": 0.8, "calamari+setx3": 0.74,
  "calamari+seven": 0.5, "calamari+stairs": 1.51, "calamari+sushi": 1.4, "calamari+tight": 1.16, "calamari+tour": 0.81,
  "calamari+twins": 1.75, "calamari+under": 0.76, "calamari+z3": 1.29, "calamari+z6": 1.23, "calamari+z7": 0.33,
  "calamari+z8": 0.69, "clean+floor": 0.75, "clean+floorlg": 0.82, "clean+floortr": 0.82, "d600+d900": 1.65,
  "d600+deephook": 1.54, "d600+deepover": 1.64, "d600+deeptrio": 1.64, "d600+feel": 1.37, "d600+fglow": 0.82,
  "d600+fink": 1.12, "d600+fish100": 1.45, "d600+fish200": 1.59, "d600+fish50": 1.38, "d600+floor": 1.64,
  "d600+floor3": 1.64, "d600+floorlg": 1.63, "d600+floortr": 1.64, "d600+fshark": 0.62, "d600+fshell": 1.36,
  "d600+legend": 1.24, "d600+lgtr": 1.36, "d600+neighbours": 1.15, "d600+online": 1.5, "d600+over": 1.57,
  "d600+over15": 1.58, "d600+over2": 1.6, "d600+pb": 1.44, "d600+postcard": 1.56, "d600+rise": 1.64,
  "d600+setx2": 1.52, "d600+setx3": 1.28, "d600+sharkweek": 0.68, "d600+sushi": 1.37, "d600+tour": 1.47,
  "d600+trbounty": 0.61, "d600+triple": 0.8, "d600+trophy": 1.24, "d600+trophy2": 1.34, "d600+z3": 0.67,
  "d600+z4": 0.87, "d600+z5": 1.5, "d600+z6": 1.64, "d600+z7": 1.64, "d600+z8": 1.64, "d600+z9": 1.65,
  "d900+deephook": 1.53, "d900+deepover": 2.18, "d900+deeptrio": 2.05, "d900+feel": 1.22, "d900+fink": 1.21,
  "d900+fish100": 1.61, "d900+fish200": 1.88, "d900+fish50": 1.48, "d900+floor": 2.18, "d900+floor3": 2.18,
  "d900+floorlg": 2.15, "d900+floortr": 2.17, "d900+fray": 0.48, "d900+fshark": 0.59, "d900+fshell": 1.36,
  "d900+legend": 1.31, "d900+lgtr": 1.44, "d900+neighbours": 1.19, "d900+odd": 0.84, "d900+onezone": 0.73,
  "d900+online": 1.65, "d900+over": 1.79, "d900+over15": 1.84, "d900+over2": 1.87, "d900+pb": 1.71,
  "d900+postcard": 1.99, "d900+rise": 2.18, "d900+setx2": 1.72, "d900+setx3": 1.27, "d900+seven": 0.78,
  "d900+sharkweek": 0.52, "d900+sushi": 1.29, "d900+tight": 0.71, "d900+tour": 1.53, "d900+trbounty": 0.63,
  "d900+triple": 0.67, "d900+trophy": 1.26, "d900+trophy2": 1.29, "d900+under": 0.78, "d900+z3": 0.6, "d900+z4": 0.82,
  "d900+z5": 0.85, "d900+z7": 1.68, "d900+z8": 2.18, "d900+z9": 2.18, "deephook+deepover": 1.82,
  "deephook+deeptrio": 2.91, "deephook+feel": 1.48, "deephook+fink": 1.16, "deephook+fish100": 1.29,
  "deephook+fish200": 1.66, "deephook+fish50": 1.22, "deephook+floor": 1.29, "deephook+floor3": 2.02,
  "deephook+floorlg": 1.15, "deephook+floortr": 1.32, "deephook+fshark": 0.52, "deephook+fshell": 1.49,
  "deephook+heavylast": 1.13, "deephook+legend": 0.73, "deephook+lgtr": 0.57, "deephook+neighbours": 1.76,
  "deephook+onezone": 1.68, "deephook+online": 1.67, "deephook+over": 1.6, "deephook+over15": 1.62,
  "deephook+over2": 1.75, "deephook+pair": 1.42, "deephook+pb": 1.42, "deephook+postcard": 0.21,
  "deephook+record": 0.83, "deephook+rise": 1.65, "deephook+setx2": 1.68, "deephook+setx3": 1.4,
  "deephook+seven": 0.72, "deephook+surfturf": 0.68, "deephook+sushi": 1.47, "deephook+tight": 1.68,
  "deephook+tour": 0.76, "deephook+trbounty": 0.14, "deephook+triple": 1.43, "deephook+trophy": 0.87,
  "deephook+trophy2": 0.7, "deephook+twins": 1.31, "deephook+under": 1.16, "deephook+z3": 0, "deephook+z5": 1.83,
  "deephook+z6": 1.82, "deephook+z7": 1.85, "deephook+z8": 1.98, "deephook+z9": 1.49, "deepover+deeptrio": 2.57,
  "deepover+downhill": 1.14, "deepover+feel": 1.28, "deepover+fink": 1.26, "deepover+fish100": 3.06,
  "deepover+fish200": 4.28, "deepover+fish50": 2.31, "deepover+floor": 1.9, "deepover+floor3": 2.6,
  "deepover+floorlg": 4.1, "deepover+floortr": 2.75, "deepover+fray": 0.63, "deepover+fshark": 0.85,
  "deepover+fshell": 1.19, "deepover+legend": 2.55, "deepover+lgtr": 3.01, "deepover+neighbours": 1.94,
  "deepover+odd": 0.61, "deepover+onezone": 0.78, "deepover+online": 1.73, "deepover+over": 4.23,
  "deepover+over15": 4.34, "deepover+over2": 4.39, "deepover+pair": 0.87, "deepover+pb": 3.6,
  "deepover+postcard": 2.09, "deepover+record": 1.24, "deepover+rise": 2.22, "deepover+setx2": 2.29,
  "deepover+setx3": 2.42, "deepover+seven": 0.53, "deepover+surfturf": 1.2, "deepover+sushi": 1.58,
  "deepover+tight": 0.71, "deepover+tour": 2.17, "deepover+trbounty": 0.77, "deepover+trophy": 1.73,
  "deepover+trophy2": 2.33, "deepover+twins": 0.67, "deepover+under": 0, "deepover+z3": 0.57, "deepover+z4": 0.77,
  "deepover+z6": 1.14, "deepover+z7": 1.96, "deepover+z8": 2.8, "deepover+z9": 2.21, "deeptrio+feel": 1.55,
  "deeptrio+fglow": 0.79, "deeptrio+fink": 1.26, "deeptrio+fish100": 1.4, "deeptrio+fish200": 1.79,
  "deeptrio+fish50": 1.31, "deeptrio+floor": 1.73, "deeptrio+floor3": 2.7, "deeptrio+floorlg": 1.38,
  "deeptrio+floortr": 1.22, "deeptrio+fray": 0, "deeptrio+fshark": 0.82, "deeptrio+fshell": 1.39,
  "deeptrio+legend": 0.76, "deeptrio+lgtr": 0.43, "deeptrio+neighbours": 2.36, "deeptrio+odd": 0.61,
  "deeptrio+onezone": 2.23, "deeptrio+online": 2.26, "deeptrio+over": 2.2, "deeptrio+over15": 2.13,
  "deeptrio+over2": 2.33, "deeptrio+pair": 1.64, "deeptrio+pb": 1.61, "deeptrio+postcard": 0.36,
  "deeptrio+record": 0.67, "deeptrio+rise": 2.21, "deeptrio+setx2": 2.8, "deeptrio+setx3": 2.39,
  "deeptrio+seven": 0.13, "deeptrio+surfturf": 0.77, "deeptrio+sushi": 1.4, "deeptrio+tight": 2.13,
  "deeptrio+tour": 0.27, "deeptrio+trbounty": 0.25, "deeptrio+triple": 1.68, "deeptrio+trophy": 0.67,
  "deeptrio+trophy2": 0.29, "deeptrio+twins": 1.33, "deeptrio+z3": 0, "deeptrio+z4": 0, "deeptrio+z5": 0,
  "deeptrio+z6": 0, "deeptrio+z7": 2.61, "deeptrio+z8": 2.98, "deeptrio+z9": 1.95, "downhill+fish100": 1.24,
  "downhill+fish50": 1.25, "downhill+floor3": 1.3, "downhill+floorlg": 1.17, "downhill+floortr": 0.82,
  "downhill+fray": 1.24, "downhill+heavylast": 0, "downhill+legend": 1.41, "downhill+lgtr": 1.19, "downhill+pb": 0.44,
  "downhill+postcard": 0.74, "downhill+setx3": 0.59, "downhill+seven": 0.86, "downhill+stairs": 0,
  "downhill+surfturf": 1.19, "downhill+sushi": 1.17, "downhill+trbounty": 0.39, "downhill+triple": 0.74,
  "downhill+trophy2": 0.45, "downhill+twins": 0.81, "downhill+z3": 1.32, "feel+fglow": 0.65, "feel+fink": 0.77,
  "feel+fish100": 1.23, "feel+fish50": 1.2, "feel+floor": 0.84, "feel+floorlg": 0.56, "feel+floortr": 0.85,
  "feel+fray": 0.7, "feel+fshark": 0.53, "feel+heavylast": 1.18, "feel+neighbours": 2.17, "feel+odd": 0.77,
  "feel+onezone": 0.82, "feel+online": 1.4, "feel+over": 1.31, "feel+over15": 1.22, "feel+over2": 1.2,
  "feel+pair": 0.65, "feel+pb": 1.27, "feel+postcard": 0.46, "feel+setx2": 1.57, "feel+setx3": 1.51,
  "feel+seven": 0.75, "feel+stairs": 1.19, "feel+surfturf": 0.65, "feel+sushi": 4.62, "feel+tour": 1.71,
  "feel+trbounty": 0.83, "feel+triple": 0.63, "feel+trophy2": 1.3, "feel+z3": 2.11, "feel+z4": 0.82, "feel+z5": 1.44,
  "feel+z6": 1.76, "feel+z7": 2.76, "feel+z8": 1.53, "fglow+fink": 0.78, "fglow+floor": 0.58, "fglow+floor3": 0.71,
  "fglow+floorlg": 0.54, "fglow+fray": 0.85, "fglow+fshark": 1.3, "fglow+fshell": 0.69, "fglow+heavylast": 1.13,
  "fglow+lgtr": 0.85, "fglow+neighbours": 1.33, "fglow+onezone": 0.83, "fglow+pair": 0.73, "fglow+rise": 0.68,
  "fglow+sushi": 0.4, "fglow+tour": 1.2, "fglow+trbounty": 0.75, "fglow+trophy2": 1.13, "fglow+under": 1.21,
  "fglow+z4": 3.74, "fglow+z5": 0.59, "fglow+z6": 0.62, "fglow+z7": 0.68, "fglow+z8": 1.77, "fglow+z9": 0.65,
  "fink+floor": 1.27, "fink+floor3": 1.41, "fink+floortr": 1.3, "fink+fshark": 0.7, "fink+fshell": 0.83,
  "fink+neighbours": 1.12, "fink+online": 1.27, "fink+over": 1.21, "fink+over15": 1.24, "fink+over2": 1.17,
  "fink+pair": 0.76, "fink+postcard": 0.83, "fink+rise": 1.41, "fink+setx2": 1.13, "fink+surfturf": 0.6,
  "fink+sushi": 4.09, "fink+trbounty": 0.56, "fink+triple": 0.32, "fink+twins": 0.88, "fink+z3": 1.2, "fink+z7": 0.81,
  "fink+z8": 1.27, "fink+z9": 1.36, "fish100+fish200": 3.92, "fish100+fish50": 2.56, "fish100+floor": 1.45,
  "fish100+floor3": 1.65, "fish100+floorlg": 3.61, "fish100+floortr": 2.43, "fish100+fray": 1.34,
  "fish100+fshark": 1.23, "fish100+heavylast": 0.8, "fish100+legend": 3.4, "fish100+lgtr": 3.52,
  "fish100+neighbours": 1.97, "fish100+odd": 0.84, "fish100+onezone": 0.6, "fish100+online": 1.47,
  "fish100+over": 3.05, "fish100+over15": 3.6, "fish100+over2": 3.82, "fish100+pair": 0.49, "fish100+pb": 2.79,
  "fish100+postcard": 1.6, "fish100+record": 1.32, "fish100+rise": 1.55, "fish100+setx2": 1.68, "fish100+setx3": 1.91,
  "fish100+sharkweek": 1.33, "fish100+stairs": 0.83, "fish100+surfturf": 1.57, "fish100+sushi": 1.29,
  "fish100+tight": 0.55, "fish100+tour": 1.93, "fish100+triple": 0.23, "fish100+trophy": 1.8, "fish100+trophy2": 2.37,
  "fish100+twins": 0.42, "fish100+under": 0.21, "fish100+z5": 1.34, "fish100+z6": 1.51, "fish100+z7": 1.63,
  "fish100+z8": 1.8, "fish100+z9": 1.64, "fish200+fish50": 2.55, "fish200+floor": 1.77, "fish200+floor3": 2.03,
  "fish200+floorlg": 7.56, "fish200+floortr": 1.85, "fish200+fray": 0.55, "fish200+fshark": 1.13,
  "fish200+legend": 5.26, "fish200+lgtr": 5.4, "fish200+neighbours": 1.83, "fish200+odd": 0.85,
  "fish200+onezone": 0.64, "fish200+online": 0.42, "fish200+over": 3.99, "fish200+over15": 6.13, "fish200+over2": 7.93,
  "fish200+pair": 0.4, "fish200+pb": 5.52, "fish200+postcard": 1.59, "fish200+record": 1.15, "fish200+rise": 1.83,
  "fish200+setx2": 1.75, "fish200+setx3": 2.63, "fish200+seven": 0.71, "fish200+stairs": 1.24,
  "fish200+surfturf": 1.38, "fish200+sushi": 0.84, "fish200+tight": 0.57, "fish200+tour": 1.73, "fish200+triple": 0.36,
  "fish200+trophy": 1.4, "fish200+trophy2": 1.77, "fish200+twins": 0.39, "fish200+under": 0.06, "fish200+z3": 0.38,
  "fish200+z4": 1.4, "fish200+z5": 1.4, "fish200+z6": 1.37, "fish200+z7": 1.45, "fish200+z8": 2.2, "fish200+z9": 2.01,
  "fish50+floor": 1.26, "fish50+floor3": 1.45, "fish50+floorlg": 2.51, "fish50+floortr": 2.15, "fish50+fray": 1.39,
  "fish50+fshark": 1.25, "fish50+heavylast": 0.8, "fish50+legend": 2.56, "fish50+lgtr": 2.54,
  "fish50+neighbours": 1.61, "fish50+onezone": 0.69, "fish50+online": 1.62, "fish50+over": 2.32, "fish50+over15": 2.47,
  "fish50+over2": 2.52, "fish50+pair": 0.59, "fish50+pb": 2.08, "fish50+postcard": 1.42, "fish50+record": 1.28,
  "fish50+rise": 1.36, "fish50+setx2": 1.56, "fish50+setx3": 1.57, "fish50+sharkweek": 1.12, "fish50+stairs": 0.84,
  "fish50+surfturf": 1.53, "fish50+sushi": 1.28, "fish50+tight": 0.69, "fish50+tour": 1.77, "fish50+trbounty": 0.85,
  "fish50+triple": 0.32, "fish50+trophy": 1.82, "fish50+trophy2": 2.27, "fish50+twins": 0.48, "fish50+under": 0.46,
  "fish50+z3": 1.14, "fish50+z4": 1.17, "fish50+z5": 1.33, "fish50+z6": 1.4, "fish50+z7": 1.4, "fish50+z8": 1.83,
  "fish50+z9": 1.43, "floor+floor3": 6.09, "floor+floorlg": 5.76, "floor+floortr": 5.98, "floor+fray": 0.34,
  "floor+fshark": 0.38, "floor+fshell": 1.45, "floor+heavylast": 0.86, "floor+lgtr": 0.7, "floor+nobites": 0.75,
  "floor+nopulse": 0.66, "floor+onezone": 0.53, "floor+online": 1.55, "floor+over": 1.56, "floor+over15": 1.6,
  "floor+over2": 1.58, "floor+pb": 1.47, "floor+postcard": 4.33, "floor+record": 0.81, "floor+rise": 6.11,
  "floor+setx2": 1.2, "floor+seven": 1.22, "floor+stairs": 0.8, "floor+sushi": 1.13, "floor+tight": 0.47,
  "floor+tour": 0.87, "floor+trbounty": 0.63, "floor+triple": 0.59, "floor+trophy2": 0.68, "floor+under": 0.69,
  "floor+z3": 0.43, "floor+z4": 0.61, "floor+z5": 0.71, "floor+z6": 0.8, "floor+z8": 1.23, "floor+z9": 2.8,
  "floor3+floorlg": 6.57, "floor3+floortr": 6.94, "floor3+fray": 0.41, "floor3+fshark": 0.43, "floor3+fshell": 1.66,
  "floor3+heavylast": 1.23, "floor3+legend": 1.25, "floor3+neighbours": 1.42, "floor3+onezone": 0.76,
  "floor3+online": 1.99, "floor3+over": 2.14, "floor3+over15": 2.14, "floor3+over2": 2.15, "floor3+pair": 1.14,
  "floor3+pb": 1.87, "floor3+postcard": 4.94, "floor3+record": 0.88, "floor3+rise": 7.74, "floor3+setx2": 1.87,
  "floor3+setx3": 1.47, "floor3+stairs": 1.15, "floor3+sushi": 1.61, "floor3+tight": 0.67, "floor3+tour": 1.35,
  "floor3+trbounty": 0.86, "floor3+triple": 0.77, "floor3+trophy": 1.15, "floor3+twins": 1.21, "floor3+under": 0.75,
  "floor3+z3": 0.5, "floor3+z4": 0.74, "floor3+z5": 0.87, "floor3+z7": 1.4, "floor3+z8": 1.57, "floor3+z9": 2.89,
  "floorlg+floortr": 3.72, "floorlg+fray": 0.58, "floorlg+fshark": 0.39, "floorlg+fshell": 1.19,
  "floorlg+heavylast": 0.4, "floorlg+legend": 5.82, "floorlg+lgtr": 3.45, "floorlg+nobites": 0.83,
  "floorlg+nopulse": 0.71, "floorlg+odd": 1.12, "floorlg+onezone": 0.56, "floorlg+online": 1.15, "floorlg+over": 3.41,
  "floorlg+over15": 4.93, "floorlg+over2": 5.75, "floorlg+pair": 0.57, "floorlg+pb": 2.57, "floorlg+rise": 6.1,
  "floorlg+setx2": 1.17, "floorlg+setx3": 1.56, "floorlg+stairs": 0.38, "floorlg+sushi": 0.73, "floorlg+tight": 0.5,
  "floorlg+triple": 0.63, "floorlg+trophy": 0.71, "floorlg+trophy2": 0.52, "floorlg+twins": 0.63,
  "floorlg+under": 0.05, "floorlg+z3": 0.86, "floorlg+z4": 0.48, "floorlg+z6": 0.82, "floorlg+z7": 0.64,
  "floorlg+z8": 1.27, "floorlg+z9": 2.7, "floortr+fray": 0.47, "floortr+fshark": 0.6, "floortr+fshell": 1.56,
  "floortr+heavylast": 1.14, "floortr+legend": 0.77, "floortr+lgtr": 1.94, "floortr+neighbours": 0.84,
  "floortr+nobites": 0.82, "floortr+nopulse": 0.7, "floortr+onezone": 0.16, "floortr+online": 1.78,
  "floortr+over": 2.27, "floortr+over15": 2.37, "floortr+over2": 2.07, "floortr+pair": 0.72, "floortr+pb": 2.3,
  "floortr+postcard": 4.1, "floortr+record": 1.58, "floortr+rise": 6.47, "floortr+setx2": 1.27, "floortr+seven": 1.17,
  "floortr+surfturf": 1.3, "floortr+sushi": 1.2, "floortr+tight": 0.14, "floortr+tour": 1.4, "floortr+trbounty": 1.26,
  "floortr+triple": 0.46, "floortr+trophy": 2.87, "floortr+trophy2": 1.92, "floortr+twins": 0.61,
  "floortr+under": 0.38, "floortr+z3": 0.49, "floortr+z6": 1.28, "floortr+z8": 1.52, "floortr+z9": 2.72,
  "fray+fshark": 0.63, "fray+heavylast": 0.88, "fray+legend": 1.74, "fray+lgtr": 1.78, "fray+nopulse": 1.15,
  "fray+odd": 1.32, "fray+online": 1.44, "fray+over2": 0.81, "fray+pair": 0.74, "fray+pb": 0.63, "fray+record": 1.13,
  "fray+rise": 0.4, "fray+setx2": 0.78, "fray+setx3": 0.77, "fray+seven": 1.74, "fray+stairs": 0.72,
  "fray+surfturf": 0.66, "fray+sushi": 0.62, "fray+tour": 1.36, "fray+trbounty": 0.77, "fray+triple": 0.53,
  "fray+trophy": 1.18, "fray+trophy2": 1.5, "fray+twins": 0.75, "fray+z3": 0.84, "fray+z4": 0.86, "fray+z5": 2.3,
  "fray+z6": 2.61, "fray+z7": 0.4, "fray+z8": 0.7, "fray+z9": 0.42, "fshark+fshell": 0.68, "fshark+legend": 0.87,
  "fshark+neighbours": 0.68, "fshark+nopulse": 1.13, "fshark+onezone": 1.32, "fshark+over": 1.15, "fshark+over2": 1.27,
  "fshark+pair": 0.61, "fshark+pb": 1.22, "fshark+rise": 0.42, "fshark+setx3": 0.74, "fshark+seven": 1.25,
  "fshark+stairs": 0.86, "fshark+sushi": 0.31, "fshark+tight": 1.17, "fshark+trophy2": 0.84, "fshark+twins": 0.67,
  "fshark+under": 0.55, "fshark+z3": 0.76, "fshark+z5": 0.49, "fshark+z6": 0.5, "fshark+z9": 0.48,
  "fshell+online": 1.24, "fshell+pair": 0.79, "fshell+pb": 0.75, "fshell+postcard": 1.82, "fshell+rise": 1.6,
  "fshell+setx2": 1.2, "fshell+setx3": 0.81, "fshell+sharkweek": 0.66, "fshell+stairs": 0.83, "fshell+surfturf": 3.07,
  "fshell+sushi": 0.64, "fshell+trbounty": 0.35, "fshell+triple": 0.66, "fshell+under": 1.14, "fshell+z4": 0.81,
  "fshell+z5": 1.18, "fshell+z6": 1.85, "fshell+z8": 1.33, "fshell+z9": 1.49, "heavylast+legend": 0.61,
  "heavylast+odd": 0.87, "heavylast+over2": 1.22, "heavylast+pair": 1.2, "heavylast+pb": 1.9,
  "heavylast+postcard": 0.67, "heavylast+setx2": 1.17, "heavylast+setx3": 1.7, "heavylast+seven": 0.85,
  "heavylast+stairs": 3.61, "heavylast+surfturf": 0.72, "heavylast+sushi": 1.12, "heavylast+tight": 1.13,
  "heavylast+tour": 1.2, "heavylast+trbounty": 0.81, "heavylast+triple": 0.72, "heavylast+trophy2": 1.43,
  "heavylast+twins": 1.24, "heavylast+under": 1.13, "heavylast+z4": 1.12, "heavylast+z5": 1.21, "heavylast+z6": 1.13,
  "heavylast+z8": 1.13, "legend+lgtr": 6.06, "legend+neighbours": 1.78, "legend+onezone": 0.56, "legend+over": 2.72,
  "legend+over15": 3.57, "legend+over2": 4.29, "legend+pair": 0.35, "legend+pb": 3.48, "legend+postcard": 1.64,
  "legend+rise": 1.13, "legend+setx2": 1.44, "legend+setx3": 1.69, "legend+stairs": 0.63, "legend+surfturf": 1.16,
  "legend+sushi": 0.71, "legend+tight": 0.54, "legend+tour": 1.97, "legend+trbounty": 1.4, "legend+triple": 0.23,
  "legend+trophy2": 0.84, "legend+twins": 0.42, "legend+under": 0.07, "legend+z3": 1.28, "legend+z4": 1.19,
  "legend+z5": 1.21, "legend+z7": 1.13, "legend+z8": 1.27, "legend+z9": 1.36, "lgtr+neighbours": 2.6, "lgtr+odd": 0.78,
  "lgtr+onezone": 0.13, "lgtr+online": 1.28, "lgtr+over": 3.4, "lgtr+over15": 4.65, "lgtr+over2": 5.44,
  "lgtr+pair": 0.14, "lgtr+pb": 5.15, "lgtr+postcard": 1.52, "lgtr+record": 1.6, "lgtr+rise": 0.83, "lgtr+setx2": 1.96,
  "lgtr+setx3": 3.62, "lgtr+seven": 0.69, "lgtr+stairs": 0.87, "lgtr+sushi": 0.71, "lgtr+tight": 0.08,
  "lgtr+tour": 3.01, "lgtr+trbounty": 2.64, "lgtr+triple": 0.44, "lgtr+trophy": 2.87, "lgtr+trophy2": 2.15,
  "lgtr+twins": 0.25, "lgtr+under": 0.05, "lgtr+z3": 1.46, "lgtr+z4": 1.38, "lgtr+z5": 1.51, "lgtr+z6": 1.26,
  "lgtr+z7": 1.6, "lgtr+z8": 1.25, "lgtr+z9": 1.37, "neighbours+odd": 0.75, "neighbours+onezone": 0.09,
  "neighbours+online": 1.38, "neighbours+over": 2.42, "neighbours+over15": 2.6, "neighbours+over2": 3.19,
  "neighbours+pair": 0.11, "neighbours+pb": 2.15, "neighbours+rise": 1.2, "neighbours+setx2": 2.72,
  "neighbours+setx3": 9.32, "neighbours+seven": 0.76, "neighbours+sushi": 2.3, "neighbours+tight": 0.08,
  "neighbours+tour": 4.77, "neighbours+trophy": 1.58, "neighbours+trophy2": 1.75, "neighbours+under": 0.46,
  "neighbours+z3": 1.52, "neighbours+z4": 1.35, "neighbours+z5": 1.74, "neighbours+z6": 1.84, "neighbours+z7": 3.26,
  "neighbours+z8": 3.21, "neighbours+z9": 1.18, "nopulse+onezone": 1.14, "nopulse+rise": 0.8,
  "nopulse+sharkweek": 1.18, "nopulse+surfturf": 1.19, "nopulse+tight": 1.13, "nopulse+trbounty": 1.23,
  "nopulse+triple": 1.17, "nopulse+z3": 1.17, "nopulse+z9": 0.86, "odd+onezone": 1.2, "odd+online": 0.74,
  "odd+over": 0.6, "odd+over15": 0.53, "odd+over2": 0.52, "odd+pair": 1.79, "odd+pb": 0.75, "odd+postcard": 1.7,
  "odd+setx2": 0.33, "odd+setx3": 1.21, "odd+seven": 3.44, "odd+surfturf": 0.53, "odd+sushi": 0.64, "odd+tight": 1.17,
  "odd+tour": 0.13, "odd+triple": 1.31, "odd+trophy2": 0.51, "odd+twins": 1.16, "odd+under": 1.34, "odd+z7": 0.61,
  "odd+z8": 0.53, "onezone+online": 1.15, "onezone+over": 0.76, "onezone+over15": 0.65, "onezone+over2": 0.67,
  "onezone+pair": 2.42, "onezone+pb": 0.66, "onezone+postcard": 0.3, "onezone+record": 0.68, "onezone+rise": 0.64,
  "onezone+seven": 0.64, "onezone+surfturf": 0.4, "onezone+sushi": 0.41, "onezone+tight": 3.58, "onezone+tour": 0,
  "onezone+trbounty": 1.34, "onezone+triple": 3.52, "onezone+trophy": 0.43, "onezone+trophy2": 0.15,
  "onezone+twins": 1.49, "onezone+under": 1.42, "onezone+z3": 0.33, "onezone+z4": 0.38, "onezone+z5": 0.58,
  "onezone+z6": 0.68, "onezone+z7": 0.55, "onezone+z8": 0.62, "onezone+z9": 0.57, "online+over": 1.94,
  "online+over15": 0.09, "online+over2": 0.14, "online+pair": 1.41, "online+pb": 0.64, "online+record": 1.14,
  "online+rise": 1.9, "online+setx2": 1.91, "online+seven": 0.32, "online+sushi": 1.55, "online+tour": 1.63,
  "online+trbounty": 0.63, "online+trophy": 1.36, "online+trophy2": 1.82, "online+under": 0.75, "online+z3": 0.83,
  "online+z4": 0.86, "online+z5": 1.12, "online+z6": 1.46, "online+z7": 1.62, "online+z8": 1.85, "online+z9": 1.58,
  "over+over15": 4.22, "over+over2": 4.19, "over+pair": 0.86, "over+pb": 3.46, "over+postcard": 1.82,
  "over+record": 1.27, "over+rise": 1.83, "over+setx2": 2.28, "over+setx3": 2.93, "over+seven": 0.5,
  "over+surfturf": 1.34, "over+sushi": 1.57, "over+tight": 0.69, "over+tour": 2.38, "over+trbounty": 1.22,
  "over+triple": 1.23, "over+trophy": 1.77, "over+trophy2": 2.71, "over+twins": 0.65, "over+under": 0, "over+z3": 0.84,
  "over+z5": 1.3, "over+z6": 1.41, "over+z7": 1.92, "over+z8": 2.3, "over+z9": 1.82, "over15+over2": 7.23,
  "over15+pair": 0.66, "over15+pb": 5.15, "over15+postcard": 2.02, "over15+record": 1.36, "over15+rise": 1.84,
  "over15+setx2": 2.34, "over15+setx3": 3.9, "over15+seven": 0.47, "over15+stairs": 1.21, "over15+surfturf": 1.5,
  "over15+sushi": 1.49, "over15+tight": 0.59, "over15+tour": 2.54, "over15+trbounty": 1.58, "over15+trophy": 1.88,
  "over15+trophy2": 3.12, "over15+twins": 0.47, "over15+under": 0, "over15+z3": 0.74, "over15+z5": 1.38,
  "over15+z6": 1.41, "over15+z7": 1.89, "over15+z8": 2.5, "over15+z9": 1.91, "over2+pair": 0.6, "over2+pb": 6.96,
  "over2+postcard": 1.57, "over2+record": 1.34, "over2+rise": 1.85, "over2+setx2": 2.45, "over2+setx3": 5.14,
  "over2+seven": 0.51, "over2+stairs": 1.31, "over2+surfturf": 1.37, "over2+sushi": 1.35, "over2+tight": 0.62,
  "over2+tour": 2.61, "over2+trbounty": 1.18, "over2+trophy": 1.79, "over2+trophy2": 3.1, "over2+twins": 0.45,
  "over2+under": 0, "over2+z3": 0.66, "over2+z5": 1.45, "over2+z6": 1.35, "over2+z7": 2.01, "over2+z8": 2.63,
  "over2+z9": 1.96, "pair+pb": 0.79, "pair+record": 0.77, "pair+setx2": 0.81, "pair+setx3": 1.24, "pair+stairs": 1.13,
  "pair+surfturf": 0.47, "pair+sushi": 0.36, "pair+tight": 2.19, "pair+tour": 0, "pair+trbounty": 0.78,
  "pair+triple": 4.37, "pair+trophy": 0.65, "pair+trophy2": 0.23, "pair+twins": 2.25, "pair+under": 1.28,
  "pair+z3": 0.59, "pair+z4": 0.7, "pair+z5": 0.88, "pair+z6": 0.74, "pair+z7": 0.56, "pair+z8": 0.63, "pb+rise": 1.66,
  "pb+setx2": 2.14, "pb+setx3": 5.13, "pb+seven": 0.82, "pb+stairs": 1.81, "pb+sushi": 1.34, "pb+tight": 0.71,
  "pb+tour": 2.5, "pb+trophy": 1.79, "pb+trophy2": 3.27, "pb+twins": 0.55, "pb+under": 0.12, "pb+z4": 1.2,
  "pb+z5": 1.3, "pb+z6": 1.25, "pb+z7": 1.8, "pb+z8": 2.12, "pb+z9": 1.96, "postcard+record": 1.37,
  "postcard+rise": 5.04, "postcard+stairs": 0.8, "postcard+tight": 0.27, "postcard+tour": 1.6, "postcard+trophy": 1.36,
  "postcard+trophy2": 1.93, "postcard+under": 0.25, "postcard+z3": 0.83, "postcard+z4": 0.72, "postcard+z5": 0.64,
  "postcard+z6": 0.6, "postcard+z7": 0.71, "postcard+z9": 2.12, "record+rise": 0.85, "record+setx3": 1.19,
  "record+seven": 0.87, "record+sharkweek": 1.24, "record+surfturf": 1.22, "record+tight": 0.7, "record+tour": 1.26,
  "record+trbounty": 1.22, "record+triple": 0.59, "record+trophy": 1.52, "record+trophy2": 1.83, "record+twins": 0.77,
  "record+under": 0.68, "record+z3": 1.32, "record+z4": 1.15, "record+z5": 1.14, "rise+setx2": 1.53,
  "rise+setx3": 1.23, "rise+seven": 1.27, "rise+sushi": 1.37, "rise+tight": 0.57, "rise+trbounty": 0.75,
  "rise+triple": 0.69, "rise+trophy2": 0.84, "rise+twins": 1.13, "rise+under": 0.73, "rise+z3": 0.5, "rise+z4": 0.73,
  "rise+z5": 0.8, "rise+z7": 1.25, "rise+z8": 1.39, "rise+z9": 2.85, "setx2+setx3": 2.75, "setx2+seven": 0.13,
  "setx2+sharkweek": 1.17, "setx2+stairs": 1.22, "setx2+surfturf": 1.21, "setx2+sushi": 1.6, "setx2+tour": 2.81,
  "setx2+triple": 1.75, "setx2+trophy": 1.38, "setx2+trophy2": 2.16, "setx2+under": 0.64, "setx2+z5": 1.15,
  "setx2+z6": 1.12, "setx2+z7": 2.25, "setx2+z8": 2.34, "setx2+z9": 1.66, "setx3+seven": 1.32, "setx3+stairs": 1.95,
  "setx3+sushi": 1.37, "setx3+tight": 0.81, "setx3+tour": 3.37, "setx3+trbounty": 0.65, "setx3+triple": 9.48,
  "setx3+trophy": 1.64, "setx3+trophy2": 5.29, "setx3+twins": 1.27, "setx3+under": 0.33, "setx3+z3": 1.2,
  "setx3+z5": 1.21, "setx3+z7": 2.38, "setx3+z8": 2.4, "setx3+z9": 1.34, "seven+stairs": 0.77, "seven+sushi": 0.85,
  "seven+tight": 0.71, "seven+tour": 0.17, "seven+trbounty": 0.55, "seven+triple": 1.48, "seven+trophy2": 0.53,
  "seven+under": 1.36, "seven+z3": 1.18, "seven+z5": 1.22, "seven+z6": 1.16, "seven+z7": 0.59, "seven+z8": 0.39,
  "seven+z9": 0.86, "sharkweek+trophy": 1.19, "sharkweek+under": 0.65, "sharkweek+z9": 0.6, "stairs+sushi": 1.16,
  "stairs+tour": 1.33, "stairs+trbounty": 0.58, "stairs+triple": 0.49, "stairs+trophy2": 1.5, "stairs+z4": 1.19,
  "stairs+z5": 1.23, "stairs+z7": 1.15, "stairs+z8": 1.17, "surfturf+tight": 0.37, "surfturf+tour": 1.54,
  "surfturf+trophy": 1.13, "surfturf+trophy2": 0.86, "surfturf+twins": 0.83, "surfturf+under": 0.68,
  "surfturf+z3": 0.87, "surfturf+z6": 1.27, "surfturf+z7": 1.32, "surfturf+z8": 1.44, "sushi+tight": 0.58,
  "sushi+tour": 1.89, "sushi+triple": 0.6, "sushi+trophy": 1.28, "sushi+trophy2": 1.44, "sushi+twins": 0.81,
  "sushi+under": 0.87, "sushi+z3": 2.17, "sushi+z4": 0.7, "sushi+z5": 1.21, "sushi+z6": 1.88, "sushi+z7": 2.59,
  "sushi+z8": 1.57, "sushi+z9": 1.28, "tight+tour": 0.05, "tight+triple": 3.08, "tight+trophy": 0.4,
  "tight+trophy2": 0.12, "tight+twins": 1.46, "tight+under": 1.49, "tight+z3": 0.41, "tight+z4": 0.46,
  "tight+z5": 0.72, "tight+z6": 0.82, "tight+z7": 0.73, "tight+z8": 0.76, "tight+z9": 0.53, "tour+trbounty": 1.53,
  "tour+triple": 0.2, "tour+trophy": 1.93, "tour+trophy2": 3.35, "tour+twins": 0.71, "tour+under": 0.34,
  "tour+z3": 1.68, "tour+z4": 1.82, "tour+z5": 2.01, "tour+z6": 2.01, "tour+z7": 2.19, "tour+z8": 2.1, "tour+z9": 1.56,
  "trbounty+trophy": 2.65, "trbounty+trophy2": 2.33, "trbounty+twins": 0.65, "trbounty+under": 0.25,
  "trbounty+z3": 0.74, "trbounty+z4": 0.62, "trbounty+z6": 0.57, "trbounty+z7": 0.61, "trbounty+z8": 0.55,
  "trbounty+z9": 0.69, "triple+trophy": 0.33, "triple+trophy2": 0.39, "triple+twins": 2.96, "triple+z3": 0.74,
  "triple+z4": 0.57, "triple+z5": 0.63, "triple+z6": 0.82, "triple+z7": 0.55, "triple+z8": 0.61, "triple+z9": 0.56,
  "trophy+trophy2": 2.88, "trophy+twins": 0.66, "trophy+under": 0.52, "trophy+z3": 1.27, "trophy+z4": 1.35,
  "trophy+z5": 1.36, "trophy+z6": 1.36, "trophy+z7": 1.35, "trophy+z8": 1.27, "trophy+z9": 1.24, "trophy2+twins": 0.49,
  "trophy2+under": 0.19, "trophy2+z3": 1.7, "trophy2+z4": 1.77, "trophy2+z5": 1.89, "trophy2+z6": 1.56,
  "trophy2+z7": 1.47, "trophy2+z8": 1.43, "trophy2+z9": 1.17, "twins+under": 1.44, "twins+z3": 0.73, "twins+z7": 1.16,
  "twins+z8": 0.86, "under+z4": 1.27, "under+z5": 1.16, "under+z7": 0.85, "under+z8": 0.68, "under+z9": 0.74,
  "z3+z4": 1.21, "z3+z5": 0.74, "z3+z6": 0.6, "z3+z7": 0.53, "z3+z8": 0.39, "z3+z9": 0.56, "z4+z6": 0.69,
  "z4+z7": 0.81, "z4+z8": 0.61, "z4+z9": 0.79, "z5+z6": 1.2, "z5+z7": 0.73, "z5+z8": 0.74, "z5+z9": 0.81,
  "z6+z7": 1.14, "z6+z8": 0.76, "z7+z8": 1.34, "z7+z9": 1.19, "z8+z9": 1.4
};                                       // filled from the bot run below this block
const liftKey = (i, w) => BETS[i][0] === "wanted" ? "Z" + SPEC[w][2] : BETS[i][0];
function pairLift(a, b, w) { const x = liftKey(a, w), y = liftKey(b, w), k = x < y ? x + "+" + y : y + "+" + x, v = PAIR_LIFT[k]; return v === undefined ? 1 : v; }
function parlayChance(legs, w) {
  let p = legs.reduce((a, i) => a * betChance(i, w), PARLAY_EDGE);
  for (let a = 0; a < legs.length; a++) for (let b = a + 1; b < legs.length; b++) p *= pairLift(legs[a], legs[b], w);
  return p;
}
const parlayPays = p => { if (p <= 0 || EDGE / p > PARLAY_CAP) return 0; const x = EDGE / p; return Math.max(1.1, x >= 10 ? Math.floor(x) : Math.floor(x * 10) / 10); };   // 0 = too long a shot
const parlayDead = (legs, w) => legs.some((a, x) => legs.some((b, y) => y > x && pairLift(a, b, w) === 0));   // two legs that can't both win
const betLegs = b => (!b ? [] : b.k === "parlay" ? b.legs : [b.k]);
const betHas = k => betLegs(tav().bet).includes(k);

function betAvail(i) {
  const id = BETS[i][0];
  if (id === "newsp" || id === "newtr") return false;                          // retired Nov 20, 2026: impossible once your log fills up
  if ((id === "top10" || id === "beat1") && !LB.url) return false;             // no shared board here
  if ((id === "beatlast") && !tav().hist.length) return false;
  if (id === "wanted") return false;                                           // it has its own slot on the board
  return true;
}
function betText(t, line, w) {
  const ws = w && SPEC[w], wz = ws && ZONES[ws[2]];
  return t.replace("{L}", line).replace("{2L}", 2 * line).replace("{1.5L}", Math.round(1.5 * line / 10) * 10).replace("{B}", SPEC[todaysBounty()] ? SPEC[todaysBounty()][1] : "THE BOUNTY")
    .replace("{P}", store.best || 0).replace("{J}", Math.ceil(JUNK_K * line)).replace("{W}", ws ? ws[1] : "").replace("{WZ}", wz ? wz[0] : "").replace("{WM}", wz ? wz[1] + "-" + wz[2] + " M" : "");
}
function betBoard() {                                       // -> five bet indexes: 2 safer, 1 medium, the WANTED fish, 1 long shot
  const r = RNG(hashStr("bets" + (store.dives || 0) + (store.name || ""))), ch = BETS.map((b, i) => betChance(i));
  const all = BETS.map((b, i) => i).filter(betAvail);
  const tier = (lo, hi) => all.filter(i => ch[i] >= lo && ch[i] < hi);
  const pick = (pool, n, out) => { pool = pool.filter(i => !out.includes(i)); for (let k = 0; k < n && pool.length; k++) out.push(pool.splice(Math.floor(r.random() * pool.length), 1)[0]); };
  const out = [], wanted = wantedFish() ? 1 : 0;
  pick(tier(0.3, 1), 2, out); pick(tier(0.08, 0.3), 2 - wanted, out); pick(tier(0, 0.08), 1, out);
  if (wanted) out.push(BET_I.wanted);
  pick(all, 5 - out.length, out);                           // a thin tier: fill from anywhere
  return out.sort((a, b) => ch[b] - ch[a]);
}
const betTier = (i, p) => BETS[i][0] === "wanted" ? "WANTED" : p >= 0.3 ? "SAFER" : p >= 0.08 ? "MEDIUM" : "LONG SHOT";
function betOdds() {                                        // [[id, label, pays, what it means, index, tier]] for this dive's board
  const line = betLine(), w = wantedFish();
  return betBoard().map(i => { const p = betChance(i, w); return [BETS[i][0], BETS[i][0] === "wanted" ? SPEC[w][1] : betText(BETS[i][1], line), betPays(p), betText(BETS[i][2], line, w), i, betTier(i, p)]; });
}
function betLabel(b) {
  if (b.k === "parlay") return b.legs.length + "-BET PARLAY";
  if (b.k === "wanted") return "WANTED";
  const i = BET_I[b.k]; return i === undefined ? b.k.toUpperCase() : betText(BETS[i][1], b.line).replace(" LB", "");
}
function betSlip() {                                        // what PLACE BET would place: {legs, pays, parlay, dead}
  const b = TAV.bet, w = b.w;
  if (b.ticks.length >= 2) {
    const legs = b.ticks.map(t => b.opts[t][4]), dead = parlayDead(legs, w);
    const pays = dead ? 0 : parlayPays(parlayChance(legs, w));
    return { legs, ticks: b.ticks.slice(), parlay: true, dead, long: !dead && !pays, pays };
  }
  return { legs: [b.opts[b.sel][4]], ticks: [b.sel], parlay: false, dead: false, pays: b.opts[b.sel][2] };
}
function betTick(n) {                                       // tick or untick a bet for a parlay (3 at most)
  const b = TAV.bet, k = b.ticks.indexOf(n);
  if (k >= 0) b.ticks.splice(k, 1); else if (b.ticks.length < PARLAY_MAX) b.ticks.push(n); else { play("miss"); return; }
  b.sel = n; play("tick");
}
function openBet() {
  claimDaily();
  const q = tav(), o = betOdds();
  let sel = 0, stake = 10, ticks = [];
  if (q.bet && !q.bet.cast) {                               // re-open: the stake comes back first
    if (q.bet.k === "parlay") { ticks = q.bet.legs.map(k => o.findIndex(r => r[0] === k)).filter(t => t >= 0); if (ticks.length < 2) ticks = []; sel = ticks[0] || 0; }
    else sel = Math.max(0, o.findIndex(r => r[0] === q.bet.k));
    stake = q.bet.stake; q.chips += q.bet.stake; q.bet = null; saveStore();
  }
  TAV.bet = { opts: o, sel, stake: stakeStep(stake, 0), ticks, card: false, w: wantedFish() };
  openOverlay("bet");
}
function placeBet() {
  const b = TAV.bet, q = tav(), s = betSlip(), ks = s.legs.map(i => BETS[i][0]);
  if (q.chips < b.stake || b.stake < 1 || ks.some(betBlocked) || s.dead || s.long) { play("miss"); return; }
  q.chips -= b.stake;
  q.bet = s.parlay ? { k: "parlay", legs: ks, stake: b.stake, pays: s.pays, line: betLine(), cast: false, w: b.w }
    : { k: ks[0], stake: b.stake, pays: s.pays, line: betLine(), cast: false, w: b.w };
  saveStore(); play("select"); S.overlay = null;
}
function loseCastBet(msg) {                                 // a cast bet that never reached the haul (gave up, or left the page) is lost
  const b = tav().bet;
  if (!b || !b.cast) return;
  tav().bet = null; saveStore();
  if (S) S.popups.push([msg || "YOUR BET WAS LOST", 2.6, ORANGE]);
}
function settleBet(dive) {                                  // -> a popup line for the haul screen, or null
  const b = tav().bet;
  if (!b) return null;
  tav().bet = null;
  const d = b.w ? Object.assign({}, dive, { wanted: b.w }) : dive, junk = dive.total < JUNK_K * b.line;
  const res = betLegs(b).map(k => { const i = BET_I[k]; return i === undefined || (junk && junkVoids(k)) ? null : BETS[i][4](d, b.line); });   // a thrown dive voids only the bets it could win
  const par = b.k === "parlay", T = btake();
  betLegs(b).forEach((k, n) => { if (res[n] === null || BET_I[k] === undefined) return; const e = T[k] || (T[k] = [0, 0]); e[0]++; if (res[n]) e[1]++; if (k === "wanted") wantedRecord(b.w, res[n]); });
  if (res.some(r => r === null)) { addChips(b.stake); return [par ? "PARLAY VOID: STAKE BACK" : "BET VOID: STAKE BACK", 4, CHIP]; }    // e.g. UNDER without a real dive
  if (res.some(r => !r)) { saveStore(); return [par ? "PARLAY LOST (" + res.filter(r => r).length + "/" + res.length + ")" : "BET LOST", 3, ORANGE]; }
  const pay = Math.round(b.stake * b.pays);   // round, not floor: odd stakes are allowed since Nov 19, 2026
  addChips(pay, "win");
  if (b.pays >= 8) tavAward("longshot");
  return [(par ? "PARLAY WON! +" : "BET WON! +") + fmtChips(pay, 1e6) + " CHIPS", 4.5, CHIP];
}

// ---- What every dive bet means, in full (Nov 20, 2026), shown before you take it. {L} line, {2L}, {1.5L}, {B} today's
// bounty fish, {P} your best, {W} the wanted fish, {WZ}/{WM} its zone and depths. `fam` draws the fish that count.
const BET_HELP = {
  over: ["YOUR FINAL SCORE, WITH SET BONUSES AND THE FLOOR BONUS, MUST BEAT {L}. THE LINE IS THE MIDDLE OF YOUR RECENT DIVES."],
  under: ["SCORE {L} OR LESS, BUT ONLY ON A REAL DIVE: ALL 3 FISH CAUGHT BELOW 400 M. ANYTHING ELSE UNDER THE LINE GIVES YOUR STAKE BACK."],
  floor: ["SINK ALL THE WAY TO THE SEA FLOOR AT 1158 M. A FULL HOOK SENDS YOU UP, SO LEAVE ROOM ON IT."],
  trophy: ["LAND A TROPHY FISH, ONE WITH RED-ORANGE SPARKLES. YOU HAVE TO WIN ITS FIGHT TO KEEP IT."],
  legend: ["LAND A LEGENDARY FISH, THE ONES WITH A GOLD AURA AND CIRCLING STARS. WIN THE FIGHT TO KEEP IT."],
  over2: ["SCORE MORE THAN {2L}, DOUBLE YOUR LINE OF {L}."],
  over15: ["SCORE MORE THAN {1.5L}, ONE AND A HALF TIMES YOUR LINE OF {L}."],
  online: ["FINISH WITHIN 15 OF {L}, ABOVE OR BELOW. YOU NEED AT LEAST ONE FISH."],
  fish50: ["LAND ONE FISH THAT WEIGHS 50 LB OR MORE ON ITS OWN. THE BOUNTY X3 DOESN'T COUNT HERE."],
  fish200: ["LAND ONE FISH THAT WEIGHS 200 LB OR MORE ON ITS OWN. THE BOUNTY X3 DOESN'T COUNT HERE."],
  all10: ["FILL THE HOOK WITH 3 FISH, AND EVERY ONE MUST WEIGH 10 LB OR MORE."],
  beatlast: ["SCORE MORE THAN YOUR LAST DIVE. IF YOUR LAST DIVE WAS THROWN AWAY, YOUR STAKE COMES BACK."],
  odd: ["YOUR FINAL SCORE IS AN ODD NUMBER, LIKE 141 OR 207. A SCORE OF 0 LOSES."],
  seven: ["YOUR FINAL SCORE ENDS IN 7, LIKE 147 OR 307."],
  heavylast: ["FILL THE HOOK, AND THE THIRD FISH YOU CATCH IS THE HEAVIEST OF THE THREE. A TIE FOR HEAVIEST STILL WINS."],
  d600: ["GET YOUR HOOK DEEPER THAN 600 M AT ANY POINT IN THE DIVE. WHAT YOU CATCH DOESN'T MATTER."],
  d900: ["GET YOUR HOOK DEEPER THAN 900 M AT ANY POINT IN THE DIVE. WHAT YOU CATCH DOESN'T MATTER."],
  floor3: ["TOUCH THE FLOOR AT 1158 M AND COME HOME WITH A FULL HOOK. FISH CAUGHT ON THE RIDE UP COUNT."],
  deephook: ["FILL THE HOOK WITH 3 FISH, ALL CAUGHT DEEPER THAN 500 M."],
  rise: ["TOUCH THE FLOOR WITH ROOM ON YOUR HOOK, THEN CATCH A FISH ON THE SLOW RIDE BACK UP."],
  tight: ["FILL THE HOOK WITH 3 FISH, ALL CAUGHT WITHIN 50 M OF EACH OTHER."],
  onezone: ["FILL THE HOOK WITH 3 FISH THAT ALL LIVE IN THE SAME ZONE."],
  tour: ["FILL THE HOOK WITH 3 FISH FROM 3 DIFFERENT ZONES. THAT'S THE GRAND TOUR SET BONUS."],
  deeptrio: ["FILL THE HOOK WITH 3 FISH FROM THE BONE YARD OR DEEPER, 830 M AND DOWN. THAT'S THE DEEP TRIO SET BONUS."],
  trophy2: ["LAND 2 TROPHY FISH ON ONE DIVE. LEGENDARIES DON'T COUNT AS TROPHIES HERE."],
  pair: ["CATCH 2 OF THE SAME SPECIES ON ONE DIVE. 3 OF A KIND WINS TOO."],
  triple: ["FILL THE HOOK WITH 3 OF THE SAME SPECIES."],
  bounty: ["LAND TODAY'S BOUNTY FISH, THE {B}. IT'S THE SAME FISH FOR EVERYONE TODAY."],
  newsp: ["LAND A SPECIES THAT ISN'T IN YOUR LOG YET."],
  record: ["BEAT YOUR LOG'S RECORD WEIGHT FOR A SPECIES YOU'VE CAUGHT BEFORE. A FIRST CATCH DOESN'T COUNT."],
  setx2: ["GET SET BONUSES WORTH X2 OR MORE. A PAIR +0.5, 3 ZONES +1, 3 TROPHIES +1, DEEP TRIO +1, 3 OF A KIND +2."],
  setx3: ["GET SET BONUSES WORTH X3 OR MORE. A PAIR +0.5, 3 ZONES +1, 3 TROPHIES +1, DEEP TRIO +1, 3 OF A KIND +2."],
  clean: ["FILL THE HOOK WITH 3 FISH AND NEVER TOUCH A JELLYFISH."],
  pb: ["BEAT YOUR BEST SCORE EVER, {P}."],
  top10: ["SCORE HIGH ENOUGH TO MAKE TODAY'S TOP 10 ON THE SHARED SCOREBOARD."],
  beat1: ["BEAT THE SCORE AT THE TOP OF TODAY'S SHARED SCOREBOARD."],
  floortr: ["TOUCH THE FLOOR AT 1158 M AND LAND A TROPHY FISH ON THE SAME DIVE."],
  floorlg: ["TOUCH THE FLOOR AT 1158 M AND LAND A LEGENDARY ON THE SAME DIVE."],
  lgtr: ["LAND A LEGENDARY AND A TROPHY FISH ON THE SAME DIVE."],
  trbounty: ["LAND A TROPHY FISH AND TODAY'S BOUNTY FISH, THE {B}, ON THE SAME DIVE."],
  newtr: ["LAND A SPECIES NEW TO YOUR LOG AND A TROPHY FISH."],
  deepover: ["GET DEEPER THAN 900 M AND SCORE MORE THAN {L}, BOTH ON THE SAME DIVE."],
  nopulse: ["FILL THE HOOK WITHOUT USING A SINGLE PULSE. CAN'T BE TAKEN WITH THE ANGLER'S HOOK."],
  fshark: ["LAND ANY SHARK. HOOK IT FROM BEHIND: TOUCH A SHARK'S FRONT HALF AND IT BITES YOUR LAST FISH OFF. THESE COUNT:", ["shark"]],
  fink: ["LAND ANY SQUID OR OCTOPUS. THESE COUNT:", ["ink"]],
  feel: ["LAND ANY EEL. THESE COUNT:", ["eel"]],
  fshell: ["LAND ANY CRAB, LOBSTER, SHRIMP OR OTHER SHELLED CRITTER. THESE COUNT:", ["shell"]],
  fray: ["LAND ANY RAY. THESE COUNT:", ["ray"]],
  fglow: ["LAND A FISH THAT MAKES ITS OWN LIGHT. THESE COUNT:", ["glow"]],
  surfturf: ["LAND A SHARK, FROM BEHIND, AND A SHELLFISH ON THE SAME DIVE. SHARKS, THEN SHELLFISH:", ["shark", "shell"]],
  calamari: ["LAND 2 SQUID OR OCTOPUS ON ONE DIVE. ANY 2 OF THESE:", ["ink"]],
  sushi: ["LAND AN EEL AND A SQUID OR OCTOPUS ON THE SAME DIVE. EELS, THEN INK:", ["eel", "ink"]],
  sharkweek: ["LAND 2 SHARKS ON ONE DIVE, BOTH FROM BEHIND OR THEY BITE. ANY 2 OF THESE:", ["shark"]],
  boil: ["FILL THE HOOK WITH ONE OF EACH: A SHELLFISH, A SQUID OR OCTOPUS, AND AN EEL. THE FISH IN EACH FAMILY ARE SHOWN ON THEIR OWN BETS."],
  nobites: ["FILL THE HOOK WITH 3 FISH AND NEVER GET BITTEN BY A SHARK. LOSING A FISH TO A BITE LOSES THE BET."],
  stairs: ["FILL THE HOOK, AND EACH FISH WEIGHS MORE THAN THE ONE YOU CAUGHT BEFORE IT, LIKE 8, 20, 35. A TIE LOSES."],
  downhill: ["FILL THE HOOK, AND EACH FISH WEIGHS LESS THAN THE ONE YOU CAUGHT BEFORE IT, LIKE 35, 20, 8. A TIE LOSES."],
  twins: ["LAND 2 FISH THAT BOTH WEIGH 10 LB OR MORE AND ARE WITHIN 2 LB OF EACH OTHER, LIKE 24 AND 26."],
  balanced: ["FILL THE HOOK WITH 3 FISH OF 20 LB OR MORE, WITH NO MORE THAN 10 LB BETWEEN THE LIGHTEST AND THE HEAVIEST."],
  fish100: ["LAND ONE FISH THAT WEIGHS 100 LB OR MORE ON ITS OWN. THE BOUNTY X3 DOESN'T COUNT HERE."],
  bookends: ["LAND ONE FISH SHALLOWER THAN 400 M AND ANOTHER DEEPER THAN 900 M, BOTH ON THE SAME DIVE."],
  neighbours: ["FILL THE HOOK WITH 3 FISH FROM 3 ZONES THAT SIT RIGHT NEXT TO EACH OTHER, LIKE THE WRECK, THE ABYSS AND THE CAVES."],
  postcard: ["LAND A CORAL REEF FISH, ABOUT 170 TO 250 M, AND TOUCH THE FLOOR AT 1158 M ON THE SAME DIVE."],
  bounty2: ["LAND 2 OF TODAY'S BOUNTY FISH, THE {B}, ON ONE DIVE."],
  wanted: ["LAND A {W}. IT LIVES IN {WZ}, {WM}. THERE'S A NEW WANTED FISH EVERY DIVE."],
};
[3, 4, 5, 6, 7, 8, 9].forEach(z => {                       // the zone bets: WRECK FISH ... FLOOR FISH
  BET_HELP["z" + z] = ["LAND ANY FISH THAT LIVES IN " + ZONES[z][0] + ", " + ZONES[z][1] + " TO " + ZONES[z][2] + " M. WHAT COUNTS IS THE FISH'S HOME ZONE, NOT WHERE YOU CAUGHT IT."];
});
const BET_VOID = { under: "NO 3 FISH BELOW 400", beatlast: "LAST DIVE THROWN", top10: "BOARD OFFLINE", beat1: "BOARD OFFLINE" };
function betVoidText(k, line) { return BET_VOID[k] || (junkVoids(k) ? "HAUL UNDER " + Math.ceil(JUNK_K * line) + " LB" : null); }
const chanceText = p => (p >= 0.25 ? "ABOUT " + Math.round(p * 10) + " IN 10" : "ABOUT 1 IN " + Math.round(1 / p));
function betRecordText(i) {                                 // -> [label, text]: "WON 4 OF 9" on the bets you took, or how every dive went
  const k = BETS[i][0], t = btake()[k];
  if (t && t[0]) return ["YOUR BETS", "WON " + t[1] + " OF " + t[0]];
  if (k === "wanted") return ["YOUR BETS", "NONE YET"];
  const e = betLife()[i];
  return e && e[0] ? ["YOUR DIVES", "HIT " + e[1] + " OF " + e[0]] : ["YOUR RECORD", "NEW BET"];
}

// ---- Catch 21: blackjack with fish cards weighing 1 to 11 lb. Trophy cards count double; a legendary card wins outright.
// The old fisherman draws to 17. Ties go to you (it keeps the house edge near 5%; see tools/README.md).
const C21_POOL = SPECIES.filter(s => !s[7] && s[4] > 0 && !HIDDEN.includes(s[0])).map(s => s[0]), C21_LEG = SPECIES.filter(s => s[7] && s[4] > 0).map(s => s[0]);
function c21Card() {
  const r = Math.random();
  if (r < 0.03) return [C21_LEG[Math.floor(Math.random() * C21_LEG.length)], 0, "l"];
  const w = 1 + Math.floor(Math.random() * 11);
  return [C21_POOL[Math.floor(Math.random() * C21_POOL.length)], w, Math.random() < 0.08 ? "t" : ""];
}
const c21Sum = h => h.reduce((a, q) => a + (q[2] === "t" ? q[1] * 2 : q[1]), 0);
// VIP rules (the back room): no bet limit (was 200), a legendary card pays 2 to 1, ties push. House edge about 0.5-2.6%.
function c21New(vip) { const max = MAX_STAKE; TAV.c21 = { vip: !!vip, max, phase: "stake", dealer: [], you: [], hide: true, bet: stakeStep(TAV.c21 && !!TAV.c21.vip === !!vip ? TAV.c21.bet : vip ? 50 : 10, 0, max), msg: "PLACE YOUR BET", t: 0, win: 0 }; }
function c21Deal() {
  const c = TAV.c21;
  if (tav().chips < c.bet || c.bet < 1) { play("miss"); c.msg = "NOT ENOUGH CHIPS"; return; }
  addChips(-c.bet);
  c.you = [c21Card(), c21Card()]; c.dealer = [c21Card(), c21Card()]; c.hide = true; c.phase = "play"; c.staked = c.bet;
  play("tick");
  const nat = h => h.length === 2 && c21Sum(h) === 21;
  if (c.you.some(q => q[2] === "l")) return c21End(c.vip ? 3 : 2, c.vip ? "A LEGEND! PAYS 2 TO 1" : "A LEGEND! YOU WIN");
  if (c.dealer.some(q => q[2] === "l")) { c.hide = false; return c21End(0, "HIS LEGEND WINS"); }
  if (nat(c.you)) { c.hide = false; return nat(c.dealer) ? c21End(1, "TWO 21S: A PUSH") : c21End(2.5, "CATCH 21! 3 TO 2"); }
  if (nat(c.dealer)) { c.hide = false; return c21End(0, "HE HAS 21"); }
  if (c21Sum(c.you) > 21) { c.hide = false; return c21End(0, "BUST ON THE DEAL"); }      // two big trophies can do it
  c.msg = "YOU HAVE " + c21Sum(c.you);
}
function c21Hit(dbl) {
  const c = TAV.c21;
  if (c.phase !== "play") return;
  if (dbl) { if (c.you.length !== 2 || tav().chips < c.staked) { play("miss"); return; } addChips(-c.staked); c.staked *= 2; }
  const q = c21Card(); c.you.push(q); play("tick");
  if (q[2] === "l") return c21End(c.vip ? 3 : 2, c.vip ? "A LEGEND! PAYS 2 TO 1" : "A LEGEND! YOU WIN");
  const t = c21Sum(c.you);
  if (t > 21) { c.hide = false; return c21End(0, "BUST AT " + t); }
  c.msg = "YOU HAVE " + t;
  if (dbl || t === 21) c21Stand();
}
function c21Stand() { const c = TAV.c21; if (c.phase !== "play") return; c.phase = "dealer"; c.hide = false; c.t = 0; c.msg = "HIS TURN..."; }
function c21Tick(dt) {                                       // the old man draws one card at a time
  const c = TAV.c21;
  if (!c || c.phase !== "dealer" || (c.t += dt) < 0.55) return;
  c.t = 0;
  const d = c21Sum(c.dealer), y = c21Sum(c.you);
  if (d < 17) { const q = c21Card(); c.dealer.push(q); play("tick"); if (q[2] === "l") c21End(0, "HIS LEGEND WINS"); return; }
  if (d > 21) c21End(2, "HE BUSTS! YOU WIN");
  else if (y === d && c.vip) c21End(1, "A TIE: STAKE BACK");
  else if (y >= d) c21End(2, y === d ? "A TIE GOES TO YOU" : "YOU WIN, " + y + " TO " + d);
  else c21End(0, "HE WINS, " + d + " TO " + y);
}
function c21End(mult, msg) {                                 // mult: what comes back for each chip staked (2 = even money)
  const c = TAV.c21, back = Math.round(c.staked * mult);
  c.phase = "stake"; c.msg = msg; c.win = back - c.staked;
  if (back) addChips(back, back > c.staked ? "win" : "");
  if (back > c.staked) { tav().stats.hands++; tavTitles(); play("chime"); } else if (!back) play("miss");
  c.bet = stakeStep(c.bet, 0, c.max);
}

// ---- the Derby: five fish race with bursts and stalls; each has hidden speed, stamina and burst, and odds to match
// The derby (racers, prices, the race) lives in derby.js since Nov 18, 2026.

// ---- what chips buy
const STORIES = [
  "I KNEW HIM. WALT. BEST ANGLER THIS SHORE EVER HAD. CAUGHT A KRAKEN ONCE, OR SAID HE DID.",
  "WALT GOT IT IN HIS HEAD THE FLOOR WASN'T THE BOTTOM. SAID HE COULD HEAR SOMETHING BREATHING DOWN THERE.",
  "HE STARTED DROPPING AN EMPTY HOOK. ALL THE WAY DOWN. NO BAIT, NO FISH. JUST LISTENING.",
  "ONE NIGHT HE CAME BACK SOAKED AND SHAKING. SAID AN EYE OPENED UNDER HIM, BIG AS THIS SHACK.",
  "NEXT MORNING HIS BOAT WAS OUT THERE EMPTY. LINE STILL IN THE WATER. STILL PULLING.",
  "I STILL FIND HIS BOTTLES. SAME HANDWRITING. BUT THE NEWER ONES... THEY'RE WRITTEN UPSIDE DOWN.",
];
// Songs: [name, price (null: earned), how it's earned, beats per minute, lead, bass]. Notes are one eighth each; "-" rests.
const SONGS = [
  ["SEA SHANTY", 60, "", 150, "D4 - F4 A4 D5 - A4 F4 G4 - E4 G4 C5 - G4 E4 F4 - D4 F4 A4 - G4 F4 E4 - C4 E4 D4 - - -", "D2 - A2 - D2 - A2 - C3 - G2 - C3 - G2 - D2 - A2 - D2 - A2 - A2 - C3 - D2 - - -"],
  ["LAZY TIDE", 60, "", 96, "E4 - G4 - B4 - A4 - G4 - E4 - D4 - - - E4 - G4 - A4 - B4 - D5 - B4 - - -", "C3 - - - G2 - - - A2 - - - G2 - - - C3 - - - G2 - - - D3 - - - G2 - - -"],
  ["HORNPIPE", 80, "", 176, "G4 B4 D5 B4 G4 B4 D5 G5 F5 D5 C5 A4 F4 A4 C5 F5 E5 C5 B4 G4 E4 G4 B4 E5 D5 B4 A4 F4 G4 - G4 -", "G2 - D3 - G2 - D3 - F2 - C3 - F2 - C3 - E2 - B2 - E2 - B2 - D2 - A2 - G2 - - -"],
  ["DEEP BLUE", 80, "", 84, "A3 - C4 - E4 - - - D4 - C4 - B3 - - - A3 - C4 - E4 - A4 - G4 - E4 - - - - -", "A1 - - - E2 - - - F2 - - - E2 - - - A1 - - - E2 - - - D2 - - - E2 - - -"],
  ["LIGHTHOUSE", 100, "", 120, "C5 - G4 - E4 - G4 - C5 - D5 - E5 - - - D5 - B4 - G4 - B4 - D5 - C5 - - - -", "C3 - G2 - C3 - G2 - A2 - E2 - A2 - E2 - G2 - D2 - G2 - D2 - C3 - G2 - C3 - -"],
  ["BILGE RAT", 100, "", 160, "E4 E4 - G4 - E4 D4 - C4 C4 - E4 - C4 B3 - A3 - C4 - E4 - G4 - F4 E4 D4 - C4 - - -", "A2 - E3 - A2 - E3 - A2 - E3 - A2 - E3 - F2 - C3 - G2 - D3 - A2 - E3 - A2 - - -"],
  ["FIRST LEGEND", null, "LAND YOUR FIRST LEGENDARY", 132, "C5 - E5 - G5 - C6 - - - G5 - C6 - - - - - E5 - F5 - G5 - A5 - G5 - E5 - C5 - - -", "C3 - G2 - C3 - G2 - E3 - G2 - C3 - - - F2 - C3 - G2 - D3 - C3 - G2 - C3 - - -"],
  ["BAIT MASTER BOOGIE", null, "EARN BAIT MASTER", 140, "C4 - E4 G4 A4 - G4 E4 C4 - E4 G4 A4 - G4 - F4 - A4 C5 D5 - C5 A4 G4 - E4 C4 D4 - C4 -", "C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 C2 C3 C2 -"],
  ["FULL LOG", null, "LOG EVERY SPECIES", 120, "G4 - C5 - E5 - G5 - - - E5 - G5 - - - A5 - G5 - E5 - C5 - D5 - E5 - C5 - - - - -", "C3 - - - G2 - - - C3 - - - E3 - - - F2 - - - G2 - - - C3 - - - - - - -"],
  ["LULLABY", null, "PUT THE SLEEPER BACK TO SLEEP", 72, "E4 - G4 - B4 - - - A4 - G4 - E4 - - - D4 - E4 - G4 - - - D4 - E4 - - - - -", "E2 - - - B2 - - - C3 - - - G2 - - - A2 - - - E2 - - - B1 - - - E2 - - -"],
  ["CREDITS THEME", null, "CATCH YOURSELF", 108, "C5 - E5 - G5 - - - E5 - D5 - C5 - A4 - - - G4 - A4 - C5 - D5 - E5 - D5 - C5 - - - - -", "C3 - G2 - A2 - E2 - F2 - C3 - G2 - - - F2 - C3 - G2 - D3 - C3 - G2 - C3 - - -"],,
  ["RUSTY HOOK RAG", 120, "", 168, "C5 - E5 G5 - E5 C5 - D5 - F5 A5 - F5 D5 - E5 - G5 C6 - G5 E5 - D5 G4 B4 D5 C5 - - -", "C3 G2 C3 G2 C3 G2 C3 G2 D3 A2 D3 A2 D3 A2 D3 A2 C3 G2 C3 G2 C3 G2 C3 G2 G2 D3 G2 B2 C3 - - -"],
  ["SALTY SORROW", 100, "", 80, "A4 - - C5 B4 - A4 - G4 - - E4 - - - - F4 - A4 - G4 - F4 - E4 - D4 - E4 - - -", "A2 - - - E2 - - - C3 - - - G2 - - - D2 - - - F2 - - - E2 - - - A1 - - -"],
  ["LUCKY SEVENS", 120, "", 150, "G4 G4 - B4 - D5 - G5 - - F5 - D5 - B4 - C5 C5 - E5 - G5 - C6 - - B5 - G5 - D5 -", "G2 - D3 - G2 - D3 - G2 - D3 - G2 - D3 - C3 - G2 - C3 - G2 - D3 - A2 - D3 - G2 -"],
  ["MOONLIGHT REEL", 140, "", 132, "D5 A4 F4 A4 D5 E5 F5 E5 D5 C5 A4 C5 G4 A4 C5 A4 D5 A4 F4 A4 D5 E5 F5 G5 A5 G5 F5 E5 D5 - D5 -", "D3 - A2 - D3 - A2 - C3 - G2 - C3 - G2 - D3 - A2 - D3 - A2 - A2 - E3 - D3 - - -"],
  ["INK BLUES", 120, "", 96, "A3 - C4 - D4 - E4 - G4 - - E4 - D4 - - C4 - A3 - C4 - D4 - E4 - G4 - A4 - - -", "A1 - A2 - A1 - A2 - D2 - D3 - D2 - D3 - A1 - A2 - A1 - A2 - E2 - D2 - A1 - - -"],
  ["LAST CALL", 160, "", 72, "E4 - - - G4 - - - C5 - - - B4 - - - A4 - - - G4 - - - F4 - E4 - D4 - C4 -", "C3 - - - E2 - - - A2 - - - G2 - - - F2 - - - C3 - - - G2 - - - C2 - - -"]
];
const songOwned = i => tav().songs.includes(i);
function earnSong(i) { if (songOwned(i)) return; tav().songs.push(i); saveStore(); if (S) S.popups.push(["NEW SONG: " + SONGS[i][0], 4, CHIP]); }
const FISH_PICKS = ["clown", "koi", "tuna", "sword", "puffer", "bass", "parrot", "ember", "trout", "perch"];
// The chip shop. Pages of seven; the bottle things sit at the very bottom on purpose: with steady betting they were
// far too easy to buy, so a rumour now costs more each time (150, +50 a time, up to 400) and the magnet lasts 3 dives.
// [id, label, price, what it is]. Cosmetics here are the tavern's own: chips only, never in the coin shop.
const SHOP_PER = 7;
const CZ_ROWS = ["locker", "dealer", "decor", "round"];     // chip-shop rows run by casino.js
const SHOP_ROWS = [
  ["locker", "CAPTAIN'S LOCKER", 0, "PRESTIGE GEAR. 10,000 TO 75,000 CHIPS"],   // casino.js
  ["dealer", "SHADY DEALER", 0, "THREE THINGS. THIS WEEK ONLY"],             // casino.js
  ["decor", "DECORATE THE BAR", 0, "LAMPS, SIGNS, A FISH TANK"],             // casino.js
  ["round", "BUY A ROUND", 1000, "EVERYONE SEES YOUR NAME TODAY"],           // casino.js
  ["story", "A STORY", 50, "TIP THE OLD MAN"],
  ["fish", "A DERBY FISH", 200, "YOUR OWN RACER"],
  ["finprix", "FIN PRIX LOOKS", 0, "KARTS, PAINT, TRAILS, POSES"],
  ["jukebox", "JUKEBOX", 150, "MUSIC HERE AND ON THE TITLE"],
  ["dream", "DREAM SLEEPER", 20, "FIGHT A GHOST OF IT. PRACTICE ONLY"],
  ["drink", "A DRINK", 10, "BUY HIM ONE. HE TALKS"],
  ["scratch", "SCRATCH CARD", 5, "THREE ALIKE WINS, UP TO X500"],
  ["show", "FIREWORKS", 30, "A SHOW OVER YOUR BOAT"],
  ["compass", "A COMPASS", 300, "THE SHIPWRIGHT NEEDS ONE"],   // for the raft (island.js)
  ["cap", "OLD MAN'S CAP", 300, "A HAT. HE HAS A SPARE"],
  ["cat", "BAR CAT", 600, "A PET. IT CAME WITH THE PLACE"],
  ["tub", "RUSTY TUB", 900, "A BOAT. FLOATS, MOSTLY"],
  ["ace", "ACE OF SPADES", 250, "A FLAG FOR YOUR BOAT"],
  ["pchips", "POKER CHIPS", 400, "FISH FLAIR"],
  ["chipline", "CHIP LINE", 350, "A FISHING LINE"],
  ["spray", "CHIP SPRAY", 350, "A BUBBLE TRAIL"],
  ["chiphook", "CHIP HOOK", 400, "A HOOK. MATCHES THE CHIPS"],
  ["jpline", "JACKPOT LINE", 1500, "JACKPOT SET: A LINE"], ["jphook", "LUCKY 7 HOOK", 1200, "JACKPOT SET: A HOOK"],
  ["jptrail", "CHERRY FIZZ", 2000, "JACKPOT SET: BUBBLES"], ["jpflair", "777", 2500, "JACKPOT SET: FISH FLAIR"],
  ["hsline", "DICE LINE", 1500, "HIGH STAKES: A LINE"], ["hshook", "DICE HOOK", 1200, "HIGH STAKES: A HOOK"],
  ["hstrail", "TUMBLING DICE", 2000, "HIGH STAKES: BUBBLES"], ["hsflair", "CARD SUITS", 2500, "HIGH STAKES: FISH FLAIR"],
  ["carve", "CARVE INITIALS", 100, "INTO THE TAVERN WALL"],
  ["map", "TREASURE MAP", 60, "WHERE THIS WEEK'S GOLD BOOT HIDES"],
  ["magnet", "BOTTLE MAGNET", 120, "MORE BOTTLES, 3 DIVES"],
  ["rumour", "RUMOUR", 150, "A BOTTLE YOU HAVEN'T FOUND"],
];
const TAV_COSM = { cap: ["hat", 26], cat: ["pet", 14], tub: ["boat", 19], ace: ["flag", 15], pchips: ["flair", 21], chipline: ["line", 16], spray: ["trail", 12],
  chiphook: ["hook", 14], jpline: ["line", 17], jphook: ["hook", 15], jptrail: ["trail", 13], jpflair: ["flair", 22], hsline: ["line", 18], hshook: ["hook", 16], hstrail: ["trail", 14], hsflair: ["flair", 23] };   // past SHOP_N: never sold for coins
const rumourPrice = () => Math.min(400, 150 + 50 * (tav().rumours || 0));
function shopRowState(i) {                                  // -> [label shown, price or null, note]
  const q = tav(), [id, lab, price, note] = SHOP_ROWS[i], cm = TAV_COSM[id];
  if (CZ_ROWS.includes(id) && typeof casinoShopRow === "function") return casinoShopRow(id);
  if (cm) { const own = store.own[cm[0]].includes(cm[1]), on = store.eq[cm[0]] === cm[1]; return [lab, own ? null : price, own ? (on ? "WEARING IT" : "YOURS") : note]; }
  if ((id === "rumour" || id === "magnet") && !bottleShopOpen()) return ["???", null, "FISH UP " + STARTERS.length + " BOTTLES FIRST: " + startersFound() + "/" + STARTERS.length];
  if (id === "rumour") return [lab, rumourPool().length ? rumourPrice() : null, rumourPool().length ? note : "NOTHING NEW TO TELL"];
  if (id === "magnet") return [lab, price, q.magnet ? "ON FOR " + q.magnet + " MORE DIVES" : note];
  if (id === "map") return [lab, q.map === weekString() ? null : price, q.map === weekString() ? "BOOT AROUND " + bootDepth() + " M" : note];
  if (id === "story") return [q.stories ? "STORIES (" + q.stories + ")" : lab, q.stories < STORIES.length ? price : null, q.stories < STORIES.length ? (q.stories ? "TIP HIM FOR THE NEXT ONE" : note) : "THAT'S ALL HE KNOWS"];
  if (id === "fish") return [q.fish ? "YOUR RACER" : lab, q.fish ? null : price, q.fish ? q.fish.name + ": TRAIN IT" : note];
  if (id === "finprix") return [lab, null, q.fish ? "IN THE PIT: THE GARAGE" : "GET A DERBY FISH FIRST"];
  if (id === "compass") return store.isle.compass ? [lab, null, "THE SHIPWRIGHT HAS IT"] : store.dives >= 50 || store.isle.built ? [lab, price, note] : ["???", null, "AFTER 50 DIVES"];
  if (id === "dream") return store.sec.woke ? [lab, price, note] : ["???", null, "WAKE SOMETHING UP FIRST"];
  if (id === "jukebox") return [lab, q.jukebox ? null : price, q.jukebox ? "PICK A SONG" : note];
  if (id === "carve") return [lab, price, q.carved ? "YOURS SAYS " + q.carved + ". CARVE AGAIN?" : note];
  return [lab, price, note];
}
// The bottle things in the chip shop stay locked until the 11 starting bottles have all been fished up (Nov 17, 2026):
// betting made chips plentiful, and Kade wants the early bottles found at sea, not bought.
const STARTERS = BOTTLES.map((b, i) => i).filter(i => BOTTLES[i][1] === "any");
const startersFound = () => STARTERS.filter(i => store.sec.bottles.includes(i)).length;
const bottleShopOpen = () => startersFound() >= STARTERS.length;
function rumourPool() { return BOTTLES.map((b, i) => i).filter(i => bottleOpen(i) && !store.sec.bottles.includes(i)); }
function bootDepth() { return Math.round(RNG(hashStr("boot" + weekString())).uniform(ZONES[3][1] + 6, ZONES[3][2] - 6)); }
function shopBuy(i) {
  const q = tav(), id = SHOP_ROWS[i][0], [, price] = shopRowState(i), cm = TAV_COSM[id];
  if (CZ_ROWS.includes(id) && typeof casinoOpen === "function") { casinoOpen(id); return; }
  if (id === "story" && q.stories) { if (price && q.chips >= price) { addChips(-price); q.stories++; play("fanfare"); } TAV.story = q.stories - 1; openOverlay("story"); return; }
  if (id === "fish" && q.fish) { TAV.fishBack = null; openOverlay("myfish"); return; }
  if (id === "finprix") { if (q.fish) pitOpen("garage"); else play("miss"); return; }
  if (id === "jukebox" && q.jukebox) { openOverlay("jukebox"); return; }
  if (cm && store.own[cm[0]].includes(cm[1])) { store.eq[cm[0]] = store.eq[cm[0]] === cm[1] ? 0 : cm[1]; saveStore(); play("select"); return; }   // put it on, or take it off
  if (price === null) { play("miss"); return; }
  if (q.chips < price) { play("miss"); TAV.say = "COME BACK WITH CHIPS"; return; }
  if (id !== "dream" && id !== "scratch") chipsSpent(price);                  // toward WHALE
  if (id === "dream") { addChips(-price); S.overlay = null; startBoss(true); return; }          // the Dream Sleeper: a practice fight
  if (id === "scratch") { addChips(-price); scratchNew(); return; }
  addChips(-price); play("fanfare");
  if (cm) { store.own[cm[0]].push(cm[1]); store.eq[cm[0]] = cm[1]; }
  else if (id === "rumour") { q.rumours = (q.rumours || 0) + 1; const pool = rumourPool(), b = pool[Math.floor(Math.random() * pool.length)]; store.sec.bottles.push(b); findSecret("bottle"); S.overlay = "note"; S.noteIdx = store.sec.bottles.length - 1; S.noteBack = "chipshop"; }
  else if (id === "magnet") q.magnet += 3;
  else if (id === "compass") { store.isle.compass = 1; TAV.say = "TAKE IT TO THE PIER"; }
  else if (id === "map") { q.map = weekString(); TAV.say = "TRY AROUND " + bootDepth() + " M"; }
  else if (id === "story") { q.stories++; TAV.story = q.stories - 1; openOverlay("story"); }
  else if (id === "fish") {
    let nm = "";
    try { nm = (window.prompt("NAME YOUR RACER (UP TO 10 LETTERS)", "") || "").toUpperCase().replace(/[^A-Z ]/g, "").trim().slice(0, 10); } catch (e) { /* no prompts here */ }
    q.fish = { name: nm || "SPEEDY", id: FISH_PICKS[Math.floor(Math.random() * FISH_PICKS.length)], lv: [0, 0, 0], races: 0, wins: 0 };
    openOverlay("myfish");
  } else if (id === "jukebox") { q.jukebox = true; openOverlay("jukebox"); }
  else if (id === "drink") { TAV.say = gossip(); S.overlay = "tavern"; }
  else if (id === "show") { TAV.show = T + 25; S.overlay = null; S.popups.push(["LOOK UP!", 2.5, GOLD]); }
  else if (id === "carve") { q.carved = store.name || "???"; TAV.say = "DON'T TELL THE OWNER"; S.overlay = "tavern"; }
  saveStore();
}
// ---- a drink for the old man: he talks. Some of it is even true.
const GOSSIP = ["THE SEA IS DEEPER THAN IT LOOKS.", "NEVER TRUST A FISH THAT SMILES.", "I CAUGHT A BOOT. THEN ITS PAIR.",
  "THE JELLIES REMEMBER FACES.", "THIS CAP WAS MY DAD'S.", "THE CAT CAME WITH THE BAR. ASK IT.",
  "HEAR SINGING DOWN THERE? DON'T HUM.", "THE DERBY IS FIXED. BY ME. KIDDING.", "THE GULPER ATE MY LUNCH IN 1987.",
  "GOOD HOOKS WAIT. ANGLERS DON'T.", "THE FLOOR CREAKS. LIKE IT'S DREAMING.", "THE HOUSE WINS. I'M THE HOUSE."];
function gossip() {
  const live = [];
  const top = LB.today && LB.today[0];
  if (top) live.push(top.n + " LEADS TODAY: " + top.s + ".");
  if (store.best) live.push("YOUR BEST: " + store.best + " LB. CUTE.");
  if (store.dives) live.push(store.dives + " DIVES. STILL DRY?");
  if (store.sec.found.length) live.push(store.sec.found.length + " SECRETS FOUND. NOT ALL.");
  if (store.sec.beat) live.push("YOU WENT THROUGH. I SEE IT IN YOU.");
  const all = GOSSIP.concat(live);
  return all[Math.floor(Math.random() * all.length)];
}
// ---- the scratch card: 9 squares, three alike wins. Prizes are set so it pays back about 95%.
// Bigger prizes since Nov 17, 2026 (top was X20): wins are a bit rarer (20% of cards) but the golden boot pays X500.
const SCRATCH = [["boot", 0, 0], ["minnow", 2, 0.15], ["clown", 5, 0.04], ["blacktip", 20, 0.0075], ["megalodon", 100, 0.002], ["gboot", 500, 0.0002]];   // [species, pays x, chance it's the winner]
function scratchNew() {
  const syms = SCRATCH.filter(s => DATA.atlas[s[0]]), r = Math.random();
  let acc = 0, win = -1;
  syms.forEach((s, i) => { if (win < 0 && r < (acc += s[2])) win = i; });
  const cells = [];
  if (win >= 0) cells.push(win, win, win);
  const count = syms.map((s, i) => cells.filter(c => c === i).length);
  while (cells.length < 9 && syms.length >= 5) { const i = Math.floor(Math.random() * syms.length); if (i !== win && count[i] < 2) { count[i]++; cells.push(i); } }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  TAV.scratch = { syms, cells, open: cells.map(() => false), win, paid: false };
  S.overlay = "scratch"; play("select");
}
function scratchTap(lx, ly) {
  const sc = TAV.scratch;
  if (ly > 186) { S.overlay = "chipshop"; play("back"); return; }
  if (sc.paid) { if (ly >= 156 && ly < 174) { const [, price] = shopRowState(SHOP_ROWS.findIndex(r => r[0] === "scratch")); if (tav().chips >= price) { addChips(-price); scratchNew(); } else play("miss"); } return; }
  const c = Math.floor((lx - 15) / 30), r = Math.floor((ly - 40) / 30);
  if (c >= 0 && c < 3 && r >= 0 && r < 3 && lx >= 15) { sc.open[r * 3 + c] = true; play("tick"); }
  else if (ly >= 136 && ly < 152) { sc.open = sc.open.map(() => true); play("tick"); }
  if (sc.open.every(o => o)) {
    sc.paid = true;
    if (sc.win >= 0) { const pay = 5 * sc.syms[sc.win][1]; addChips(pay, "win"); if (sc.syms[sc.win][1] >= 100) tavAward("jackpot"); sc.msg = "WIN " + pay + " CHIPS!"; play("fanfare"); }
    else { sc.msg = "NO LUCK"; play("miss"); }
    saveStore();
  }
}
function drawScratch() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  const sc = TAV.scratch;
  text("SCRATCH CARD", 60, 8, 1, GOLD, "center", null);
  chipsLine(19);
  rect("#d8c8a0", 12, 37, 96, 96);
  sc.cells.forEach((k, i) => {
    const x = 15 + (i % 3) * 30, y = 40 + Math.floor(i / 3) * 30;
    if (!sc.open[i]) { rect("#9aa0b4", x, y, 28, 28); rect("#b8bed0", x + 2, y + 2, 24, 3); text("?", x + 14, y + 14, 1, "#6a7088", "center", null); return; }
    const s = sc.syms[k], a = DATA.atlas[s[0]], z = Math.min(1, 24 / a[2], 18 / a[3]), w = Math.max(1, Math.floor(a[2] * z)), h = Math.max(1, Math.floor(a[3] * z));
    rect(sc.paid && k === sc.win ? "#fff0b4" : "#efe4c8", x, y, 28, 28);
    g.drawImage(atlas, a[0], a[1], a[2], a[3], x + 14 - (w >> 1), y + 12 - (h >> 1), w, h);
    if (s[1]) text("X" + s[1], x + 14, y + 23, 1, "#5a3a22", "center", null);
  });
  if (!sc.paid) { box(20, 136, 80, 16, CHIP); text("SCRATCH ALL", 60, 144, 1, CHIP, "center", null); text("TAP THE SQUARES", 60, 162, 1, "#d8c8b0", "center", null); }
  else {
    text(sc.msg, 60, 144, 1, sc.win >= 0 ? GOLD : GREY, "center", null);
    const price = SHOP_ROWS.find(r => r[0] === "scratch")[2];
    box(20, 156, 80, 18, tav().chips >= price ? GOLD : "#3c4a40"); text("ANOTHER: " + price, 60, 165, 1, tav().chips >= price ? GOLD : GREY, "center", null);
  }
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
// ---- Plinko (Nov 17, 2026): drop a fish through 8 rows of pegs into one of 9 slots. Each peg is a fair 50/50 bounce,
// so the slots are hit 1-8-28-56-70-56-28-8-1 times in 256. Multipliers are steps of 0.2 so every stake (a multiple of 5)
// pays whole chips, and they pay back about 95% (242.8 / 256). Built for a wide PC screen; phones get a narrow board.
const PLINKO = [25, 4, 1, 0.4, 0.4, 0.4, 1, 4, 25], PL_ROWS = 8, PL_HOP = 0.15, PL_MAX_BALLS = 12;
const PL_FISH = ["minnow", "sardine", "lantern", "seapig", "crab", "isopod"];
function plinkoOpen() { if (!TAV.plinko) TAV.plinko = { bet: 10, max: MAX_STAKE, balls: [], last: [], best: 0, drops: 0, flash: [], queue: 0, qT: 0 }; }
function plLay() {                                             // board geometry for this screen width (screen coordinates)
  const wide = LW >= 320, sx = wide ? 18 : 12, sy = wide ? 15 : 12, top = wide ? 36 : 38;
  return { wide, sx, sy, top, cx: Math.floor(LW / 2), slotY: top + (PL_ROWS - 1) * sy + 7, slotH: wide ? 20 : 15 };
}
const plSlotLabel = m => m < 1 ? "." + Math.round(m * 10) : String(m);
const plSlotCol = m => m >= 25 ? GOLD : m >= 4 ? ORANGE : m >= 1 ? CHIP : "#6a8a7a";
function plinkoDrop() {                                        // -> true if a fish went in
  const p = TAV.plinko;
  if (p.balls.length >= PL_MAX_BALLS) return false;
  if (tav().chips < p.bet) { play("miss"); p.say = "NOT ENOUGH CHIPS"; p.sayT = 1.5; p.queue = 0; return false; }
  addChips(-p.bet);
  const path = [];
  for (let r = 0; r < PL_ROWS; r++) path.push(Math.random() < 0.5 ? -1 : 1);
  p.balls.push({ path, r: -1, t: 0, x: 0, y: 0, dir: path[0], stake: p.bet, fish: PL_FISH[Math.floor(Math.random() * PL_FISH.length)] });
  p.drops++; play("tick");
  return true;
}
function plinkoTick(dt) {
  const p = TAV.plinko;
  if (!p) return;
  if (p.sayT > 0) p.sayT -= dt;
  p.flash = p.flash.filter(f => (f[1] -= dt) > 0);
  if (S.overlay !== "plinko") p.queue = 0;                   // leaving stops a DROP 5; fish already falling still land
  if (p.queue > 0 && (p.qT -= dt) <= 0) { if (plinkoDrop()) { p.queue--; p.qT = 0.22; } else p.queue = 0; }   // DROP 5 lets them go one after another
  for (const b of p.balls) {
    b.t += dt / PL_HOP;
    while (b.t >= 1 && !b.done) {
      b.t -= 1; b.r++;
      if (b.r < PL_ROWS) { b.dir = b.path[b.r]; play("tick"); }
      else {                                                   // into a slot
        b.done = true;
        const k = b.path.filter(d => d > 0).length, m = PLINKO[k], pay = Math.round(b.stake * m);
        if (pay) addChips(pay, pay > b.stake ? "win" : undefined);
        p.last.unshift([k, pay - b.stake]); p.last = p.last.slice(0, 8);
        if (pay > p.best) p.best = pay;
        p.flash.push([k, 0.8]);
        if (m >= 25) { tavAward("pegleg"); play("fanfare"); p.say = "JACKPOT! " + fmtChips(pay, 1e6) + " CHIPS"; p.sayT = 2.5; }
        else if (m >= 4) play("select");
        saveStore();
      }
    }
  }
  p.balls = p.balls.filter(b => !b.done);
}
function plBallPos(b, L) {                                     // where a falling fish is: hopping peg to peg
  const col = r => b.path.slice(0, r + 1).reduce((a, d) => a + d, 0);   // half-steps right of centre after row r's bounce
  const at = r => r < 0 ? [L.cx, L.top - 18] : r >= PL_ROWS ? [L.cx + col(PL_ROWS - 1) * L.sx / 2, L.slotY + L.slotH - 7]
    : [L.cx + (r === 0 ? 0 : col(r - 1)) * L.sx / 2, L.top + r * L.sy - 4];
  const [x0, y0] = at(b.r), [x1, y1] = at(b.r + 1), e = Math.min(1, b.t);
  return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e - Math.sin(e * Math.PI) * (b.r < 0 ? 0 : 5)];
}
// The buttons, in screen coordinates: [id, x, y, w, h, label]
function plButtons() {
  const L = plLay(), p = TAV.plinko;
  if (L.wide) {
    const rx = L.cx + 4.5 * L.sx + 10, w = Math.min(96, LW - rx - 6);
    return [["minus", rx, 78, 18, 15, "-"], ["plus", rx + w - 18, 78, 18, 15, "+"], ["stakebox", rx + 20, 78, w - 40, 15, ""], ["max", rx, 96, w, 13, "MAX BET"], ["drop", rx, 113, w, 20, "DROP"], ["drop5", rx, 137, w, 14, "DROP 5"]];
  }
  return [["minus", OX + 2, 168, 14, 15, "-"], ["plus", OX + 36, 168, 14, 15, "+"], ["stakebox", OX + 17, 168, 18, 15, ""], ["max", OX + 52, 168, 22, 15, "MAX"], ["drop", OX + 76, 168, 42, 15, "DROP"]];
}
function plinkoTap(rx, ly) {
  const p = TAV.plinko;
  if (ly > 186) { closeOverlay(); return; }
  const hit = plButtons().find(([, x, y, w, h]) => rx >= x && rx < x + w && ly >= y && ly < y + h);
  if (!hit) return;
  if (hit[0] === "stakebox") { p.bet = stakeStep(p.bet, STAKE_TYPE, p.max); return; }
  if (hit[0] === "minus" || hit[0] === "plus" || hit[0] === "max") { p.bet = stakeStep(p.bet, hit[0] === "max" ? STAKE_MAX : hit[0] === "plus" ? 1 : -1, p.max); play("tick"); }
  else if (hit[0] === "drop") plinkoDrop();
  else if (hit[0] === "drop5") { p.queue = 5; p.qT = 0; }
}
function plinkoKey(c, dir) {                                   // Space/Enter drops, left/right (or A/D) changes the stake, up drops 5
  const p = TAV.plinko;
  if (c === "Space" || c === "Enter" || c === "ArrowDown" || c === "KeyS") plinkoDrop();
  else if (c === "ArrowUp" || c === "KeyW") { p.queue = 5; p.qT = 0; }
  else if (dir) { p.bet = stakeStep(p.bet, dir, p.max); play("tick"); }
}
function drawPlinko() {
  const p = TAV.plinko, L = plLay();
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  for (let x = 0; x < LW; x += 8) rect("#0b3f27", x, 3, 1, LH - 6);                          // felt grain
  text("PLINKO", L.cx, 10, L.wide ? 2 : 1, GOLD, "center");
  if (!L.wide) { g.save(); g.translate(OX, 0); chipsLine(23); g.restore(); }
  const bw = 9 * L.sx;
  rect("#0a3420", L.cx - bw / 2 - 4, L.top - 8, bw + 8, L.slotY + L.slotH - L.top + 11);     // the board
  rect("#5a3a22", L.cx - bw / 2 - 6, L.top - 8, 2, L.slotY + L.slotH - L.top + 11); rect("#5a3a22", L.cx + bw / 2 + 4, L.top - 8, 2, L.slotY + L.slotH - L.top + 11);
  if (L.wide) rect("#c8e6d2", L.cx - 1, L.top - 22, 3, 2);                                                 // the chute
  for (let r = 0; r < PL_ROWS; r++) for (let i = 0; i < r + 3; i++) {
    const x = Math.round(L.cx + (i - (r + 2) / 2) * L.sx), y = L.top + r * L.sy;
    rect("#7aa08a", x - 1, y, 3, 2); rect("#e6fff0", x - 1, y - 1, 2, 1);
  }
  PLINKO.forEach((m, k) => {
    const x = Math.round(L.cx + (k - 4.5) * L.sx), col = plSlotCol(m), lit = p.flash.some(f => f[0] === k);
    rect(lit ? col : "#1a1628", x + 1, L.slotY, L.sx - 2, L.slotH);
    g.fillStyle = col; g.fillRect(x + 1, L.slotY + L.slotH - 1, L.sx - 2, 1);
    if (L.wide) { g.fillRect(x + 1, L.slotY, 1, L.slotH); g.fillRect(x + L.sx - 2, L.slotY, 1, L.slotH); }   // narrow slots have no room for side walls
    text(plSlotLabel(m), x + L.sx / 2, L.slotY + (L.wide ? 6 : 5), 1, lit ? INK : col, "center", null);
  });
  for (const b of p.balls) {
    const [x, y] = plBallPos(b, L), [w, h] = sprSize(b.fish, L.wide ? 1 : 0.75);
    spr(b.fish, x - w / 2, y - h / 2, b.dir < 0, L.wide ? 1 : 0.75);
  }
  if (L.wide) {                                                 // side panels: results on the left, controls on the right
    const lx = 6, lw = Math.max(60, L.cx - bw / 2 - 18);
    text("LAST DROPS", lx + lw / 2, 30, 1, CHIP, "center", null);
    p.last.forEach(([k, net], i) => {
      const y = 42 + i * 11, m = PLINKO[k];
      text("X" + plSlotLabel(m), lx + 2, y, 1, plSlotCol(m), "left", null);
      text((net > 0 ? "+" : "") + net, lx + lw - 2, y, 1, net > 0 ? GOLD : net < 0 ? GREY : WHITE, "right", null);
    });
    if (!p.last.length) text("DROP A FISH", lx + lw / 2, 46, 1, GREY, "center", null);
    text("BEST WIN " + fmtChips(p.best, 1e6), lx + lw / 2, 140, 1, WHITE, "center", null);
    text("DROPS " + p.drops, lx + lw / 2, 152, 1, GREY, "center", null);
    const rx = L.cx + 4.5 * L.sx + 10, w = Math.min(96, LW - rx - 6), mid = rx + w / 2;
    const s = fmtChips(tav().chips, 1e7) + " CHIPS"; chipIcon(mid - (textW(s, 1) >> 1) - 4, 34); text(s, mid + 3, 34, 1, CHIP, "center", null);
    text("STAKE", mid, 66, 1, "#c8e6d2", "center", null);
    text(fmtChips(p.bet, 1e6), mid, 85, 1, WHITE, "center", null);
    plButtons().forEach(([id, x, y, bw2, h, lab]) => {
      if (id === "stakebox") return;
      const ok = id.startsWith("drop") ? tav().chips >= p.bet : true, col = id === "drop" ? GOLD : id === "drop5" ? ORANGE : CHIP;
      box(x, y, bw2, h, ok ? col : "#3c6a54"); text(lab, x + bw2 / 2, y + (h >> 1), 1, ok ? col : "#5a8a74", "center", null);
    });
    text("SPACE: DROP", mid, 158, 1, GREY, "center", null);
    text("UP: DROP 5", mid, 168, 1, GREY, "center", null);
    text("< > STAKE", mid, 178, 1, GREY, "center", null);
  } else {
    plButtons().forEach(([id, x, y, bw2, h, lab]) => { if (id === "stakebox") return; const col = id === "drop" ? GOLD : CHIP; box(x, y, bw2, h, col); text(lab, x + bw2 / 2, y + 7, 1, col, "center", null); });
    text(fmtChips3(p.bet), OX + 26, 175, 1, WHITE, "center", null);
    const l = p.last[0];
    if (l && !(p.sayT > 0)) text("X" + plSlotLabel(PLINKO[l[0]]) + "  " + (l[1] > 0 ? "+" : "") + l[1], L.cx, 158, 1, l[1] > 0 ? GOLD : GREY, "center", null);
  }
  if (p.sayT > 0) text(p.say, L.cx, L.wide ? L.slotY + L.slotH + 9 : 158, 1, GOLD, "center", null);
  text("TAP HERE TO GO BACK", L.cx, 194, 1, WHITE, "center", null);
}
const trainCost = lv => 30 + lv * 15;

// ---- titles and the shared tavern board
function chipsSpent(n) { const q = tav(); q.spent = (q.spent || 0) + n; if (q.spent >= 100000) tavAward("whale"); }   // chips spent on things (not bets)
function tavAward(id) { if (award(id) && S) { S.popups.push(["NEW TITLE: " + titleName(id), 5, GOLD]); saveStore(); } }
function tavTitles() {
  const st = tav().stats;
  if (st.stack >= 1000) tavAward("roller");
  if (st.hands >= 25) tavAward("shark");
  if (st.derbies >= 10) tavAward("derbyking");
  if (tav().claims >= 14) tavAward("regular");
}
// FASTEST LAP (Nov 18, 2026; was FASTEST FISH, a derby time): your best FIN PRIX time-trial lap on Kelp Circuit, in centiseconds
// in stats.fast, posted as 100000 - cs so a faster lap ranks higher. Old derby entries (at most 10000) are left out when read.
const BOARDS = [["stack", "BIGGEST STACK"], ["win", "BIGGEST WIN"], ["fast", "FASTEST LAP"]], FAST_BASE = 100000, fastS = s => ((FAST_BASE - s) / 100).toFixed(2) + "S";
// Nov 20, 2026: no more 1,000,000 cap (the rules allow up to CHIP_TOP). A best only counts as posted once the board accepts
// it, so a post the old rules refused is tried again later. Bests past a million were posted as 1,000,000 before: `bigPost`
// lets those go up once more with the real number.
function tavPost() {                                         // post a new personal best to the shared board, now and then
  if (!LB.url || !store.name) return;
  const q = tav(), now = Date.now();
  if (!q.bigPost) { ["stack", "win"].forEach(k => { if ((q.posted[k] || 0) > 1e6) q.posted[k] = 1e6; }); q.bigPost = 1; saveStore(); }
  if (now - (q.postedAt || 0) < 20000) return;
  for (const [k] of BOARDS) {
    const v = k === "fast" ? (q.stats.fast ? Math.max(1, FAST_BASE - q.stats.fast) : 0) : Math.min(q.stats[k], CHIP_TOP);
    if (v <= (q.posted[k] || 0) || (k !== "fast" && v < 100)) continue;
    q.postedAt = now; saveStore();
    fetch(LB.url + "/tavern/" + k + ".json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: store.name, s: v, t: now }) })
      .then(r => { if (r.ok && v > (q.posted[k] || 0)) { q.posted[k] = v; saveStore(); } }).catch(() => {});
  }
}
async function tavLoad(k) {
  TAV.boards[k] = { rows: null, msg: "LOADING..." };
  if (!LB.url) { TAV.boards[k].msg = "NO SHARED BOARD"; return; }
  try {
    const r = await fetch(LB.url + "/tavern/" + k + '.json?orderBy="s"&limitToLast=10');
    if (!r.ok) { TAV.boards[k].msg = "UPDATE THE DATABASE RULES"; return; }
    const d = await r.json() || {};
    TAV.boards[k] = { rows: Object.values(d).filter(e => e && e.n && e.s > (k === "fast" ? FAST_BASE / 2 : 0) && (k !== "fast" || e.s < FAST_BASE)).sort((a, b) => b.s - a.s).slice(0, 10), msg: "" };
  } catch (e) { TAV.boards[k].msg = "CAN'T REACH THE BOARD"; }
}

// ---- music for the tavern and the title screen
let MUS = { song: -1, step: 0, next: 0 };
function noteHz(n) { const m = /^([A-G])(\d)$/.exec(n); return m ? 440 * Math.pow(2, ({ C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] - 4) * 12) / 12) : 0; }
function tone(f, t0, dur, wave, vol) { const o = AC.createOscillator(), ga = AC.createGain(); o.type = wave; o.frequency.setValueAtTime(f, t0); ga.gain.setValueAtTime(vol, t0); ga.gain.exponentialRampToValueAtTime(0.001, t0 + dur); o.connect(ga); ga.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
function musicTick() {
  const want = AC && S.overlay === "credits" ? 10 : AC && tav().jukebox && tav().song >= 0 && songOwned(tav().song) && (S.overlay ? ["tavern", "c21", "derby", "derbytable", "chipshop", "story", "jukebox", "myfish", "tavboard", "vip", "rename", "scratch", "plinko", "pit"].includes(S.overlay) || !!(EXTRA_OV[S.overlay] && EXTRA_OV[S.overlay].music) : S.state === "title") ? tav().song : -1;
  if (want !== MUS.song) { MUS = { song: want, step: 0, next: AC ? AC.currentTime + 0.1 : 0 }; }
  if (want < 0 || AC.state !== "running") return;
  const [, , , bpm, lead, bass] = SONGS[want], L = lead.split(" "), B = bass.split(" "), dt = 30 / bpm;
  while (MUS.next < AC.currentTime + 0.25) {
    const i = MUS.step % L.length;
    if (noteHz(L[i])) tone(noteHz(L[i]), MUS.next, dt * 0.9, "square", 0.035);
    if (noteHz(B[i % B.length])) tone(noteHz(B[i % B.length]), MUS.next, dt * 0.95, "triangle", 0.08);
    MUS.step++; MUS.next += dt;
  }
}
function tavTick(dt) { c21Tick(dt); derbyTick(dt); plinkoTick(dt); creditsTick(dt); musicTick(); if (typeof casinoTick === "function") casinoTick(dt); }

// ---- drawing
function drawShack(wl, open) {                             // the tavern on the shore, left of the boat
  const x = OX - 6, t = T;
  poly("#4a3a2a", [[x - 16, wl + 1], [x - 8, wl - 5], [x + 27, wl - 5], [x + 31, wl + 1]]);          // a bit of shore
  for (let k = 0; k < 5; k++) rect("#5a4632", x + 1 + k * 6, wl - 6, 1, 2);
  rect(WOOD, x, wl - 24, 26, 18);
  for (let k = 0; k < 6; k++) rect("#6a4428", x, wl - 24 + k * 3 + 2, 26, 1);                       // planks
  poly("#a03c32", [[x - 3, wl - 23], [x + 13, wl - 35], [x + 29, wl - 23]]);
  rect("#7a2a24", x - 3, wl - 24, 32, 2);
  rect("#5a4a40", x + 19, wl - 37, 4, 8);                                                           // chimney
  if (open) for (let k = 0; k < 3; k++) { const u = (t * 0.5 + k / 3) % 1; g.globalAlpha = 0.6 * (1 - u); rect("#c8c8d2", x + 20 + Math.round(Math.sin(u * 6 + k) * 2 + u * 4), wl - 39 - Math.round(u * 14), 2 + Math.round(u * 2), 2); g.globalAlpha = 1; }
  rect(open ? "#ffd27a" : "#2a2438", x + 15, wl - 20, 7, 6); rect("#3c2818", x + 18, wl - 20, 1, 6); rect("#3c2818", x + 15, wl - 17, 7, 1);   // window
  rect("#2a1a10", x + 4, wl - 16, 7, 10);                                                           // door
  if (!open) { line("#8a6a48", x + 4, wl - 16, x + 10, wl - 7); line("#8a6a48", x + 10, wl - 16, x + 4, wl - 7); }   // boarded up
  rect(GOLD, x + 11, wl - 29, 3, 1); rect(GOLD, x + 12, wl - 28, 1, 3); rect(GOLD, x + 10, wl - 26, 2, 1);       // a little hook on the gable
  if (open) spr("oldman", x + 1, wl - 23 + (Math.floor(t * 1.2) % 2));                             // the old fisherman in his doorway
}
function fishCard(x, y, card, down) {                       // a Catch 21 card: [fish id, weight, "t" trophy / "l" legend]
  if (down) { rect("#1e285a", x, y, 22, 28); rect("#3c4a8a", x + 2, y + 2, 18, 24); for (let k = 0; k < 4; k++) rect("#1e285a", x + 4 + k * 4, y + 4, 2, 20); rect(INK, x, y, 22, 1); return; }
  const [fid, lb, kind] = card, edge = kind ? GOLD : INK;
  rect(kind === "l" ? "#fff2c0" : "#f6f2e6", x, y, 22, 28);
  g.fillStyle = edge; g.fillRect(x, y, 22, 1); g.fillRect(x, y + 27, 22, 1); g.fillRect(x, y, 1, 28); g.fillRect(x + 21, y, 1, 28);
  text(kind === "l" ? "!" : lb, x + 3, y + 5, 1, kind ? "#b0781a" : INK, "left", null);
  const a = DATA.atlas[fid], k = Math.min(1, 18 / a[2], 12 / a[3]), w = Math.max(1, Math.floor(a[2] * k)), h = Math.max(1, Math.floor(a[3] * k));
  g.drawImage(atlas, a[0], a[1], a[2], a[3], x + 11 - (w >> 1), y + 17 - (h >> 1), w, h);
  if (kind === "t") text("X2", x + 20, y + 24, 1, TROPHY, "right", null);
}
function tavernBg() {
  for (let x = 0; x < LW; x += 8) rect(x % 16 ? "#2a1a12" : "#321f15", x, 0, 8, LH);
  for (let x = 4; x < LW; x += 8) rect("#1e120c", x, 0, 1, LH);
}
function stakeRow(y, stake, go) {                            // [-] stake [+] and a go button; taps handled by stakeTap
  box(2, y, 14, 15, CHIP); text("-", 9, y + 7, 1, CHIP, "center", null);
  text(fmtChips3(stake), 26, y + 7, 1, WHITE, "center", null);   // 3 characters fit
  box(36, y, 14, 15, CHIP); text("+", 43, y + 7, 1, CHIP, "center", null);
  box(52, y, 22, 15, CHIP); text("MAX", 63, y + 7, 1, CHIP, "center", null);
  box(76, y, 42, 15, GOLD); text(go, 97, y + 7, 1, GOLD, "center", null);
}
function stakeTap(lx, obj, key, go) {
  const d = lx < 17 ? -1 : lx < 35 ? STAKE_TYPE : lx < 51 ? 1 : lx < 75 ? STAKE_MAX : 0;
  if (d) { obj[key] = stakeStep(obj[key], d, obj.max); play("tick"); } else if (lx >= 75) go();
}
function chipsLine(y) { const s = fmtChips(tav().chips, 1e7) + " CHIPS", x = 60 - (textW(s, 1) >> 1) + 3; chipIcon(x - 6, y); text(s, x, y, 1, CHIP, "left", null); }
function bestCatches() { return LOGGED.filter(s => store.log[s[0]]).sort((a, b) => store.log[b[0]].rec - store.log[a[0]].rec).slice(0, 2); }
const HUB_OF = { c21: "tables", plinko: "machines" };      // with casino.js, Catch 21 and Plinko sit in the TABLES / MACHINES menus
const hubBack = o => HUB_OF[o] && EXTRA_OV[HUB_OF[o]] ? HUB_OF[o] : "tavern";
function tavRows() {                                         // -> [label, colour, id]
  const dr = dailyReady(), hubs = !!EXTRA_OV.tables;          // casino.js groups the games into TABLES and MACHINES (Nov 18, 2026)
  const r = (hubs ? [["TABLES", CHIP, "tables"], ["MACHINES", CHIP, "machines"], ["THE DERBY", CHIP, "derby"]] : [["CATCH 21", CHIP, "c21"], ["THE DERBY", CHIP, "derby"], ["PLINKO", CHIP, "plinko"]])
    .concat([["FIN PRIX PIT", ORANGE, "pit"], ["BUY THINGS", GOLD, "shop"], [dr ? "TAKE 50 FREE" : "MORE TOMORROW", dr ? LIME : GREY, "daily"]]);
  if (store.sec.sleeper) r.push(["THE BACK ROOM", "#ff6e6e", "vip"]);              // opens once you've beaten the Sleeper
  return r;
}
const tavRowLay = n => n > 6 ? [92, 14, 12] : n > 5 ? [94, 16, 14] : [94, 18, 15];   // [first y, step, box height]
function drawTavern() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  rect("#4a2e1c", 32, 28, 56, 3);                                                                  // a shelf of bottles
  ["#5ad2a0", "#c84a3c", "#ffd246", "#5a8cff"].forEach((c, i) => { rect(c, 37 + i * 13, 18 + (i % 2) * 2, 4, 10 - (i % 2) * 2); rect(c, 38 + i * 13, 15 + (i % 2) * 2, 2, 3); });
  bestCatches().forEach((s, i) => {                          // the trophy wall: your two heaviest catches, mounted
    const x = i ? 92 : 4, a = DATA.atlas[s[0]], k = Math.min(1, 20 / a[2], 12 / a[3]), w = Math.floor(a[2] * k), h = Math.floor(a[3] * k);
    rect("#5a3a22", x, 32, 24, 20); rect("#7a5232", x + 1, 33, 22, 18);
    g.drawImage(atlas, a[0], a[1], a[2], a[3], x + 12 - (w >> 1), 40 - (h >> 1), w, h);
    text(store.log[s[0]].rec, x + 12, 48, 1, GOLD, "center", null);
  });
  spr("oldman", 46, 30, false, 2);
  const bar = typeof decorBar === "function" ? decorBar(false) : null;                            // casino.js: a fancier counter
  rect(bar ? bar[0] : "#6a4428", 0, 60, 120, 9); rect(bar ? bar[1] : "#8a5c38", 0, 60, 120, 2);   // the bar
  if (typeof decorDraw === "function") decorDraw(false, 0);                                       // casino.js: your decor
  text("RUSTY HOOK", 60, 8, 1, GOLD, "center");
  box(96, 2, 22, 11, CYAN); text("TOP", 107, 7, 1, CYAN, "center", null);
  const sayL = wrap(TAV.say, 19).slice(0, 2); sayL.forEach((l, i) => text(l, 60, (sayL.length > 1 ? 72 : 76) + i * 8, 1, WHITE, "center", null));
  if (tav().carved) text(tav().carved + " WAS HERE", 60, 65, 1, "#3c2414", "center", null);   // carved into the bar
  chipsLine(89);
  const rows = tavRows(), [y0, st, bh] = tavRowLay(rows.length);
  rows.forEach(([lab, col], i) => { const y = y0 + i * st; box(14, y, 92, bh, col); text(lab, 60, y + (bh >> 1), 1, col, "center", null); });
  text("TAP HERE TO LEAVE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawC21() {
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  g.save(); g.translate(OX, 0);
  const c = TAV.c21;
  text(c.vip ? "VIP CATCH 21" : "CATCH 21", 60, 9, 1, GOLD, "center", null);
  text("THE OLD MAN", 4, 20, 1, "#c8e6d2", "left", null);
  if (c.dealer.length) text(c.hide ? "?" : c21Sum(c.dealer), 116, 20, 1, WHITE, "right", null);
  c.dealer.slice(0, 6).forEach((q, i) => fishCard(4 + i * Math.min(20, 94 / Math.max(1, c.dealer.length - 1)), 25, q, c.hide && i === 1));
  box(4, 58, 112, 13, c.win > 0 ? GOLD : CHIP); text(c.msg, 60, 64, 1, c.win > 0 ? GOLD : WHITE, "center", null);
  text("YOU", 4, 78, 1, "#c8e6d2", "left", null);
  if (c.you.length) text(c21Sum(c.you), 116, 78, 1, GOLD, "right", null);
  c.you.slice(0, 6).forEach((q, i) => fishCard(4 + i * Math.min(20, 94 / Math.max(1, c.you.length - 1)), 83, q));
  chipsLine(119);
  if (c.phase === "play") [["HIT", 2, 36], ["STAND", 41, 38], ["DOUBLE", 82, 36]].forEach(([lab, x, w], i) => {
    const ok = i < 2 || (c.you.length === 2 && tav().chips >= c.staked);
    box(x, 128, w, 15, ok ? WHITE : "#3c6a54"); text(lab, x + w / 2, 135, 1, ok ? WHITE : "#5a8a74", "center", null);
  });
  else if (c.phase === "stake") stakeRow(128, c.bet, "DEAL");
  else text("...", 60, 135, 1, WHITE, "center", null);
  text("TROPHIES COUNT X2", 60, 154, 1, "#8cc8a8", "center", null);
  text(c.vip ? "LEGENDS PAY 2 TO 1" : "LEGENDS WIN AT ONCE", 60, 164, 1, c.vip ? GOLD : "#8cc8a8", "center", null);
  text("HE STOPS AT 17", 60, 174, 1, "#8cc8a8", "center", null);
  text(c.vip ? "TIES PUSH" : "TIES GO TO YOU", 60, 184, 1, "#8cc8a8", "center", null);
  text("TAP HERE TO LEAVE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawChipShop() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  text("BUY THINGS", 60, 8, 1, GOLD, "center", null);
  chipsLine(19);
  const pages = Math.ceil(SHOP_ROWS.length / SHOP_PER), page = Math.floor(TAV.shopSel / SHOP_PER);
  box(2, 2, 16, 13, GOLD); text("<", 10, 8, 1, GOLD, "center", null); box(102, 2, 16, 13, GOLD); text(">", 110, 8, 1, GOLD, "center", null);
  text("PAGE " + (page + 1) + "/" + pages, 60, 180, 1, "#a08c70", "center", null);
  SHOP_ROWS.slice(page * SHOP_PER, page * SHOP_PER + SHOP_PER).forEach((r, k) => {
    const i = page * SHOP_PER + k, [lab, price] = shopRowState(i), y = 27 + k * 15, sel = i === TAV.shopSel;
    box(4, y, 112, 13, sel ? GOLD : "#5a3a22"); text(lab, 8, y + 6, 1, sel ? WHITE : "#d8c8b0", "left", null);
    if (price !== null) text(price, 112, y + 6, 1, CHIP, "right", null);
  });
  const [, price, note] = shopRowState(TAV.shopSel);
  box(4, 134, 112, 34, GOLD);
  wrap(note, 18).slice(0, 2).forEach((l, i) => text(l, 60, 141 + i * 9, 1, "#e8dcc4", "center", null));
  const sid = SHOP_ROWS[TAV.shopSel][0], cm = TAV_COSM[sid], opens = (sid === "fish" && tav().fish) || (sid === "jukebox" && tav().jukebox) || ["locker", "dealer", "decor"].includes(sid);
  const lab = opens ? "TAP AGAIN TO OPEN" : cm && price === null ? (store.eq[cm[0]] === cm[1] ? "TAP AGAIN: TAKE OFF" : "TAP AGAIN: PUT ON") : price === null ? (sid === "story" && tav().stories ? "TAP AGAIN TO READ" : "") : (tav().chips >= price ? (price >= 1000 ? "TAP TO BUY " : "TAP AGAIN: BUY ") : "NEEDS ") + price;   // 4-digit prices need the shorter line
  if (lab) text(sid === "dream" && price !== null && tav().chips >= price ? "DREAM FOR " + price : lab, 60, 160, 1, price !== null && tav().chips < price ? GREY : CHIP, "center", null);
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawStory() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  const n = tav().stories;
  if (n > 1) { box(2, 2, 16, 13, GOLD); text("<", 10, 8, 1, GOLD, "center", null); box(102, 2, 16, 13, GOLD); text(">", 110, 8, 1, GOLD, "center", null); }
  text("STORY " + (TAV.story + 1), 60, 8, 1, GOLD, "center", null);
  spr("oldman", 46, 18, false, 2);
  rect("#1a100a", 6, 56, 108, 110);
  const ls = wrap(STORIES[TAV.story] || "", 17);
  ls.forEach((l, i) => text(l, 60, 111 - ls.length * 5 + i * 10, 1, "#e8dcc4", "center", null));
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
const SONG_PER = 11;
function drawJukebox() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  text("JUKEBOX", 60, 8, 1, "#ff8cd2", "center", null);
  chipsLine(19);
  const pages = Math.ceil(SONGS.length / SONG_PER), page = Math.floor(TAV.songSel / SONG_PER);
  box(2, 2, 16, 13, "#ff8cd2"); text("<", 10, 8, 1, "#ff8cd2", "center", null); box(102, 2, 16, 13, "#ff8cd2"); text(">", 110, 8, 1, "#ff8cd2", "center", null);
  SONGS.slice(page * SONG_PER, page * SONG_PER + SONG_PER).forEach((sg, k) => {
    const i = page * SONG_PER + k, y = 26 + k * 12, own = songOwned(i), on = tav().song === i, sel = i === TAV.songSel;
    rect(sel ? "#3a2440" : "#24160e", 4, y, 112, 11);
    text(own || sg[1] ? sg[0] : "???", 7, y + 5, 1, on ? "#ff8cd2" : own ? WHITE : GREY, "left", null);
    text(on ? "ON" : own ? "" : sg[1] ? sg[1] : "", 113, y + 5, 1, on ? "#ff8cd2" : CHIP, "right", null);
  });
  const sg = SONGS[TAV.songSel], own = songOwned(TAV.songSel);
  text(own ? (tav().song === TAV.songSel ? "TAP AGAIN: MUSIC OFF" : "TAP AGAIN TO PLAY") : sg[1] ? "TAP AGAIN TO BUY" : "EARNED: " + sg[2], 60, 168, 1, own ? CHIP : sg[1] ? GOLD : GREY, "center", null);
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawMyFish() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  const f = tav().fish;
  text("YOUR RACER", 60, 8, 1, CHIP, "center", null);
  chipsLine(19);
  rect("#1e4a7a", 20, 28, 80, 30); spr(f.id, 60 - (sprSize(f.id)[0] >> 1), 43 - (sprSize(f.id)[1] >> 1) + Math.round(Math.sin(T * 3)));
  text(f.name, 60, 66, 1, GOLD, "center", null);
  text(f.races + " RACES, " + f.wins + " WINS", 60, 76, 1, "#d8c8b0", "center", null);
  ["SPEED", "STAMINA", "BURST"].forEach((lab, i) => {
    const y = 88 + i * 24, lv = f.lv[i];
    text(lab, 6, y, 1, WHITE, "left", null);
    for (let k = 0; k < 10; k++) rect(k < lv ? CHIP : "#3c2a1e", 6 + k * 7, y + 6, 6, 4);
    if (lv < 10) { box(78, y - 4, 38, 15, ORANGE); text("GYM", 97, y + 3, 1, ORANGE, "center", null); }   // training is free now, in the Pit's gym
    else text("MAX", 97, y + 3, 1, CHIP, "center", null);
  });
  text(tav().stats.fast ? "KELP LAP " + (tav().stats.fast / 100).toFixed(2) + "S" : "RACES IN THE PIT", 60, 166, 1, GREY, "center", null);
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawTavBoard() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  const [k, name] = BOARDS[TAV.board], b = TAV.boards[k] || { rows: null, msg: "" };
  box(2, 2, 16, 13, CYAN); text("<", 10, 8, 1, CYAN, "center", null); box(102, 2, 16, 13, CYAN); text(">", 110, 8, 1, CYAN, "center", null);
  text(name, 60, 8, 1, GOLD, "center", null);
  if (b.msg) text(b.msg, 60, 40, 1, ORANGE, "center", null);
  (b.rows || []).forEach((r, i) => {
    const y = 28 + i * 12, col = i === 0 ? GOLD : r.n === store.name ? CYAN : "#d8c8b0";
    text(i + 1, 16, y, 1, i < 3 ? GOLD : GREY, "right", null); text(r.n, 24, y, 1, col, "left", null);
    text(k === "fast" ? fastS(r.s) : fmtChips(r.s, 1e6), 112, y, 1, col, "right", null);
  });
  if (b.rows && !b.rows.length) text("NOBODY YET", 60, 50, 1, GREY, "center", null);
  const st = tav().stats, mine = k === "fast" ? (st.fast ? (st.fast / 100).toFixed(2) + "S" : "-") : fmtChips(st[k], 1e7);
  text("YOURS: " + mine, 60, 158, 1, CHIP, "center", null);
  if (!store.name) text("SET INITIALS TO JOIN", 60, 170, 1, GREY, "center", null);
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
const nameOf = fid => (tav().names && tav().names[fid]) || SPEC[fid][1];   // your own name for a species, if you bought one
const RENAME = 100, REN_PER = 10;
function velvetBg() { for (let x = 0; x < LW; x += 6) rect(x % 12 ? "#3a0e18" : "#481420", x, 0, 6, LH); rect("#c8a03c", 0, 0, LW, 2); rect("#c8a03c", 0, LH - 2, LW, 2); }
function drawVip() {
  velvetBg();
  g.save(); g.translate(OX, 0);
  text("THE BACK ROOM", 60, 8, 1, GOLD, "center");
  spr("oldman", 46, 16, false, 2);
  rect("#2a0a10", 0, 48, 120, 4);
  text(TAV.vipSay || "", 60, 60, 1, WHITE, "center", null);
  chipsLine(72);
  [["VIP CATCH 21", GOLD, "BETTER ODDS"], ["VIP DERBY", GOLD, "7 RACERS, LONGER"], ["RENAME A FISH", "#ff8cd2", RENAME + " CHIPS"]].forEach(([lab, col, sub], i) => {
    const y = 82 + i * 28; box(10, y, 100, 25, col); text(lab, 60, y + 7, 1, col, "center", null); text(sub, 60, y + 17, 1, "#d8b4b4", "center", null);
  });
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function renameList() { return LOGGED.filter(s => store.log[s[0]]); }
function drawRename() {
  velvetBg();
  g.save(); g.translate(OX, 0);
  const list = renameList(), pages = Math.max(1, Math.ceil(list.length / REN_PER)), sel = TAV.renSel || 0, page = Math.floor(sel / REN_PER);
  if (pages > 1) { box(2, 2, 16, 13, GOLD); text("<", 10, 8, 1, GOLD, "center", null); box(102, 2, 16, 13, GOLD); text(">", 110, 8, 1, GOLD, "center", null); }
  text("RENAME A FISH", 60, 8, 1, "#ff8cd2", "center", null);
  chipsLine(19);
  list.slice(page * REN_PER, page * REN_PER + REN_PER).forEach((sp, k) => {
    const i = page * REN_PER + k, y = 27 + k * 13, own = tav().names && tav().names[sp[0]];
    rect(i === sel ? "#6a1e2c" : "#2a0a10", 4, y, 112, 12);
    text(nameOf(sp[0]).slice(0, 18), 7, y + 6, 1, own ? "#ff8cd2" : WHITE, "left", null);
  });
  if (!list.length) text("CATCH SOMETHING FIRST", 60, 60, 1, GREY, "center", null);
  else { const sp = list[sel]; text(tav().names && tav().names[sp[0]] ? "REALLY: " + sp[1] : "", 60, 164, 1, GREY, "center", null); text(tav().chips >= RENAME ? "TAP AGAIN: " + RENAME : "NEEDS " + RENAME + " CHIPS", 60, 175, 1, tav().chips >= RENAME ? CHIP : GREY, "center", null); }
  text("TAP HERE TO GO BACK", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function renameFish(fid) {
  let nm = null;
  try { nm = window.prompt("NEW NAME FOR " + SPEC[fid][1] + " (LEAVE EMPTY TO PUT IT BACK)", nameOf(fid)); } catch (e) { return; }
  if (nm === null) return;
  nm = nm.toUpperCase().replace(/[^A-Z0-9 '!?-]/g, "").trim().slice(0, 18);
  const q = tav(); q.names = q.names || {};
  if (!nm || nm === SPEC[fid][1]) { delete q.names[fid]; saveStore(); play("back"); return; }   // putting the real name back is free
  if (q.chips < RENAME) { play("miss"); return; }
  addChips(-RENAME); q.names[fid] = nm; saveStore(); play("fanfare");
}
function tavernTap(lx, ly) {                                 // -> true if handled
  const o = S.overlay, back = () => { S.overlay = o === "tavern" ? null : (o === "c21" && TAV.c21.vip) || (o === "derby" && TAV.derby.vip) || o === "rename" ? "vip" : hubBack(o); play("back"); };
  if (o === "tavern") {
    if (ly < 15 && lx >= 94) { TAV.board = 0; BOARDS.forEach(([k]) => tavLoad(k)); openOverlay("tavboard"); return true; }
    const rows = tavRows(), nr = rows.length, [y0, st, bh] = tavRowLay(nr), i = Math.floor((ly - y0) / st);
    if (ly >= y0 && i < nr && (ly - y0) % st < bh && lx >= 14 && lx < 106) {
      const id = rows[i][2];
      if (id === "vip") { TAV.vipSay = "KEEP YOUR VOICE DOWN"; openOverlay("vip"); }
      else if (id === "c21") { if (!TAV.c21 || TAV.c21.vip) c21New(false); openOverlay("c21"); }
      else if (id === "derby") { if (!TAV.derby || TAV.derby.phase === "done" || TAV.derby.vip) derbyNew(false); openOverlay("derby"); }
      else if (id === "plinko") { plinkoOpen(); openOverlay("plinko"); }
      else if (id === "pit") pitOpen();
      else if (id === "shop") { TAV.shopSel = 0; openOverlay("chipshop"); }
      else if (typeof casinoOpen === "function" && casinoOpen(id)) { /* casino.js */ }
      else if (claimDaily()) { TAV.say = "DON'T SPEND IT ALL"; play("fanfare"); } else { TAV.say = "COME BACK TOMORROW"; play("miss"); }
    } else if (ly > 186) back();
    return true;
  }
  if (o === "vip") {
    const i = Math.floor((ly - 82) / 28);
    if (ly >= 82 && i < 3 && (ly - 82) % 28 < 25 && lx >= 10 && lx < 110) {
      if (i === 0) { if (!TAV.c21 || !TAV.c21.vip) c21New(true); openOverlay("c21"); }
      else if (i === 1) { if (!TAV.derby || TAV.derby.phase === "done" || !TAV.derby.vip) derbyNew(false, true); openOverlay("derby"); }
      else { TAV.renSel = 0; openOverlay("rename"); }
    } else if (ly > 186) { S.overlay = "tavern"; play("back"); }
    return true;
  }
  if (o === "rename") {
    const list = renameList(), n = list.length, pages = Math.max(1, Math.ceil(n / REN_PER)), page = Math.floor((TAV.renSel || 0) / REN_PER);
    if (pages > 1 && ly < 17 && (lx < 24 || lx > 96)) { TAV.renSel = ((page + (lx > 96 ? 1 : pages - 1)) % pages) * REN_PER; play("tick"); }
    else if (ly >= 27 && ly < 27 + REN_PER * 13) { const i = page * REN_PER + Math.floor((ly - 27) / 13); if (i < n) { if (i === TAV.renSel) renameFish(list[i][0]); else { TAV.renSel = i; play("tick"); } } }
    else if (ly >= 168 && ly < 182 && n) renameFish(list[TAV.renSel || 0][0]);
    else if (ly > 186) back();
    return true;
  }
  if (o === "c21") {
    const c = TAV.c21;
    if (ly >= 126 && ly < 145) {
      if (c.phase === "play") { if (lx < 39) c21Hit(false); else if (lx < 80) c21Stand(); else c21Hit(true); }
      else if (c.phase === "stake") stakeTap(lx, c, "bet", c21Deal);
    } else if (ly > 186 && c.phase !== "play" && c.phase !== "dealer") back();
    return true;
  }
  if (o === "derby") return derbyTap(lx, ly);              // derby.js
  if (o === "pit") { pitTap(lx + OX, ly); return true; }   // finprix.js
  if (o === "derbytable") { if (ly > 186) { S.overlay = "derby"; play("back"); } return true; }
  if (o === "scratch") { scratchTap(lx, ly); return true; }
  if (o === "plinko") { plinkoTap(lx + OX, ly); return true; }
  if (o === "chipshop") {
    const pages = Math.ceil(SHOP_ROWS.length / SHOP_PER), page = Math.floor(TAV.shopSel / SHOP_PER), i = page * SHOP_PER + Math.floor((ly - 27) / 15);
    if (ly < 17 && (lx < 24 || lx > 96)) { TAV.shopSel = ((page + (lx > 96 ? 1 : pages - 1)) % pages) * SHOP_PER; play("tick"); }
    else if (ly >= 27 && ly < 27 + SHOP_PER * 15 && i < Math.min(SHOP_ROWS.length, page * SHOP_PER + SHOP_PER)) { if (i === TAV.shopSel) shopBuy(i); else { TAV.shopSel = i; play("tick"); } }
    else if (ly >= 134 && ly < 170) shopBuy(TAV.shopSel);
    else if (ly > 186) back();
    return true;
  }
  if (o === "story") {
    const n = tav().stories;
    if (n > 1 && ly < 17 && (lx < 24 || lx > 96)) { TAV.story = (TAV.story + (lx > 96 ? 1 : n - 1)) % n; play("tick"); }
    else if (ly > 186) { S.overlay = "chipshop"; play("back"); }
    return true;
  }
  if (o === "jukebox") {
    const pages = Math.ceil(SONGS.length / SONG_PER), page = Math.floor(TAV.songSel / SONG_PER), i = page * SONG_PER + Math.floor((ly - 26) / 12);
    if (ly < 17 && (lx < 24 || lx > 96)) { TAV.songSel = ((page + (lx > 96 ? 1 : pages - 1)) % pages) * SONG_PER; if (!SONGS[TAV.songSel]) TAV.songSel++; play("tick"); return true; }
    if (ly >= 26 && ly < 26 + SONG_PER * 12 && i < Math.min(SONGS.length, page * SONG_PER + SONG_PER) && SONGS[i]) {   // (slot 11 is empty)
      if (i !== TAV.songSel) { TAV.songSel = i; play("tick"); return true; }
      const sg = SONGS[i];
      if (songOwned(i)) { tav().song = tav().song === i ? -1 : i; saveStore(); }
      else if (sg[1] && tav().chips >= sg[1]) { addChips(-sg[1]); tav().songs.push(i); tav().song = i; saveStore(); play("fanfare"); }
      else play("miss");
    } else if (ly > 186) { S.overlay = "chipshop"; play("back"); }
    return true;
  }
  if (o === "myfish") {
    const i = Math.floor((ly - 84) / 24), f = tav().fish;
    if (ly >= 84 && i < 3 && lx >= 78 && f.lv[i] < 10) {
      pitOpen("train");
    } else if (ly > 186) { S.overlay = TAV.fishBack || "chipshop"; play("back"); }
    return true;
  }
  if (o === "tavboard") {
    if (ly < 17 && (lx < 24 || lx > 96)) { TAV.board = (TAV.board + (lx > 96 ? 1 : BOARDS.length - 1)) % BOARDS.length; play("tick"); }
    else if (ly > 186) back();
    return true;
  }
  if (o === "bet") { betTapNarrow(lx, ly); return true; }
  return false;
}
function lineCol(i) {
  const c = LINES[store.eq.line][2];
  if (c[0] !== "@") return c;
  if (c === "@rainbow") return "hsl(" + Math.floor((T * 140 + i * 14) % 360) + ",90%,66%)";
  if (c === "@fire") return "hsl(" + Math.floor(18 + 22 * Math.sin(T * 9 + i * 0.8)) + ",100%," + Math.floor(55 + 10 * Math.sin(T * 13 + i)) + "%)";
  if (c === "@ice") return (i + Math.floor(T * 6)) % 4 ? "#bfeaff" : "#ffffff";
  if (c === "@vein") return (i + Math.floor(T * 9)) % 6 === 0 ? "#ff5a6e" : (i + Math.floor(T * 9)) % 6 === 1 ? "#d23246" : "#8c1e32";   // a pulse runs down it
  if (c === "@jackpot") return (i + Math.floor(T * 6)) % 5 === 0 ? "#fff6c8" : (i * 3 + Math.floor(T * 3)) % 11 === 0 ? "#e63246" : "#ffd246";   // gold, with coins flashing down it
  if (c === "@dice") return (i + Math.floor(T * 3)) % 3 === 2 ? "#1a1628" : "#fafaff";       // white with black pips
  if (c === "@lantern") { const b = (Math.floor(T * 8) % 24); return Math.abs(i - b) < 2 ? "#fff0a0" : Math.abs(i - b) < 4 ? "#ffb43c" : "#8c5a28"; }   // a warm light slides down it
  if (c === "@pearl") return i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#fff5dc" : "#d2c8b4";   // a string of pearls
  if (c === "@kelp") return "hsl(" + Math.floor(110 + 18 * Math.sin(T * 2 + i * 0.5)) + ",55%,38%)";
  if (c === "@chip") return (i + Math.floor(T * 4)) % 4 < 2 ? "#f05050" : "#fafaff";
  if (c === "@bile") return (i * 3 + Math.floor(T * 5)) % 7 === 0 ? "#e6ff8c" : "#7cb43c";
  return (i * 7 + Math.floor(T * 10)) % 9 === 0 ? "#ffd246" : (i + Math.floor(T * 4)) % 5 === 0 ? "#ffffff" : "#a0a8c8";      // sparkle
}
const POKE_SAY = ["HI!", "HELLO!", "YES?", "HEY!", "QUIT IT", "STOP!", "I MEAN IT", "GRR...", "LAST CHANCE"];
function angler(x, y, eq, wl, mon) {                       // the boat, whoever is fishing today, their hat, pet and flag (mon: their Flipside self)
  const mc = mon || (eq.mon && store.flip.mons.includes(eq.char)), mh = mon || (eq.mhat && flipDone("mhat")), mp = mon || (eq.mpet && flipDone("mpet"));   // monster forms, once earned
  const cn = (mc ? "mchar" : "char") + eq.char, hn = (mh && DATA.atlas["mhat" + eq.hat] ? "mhat" : "hat") + eq.hat, pn = (mp && eq.pet ? "mpet" : "pet") + eq.pet;
  const [cw, ch] = sprSize(cn), P = S.poke;
  if (eq.flag) { rect("#785432", x + 2, y - 17, 1, 17); const wav = Math.floor(T * 3) % 2; spr("flag" + eq.flag, x + 3, y - 17 + wav, false); }
  let cx = x + 10, cy = y - 12, swim = false;
  if (P.fall >= 0) {                                       // poked ten times: overboard, a little swim, and back in
    const ft = P.fall, wx = x + 52, wy = wl - 4;
    if (ft < 0.6) { const u = ft / 0.6; cx = lerp(x + 10, wx, u); cy = lerp(y - 12, wy, u) - Math.sin(u * Math.PI) * 16; }
    else if (ft < 2.4) { cx = wx + Math.sin(ft * 3) * 2; cy = wy + Math.round(Math.sin(ft * 5)); swim = true; }
    else { const u = Math.min(1, (ft - 2.4) / 0.8); cx = lerp(wx, x + 10, u); cy = lerp(wy, y - 12, u) - Math.sin(u * Math.PI) * 12; swim = u < 0.3; }
  } else if (P.t < 0.25) { if (P.n <= 3) cy -= 2; else cx += Math.round(Math.sin(T * 60)); }   // a hop for a wave, a shake when annoyed
  g.save();
  if (swim) { g.beginPath(); g.rect(0, 0, LW, wl); g.clip(); }
  spr(cn, cx, cy);
  if (eq.hat) { const [hw, hh] = sprSize(hn); spr(hn, cx + Math.floor((cw - hw) / 2) + 1, cy - hh + 3); }
  g.restore();
  if (eq.pet) { const [, ph] = sprSize(pn); spr(pn, x + 22, y - ph + 2 + (Math.floor(T * 2) % 2)); }
  spr("boat" + eq.boat, x, y);
  const said = P.fall >= 0 ? (P.fall < 1.4 ? "WAAAH!" : P.fall > 2.6 ? "...SOGGY." : "") : P.n && P.t < 1.6 ? POKE_SAY[Math.min(P.n, POKE_SAY.length) - 1] : "";
  if (said && S.state === "title") {                       // a speech bubble
    const tw = textW(said, 1), bx = clamp(Math.floor(cx + cw / 2 - tw / 2) - 3, 1, LW - tw - 7), by = Math.max(1, Math.floor(cy) - 12);
    box(bx, by, tw + 6, 10, P.n > 3 || P.fall >= 0 ? ORANGE : WHITE); text(said, bx + 3, by + 5, 1, P.n > 3 || P.fall >= 0 ? ORANGE : WHITE, "left", null);
  }
}
function eventWear() {                                     // -> [sprite, position] that every fish wears today, or null
  if (KON === "glasses") return ["flair1", "face"];
  if (EV.friday) return ["flair2", "top"];
  if (EV.xmas) return ["flair12", "top"];
  if (EV.thanks) return ["evturkey", "top"];
  if (EV.october) return ["evpumpkin", "top"];
  return null;
}
function wearAt(name, pos, w, h) {                         // where something sits on a fish facing right, in the fish's own space
  const [fw, fh] = sprSize(name);
  return pos === "face" ? [w - fw - 1, Math.floor(h / 2) - 2] : pos === "chin" ? [w - fw - 5, h - 3] : [w - fw - 3, -fh + 2];
}
function fishBody(id, x, y, w, h, right, k, img, ph) {     // one swimming fish, with whatever the day (or the code) has it wearing
  if (KON === "ducks") { const a = DATA.atlas.pet2; g.save(); if (!right) { g.translate(x + w, y); g.scale(-1, 1); x = 0; y = 0; } g.drawImage(atlas, a[0], a[1], a[2], a[3], x, y, w, h); g.restore(); return; }
  if (KON === "tiny") { const nw = Math.max(2, Math.round(w * 0.55)), nh = Math.max(2, Math.round(h * 0.55)); x += (w - nw) >> 1; y += (h - nh) >> 1; w = nw; h = nh; k *= 0.55; }
  spr(id, x, y, !right, k, img);
  const wr = eventWear();
  if (wr) { const [fw] = sprSize(wr[0]), [fx, fy] = wearAt(wr[0], wr[1], w, h); spr(wr[0], right ? x + fx : x + w - fx - fw, y + fy, !right); }
  if (KON === "googly") {
    const ex = right ? x + w - 6 : x + 2, ey = y + Math.max(0, (h >> 1) - 3), jx = Math.round(Math.sin(T * 9 + ph) * 0.8), jy = Math.round(Math.cos(T * 7 + ph * 2) * 0.8);
    rect(WHITE, ex, ey, 4, 4); rect(INK, ex + 1 + clamp(jx, 0, 1), ey + 1 + clamp(jy, 0, 1), 2, 2);
  }
}
function flair(w, h) {                                     // whatever the fish are wearing; drawn in the fish's own space
  const ev = eventWear();
  if (ev) { const [fx, fy] = wearAt(ev[0], ev[1], w, h); spr(ev[0], fx, fy); return; }
  const i = store.eq.flair;
  if (!i) return;
  const [fw, fh] = sprSize("flair" + i), pos = DATA.flairPos[i];
  if (pos === "face") spr("flair" + i, w - fw - 1, Math.floor(h / 2) - 2);
  else if (pos === "chin") spr("flair" + i, w - fw - 5, h - 3);
  else spr("flair" + i, w - fw - 3, -fh + 2);
}
const KEYS = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;      // a computer, not a touch screen
function lureIcon(i, x, y) {
  const lid = LURES[i][0], t = T;
  spr("hook" + store.eq.hook, x - 1, y - 1);
  if (lid === "angler") { rect("#c8ecff", x - 3, y - 7, 7, 1); rect("#c8ecff", x - 3, y - 7, 1, 3); rect("#c8ecff", x + 3, y - 7, 1, 3); }   // a little open clasp: it lets go
  else if (lid === "glow") { disc("#ffec78", x, y - 5, 3); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t; rect("#fffabe", x + Math.cos(a) * 6, y - 5 + Math.sin(a) * 6, 1, 1); } }
  else if (lid === "sonar") [3, 6].forEach(r => ring(CYAN, x, y - 3, r + Math.floor(t * 3) % 2));
  else rect("#e65046", x - 1, y - 6, 3, 3);
}
const TITLE_BAR = [["SCORES", CYAN, 0, 39], ["LOG", GOLD, 41, 21], ["SHOP", ORANGE, 64, 27], ["MORE", WHITE, 93, 27]];
function drawHud() {
  const t = T, st = S.state;
  if (st === "title" && wideMenus()) { drawTitleWide(); return; }   // the PC main menu
  g.save(); g.translate(OX, 0);                          // menus sit in a 120-wide column in the middle; x = -OX is the screen's left edge
  if (st === "title") {
    const L = 0, R = 120;                                // inside the menu column, clear of the full-screen button
    disc(GOLD, L + 6, 6, 3); rect("#c89628", L + 5, 5, 2, 2);                         // coins, small, top-left
    text(store.coins, L + 11, 6, 1, GOLD, "left");
    const tn = titleName(store.eq.title), fits = 11 + textW(String(store.coins), 1) + 6 + textW(tn, 1) <= R - 3;
    if (fits) text(tn, R - 3, 6, 1, "#c8a0ff", "right");                                 // your title, small, top-right...
    else text(tn, 60, 37, 1, "#c8a0ff", "center");                                       // ...or under the logo if it won't fit beside the coins
    text("REEL", 33, 22 + Math.floor(Math.sin(t * 2.5) * 1.5), 2, CYAN); text("DEEP", 87, 22 + Math.floor(Math.sin(t * 2.5 + 1) * 1.5), 2, GOLD);
    const bs = SPEC[S.bounty][1] + " X" + C.BOUNTY_X, bw = textW(bs, 1) + 8, bx = 60 - (bw >> 1);   // today's bounty, one line, with its tag
    rect(INK, bx, 84, 5, 6); rect(GOLD, bx + 1, 85, 3, 4); rect(INK, bx + 2, 86, 1, 2);
    text(bs, bx + 8, 88, 1, GOLD, "left");
    LURES.forEach((Lu, i) => {                           // pick a lure
      const x = 6 + i * 27, sel = i === S.lure;
      rect(sel ? "#1e285a" : INK, x, 96, 26, 28);
      g.fillStyle = sel ? GOLD : "#5a6496"; g.fillRect(x, 96, 26, 1); g.fillRect(x, 123, 26, 1); g.fillRect(x, 96, 1, 28); g.fillRect(x + 25, 96, 1, 28);
      if (!lureOK(i)) g.globalAlpha = 0.3;                 // greyed out by the NO PULSES bet
      lureIcon(i, x + 13, 107);
      for (let k = 0; k < Lu[5]; k++) rect(CYAN, x + 13 - Lu[5] * 3 + k * 6 + 1, 118, 4, 3);
      g.globalAlpha = 1;
    });
    text(LURES[S.lure][1], 60, 131, 1, GOLD, "center");
    const on = Math.floor(t * 2.5) % 2;
    box(20, 137, 80, 21, on ? WHITE : CYAN); text("CAST", 60, 147, 2, on ? WHITE : CYAN, "center");
    {                                                      // betting on this dive
      const b = tav().bet, bt = b && !b.cast ? betLabel(b) + ": " + fmtChips(b.stake) : "";
      const bl = bt || "PLACE A BET", bx = 57 - (textW(bl, 1) >> 1) + 4;
      box(8, 160, 98, 12, bt ? GOLD : CHIP); chipIcon(bx - 6, 166); text(bl, bx, 166, 1, bt ? GOLD : CHIP, "left", null);
    }
    TITLE_BAR.forEach(([lab, col, x, w]) => { box(x, 176, w, 14, col); text(lab, x + w / 2, 183, 1, col, "center", null); });
    const left = tasks().d.concat(tasks().w).filter(q => !q.done).length;
    if (left) { rect(INK, 110, 170, 9, 9); rect(GOLD, 111, 171, 7, 7); text(left, 114, 174, 1, INK, "center", null); }   // tasks still open, on MORE
    S.popups.slice(-2).forEach((p, i) => { const tw = textW(p[0], 1); box(Math.floor(60 - tw / 2) - 4, 134 - i * 13 - 96, tw + 8, 11, p[2]); text(p[0], 60, 139 - i * 13 - 96, 1, p[2], "center", null); });
    g.restore();
    return;
  }
  if (["down", "turn", "up", "fight", "rise"].includes(st)) {
    const ds = Math.floor(S.hy / M) + " M", dw = textW(ds, 2);    // the depth, on a dark plate so it reads over the line and bright water
    g.globalAlpha = 0.6; rect(INK, Math.floor(60 - dw / 2) - 5, 0, dw + 10, 18); g.globalAlpha = 1;
    text(ds, 60, 9, 2);
    text("FISH " + S.catch.length + "/" + C.CAPACITY, 60, 23, 1, S.catch.length < C.CAPACITY ? GOLD : LIME);
    if (S.reached - S.hy / M > 3) text("DEEPEST " + Math.floor(S.reached) + " M", 60, 33, 1, "#8cc8dc");   // how far you got, once you're on the way up
    const gx = LW - 6 - OX, gy = 34, gh = 150;                   // depth gauge
    rect(INK, gx - 1, gy - 1, 5, gh + 2);
    ZONES.forEach(([, a, b], zi) => rect(ZONE_COL[zi], gx, gy + Math.floor(a / C.MAX_M * gh), 3, Math.floor((b - a) / C.MAX_M * gh) + 1));
    const my = gy + Math.floor(S.hy / M / C.MAX_M * gh);
    poly(WHITE, [[gx - 6, my - 3], [gx - 2, my], [gx - 6, my + 3]]);
    rect(WHITE, gx - 2, gy + Math.floor(S.reached / C.MAX_M * gh), 7, 1);     // the deepest point this dive
    if (tav().map === weekString()) { const by = gy + Math.floor(bootDepth() / C.MAX_M * gh); rect(GOLD, gx - 3, by - 1, 2, 3); }   // the treasure map's mark
    const ang = LURES[S.lure][0] === "angler";
    if (st === "down" || st === "rise" || (ang && S.fullUp && (st === "up" || st === "turn"))) {   // the pulse button (DROP on the Angler's Hook, which still works on a full hook)
      const have = S.pulses > 0 || (st !== "up" && st !== "turn" && nearCrack()), n = LURES[S.lure][5];
      box(2 - OX, 176, 36, 22, have ? CYAN : "#505678"); text(ang ? "DROP" : "PULSE", 20 - OX, 183, 1, have ? CYAN : "#6e7496", "center", null);
      for (let k = 0; k < n; k++) rect(k < S.pulses ? CYAN : "#3c4264", 20 - OX - n * 4 + k * 8 + 1, 190, 6, 3);
      if (st === "down") { box(2 - OX, 2, 12, 10); text("<", 8 - OX, 7, 1, WHITE, "center", null); }
    }
    if (S.msg && st === "turn") {
      const sc = textW(S.msg, 2) < 106 ? 2 : 1, tw = textW(S.msg, sc), col = S.msg === "ZAPPED!" ? RED : GOLD;
      box(Math.floor(60 - tw / 2) - 5, 86, tw + 10, 22, col); text(S.msg, 60, 97, sc, col, "center", null);
    }
    if (st === "up" && Math.floor(t * 3) % 2) text("REELING IN!", 60, 184, 1, LIME);
    if (st === "rise" && Math.floor(t * 3) % 2) text("RISING: KEEP FISHING", 60, 166, 1, LIME);
    if (st === "down" && S.hy < 22 * M && Math.floor(t * 3) % 2) text("PICK YOUR " + C.CAPACITY + " FISH", 60 - 3, 166, 1, WHITE);
  }
  if (st === "fight") drawFightBox(S.fight, SPEC[S.fight.f.id][1], SPEC[S.fight.f.id][7]);
  S.popups.slice(-3).forEach((p, i) => {
    if (p[1] > 0.3 || Math.floor(t * 20) % 2) { const tw = textW(p[0], 1); box(Math.floor(60 - tw / 2) - 4, 40 + i * 13, tw + 8, 11, p[2]); text(p[0], 60, 45 + i * 13, 1, p[2], "center", null); }
  });
  drawHaulBox();
  g.restore();
}
function drawFightBox(fg, name, leg) {                       // the timing bar, in the menu column
  const t = T, col = leg ? LEGEND : TROPHY;
  {
    box(8, 104, 104, 68, col);
    if (leg) { g.fillStyle = Math.floor(t * 6) % 2 ? LEGEND : WHITE; g.fillRect(10, 106, 100, 1); g.fillRect(10, 169, 100, 1); g.fillRect(10, 106, 1, 64); g.fillRect(109, 106, 1, 64); }   // legendaries get a flashing double border
    text(leg ? "LEGENDARY!" : "TROPHY!", 60, 111, 1, col, "center", null);
    text(name, 60, 120, 1, WHITE, "center", null);
    text(STYLE_HINT[fg.style], 60, 129, 1, CYAN, "center", null);
    const bx = 16, bw = 88, k = clamp(fg.left / fg.time, 0, 1);
    rect("#321e32", bx, 135, bw, 3); rect(k < 0.3 ? RED : k < 0.6 ? GOLD : LIME, bx, 135, Math.ceil(bw * k), 3);      // the clock
    rect("#321e32", bx, 141, bw, 8);
    rect("#46dc6e", bx + Math.floor((fg.win[0] - fg.win[1]) * bw), 141, Math.max(2, Math.floor(fg.win[1] * 2 * bw)), 8);
    const mx = bx + Math.floor(fg.pos * (bw - 1));
    rect(WHITE, mx - 1, 139, 3, 12); rect(INK, mx, 141, 1, 8);
    for (let q = 0; q < fg.need; q++) rect(q < fg.hits ? LIME : "#464c6e", 16 + q * 8, 153, 6, 5);
    for (let q = 0; q < 2; q++) text("X", 100 - q * 8, 156, 1, q < fg.miss ? RED : "#464c6e", "center", null);
    if (Math.floor(t * 4) % 2) text(KEYS ? "SPACE ON GREEN!" : "TAP ON GREEN!", 60, 165, 1, WHITE, "center", null);
  }
}
function drawHaulBox() {                                     // the haul screen, in the menu column
  const st = S.state, t = T;
  if (st === "haul" && wideMenus()) drawHaulWide(S.haul, t);
  else if (st === "haul") {
    const h = S.haul;
    box(6, 84, 108, 112, CYAN);
    text("HAUL", 10, 92, 1, CYAN, "left", null); text((h.deep || 0) + " M DEEP", 110, 92, 1, "#8cc8dc", "right", null);
    const rows = h.rows.slice(0, h.shown);
    rows.forEach(([fid, lb, tag, tr], i) => {
      const y = 104 + i * 10, name = ((SPEC[fid][7] ? "!" : tr ? "*" : "") + SPEC[fid][1]).slice(0, tag ? 9 : lb >= 100 ? 12 : 13);
      text(name, 10, y, 1, HIDDEN.includes(fid) ? "#c8a0ff" : SPEC[fid][7] ? LEGEND : tr ? TROPHY : WHITE, "left", null);
      if (tag) text(tag, 88, y, 1, tag[0] === "X" ? GOLD : tag === "NEW" ? LIME : tag === "???" ? "#c8a0ff" : "#ff8c32", "right", null);
      text(lb, 110, y, 1, WHITE, "right", null);
    });
    if (!h.rows.length) { text("NOTHING BUT", 60, 110, 1, WHITE, "center", null); text("SEAWEED", 60, 120, 1, WHITE, "center", null); }
    h.extra.slice(0, Math.max(0, h.shown - h.rows.length)).forEach(([txt, col], j) => text(txt, 60, 138 + j * 10, 1, col, "center", null));
    const done = h.shown >= h.n;
    rect(CYAN, 10, 162, 100, 1);
    text("TOTAL", 10, 172, 1, CYAN, "left", null); text("LB", 110, 174, 1, GOLD, "right", null);
    text(done ? h.total : rows.reduce((a, r) => a + r[1], 0), 96, 171, 2, GOLD, "right", null);
    if (done && S.stT > h.end) {
      if (h.record && h.total > 0) text("YOUR NEW BEST!", 60, 76, 1, GOLD);
      if (Math.floor(t * 2.5) % 2) text("TAP TO CONTINUE", 60, 188, 1, WHITE, "center", null);
    }
  }
  if (st === "haul") {
    const h = S.haul, k = (S.stT - 0.5) / 0.42, i = Math.floor(k);    // each fish flies out of the water into the boat as it is weighed
    if (i >= 0 && i < h.rows.length) {
      const u = k - i, [w, hh] = sprSize(h.rows[i][0], h.rows[i][3] ? 1.7 : 1), wl = Math.round(-S.cam);
      const fx = Math.floor(lerp(72, 44, u) - w / 2), fy = Math.floor(wl - 4 - Math.sin(u * Math.PI) * 30 - hh / 2);
      spr(h.rows[i][0], fx, fy, false, h.rows[i][3] ? 1.7 : 1);
      g.save(); g.translate(fx, fy); flair(w, hh); g.restore();
    }
  }
}

const MORE_ROWS = () => [["TASKS", LIME, "tasks"], [store.sec.found.length ? "SECRETS" : "???", store.sec.found.length ? "#c8a0ff" : GREY, "secrets"]]
  .concat(store.sec.beat ? [["BESTIARY", "#ff8ca0", "bestiary"]] : [])                  // after beating the game
  .concat(typeof siegeAtMore === "function" && siegeAtMore() ? [["THE SIEGE", "#ff6e78", "siege"]] : [])   // phones: Siege of the Deep
  .concat([["HELP", CYAN, "help"], [store.name ? "INITIALS: " + store.name : "SET INITIALS", store.name ? WHITE : GREY, "name"], ["SAVE CODE", GOLD, "save"]]);
const moreStep = () => (MORE_ROWS().length > 6 ? 16 : MORE_ROWS().length > 5 ? 18 : 21);
function drawMore() {                                      // everything that used to crowd the title screen
  g.save(); g.translate(OX, 0);
  box(6, 30, 108, 150, WHITE); text("MORE", 60, 40, 2, WHITE, "center");
  const left = tasks().d.concat(tasks().w).filter(q => !q.done).length;
  const st = moreStep(), bh = st - 4;
  MORE_ROWS().forEach(([lab, col], i) => {
    const y = 56 + i * st; box(16, y, 88, bh, col); text(lab, 60, y + (bh >> 1), 1, col, "center", null);
    if (i === 0 && left) { rect(INK, 98, y - 3, 9, 9); rect(GOLD, 99, y - 2, 7, 7); text(left, 102, y + 1, 1, INK, "center", null); }
  });
  text(KEYS ? "ESC TO CLOSE" : "TAP OUTSIDE TO CLOSE", 60, 170, 1, GREY, "center", null);
  g.restore();
}
const SEC_PER = 7;
function rewardName(rw) {
  if (!rw) return "";
  if (rw[0] === "title") return titleName(rw[1]) + " TITLE";
  if (rw[0] === "mark") return "A MARK ON THE BOARD";
  const n = (rw[0] === "flag" ? DATA.flags : DATA.flair)[rw[1]];
  return rw[0] === "flag" ? (n.includes("FLAG") ? n : n + " FLAG") : n + " FLAIR";
}
function rewardWorn(rw) { if (rw[0] === "mark") return store.sec.mark !== false; return rw[0] === "title" ? store.eq.title === rw[1] : store.eq[rw[0]] === rw[1]; }
function secretAct() {                                     // put the selected secret's reward on, or take it off
  const id = store.sec.found[S.secSel], sc = SECRETS.find(q => q[0] === id), rw = sc && sc[3];
  if (!rw) return;
  if (rw[0] === "mark") store.sec.mark = !rewardWorn(rw);
  else if (rw[0] === "title") store.eq.title = rewardWorn(rw) ? "rookie" : rw[1];
  else store.eq[rw[0]] = rewardWorn(rw) ? 0 : rw[1];
  saveStore(); play("select");
}
function drawSecrets() {                                   // the secrets found so far, and where their rewards are worn. No total, ever.
  rect("#0c0820", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const found = store.sec.found, pages = Math.max(1, Math.ceil(found.length / SEC_PER)), page = Math.floor(S.secSel / SEC_PER);
  if (pages > 1) { box(2, 2, 16, 13, "#c8a0ff"); text("<", 10, 8, 1, "#c8a0ff", "center", null); box(102, 2, 16, 13, "#c8a0ff"); text(">", 110, 8, 1, "#c8a0ff", "center", null); }
  text("SECRETS", 60, 8, 1, "#c8a0ff", "center", null);
  const nb = store.sec.bottles.length;
  box(14, 17, 92, 13, nb ? "#b4f0dc" : "#3c4264"); text(nb ? "BOTTLES: " + nb : "NO BOTTLES YET", 60, 23, 1, nb ? "#b4f0dc" : GREY, "center", null);
  found.slice(page * SEC_PER, page * SEC_PER + SEC_PER).forEach((id, k) => {
    const i = page * SEC_PER + k, sc = SECRETS.find(q => q[0] === id), y = 34 + k * 14, sel = i === S.secSel;
    rect(sel ? "#2a1e4a" : "#141030", 2, y, 116, 13);
    if (sel) { g.fillStyle = "#c8a0ff"; g.fillRect(2, y, 116, 1); g.fillRect(2, y + 12, 116, 1); g.fillRect(2, y, 1, 13); g.fillRect(117, y, 1, 13); }
    text(sc[1], 5, y + 6, 1, sc[3] && rewardWorn(sc[3]) ? GOLD : WHITE, "left", null);
  });
  const sc = SECRETS.find(q => q[0] === found[S.secSel]);
  if (sc) {
    box(2, 134, 116, 32, "#c8a0ff");
    wrap(sc[2], 18).slice(0, 2).forEach((l, i) => text(l, 60, 140 + i * 9, 1, "#dcd2f0", "center", null));
    if (sc[3]) {
      text(rewardName(sc[3]), 60, 159, 1, GOLD, "center", null);
      const on = rewardWorn(sc[3]);
      box(26, 169, 68, 14, on ? CYAN : GOLD); text(on ? "TAKE OFF" : "PUT ON", 60, 176, 1, on ? CYAN : GOLD, "center", null);
    }
  }
  text("TAP HERE TO CLOSE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawNote() {                                      // reading a message from a bottle
  rect("#06101c", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const list = store.sec.bottles, id = list[S.noteIdx];
  if (list.length > 1) { box(2, 2, 16, 13, "#b4f0dc"); text("<", 10, 8, 1, "#b4f0dc", "center", null); box(102, 2, 16, 13, "#b4f0dc"); text(">", 110, 8, 1, "#b4f0dc", "center", null); }
  spr("bottle", 57, 24);
  text("A MESSAGE", 60, 44, 1, "#b4f0dc", "center", null);
  rect("#ece0bc", 8, 54, 104, 100); rect("#d2c296", 8, 153, 104, 1); rect("#d2c296", 111, 54, 1, 100);   // the paper
  if (id !== undefined) { const ls = wrap(BOTTLES[id][0], 16); ls.forEach((l, i) => text(l, 60, 104 - ls.length * 5 + i * 10, 1, "#3c2c1e", "center", null)); }
  text("TAP HERE TO CLOSE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawLog() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const page = LOGGED.filter(s => s[2] === S.logPage);
  box(2, 2, 16, 13, CYAN); text("<", 10, 8, 1, CYAN, "center", null);
  box(102, 2, 16, 13, CYAN); text(">", 110, 8, 1, CYAN, "center", null);
  text(ZONES[S.logPage][0], 60, 8, 1, GOLD, "center", null);
  page.forEach((s, i) => {
    const x = 4 + (i % 4) * 28, y = 20 + Math.floor(i / 4) * 20, e = store.log[s[0]], a = DATA.atlas[s[0]];
    rect(e ? ZONE_COL[s[2]] : "#141a36", x, y, 27, 19);
    g.fillStyle = i === S.logSel ? WHITE : s[7] && e ? GOLD : INK; g.fillRect(x, y, 27, 1); g.fillRect(x, y + 18, 27, 1); g.fillRect(x, y, 1, 19); g.fillRect(x + 26, y, 1, 19);
    const k = Math.min(1, 23 / a[2], 15 / a[3]), w = Math.max(1, Math.floor(a[2] * k)), h = Math.max(1, Math.floor(a[3] * k));
    g.drawImage(e ? atlas : sil, a[0], a[1], a[2], a[3], x + 14 - (w >> 1), y + 10 - (h >> 1), w, h);
    if (e && e.star) text("*", x + 22, y + 5, 1, GOLD, "center", null);
  });
  const s = page[Math.min(S.logSel, page.length - 1)], e = store.log[s[0]];
  box(2, 106, 116, 34, CYAN);
  if (e) {
    text(nameOf(s[0]), 60, 113, 1, tav().names && tav().names[s[0]] ? "#ff8cd2" : s[7] ? GOLD : WHITE, "center", null);
    text("X" + e.n + " BEST " + e.rec + " LB", 60, 123, 1, CYAN, "center", null);
    text(s[7] ? "! LEGENDARY !" : e.star ? "* TROPHY CAUGHT" : "NO TROPHY YET", 60, 133, 1, s[7] ? LEGEND : e.star ? TROPHY : GREY, "center", null);
  } else {
    text("???", 60, 113, 1, GREY, "center", null);
    text(ZONES[s[2]][0] + (s[6] ? " " + s[6] : ""), 60, 123, 1, GREY, "center", null);
    text(s[7] ? "LEGENDARY" : "NOT CAUGHT YET", 60, 133, 1, GREY, "center", null);
  }
  text("CAUGHT " + LOGGED.filter(q => store.log[q[0]]).length + "/" + LOGGED.length, 60, 152, 1, WHITE, "center", null);
  text("TROPHIES " + Object.values(store.log).filter(v => v.star).length + "/" + LOGGED.filter(q => !q[7] && q[4] > 0).length, 60, 163, 1, GOLD, "center", null);
  text("TAP HERE TO CLOSE", 60, 192, 1, WHITE, "center", null);
  g.restore();
}

// ---- the endgame's haul, and the Bestiary
function drawFHaul() {                                       // after catching yourself in the endgame
  rect("#14050a", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const h = S.fhaul;
  text("YOU CAUGHT YOURSELF", 60, 7, 1, "#ff8ca0", "center", null);
  const mc = "mchar" + store.eq.char, [cw] = sprSize(mc); spr(mc, 60 - (cw >> 1), 14 + (Math.floor(T * 2) % 2));
  box(6, 34, 108, 138, "#ff8ca0");
  text("THE FLIPSIDE HAUL", 60, 41, 1, "#ff8ca0", "center", null);
  h.rows.forEach(([id, lb, tr, isNew], i) => {
    const y = 53 + i * 10, sp = FSPEC[id], name = ((sp[6] ? "!" : tr ? "*" : "") + sp[1]).slice(0, isNew ? 9 : lb >= 100 ? 12 : 13);
    text(name, 10, y, 1, id === DATA.flip.mythic ? "#ffd2f0" : sp[6] ? LEGEND : tr ? TROPHY : WHITE, "left", null);
    if (isNew) text("NEW", 88, y, 1, LIME, "right", null);
    text(lb, 110, y, 1, WHITE, "right", null);
  });
  if (!h.rows.length) text("AN EMPTY HOOK", 60, 63, 1, GREY, "center", null);
  if (h.sets.length) { const long = h.sets.map(s => s[1]).join("+"), short = h.sets.map(s => SHORT[s[1]] || s[1]).join("+"); text((h.sets.length === 1 ? long : short.length <= 13 ? short : h.sets.length + " BONUSES") + " X" + h.mult, 60, 86, 1, LIME, "center", null); }
  h.news.slice(0, 5).forEach(([txt, col], j) => text(txt.slice(0, 19), 60, 98 + j * 10, 1, col, "center", null));
  rect("#ff8ca0", 10, 150, 100, 1);
  text("SCORE", 10, 160, 1, "#ff8ca0", "left", null); text(h.total, 110, 159, 2, GOLD, "right", null);
  if (h.record && h.total > 0) text("YOUR FLIPSIDE BEST!", 60, 180, 1, GOLD, "center", null);
  if (Math.floor(T * 2.5) % 2) text("TAP TO CONTINUE", 60, 192, 1, WHITE, "center", null);
  g.restore();
}
const B_RPER = 7, B_PAGES = FLIP_Z.length + Math.ceil(FLIP_REWARDS.length / B_RPER);   // a page per zone, then the rewards
function drawBestiary() {
  rect("#14050a", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const pg = S.bPage, PINK = "#ff8ca0";
  box(2, 2, 12, 13, PINK); text("<", 8, 8, 1, PINK, "center", null); box(106, 2, 12, 13, PINK); text(">", 112, 8, 1, PINK, "center", null);
  if (pg < FLIP_Z.length) {
    text(FLIP_Z[pg][0], 60, 8, 1, GOLD, "center", null);
    const page = BESTIARY.filter(s => s[2] === pg);
    page.forEach((s, i) => {
      const x = 4 + (i % 4) * 28, y = 20 + Math.floor(i / 4) * 20, e = store.flip.log[s[0]], a = DATA.atlas["fc_" + s[0]];
      rect(e ? "#4a1424" : "#1e0a12", x, y, 27, 19);
      g.fillStyle = i === S.bSel ? WHITE : s[6] && e ? GOLD : INK; g.fillRect(x, y, 27, 1); g.fillRect(x, y + 18, 27, 1); g.fillRect(x, y, 1, 19); g.fillRect(x + 26, y, 1, 19);
      const k = Math.min(1, 23 / a[2], 15 / a[3]), w = Math.max(1, Math.floor(a[2] * k)), hh = Math.max(1, Math.floor(a[3] * k));
      g.drawImage(e ? atlas : sil, a[0], a[1], a[2], a[3], x + 14 - (w >> 1), y + 10 - (hh >> 1), w, hh);
      if (e && e.star) text("*", x + 22, y + 5, 1, GOLD, "center", null);
    });
    const s = page[Math.min(S.bSel, page.length - 1)], e = store.flip.log[s[0]];
    box(2, 106, 116, 34, PINK);
    if (e) {
      text(s[1], 60, 113, 1, s[6] ? GOLD : WHITE, "center", null);
      text("X" + e.n + " BEST " + e.rec + " LB", 60, 123, 1, PINK, "center", null);
      text(s[6] ? "! LEGENDARY !" : e.star ? "* TROPHY CAUGHT" : "NO TROPHY YET", 60, 133, 1, s[6] ? LEGEND : e.star ? TROPHY : GREY, "center", null);
    } else {
      text("???", 60, 113, 1, GREY, "center", null);
      text(FLIP_Z[s[2]][0], 60, 123, 1, GREY, "center", null);
      text(s[6] ? "LEGENDARY" : "NOT CAUGHT YET", 60, 133, 1, GREY, "center", null);
    }
    text("CAUGHT " + BESTIARY.filter(q => store.flip.log[q[0]]).length + "/" + BESTIARY.length, 60, 150, 1, WHITE, "center", null);
    text("TROPHIES " + BESTIARY.filter(q => !q[6] && (store.flip.log[q[0]] || {}).star).length + "/" + BESTIARY.filter(q => !q[6]).length, 60, 160, 1, GOLD, "center", null);
    text("WON " + store.flip.wins + "/" + store.flip.runs + " BEST " + store.flip.best, 60, 170, 1, PINK, "center", null);
  } else {
    const rp = pg - FLIP_Z.length, list = FLIP_REWARDS.slice(rp * B_RPER, rp * B_RPER + B_RPER);
    text("REWARDS " + (rp + 1) + "/" + (B_PAGES - FLIP_Z.length), 60, 8, 1, GOLD, "center", null);
    text("MONSTERS " + store.flip.mons.length + "/" + DATA.chars.length, 60, 23, 1, PINK, "center", null);
    list.forEach((r, k) => {
      const y = 34 + k * 14, sel = k === S.bSel, ok = r[3]();
      rect(sel ? "#3c1020" : "#1e0a12", 2, y, 116, 13);
      if (sel) { g.fillStyle = PINK; g.fillRect(2, y, 116, 1); g.fillRect(2, y + 12, 116, 1); g.fillRect(2, y, 1, 13); g.fillRect(117, y, 1, 13); }
      text(r[1], 5, y + 6, 1, !ok ? GREY : flipRewardWorn(r[4]) ? GOLD : WHITE, "left", null);
      if (ok) text("+", 113, y + 6, 1, LIME, "right", null);
    });
    const r = list[Math.min(S.bSel, list.length - 1)];
    if (r) {
      const ok = r[3](), on = ok && flipRewardWorn(r[4]);
      box(2, 134, 116, 32, PINK);
      wrap(r[2], 18).slice(0, 2).forEach((l, i) => text(l, 60, 140 + i * 9, 1, "#f0d2dc", "center", null));
      text(ok ? "EARNED" : "NOT YET", 60, 159, 1, ok ? LIME : GREY, "center", null);
      if (ok) { box(26, 169, 68, 14, on ? CYAN : GOLD); text(on ? "TAKE OFF" : "PUT ON", 60, 176, 1, on ? CYAN : GOLD, "center", null); }
    }
  }
  text("TAP HERE TO CLOSE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function bestiaryTap(lx, ly, d) {
  if (d) { S.bPage = (S.bPage + d) % B_PAGES; S.bSel = 0; return; }
  if (S.bPage < FLIP_Z.length) {
    if (ly >= 20 && ly < 100) { S.bSel = clamp(Math.floor((ly - 20) / 20) * 4 + Math.floor((lx - 4) / 28), 0, BESTIARY.filter(s => s[2] === S.bPage).length - 1); play("tick"); }
    return;
  }
  const rp = S.bPage - FLIP_Z.length, n = FLIP_REWARDS.slice(rp * B_RPER, rp * B_RPER + B_RPER).length;
  if (ly >= 34 && ly < 34 + B_RPER * 14) { const k = Math.floor((ly - 34) / 14); if (k < n) { if (k === S.bSel) flipRewardToggle(FLIP_REWARDS[rp * B_RPER + k]); else { S.bSel = k; play("tick"); } } }
  else if (ly >= 167 && ly < 185) flipRewardToggle(FLIP_REWARDS[rp * B_RPER + S.bSel]);
}

function drawScores() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const fb = S.board && store.sec.beat;                      // the Flipside board, once you've been there
  if (store.sec.beat) { box(2, 2, 12, 13, "#ff8ca0"); text("<", 8, 8, 1, "#ff8ca0", "center", null); box(106, 2, 12, 13, "#ff8ca0"); text(">", 112, 8, 1, "#ff8ca0", "center", null); }
  text(fb ? "FLIPSIDE" : "HIGH SCORES", 60, 9, 1, fb ? "#ff8ca0" : GOLD, "center", null);
  ["TODAY", "ALL TIME"].forEach((lab, i) => { const on = S.tab === i; box(6 + i * 55, 18, 53, 14, on ? CYAN : "#3c4264"); text(lab, 32 + i * 55, 25, 1, on ? CYAN : GREY, "center", null); });
  if (!LB.url) {
    text("YOUR BEST: " + (fb ? store.flip.best : store.best) + " LB", 60, 60, 1, WHITE, "center", null);
    ["THE SHARED BOARD", "IS NOT SET UP YET.", "SEE README.MD"].forEach((l, i) => text(l, 60, 90 + i * 11, 1, GREY, "center", null));
  } else {
    const rows = (fb ? (S.tab === 0 ? LB.ftoday : LB.fall) : (S.tab === 0 ? LB.today : LB.all)) || [];
    if (LB.status) text(LB.status, 60, 46, 1, ORANGE, "center", null);
    else if (!rows.length) text(S.tab === 0 ? "NO CATCHES YET TODAY" : "NO SCORES YET", 60, 60, 1, GREY, "center", null);
    rows.forEach((r, i) => {
      const y = 41 + i * 11, col = i === S.scoreSel ? WHITE : i === 0 ? GOLD : r.n === store.name ? CYAN : "#c8d2f0";
      if (i === S.scoreSel) rect("#1e285a", 4, y - 5, 112, 11);
      text(i + 1, 18, y, 1, i < 3 ? GOLD : GREY, "right", null); text(r.n, 26, y, 1, col, "left", null); text(r.s, 112, y, 1, col, "right", null);
      if (r.m) { const mx = 26 + textW(r.n, 1) + 2; rect("#ff8ca0", mx, y - 2, 3, 3); rect(INK, mx + 1, y - 1, 1, 1); }   // a little red eye: they've been to the other side
    });
    const r = rows[S.scoreSel], h = r && (fb ? unpackFlipHaul(r.h) : unpackHaul(r.h));    // what was on the hook for the selected score
    if (r && fb) {
      box(2, 147, 116, 41, "#ff8ca0");
      if (h) {
        h.fish.forEach((f, i) => { const sp = FSPEC[f[0]]; text((sp[6] ? "!" : f[2] ? "*" : "") + sp[1].slice(0, 14), 6, 153 + i * 8, 1, sp[6] ? LEGEND : f[2] ? TROPHY : WHITE, "left", null); text(f[1], 114, 153 + i * 8, 1, WHITE, "right", null); });
        text("X" + h.mult, 6, 181, 1, LIME, "left", null);
        if (r.ti) text(String(r.ti).slice(0, 17 - ("X" + h.mult).length), 114, 181, 1, "#c8a0ff", "right", null);
      } else text("NO CATCH DETAILS", 60, 167, 1, GREY, "center", null);
    } else if (r) {
      box(2, 147, 116, 41, CYAN);
      if (h) {
        h.fish.forEach((f, i) => { text((SPEC[f[0]][7] ? "!" : f[2] ? "*" : "") + SPEC[f[0]][1].slice(0, 14), 6, 153 + i * 8, 1, HIDDEN.includes(f[0]) ? "#c8a0ff" : SPEC[f[0]][7] ? LEGEND : f[2] ? TROPHY : WHITE, "left", null); text(f[1], 114, 153 + i * 8, 1, WHITE, "right", null); });
        const head = "X" + h.mult + (h.bottom ? " +FLOOR" : "");
        text(head, 6, 181, 1, LIME, "left", null);
        if (r.ti) text(String(r.ti).slice(0, 18 - head.length), 114, 181, 1, "#c8a0ff", "right", null);
      } else text("NO CATCH DETAILS", 60, 167, 1, GREY, "center", null);
    } else if (rows.length) text("TAP A SCORE", 60, 162, 1, GREY, "center", null), text("TO SEE THE CATCH", 60, 172, 1, GREY, "center", null);
    if (LB.note) text(LB.note, 60, 36, 1, ORANGE, "center", null);
  }
  text("TAP HERE TO CLOSE", 60, 195, 1, WHITE, "center", null);
  g.restore();
}

const CATS = SHOP.concat([["TITLE", "title", SHOP_TITLE_IDS.map(i => [TITLES[i][1], 0])]]);
const shopTitle = i => TITLES[SHOP_TITLE_IDS[i]];
function shopState(cat, i) {                               // -> [owned, equipped]
  const kind = CATS[cat][1];
  if (kind === "title") return [store.titles.includes(shopTitle(i)[0]), store.eq.title === shopTitle(i)[0]];
  return [store.own[kind].includes(i), store.eq[kind] === i];
}
function shopAct() {                                       // buy or wear the selected thing
  const cat = S.shopCat, i = S.shopSel, kind = CATS[cat][1], [owned] = shopState(cat, i), cost = CATS[cat][2][i][1];
  if (kind === "title") { if (owned) { store.eq.title = shopTitle(i)[0]; play("select"); } else play("miss"); }
  else if (owned) { store.eq[kind] = i; play("select"); }
  else if (store.coins >= cost) { store.coins -= cost; store.own[kind].push(i); store.eq[kind] = i; play("fanfare"); }
  else play("miss");
  saveStore();
}
const PER_PAGE = 20;
function shopPreview(kind, i, x, y, owned) {               // a small picture of one item, fitted into a 22 x 19 cell
  const cx = x + 11, cy = y + 9, t = T;
  g.save(); if (!owned) g.globalAlpha = 0.45;
  const fit = (name, maxw, maxh, k) => { const a = DATA.atlas[name]; const s = Math.min(k || 2, maxw / a[2], maxh / a[3]); const w = Math.round(a[2] * s), h = Math.round(a[3] * s); g.drawImage(atlas, a[0], a[1], a[2], a[3], cx - (w >> 1), cy - (h >> 1), w, h); };
  if (kind === "char") fit("char" + i, 18, 16, 1);
  else if (kind === "boat") fit("boat" + i, 20, 10, 1);
  else if (["hat", "pet", "flag", "hook", "flair"].includes(kind)) { if (i) fit(kind + i, 18, 15, 2); else text("-", cx, cy, 1, GREY, "center", null); }
  else if (kind === "line") { const keep = store.eq.line; store.eq.line = i; for (let q = 0; q < 13; q++) rect(lineCol(q), cx + Math.round(Math.sin(q * 0.7) * 2), y + 3 + q, 1, 1); store.eq.line = keep; }
  else if (kind === "trail") { const tc = TRAILS[i][2]; for (let q = 0; q < 7; q++) rect(tc[q % tc.length], x + 4 + (q * 7) % 15, y + 3 + (q * 5 + Math.floor(t * 6)) % 13, q % 2 ? 2 : 1, q % 2 ? 2 : 1); }
  else text(owned ? "*" : "?", cx, cy, 1, owned ? "#c8a0ff" : GREY, "center", null);
  g.restore();
}
// ===================================================================== PC menus
// On a wide window (LW >= 320, e.g. any 16:9 browser) the collection menus use the whole screen instead of the 120-wide
// phone column (Kade, Nov 17, 2026). Phones keep the column layouts. Each wide menu in WIDE has:
//   hits()  -> [[id, x, y, w, h, value], ...] in screen coordinates: everything you can tap
//   draw()  -> draws the menu (using the same hits, so buttons and taps can't drift apart)
//   tap(rx, ly) and key(dir) for Left / Right. Enter / Space still go through overlayTap like before.
const wideMenus = () => LW >= 320;
const WX = () => Math.floor((LW - 348) / 2);                 // the wide menus are 348 wide, centred
const hitAt = (hits, rx, ly) => hits.find(([, x, y, w, h]) => rx >= x && rx < x + w && ly >= y && ly < y + h);
function outline(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }
const THEME = { blue: ["#080e28", "#10163a", "#24305e", "#8c96c8"], red: ["#14050a", "#1e0a12", "#3c1020", "#c88c9c"], purple: ["#0c0820", "#141030", "#2a1e4a", "#a096c8"] };
function sideTab(th, x, y, w, h, label, on, accent, right) {
  const [, bg, bgOn, dim] = THEME[th];
  rect(on ? bgOn : bg, x, y, w, h); if (on) rect(accent, x, y, 2, h);
  const room = Math.floor((w - 10 - (right ? textW(right, 1) + 6 : 0)) / 6);
  text(label.length > room ? label.slice(0, room) : label, x + 6, y + (h >> 1), 1, on ? WHITE : dim, "left", null);
  if (right) text(right, x + w - 4, y + (h >> 1), 1, on ? accent : dim, "right", null);
}
function arrowBtn(x, y, w, h, dir, col) { box(x, y, w, h, col); text(dir < 0 ? "<" : ">", x + w / 2, y + (h >> 1), 1, col, "center", null); }
function fitDraw(img, name, cx, cy, maxw, maxh, kmax) {     // a sprite, scaled to fit a box, centred
  const a = DATA.atlas[name], k = Math.min(kmax || 1, maxw / a[2], maxh / a[3]), w = Math.max(1, Math.floor(a[2] * k)), h = Math.max(1, Math.floor(a[3] * k));
  g.drawImage(img, a[0], a[1], a[2], a[3], Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}
const closeLine = lab => text(lab || "TAP HERE TO CLOSE", LW / 2, 194, 1, WHITE, "center", null);

// ---- the coin shop: categories down the side, 30 items a page, and a try-on panel
const SHOP_WIDE_PER = 30;
function shopWideHits() {
  const x0 = WX(), items = CATS[S.shopCat][2], pages = Math.ceil(items.length / SHOP_WIDE_PER), page = Math.floor(S.shopSel / SHOP_WIDE_PER), h = [];
  CATS.forEach((c, i) => h.push(["cat", x0, 22 + i * 16, 86, 14, i]));
  for (let k = 0; k < SHOP_WIDE_PER && page * SHOP_WIDE_PER + k < items.length; k++) h.push(["item", x0 + 92 + (k % 6) * 23, 34 + Math.floor(k / 6) * 20, 22, 19, page * SHOP_WIDE_PER + k]);
  if (pages > 1) { h.push(["page", x0 + 112, 138, 18, 13, -1]); h.push(["page", x0 + 190, 138, 18, 13, 1]); }
  h.push(["act", x0 + 234, 140, 114, 18, 0]);
  return h;
}
function shopTapWide(rx, ly) {
  const hit = hitAt(shopWideHits(), rx, ly);
  if (!hit) { if (ly > 186) closeOverlay(); return; }
  const [id, , , , , v] = hit, n = CATS[S.shopCat][2].length, pages = Math.ceil(n / SHOP_WIDE_PER), page = Math.floor(S.shopSel / SHOP_WIDE_PER);
  if (id === "cat") { if (v !== S.shopCat) { S.shopCat = v; S.shopSel = 0; play("tick"); } }
  else if (id === "item") { if (v === S.shopSel) shopAct(); else { S.shopSel = v; play("tick"); } }
  else if (id === "page") { S.shopSel = ((page + v + pages) % pages) * SHOP_WIDE_PER; play("tick"); }
  else shopAct();
}
function drawShopWide() {
  rect("#080e28", 0, 0, LW, LH);
  const x0 = WX(), [cname, kind, items] = CATS[S.shopCat], pages = Math.ceil(items.length / SHOP_WIDE_PER), page = Math.floor(S.shopSel / SHOP_WIDE_PER);
  text("THE SHOP", x0, 8, 1, GOLD, "left", null);
  text(store.coins + " COINS", x0 + 348, 8, 1, GOLD, "right", null);
  for (const [id, x, y, w, h, v] of shopWideHits()) {
    if (id === "cat") sideTab("blue", x, y, w, h, CATS[v][0], v === S.shopCat, ORANGE);
    else if (id === "item") {
      const [owned, worn] = shopState(S.shopCat, v);
      rect(owned ? "#1e285a" : "#141a36", x, y, w, h); outline(x, y, w, h, v === S.shopSel ? WHITE : worn ? GOLD : INK);
      shopPreview(kind, v, x, y, owned);
    } else if (id === "page") arrowBtn(x, y, w, h, v, CYAN);
  }
  const ownedN = items.filter((it, i) => shopState(S.shopCat, i)[0]).length;
  text(cname, x0 + 92, 26, 1, WHITE, "left", null);
  text(ownedN + "/" + items.length, x0 + 229, 26, 1, GREY, "right", null);
  if (pages > 1) text((page + 1) + "/" + pages, x0 + 160, 144, 1, WHITE, "center", null);
  const i = Math.min(S.shopSel, items.length - 1), [owned, worn] = shopState(S.shopCat, i), cost = items[i][1];
  const px = x0 + 234, pw = 114, top = 22;                   // the try-on panel: you, on your boat, wearing what you've picked
  rect("#5aa0e6", px, top, pw, 46); rect("#2a6ab4", px, top + 46, pw, 26); for (let x = px; x < px + pw; x += 4) rect("#c8ecff", x + Math.floor(T * 3) % 4, top + 46, 2, 1);
  g.save(); g.beginPath(); g.rect(px, top, pw, 72); g.clip();
  if (kind === "title") text(owned || shopTitle(i)[2] ? items[i][0] : "???", px + pw / 2, top + 30, 1, owned ? "#c8a0ff" : GREY, "center");
  else if (["char", "hat", "boat", "pet", "flag"].includes(kind)) { const eq = Object.assign({}, store.eq, { [kind]: i, mon: 0, mhat: 0, mpet: 0 }); g.translate(px + pw / 2, top + 46); g.scale(2, 2); angler(-24, 1, eq, 0); }
  else { g.translate(px + pw / 2 - 33, top + 8); g.scale(3, 3); shopPreview(kind, i, 0, 0, true); }
  g.restore();
  outline(px, top, pw, 72, ORANGE);
  if (kind === "title") {
    text(owned ? "EARNED" : "LOCKED", px + pw / 2, 104, 1, owned ? LIME : GREY, "center", null);
    wrap(owned ? "SHOWS BY YOUR NAME" : shopTitle(i)[2] || "A SECRET", 19).slice(0, 2).forEach((l, k) => text(l, px + pw / 2, 118 + k * 10, 1, "#8c96c8", "center", null));
  } else {
    text(items[i][0], px + pw / 2, 104, 1, WHITE, "center", null);
    text(worn ? "WEARING" : owned ? "OWNED" : cost + " COINS", px + pw / 2, 118, 1, worn ? GOLD : owned ? LIME : GOLD, "center", null);
  }
  const lab = worn ? "WEARING" : owned ? (kind === "title" ? "USE TITLE" : "PUT ON") : kind === "title" ? "LOCKED" : store.coins >= cost ? "BUY" : "NEED " + (cost - store.coins) + " MORE";
  const bc = worn || (!owned && (kind === "title" || store.coins < cost)) ? GREY : owned ? CYAN : GOLD;
  box(px, 140, pw, 18, bc); text(lab, px + pw / 2, 149, 1, bc, "center", null);
  text("TAP AGAIN TO BUY", px + pw / 2, 166, 1, "#5a6496", "center", null);
  closeLine();
}

// ---- the fish log: zones down the side with how many you've caught, the zone's fish, and a big look at the one picked
function logWideHits() {
  const x0 = WX(), h = [];
  ZORD.forEach((z, i) => h.push(["zone", x0, 22 + i * 15, 124, 13, z]));   // by depth, so the Coral Reef sits under the Kelp Forest
  LOGGED.filter(q => q[2] === S.logPage).forEach((q, i) => h.push(["fish", x0 + 128 + (i % 4) * 28, 22 + Math.floor(i / 4) * 20, 27, 19, i]));
  return h;
}
function drawLogWide() {
  rect("#080e28", 0, 0, LW, LH);
  const x0 = WX(), page = LOGGED.filter(q => q[2] === S.logPage);
  text("FISH LOG", x0, 8, 1, GOLD, "left", null);
  text("CAUGHT " + LOGGED.filter(q => store.log[q[0]]).length + "/" + LOGGED.length, x0 + 348, 8, 1, WHITE, "right", null);
  for (const [id, x, y, w, h, v] of logWideHits()) {
    if (id === "zone") { const zf = LOGGED.filter(q => q[2] === v), got = zf.filter(q => store.log[q[0]]).length; sideTab("blue", x, y, w, h, ZONES[v][0], v === S.logPage, got === zf.length ? GOLD : CYAN, got + "/" + zf.length); }
    else { const q = page[v], e = store.log[q[0]]; rect(e ? ZONE_COL[q[2]] : "#141a36", x, y, w, h); outline(x, y, w, h, v === S.logSel ? WHITE : q[7] && e ? GOLD : INK); fitDraw(e ? atlas : sil, q[0], x + 14, y + 10, 23, 15); if (e && e.star) text("*", x + 22, y + 5, 1, GOLD, "center", null); }
  }
  const q = page[Math.min(S.logSel, page.length - 1)], e = store.log[q[0]], px = x0 + 244, pw = 104;
  rect(e ? ZONE_COL[q[2]] : "#141a36", px, 22, pw, 70); outline(px, 22, pw, 70, q[7] && e ? GOLD : CYAN);
  fitDraw(e ? atlas : sil, q[0], px + pw / 2, 57, 94, 60, 3);
  const lines = e ? [[nameOf(q[0]), tav().names && tav().names[q[0]] ? "#ff8cd2" : q[7] ? GOLD : WHITE], ["CAUGHT X" + e.n, CYAN], ["BEST " + e.rec + " LB", CYAN],
    [q[7] ? "! LEGENDARY !" : e.star ? "* TROPHY CAUGHT" : "NO TROPHY YET", q[7] ? LEGEND : e.star ? TROPHY : GREY]]
    : [["???", GREY], [q[7] ? "LEGENDARY" : "NOT CAUGHT YET", GREY]];
  lines.push([q[6] ? "COMES OUT AT " + q[6] : ZONES[q[2]][0], "#5a6496"]);
  lines.forEach(([l, c], k) => text(l, px + pw / 2, 102 + k * 11, 1, c, "center", null));
  text("TROPHIES " + Object.values(store.log).filter(v => v.star).length + "/" + LOGGED.filter(r => !r[7] && r[4] > 0).length, px + pw / 2, 172, 1, GOLD, "center", null);
  closeLine();
}
function logTapWide(rx, ly) {
  const hit = hitAt(logWideHits(), rx, ly);
  if (!hit) { if (ly > 186) closeOverlay(); return; }
  if (hit[0] === "zone") { if (hit[5] !== S.logPage) { S.logPage = hit[5]; S.logSel = 0; play("tick"); } }
  else { S.logSel = hit[5]; play("tick"); }
}

// ---- the Bestiary: the same, for the Flipside, with the rewards as an eleventh tab
const B_WIDE_PER = 10;
function bestiaryWideHits() {
  const x0 = WX(), h = [], rew = S.bPage >= FLIP_Z.length;
  FLIP_Z.forEach((z, i) => h.push(["zone", x0, 22 + i * 15, 124, 13, i]));
  h.push(["zone", x0, 22 + FLIP_Z.length * 15, 124, 13, FLIP_Z.length]);
  if (!rew) BESTIARY.filter(q => q[2] === S.bPage).forEach((q, i) => h.push(["fish", x0 + 128 + (i % 4) * 28, 22 + Math.floor(i / 4) * 20, 27, 19, i]));
  else {
    const r = S.bRew || 0, page = Math.floor(r / B_WIDE_PER), pages = Math.ceil(FLIP_REWARDS.length / B_WIDE_PER);
    FLIP_REWARDS.slice(page * B_WIDE_PER, page * B_WIDE_PER + B_WIDE_PER).forEach((rw, k) => h.push(["rew", x0 + 128, 22 + k * 14, 112, 13, page * B_WIDE_PER + k]));
    if (pages > 1) { h.push(["rpage", x0 + 128, 165, 18, 13, -1]); h.push(["rpage", x0 + 222, 165, 18, 13, 1]); }
    h.push(["ract", x0 + 244, 150, 104, 16, 0]);
  }
  return h;
}
function drawBestiaryWide() {
  rect("#14050a", 0, 0, LW, LH);
  const x0 = WX(), PINK = "#ff8ca0", rew = S.bPage >= FLIP_Z.length, px = x0 + 244, pw = 104;
  text("BESTIARY", x0, 8, 1, PINK, "left", null);
  text("CAUGHT " + BESTIARY.filter(q => store.flip.log[q[0]]).length + "/" + BESTIARY.length, x0 + 348, 8, 1, WHITE, "right", null);
  const page = rew ? [] : BESTIARY.filter(q => q[2] === S.bPage);
  for (const [id, x, y, w, h, v] of bestiaryWideHits()) {
    if (id === "zone") {
      if (v < FLIP_Z.length) { const zf = BESTIARY.filter(q => q[2] === v), got = zf.filter(q => store.flip.log[q[0]]).length; sideTab("red", x, y, w, h, FLIP_Z[v][0], v === S.bPage, got === zf.length ? GOLD : PINK, got + "/" + zf.length); }
      else sideTab("red", x, y, w, h, "REWARDS", rew, GOLD, FLIP_REWARDS.filter(r => r[3]()).length + "/" + FLIP_REWARDS.length);
    } else if (id === "fish") { const q = page[v], e = store.flip.log[q[0]]; rect(e ? "#4a1424" : "#1e0a12", x, y, w, h); outline(x, y, w, h, v === S.bSel ? WHITE : q[6] && e ? GOLD : INK); fitDraw(e ? atlas : sil, "fc_" + q[0], x + 14, y + 10, 23, 15); if (e && e.star) text("*", x + 22, y + 5, 1, GOLD, "center", null); }
    else if (id === "rew") { const r = FLIP_REWARDS[v], ok = r[3](), sel = v === (S.bRew || 0); rect(sel ? "#3c1020" : "#1e0a12", x, y, w, h); if (sel) outline(x, y, w, h, PINK); text(r[1].slice(0, 17), x + 3, y + 6, 1, !ok ? GREY : flipRewardWorn(r[4]) ? GOLD : WHITE, "left", null); if (ok) text("+", x + w - 3, y + 6, 1, LIME, "right", null); }
    else if (id === "rpage") arrowBtn(x, y, w, h, v, PINK);
  }
  if (!rew) {
    const q = page[Math.min(S.bSel, page.length - 1)], e = store.flip.log[q[0]];
    rect(e ? "#4a1424" : "#1e0a12", px, 22, pw, 70); outline(px, 22, pw, 70, q[6] && e ? GOLD : PINK);
    fitDraw(e ? atlas : sil, "fc_" + q[0], px + pw / 2, 57, 94, 60, 3);
    const lines = e ? [[q[1], q[6] ? GOLD : WHITE], ["CAUGHT X" + e.n, PINK], ["BEST " + e.rec + " LB", PINK], [q[6] ? "! LEGENDARY !" : e.star ? "* TROPHY CAUGHT" : "NO TROPHY YET", q[6] ? LEGEND : e.star ? TROPHY : GREY]]
      : [["???", GREY], [q[6] ? "LEGENDARY" : "NOT CAUGHT YET", GREY]];
    lines.forEach(([l, c], k) => text(l, px + pw / 2, 102 + k * 11, 1, c, "center", null));
    text("TROPHIES " + BESTIARY.filter(r => !r[6] && (store.flip.log[r[0]] || {}).star).length + "/" + BESTIARY.filter(r => !r[6]).length, px + pw / 2, 162, 1, GOLD, "center", null);
    text("WON " + store.flip.wins + "/" + store.flip.runs + " BEST " + store.flip.best, px + pw / 2, 173, 1, PINK, "center", null);
  } else {
    const r = FLIP_REWARDS[Math.min(S.bRew || 0, FLIP_REWARDS.length - 1)], ok = r[3](), on = ok && flipRewardWorn(r[4]);
    text("MONSTERS " + store.flip.mons.length + "/" + DATA.chars.length, px + pw / 2, 26, 1, PINK, "center", null);
    rect("#1e0a12", px, 36, pw, 70); outline(px, 36, pw, 70, PINK);
    text(r[1], px + pw / 2, 46, 1, ok ? GOLD : GREY, "center", null);
    wrap(r[2], 16).slice(0, 4).forEach((l, k) => text(l, px + pw / 2, 62 + k * 10, 1, "#f0d2dc", "center", null));
    text(ok ? "EARNED" : "NOT YET", px + pw / 2, 120, 1, ok ? LIME : GREY, "center", null);
    if (ok) { box(px, 150, pw, 16, on ? CYAN : GOLD); text(on ? "TAKE OFF" : "PUT ON", px + pw / 2, 158, 1, on ? CYAN : GOLD, "center", null); }
    const pages = Math.ceil(FLIP_REWARDS.length / B_WIDE_PER);
    if (pages > 1) text((Math.floor((S.bRew || 0) / B_WIDE_PER) + 1) + "/" + pages, x0 + 184, 171, 1, WHITE, "center", null);
  }
  closeLine();
}
function bestiaryTapWide(rx, ly) {
  const hit = hitAt(bestiaryWideHits(), rx, ly);
  if (!hit) { if (ly > 186) closeOverlay(); return; }
  const [id, , , , , v] = hit, pages = Math.ceil(FLIP_REWARDS.length / B_WIDE_PER);
  if (id === "zone") { if (v !== S.bPage) { S.bPage = v; S.bSel = 0; play("tick"); } }
  else if (id === "fish") { S.bSel = v; play("tick"); }
  else if (id === "rew") { if (v === (S.bRew || 0)) flipRewardToggle(FLIP_REWARDS[v]); else { S.bRew = v; play("tick"); } }
  else if (id === "rpage") { S.bRew = ((Math.floor((S.bRew || 0) / B_WIDE_PER) + v + pages) % pages) * B_WIDE_PER; play("tick"); }
  else if (id === "ract" && FLIP_REWARDS[S.bRew || 0][3]()) flipRewardToggle(FLIP_REWARDS[S.bRew || 0]);
}

// ---- secrets: a long list on the left, the selected one and its reward on the right
const SEC_WIDE_PER = 11;
function secretsWideHits() {
  const x0 = WX(), n = store.sec.found.length, pages = Math.max(1, Math.ceil(n / SEC_WIDE_PER)), page = Math.floor(S.secSel / SEC_WIDE_PER), h = [];
  store.sec.found.slice(page * SEC_WIDE_PER, page * SEC_WIDE_PER + SEC_WIDE_PER).forEach((id, k) => h.push(["sec", x0, 22 + k * 14, 226, 13, page * SEC_WIDE_PER + k]));
  if (pages > 1) { h.push(["page", x0 + 150, 2, 16, 13, -1]); h.push(["page", x0 + 210, 2, 16, 13, 1]); }
  h.push(["bottles", x0 + 232, 22, 116, 14, 0]);
  const sc = SECRETS.find(q => q[0] === store.sec.found[S.secSel]);
  if (sc && sc[3]) h.push(["act", x0 + 232, 150, 116, 16, 0]);
  return h;
}
function drawSecretsWide() {
  rect("#0c0820", 0, 0, LW, LH);
  const x0 = WX(), P = "#c8a0ff", n = store.sec.found.length, pages = Math.max(1, Math.ceil(n / SEC_WIDE_PER)), nb = store.sec.bottles.length, px = x0 + 232, pw = 116;
  text("SECRETS", x0, 8, 1, P, "left", null);
  if (pages > 1) text((Math.floor(S.secSel / SEC_WIDE_PER) + 1) + "/" + pages, x0 + 188, 8, 1, WHITE, "center", null);
  for (const [id, x, y, w, h, v] of secretsWideHits()) {
    if (id === "sec") { const sc = SECRETS.find(q => q[0] === store.sec.found[v]), sel = v === S.secSel; rect(sel ? "#2a1e4a" : "#141030", x, y, w, h); if (sel) outline(x, y, w, h, P); text(sc[1], x + 4, y + 6, 1, sc[3] && rewardWorn(sc[3]) ? GOLD : WHITE, "left", null); if (sc[3]) text(rewardWorn(sc[3]) ? "ON" : "+", x + w - 4, y + 6, 1, rewardWorn(sc[3]) ? GOLD : LIME, "right", null); }
    else if (id === "page") arrowBtn(x, y, w, h, v, P);
    else if (id === "bottles") { box(x, y, w, h, nb ? "#b4f0dc" : "#3c4264"); text(nb ? "READ BOTTLES: " + nb : "NO BOTTLES YET", x + w / 2, y + 7, 1, nb ? "#b4f0dc" : GREY, "center", null); }
  }
  const sc = SECRETS.find(q => q[0] === store.sec.found[S.secSel]);
  if (sc) {
    rect("#141030", px, 42, pw, 76); outline(px, 42, pw, 76, P);
    text(sc[1].slice(0, 18), px + pw / 2, 51, 1, P, "center", null);
    wrap(sc[2], 18).slice(0, 5).forEach((l, k) => text(l, px + pw / 2, 66 + k * 10, 1, "#dcd2f0", "center", null));
    if (sc[3]) {
      text("REWARD", px + pw / 2, 128, 1, "#7a6ea0", "center", null);
      text(rewardName(sc[3]), px + pw / 2, 139, 1, GOLD, "center", null);
      const on = rewardWorn(sc[3]);
      box(px, 150, pw, 16, on ? CYAN : GOLD); text(on ? "TAKE OFF" : "PUT ON", px + pw / 2, 158, 1, on ? CYAN : GOLD, "center", null);
    }
  }
  closeLine();
}
function secretsTapWide(rx, ly) {
  const hit = hitAt(secretsWideHits(), rx, ly), n = store.sec.found.length, pages = Math.max(1, Math.ceil(n / SEC_WIDE_PER));
  if (!hit) { if (ly > 186) closeOverlay(); return; }
  const [id, , , , , v] = hit;
  if (id === "sec") { if (v === S.secSel) secretAct(); else { S.secSel = v; play("tick"); } }
  else if (id === "page") { S.secSel = Math.min(n - 1, ((Math.floor(S.secSel / SEC_WIDE_PER) + v + pages) % pages) * SEC_WIDE_PER); play("tick"); }
  else if (id === "bottles") { if (store.sec.bottles.length) { S.overlay = "note"; S.noteIdx = store.sec.bottles.length - 1; S.noteBack = "secrets"; play("select"); } }
  else secretAct();
}

// ---- tasks: today and this week side by side, with progress bars
function drawTasksWide() {
  rect("#080e28", 0, 0, LW, LH);
  const x0 = WX(), T_ = tasks();
  text("TASKS", x0, 8, 1, LIME, "left", null);
  text(store.coins + " COINS", x0 + 348, 8, 1, GOLD, "right", null);
  const col = (lab, list, x) => {
    text(lab, x + 85, 28, 1, GREY, "center", null);
    list.forEach((q, i) => {
      const y = 38 + i * 40, c = q.done ? LIME : "#5a6496";
      box(x, y, 170, 34, c);
      text(taskText(q), x + 6, y + 8, 1, q.done ? LIME : WHITE, "left", null);
      rect("#1a2048", x + 6, y + 17, 110, 5); rect(q.done ? LIME : CYAN, x + 6, y + 17, Math.round(110 * Math.min(1, q.p / q.n)), 5);
      text(q.done ? "DONE" : q.p + "/" + q.n, x + 122, y + 19, 1, q.done ? LIME : CYAN, "left", null);
      text("+" + q.r + " COINS", x + 164, y + 28, 1, GOLD, "right", null);
    });
  };
  col("TODAY", T_.d, x0); col("THIS WEEK", T_.w, x0 + 178);
  closeLine();
}

// ---- scores: today and all time side by side, titles shown, and the selected catch along the bottom
function scoresWideHits() {
  const x0 = WX(), fb = S.board && store.sec.beat, h = [];
  if (store.sec.beat) { h.push(["board", x0 + 110, 2, 14, 13, -1]); h.push(["board", x0 + 224, 2, 14, 13, 1]); }
  [0, 1].forEach(tab => { const rows = (fb ? (tab === 0 ? LB.ftoday : LB.fall) : (tab === 0 ? LB.today : LB.all)) || []; rows.forEach((r, i) => h.push(["row", x0 + tab * 178, 37 + i * 11, 170, 11, tab * 100 + i])); });
  return h;
}
function drawScoresWide() {
  rect("#080e28", 0, 0, LW, LH);
  const x0 = WX(), fb = S.board && store.sec.beat, PINK = "#ff8ca0";
  text(fb ? "FLIPSIDE" : "HIGH SCORES", x0 + 174, 8, 1, fb ? PINK : GOLD, "center", null);
  text("YOUR BEST " + (fb ? store.flip.best : store.best), x0 + 348, 8, 1, CYAN, "right", null);
  if (!LB.url) { ["THE SHARED BOARD IS NOT SET UP YET.", "SEE README.MD"].forEach((l, i) => text(l, LW / 2, 90 + i * 12, 1, GREY, "center", null)); closeLine(); return; }
  [0, 1].forEach(tab => {
    const x = x0 + tab * 178, rows = (fb ? (tab === 0 ? LB.ftoday : LB.fall) : (tab === 0 ? LB.today : LB.all)) || [];
    text(tab ? "ALL TIME" : "TODAY", x + 85, 26, 1, CYAN, "center", null); rect("#24305e", x, 31, 170, 1);
    if (!rows.length && !LB.status) text(tab ? "NO SCORES YET" : "NO CATCHES YET TODAY", x + 85, 60, 1, GREY, "center", null);
  });
  for (const [id, x, y, w, h, v] of scoresWideHits()) {
    if (id === "board") { arrowBtn(x, y, w, h, v, PINK); continue; }
    const tab = Math.floor(v / 100), i = v % 100, rows = (fb ? (tab === 0 ? LB.ftoday : LB.fall) : (tab === 0 ? LB.today : LB.all)), r = rows[i];
    const sel = S.tab === tab && S.scoreSel === i, col = sel ? WHITE : i === 0 ? GOLD : r.n === store.name ? CYAN : "#c8d2f0";
    if (sel) rect("#1e285a", x, y, w, h);
    text(i + 1, x + 14, y + 6, 1, i < 3 ? GOLD : GREY, "right", null);
    text(r.n, x + 20, y + 6, 1, col, "left", null);
    if (r.m) { const mx = x + 20 + textW(r.n, 1) + 2; rect(PINK, mx, y + 4, 3, 3); rect(INK, mx + 1, y + 5, 1, 1); }
    if (r.ti) text(String(r.ti).slice(0, 14), x + 44, y + 6, 1, "#7a6ea0", "left", null);
    text(r.s, x + w - 2, y + 6, 1, col, "right", null);
  }
  if (LB.status) text(LB.status, LW / 2, 60, 1, ORANGE, "center", null);
  if (LB.note) text(LB.note, LW / 2, 18, 1, ORANGE, "center", null);
  const rows = (fb ? (S.tab === 0 ? LB.ftoday : LB.fall) : (S.tab === 0 ? LB.today : LB.all)) || [], r = rows[S.scoreSel], hh = r && (fb ? unpackFlipHaul(r.h) : unpackHaul(r.h));
  box(x0, 152, 348, 34, fb ? PINK : CYAN);
  if (!r) text(rows.length ? "PICK A SCORE TO SEE THE CATCH" : "", LW / 2, 169, 1, GREY, "center", null);
  else if (!hh) text("NO CATCH DETAILS", LW / 2, 169, 1, GREY, "center", null);
  else {
    hh.fish.forEach((f, i) => {
      const sp = fb ? FSPEC[f[0]] : SPEC[f[0]], leg = fb ? sp[6] : sp[7], x = x0 + 6 + i * 114;
      text((leg ? "!" : f[2] ? "*" : "") + sp[1].slice(0, 17), x, 159, 1, !fb && HIDDEN.includes(f[0]) ? "#c8a0ff" : leg ? LEGEND : f[2] ? TROPHY : WHITE, "left", null);
      text(f[1] + " LB", x, 169, 1, GREY, "left", null);
    });
    text(r.n + "  " + r.s + "  X" + hh.mult + (!fb && hh.bottom ? " +FLOOR" : ""), x0 + 6, 179, 1, LIME, "left", null);
    if (r.ti) text(String(r.ti), x0 + 342, 179, 1, "#c8a0ff", "right", null);
  }
  closeLine();
}
function scoresTapWide(rx, ly) {
  const hit = hitAt(scoresWideHits(), rx, ly);
  if (!hit) { if (ly > 186) closeOverlay(); return; }
  if (hit[0] === "board") { S.board = S.board ? 0 : 1; S.scoreSel = -1; play("tick"); }
  else { S.tab = Math.floor(hit[5] / 100); S.scoreSel = hit[5] % 100; play("tick"); }
}

// ---- how to play: the pages down the side, the page itself in a wide panel
function helpWideHits() { const x0 = WX(); return HELP.map((p, i) => ["page", x0, 22 + i * 18, 112, 15, i]); }
function drawHelpWide() {
  rect("#080e28", 0, 0, LW, LH);
  const x0 = WX(), [head, lines] = HELP[S.helpPage], cx = x0 + 120 + 114;
  text("HOW TO PLAY", x0, 8, 1, GOLD, "left", null);
  for (const [, x, y, w, h, v] of helpWideHits()) sideTab("blue", x, y, w, h, HELP[v][0], v === S.helpPage, CYAN);
  rect("#10163a", x0 + 120, 22, 228, 160); outline(x0 + 120, 22, 228, 160, "#24305e");
  text(head, cx, 38, 2, CYAN);
  lines.forEach((l, i) => text(l, cx, 58 + i * 10, 1, l.includes("+") || l.includes("X3") ? GOLD : WHITE, "center", null));
  closeLine(S.helpPage < HELP.length - 1 ? "TAP FOR NEXT PAGE" : "TAP HERE TO PLAY");
}
function helpTapWide(rx, ly) {
  const hit = hitAt(helpWideHits(), rx, ly);
  if (hit) { S.helpPage = hit[5]; play("tick"); }
  else if (S.helpPage < HELP.length - 1) { S.helpPage++; play("tick"); }
  else closeOverlay();
}

const EXTRA_OV = {};                                         // overlays from later files: { draw(), tap(rx, ly) }, laid out for both widths themselves
const WIDE = {
  shop: { draw: drawShopWide, tap: shopTapWide, key: d => { S.shopCat = (S.shopCat + d + CATS.length) % CATS.length; S.shopSel = 0; play("tick"); } },
  log: { draw: drawLogWide, tap: logTapWide, key: d => { S.logPage = zoneStep(S.logPage, d); S.logSel = 0; play("tick"); } },
  bestiary: { draw: drawBestiaryWide, tap: bestiaryTapWide, key: d => { S.bPage = (Math.min(S.bPage, FLIP_Z.length) + d + FLIP_Z.length + 1) % (FLIP_Z.length + 1); S.bSel = 0; play("tick"); } },
  secrets: { draw: drawSecretsWide, tap: secretsTapWide, key: d => { const n = store.sec.found.length; if (n) { S.secSel = (S.secSel + d + n) % n; play("tick"); } } },
  tasks: { draw: drawTasksWide, tap: (rx, ly) => { if (ly > 186) closeOverlay(); }, key: () => {} },
  scores: { draw: drawScoresWide, tap: scoresTapWide, key: d => { S.tab = (S.tab + 1) % 2; S.scoreSel = -1; play("tick"); } },
  help: { draw: drawHelpWide, tap: helpTapWide, key: d => { S.helpPage = (S.helpPage + d + HELP.length) % HELP.length; play("tick"); } },
};

// ---- PC menus, part 2: the Rusty Hook. Same rules as part 1 (WIDE, ...Hits lists), tavern colours.
function chipsAt(x, y, align) { const s = fmtChips(tav().chips, 1e7) + " CHIPS", w = textW(s, 1) + 8, x0 = align === "right" ? x - w : align === "center" ? Math.round(x - w / 2) : x; chipIcon(x0 + 3, y); text(s, x0 + 8, y, 1, CHIP, "left", null); }
const tapWide = (hits, rx, ly, act, back) => { const h = hitAt(hits, rx, ly); if (h) act(h[0], h[5]); else if (ly > 186) (back || closeOverlay)(); };
const btn = (x, y, w, h, lab, col, sub, subCol) => { box(x, y, w, h, col); text(lab, x + w / 2, y + (sub ? 6 : h >> 1), 1, col, "center", null); if (sub) text(sub, x + w / 2, y + 15, 1, subCol || "#d8c8b0", "center", null); };

// the bar: the old man and his shelf on the left, everything you can do on the right
function tavernWideHits() {
  const rows = tavRows(), st = rows.length > 6 ? 20 : 22, x0 = WX(), h = rows.map(([lab, col, id], i) => [id, x0 + 186, 26 + i * st, 162, 18, i]);
  h.push(["board", x0 + 186, 26 + h.length * st, 162, 18, 0]);
  return h;
}
function drawTavernWide() {
  tavernBg();
  const x0 = WX(), cx = x0 + 86;
  text("THE RUSTY HOOK", cx, 10, 1, GOLD, "center");
  rect("#4a2e1c", cx - 40, 34, 80, 3);                                                       // the shelf
  ["#5ad2a0", "#c84a3c", "#ffd246", "#5a8cff", "#ff8cd2", "#c8a0ff"].forEach((c, i) => { rect(c, cx - 34 + i * 13, 24 + (i % 2) * 2, 4, 10 - (i % 2) * 2); rect(c, cx - 33 + i * 13, 21 + (i % 2) * 2, 2, 3); });
  bestCatches().forEach((sp, i) => {                                                         // the trophy wall
    const x = i ? cx + 44 : cx - 72, a = DATA.atlas[sp[0]], k = Math.min(1, 24 / a[2], 14 / a[3]), w = Math.floor(a[2] * k), hh = Math.floor(a[3] * k);
    rect("#5a3a22", x, 40, 28, 24); rect("#7a5232", x + 1, 41, 26, 22);
    g.drawImage(atlas, a[0], a[1], a[2], a[3], x + 14 - (w >> 1), 48 - (hh >> 1), w, hh);
    text(store.log[sp[0]].rec, x + 14, 58, 1, GOLD, "center", null);
  });
  spr("oldman", cx - 14, 40, false, 2);
  const bar = typeof decorBar === "function" ? decorBar(true) : null;
  rect(bar ? bar[0] : "#6a4428", x0, 72, 172, 10); rect(bar ? bar[1] : "#8a5c38", x0, 72, 172, 2);   // the bar
  if (typeof decorDraw === "function") decorDraw(true, x0);
  if (tav().carved) text(tav().carved + " WAS HERE", cx, 78, 1, "#3c2414", "center", null);
  rect("#1e120c", x0 + 4, 90, 164, 40); outline(x0 + 4, 90, 164, 40, "#5a3a22");
  wrap(TAV.say, 26).slice(0, 3).forEach((l, i, a) => text(l, cx, 110 - (a.length - 1) * 5 + i * 10, 1, WHITE, "center", null));
  text("DIVES " + store.dives + "   BEST WIN " + fmtChips(tav().stats.win, 1e6), cx, 142, 1, "#a08c70", "center", null);
  text("BIGGEST STACK " + fmtChips(tav().stats.stack, 1e6), cx, 153, 1, "#a08c70", "center", null);
  chipsAt(x0 + 348, 10, "right");
  const rows = tavRows();
  for (const [id, x, y, w, h, i] of tavernWideHits()) { if (id === "board") btn(x, y, w, h, "TAVERN BOARD", CYAN); else btn(x, y, w, h, rows[i][0], rows[i][1]); }
  closeLine("TAP HERE TO LEAVE");
}
function tavernTapWide(rx, ly) {
  tapWide(tavernWideHits(), rx, ly, id => {
    if (id === "board") { TAV.board = 0; BOARDS.forEach(([k]) => tavLoad(k)); openOverlay("tavboard"); }
    else if (id === "vip") { TAV.vipSay = "KEEP YOUR VOICE DOWN"; openOverlay("vip"); }
    else if (id === "c21") { if (!TAV.c21 || TAV.c21.vip) c21New(false); openOverlay("c21"); }
    else if (id === "derby") { if (!TAV.derby || TAV.derby.phase === "done" || TAV.derby.vip) derbyNew(false); openOverlay("derby"); }
    else if (id === "plinko") { plinkoOpen(); openOverlay("plinko"); }
    else if (id === "pit") pitOpen();
    else if (id === "shop") { TAV.shopSel = 0; openOverlay("chipshop"); }
    else if (typeof casinoOpen === "function" && casinoOpen(id)) { /* casino.js */ }
    else if (claimDaily()) { TAV.say = "DON'T SPEND IT ALL"; play("fanfare"); } else { TAV.say = "COME BACK TOMORROW"; play("miss"); }
  });
}

// the chip shop: a long list on the left, the picked thing on the right (cosmetics shown on you, like the coin shop)
const CSHOP_WIDE_PER = 11;
function chipShopWideHits() {
  const x0 = WX(), pages = Math.ceil(SHOP_ROWS.length / CSHOP_WIDE_PER), page = Math.floor(TAV.shopSel / CSHOP_WIDE_PER), h = [];
  SHOP_ROWS.slice(page * CSHOP_WIDE_PER, page * CSHOP_WIDE_PER + CSHOP_WIDE_PER).forEach((r, k) => h.push(["row", x0, 22 + k * 14, 220, 13, page * CSHOP_WIDE_PER + k]));
  if (pages > 1) { h.push(["page", x0 + 70, 2, 16, 13, -1]); h.push(["page", x0 + 134, 2, 16, 13, 1]); }
  h.push(["act", x0 + 228, 150, 120, 18, 0]);
  return h;
}
function drawChipShopWide() {
  tavernBg();
  const x0 = WX(), pages = Math.ceil(SHOP_ROWS.length / CSHOP_WIDE_PER), px = x0 + 228, pw = 120;
  text("BUY THINGS", x0, 8, 1, GOLD, "left", null);
  if (pages > 1) text((Math.floor(TAV.shopSel / CSHOP_WIDE_PER) + 1) + "/" + pages, x0 + 110, 8, 1, "#d8c8b0", "center", null);
  chipsAt(x0 + 348, 8, "right");
  for (const [id, x, y, w, h, v] of chipShopWideHits()) {
    if (id === "row") { const [lab, price] = shopRowState(v), sel = v === TAV.shopSel; rect(sel ? "#5a3a22" : "#24160e", x, y, w, h); if (sel) outline(x, y, w, h, GOLD); text(lab, x + 4, y + 6, 1, sel ? WHITE : "#d8c8b0", "left", null); if (price !== null) text(price, x + w - 4, y + 6, 1, CHIP, "right", null); }
    else if (id === "page") arrowBtn(x, y, w, h, v, GOLD);
  }
  const [lab, price, note] = shopRowState(TAV.shopSel), sid = SHOP_ROWS[TAV.shopSel][0], cm = TAV_COSM[sid];
  rect("#1e120c", px, 22, pw, 70); outline(px, 22, pw, 70, GOLD);
  g.save(); g.beginPath(); g.rect(px + 1, 23, pw - 2, 68); g.clip();
  if (cm && ["hat", "boat", "pet", "flag"].includes(cm[0])) { rect("#5aa0e6", px + 1, 23, pw - 2, 44); rect("#2a6ab4", px + 1, 67, pw - 2, 24); const eq = Object.assign({}, store.eq, { [cm[0]]: cm[1], mon: 0, mhat: 0, mpet: 0 }); g.translate(px + pw / 2, 67); g.scale(2, 2); angler(-24, 1, eq, 0); }
  else if (cm) { g.translate(px + pw / 2 - 33, 30); g.scale(3, 3); shopPreview(cm[0], cm[1], 0, 0, true); }
  else if (sid === "fish" && tav().fish) fitDraw(atlas, tav().fish.id, px + pw / 2, 57, 80, 40, 3);
  else if (sid === "scratch") fitDraw(atlas, "gboot", px + pw / 2, 57, 40, 40, 3);
  else if (["magnet", "rumour"].includes(sid) && price !== null) fitDraw(atlas, "bottle", px + pw / 2, 57, 40, 40, 3);
  else spr("oldman", px + pw / 2 - 14, 30, false, 2);
  g.restore();
  text(lab, px + pw / 2, 102, 1, WHITE, "center", null);
  wrap(note, 19).slice(0, 3).forEach((l, i) => text(l, px + pw / 2, 115 + i * 10, 1, "#e8dcc4", "center", null));
  const opens = (sid === "fish" && tav().fish) || (sid === "jukebox" && tav().jukebox) || ["locker", "dealer", "decor"].includes(sid);
  const act = opens ? "OPEN" : cm && price === null ? (store.eq[cm[0]] === cm[1] ? "TAKE OFF" : "PUT ON") : price === null ? (sid === "story" && tav().stories ? "READ" : "") : sid === "dream" ? "DREAM FOR " + price : (tav().chips >= price ? "BUY " : "NEEDS ") + price;
  if (act) btn(px, 150, pw, 18, act, price !== null && tav().chips < price ? GREY : CHIP);
  closeLine("TAP HERE TO GO BACK");
}
function chipShopTapWide(rx, ly) {
  const pages = Math.ceil(SHOP_ROWS.length / CSHOP_WIDE_PER), page = Math.floor(TAV.shopSel / CSHOP_WIDE_PER);
  tapWide(chipShopWideHits(), rx, ly, (id, v) => {
    if (id === "row") { if (v === TAV.shopSel) shopBuy(v); else { TAV.shopSel = v; play("tick"); } }
    else if (id === "page") { TAV.shopSel = ((page + v + pages) % pages) * CSHOP_WIDE_PER; play("tick"); }
    else shopBuy(TAV.shopSel);
  });
}

// the jukebox: every song in two columns
// SONGS has an empty slot at 11 (a stray comma long ago). Songs are saved by position, so it stays; menus skip it.
const SONG_IDS = SONGS.map((sg, i) => i).filter(i => SONGS[i]);
function jukeWideHits() { const x0 = WX(), half = Math.ceil(SONG_IDS.length / 2); return SONG_IDS.map((i, k) => ["song", x0 + (k < half ? 0 : 178), 24 + (k % half) * 15, 170, 13, i]); }
function drawJukeboxWide() {
  tavernBg();
  const x0 = WX(), P = "#ff8cd2";
  text("JUKEBOX", x0, 8, 1, P, "left", null);
  chipsAt(x0 + 348, 8, "right");
  for (const [, x, y, w, h, i] of jukeWideHits()) {
    const sg = SONGS[i], own = songOwned(i), on = tav().song === i, sel = i === TAV.songSel;
    rect(sel ? "#3a2440" : "#24160e", x, y, w, h); if (sel) outline(x, y, w, h, P);
    text(own || sg[1] ? sg[0] : "???", x + 4, y + 6, 1, on ? P : own ? WHITE : GREY, "left", null);
    text(on ? "ON" : own ? "" : sg[1] ? sg[1] : "", x + w - 4, y + 6, 1, on ? P : CHIP, "right", null);
  }
  const sg = SONGS[TAV.songSel], own = songOwned(TAV.songSel);
  text(own ? (tav().song === TAV.songSel ? "TAP AGAIN: MUSIC OFF" : "TAP AGAIN TO PLAY") : sg[1] ? "TAP AGAIN TO BUY: " + sg[1] + " CHIPS" : "EARNED: " + sg[2], LW / 2, 172, 1, own ? CHIP : sg[1] ? GOLD : GREY, "center", null);
  closeLine("TAP HERE TO GO BACK");
}
function jukeTapWide(rx, ly) {
  tapWide(jukeWideHits(), rx, ly, (id, i) => {
    if (i !== TAV.songSel) { TAV.songSel = i; play("tick"); return; }
    const sg = SONGS[i];
    if (songOwned(i)) { tav().song = tav().song === i ? -1 : i; saveStore(); }
    else if (sg[1] && tav().chips >= sg[1]) { addChips(-sg[1]); tav().songs.push(i); tav().song = i; saveStore(); play("fanfare"); }
    else play("miss");
  });
}

// your derby fish: it on the left, its training on the right
function myFishWideHits() { const x0 = WX(), f = tav().fish; return [0, 1, 2].filter(i => f.lv[i] < 10).map(i => ["train", x0 + 290, 40 + i * 34, 58, 18, i]); }
function drawMyFishWide() {
  tavernBg();
  const x0 = WX(), f = tav().fish, cx = x0 + 80;
  text("YOUR RACER", x0, 8, 1, CHIP, "left", null);
  chipsAt(x0 + 348, 8, "right");
  rect("#1e4a7a", x0, 26, 160, 80); for (let x = x0; x < x0 + 160; x += 6) rect("#3c6a9a", x + Math.floor(T * 4) % 6, 30 + (x % 18), 3, 1);
  outline(x0, 26, 160, 80, CHIP);
  fitDraw(atlas, f.id, cx, 66 + Math.round(Math.sin(T * 3) * 2), 120, 50, 3);
  text(f.name, cx, 118, 1, GOLD, "center", null);
  text(f.races + " RACES, " + f.wins + " WINS", cx, 130, 1, "#d8c8b0", "center", null);
  text(tav().stats.fast ? "KELP LAP " + (tav().stats.fast / 100).toFixed(2) + "S" : "RACES IN THE PIT", cx, 142, 1, GREY, "center", null);
  ["SPEED", "STAMINA", "BURST"].forEach((lab, i) => {
    const y = 40 + i * 34, lv = f.lv[i];
    text(lab, x0 + 172, y + 2, 1, WHITE, "left", null);
    for (let k = 0; k < 10; k++) rect(k < lv ? CHIP : "#3c2a1e", x0 + 172 + k * 11, y + 10, 9, 5);
    if (lv >= 10) text("MAX", x0 + 319, y + 9, 1, CHIP, "center", null);
  });
  for (const [, x, y, w, h] of myFishWideHits()) btn(x, y, w, h, "GYM", ORANGE);
  text("TRAIN FREE IN THE PIT", x0 + 260, 150, 1, "#a08c70", "center", null);
  closeLine("TAP HERE TO GO BACK");
}
function myFishTapWide(rx, ly) {
  tapWide(myFishWideHits(), rx, ly, () => pitOpen("train"));
}

// the tavern board: all three boards side by side
function drawTavBoardWide() {
  tavernBg();
  const x0 = WX(), st = tav().stats;
  text("TAVERN BOARD", LW / 2, 8, 1, GOLD, "center", null);
  BOARDS.forEach(([k, name], c) => {
    const x = x0 + c * 118, b = TAV.boards[k] || { rows: null, msg: "" };
    rect("#1e120c", x, 18, 112, 156); outline(x, 18, 112, 156, "#5a3a22");
    text(name, x + 56, 26, 1, CYAN, "center", null);
    if (b.msg) wrap(b.msg, 17).forEach((l, i) => text(l, x + 56, 50 + i * 10, 1, ORANGE, "center", null));
    (b.rows || []).forEach((r, i) => {
      const y = 40 + i * 11, col = i === 0 ? GOLD : r.n === store.name ? CYAN : "#d8c8b0";
      text(i + 1, x + 14, y, 1, i < 3 ? GOLD : GREY, "right", null); text(r.n, x + 20, y, 1, col, "left", null);
      text(k === "fast" ? fastS(r.s) : fmtChips(r.s, 1e6), x + 108, y, 1, col, "right", null);
    });
    if (b.rows && !b.rows.length) text("NOBODY YET", x + 56, 60, 1, GREY, "center", null);
    text("YOURS: " + (k === "fast" ? (st.fast ? (st.fast / 100).toFixed(2) + "S" : "-") : fmtChips(st[k], 1e7)), x + 56, 166, 1, CHIP, "center", null);
  });
  if (!store.name) text("SET INITIALS TO JOIN", LW / 2, 182, 1, GREY, "center", null);
  closeLine("TAP HERE TO GO BACK");
}

// ---- The bet screen (Nov 20, 2026): every bet explained before you take it, tick boxes for parlays. Shared helpers first.
function betFamRow(fams, x, y, w, yMax) {                   // little sprites of every fish that counts, shrunk to fit above yMax
  const ids = [].concat(...fams.map((f, n) => (n ? [null] : []).concat(FAMS[f]))).filter(id => id === null || DATA.atlas[id]);
  for (const h of [9, 7, 6, 5]) {
    let cx = x, cy = y, ok = true;
    const put = [];
    for (const id of ids) {
      if (id === null) { cx += 5; continue; }                // a gap between families
      const a = DATA.atlas[id], k = Math.min(1, h / a[3]), [sw, sh] = sprSize(id, k);
      if (cx + sw > x + w) { cx = x; cy += h + 2; }
      if (cy + h > yMax) { ok = false; break; }
      put.push([id, cx, cy + h - sh, k]); cx += sw + 2;
    }
    if (ok || h === 5) { put.forEach(([id, px, py, k]) => spr(id, px, py, false, k)); return cy + h; }
  }
  return y;
}
function betInfo(row) {                                     // -> {title, how, fam, fish, chance, rec, void}
  const b = TAV.bet, [k, lab, pays, , i] = row, line = betLine(), h = BET_HELP[k] || [BETS[i][2]];
  return { title: lab, pays, how: betText(h[0], line, b.w), fam: h[1], fish: k === "wanted" ? b.w : null,
    chance: chanceText(betChance(i, b.w)), rec: betRecordText(i), void: betVoidText(k, line) };
}
function betSlipLines() {                                   // -> [top line, bottom line, colour] for the slip
  const b = TAV.bet, s = betSlip(), blocked = s.legs.some(i => betBlocked(BETS[i][0]));
  if (s.dead) return [s.ticks.length + " BETS", "CAN'T ALL WIN", ORANGE];
  if (s.long) return ["TOO LONG A SHOT", "OVER X" + PARLAY_CAP, ORANGE];
  if (blocked) return ["WRONG LURE", "FOR THIS BET", ORANGE];
  return [s.parlay ? "PARLAY: " + s.legs.length + " BETS" : "SINGLE BET", "X" + s.pays + "  WIN " + fmtChips(Math.round(b.stake * s.pays)), s.parlay ? GOLD : "#a0c8b4"];
}
function parlayHint(wide) {                                 // why a parlay pays what it does
  const b = TAV.bet, s = betSlip();
  if (!s.parlay || s.dead || s.long) return wide ? "TICK 2-3 BOXES FOR A PARLAY" : "TAP AGAIN FOR INFO";
  const prod = s.ticks.reduce((a, t) => a * b.opts[t][2], 1);
  if (s.pays < 0.75 * prod) return wide ? "THESE OFTEN WIN TOGETHER" : "OFTEN WIN TOGETHER";
  if (s.pays > 1.3 * prod) return wide ? "THESE RARELY WIN TOGETHER" : "RARELY WIN TOGETHER";
  return wide ? "ALL MUST WIN, VOID = REFUND" : "ALL MUST WIN";
}
const betOK = () => { const b = TAV.bet, s = betSlip(); return tav().chips >= b.stake && b.stake >= 1 && !s.dead && !s.long && !s.legs.some(i => betBlocked(BETS[i][0])); };
function drawBetInfo(x, y, w, yBot, inf, wide) {           // the explanation: how to win, the fish, chance, record, stake back
  const n = wide ? 27 : 19;
  text("HOW TO WIN", x, y, 1, CYAN, "left", null);
  const tail = (inf.void ? (wide ? 3 : 4) : 2) * 10, lim = yBot - tail;
  let yy = y + 10;
  for (const l of wrap(inf.how, n)) { if (yy > lim - 4) break; text(l, x, yy, 1, "#c8e6d2", "left", null); yy += 9; }
  if (inf.fam) yy = betFamRow(inf.fam, x, yy - 3, w, lim - 2) + 4;
  if (inf.fish) { const a = DATA.atlas[inf.fish], k = a[3] * 2 <= lim - yy - 2 && a[2] * 2 <= w ? 2 : 1; spr(inf.fish, x + w / 2 - a[2] * k / 2, yy - 2, false, k); }
  let ty = yBot - tail + 6;
  const row = (l, v) => { text(l, x, ty, 1, CYAN, "left", null); text(v, x + w, ty, 1, WHITE, "right", null); ty += 10; };
  row("CHANCE", wide ? inf.chance : inf.chance.replace("ABOUT ", "")); row(wide ? inf.rec[0] : "YOURS", inf.rec[1]);
  if (inf.void && wide) row("STAKE BACK IF", inf.void);
  else if (inf.void) { text("STAKE BACK IF", x, ty, 1, CYAN, "left", null); text(inf.void, x + w, ty + 10, 1, WHITE, "right", null); }
}
const tickBox = (x, y, on) => { box(x, y, 9, 9, on ? GOLD : "#2a4a3c"); if (on) text("X", x + 5, y + 5, 1, GOLD, "center", null); };
const BET_TIER_COL = { SAFER: "#5a8a74", MEDIUM: "#8a9a6a", WANTED: GOLD, "LONG SHOT": ORANGE };

function drawBet() {                                         // phones: the list, or one bet's card
  rect("#08140f", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const b = TAV.bet;
  if (b.card) {
    const inf = betInfo(b.opts[b.sel]);
    text(inf.title, 60, 8, 1, GOLD, "center", null); text("PAYS X" + inf.pays, 60, 19, 1, GOLD, "center", null);
    drawBetInfo(4, 33, 112, 152, inf, false);
    box(20, 158, 80, 16, GOLD); text("BACK TO BETS", 60, 166, 1, GOLD, "center", null);
    g.restore(); return;
  }
  text("BET ON YOUR DIVE", 60, 8, 1, CHIP, "center", null);
  chipsLine(20);
  b.opts.forEach(([k, lab, pays], i) => {
    const y = 29 + i * 17, sel = i === b.sel, off = betBlocked(k), fish = k === "wanted" ? b.w : null;
    box(4, y, 112, 15, sel ? CHIP : "#2a4a3c");
    const on = b.ticks.includes(i); box(6, y + 4, 7, 7, on ? GOLD : "#2a4a3c"); if (on) rect(GOLD, 8, y + 6, 3, 3);   // the parlay tick
    const pl = fish ? (lab.length <= 11 ? lab : "WANTED") : lab, pc = off ? "#4a5a50" : sel ? WHITE : "#a0c8b4";
    const pt = 15 + textW(pl, 1) + 4 + textW("X" + pays, 1) > 113 ? String(pays) : "X" + pays;   // no room: drop the X
    text(pl, 15, y + 7, 1, fish ? GOLD : pc, "left", null);
    if (fish) { const a = DATA.atlas[fish], k2 = Math.min(1, 9 / a[3]), x = 15 + textW(pl, 1) + 3; if (x + a[2] * k2 < 112 - textW(pt, 1) - 2) spr(fish, x, y + 3, false, k2); }
    text(pt, 113, y + 7, 1, off ? "#4a5a50" : sel ? GOLD : "#8a9a6a", "right", null);
  });
  text(b.ticks.length >= 2 ? parlayHint(false) : "TAP AGAIN FOR INFO", 60, 120, 1, "#5a8a74", "center", null);
  box(14, 126, 16, 15, CHIP); text("-", 22, 133, 1, CHIP, "center", null);
  text(fmtChips(b.stake), 60, 133, b.stake < 1000 ? 2 : 1, WHITE, "center");
  box(74, 126, 16, 15, CHIP); text("+", 82, 133, 1, CHIP, "center", null);
  box(94, 126, 22, 15, CHIP); text("MAX", 105, 133, 1, CHIP, "center", null);
  const [l1, l2, col] = betSlipLines(), s = betSlip();
  text(s.parlay || col === ORANGE ? (col === ORANGE ? l2 : "PARLAY " + l2) : l2, 60, 148, 1, col === ORANGE ? ORANGE : s.parlay ? GOLD : GREY, "center", null);
  const ok = betOK();
  box(20, 156, 80, 16, ok ? GOLD : "#3c4a40"); text(ok ? "PLACE BET" : col === ORANGE ? l1 : "NOT ENOUGH CHIPS", 60, 164, 1, ok ? GOLD : GREY, "center", null);
  const v = s.legs.map(i => betVoidText(BETS[i][0], betLine())).find(x => x && x.startsWith("HAUL"));
  if (v) text("UNDER " + Math.ceil(JUNK_K * betLine()) + " LB: REFUND", 60, 180, 1, "#5a8a74", "center", null);   // a thrown dive voids this bet
  text("TAP HERE FOR NO BET", 60, 192, 1, WHITE, "center", null);
  g.restore();
}
function betTapNarrow(lx, ly) {
  const b = TAV.bet;
  if (b.card) { if ((ly >= 154 && ly < 176) || ly > 184) { b.card = false; play("back"); } return; }
  const i = Math.floor((ly - 29) / 17);
  if (ly >= 29 && ly < 29 + b.opts.length * 17 && i < b.opts.length) {
    if (lx < 15) betTick(i);
    else if (i === b.sel) { b.card = true; play("select"); }
    else { b.sel = i; play("tick"); }
  }
  else if (ly >= 124 && ly < 143) { b.stake = stakeStep(b.stake, lx >= 93 ? STAKE_MAX : lx < 31 ? -1 : lx < 74 ? STAKE_TYPE : 1); play("tick"); }
  else if (ly >= 154 && ly < 174) placeBet();
  else if (ly > 184) { S.overlay = null; play("back"); }
}

// PC: the five bets on the left, the selected bet explained on the right, the slip along the bottom
function betWideHits() {
  const x0 = WX(), b = TAV.bet, h = [];
  b.opts.forEach((o, i) => h.push(["tick", x0, 18 + i * 25, 16, 23, i], ["opt", x0 + 16, 18 + i * 25, 148, 23, i]));
  h.push(["minus", x0, 160, 18, 18, -1], ["stakebox", x0 + 20, 160, 50, 18, STAKE_TYPE], ["plus", x0 + 72, 160, 18, 18, 1], ["max", x0 + 94, 160, 44, 18, STAKE_MAX], ["place", x0 + 270, 160, 78, 18, 0]);
  return h;
}
function drawBetWide() {
  rect("#08140f", 0, 0, LW, LH);
  const x0 = WX(), b = TAV.bet;
  text("BET ON YOUR DIVE", x0, 8, 1, CHIP, "left", null);
  chipsAt(x0 + 348, 8, "right");
  b.opts.forEach(([k, lab, pays, , , tier], i) => {
    const y = 18 + i * 25, sel = i === b.sel, off = betBlocked(k), fish = k === "wanted" ? b.w : null;
    box(x0, y, 164, 23, sel ? CHIP : "#2a4a3c"); tickBox(x0 + 4, y + 7, b.ticks.includes(i));
    text(lab, x0 + 18, y + 7, 1, off ? "#4a5a50" : sel ? WHITE : "#a0c8b4", "left", null);
    if (fish) { const a = DATA.atlas[fish], k2 = Math.min(1, 10 / a[3]), x = x0 + 18 + textW(lab, 1) + 5; if (x + a[2] * k2 < x0 + 128) spr(fish, x, y + 2, false, k2); }
    text(off ? "WRONG LURE" : tier, x0 + 18, y + 16, 1, off ? "#4a5a50" : BET_TIER_COL[tier], "left", null);
    text("X" + pays, x0 + 158, y + 12, 1, off ? "#4a5a50" : sel ? GOLD : "#8a9a6a", "right", null);
  });
  text(parlayHint(true), x0 + 82, 148, 1, "#5a8a74", "center", null);
  const px = x0 + 172, pw = 176, inf = betInfo(b.opts[b.sel]);
  rect("#0c1e16", px, 18, pw, 129); outline(px, 18, pw, 129, "#2a4a3c");
  text(inf.title, px + 6, 26, 1, GOLD, "left", null); text("PAYS X" + inf.pays, px + pw - 6, 26, 1, GOLD, "right", null);
  drawBetInfo(px + 6, 39, pw - 12, 143, inf, true);
  const [l1, l2, col] = betSlipLines();
  for (const [id, x, y, w, h] of betWideHits()) {
    if (id === "minus" || id === "plus") btn(x, y, w, h, id === "minus" ? "-" : "+", CHIP);
    else if (id === "max") btn(x, y, w, h, "ALL IN", CHIP);
    else if (id === "stakebox") { outline(x, y, w, h, "#2a4a3c"); text(fmtChips(b.stake, 1e6), x + w / 2, y + 9, 1, WHITE, "center", null); }
    else if (id === "place") { const ok = betOK(); btn(x, y, w, h, ok ? "PLACE BET" : col === ORANGE ? "CAN'T PLACE" : "NOT ENOUGH", ok ? GOLD : GREY); }
  }
  text(l1, x0 + 204, 165, 1, col, "center", null); text(l2, x0 + 204, 174, 1, col === ORANGE ? ORANGE : GOLD, "center", null);
  closeLine("TAP HERE FOR NO BET");
}
function betTapWide(rx, ly) {
  const b = TAV.bet;
  tapWide(betWideHits(), rx, ly, (id, v) => {
    if (id === "tick") betTick(v);
    else if (id === "opt") { b.sel = v; play("tick"); }
    else if (id === "place") placeBet();
    else { b.stake = stakeStep(b.stake, v); play("tick"); }
  }, () => { S.overlay = null; play("back"); });
}

// Catch 21: a wide felt table, the rules beside it
function c21WideHits() {
  const x0 = WX(), c = TAV.c21;
  if (c.phase === "play") return [["hit", x0, 134, 70, 20, 0], ["stand", x0 + 76, 134, 70, 20, 0], ["double", x0 + 152, 134, 70, 20, 0]];
  if (c.phase === "stake") return [["minus", x0, 134, 24, 20, -1], ["plus", x0 + 92, 134, 24, 20, 1], ["max", x0 + 122, 134, 44, 20, STAKE_MAX], ["deal", x0 + 172, 134, 50, 20, 0], ["stakebox", x0 + 26, 134, 64, 20, STAKE_TYPE]];
  return [];
}
function drawC21Wide() {
  rect(FELT, 0, 0, LW, LH); rect("#5a3a22", 0, 0, LW, 3); rect("#5a3a22", 0, LH - 3, LW, 3);
  const x0 = WX(), c = TAV.c21, px = x0 + 236;
  text(c.vip ? "VIP CATCH 21" : "CATCH 21", x0, 10, 1, GOLD, "left", null);
  chipsAt(x0 + 348, 10, "right");
  const hand = (lab, cards, y, hide, sumCol) => {
    text(lab, x0, y, 1, "#c8e6d2", "left", null);
    if (cards.length) text(hide ? "?" : c21Sum(cards), x0 + 222, y, 1, sumCol, "right", null);
    cards.slice(0, 8).forEach((q, i) => fishCard(x0 + i * Math.min(26, 200 / Math.max(1, cards.length - 1)), y + 6, q, hide && i === 1));
  };
  hand("THE OLD MAN", c.dealer, 24, c.hide, WHITE);
  box(x0, 64, 222, 15, c.win > 0 ? GOLD : CHIP); text(c.msg, x0 + 111, 71, 1, c.win > 0 ? GOLD : WHITE, "center", null);
  hand("YOU", c.you, 88, false, GOLD);
  for (const [id, x, y, w, h] of c21WideHits()) {
    if (id === "minus" || id === "plus") btn(x, y, w, h, id === "minus" ? "-" : "+", CHIP);
    else if (id === "deal") btn(x, y, w, h, "DEAL", GOLD);
    else if (id === "max") btn(x, y, w, h, "MAX", CHIP);
    else if (id === "stakebox") outline(x, y, w, h, "#2a4a3c");
    else { const ok = id !== "double" || (c.you.length === 2 && tav().chips >= c.staked); btn(x, y, w, h, id.toUpperCase(), ok ? WHITE : "#3c6a54"); }
  }
  if (c.phase === "stake") text(fmtChips(c.bet, 1e6), x0 + 58, 144, 1, WHITE, "center", null);
  else if (c.phase !== "play") text("...", x0 + 111, 144, 1, WHITE, "center", null);
  rect("#0a3a24", px, 24, 112, 110); outline(px, 24, 112, 110, "#2a6a4a");
  text("HOUSE RULES", px + 56, 33, 1, GOLD, "center", null);
  ["TROPHIES COUNT X2", c.vip ? "LEGENDS PAY 2:1" : "LEGENDS WIN NOW", "HE STOPS AT 17", c.vip ? "TIES PUSH" : "TIES GO TO YOU", "NATURAL PAYS 3:2", "NO BET LIMIT"].forEach((l, i) => text(l, px + 56, 50 + i * 13, 1, i === 1 && c.vip ? GOLD : "#8cc8a8", "center", null));
  text("HANDS WON " + tav().stats.hands, px + 56, 148, 1, "#5a8a74", "center", null);
  closeLine(c.phase === "play" || c.phase === "dealer" ? "" : "TAP HERE TO LEAVE");
}
function c21TapWide(rx, ly) {
  const c = TAV.c21;
  tapWide(c21WideHits(), rx, ly, (id, v) => {
    if (id === "hit") c21Hit(false); else if (id === "stand") c21Stand(); else if (id === "double") c21Hit(true);
    else if (id === "deal") c21Deal(); else { c.bet = stakeStep(c.bet, v, c.max); play("tick"); }
  }, () => { if (c.phase !== "play" && c.phase !== "dealer") closeOverlay(); });
}


// the scratch card, bigger, with the prize list beside it
function scratchWideHits() {
  const x0 = WX(), sc = TAV.scratch, h = sc.cells.map((k, i) => ["cell", x0 + 30 + (i % 3) * 38, 26 + Math.floor(i / 3) * 38, 36, 36, i]);
  h.push(sc.paid ? ["again", x0 + 30, 146, 112, 18, 0] : ["all", x0 + 30, 146, 112, 18, 0]);
  return h;
}
function drawScratchWide() {
  tavernBg();
  const x0 = WX(), sc = TAV.scratch, px = x0 + 196;
  text("SCRATCH CARD", x0, 8, 1, GOLD, "left", null);
  chipsAt(x0 + 348, 8, "right");
  rect("#d8c8a0", x0 + 26, 22, 120, 120);
  for (const [id, x, y, w, h, v] of scratchWideHits()) {
    if (id === "cell") {
      if (!sc.open[v]) { rect("#9aa0b4", x, y, w, h); rect("#b8bed0", x + 2, y + 2, w - 4, 3); text("?", x + w / 2, y + h / 2, 1, "#6a7088", "center", null); continue; }
      const k = sc.cells[v], sy = sc.syms[k];
      rect(sc.paid && k === sc.win ? "#fff0b4" : "#efe4c8", x, y, w, h);
      fitDraw(atlas, sy[0], x + w / 2, y + 15, 30, 22, 2);
      if (sy[1]) text("X" + sy[1], x + w / 2, y + 30, 1, "#5a3a22", "center", null);
    } else if (id === "all") btn(x, y, w, h, "SCRATCH ALL", CHIP);
    else { const price = SHOP_ROWS.find(r => r[0] === "scratch")[2]; btn(x, y, w, h, "ANOTHER: " + price, tav().chips >= price ? GOLD : GREY); }
  }
  if (sc.paid) text(sc.msg, x0 + 86, 176, 1, sc.win >= 0 ? GOLD : GREY, "center", null);
  else text("TAP THE SQUARES", x0 + 86, 176, 1, "#d8c8b0", "center", null);
  rect("#1e120c", px, 22, 152, 140); outline(px, 22, 152, 140, "#5a3a22");
  text("THREE ALIKE WINS", px + 76, 32, 1, GOLD, "center", null);
  SCRATCH.filter(q => q[1] && DATA.atlas[q[0]]).forEach((q, i) => { const y = 50 + i * 22; fitDraw(atlas, q[0], px + 22, y, 26, 16, 1); text("X" + q[1], px + 50, y, 1, WHITE, "left", null); text("+" + 5 * q[1], px + 144, y, 1, CHIP, "right", null); });
  closeLine("TAP HERE TO GO BACK");
}
function scratchTapWide(rx, ly) {
  const sc = TAV.scratch;
  tapWide(scratchWideHits(), rx, ly, (id, v) => {
    if (id === "again") { const [, price] = shopRowState(SHOP_ROWS.findIndex(r => r[0] === "scratch")); if (tav().chips >= price) { addChips(-price); scratchNew(); } else play("miss"); return; }
    if (sc.paid) return;
    if (id === "cell") { sc.open[v] = true; play("tick"); } else { sc.open = sc.open.map(() => true); play("tick"); }
    if (sc.open.every(o => o)) {
      sc.paid = true;
      if (sc.win >= 0) { const pay = 5 * sc.syms[sc.win][1]; addChips(pay, "win"); if (sc.syms[sc.win][1] >= 100) tavAward("jackpot"); sc.msg = "WIN " + pay + " CHIPS!"; play("fanfare"); } else { sc.msg = "NO LUCK"; play("miss"); }
      saveStore();
    }
  }, () => { S.overlay = "chipshop"; play("back"); });
}

// the back room
function vipWideHits() { const x0 = WX(); return ["c21", "derby", "rename"].map((id, i) => [id, x0 + 186, 30 + i * 40, 162, 32, i]); }
function drawVipWide() {
  velvetBg();
  const x0 = WX(), cx = x0 + 86;
  text("THE BACK ROOM", cx, 10, 1, GOLD, "center");
  spr("oldman", cx - 14, 30, false, 2);
  rect("#2a0a10", x0, 62, 172, 5);
  rect("#1e060a", x0 + 4, 80, 164, 30); outline(x0 + 4, 80, 164, 30, "#c8a03c");
  wrap(TAV.vipSay || "", 26).slice(0, 2).forEach((l, i, a) => text(l, cx, 95 - (a.length - 1) * 5 + i * 10, 1, WHITE, "center", null));
  chipsAt(x0 + 348, 10, "right");
  const L = [["VIP CATCH 21", GOLD, "BETTER ODDS"], ["VIP DERBY", GOLD, "7 RACERS, LONGER"], ["RENAME A FISH", "#ff8cd2", RENAME + " CHIPS"]];
  for (const [, x, y, w, h, i] of vipWideHits()) btn(x, y, w, h, L[i][0], L[i][1], L[i][2], "#d8b4b4");
  closeLine("TAP HERE TO GO BACK");
}
function vipTapWide(rx, ly) {
  tapWide(vipWideHits(), rx, ly, id => {
    if (id === "c21") { if (!TAV.c21 || !TAV.c21.vip) c21New(true); openOverlay("c21"); }
    else if (id === "derby") { if (!TAV.derby || TAV.derby.phase === "done" || !TAV.derby.vip) derbyNew(false, true); openOverlay("derby"); }
    else { TAV.renSel = 0; openOverlay("rename"); }
  }, () => { S.overlay = "tavern"; play("back"); });
}

// renaming: the fish you've caught in a long list, the picked one big on the right
const REN_WIDE_PER = 11;
function renameWideHits() {
  const x0 = WX(), list = renameList(), pages = Math.max(1, Math.ceil(list.length / REN_WIDE_PER)), page = Math.floor((TAV.renSel || 0) / REN_WIDE_PER), h = [];
  list.slice(page * REN_WIDE_PER, page * REN_WIDE_PER + REN_WIDE_PER).forEach((sp, k) => h.push(["fish", x0, 22 + k * 14, 214, 13, page * REN_WIDE_PER + k]));
  if (pages > 1) { h.push(["page", x0 + 100, 2, 16, 13, -1]); h.push(["page", x0 + 160, 2, 16, 13, 1]); }
  if (list.length) h.push(["act", x0 + 226, 150, 122, 18, 0]);
  return h;
}
function drawRenameWide() {
  velvetBg();
  const x0 = WX(), list = renameList(), sel = TAV.renSel || 0, px = x0 + 226, pw = 122, P = "#ff8cd2", pages = Math.max(1, Math.ceil(list.length / REN_WIDE_PER));
  text("RENAME A FISH", x0, 8, 1, P, "left", null);
  if (pages > 1) text((Math.floor(sel / REN_WIDE_PER) + 1) + "/" + pages, x0 + 138, 8, 1, WHITE, "center", null);
  chipsAt(x0 + 348, 8, "right");
  for (const [id, x, y, w, h, v] of renameWideHits()) {
    if (id === "fish") { const sp = list[v], own = tav().names && tav().names[sp[0]]; rect(v === sel ? "#6a1e2c" : "#2a0a10", x, y, w, h); text(nameOf(sp[0]).slice(0, 34), x + 4, y + 6, 1, own ? P : WHITE, "left", null); }
    else if (id === "page") arrowBtn(x, y, w, h, v, GOLD);
    else btn(x, y, w, h, tav().chips >= RENAME ? "RENAME: " + RENAME : "NEEDS " + RENAME, tav().chips >= RENAME ? CHIP : GREY);
  }
  if (!list.length) { text("CATCH SOMETHING FIRST", LW / 2, 80, 1, GREY, "center", null); closeLine("TAP HERE TO GO BACK"); return; }
  const sp = list[Math.min(sel, list.length - 1)];
  rect("#2a0a10", px, 22, pw, 70); outline(px, 22, pw, 70, "#c8a03c");
  fitDraw(atlas, sp[0], px + pw / 2, 57, 110, 60, 3);
  text(nameOf(sp[0]).slice(0, 20), px + pw / 2, 104, 1, tav().names && tav().names[sp[0]] ? P : WHITE, "center", null);
  if (tav().names && tav().names[sp[0]]) { text("REALLY:", px + pw / 2, 118, 1, GREY, "center", null); text(sp[1].slice(0, 20), px + pw / 2, 128, 1, GREY, "center", null); }
  closeLine("TAP HERE TO GO BACK");
}
function renameTapWide(rx, ly) {
  const list = renameList(), pages = Math.max(1, Math.ceil(list.length / REN_WIDE_PER)), page = Math.floor((TAV.renSel || 0) / REN_WIDE_PER);
  tapWide(renameWideHits(), rx, ly, (id, v) => {
    if (id === "fish") { if (v === TAV.renSel) renameFish(list[v][0]); else { TAV.renSel = v; play("tick"); } }
    else if (id === "page") { TAV.renSel = ((page + v + pages) % pages) * REN_WIDE_PER; play("tick"); }
    else renameFish(list[TAV.renSel || 0][0]);
  });
}

// the old man's stories and the bottle messages: wider paper, longer lines
function paperArrows(n) { const x0 = WX(); return n > 1 ? [["prev", x0, 2, 16, 13, -1], ["next", x0 + 332, 2, 16, 13, 1]] : []; }
function drawStoryWide() {
  tavernBg();
  const x0 = WX(), n = tav().stories;
  for (const [, x, y, w, h, v] of paperArrows(n)) arrowBtn(x, y, w, h, v, GOLD);
  text("STORY " + (TAV.story + 1) + (n > 1 ? " OF " + n : ""), LW / 2, 8, 1, GOLD, "center", null);
  spr("oldman", x0 + 26, 60, false, 2);
  rect("#1a100a", x0 + 84, 22, 264, 156); outline(x0 + 84, 22, 264, 156, "#5a3a22");
  const ls = wrap(STORIES[TAV.story] || "", 40);
  ls.forEach((l, i) => text(l, x0 + 216, 100 - ls.length * 5 + i * 10, 1, "#e8dcc4", "center", null));
  closeLine("TAP HERE TO GO BACK");
}
function storyTapWide(rx, ly) {
  const n = tav().stories;
  tapWide(paperArrows(n), rx, ly, (id, v) => { TAV.story = (TAV.story + v + n) % n; play("tick"); }, () => { S.overlay = "chipshop"; play("back"); });
}
function drawNoteWide() {
  rect("#06101c", 0, 0, LW, LH);
  const x0 = WX(), list = store.sec.bottles, id = list[S.noteIdx];
  for (const [, x, y, w, h, v] of paperArrows(list.length)) arrowBtn(x, y, w, h, v, "#b4f0dc");
  text("A MESSAGE IN A BOTTLE", LW / 2, 8, 1, "#b4f0dc", "center", null);
  if (list.length > 1) text((S.noteIdx + 1) + " OF " + list.length, LW / 2, 18, 1, "#5a8a8a", "center", null);
  fitDraw(atlas, "bottle", x0 + 40, 100, 40, 40, 4);
  rect("#ece0bc", x0 + 84, 28, 240, 140); rect("#d2c296", x0 + 84, 167, 240, 1); rect("#d2c296", x0 + 323, 28, 1, 140);
  if (id !== undefined) { const ls = wrap(BOTTLES[id][0], 34); ls.forEach((l, i) => text(l, x0 + 204, 98 - ls.length * 5 + i * 10, 1, "#3c2c1e", "center", null)); }
  closeLine();
}
function noteTapWide(rx, ly) {
  const n = store.sec.bottles.length, h = hitAt(paperArrows(n), rx, ly);
  if (h) { S.noteIdx = (S.noteIdx + h[5] + n) % n; play("tick"); } else closeOverlay();
}

// ---- PC menus, part 3: the main menu, the haul, the Flipside haul
// The main menu on a wide screen: the phone layout with room to breathe. Kade found a version with side panels and a card
// in the sky far too crowded (Nov 17, 2026), so the water to the sides stays empty: corners for coins and title, the bounty
// under the logo, one row of lures, CAST, the bet, and one row of menus (MORE still holds the rest).
const TITLE_WIDE_BAR = [["SCORES", CYAN, "scores"], ["LOG", GOLD, "log"], ["SHOP", ORANGE, "shop"], ["MORE", WHITE, "more"]];
function titleWideHits() {
  const cx = Math.floor(LW / 2), h = [];
  LURES.forEach((L, i) => h.push(["lure", cx - 72 + i * 38, 90, 30, 28, i]));
  h.push(["cast", cx - 50, 132, 100, 22, 0], ["bet", cx - 62, 159, 124, 13, 0]);
  TITLE_WIDE_BAR.forEach((m, i) => h.push(["menu", cx - 100 + i * 51, 180, 47, 14, i]));
  return h;
}
function titleWideAct(id, v) {
  if (id === "lure") { if (lureOK(v)) { S.lure = v; play("tick"); } else play("miss"); }
  else if (id === "cast") cast();
  else if (id === "bet") openBet();
  else { const m = TITLE_WIDE_BAR[v][2]; S.overlay = m; S.scoreSel = -1; if (m === "scores") LB.load(); play("select"); }
}
function drawTitleWide() {
  const t = T, cx = Math.floor(LW / 2), on = Math.floor(t * 2.5) % 2;
  disc(GOLD, 6, 6, 3); rect("#c89628", 5, 5, 2, 2); text(store.coins, 11, 6, 1, GOLD, "left");          // coins, top-left
  text(titleName(store.eq.title), LW - 92, 6, 1, "#c8a0ff", "right");                                   // your title, left of the full-screen button
  text("REEL", cx - 27, 22 + Math.floor(Math.sin(t * 2.5) * 1.5), 2, CYAN); text("DEEP", cx + 27, 22 + Math.floor(Math.sin(t * 2.5 + 1) * 1.5), 2, GOLD);
  const bs = "TODAY'S BOUNTY: " + SPEC[S.bounty][1] + " X" + C.BOUNTY_X, bw = textW(bs, 1) + 8, bx = cx - (bw >> 1);
  rect(INK, bx, 79, 5, 6); rect(GOLD, bx + 1, 80, 3, 4); rect(INK, bx + 2, 81, 1, 2); text(bs, bx + 8, 83, 1, GOLD, "left");
  const left = tasks().d.concat(tasks().w).filter(q => !q.done).length;
  for (const [id, x, y, w, h, v] of titleWideHits()) {
    if (id === "lure") {
      const Lu = LURES[v], sel = v === S.lure;
      rect(sel ? "#1e285a" : INK, x, y, w, h); outline(x, y, w, h, sel ? GOLD : "#5a6496");
      if (!lureOK(v)) g.globalAlpha = 0.3;                 // greyed out by the NO PULSES bet
      lureIcon(v, x + w / 2, y + 11);
      for (let k = 0; k < Lu[5]; k++) rect(CYAN, x + w / 2 - Lu[5] * 3 + k * 6 + 1, y + 22, 4, 3);
      g.globalAlpha = 1;
    } else if (id === "cast") { box(x, y, w, h, on ? WHITE : CYAN); text("CAST", x + w / 2, y + 11, 2, on ? WHITE : CYAN, "center"); }
    else if (id === "bet") {
      const b = tav().bet, bt = b && !b.cast ? betLabel(b) + ": " + fmtChips(b.stake) : "", bl = bt || "PLACE A BET", lx = x + w / 2 - (textW(bl, 1) >> 1) + 4;
      box(x, y, w, h, bt ? GOLD : CHIP); chipIcon(lx - 6, y + 6); text(bl, lx, y + 6, 1, bt ? GOLD : CHIP, "left", null);
    } else {
      btn(x, y, w, h, TITLE_WIDE_BAR[v][0], TITLE_WIDE_BAR[v][1]);
      if (TITLE_WIDE_BAR[v][2] === "more" && left) { rect(INK, x + w - 5, y - 5, 9, 9); rect(GOLD, x + w - 4, y - 4, 7, 7); text(left, x + w - 1, y - 1, 1, INK, "center", null); }
    }
  }
  text(LURES[S.lure][1], cx, 125, 1, GOLD, "center");
  S.popups.slice(-2).forEach((p, i) => { const tw = textW(p[0], 1); box(Math.floor(cx - tw / 2) - 4, 47 - i * 13, tw + 8, 11, p[2]); text(p[0], cx, 52 - i * 13, 1, p[2], "center", null); });
}
// the haul on a wide screen: a wider card, each fish with its picture and full name
function drawHaulWide(h, t) {
  g.save(); g.translate(-OX, 0);
  const x = Math.floor(LW / 2) - 114, w = 228;
  box(x, 82, w, 114, CYAN);
  text("THE HAUL", x + 8, 90, 1, CYAN, "left", null); text("DEEPEST " + (h.deep || 0) + " M", x + w - 6, 90, 1, "#8cc8dc", "right", null);
  const rows = h.rows.slice(0, h.shown);
  rows.forEach(([fid, lb, tag, tr], i) => {
    const y = 103 + i * 12;
    fitDraw(atlas, fid, x + 16, y, 22, 10, 1);
    text((SPEC[fid][7] ? "!" : tr ? "*" : "") + SPEC[fid][1], x + 32, y, 1, HIDDEN.includes(fid) ? "#c8a0ff" : SPEC[fid][7] ? LEGEND : tr ? TROPHY : WHITE, "left", null);
    if (tag) text(tag, x + 184, y, 1, tag[0] === "X" ? GOLD : tag === "NEW" ? LIME : tag === "???" ? "#c8a0ff" : "#ff8c32", "right", null);
    text(lb + " LB", x + w - 6, y, 1, WHITE, "right", null);
  });
  if (!h.rows.length) text("NOTHING BUT SEAWEED", x + w / 2, 112, 1, WHITE, "center", null);
  h.extra.slice(0, Math.max(0, h.shown - h.rows.length)).forEach(([txt, col], j) => text(txt, x + w / 2, 143 + j * 10, 1, col, "center", null));
  const done = h.shown >= h.n;
  rect(CYAN, x + 6, 166, w - 12, 1);
  text("TOTAL", x + 8, 177, 1, CYAN, "left", null); text("LB", x + w - 6, 179, 1, GOLD, "right", null);
  text(done ? h.total : rows.reduce((a, r) => a + r[1], 0), x + w - 22, 176, 2, GOLD, "right", null);
  if (done && S.stT > h.end) {
    if (h.record && h.total > 0) text("YOUR NEW BEST!", LW / 2, 74, 1, GOLD);
    if (Math.floor(t * 2.5) % 2) text("TAP TO CONTINUE", x + w / 2, 189, 1, WHITE, "center", null);
  }
  g.restore();
}
// the Flipside haul: your monster self big on the left, the catch on the right
function drawFHaulWide() {
  rect("#14050a", 0, 0, LW, LH);
  const x0 = WX(), h = S.fhaul, P = "#ff8ca0", px = x0 + 130, pw = 218;
  text("YOU CAUGHT YOURSELF", x0 + 60, 10, 1, P, "center", null);
  rect("#1e0a12", x0, 20, 120, 150); outline(x0, 20, 120, 150, P);
  g.save(); g.translate(x0 + 60, 120 + (Math.floor(T * 2) % 2)); g.scale(4, 4); const mc = "mchar" + store.eq.char, [cw, ch] = sprSize(mc); spr(mc, -cw / 2, -ch); g.restore();
  text("SEE YOU DOWN THERE", x0 + 60, 158, 1, "#c88c9c", "center", null);
  box(px, 20, pw, 168, P);
  text("THE FLIPSIDE HAUL", px + pw / 2, 28, 1, P, "center", null);
  h.rows.forEach(([id, lb, tr, isNew], i) => {
    const y = 42 + i * 12, sp = FSPEC[id];
    fitDraw(atlas, "fc_" + id, px + 14, y, 20, 10, 1);
    text((sp[6] ? "!" : tr ? "*" : "") + sp[1], px + 28, y, 1, id === DATA.flip.mythic ? "#ffd2f0" : sp[6] ? LEGEND : tr ? TROPHY : WHITE, "left", null);
    if (isNew) text("NEW", px + 176, y, 1, LIME, "right", null);
    text(lb + " LB", px + pw - 6, y, 1, WHITE, "right", null);
  });
  if (!h.rows.length) text("AN EMPTY HOOK", px + pw / 2, 52, 1, GREY, "center", null);
  if (h.sets.length) text(h.sets.map(s => s[1]).join(" + ").slice(0, 34) + " X" + h.mult, px + pw / 2, 84, 1, LIME, "center", null);
  h.news.slice(0, 5).forEach(([txt, col], j) => text(txt.slice(0, 34), px + pw / 2, 98 + j * 10, 1, col, "center", null));
  rect(P, px + 6, 152, pw - 12, 1);
  text("SCORE", px + 8, 163, 1, P, "left", null); text(h.total, px + pw - 6, 162, 2, GOLD, "right", null);
  if (h.record && h.total > 0) text("YOUR FLIPSIDE BEST!", px + pw / 2, 178, 1, GOLD, "center", null);
  if (Math.floor(T * 2.5) % 2) text("TAP TO CONTINUE", LW / 2, 194, 1, WHITE, "center", null);
}
WIDE.fhaul = { draw: drawFHaulWide, tap: () => closeOverlay(), key: () => {} };
Object.assign(WIDE, {
  tavern: { draw: drawTavernWide, tap: tavernTapWide, key: () => {} },
  chipshop: { draw: drawChipShopWide, tap: chipShopTapWide, key: d => { TAV.shopSel = (TAV.shopSel + d + SHOP_ROWS.length) % SHOP_ROWS.length; play("tick"); } },
  jukebox: { draw: drawJukeboxWide, tap: jukeTapWide, key: d => { const k = SONG_IDS.indexOf(TAV.songSel); TAV.songSel = SONG_IDS[(Math.max(0, k) + d + SONG_IDS.length) % SONG_IDS.length]; play("tick"); } },
  myfish: { draw: drawMyFishWide, tap: myFishTapWide, key: () => {} },
  tavboard: { draw: drawTavBoardWide, tap: (rx, ly) => { if (ly > 186) closeOverlay(); }, key: () => {} },
  bet: { draw: drawBetWide, tap: betTapWide, key: d => { TAV.bet.stake = stakeStep(TAV.bet.stake, d); play("tick"); } },
  c21: { draw: drawC21Wide, tap: c21TapWide, key: d => { const c = TAV.c21; if (c.phase === "stake") { c.bet = stakeStep(c.bet, d, c.max); play("tick"); } } },
  scratch: { draw: drawScratchWide, tap: scratchTapWide, key: () => {} },
  vip: { draw: drawVipWide, tap: vipTapWide, key: () => {} },
  rename: { draw: drawRenameWide, tap: renameTapWide, key: d => { const n = renameList().length; if (n) { TAV.renSel = ((TAV.renSel || 0) + d + n) % n; play("tick"); } } },
  story: { draw: drawStoryWide, tap: storyTapWide, key: d => { const n = tav().stories; if (n > 1) { TAV.story = (TAV.story + d + n) % n; play("tick"); } } },
  note: { draw: drawNoteWide, tap: noteTapWide, key: d => { const n = store.sec.bottles.length; if (n > 1) { S.noteIdx = (S.noteIdx + d + n) % n; play("tick"); } } },
});

function drawShop() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const [cname, kind, items] = CATS[S.shopCat], pages = Math.ceil(items.length / PER_PAGE), page = Math.floor(S.shopSel / PER_PAGE);
  box(2, 2, 16, 13, ORANGE); text("<", 10, 8, 1, ORANGE, "center", null);
  box(102, 2, 16, 13, ORANGE); text(">", 110, 8, 1, ORANGE, "center", null);
  text(cname, 60, 8, 1, GOLD, "center", null);
  const ownedN = items.filter((it, i) => shopState(S.shopCat, i)[0]).length;
  text(store.coins + " COINS", 4, 21, 1, GOLD, "left", null);
  text(ownedN + "/" + items.length, 116, 21, 1, GREY, "right", null);
  for (let k = 0; k < PER_PAGE; k++) {
    const i = page * PER_PAGE + k;
    if (i >= items.length) break;
    const x = 2 + (k % 5) * 23, y = 27 + Math.floor(k / 5) * 20, [owned, worn] = shopState(S.shopCat, i);
    rect(owned ? "#1e285a" : "#141a36", x, y, 22, 19);
    g.fillStyle = i === S.shopSel ? WHITE : worn ? GOLD : INK; g.fillRect(x, y, 22, 1); g.fillRect(x, y + 18, 22, 1); g.fillRect(x, y, 1, 19); g.fillRect(x + 21, y, 1, 19);
    shopPreview(kind, i, x, y, owned);
  }
  if (pages > 1) {
    box(28, 108, 16, 11, CYAN); text("<", 36, 113, 1, CYAN, "center", null);
    text((page + 1) + "/" + pages, 60, 113, 1, WHITE, "center", null);
    box(76, 108, 16, 11, CYAN); text(">", 84, 113, 1, CYAN, "center", null);
  }
  const i = Math.min(S.shopSel, items.length - 1), [owned, worn] = shopState(S.shopCat, i), cost = items[i][1];
  box(2, 122, 116, 28, ORANGE);
  if (kind === "title") {
    text(owned || shopTitle(i)[2] ? items[i][0] : "???", 60, 129, 1, owned ? "#c8a0ff" : GREY, "center", null);
    text(owned ? "EARNED" : shopTitle(i)[2] || "A SECRET", 60, 141, 1, owned ? LIME : GREY, "center", null);
  } else {
    text(items[i][0], 60, 129, 1, WHITE, "center", null);
    text(owned ? "OWNED" : cost + " COINS", 60, 141, 1, owned ? LIME : GOLD, "center", null);
  }
  const lab = worn ? "WEARING" : owned ? (kind === "title" ? "USE TITLE" : "PUT ON") : kind === "title" ? "LOCKED" : store.coins >= cost ? "BUY" : "NEED " + (cost - store.coins) + " MORE";
  const bc = worn || (!owned && (kind === "title" || store.coins < cost)) ? GREY : owned ? CYAN : GOLD;
  box(18, 154, 84, 15, bc); text(lab, 60, 162, 1, bc, "center", null);
  text("TAP HERE TO CLOSE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}

function drawTasks() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const T_ = tasks();
  text("TASKS", 60, 9, 1, LIME, "center", null);
  const row = (q, y) => {
    box(4, y - 7, 112, 21, q.done ? LIME : "#5a6496");
    text(taskText(q), 8, y, 1, q.done ? LIME : WHITE, "left", null);
    text(q.done ? "DONE" : q.p + "/" + q.n, 8, y + 9, 1, q.done ? LIME : CYAN, "left", null);
    text("+" + q.r, 112, y + 9, 1, GOLD, "right", null);
  };
  text("TODAY", 60, 22, 1, GREY, "center", null);
  T_.d.forEach((q, i) => row(q, 36 + i * 23));
  text("THIS WEEK", 60, 107, 1, GREY, "center", null);
  T_.w.forEach((q, i) => row(q, 121 + i * 23));
  text(store.coins + " COINS", 60, 174, 1, GOLD, "center", null);
  text("TAP HERE TO CLOSE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}

const HELP = [
  ["THE DIVE", ["PICK A LURE, THEN", "CAST.", "", "STEER: DRAG, OR", "A / D / ARROWS.", "", "EVERY FISH YOU", "TOUCH IS HOOKED.", "THE HOOK HOLDS 3.", "", "A JELLYFISH ENDS", "THE DIVE."]],
  ["YOUR TOOLS", ["PULSE (SHIFT)", "SCATTERS NEARBY", "FISH. LURES GIVE", "1 TO 3 PULSES.", "", "ANGLER: LETS YOUR", "LAST FISH GO, 2X", "", "GLOW: MORE BIG", "FISH, BUT PULLS", "EVERYTHING IN", "", "SONAR: 3 PULSES"]],
  ["BIG FISH", ["TROPHY: A HUGE FISH", "WITH RED SPARKLES.", "", "LEGENDARY: A GOLD", "AURA AND STARS.", "", "BOTH FIGHT. TAP", "(SPACE) ON GREEN", "BEFORE TIME RUNS", "OUT.", "ONE LEGENDARY", "PER HOOK."]],
  ["THE SEA FLOOR", ["REACH THE FLOOR", "FOR +40 LB.", "", "IF YOUR HOOK ISN'T", "FULL, YOU RISE", "SLOWLY AND CAN", "KEEP FISHING", "UNTIL IT IS."]],
  ["TIME FISH", ["SOME FISH ONLY", "COME OUT AT ONE", "TIME OF DAY:", ""].concat(...["MORNING", "DAY", "DUSK", "NIGHT"].map(td => [td + ":", (SPECIES.find(q => q[6] === td) || ["", "-"])[1]]))],
  ["THE RAFT", ["AFTER 50 DIVES A", "SHIPWRIGHT WAITS", "ON THE PIER.", "", "PLANKS DRIFT IN", "THE SEA. TOUCH", "ONE TO TAKE IT.", "", "60 PLANKS, A ROPE,", "A SAIL AND A", "COMPASS BUILD A", "RAFT. TAP HIM."]],
  ["SCORING", ["POUNDS, TIMES YOUR", "SET BONUSES. THEY", "ADD TOGETHER:", "", "A PAIR        +0.5", "3 ZONES         +1", "3 TROPHIES      +1", "3 FROM THE DEEP +1", "3 OF A KIND     +2", "", "BOUNTY FISH: X3", "COINS BUY LOOKS."]],
];
function drawHelp() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const [head, lines] = HELP[S.helpPage];
  box(2, 2, 16, 13, WHITE); text("<", 10, 8, 1, WHITE, "center", null);
  box(102, 2, 16, 13, WHITE); text(">", 110, 8, 1, WHITE, "center", null);
  text("HOW TO PLAY", 60, 8, 1, GOLD, "center", null);
  text(head, 60, 28, 2, CYAN);
  lines.forEach((l, i) => text(l, 60, 48 + i * 10, 1, l.includes("+") || l.includes("X3") ? GOLD : WHITE, "center", null));
  for (let q = 0; q < HELP.length; q++) rect(q === S.helpPage ? GOLD : "#3c4264", 60 - HELP.length * 4 + q * 8, 178, 5, 3);
  text(S.helpPage < HELP.length - 1 ? "TAP FOR NEXT PAGE" : "TAP HERE TO PLAY", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
// ---------------------------------------------------------------- save codes
// The whole save, packed small: "RD1." + deflated JSON in base64 + "." + a checksum. Stored in the database under
// a random 8-character code (write-once, readable only by its exact code), or handed over whole without a database.
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const b64 = bytes => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function squash(bytes, how) {
  const cs = new (how === "in" ? CompressionStream : DecompressionStream)("deflate-raw");
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());
}
async function packSave() {
  const json = JSON.stringify(store), sum = hashStr(json).toString(36);
  if (typeof CompressionStream === "undefined") return "RD0." + b64(new TextEncoder().encode(json)) + "." + sum;
  return "RD1." + b64(await squash(new TextEncoder().encode(json), "in")) + "." + sum;
}
async function unpackSave(txt) {                           // -> a save object, or throws if it isn't a real, undamaged save
  const [tag, body, sum] = txt.trim().split(".");
  if (!["RD0", "RD1"].includes(tag) || !body || !sum) throw new Error("bad");
  const bytes = tag === "RD1" ? await squash(unb64(body), "out") : unb64(body), json = new TextDecoder().decode(bytes);
  if (hashStr(json).toString(36) !== sum) throw new Error("bad");
  const d = JSON.parse(json);
  if (!d || typeof d.log !== "object" || typeof d.coins !== "number" || typeof d.own !== "object" || typeof d.eq !== "object") throw new Error("bad");
  return d;
}
const saveModal = document.getElementById("saveModal"), saveOut = document.getElementById("saveOut"), saveIn = document.getElementById("saveIn"), saveNote = document.getElementById("saveNote");
let pendingLoad = null;
function openSave() { saveOut.style.display = "none"; saveIn.value = ""; saveNote.textContent = ""; pendingLoad = null; document.getElementById("saveLoad").textContent = "LOAD"; saveModal.classList.add("open"); }
function showCode(txt, long) { saveOut.value = txt; saveOut.className = long ? "long" : ""; saveOut.style.display = "block"; saveOut.focus(); saveOut.select(); }
async function makeCode() {
  saveNote.textContent = "PACKING...";
  const packed = await packSave();
  if (LB.url) {
    for (let tries = 0; tries < 3; tries++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => CODE_ABC[b & 31]).join("");
      try {
        const r = await fetch(LB.url + "/saves/" + code + ".json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(packed) });
        if (r.ok) { showCode(code.slice(0, 4) + "-" + code.slice(4), false); saveNote.textContent = "WRITE IT DOWN. IT LOADS YOUR PROGRESS AS IT IS RIGHT NOW."; return; }
        if (r.status !== 401 && r.status !== 403) break;
      } catch (e) { break; }
    }
  }
  showCode(packed, true);                                  // no shared database (or it said no): the code holds the whole save
  saveNote.textContent = LB.url ? "THE SAVE LIST ISN'T SET UP, SO HERE IS A LONG CODE. COPY ALL OF IT." : "COPY ALL OF THIS LONG CODE.";
}
async function loadCode() {
  if (pendingLoad) { try { localStorage.setItem("reeldeep", JSON.stringify(pendingLoad)); } catch (e) { saveNote.textContent = "THIS BROWSER WON'T SAVE (PRIVATE WINDOW?)"; return; } location.reload(); return; }
  const raw = saveIn.value.trim(), short = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  saveNote.textContent = "CHECKING...";
  try {
    let packed = raw;
    if (short.length === 8 && !raw.includes(".")) {
      if (!LB.url) throw new Error("none");
      const r = await fetch(LB.url + "/saves/" + short + ".json");
      packed = r.ok ? await r.json() : null;
      if (typeof packed !== "string") { saveNote.textContent = "NO SAVE WITH THAT CODE."; return; }
    }
    const d = await unpackSave(packed);
    pendingLoad = d;
    saveNote.textContent = "FOUND: " + d.coins + " COINS, " + Object.keys(d.log).length + " FISH LOGGED. THIS REPLACES THE PROGRESS IN THIS BROWSER.";
    document.getElementById("saveLoad").textContent = "YES, REPLACE IT";
  } catch (e) { saveNote.textContent = e.message === "none" ? "SHORT CODES NEED THE SHARED DATABASE." : "THAT CODE DIDN'T WORK. CHECK IT AND TRY AGAIN."; }
}
document.getElementById("saveMake").addEventListener("click", makeCode);
document.getElementById("saveLoad").addEventListener("click", loadCode);
document.getElementById("saveClose").addEventListener("click", () => saveModal.classList.remove("open"));
saveIn.addEventListener("input", () => { pendingLoad = null; document.getElementById("saveLoad").textContent = "LOAD"; });
saveIn.addEventListener("keydown", e => { if (e.key === "Enter") loadCode(); e.stopPropagation(); });
saveOut.addEventListener("keydown", e => e.stopPropagation());

// -------------------------------------------------------------------- input
const modal = document.getElementById("nameModal"), nameInput = document.getElementById("nameInput");
let nameDone = null;
function askName(cb) { nameDone = cb || null; nameInput.value = store.name || ""; modal.classList.add("open"); setTimeout(() => nameInput.focus(), 30); }
function closeName(ok) {
  modal.classList.remove("open");
  const n = nameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (ok && n) { store.name = n; saveStore(); }
  if (nameDone) nameDone(ok && n ? n : null);
  nameDone = null;
}
document.getElementById("nameOk").addEventListener("click", () => closeName(true));
// Type a bet (Nov 19, 2026): tap the stake on any betting screen. The amount goes to whichever game is open; the game's own
// phase checks already ran (the tap only reaches stakeStep when betting is allowed), and it's clamped to 1..your chips.
const stakeModal = document.getElementById("stakeModal"), stakeIn = document.getElementById("stakeIn"), stakeNote = document.getElementById("stakeNote");
const STAKE_REF = { bet: () => [TAV.bet, "stake"], c21: () => [TAV.c21, "bet"], derby: () => [TAV.derby, "bet"], plinko: () => [TAV.plinko, "bet"],
  snap: () => [CZ.snap, "bet"], bigger: () => [CZ.big, "bet"], crown: () => [CZ.ca, "bet"], reel: () => [CZ.rd, "bet"], wheel: () => [CZ.wh, "bet"],
  treasure: () => [CZ.td, "bet"], net: () => [CZ.nh, "bet"] };
let stakeAt = null;
function askStake(st, top) {
  const ref = STAKE_REF[S.overlay] && STAKE_REF[S.overlay]();
  if (!ref || !ref[0]) return;
  stakeAt = { obj: ref[0], key: ref[1], top };
  stakeIn.value = st; stakeNote.textContent = "Any amount from 1 to " + top.toLocaleString("en-US") + ". 2.5M, 1B and 3T work too.";
  stakeModal.classList.add("open"); play("tick"); setTimeout(() => { stakeIn.focus(); stakeIn.select(); }, 30);
}
function parseStake(t) {                                     // "2500000", "2,500,000", "2.5M", "1B", "3T" -> a whole number (NaN if none)
  const m = /^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMBTQ]?)$/.exec(String(t).trim().toUpperCase());
  if (!m) return NaN;
  return Math.round(parseFloat(m[1].replace(/,/g, "")) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 }[m[2]] || 1));
}
function closeStake(how) {
  stakeModal.classList.remove("open");
  const a = stakeAt; stakeAt = null;
  if (!a || !how) return;
  const n = how === "all" ? a.top : parseStake(stakeIn.value);
  if (n > 0) { a.obj[a.key] = clamp(n, 1, a.top); play("tick"); }
}
document.getElementById("stakeOk").addEventListener("click", () => closeStake("ok"));
document.getElementById("stakeAll").addEventListener("click", () => closeStake("all"));
document.getElementById("stakeCancel").addEventListener("click", () => closeStake(null));
stakeModal.addEventListener("pointerdown", e => { if (e.target === stakeModal) closeStake(null); });
stakeIn.addEventListener("input", () => { stakeIn.value = stakeIn.value.toUpperCase().replace(/[^0-9.,KMBTQ]/g, ""); });   // digits, commas, a point and K/M/B/T/Q
stakeIn.addEventListener("keydown", e => { if (e.key === "Enter") closeStake("ok"); else if (e.key === "Escape") closeStake(null); e.stopPropagation(); });
document.getElementById("nameSkip").addEventListener("click", () => closeName(false));
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") closeName(true); e.stopPropagation(); });

function tapAction() {
  if (S.state === "title" && S.stT > 0.25) cast();
  else if (S.state === "fight" && S.stT > 0.35) fightTap();
  else if (S.state === "flip" && FLIP && FLIP.fight && FLIP.fight.time - FLIP.fight.left > 0.35) flipFightTap();
  else if (S.state === "haul" && S.haul.shown >= S.haul.n && S.stT > S.haul.end + 0.6) finishDive();
}
function pointerPos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LW, (e.clientY - r.top) / r.height * LH]; }
function closeOverlay() {
  if (S.overlay === "help") { store.seenHelp = true; saveStore(); }
  const o = S.overlay, ex = EXTRA_OV[o] && EXTRA_OV[o].back;   // overlays from the other files say where Back goes (casino.js)
  if (ex) { S.overlay = typeof ex === "function" ? ex() : ex; play("back"); return; }
  S.overlay = o === "note" && S.noteBack ? S.noteBack : (o === "c21" && TAV.c21.vip) || (o === "derby" && TAV.derby.vip) || o === "rename" ? "vip"
    : o === "myfish" && TAV.fishBack ? TAV.fishBack : o === "derbytable" ? "derby" : ["c21", "derby", "plinko", "chipshop", "tavboard", "vip", "pit"].includes(o) ? hubBack(o) : ["story", "jukebox", "myfish", "scratch"].includes(o) ? "chipshop" : null;
  play("back");
}
function overlayTap(lx, ly) {
  if (S.overlay === "credits") { if (CRED.done) closeOverlay(); else CRED.fast = true; return; }
  if (EXTRA_OV[S.overlay]) { EXTRA_OV[S.overlay].tap(lx + OX, ly); return; }       // menus from the other files, both widths (island.js)
  if (wideMenus() && WIDE[S.overlay]) { WIDE[S.overlay].tap(lx + OX, ly); return; }   // the PC layouts
  if (tavernTap(lx, ly)) return;
  const arrows = n => { if (ly < 17 && (lx < 24 || lx > 96)) { play("tick"); return (lx > 96 ? 1 : n - 1); } return 0; };
  if (S.overlay === "help") {
    const d = arrows(HELP.length);
    if (d) S.helpPage = (S.helpPage + d) % HELP.length;
    else if (S.helpPage < HELP.length - 1) { S.helpPage++; play("tick"); }
    else closeOverlay();
    return;
  }
  if (S.overlay === "more") {
    const rows = MORE_ROWS(), st = moreStep(), i = Math.floor((ly - 56) / st), id = rows[i] && rows[i][2];
    if (lx >= 16 && lx < 104 && i >= 0 && i < rows.length && (ly - 56) % st < st - 4) {
      if (id === "tasks") openOverlay("tasks");
      else if (id === "secrets") { if (store.sec.found.length) openOverlay("secrets"); else play("miss"); }
      else if (id === "bestiary") openOverlay("bestiary");
      else if (id === "siege") { S.overlay = null; siegeEnter(); }
      else if (id === "help") openOverlay("help");
      else if (id === "name") { S.overlay = null; askName(); }
      else { S.overlay = null; openSave(); }
    } else if (lx < 6 || lx >= 114 || ly < 30 || ly >= 180) closeOverlay();
    return;
  }
  if (S.overlay === "note") {
    const n = store.sec.bottles.length, d = n > 1 ? arrows(n) : 0;
    if (d) S.noteIdx = (S.noteIdx + d) % n; else closeOverlay();
    return;
  }
  if (S.overlay === "fhaul") { closeOverlay(); return; }
  if (ly > 186) { closeOverlay(); return; }
  if (S.overlay === "bestiary") { bestiaryTap(lx, ly, arrows(B_PAGES)); return; }
  if (S.overlay === "secrets") {
    const n = store.sec.found.length, pages = Math.max(1, Math.ceil(n / SEC_PER)), d = pages > 1 ? arrows(pages) : 0;
    if (d) S.secSel = Math.min(n - 1, ((Math.floor(S.secSel / SEC_PER) + d) % pages) * SEC_PER);
    else if (ly >= 16 && ly < 31) { if (store.sec.bottles.length) { S.overlay = "note"; S.noteIdx = store.sec.bottles.length - 1; S.noteBack = "secrets"; play("select"); } }
    else if (ly >= 34 && ly < 34 + SEC_PER * 14) {
      const i = Math.floor(S.secSel / SEC_PER) * SEC_PER + Math.floor((ly - 34) / 14);
      if (i < n) { if (i === S.secSel) secretAct(); else { S.secSel = i; play("tick"); } }
    } else if (ly >= 167 && ly < 185) secretAct();
    return;
  }
  if (S.overlay === "log") {
    const d = arrows(ZONES.length);
    if (d) { S.logPage = zoneStep(S.logPage, d === 1 ? 1 : -1); S.logSel = 0; }
    else if (ly >= 20 && ly < 100) { S.logSel = clamp(Math.floor((ly - 20) / 20) * 4 + Math.floor((lx - 4) / 28), 0, LOGGED.filter(s => s[2] === S.logPage).length - 1); play("tick"); }
  } else if (S.overlay === "scores") {
    if (store.sec.beat && arrows(2)) { S.board = S.board ? 0 : 1; S.scoreSel = -1; }
    else if (ly >= 16 && ly < 34) { S.tab = lx < 60 ? 0 : 1; S.scoreSel = -1; play("tick"); }
    else if (ly >= 35 && ly < 146) { const fb = S.board && store.sec.beat, i = Math.floor((ly - 35) / 11), rows = (fb ? (S.tab === 0 ? LB.ftoday : LB.fall) : (S.tab === 0 ? LB.today : LB.all)) || []; S.scoreSel = i < rows.length ? i : -1; play("tick"); }
  } else if (S.overlay === "shop") {
    const d = arrows(CATS.length), n = CATS[S.shopCat][2].length, pages = Math.ceil(n / PER_PAGE), page = Math.floor(S.shopSel / PER_PAGE);
    if (d) { S.shopCat = (S.shopCat + d) % CATS.length; S.shopSel = 0; }
    else if (ly >= 27 && ly < 107) { const i = page * PER_PAGE + Math.floor((ly - 27) / 20) * 5 + clamp(Math.floor((lx - 2) / 23), 0, 4); if (i < n) { if (i === S.shopSel) shopAct(); else { S.shopSel = i; play("tick"); } } }
    else if (ly >= 106 && ly < 121 && pages > 1 && (lx < 48 || lx > 72)) { S.shopSel = ((page + (lx > 72 ? 1 : pages - 1)) % pages) * PER_PAGE; play("tick"); }
    else if (ly >= 152 && ly < 172) shopAct();
  }
}
function titleTap(rx, lx, ly) {                            // -> true if the tap was used on the title screen
  const [sx, sy] = sunPos(), wl = Math.round(-S.cam);
  if (!S.storm && Math.hypot(rx - sx, ly - sy) <= 12) {    // the sun (or moon) gets tired if you poke it ten times
    if (!S.eclipse && ++S.sunTaps >= 10) {
      S.eclipse = true; S.tod = "NIGHT"; S.flash = 0.3; play("thunder", 0.5);
      S.popups.push([S.realTod === "NIGHT" ? "BLOOD MOON!" : "ECLIPSE!", 2.6, GOLD], ["NIGHT FISH ARE OUT", 2.6, CYAN]);
      findSecret("eclipse");
    } else play("tick");
    return true;
  }
  const P = S.poke;
  if (rx >= OX + 37 && rx < OX + 55 && ly >= wl - 26 && ly < wl - 6 && P.fall < 0) {   // poke your sailor
    P.n++; P.t = 0;
    if (P.n >= 10) { P.fall = 0; P.splashed = false; play("miss"); }
    else play(P.n > 3 ? "hit" : "tick");
    return true;
  }
  if (typeof siegeTap === "function" && siegeTap(rx, ly, wl)) return true;   // the Admiral's gunboat (siege.js)
  if (typeof raftTap === "function" && raftTap(rx, ly, wl)) return true;   // the shipwright, the raft, the island (island.js)
  if (rx >= OX - 8 && rx < OX + 22 && ly >= wl - 38 && ly < wl) {      // the Rusty Hook
    if (tavOpen()) { TAV.say = dailyReady() ? "FREE CHIPS ON THE BAR" : "WHAT'LL IT BE?"; openOverlay("tavern"); }
    else { S.popups.push(["CLOSED. " + (TAV_OPEN_AT - store.dives) + " DIVES TO GO", 2.4, ORANGE]); play("miss"); }
    return true;
  }
  if (wideMenus()) {                                       // the PC main menu: its own buttons; the rest of the water casts
    const h = hitAt(titleWideHits(), rx, ly);
    if (h) { titleWideAct(h[0], h[5]); return true; }
    if (ly < wl) { swipeAt = [rx, ly]; return true; }
    return false;
  }
  if (ly < wl) { swipeAt = [rx, ly]; return true; }       // the rest of the sky: swipes and taps there can enter a certain code
  if (ly >= 159 && ly < 173 && lx >= 8 && lx < 106) { openBet(); return true; }
  if (ly >= 96 && ly < 124 && lx >= 6 && lx < 114) { const v = clamp(Math.floor((lx - 6) / 27), 0, LURES.length - 1); if (lureOK(v)) { S.lure = v; play("tick"); } else play("miss"); return true; }
  if (ly >= 174 && ly < 192) {
    const b = TITLE_BAR.findIndex(([, , x, w]) => lx >= x - 1 && lx < x + w + 1);
    if (b < 0) return true;
    S.overlay = ["scores", "log", "shop", "more"][b]; S.scoreSel = -1; if (b === 0) LB.load(); play("select");
    return true;
  }
  return false;                                            // CAST, or anywhere else in the water, casts
}
function openOverlay(o) { S.overlay = o; S.helpPage = 0; S.secSel = 0; S.noteBack = null; play("select"); }
canvas.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { AC = null; } }
  if (AC && AC.state === "suspended") AC.resume();
  const [rx, ly] = pointerPos(e), lx = rx - OX;          // rx: across the whole screen; lx: inside the menu column
  if (S.state === "kart" && typeof KART !== "undefined" && KART) { kartTouch(rx, ly, true); return; }
  if (S.state === "isle" && typeof ISLE !== "undefined" && ISLE) { isleTouch(e); return; }
  if (S.state === "siege" && typeof SG !== "undefined" && SG) { siegeTouch(e); return; }
  if (S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { wreckTouch(e); return; }
  if (S.state === "boss" && BOSS) { if (rx < 40 && ly > 172) bossPulse(); else BOSS.touch = [rx, ly]; return; }
  if (S.state === "flip" && FLIP) { if (FLIP.fight) { if (FLIP.fight.time - FLIP.fight.left > 0.35) flipFightTap(); } else if (rx < 40 && ly > 172) { if (LURES[S.lure][0] !== "angler") flipPulse(); } else S.touchX = rx; return; }
  if (S.overlay) { overlayTap(lx, ly); return; }
  if (S.state === "title") { if (titleTap(rx, lx, ly)) return; }
  if (S.state === "down" && rx < 16 && ly < 14) { newDive(); return; }          // give up this dive
  if ((["down", "rise"].includes(S.state) || (S.fullUp && ["up", "turn"].includes(S.state))) && rx < 40 && ly > 172) { pulse(); return; }
  if (S.state !== "fight") { S.touchX = KON === "mirror" ? LW - rx : rx; S.drift = 0; }
  tapAction();
});
canvas.addEventListener("pointermove", e => { if (S && S.state === "siege" && typeof SG !== "undefined" && SG) { siegeMove(e); return; } if (S && S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { wreckMove(e); return; } if (BOSS && BOSS.touch) BOSS.touch = pointerPos(e); if (S.touchX !== null) { const x = pointerPos(e)[0]; S.touchX = KON === "mirror" ? LW - x : x; } });
window.addEventListener("pointerup", e => {
  if (!S) return;
  S.touchX = null;
  if (BOSS) BOSS.touch = null;
  if (typeof KART !== "undefined" && KART) kartTouch(0, 0, false);
  if (S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) wreckUp(e);   // WRECKONING: let go of a stick, a trigger or the sights
  if (S.state === "isle" && typeof ISLE !== "undefined" && ISLE) isleTouchUp(e);   // Driftwood Isle: letting go casts / stops reeling
  if (swipeAt && S.state === "title" && !S.overlay) {      // a swipe in the sky is an arrow key; a tap is a tap
    const [x, y] = pointerPos(e), dx = x - swipeAt[0], dy = y - swipeAt[1];
    konamiKey(Math.max(Math.abs(dx), Math.abs(dy)) < 8 ? "TAP" : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp"));
  }
  swipeAt = null;
});
function keyDir(e) { return e.code === "ArrowLeft" || e.code === "KeyA" ? -1 : e.code === "ArrowRight" || e.code === "KeyD" ? 1 : 0; }
// Steering comes from the keys physically held, newest first, so rolling from A to D (or holding an arrow and a letter)
// never drops the key you're still holding, and a key held through a cast, a menu or a fight still steers afterwards.
const DIR_KEYS = { ArrowLeft: "L", KeyA: "L", ArrowRight: "R", KeyD: "R", ArrowUp: "U", KeyW: "U", ArrowDown: "D", KeyS: "D" };
let HELD = [];
function heldDir(neg, pos) { for (let i = HELD.length - 1; i >= 0; i--) { const d = DIR_KEYS[HELD[i]]; if (d === neg) return -1; if (d === pos) return 1; } return 0; }   // the latest key wins
function syncKeys() {
  if (BOSS) { BOSS.keys.clear(); const x = heldDir("L", "R"), y = heldDir("U", "D"); if (x) BOSS.keys.add(x < 0 ? "L" : "R"); if (y) BOSS.keys.add(y < 0 ? "U" : "D"); }
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
}
document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", e => {
  if (modal.classList.contains("open") || saveModal.classList.contains("open") || stakeModal.classList.contains("open") || !S) return;
  const c = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(c)) e.preventDefault();
  if (DIR_KEYS[c] && !HELD.includes(c)) { HELD.push(c); syncKeys(); }
  if (e.repeat) return;
  if (c === "KeyF") { toggleFullscreen(); return; }
  if (S.state === "isle" && typeof ISLE !== "undefined" && ISLE) { isleKey(e, true); return; }   // Driftwood Isle
  if (S.state === "siege" && typeof SG !== "undefined" && SG) { siegeKey(e, true); return; }   // Siege of the Deep
  if (S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) { wreckKey(e, true); return; }   // WRECKONING
  if (S.state === "kart" && typeof KART !== "undefined" && KART) { kartKey(e, true); if (["Space", "ShiftLeft", "ShiftRight"].includes(c)) e.preventDefault(); return; }   // FIN PRIX
  if (S.state === "flip" && FLIP && FLIP.test && c === "Escape") { flipDrone(false); FLIP = null; newDive(); return; }
  if (S.state === "boss" && BOSS) {                        // the fight: move in any direction, Space or Shift to pulse
    const k = { ArrowLeft: "L", KeyA: "L", ArrowRight: "R", KeyD: "R", ArrowUp: "U", KeyW: "U", ArrowDown: "D", KeyS: "D" }[c];
    if (c === "Escape" && BOSS.test) { BOSS = null; newDive(); return; }
    if (!k && ["Space", "ShiftLeft", "ShiftRight", "Enter"].includes(c)) bossPulse();       // movement comes from HELD
    e.preventDefault(); return;
  }
  if (S.state === "title" && konamiKey(c)) { S.overlay = null; return; }   // the Konami code, even with a menu open
  if (S.overlay) {
    if (c === "Escape") closeOverlay();
    else if (EXTRA_OV[S.overlay] && EXTRA_OV[S.overlay].key) EXTRA_OV[S.overlay].key(c, keyDir(e));   // casino.js screens take their own keys
    else if (S.overlay === "plinko") plinkoKey(c, keyDir(e));
    else if (c === "Space" || c === "Enter") { if (S.overlay === "shop") shopAct(); else overlayTap(60, S.overlay === "help" ? 100 : 190); }
    else if (keyDir(e)) { const W = wideMenus() && WIDE[S.overlay]; if (W) W.key(keyDir(e)); else overlayTap(keyDir(e) > 0 ? 110 : 10, 8); }
    return;
  }
  const dir = keyDir(e);
  if (dir) { if (S.state === "title") pickLure((S.lure + dir + LURES.length) % LURES.length, dir); }   // steering comes from HELD
  else if (c === "ShiftLeft" || c === "ShiftRight" || c === "ArrowDown") pulse();
  else if (c === "Space" || c === "Enter" || (c === "ArrowUp" && S.state !== "title")) { tapAction(); }   // Up doesn't cast: it starts a certain code
});
window.addEventListener("keyup", e => { if (HELD.includes(e.code)) { HELD = HELD.filter(k => k !== e.code); syncKeys(); } if (S && S.state === "wreck" && typeof wreckOn === "function" && wreckOn()) wreckKey(e, false); if (typeof KART !== "undefined" && KART) kartKey(e, false); if (S && S.state === "isle" && typeof ISLE !== "undefined" && ISLE) isleKeyUp(e); });
window.addEventListener("blur", () => { HELD = []; syncKeys(); });

// --------------------------------------------------------------------- loop
const WATER_COL = DATA.water;
let pageCol = "";
function tintPage() {                                    // the page around the game takes the colour of the water on screen
  const m = Math.max(-2, (S.cam + 100) / M);
  let col = rgb(WATER_COL[WATER_COL.length - 1][1]);
  for (let i = 1; i < WATER_COL.length; i++) if (m <= WATER_COL[i][0]) { col = lerpCol(WATER_COL[i - 1][1].map(v => v * 0.55), WATER_COL[i][1].map(v => v * 0.55), (m - WATER_COL[i - 1][0]) / (WATER_COL[i][0] - WATER_COL[i - 1][0])); break; }
  if (col !== pageCol) { pageCol = col; document.body.style.background = col; }
}
let wasTitle = null;
function step(dt) {
  T += dt; S.stT += dt; if (!S.overlay) update(dt); tavTick(dt); draw(); tintPage();
  const title = S.state === "title" && !S.overlay;
  if (title !== wasTitle) { wasTitle = title; document.body.classList.toggle("playing", !title); }   // the key reminder only shows on the title screen
}
let last = 0;
function frame(ms) { const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; requestAnimationFrame(frame); step(dt); }   // schedule first, so one bad frame can't stop the game
function start() {
  const c = document.createElement("canvas");
  c.width = atlas.width; c.height = atlas.height;
  const x = c.getContext("2d");
  x.drawImage(atlas, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#2c3660"; x.fillRect(0, 0, c.width, c.height);
  sil = c;
  const gc = document.createElement("canvas");
  gc.width = atlas.width; gc.height = atlas.height;
  const gx = gc.getContext("2d");
  gx.drawImage(atlas, 0, 0); gx.globalCompositeOperation = "source-atop"; gx.fillStyle = "rgba(220,236,255,0.75)"; gx.fillRect(0, 0, gc.width, gc.height);
  ghostAtlas = gc;
  resize();
  window.addEventListener("resize", resize);
  ["baiter", "mythic"].forEach(id => { if (store.titles.includes(id) && !store.sec.found.includes(id)) store.sec.found.push(id); });   // earned before the Secrets page existed
  newDive();
  if (TEST_BOSS) startBoss(true, TEST_BOSS);
  else if (TEST_FLIP) startFlip(TEST_FLIP, false);
  else if (TEST_END) startFlip(TEST_END, true);
  LB.load();
  window.REEL = { wideHits: o => ({ shop: shopWideHits, log: logWideHits, bestiary: bestiaryWideHits, secrets: secretsWideHits, scores: scoresWideHits, help: helpWideHits, tavern: tavernWideHits, chipshop: chipShopWideHits, jukebox: jukeWideHits, myfish: myFishWideHits, bet: betWideHits, c21: c21WideHits, derby: derbyWideHits, scratch: scratchWideHits, vip: vipWideHits, rename: renameWideHits, title: titleWideHits })[o](), WIDE, wideMenus, BETS, betMask, betChance, betBoard, betPays, windowChance, lifeChance, betHW, betLife, betRecord, lineRaw, BET_CAP, PLINKO, plinkoDrop, plinkoOpen, plinkoTap, plinkoTick, get FLIP() { return FLIP; }, get T() { return T; }, SHOP_ROWS, shopRowState, scratchNew, scratchTap, tav, startFlip, FL_TUNE, flipVisible, flipJellies, flipRect, flipPulse, flipFightTap, flipScore, FLIP_REWARDS, BESTIARY, endgameDone, flipSY, flipUpdate, endFlip, knockCrack, get CRED() { return CRED; }, nameOf, renameFish, get TAVs() { return TAV; }, simTick(dt) { T += dt; S.stT += dt; update(dt); }, get BOSS() { return BOSS; }, set BOSS(v) { BOSS = v; }, startBoss, bossPulse, bossUpdate, endBoss, SL_TUNE, slY, c21Sum, c21Tick, raceStep, get TAV() { return TAV; }, set TAV(v) { TAV = v; }, c21New, c21Deal, c21Hit, c21Stand, derbyNew, derbyGo, openBet, placeBet, betOdds, betLine, claimDaily, shopBuy, tavOpen, settleBet, get KON() { return KON; }, set KON(v) { KON = v; }, get EV() { return EV; }, set EV(v) { EV = v; }, findSecret, packSave, unpackSave, events, moonPhase, newDive, finishDive, titleTap, get S() { return S; }, get width() { return LW; }, get store() { return store; }, shopAct, CATS, tasks, land, startFight, beginHaul, step, store, LB, visible, fishRect, pulse, cast, tapAction };   // handy in the console
  requestAnimationFrame(frame);
}
let loaded = 0;
[atlas, water].forEach(img => { img.onload = () => { if (++loaded === 2) start(); }; });
atlas.src = "assets/atlas.png";
water.src = "assets/water.png";
