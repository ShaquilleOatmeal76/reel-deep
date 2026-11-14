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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpCol = (a, b, k) => rgb([0, 1, 2].map(i => Math.round(lerp(a[i], b[i], clamp(k, 0, 1)))));

const canvas = document.getElementById("game");
const g = canvas.getContext("2d");
g.imageSmoothingEnabled = false;
const dark = document.createElement("canvas");
dark.height = LH;
function resize() {                                    // the ocean fills whatever shape the window is, from phone portrait to widescreen
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
  eq: { char: 0, hat: 0, boat: 0, hook: 0, line: 0, trail: 0, flair: 0, pet: 0, flag: 0, title: "rookie" }, tasks: null,
  dives: 0,                                              // dives finished, for things that open up with experience
  sec: { found: [], bottles: [], lastBottle: 0, konami: 0, woke: false, sleeper: false, crack: false, crossed: false, beat: false, afterSleeper: 0 },
  tav: { chips: 0, daily: "", claims: 0, bet: null, hist: [], fish: null, jukebox: false, songs: [], song: -1, stories: 0, magnet: 0, map: "",
    stats: { stack: 0, win: 0, fast: 0, hands: 0, derbies: 0 }, posted: {}, postedAt: 0, names: {} } };   // the Rusty Hook
try {
  const old = JSON.parse(localStorage.getItem("reeldeep") || "{}");
  store = Object.assign(store, old, { own: Object.assign(store.own, old.own || {}), eq: Object.assign(store.eq, old.eq || {}), sec: Object.assign(store.sec, old.sec || {}), tav: Object.assign(store.tav, old.tav || {}) });
  store.tav.stats = Object.assign({ stack: 0, win: 0, fast: 0, hands: 0, derbies: 0 }, store.tav.stats);
  if (!old.dives) store.dives = Math.max(store.dives || 0, Math.floor(Object.values(store.log).reduce((a, e) => a + (e.n || 0), 0) / 3));   // dives from before they were counted, roughly
} catch (e) { /* private window: play without saving */ }
function saveStore() { try { localStorage.setItem("reeldeep", JSON.stringify(store)); } catch (e) { /* ignore */ } }
const HIDDEN = ["poop", "gboot", "werewolf", "lucky"];                // the mythic and the secret catches never show in the log
const LOGGED = SPECIES.filter(s => !HIDDEN.includes(s[0]));

// ------------------------------------------------------------------ secrets
// Secret rewards live on the Secrets page only, never in the shop. They are appended past the shop's items:
const SHOP_N = { flag: 12, flair: 20 };                  // how many of each list the shop sells; anything after is a secret reward
// [id, name, what it was, reward: [kind, index] or ["title", id] or null]
const SECRETS = [
  ["bottle", "MESSAGE IN A BOTTLE", "FISHED A BOTTLE OUT OF THE SEA", ["flag", 12]],
  ["gboot", "GOLDEN BOOT", "FOUND THE LOST GOLD BOOT", ["flag", 13]],
  ["konami", "THE CODE", "UP UP DOWN DOWN...", ["flair", 20]],
  ["eclipse", "ECLIPSE", "WORE OUT THE SKY", ["flag", 14]],
  ["poke", "MAN OVERBOARD", "POKED YOUR SAILOR TOO MUCH", ["title", "soggy"]],
  ["mythic", "THE UNLOGGED FISH", "CAUGHT THE SHIT FISH", ["title", "mythic"]],
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
];
function findSecret(id) {                                  // -> true the first time; puts a note on screen and gives the reward
  if (store.sec.found.includes(id)) return false;
  const s = SECRETS.find(q => q[0] === id);
  if (!s) return false;
  store.sec.found.push(id);
  const rw = s[3];
  if (rw && rw[0] === "title") award(rw[1]);
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
  ["MINNOW, SQUID, SHRIMP. EVERY GOOD BAITER KNOWS THE RECIPE.", "any"],
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
    || (w === "crossed" && q.crossed && !q.beat) || (w === "beat" && q.beat);
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
  ["FIRE LINE", 3000, "@fire"], ["ICE LINE", 2500, "@ice"], ["SPARKLE LINE", 4000, "@sparkle"]];
const TRAILS = [["BUBBLES", 0, ["#c8ecff"]], ["GOLD DUST", 1000, ["#ffd246", "#fff0a0"]], ["PINK FIZZ", 1000, ["#ff8cd2", "#ffd2f0"]], ["EMBERS", 1500, ["#ff965a", "#ffdc5a"]],
  ["STARDUST", 2000, ["#ffffff", "#5ae6ff", "#c8a0ff"]], ["RAINBOW FIZZ", 4000, ["#f05050", "#ffa046", "#ffd246", "#82f082", "#5ae6ff", "#c8a0ff"]],
  ["TOXIC", 1200, ["#82f082", "#c8ff5a", "#46c846"]], ["DEEP BLUE", 1000, ["#3c78ff", "#5ae6ff"]], ["CANDY", 1500, ["#ff8cd2", "#ffffff", "#5ae6ff"]],
  ["SHADOW", 1500, ["#3c3450", "#6e5a96"]], ["CONFETTI", 3000, ["#f05050", "#ffd246", "#5ae6ff", "#82f082", "#ff8cd2"]], ["GOLDEN RAIN", 5000, ["#ffd246", "#ffffff", "#ffb428"]]];
const price = (names, list) => names.map((n, i) => [n, list[i]]);
// Prices are set so the good stuff takes weeks of regular play, not an afternoon.
const SHOP = [
  ["CHARACTER", "char", price(DATA.chars, [0, 500, 500, 1200, 1500, 1800, 1200, 1000, 2000, 1500, 1800, 1800, 6000, 4000, 3500, 2500, 2500, 3000, 4500, 3000, 6000, 5000])],
  ["HAT", "hat", price(DATA.hats, [0, 300, 800, 4000, 1500, 400, 1000, 800, 3000, 2500, 500, 2000, 1000, 1800, 600, 1200, 900, 1500, 1800, 1200, 1400, 2500, 3500, 1400, 2200, 7500])],
  ["BOAT", "boat", price(DATA.boats, [0, 700, 700, 1000, 1800, 1500, 4000, 8000, 1500, 1500, 3000, 2500, 5000, 3500, 4000, 3000, 2000, 4500])],
  ["PET", "pet", price(DATA.pets, [0, 1500, 1500, 2500, 2500, 3000, 3000, 2000, 2500, 5000, 1800, 7000, 6000, 4500])],
  ["FLAG", "flag", price(DATA.flags.slice(0, SHOP_N.flag), [0, 600, 1500, 1200, 1500, 3000, 1500, 2000, 2500, 2000, 1500, 4000])],
  ["HOOK", "hook", price(DATA.hooks, [0, 1200, 900, 1500, 1100, 1800, 2500, 1500, 5000, 3000, 2000, 2500, 1500, 3500])],
  ["LINE", "line", LINES.map(l => [l[0], l[1]])],
  ["BUBBLE TRAIL", "trail", TRAILS.map(l => [l[0], l[1]])],
  ["FISH FLAIR", "flair", price(DATA.flair.slice(0, SHOP_N.flair), [0, 1200, 1500, 4000, 1000, 2000, 1800, 3000, 2500, 1200, 1500, 1000, 2000, 1200, 1800, 1500, 3500, 2500, 2000, 6000])],
];
// Titles are earned, never bought. [id, name, how to get it (null = a secret)]
const ZONE_TITLES = ["BEACH BUM", "KELP KEEPER", "TWILIGHT RANGER", "WRECK DIVER", "ABYSS WALKER", "CRYSTAL SEER", "VENT WARDEN", "BONE COLLECTOR", "TRENCH RAT", "FLOOR MANAGER"];
const TITLES = [["rookie", "ROOKIE", "WHERE EVERYONE STARTS"]]
  .concat(ZONES.map((z, i) => ["zone" + i, ZONE_TITLES[i], "LOG ALL OF " + z[0]]))
  .concat([["floor", "BOTTOM FEEDER", "TOUCH THE SEA FLOOR"], ["legends", "LEGEND HUNTER", "LOG EVERY LEGENDARY"], ["trophies", "TROPHY ROOM", "A TROPHY OF EVERY FISH"],
    ["all", "COMPLETIONIST", "LOG EVERY SPECIES"], ["baiter", "MASTER BAITER", null], ["mythic", "HOLY CRAP", null], ["soggy", "SOGGY", null],
    ["roller", "HIGH ROLLER", "1,000 TAVERN CHIPS"], ["shark", "CARD SHARK", "WIN 25 HANDS OF 21"], ["derbyking", "DERBY KING", "WIN 10 DERBY BETS"],
    ["longshot", "LONG SHOT", "WIN A X8 DIVE BET"], ["regular", "REGULAR", "TAKE FREE CHIPS 14 DAYS"],
    ["wakeup", "WAKE-UP CALL", "BEAT THE SLEEPER"]]);
const SHOP_TITLE_IDS = TITLES.map((t, i) => i).filter(i => TITLES[i][0] !== "soggy");   // SOGGY is a secret reward and lives on the Secrets page
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
  const zs = ["SHALLOWS", "KELP", "TWILIGHT", "WRECK", "ABYSS", "CAVES", "VENTS", "BONE YARD", "TRENCH", "FLOOR"];
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
  const d = new Date(), pool = SPECIES.filter(s => !s[7] && s[6] === null && s[4] > 0 && s[2] <= 6 && s[5] >= 2).map(s => s[0]);
  return RNG((d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 7 + 1).choice(pool);
}
function stormNow() {                                 // the weather follows the clock: each hour is stormy or not, the same for everybody
  return RNG(Math.floor(Date.now() / 3600000) * 2654435761 + 17).random() < 0.14;
}
function zoneOf(m) { for (let i = 0; i < ZONES.length; i++) if (m < ZONES[i][2]) return i; return ZONES.length - 1; }

// ------------------------------------------------------------- leaderboard
const LB = {                                             // two lists in the database: /daily/<date> and /all, each entry {n, s, t, h, ti}
  url: (typeof LEADERBOARD_URL === "string" ? LEADERBOARD_URL : "").trim().replace(/\/+$/, ""),
  today: null, all: null, status: "", note: "",
  async top(path) {                                      // best ten; falls back to reading the whole list if the database has no index yet
    let data = null;
    try { const r = await fetch(this.url + path + '.json?orderBy=%22s%22&limitToLast=10'); if (r.ok) data = await r.json(); } catch (e) { data = null; }
    if (data === null || (data && data.error)) data = await fetch(this.url + path + ".json").then(r => r.json());
    return Object.values(data || {}).filter(e => e && typeof e.s === "number" && typeof e.n === "string").sort((x, y) => y.s - x.s).slice(0, 10);
  },
  async load() {
    if (!this.url) return;
    this.status = "LOADING...";
    try { [this.today, this.all] = await Promise.all([this.top("/daily/" + dayString()), this.top("/all")]); this.status = ""; }
    catch (e) { this.status = "CAN'T REACH THE SCORES"; }
  },
  async submit(name, score, haul, title) {
    if (!this.url || !name || score <= 0) return;
    const body = JSON.stringify({ n: name, s: score, t: Date.now(), h: haul, ti: title });
    const post = path => fetch(this.url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    try {
      const [a, b] = await Promise.all([post("/daily/" + dayString() + ".json"), post("/all.json")]);
      this.note = a.ok && b.ok ? "" : "UPDATE THE DATABASE RULES";
    } catch (e) { this.status = "CAN'T REACH THE SCORES"; return; }
    await this.load();
  },
};
function packHaul(h, bottom) { return h.rows.map(r => r[0] + ":" + r[1] + (r[3] ? ":T" : "")).join(",") + "|" + h.mult + "|" + (bottom ? 1 : 0); }
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
    realTod: timeOfDay(), eclipse: false, sunTaps: 0, poke: { n: 0, t: 9, fall: -1 }, bottle: null, bottleGot: -1,
  };
  EV = events();
  loseCastBet();
  S.storm = stormNow();                                  // weather comes from the clock, so refreshing can't reroll it
  const r = S.rng.random();                              // frenzies and whales are still rolled per dive, as before
  if (!S.storm && r >= 0.14 && r < 0.32) {
    const z = S.rng.randint(1, 8), a = S.rng.uniform(ZONES[z][1] + 20, ZONES[z][2] - 50);
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
  if (S.rng.random() < (magnet ? 0.5 : 0.125)) {          // about one dive in eight has a message in a bottle (half, with a magnet)
    const id = pickBottle(S.rng);
    if (id >= 0) S.bottle = { id, x: S.rng.uniform(10, LW - 20), y: S.rng.uniform(30, C.MAX_M - 80) * M, got: false };
  }
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
      if (z + 1 < ZONES.length && zb - m < C.BLEND && r1 < 0.5 * (1 - (zb - m) / C.BLEND)) zz = z + 1;   // the next zone's fish drift up to meet you
      else if (z > 0 && m - za < C.BLEND && r1 < 0.5 * (1 - (m - za) / C.BLEND)) zz = z - 1;
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
      if (s[0] === "tripod") { if (z !== ZONES.length - 1) continue; y = DEPTH_PX - 12; }
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

function pulse() {                                       // scatter everything near the hook
  if (S.state === "boss") { bossPulse(); return; }
  if (!["down", "rise"].includes(S.state) || S.pulses <= 0) return;
  if (!S.catch.length && S.hy > (C.MAX_M - 20) * M && Math.abs(S.hx - (46 + OX)) < 34 && S.eye > 0.3) { S.pulses--; startBoss(false); return; }   // knock on the eye with an empty hook
  if (store.sec.sleeper && S.hy > (C.MAX_M - 20) * M && Math.abs(S.hx - (OX + 108)) < 16) say("crack", "THE CRACK HUMS. NOT YET.", "#c8a0ff", 2.6);
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

function steer(dt) {
  const speed = 118 * S.steerK;
  if (S.touchX !== null) S.hx += clamp(S.touchX - S.hx, -speed * dt, speed * dt);
  else if (S.keys.size) S.hx += [...S.keys].reduce((a, b) => a + b, 0) * speed * dt;
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
  if (S.hy <= 10 * M || S.immune > 0) return;
  for (const [i, f] of visible()) {
    const touch = overlap(hook, fishRect(f));
    if (f.gh === 2 && !touch) f.gh = 3;                   // the ghost has passed through; now it can be caught
    if (f.fl || !touch) continue;
    if (f.gh === 1) { f.gh = 2; say("ghost", "IT WENT RIGHT THROUGH!", "#dcf0ff"); continue; }
    if (f.gh === 2) continue;
    const legend = f.id !== "jelly" && SPEC[f.id][7];
    if (f.id === "jelly") { play("zap"); S.flash = 0.2; S.rising = false; setState("turn", "ZAPPED!"); }     // dive over; you keep what's hooked
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
function darknessAt(m) {
  const d = DATA.dark;
  if (m <= d[0][0]) return 0;
  for (let i = 1; i < d.length; i++) if (m <= d[i][0]) return lerp(d[i - 1][1], d[i][1], (m - d[i - 1][0]) / (d[i][0] - d[i - 1][0]));
  return d[d.length - 1][1];
}
function update(dt) {
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
    S.hy += (56 + Math.min(70, S.hy / M * 0.09)) * S.sink * dt;
    while (S.path.length < Math.floor(S.hy / 8) + 1) S.path.push(S.hx);
    const m = S.hy / M, z = zoneOf(m);
    S.reached = Math.max(S.reached, m);
    if (z > S.zoneSeen) { S.zoneSeen = z; S.popups.push([ZONES[z][0], 2.0, CYAN]); play("chime", 0.5); }
    if (S.frenzy && m > S.frenzy[0] - 10) say("frenzy", "FEEDING FRENZY!", ORANGE, 2.6);
    if (S.whaleAt && m > S.whaleAt - 22) {
      const d = S.rng.choice([-1, 1]);
      S.whale = { x: d > 0 ? -140 : LW + 12, y: S.whaleAt * M, d }; S.whaleAt = null;
      say("whale", "A WHALE PASSES", CYAN, 2.6);
    }
    hookCheck();
    if (S.state === "down" && S.hy >= C.BOTTOM_M * M) {
      S.hy = C.BOTTOM_M * M; S.bottom = true; play("chime");
      S.rising = S.catch.length < C.CAPACITY;            // room left on the hook: ride up slowly and keep fishing
      setState("turn", "TOUCHED BOTTOM!");
    }
    S.cam += ((S.hy - 78) - S.cam) * Math.min(1, dt * 6);
  } else if (S.state === "rise") {                         // the slow ride up from the floor: still catching until the hook is full
    steer(dt);
    S.hy -= 78 * dt;
    S.path.length = Math.max(0, Math.min(S.path.length, Math.floor(S.hy / 8) + 1));
    hookCheck();
    S.cam += ((S.hy - 128) - S.cam) * Math.min(1, dt * 6);
    if (S.state === "rise" && S.hy <= 2) beginHaul();
  } else if (S.state === "fight") {
    const fg = S.fight;
    fg.pos += fg.dir * fg.speed * dt;
    if (fg.pos >= 1 || fg.pos <= 0) { fg.pos = clamp(fg.pos, 0, 1); fg.dir = -fg.dir; }
    fg.shake = Math.max(0, fg.shake - dt);
    fg.left -= dt;
    if (fg.style === "shrink") fg.win[1] = Math.max(0.045, fg.win[1] - 0.035 * dt);       // the green zone closes while you wait
    if (fg.style === "dart") { fg.ph += dt * 3.2; fg.win[0] = clamp(fg.base + Math.sin(fg.ph) * 0.2, fg.win[1], 1 - fg.win[1]); }   // ...or will not hold still
    if (fg.left <= 0) loseFight("TOO SLOW! GOT AWAY");
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
  catchSound(S.catch.length - 1);
  splash(S.hx, S.hy, 6, "#c8ecff");
  const legend = SPEC[f.id][7];
  if (f.id === "gboot") { S.flash = 0.35; S.popups.push(["THE GOLDEN BOOT!", 2.6, GOLD]); play("fanfare"); }
  else if (f.id === "werewolf") { S.flash = 0.3; S.popups.push(["WEREWOLF FISH!", 2.6, "#c8a0ff"]); play("fanfare"); }
  else if (f.id === "lucky") { S.flash = 0.25; S.popups.push(["LUCKY GOLDFISH!", 2.4, LIME]); play("fanfare"); }
  else if (f.id === "poop") { S.flash = 0.5; S.popups.push(["MYTHIC!", 3, "#c8a0ff"], ["WHAT IS THAT?!", 3, "#c8a0ff"]); play("fanfare"); }
  else if (legend) { S.flash = 0.35; S.popups.push(["LEGENDARY!", 2.4, LEGEND], [SPEC[f.id][1], 2.4, LEGEND]); play("fanfare"); }
  else if (f.tr) { S.flash = 0.25; S.popups.push(["TROPHY " + SPEC[f.id][1] + "!", 2.2, TROPHY]); play("chime"); }
  if (S.catch.length >= C.CAPACITY) setState("turn", "FULL HOOK");
  else {
    if (!legend && !f.tr) S.popups.push(["HOOKED " + S.catch.length + "/" + C.CAPACITY, 1.0, GOLD]);
    if (S.state !== S.resume) setState(S.resume);
  }
}
// Big fish fight in four different ways, and every fight is on a clock.
const SLIPPERY = /EEL|SQUID|SERPENT|KRAKEN|LAMPREY|HAGFISH|OARFISH|OCTOPUS/;
function fightStyle(s) { return SLIPPERY.test(s[1]) ? "dart" : s[4] >= 30 ? "quick" : s[2] >= 4 ? "shrink" : "heavy"; }
const STYLE_HINT = { dart: "SLIPPERY: IT MOVES", quick: "FAST ONE!", shrink: "HURRY: IT SHRINKS", heavy: "HEAVY: MORE HITS" };
function startFight(i, f) {
  const s = SPEC[f.id], legend = s[7], style = fightStyle(s);
  let need = (legend ? 3 : 2) + (style === "heavy" ? 1 : 0) + (legend && s[2] >= 7 ? 1 : 0);
  if (C.FIXED.includes(f.id)) need = 2;
  const time = (style === "quick" ? 3.2 : 4.2) + need * 1.5, c = rnd(0.3, 0.7);
  S.fight = { i, f, need, style, hits: 0, miss: 0, pos: 0, dir: 1, shake: 0, ph: 0, base: c, time, left: time,
    speed: (1.0 + Math.min(0.9, f.lb / 500)) * (style === "quick" ? 1.7 : 1), win: [c, style === "shrink" ? 0.17 : 0.13] };
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
  const fg = S.fight;
  if (Math.abs(fg.pos - fg.win[0]) <= fg.win[1]) {
    fg.hits++; fg.shake = 0.25; play("hit");
    if (fg.hits >= fg.need) { S.fight = null; S.immune = 0.5; land(fg.i, fg.f); return; }
    fg.base = rnd(0.25, 0.75);
    fg.win = [fg.base, fg.style === "shrink" ? 0.17 : Math.max(0.08, 0.13 - 0.015 * fg.hits)]; fg.speed *= 1.1;
  } else {
    fg.miss++; play("miss");
    if (fg.miss >= 2) loseFight("IT GOT AWAY!");
  }
}
const SHORT = { "TROPHY CASE": "TROPHIES", "3 OF A KIND": "TRIPLE", "DEEP TRIO": "DEEP", "GRAND TOUR": "TOUR", "A PAIR": "PAIR" };
function beginHaul() {
  const rows = [];
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
      if (!hot) tag = isNew ? "NEW" : rec ? "REC" : "";
    }
    rows.push([fid, hot ? lb * C.BOUNTY_X : lb, tag, tr]);
  }
  // set bonuses add together: a pair (+0.5) and a grand tour (+1) make x2.5
  const ids = S.catch.map(c => c[0]), zones = ids.map(i => SPEC[i][2]), sets = [];
  if (ids.length === 3) {
    if (S.catch.every(c => c[2] || SPEC[c[0]][7])) sets.push([1, "TROPHY CASE"]);          // legendaries count as trophies here
    if (new Set(ids).size === 1) sets.push([2, "3 OF A KIND"]);
    if (Math.min(...zones) >= 7) sets.push([1, "DEEP TRIO"]);
    if (new Set(zones).size === 3) sets.push([1, "GRAND TOUR"]);
  }
  if (ids.length - new Set(ids).size === 1) sets.push([0.5, "A PAIR"]);
  const mult = Math.min(5, 1 + sets.reduce((a, s) => a + s[0], 0)), base = rows.reduce((a, r) => a + r[1], 0);
  const total = Math.round(base * mult) + (S.bottom ? C.BOTTOM_BONUS : 0);
  const extra = [];
  if (sets.length) { const long = sets.map(s => s[1]).join("+"), short = sets.map(s => SHORT[s[1]]).join("+"); extra.push([(sets.length === 1 ? long : short.length <= 13 ? short : sets.length + " BONUSES") + " X" + mult, LIME]); }
  if (S.bossWon) extra.push(["THE SLEEPER SLEEPS", "#c8a0ff"]);
  if (S.bottom) extra.push(["SEA FLOOR +" + C.BOTTOM_BONUS, CYAN]);
  const dive = { total, mult, catch: S.catch, reached: S.reached, bottom: S.bottom, sets, bounty: S.bounty };
  let coins = total > 0 ? Math.floor(total / 25) + 1 : 0;
  if (ids.includes("poop")) coins += 500;
  store.coins += coins;
  if (coins) extra.push(["+" + coins + " COINS +" + (2 + (S.reached >= 600 ? 3 : 0) + (S.bottom ? 5 : 0)) + " CHIPS", GOLD]);
  const news = progressTasks(dive).map(([, c]) => ["TASK DONE! +" + c + " COINS", 4, LIME]).concat(checkTitles(dive).map(n => ["NEW TITLE: " + n, 5, GOLD]));
  ["baiter", "mythic"].forEach(id => { if (store.titles.includes(id)) findSecret(id); });
  const q = tav(), chips = 2 + (S.reached >= 600 ? 3 : 0) + (S.bottom ? 5 : 0);       // a few chips per dive, more for deep ones
  q.hist.push([total, S.bottom ? 1 : 0, S.catch.some(c => c[2]) ? 1 : 0, S.catch.some(c => SPEC[c[0]][7]) ? 1 : 0]);
  if (q.hist.length > 20) q.hist.shift();
  addChips(chips);
  const betNews = settleBet(dive);
  if (betNews) news.push(betNews);
  if (LOGGED.some(s => s[7] && store.log[s[0]])) earnSong(6);
  if (store.titles.includes("baiter")) earnSong(7);
  if (store.titles.includes("all")) earnSong(8);
  store.dives++;
  if (store.sec.sleeper && !store.sec.crack) store.sec.afterSleeper++;
  const record = total > store.best;
  if (record) store.best = total;
  saveStore();
  const n = rows.length + extra.length;
  S.haul = { rows, extra, n, total, mult, sets, news, shown: 0, record, fanfare: false, end: 0.5 + n * 0.42 + 0.3 };
  setState("haul"); splash(LW / 2, 0, 14); play("plop");
}
function finishDive() {
  const total = S.haul.total, packed = packHaul(S.haul, S.bottom), ti = titleName(store.eq.title);
  if (total > 0 && LB.url) {
    if (store.name) LB.submit(store.name, total, packed, ti);
    else askName(n => { if (n) LB.submit(n, total, packed, ti); });
  }
  const note = S.bottleGot;
  newDive();
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
  S.overlay = null; S.touchX = null; S.keys.clear(); setState("boss"); play("thunder"); SOUNDS.roar = [[90, 1.2, "sawtooth", 0.35, 40], [60, 1.4, "square", 0.2, 30, 0.1]]; play("roar");
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

function draw() {
  if (S.state === "boss" && BOSS) { drawBoss(); return; }
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
    const base = kelp[i], topM = i < 10 ? 92 + (i * 7) % 5 * 7 : 112 + (i * 7) % 5 * 9, endM = i < 10 ? 216 - (i * 3) % 5 * 13 : 200 - (i * 3) % 5 * 11;
    const y0 = Math.max(topM * M, Math.floor(cam / 4) * 4);
    for (let wy = y0; wy < Math.min(endM * M, Math.floor(cam) + LH + 4); wy += 4) {
      const x = base + Math.sin(wy * 0.045 + t * 1.4 + i) * 3, sy = wy - cam;
      rect(i % 2 ? "#1e7846" : "#2c9654", x, sy, 2, 4);
      if ((wy / 4 + i) % 3 === 0) rect("#50be64", Math.floor(x) + (i % 2 ? 2 : -2), sy, 2, 2);
    }
  }
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
  if (bt && !bt.got && S.prepared) { const by = Math.floor(bt.y - cam + Math.sin(t * 2) * 1.5); if (by > -12 && by < LH + 12) spr("bottle", bt.x + Math.sin(t * 0.9) * 3, by - 4); }
  const diving = ["down", "turn", "up", "fight", "rise"].includes(S.state);
  if (diving) {                                          // the line, the hook and whatever is on it
    const pts = wl > -20 ? [[OX + 63, wl - 13]] : [];
    S.path.forEach((x, i) => { const sy = i * 8 - cam; if (sy >= -8 && sy <= S.hy - cam) pts.push([x, sy]); });
    pts.push([S.hx, S.hy - cam - 4]);
    for (let i = 1; i < pts.length; i++) line(lineCol(i), pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    const hx = Math.floor(S.hx), hy = Math.floor(S.hy - cam), lid = LURES[S.lure][0];
    if (EV.fools) { const [hw, hh] = sprSize("hook" + store.eq.hook); g.save(); g.translate(hx - 1 + hw, hy - 4 + hh); g.rotate(Math.PI); spr("hook" + store.eq.hook, 0, 0); g.restore(); }
    else spr("hook" + store.eq.hook, hx - 1, hy - 4);
    if (lid === "sinker") disc("#969caa", hx, hy - 7, 2);
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
    if (bt && !bt.got) lights.push([Math.floor(bt.x + 3), Math.floor(bt.y - cam), 14]);       // bottles catch the light a little
    if (store.sec.sleeper) lights.push([OX + 108, Math.floor(DEPTH_PX + 6 - cam), 10]);       // the crack glows, faintly
    if (S.eye > 0.05) lights.push([46 + OX, Math.floor(DEPTH_PX + 52 - cam), 20]);
    for (const gl of DATA.glows) if (gl[1] > cam - 20 && gl[1] < cam + LH + 20) lights.push([gl[0] - BG_O + OX, Math.floor(gl[1] - cam), gl[2]]);   // crystals and vent mouths
    dg.globalCompositeOperation = "destination-out";
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,0.45)", x, y, r, dg));
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,1)", x, y, Math.floor(r * 0.68), dg));
    g.drawImage(dark, 0, 0);
  }
  if (wl > -30) {                                        // the surface, boat and angler
    for (let x = 0; x < LW; x += 4) rect(WHITE, x + Math.floor(t * 3) % 4, wl + Math.floor(Math.sin(t * 2 + x * 0.3) * (S.storm ? 2.4 : 1.2)), 2, 1);
    const bob = Math.floor(Math.sin(t * (S.storm ? 3.4 : 2)) * (S.storm ? 3 : 1.5));
    drawShack(wl, tavOpen());
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
  const ov = { vip: drawVip, rename: drawRename, tavern: drawTavern, c21: drawC21, derby: drawDerby, bet: drawBet, chipshop: drawChipShop, story: drawStory, jukebox: drawJukebox, myfish: drawMyFish, tavboard: drawTavBoard, more: drawMore, secrets: drawSecrets, note: drawNote, log: drawLog, scores: drawScores, shop: drawShop, tasks: drawTasks, help: drawHelp }[S.overlay];
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
const TAV_OPEN_AT = 20, DAILY_CHIPS = 50, MAX_STAKE = 50, EDGE = 0.95;     // the house keeps about 5% over time
const tav = () => store.tav;
const tavOpen = () => store.dives >= TAV_OPEN_AT;
let TAV = { say: "WHAT'LL IT BE?", c21: null, derby: null, bet: null, shopSel: 0, songSel: 0, board: 0, boards: {}, story: 0, ticker: 0 };
function chipIcon(x, y) { disc(CHIP, x, y, 3); rect("#2a7a5a", x - 1, y - 1, 3, 3); rect(WHITE, x - 2, y - 2, 1, 1); }
function addChips(n, why) {                                 // -> n; also keeps the records and titles about chips
  const q = tav();
  q.chips = Math.max(0, q.chips + n);
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
function stakeStep(st, d, max) { const big = (max || MAX_STAKE) > 100 ? 10 : 5; return clamp(st + d * big, 5, Math.max(5, Math.min(max || MAX_STAKE, Math.floor(tav().chips / 5) * 5))); }   // the back room allows bigger bets

// ---- betting on your own dive
function betLine() {                                        // over / under line: the middle of your recent hauls, to the nearest 10
  const h = tav().hist.map(r => r[0]).sort((a, b) => a - b);
  if (h.length < 5) return 150;
  return Math.max(30, Math.round(h[h.length >> 1] / 10) * 10);
}
function betOdds() {                                        // [[kind, label, pays]], priced from your own recent dives
  const h = tav().hist, n = h.length, line = betLine();
  const p = (k, dflt) => n < 5 ? dflt : (h.filter(k).length + 1) / (n + 2);
  const pays = q => Math.min(20, Math.max(1.1, Math.floor(EDGE / q * 10) / 10));
  const over = p(r => r[0] > line, 0.5);
  return [["over", "OVER " + line + " LB", pays(over)], ["under", "UNDER " + line + " LB", pays(Math.max(0.05, 1 - over))],
    ["floor", "TOUCH FLOOR", pays(p(r => r[1], 0.3))], ["trophy", "A TROPHY", pays(p(r => r[2], 0.25))], ["legend", "A LEGENDARY", pays(p(r => r[3], 0.08))]];
}
function betLabel(b) { return b.k === "over" ? "OVER " + b.line : b.k === "under" ? "UNDER " + b.line : b.k === "floor" ? "FLOOR" : b.k === "trophy" ? "TROPHY" : "LEGEND"; }
function openBet() {
  claimDaily();
  const q = tav(), o = betOdds();
  let sel = 0, stake = 10;
  if (q.bet && !q.bet.cast) { sel = Math.max(0, o.findIndex(r => r[0] === q.bet.k)); stake = q.bet.stake; q.chips += q.bet.stake; q.bet = null; saveStore(); }   // re-open: the stake comes back first
  TAV.bet = { opts: o, sel, stake: stakeStep(stake, 0) };
  openOverlay("bet");
}
function placeBet() {
  const b = TAV.bet, q = tav(), [k, , pays] = b.opts[b.sel];
  if (q.chips < b.stake || b.stake < 5) { play("miss"); return; }
  q.chips -= b.stake; q.bet = { k, stake: b.stake, pays, line: betLine(), cast: false };
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
  const deep = dive.catch.length === C.CAPACITY && dive.catch.every(c => (c[3] || 0) >= 400);
  let won = { over: dive.total > b.line, floor: dive.bottom, trophy: dive.catch.some(c => c[2]), legend: dive.catch.some(c => SPEC[c[0]][7]) }[b.k];
  if (b.k === "under") {
    if (dive.total >= b.line) won = false;
    else if (!deep) { addChips(b.stake); return ["BET VOID: STAKE BACK", 4, CHIP]; }    // under only counts on a real dive
    else won = true;
  }
  if (!won) { saveStore(); return ["BET LOST", 3, ORANGE]; }
  const pay = Math.floor(b.stake * b.pays);
  addChips(pay, "win");
  if (b.pays >= 8) tavAward("longshot");
  return ["BET WON! +" + pay + " CHIPS", 4.5, CHIP];
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
// VIP rules (the back room): bets to 200, a legendary card pays 2 to 1, ties push. House edge about 0.5-2.6%.
function c21New(vip) { const max = vip ? 200 : MAX_STAKE; TAV.c21 = { vip: !!vip, max, phase: "stake", dealer: [], you: [], hide: true, bet: stakeStep(TAV.c21 && !!TAV.c21.vip === !!vip ? TAV.c21.bet : vip ? 50 : 10, 0, max), msg: "PLACE YOUR BET", t: 0, win: 0 }; }
function c21Deal() {
  const c = TAV.c21;
  if (tav().chips < c.bet || c.bet < 5) { play("miss"); c.msg = "NOT ENOUGH CHIPS"; return; }
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
  const c = TAV.c21, back = Math.floor(c.staked * mult);
  c.phase = "stake"; c.msg = msg; c.win = back - c.staked;
  if (back) addChips(back, back > c.staked ? "win" : "");
  if (back > c.staked) { tav().stats.hands++; tavTitles(); play("chime"); } else if (!back) play("miss");
  c.bet = stakeStep(c.bet, 0, c.max);
}

// ---- the Derby: five fish race with bursts and stalls; each has hidden speed, stamina and burst, and odds to match
function racerStats(rng, vip) { if (vip) return { spd: rng.uniform(0.97, 1.03), sta: rng.uniform(0.65, 0.82), bur: rng.uniform(0.3, 0.7) };   // the VIP field is closer still
  return { spd: rng.uniform(0.94, 1.06), sta: rng.uniform(0.6, 0.85), bur: rng.uniform(0.2, 0.8) }; }   // close enough that every fish has a chance
function myRacer() { const f = tav().fish; return f && { id: f.id, name: f.name, spd: 0.78 + f.lv[0] * 0.045, sta: 0.5 + f.lv[1] * 0.045, bur: f.lv[2] * 0.1, mine: true }; }
function raceStep(r, dt, rng) {                              // move one racer along; -> an event for the commentator, or null
  let ev = null;
  if (r.burst > 0) r.burst -= dt; else if (r.stall > 0) r.stall -= dt;
  else if (rng.random() < r.bur * 0.45 * dt) { r.burst = 0.8; ev = "burst"; }
  else if (rng.random() < (1 - r.sta) * 0.35 * dt) { r.stall = 0.6; ev = "stall"; }
  const tired = 1 - r.pos * (1 - r.sta) * 0.55;
  r.pos += dt / (8.5 * (r.len || 1)) * r.spd * tired * (r.burst > 0 ? 1.7 : r.stall > 0 ? 0.25 : 1);
  return ev;
}
function derbyNew(withMine, vip) {                           // VIP (the back room): seven racers, a longer course, bets to 200
  const rng = RNG((Math.random() * 4294967296) >>> 0), ids = [], racers = [], N = vip ? 7 : 5, len = vip ? 1.5 : 1;
  const mine = withMine && myRacer();
  if (mine) racers.push(mine);
  while (racers.length < N) {
    const id = rng.choice(C21_POOL);
    if (ids.includes(id)) continue;
    ids.push(id); racers.push(Object.assign({ id, name: SPEC[id][1] }, racerStats(rng, vip)));
  }
  racers.forEach(r => { r.len = len; });
  const wins = racers.map(() => 0), sim = RNG(rng.randint(1, 1e9));        // odds from practice races
  for (let n = 0; n < 1500; n++) {
    const rs = racers.map(r => ({ spd: r.spd, sta: r.sta, bur: r.bur, len, pos: 0, burst: 0, stall: 0 }));
    let done = -1;
    while (done < 0) for (let i = 0; i < N && done < 0; i++) { raceStep(rs[i], 0.05, sim); if (rs[i].pos >= 1) done = i; }
    wins[done]++;
  }
  racers.forEach((r, i) => { r.pays = Math.min(50, Math.max(1.1, Math.floor(EDGE / ((wins[i] + 0.5) / 1502.5) * 10) / 10)); r.pos = 0; r.burst = 0; r.stall = 0; });
  const max = vip ? 200 : MAX_STAKE;
  TAV.derby = { vip: !!vip, max, phase: "pick", racers, mine: mine ? 0 : -1, pick: 0, bet: stakeStep(TAV.derby && !!TAV.derby.vip === !!vip ? TAV.derby.bet : vip ? 50 : 10, 0, max), call: "PICK A FISH AND PLACE YOUR BET", t: 0, lead: -1, rng, withMine: !!mine };
}
function derbyGo() {
  const d = TAV.derby;
  if (tav().chips < d.bet || d.bet < 5) { play("miss"); d.call = "NOT ENOUGH CHIPS"; return; }
  addChips(-d.bet); d.phase = "race"; d.t = 0; d.call = "AND THEY'RE OFF!"; play("select");
}
function derbyTick(dt) {
  const d = TAV.derby;
  if (!d || d.phase !== "race") return;
  d.t += dt;
  const say = (txt, k) => { if (!d.lastSay || d.t - d.lastSay > 1.1 || k) { d.call = txt; d.lastSay = d.t; } };
  for (const r of d.racers) {
    const ev = raceStep(r, dt, d.rng);
    if (ev === "burst") say(r.name + " TURNS ON THE JETS!");
    else if (ev === "stall") say(r.name + " STOPS TO LOOK AT A ROCK");
  }
  const order = d.racers.map((r, i) => i).sort((a, b) => d.racers[b].pos - d.racers[a].pos);
  if (order[0] !== d.lead && d.t > 0.8) { d.lead = order[0]; say(d.racers[order[0]].name + " TAKES THE LEAD!"); }
  if (d.racers[order[0]].pos > 0.8 && !d.stretch) { d.stretch = true; say("HERE COMES THE FINISH!", true); }
  const w = order[0];
  if (d.racers[w].pos < 1) return;
  d.phase = "done"; d.winner = w;
  const close = d.racers[order[1]].pos > 0.97;
  d.call = (close ? "PHOTO FINISH! " : "") + d.racers[w].name + " WINS" + (close ? " BY A FIN!" : "!");
  if (d.mine >= 0) {                                        // your own racer's times count toward the tavern board
    const f = tav().fish, mineTime = d.t / Math.max(0.01, d.racers[d.mine].pos);
    f.races++; if (w === d.mine) f.wins++;
    const cs = Math.round(mineTime * 100);
    if (!tav().stats.fast || cs < tav().stats.fast) tav().stats.fast = cs;
  }
  if (w === d.pick) { const pay = Math.floor(d.bet * d.racers[w].pays); addChips(pay, "win"); tav().stats.derbies++; tavTitles(); d.won = pay; play("fanfare"); }
  else { d.won = 0; play("miss"); }
  saveStore(); tavPost();
}

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
  ["BAITER'S BOOGIE", null, "EARN MASTER BAITER", 140, "C4 - E4 G4 A4 - G4 E4 C4 - E4 G4 A4 - G4 - F4 - A4 C5 D5 - C5 A4 G4 - E4 C4 D4 - C4 -", "C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 C2 C3 C2 -"],
  ["FULL LOG", null, "LOG EVERY SPECIES", 120, "G4 - C5 - E5 - G5 - - - E5 - G5 - - - A5 - G5 - E5 - C5 - D5 - E5 - C5 - - - - -", "C3 - - - G2 - - - C3 - - - E3 - - - F2 - - - G2 - - - C3 - - - - - - -"],
  ["LULLABY", null, "PUT THE SLEEPER BACK TO SLEEP", 72, "E4 - G4 - B4 - - - A4 - G4 - E4 - - - D4 - E4 - G4 - - - D4 - E4 - - - - -", "E2 - - - B2 - - - C3 - - - G2 - - - A2 - - - E2 - - - B1 - - - E2 - - -"],
];
const songOwned = i => tav().songs.includes(i);
function earnSong(i) { if (songOwned(i)) return; tav().songs.push(i); saveStore(); if (S) S.popups.push(["NEW SONG: " + SONGS[i][0], 4, CHIP]); }
const FISH_PICKS = ["clown", "koi", "tuna", "sword", "puffer", "bass", "parrot", "ember", "trout", "perch"];
const SHOP_ROWS = [                                         // [label, price (or a function of the save), what it is]
  ["RUMOUR", 30, "A BOTTLE YOU HAVEN'T FOUND"],
  ["BOTTLE MAGNET", 40, "MORE BOTTLES, 5 DIVES"],
  ["TREASURE MAP", 60, "WHERE THIS WEEK'S GOLD BOOT HIDES"],
  ["A STORY", 50, "TIP THE OLD MAN"],
  ["A DERBY FISH", 200, "YOUR OWN RACER"],
  ["JUKEBOX", 150, "MUSIC HERE AND ON THE TITLE"],
  ["DREAM SLEEPER", 20, "FIGHT A GHOST OF IT. PRACTICE ONLY"],
];
function shopRowState(i) {                                  // -> [label shown, price or null, note]
  const q = tav(), [lab, price, note] = SHOP_ROWS[i];
  if (i === 0) return [lab, rumourPool().length ? price : null, rumourPool().length ? note : "NOTHING NEW TO TELL"];
  if (i === 1) return [lab, price, q.magnet ? "ON FOR " + q.magnet + " MORE DIVES" : note];
  if (i === 2) return [lab, q.map === weekString() ? null : price, q.map === weekString() ? "BOOT AROUND " + bootDepth() + " M" : note];
  if (i === 3) return [q.stories ? "STORIES (" + q.stories + ")" : lab, q.stories < STORIES.length ? price : null, q.stories < STORIES.length ? (q.stories ? "TIP HIM FOR THE NEXT ONE" : note) : "THAT'S ALL HE KNOWS"];
  if (i === 4) return [q.fish ? "YOUR RACER" : lab, q.fish ? null : price, q.fish ? q.fish.name + ": TRAIN IT" : note];
  if (i === 6) return store.sec.woke ? [lab, price, note] : ["???", null, "WAKE SOMETHING UP FIRST"];
  return [lab, q.jukebox ? null : price, q.jukebox ? "PICK A SONG" : note];
}
function rumourPool() { return BOTTLES.map((b, i) => i).filter(i => bottleOpen(i) && !store.sec.bottles.includes(i)); }
function bootDepth() { return Math.round(RNG(hashStr("boot" + weekString())).uniform(ZONES[3][1] + 6, ZONES[3][2] - 6)); }
function shopBuy(i) {
  const q = tav(), [, price] = shopRowState(i);
  if (i === 3 && q.stories) { if (price && q.chips >= price) { addChips(-price); q.stories++; play("fanfare"); } TAV.story = q.stories - 1; openOverlay("story"); return; }
  if (i === 4 && q.fish) { openOverlay("myfish"); return; }
  if (i === 5 && q.jukebox) { openOverlay("jukebox"); return; }
  if (price === null) { play("miss"); return; }
  if (q.chips < price) { play("miss"); TAV.say = "COME BACK WITH CHIPS"; return; }
  if (i === 6) { addChips(-price); S.overlay = null; startBoss(true); return; }          // the Dream Sleeper: a practice fight
  addChips(-price); play("fanfare");
  if (i === 0) { const pool = rumourPool(), b = pool[Math.floor(Math.random() * pool.length)]; store.sec.bottles.push(b); findSecret("bottle"); S.overlay = "note"; S.noteIdx = store.sec.bottles.length - 1; S.noteBack = "chipshop"; }
  else if (i === 1) q.magnet += 5;
  else if (i === 2) { q.map = weekString(); TAV.say = "TRY AROUND " + bootDepth() + " M"; }
  else if (i === 3) { q.stories++; TAV.story = q.stories - 1; openOverlay("story"); }
  else if (i === 4) {
    let nm = "";
    try { nm = (window.prompt("NAME YOUR RACER (UP TO 10 LETTERS)", "") || "").toUpperCase().replace(/[^A-Z ]/g, "").trim().slice(0, 10); } catch (e) { /* no prompts here */ }
    q.fish = { name: nm || "SPEEDY", id: FISH_PICKS[Math.floor(Math.random() * FISH_PICKS.length)], lv: [0, 0, 0], races: 0, wins: 0 };
    openOverlay("myfish");
  } else if (i === 5) { q.jukebox = true; openOverlay("jukebox"); }
  saveStore();
}
const trainCost = lv => 30 + lv * 15;

// ---- titles and the shared tavern board
function tavAward(id) { if (award(id) && S) { S.popups.push(["NEW TITLE: " + titleName(id), 5, GOLD]); saveStore(); } }
function tavTitles() {
  const st = tav().stats;
  if (st.stack >= 1000) tavAward("roller");
  if (st.hands >= 25) tavAward("shark");
  if (st.derbies >= 10) tavAward("derbyking");
  if (tav().claims >= 14) tavAward("regular");
}
const BOARDS = [["stack", "BIGGEST STACK"], ["win", "BIGGEST WIN"], ["fast", "FASTEST FISH"]];
function tavPost() {                                         // post a new personal best to the shared board, now and then
  if (!LB.url || !store.name) return;
  const q = tav(), now = Date.now();
  if (now - (q.postedAt || 0) < 20000) return;
  for (const [k] of BOARDS) {
    const v = k === "fast" ? (q.stats.fast ? Math.max(1, 10000 - q.stats.fast) : 0) : q.stats[k];
    if (v <= (q.posted[k] || 0) || (k !== "fast" && v < 100)) continue;
    q.posted[k] = v; q.postedAt = now; saveStore();
    fetch(LB.url + "/tavern/" + k + ".json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: store.name, s: v, t: now }) }).catch(() => {});
  }
}
async function tavLoad(k) {
  TAV.boards[k] = { rows: null, msg: "LOADING..." };
  if (!LB.url) { TAV.boards[k].msg = "NO SHARED BOARD"; return; }
  try {
    const r = await fetch(LB.url + "/tavern/" + k + '.json?orderBy="s"&limitToLast=10');
    if (!r.ok) { TAV.boards[k].msg = "UPDATE THE DATABASE RULES"; return; }
    const d = await r.json() || {};
    TAV.boards[k] = { rows: Object.values(d).filter(e => e && e.n && e.s > 0).sort((a, b) => b.s - a.s).slice(0, 10), msg: "" };
  } catch (e) { TAV.boards[k].msg = "CAN'T REACH THE BOARD"; }
}

// ---- music for the tavern and the title screen
let MUS = { song: -1, step: 0, next: 0 };
function noteHz(n) { const m = /^([A-G])(\d)$/.exec(n); return m ? 440 * Math.pow(2, ({ C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] - 4) * 12) / 12) : 0; }
function tone(f, t0, dur, wave, vol) { const o = AC.createOscillator(), ga = AC.createGain(); o.type = wave; o.frequency.setValueAtTime(f, t0); ga.gain.setValueAtTime(vol, t0); ga.gain.exponentialRampToValueAtTime(0.001, t0 + dur); o.connect(ga); ga.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
function musicTick() {
  const want = AC && tav().jukebox && tav().song >= 0 && songOwned(tav().song) && (S.overlay ? ["tavern", "c21", "derby", "chipshop", "story", "jukebox", "myfish", "tavboard", "vip", "rename"].includes(S.overlay) : S.state === "title") ? tav().song : -1;
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
function tavTick(dt) { c21Tick(dt); derbyTick(dt); musicTick(); }

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
  box(2, y, 16, 15, CHIP); text("-", 10, y + 7, 1, CHIP, "center", null);
  text(stake, 33, y + 7, 1, WHITE, "center", null);
  box(48, y, 16, 15, CHIP); text("+", 56, y + 7, 1, CHIP, "center", null);
  box(68, y, 50, 15, GOLD); text(go, 93, y + 7, 1, GOLD, "center", null);
}
function stakeTap(lx, obj, key, go) { if (lx < 20) { obj[key] = stakeStep(obj[key], -1, obj.max); play("tick"); } else if (lx >= 46 && lx < 66) { obj[key] = stakeStep(obj[key], 1, obj.max); play("tick"); } else if (lx >= 68) go(); }
function chipsLine(y) { const s = tav().chips + " CHIPS", x = 60 - (textW(s, 1) >> 1) + 3; chipIcon(x - 6, y); text(s, x, y, 1, CHIP, "left", null); }
function bestCatches() { return LOGGED.filter(s => store.log[s[0]]).sort((a, b) => store.log[b[0]].rec - store.log[a[0]].rec).slice(0, 2); }
function tavRows() {
  const dr = dailyReady(), r = [["CATCH 21", CHIP], ["THE DERBY", CHIP], ["BUY THINGS", GOLD], [dr ? "TAKE 50 FREE" : "MORE TOMORROW", dr ? LIME : GREY]];
  if (store.sec.sleeper) r.push(["THE BACK ROOM", "#ff6e6e"]);                    // opens once you've beaten the Sleeper
  return r;
}
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
  rect("#6a4428", 0, 60, 120, 9); rect("#8a5c38", 0, 60, 120, 2);                                 // the bar
  text("RUSTY HOOK", 60, 8, 1, GOLD, "center");
  box(96, 2, 22, 11, CYAN); text("TOP", 107, 7, 1, CYAN, "center", null);
  text(TAV.say, 60, 76, 1, WHITE, "center", null);
  chipsLine(88);
  const dr = dailyReady(), rows = tavRows(), [y0, st] = rows.length > 4 ? [94, 18] : [98, 19];
  rows.forEach(([lab, col], i) => { const y = y0 + i * st; box(14, y, 92, 15, col); text(lab, 60, y + 7, 1, col, "center", null); });
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
const derbyLane = d => d.racers.length > 5 ? 15 : 20;
function drawDerby() {
  const d = TAV.derby, t = T;
  for (let i = 0; i < 14; i++) rect(lerpCol([40, 120, 200], [20, 70, 150], i / 13), 0, i * 15, LW, 15);
  const x0 = 16, x1 = LW - 14, n = d.racers.length, LH_ = derbyLane(d), y1 = 22 + n * LH_, by = y1 + 4;
  text(d.vip ? "VIP DERBY" : "THE DERBY", LW / 2, 9, 1, GOLD, "center");
  for (let i = 0; i <= n; i++) for (let x = 0; x < LW; x += 6) rect("#8cc8f0", x, 22 + i * LH_, 3, 1);
  for (let y = 22; y < y1; y += 3) { const o = Math.floor(y / 3) % 2; rect(o ? WHITE : INK, x1, y, 3, 3); rect(o ? INK : WHITE, x1 + 3, y, 3, 3); }   // the finish line
  d.racers.forEach((r, i) => {
    const y = 22 + (LH_ >> 1) + i * LH_, [w, h] = sprSize(r.id), moving = d.phase === "race";
    const x = Math.floor(lerp(x0, x1 - w, Math.min(1, r.pos))) + (moving ? Math.round(Math.sin(t * 8 + i)) : 0);
    if (i === d.pick) rect("#2a5a9a", 0, y - (LH_ >> 1) + 1, LW, LH_ - 1);
    text(String(i + 1), 6, y, 1, i === d.pick ? GOLD : r.mine ? CHIP : WHITE, "center");
    spr(r.id, x, y - (h >> 1) + (moving ? Math.round(Math.sin(t * 6 + i * 2)) : 0), false);
    if (moving) for (let k = 1; k < 4; k++) rect(r.burst > 0 ? WHITE : "#c8ecff", x - k * (r.burst > 0 ? 6 : 4), y + ((k + i) % 2), r.burst > 0 ? 2 : 1, 1);   // its wake
    if (d.phase === "pick") text((r.mine ? r.name.slice(0, 7) + " " : "") + "X" + r.pays, x1 - 4, y, 1, r.mine ? CHIP : GOLD, "right");
    if (d.phase === "done" && i === d.winner) text("WINNER", x - 3, y, 1, GOLD, "right");
  });
  g.save(); g.translate(OX, 0);
  box(2, by, 116, 24, WHITE);
  wrap(d.call, 18).slice(0, 2).forEach((l, i) => text(l, 60, by + 6 + i * 10, 1, WHITE, "center", null));
  if (d.phase === "pick") stakeRow(by + 27, d.bet, "RACE");
  else {
    const r = d.racers[d.pick];
    text("YOU: " + (d.pick + 1) + " " + r.name.slice(0, 13), 60, by + 35, 1, GOLD, "center", null);
    text(d.phase === "done" ? (d.won ? "YOU WIN " + d.won + " CHIPS!" : "NOT THIS TIME") : "BET " + d.bet + " PAYS X" + r.pays, 60, by + 46, 1, CHIP, "center", null);
  }
  if (tav().fish && d.phase === "pick" && !d.vip) { box(8, 172, 104, 11, d.withMine ? CHIP : "#2a4a6a"); text(d.withMine ? "YOUR RACER IS IN" : "RACE YOUR FISH", 60, 177, 1, d.withMine ? CHIP : "#8cb4dc", "center", null); }
  text(d.phase === "race" ? "" : d.phase === "done" ? "TAP FOR ANOTHER RACE" : "TAP HERE TO LEAVE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function drawBet() {                                         // betting on the next dive, from the cast screen
  rect("#08140f", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const b = TAV.bet;
  text("BET ON YOUR DIVE", 60, 8, 1, CHIP, "center", null);
  chipsLine(20);
  b.opts.forEach(([, lab, pays], i) => {
    const y = 29 + i * 17, sel = i === b.sel;
    box(4, y, 112, 15, sel ? CHIP : "#2a4a3c"); text(lab, 8, y + 7, 1, sel ? WHITE : "#a0c8b4", "left", null); text("X" + pays, 112, y + 7, 1, sel ? GOLD : "#8a9a6a", "right", null);
  });
  text(b.opts[b.sel][0] === "under" ? "NEEDS 3 FISH BELOW 400M" : "STAKE", 60, 120, 1, b.opts[b.sel][0] === "under" ? ORANGE : "#a0c8b4", "center", null);
  box(22, 126, 16, 15, CHIP); text("-", 30, 133, 1, CHIP, "center", null);
  text(b.stake, 60, 133, 2, WHITE, "center");
  box(82, 126, 16, 15, CHIP); text("+", 90, 133, 1, CHIP, "center", null);
  text("MAX " + MAX_STAKE + "  WIN " + Math.floor(b.stake * b.opts[b.sel][2]), 60, 148, 1, GREY, "center", null);
  const ok = tav().chips >= b.stake && b.stake >= 5;
  box(20, 156, 80, 16, ok ? GOLD : "#3c4a40"); text(ok ? "PLACE BET" : "NOT ENOUGH CHIPS", 60, 164, 1, ok ? GOLD : GREY, "center", null);
  text("TAP HERE FOR NO BET", 60, 192, 1, WHITE, "center", null);
  g.restore();
}
function drawChipShop() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  text("BUY THINGS", 60, 8, 1, GOLD, "center", null);
  chipsLine(19);
  SHOP_ROWS.forEach((r, i) => {
    const [lab, price] = shopRowState(i), y = 27 + i * 15, sel = i === TAV.shopSel;
    box(4, y, 112, 13, sel ? GOLD : "#5a3a22"); text(lab, 8, y + 6, 1, sel ? WHITE : "#d8c8b0", "left", null);
    if (price !== null) text(price, 112, y + 6, 1, CHIP, "right", null);
  });
  const [, price, note] = shopRowState(TAV.shopSel);
  box(4, 134, 112, 34, GOLD);
  wrap(note, 18).slice(0, 2).forEach((l, i) => text(l, 60, 141 + i * 9, 1, "#e8dcc4", "center", null));
  const opens = (TAV.shopSel === 4 && tav().fish) || (TAV.shopSel === 5 && tav().jukebox);
  const lab = opens ? "TAP AGAIN TO OPEN" : price === null ? (TAV.shopSel === 3 && tav().stories ? "TAP AGAIN TO READ" : "") : (tav().chips >= price ? "TAP AGAIN: BUY " : "NEEDS ") + price;
  if (lab) text(TAV.shopSel === 6 && price !== null && tav().chips >= price ? "DREAM FOR " + price : lab, 60, 160, 1, price !== null && tav().chips < price ? GREY : CHIP, "center", null);
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
function drawJukebox() {
  tavernBg();
  g.save(); g.translate(OX, 0);
  text("JUKEBOX", 60, 8, 1, "#ff8cd2", "center", null);
  chipsLine(19);
  SONGS.forEach((sg, i) => {
    const y = 26 + i * 13, own = songOwned(i), on = tav().song === i, sel = i === TAV.songSel;
    rect(sel ? "#3a2440" : "#24160e", 4, y, 112, 12);
    text(own || sg[1] ? sg[0] : "???", 7, y + 6, 1, on ? "#ff8cd2" : own ? WHITE : GREY, "left", null);
    text(on ? "ON" : own ? "" : sg[1] ? sg[1] : "", 113, y + 6, 1, on ? "#ff8cd2" : CHIP, "right", null);
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
    if (lv < 10) { box(78, y - 4, 38, 15, GOLD); text("+" + trainCost(lv), 97, y + 3, 1, tav().chips >= trainCost(lv) ? GOLD : GREY, "center", null); }
    else text("MAX", 97, y + 3, 1, CHIP, "center", null);
  });
  text(tav().stats.fast ? "BEST TIME " + (tav().stats.fast / 100).toFixed(2) + "S" : "RACE IT IN THE DERBY", 60, 166, 1, GREY, "center", null);
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
    text(k === "fast" ? ((10000 - r.s) / 100).toFixed(2) + "S" : r.s, 112, y, 1, col, "right", null);
  });
  if (b.rows && !b.rows.length) text("NOBODY YET", 60, 50, 1, GREY, "center", null);
  const st = tav().stats, mine = k === "fast" ? (st.fast ? (st.fast / 100).toFixed(2) + "S" : "-") : st[k];
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
  [["VIP CATCH 21", GOLD, "BETS UP TO 200"], ["VIP DERBY", GOLD, "7 RACERS, LONGER"], ["RENAME A FISH", "#ff8cd2", RENAME + " CHIPS"]].forEach(([lab, col, sub], i) => {
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
  const o = S.overlay, back = () => { S.overlay = o === "tavern" ? null : (o === "c21" && TAV.c21.vip) || (o === "derby" && TAV.derby.vip) || o === "rename" ? "vip" : "tavern"; play("back"); };
  if (o === "tavern") {
    if (ly < 15 && lx >= 94) { TAV.board = 0; BOARDS.forEach(([k]) => tavLoad(k)); openOverlay("tavboard"); return true; }
    const nr = tavRows().length, [y0, st] = nr > 4 ? [94, 18] : [98, 19], i = Math.floor((ly - y0) / st);
    if (ly >= y0 && i < nr && (ly - y0) % st < 15 && lx >= 14 && lx < 106) {
      if (i === 4) { TAV.vipSay = "KEEP YOUR VOICE DOWN"; openOverlay("vip"); }
      else if (i === 0) { if (!TAV.c21 || TAV.c21.vip) c21New(false); openOverlay("c21"); }
      else if (i === 1) { if (!TAV.derby || TAV.derby.phase === "done" || TAV.derby.vip) derbyNew(false); openOverlay("derby"); }
      else if (i === 2) { TAV.shopSel = 0; openOverlay("chipshop"); }
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
  if (o === "derby") {
    const d = TAV.derby;
    if (d.phase === "race") return true;
    const L_ = derbyLane(d), n = d.racers.length, by = 22 + n * L_ + 4;
    if (d.phase === "done") { derbyNew(d.withMine, d.vip); return true; }
    if (ly >= 22 && ly < 22 + n * L_) { d.pick = clamp(Math.floor((ly - 22) / L_), 0, n - 1); play("tick"); }
    else if (ly >= by + 25 && ly < by + 44) stakeTap(lx, d, "bet", derbyGo);
    else if (ly >= 170 && ly < 186 && tav().fish && !d.vip) { derbyNew(!d.withMine); play("tick"); }
    else if (ly > 189) back();
    return true;
  }
  if (o === "chipshop") {
    const i = Math.floor((ly - 27) / 15);
    if (ly >= 27 && i < SHOP_ROWS.length) { if (i === TAV.shopSel) shopBuy(i); else { TAV.shopSel = i; play("tick"); } }
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
    const i = Math.floor((ly - 26) / 13);
    if (ly >= 26 && i < SONGS.length) {
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
      const cost = trainCost(f.lv[i]);
      if (tav().chips >= cost) { addChips(-cost); f.lv[i]++; saveStore(); play("chime"); } else play("miss");
    } else if (ly > 186) { S.overlay = "chipshop"; play("back"); }
    return true;
  }
  if (o === "tavboard") {
    if (ly < 17 && (lx < 24 || lx > 96)) { TAV.board = (TAV.board + (lx > 96 ? 1 : BOARDS.length - 1)) % BOARDS.length; play("tick"); }
    else if (ly > 186) back();
    return true;
  }
  if (o === "bet") {
    const b = TAV.bet, i = Math.floor((ly - 29) / 17);
    if (ly >= 29 && i < b.opts.length) { b.sel = i; play("tick"); }
    else if (ly >= 124 && ly < 143) { b.stake = stakeStep(b.stake, lx < 60 ? -1 : 1); play("tick"); }
    else if (ly >= 154 && ly < 174) placeBet();
    else if (ly > 184) { S.overlay = null; play("back"); }
    return true;
  }
  return false;
}
function lineCol(i) {
  const c = LINES[store.eq.line][2];
  if (c[0] !== "@") return c;
  if (c === "@rainbow") return "hsl(" + Math.floor((T * 140 + i * 14) % 360) + ",90%,66%)";
  if (c === "@fire") return "hsl(" + Math.floor(18 + 22 * Math.sin(T * 9 + i * 0.8)) + ",100%," + Math.floor(55 + 10 * Math.sin(T * 13 + i)) + "%)";
  if (c === "@ice") return (i + Math.floor(T * 6)) % 4 ? "#bfeaff" : "#ffffff";
  return (i * 7 + Math.floor(T * 10)) % 9 === 0 ? "#ffd246" : (i + Math.floor(T * 4)) % 5 === 0 ? "#ffffff" : "#a0a8c8";      // sparkle
}
const POKE_SAY = ["HI!", "HELLO!", "YES?", "HEY!", "QUIT IT", "STOP!", "I MEAN IT", "GRR...", "LAST CHANCE"];
function angler(x, y, eq, wl) {                            // the boat, whoever is fishing today, their hat, pet and flag
  const [cw, ch] = sprSize("char" + eq.char), P = S.poke;
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
  spr("char" + eq.char, cx, cy);
  if (eq.hat) { const [hw, hh] = sprSize("hat" + eq.hat); spr("hat" + eq.hat, cx + Math.floor((cw - hw) / 2) + 1, cy - hh + 3); }
  g.restore();
  if (eq.pet) { const [, ph] = sprSize("pet" + eq.pet); spr("pet" + eq.pet, x + 22, y - ph + 2 + (Math.floor(T * 2) % 2)); }
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
  if (lid === "sinker") { disc("#969caa", x, y - 5, 3); rect(WHITE, x - 1, y - 6, 1, 1); }
  else if (lid === "glow") { disc("#ffec78", x, y - 5, 3); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t; rect("#fffabe", x + Math.cos(a) * 6, y - 5 + Math.sin(a) * 6, 1, 1); } }
  else if (lid === "sonar") [3, 6].forEach(r => ring(CYAN, x, y - 3, r + Math.floor(t * 3) % 2));
  else rect("#e65046", x - 1, y - 6, 3, 3);
}
const TITLE_BAR = [["SCORES", CYAN, 0, 39], ["LOG", GOLD, 41, 21], ["SHOP", ORANGE, 64, 27], ["MORE", WHITE, 93, 27]];
function drawHud() {
  const t = T, st = S.state;
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
      lureIcon(i, x + 13, 107);
      for (let k = 0; k < Lu[5]; k++) rect(CYAN, x + 13 - Lu[5] * 3 + k * 6 + 1, 118, 4, 3);
    });
    text(LURES[S.lure][1], 60, 131, 1, GOLD, "center");
    const on = Math.floor(t * 2.5) % 2;
    box(20, 137, 80, 21, on ? WHITE : CYAN); text("CAST", 60, 147, 2, on ? WHITE : CYAN, "center");
    {                                                      // betting on this dive
      const b = tav().bet, bt = b && !b.cast ? betLabel(b) + ": " + b.stake : "";
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
    text(Math.floor(S.hy / M) + " M", 60, 9, 2);
    text("FISH " + S.catch.length + "/" + C.CAPACITY, 60, 23, 1, S.catch.length < C.CAPACITY ? GOLD : LIME);
    const gx = LW - 6 - OX, gy = 34, gh = 150;                   // depth gauge
    rect(INK, gx - 1, gy - 1, 5, gh + 2);
    ZONES.forEach(([, a, b], zi) => rect(ZONE_COL[zi], gx, gy + Math.floor(a / C.MAX_M * gh), 3, Math.floor((b - a) / C.MAX_M * gh) + 1));
    const my = gy + Math.floor(S.hy / M / C.MAX_M * gh);
    poly(WHITE, [[gx - 6, my - 3], [gx - 2, my], [gx - 6, my + 3]]);
    if (tav().map === weekString()) { const by = gy + Math.floor(bootDepth() / C.MAX_M * gh); rect(GOLD, gx - 3, by - 1, 2, 3); }   // the treasure map's mark
    if (st === "down" || st === "rise") {                // the pulse button
      const have = S.pulses > 0, n = LURES[S.lure][5];
      box(2 - OX, 176, 36, 22, have ? CYAN : "#505678"); text("PULSE", 20 - OX, 183, 1, have ? CYAN : "#6e7496", "center", null);
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
  if (st === "fight") {
    const fg = S.fight, leg = SPEC[fg.f.id][7], col = leg ? LEGEND : TROPHY;
    box(8, 104, 104, 68, col);
    if (leg) { g.fillStyle = Math.floor(t * 6) % 2 ? LEGEND : WHITE; g.fillRect(10, 106, 100, 1); g.fillRect(10, 169, 100, 1); g.fillRect(10, 106, 1, 64); g.fillRect(109, 106, 1, 64); }   // legendaries get a flashing double border
    text(leg ? "LEGENDARY!" : "TROPHY!", 60, 111, 1, col, "center", null);
    text(SPEC[fg.f.id][1], 60, 120, 1, WHITE, "center", null);
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
  S.popups.slice(-3).forEach((p, i) => {
    if (p[1] > 0.3 || Math.floor(t * 20) % 2) { const tw = textW(p[0], 1); box(Math.floor(60 - tw / 2) - 4, 40 + i * 13, tw + 8, 11, p[2]); text(p[0], 60, 45 + i * 13, 1, p[2], "center", null); }
  });
  if (st === "haul") {
    const h = S.haul;
    box(6, 84, 108, 112, CYAN);
    text("THE HAUL", 60, 92, 1, CYAN, "center", null);
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
    const k = (S.stT - 0.5) / 0.42, i = Math.floor(k);    // each fish flies out of the water into the boat as it is weighed
    if (i >= 0 && i < h.rows.length) {
      const u = k - i, [w, hh] = sprSize(h.rows[i][0], h.rows[i][3] ? 1.7 : 1), wl = Math.round(-S.cam);
      const fx = Math.floor(lerp(72, 44, u) - w / 2), fy = Math.floor(wl - 4 - Math.sin(u * Math.PI) * 30 - hh / 2);
      spr(h.rows[i][0], fx, fy, false, h.rows[i][3] ? 1.7 : 1);
      g.save(); g.translate(fx, fy); flair(w, hh); g.restore();
    }
  }
  g.restore();
}

const MORE_ROWS = () => [["TASKS", LIME], [store.sec.found.length ? "SECRETS" : "???", store.sec.found.length ? "#c8a0ff" : GREY], ["HELP", CYAN],
  [store.name ? "INITIALS: " + store.name : "SET INITIALS", store.name ? WHITE : GREY], ["SAVE CODE", GOLD]];
function drawMore() {                                      // everything that used to crowd the title screen
  g.save(); g.translate(OX, 0);
  box(6, 30, 108, 150, WHITE); text("MORE", 60, 40, 2, WHITE, "center");
  const left = tasks().d.concat(tasks().w).filter(q => !q.done).length;
  MORE_ROWS().forEach(([lab, col], i) => {
    const y = 56 + i * 21; box(16, y, 88, 17, col); text(lab, 60, y + 8, 1, col, "center", null);
    if (i === 0 && left) { rect(INK, 98, y - 3, 9, 9); rect(GOLD, 99, y - 2, 7, 7); text(left, 102, y + 1, 1, INK, "center", null); }
  });
  text(KEYS ? "ESC TO CLOSE" : "TAP OUTSIDE TO CLOSE", 60, 170, 1, GREY, "center", null);
  g.restore();
}
const SEC_PER = 7;
function rewardName(rw) {
  if (!rw) return "";
  if (rw[0] === "title") return titleName(rw[1]) + " TITLE";
  const n = (rw[0] === "flag" ? DATA.flags : DATA.flair)[rw[1]];
  return rw[0] === "flag" ? (n.includes("FLAG") ? n : n + " FLAG") : n + " FLAIR";
}
function rewardWorn(rw) { return rw[0] === "title" ? store.eq.title === rw[1] : store.eq[rw[0]] === rw[1]; }
function secretAct() {                                     // put the selected secret's reward on, or take it off
  const id = store.sec.found[S.secSel], sc = SECRETS.find(q => q[0] === id), rw = sc && sc[3];
  if (!rw) return;
  if (rw[0] === "title") store.eq.title = rewardWorn(rw) ? "rookie" : rw[1];
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

function drawScores() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  text("HIGH SCORES", 60, 9, 1, GOLD, "center", null);
  ["TODAY", "ALL TIME"].forEach((lab, i) => { const on = S.tab === i; box(6 + i * 55, 18, 53, 14, on ? CYAN : "#3c4264"); text(lab, 32 + i * 55, 25, 1, on ? CYAN : GREY, "center", null); });
  if (!LB.url) {
    text("YOUR BEST: " + store.best + " LB", 60, 60, 1, WHITE, "center", null);
    ["THE SHARED BOARD", "IS NOT SET UP YET.", "SEE README.MD"].forEach((l, i) => text(l, 60, 90 + i * 11, 1, GREY, "center", null));
  } else {
    const rows = (S.tab === 0 ? LB.today : LB.all) || [];
    if (LB.status) text(LB.status, 60, 46, 1, ORANGE, "center", null);
    else if (!rows.length) text(S.tab === 0 ? "NO CATCHES YET TODAY" : "NO SCORES YET", 60, 60, 1, GREY, "center", null);
    rows.forEach((r, i) => {
      const y = 41 + i * 11, col = i === S.scoreSel ? WHITE : i === 0 ? GOLD : r.n === store.name ? CYAN : "#c8d2f0";
      if (i === S.scoreSel) rect("#1e285a", 4, y - 5, 112, 11);
      text(i + 1, 18, y, 1, i < 3 ? GOLD : GREY, "right", null); text(r.n, 26, y, 1, col, "left", null); text(r.s, 112, y, 1, col, "right", null);
    });
    const r = rows[S.scoreSel], h = r && unpackHaul(r.h);            // what was on the hook for the selected score
    if (r) {
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
  ["YOUR TOOLS", ["PULSE (SHIFT)", "SCATTERS NEARBY", "FISH. LURES GIVE", "1 TO 3 PULSES.", "", "SINKER: FAST DROP", "", "GLOW: MORE BIG", "FISH, BUT PULLS", "EVERYTHING IN", "", "SONAR: 3 PULSES"]],
  ["BIG FISH", ["TROPHY: A HUGE FISH", "WITH RED SPARKLES.", "", "LEGENDARY: A GOLD", "AURA AND STARS.", "", "BOTH FIGHT. TAP", "(SPACE) ON GREEN", "BEFORE TIME RUNS", "OUT.", "ONE LEGENDARY", "PER HOOK."]],
  ["THE SEA FLOOR", ["REACH THE FLOOR", "FOR +40 LB.", "", "IF YOUR HOOK ISN'T", "FULL, YOU RISE", "SLOWLY AND CAN", "KEEP FISHING", "UNTIL IT IS."]],
  ["TIME FISH", ["SOME FISH ONLY", "COME OUT AT ONE", "TIME OF DAY:", ""].concat(...["MORNING", "DAY", "DUSK", "NIGHT"].map(td => [td + ":", (SPECIES.find(q => q[6] === td) || ["", "-"])[1]]))],
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
document.getElementById("nameSkip").addEventListener("click", () => closeName(false));
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") closeName(true); e.stopPropagation(); });

function tapAction() {
  if (S.state === "title" && S.stT > 0.25) cast();
  else if (S.state === "fight" && S.stT > 0.35) fightTap();
  else if (S.state === "haul" && S.haul.shown >= S.haul.n && S.stT > S.haul.end + 0.6) finishDive();
}
function pointerPos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LW, (e.clientY - r.top) / r.height * LH]; }
function closeOverlay() {
  if (S.overlay === "help") { store.seenHelp = true; saveStore(); }
  const o = S.overlay;
  S.overlay = o === "note" && S.noteBack ? S.noteBack : (o === "c21" && TAV.c21.vip) || (o === "derby" && TAV.derby.vip) || o === "rename" ? "vip"
    : ["c21", "derby", "chipshop", "tavboard", "vip"].includes(o) ? "tavern" : ["story", "jukebox", "myfish"].includes(o) ? "chipshop" : null;
  play("back");
}
function overlayTap(lx, ly) {
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
    const i = Math.floor((ly - 56) / 21);
    if (lx >= 16 && lx < 104 && i >= 0 && i < 5 && (ly - 56) % 21 < 17) {
      if (i === 0) openOverlay("tasks");
      else if (i === 1) { if (store.sec.found.length) openOverlay("secrets"); else play("miss"); }
      else if (i === 2) openOverlay("help");
      else if (i === 3) { S.overlay = null; askName(); }
      else { S.overlay = null; openSave(); }
    } else if (lx < 6 || lx >= 114 || ly < 30 || ly >= 180) closeOverlay();
    return;
  }
  if (S.overlay === "note") {
    const n = store.sec.bottles.length, d = n > 1 ? arrows(n) : 0;
    if (d) S.noteIdx = (S.noteIdx + d) % n; else closeOverlay();
    return;
  }
  if (ly > 186) { closeOverlay(); return; }
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
    if (d) { S.logPage = (S.logPage + d) % ZONES.length; S.logSel = 0; }
    else if (ly >= 20 && ly < 100) { S.logSel = clamp(Math.floor((ly - 20) / 20) * 4 + Math.floor((lx - 4) / 28), 0, LOGGED.filter(s => s[2] === S.logPage).length - 1); play("tick"); }
  } else if (S.overlay === "scores") {
    if (ly >= 16 && ly < 34) { S.tab = lx < 60 ? 0 : 1; S.scoreSel = -1; play("tick"); }
    else if (ly >= 35 && ly < 146) { const i = Math.floor((ly - 35) / 11), rows = (S.tab === 0 ? LB.today : LB.all) || []; S.scoreSel = i < rows.length ? i : -1; play("tick"); }
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
  if (rx >= OX - 8 && rx < OX + 22 && ly >= wl - 38 && ly < wl) {      // the Rusty Hook
    if (tavOpen()) { TAV.say = dailyReady() ? "FREE CHIPS ON THE BAR" : "WHAT'LL IT BE?"; openOverlay("tavern"); }
    else { S.popups.push(["CLOSED. " + (TAV_OPEN_AT - store.dives) + " DIVES TO GO", 2.4, ORANGE]); play("miss"); }
    return true;
  }
  if (ly < wl) { swipeAt = [rx, ly]; return true; }       // the rest of the sky: swipes and taps there can enter a certain code
  if (ly >= 159 && ly < 173 && lx >= 8 && lx < 106) { openBet(); return true; }
  if (ly >= 96 && ly < 124 && lx >= 6 && lx < 114) { S.lure = clamp(Math.floor((lx - 6) / 27), 0, LURES.length - 1); play("tick"); return true; }
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
  if (S.state === "boss" && BOSS) { if (rx < 40 && ly > 172) bossPulse(); else BOSS.touch = [rx, ly]; return; }
  if (S.overlay) { overlayTap(lx, ly); return; }
  if (S.state === "title") { if (titleTap(rx, lx, ly)) return; }
  if (S.state === "down" && rx < 16 && ly < 14) { newDive(); return; }          // give up this dive
  if (["down", "rise"].includes(S.state) && rx < 40 && ly > 172) { pulse(); return; }
  if (S.state !== "fight") { S.touchX = KON === "mirror" ? LW - rx : rx; S.drift = 0; }
  tapAction();
});
canvas.addEventListener("pointermove", e => { if (BOSS && BOSS.touch) BOSS.touch = pointerPos(e); if (S.touchX !== null) { const x = pointerPos(e)[0]; S.touchX = KON === "mirror" ? LW - x : x; } });
window.addEventListener("pointerup", e => {
  if (!S) return;
  S.touchX = null;
  if (BOSS) BOSS.touch = null;
  if (swipeAt && S.state === "title" && !S.overlay) {      // a swipe in the sky is an arrow key; a tap is a tap
    const [x, y] = pointerPos(e), dx = x - swipeAt[0], dy = y - swipeAt[1];
    konamiKey(Math.max(Math.abs(dx), Math.abs(dy)) < 8 ? "TAP" : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp"));
  }
  swipeAt = null;
});
function keyDir(e) { return e.code === "ArrowLeft" || e.code === "KeyA" ? -1 : e.code === "ArrowRight" || e.code === "KeyD" ? 1 : 0; }
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
}
document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", e => {
  if (modal.classList.contains("open") || saveModal.classList.contains("open") || !S) return;
  const c = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(c)) e.preventDefault();
  if (e.repeat) return;
  if (c === "KeyF") { toggleFullscreen(); return; }
  if (S.state === "boss" && BOSS) {                        // the fight: move in any direction, Space or Shift to pulse
    const k = { ArrowLeft: "L", KeyA: "L", ArrowRight: "R", KeyD: "R", ArrowUp: "U", KeyW: "U", ArrowDown: "D", KeyS: "D" }[c];
    if (c === "Escape" && BOSS.test) { BOSS = null; newDive(); return; }
    if (k) BOSS.keys.add(k); else if (["Space", "ShiftLeft", "ShiftRight", "Enter"].includes(c)) bossPulse();
    e.preventDefault(); return;
  }
  if (S.state === "title" && konamiKey(c)) { S.overlay = null; return; }   // the Konami code, even with a menu open
  if (S.overlay) {
    if (c === "Escape") closeOverlay();
    else if (c === "Space" || c === "Enter") { if (S.overlay === "shop") shopAct(); else overlayTap(60, S.overlay === "help" ? 100 : 190); }
    else if (keyDir(e)) overlayTap(keyDir(e) > 0 ? 110 : 10, 8);
    return;
  }
  const dir = keyDir(e);
  if (dir) { if (S.state === "title") { S.lure = (S.lure + dir + LURES.length) % LURES.length; play("tick"); } else S.keys.add(KON === "mirror" ? -dir : dir); }
  else if (c === "ShiftLeft" || c === "ShiftRight" || c === "ArrowDown") pulse();
  else if (c === "Space" || c === "Enter" || (c === "ArrowUp" && S.state !== "title")) { tapAction(); }   // Up doesn't cast: it starts a certain code
});
window.addEventListener("keyup", e => { if (BOSS) BOSS.keys.delete({ ArrowLeft: "L", KeyA: "L", ArrowRight: "R", KeyD: "R", ArrowUp: "U", KeyW: "U", ArrowDown: "D", KeyS: "D" }[e.code]); if (S) { S.keys.delete(keyDir(e)); S.keys.delete(-keyDir(e)); } });
window.addEventListener("blur", () => { if (S) S.keys.clear(); });

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
  LB.load();
  window.REEL = { nameOf, renameFish, get TAVs() { return TAV; }, simTick(dt) { T += dt; S.stT += dt; update(dt); }, get BOSS() { return BOSS; }, set BOSS(v) { BOSS = v; }, startBoss, bossPulse, bossUpdate, endBoss, SL_TUNE, slY, c21Sum, c21Tick, raceStep, get TAV() { return TAV; }, set TAV(v) { TAV = v; }, c21New, c21Deal, c21Hit, c21Stand, derbyNew, derbyGo, openBet, placeBet, betOdds, betLine, claimDaily, shopBuy, tavOpen, settleBet, get KON() { return KON; }, set KON(v) { KON = v; }, get EV() { return EV; }, set EV(v) { EV = v; }, findSecret, packSave, unpackSave, events, moonPhase, newDive, finishDive, titleTap, get S() { return S; }, get width() { return LW; }, get store() { return store; }, shopAct, CATS, tasks, land, startFight, beginHaul, step, store, LB, visible, fishRect, pulse, cast, tapAction };   // handy in the console
  requestAnimationFrame(frame);
}
let loaded = 0;
[atlas, water].forEach(img => { img.onload = () => { if (++loaded === 2) start(); }; });
atlas.src = "assets/atlas.png";
water.src = "assets/water.png";
