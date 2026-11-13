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
function catchSound(n) { const f = [392, 440, 494, 523, 587, 659][Math.min(5, n)]; SOUNDS.c = [[f, 0.05, "triangle", 0.35], [f * 1.5, 0.12, "triangle", 0.3, 0, 0.05]]; play("c"); }

// --------------------------------------------------------------- saved data
let store = { log: {}, best: 0, name: "", lure: 0 };
try { store = Object.assign(store, JSON.parse(localStorage.getItem("reeldeep") || "{}")); } catch (e) { /* private window: play without saving */ }
function saveStore() { try { localStorage.setItem("reeldeep", JSON.stringify(store)); } catch (e) { /* ignore */ } }

function dayString(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function timeOfDay() { const h = new Date().getHours(); return h >= 5 && h < 11 ? "MORNING" : h >= 11 && h < 17 ? "DAY" : h >= 17 && h < 21 ? "DUSK" : "NIGHT"; }
function todaysBounty() {                              // one ordinary species is worth triple today, the same one for everybody
  const d = new Date(), pool = SPECIES.filter(s => !s[7] && s[6] === null && s[4] > 0 && s[2] <= 4 && s[5] >= 2).map(s => s[0]);
  return RNG((d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 7 + 1).choice(pool);
}
function zoneOf(m) { for (let i = 0; i < ZONES.length; i++) if (m < ZONES[i][2]) return i; return ZONES.length - 1; }

// ------------------------------------------------------------- leaderboard
const LB = {
  url: (typeof LEADERBOARD_URL === "string" ? LEADERBOARD_URL : "").trim().replace(/\/+$/, ""),
  today: null, all: null, status: "",
  async load() {
    if (!this.url) return;
    this.status = "LOADING...";
    try {
      const [d, a] = await Promise.all([fetch(this.url + "/daily/" + dayString() + ".json").then(r => r.json()), fetch(this.url + "/best.json").then(r => r.json())]);
      const best = {};
      Object.values(d || {}).forEach(e => { if (e && typeof e.s === "number" && !(best[e.n] >= e.s)) best[e.n] = e.s; });
      this.today = Object.entries(best).map(([n, s]) => ({ n, s })).sort((x, y) => y.s - x.s);
      this.all = Object.entries(a || {}).filter(([, v]) => v && typeof v.s === "number").map(([n, v]) => ({ n, s: v.s })).sort((x, y) => y.s - x.s);
      this.status = "";
    } catch (e) { this.status = "CAN'T REACH THE SCORES"; }
  },
  async submit(name, score) {
    if (!this.url || !name || score <= 0) return;
    const post = (path, method, body) => fetch(this.url + path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    try {
      await post("/daily/" + dayString() + ".json", "POST", { n: name, s: score, t: Date.now() });
      const cur = await fetch(this.url + "/best/" + name + ".json").then(r => r.json());
      if (!cur || !(cur.s >= score)) await post("/best/" + name + ".json", "PUT", { s: score, t: Date.now() });
    } catch (e) { this.status = "CAN'T REACH THE SCORES"; return; }
    await this.load();
  },
};

// --------------------------------------------------------------------- game
let S = null, T = 0;

function newDive() {
  const seed = (Math.random() * 4294967296) >>> 0;
  S = {
    seed, rng: RNG(seed), tod: timeOfDay(), bounty: todaysBounty(), lure: clamp(store.lure | 0, 0, LURES.length - 1),
    storm: false, frenzy: null, whaleAt: null, whale: null,
    hx: LW / 2, hy: 4, cam: -74, path: [], catch: [], touchX: null, drift: 0, keys: new Set(),
    state: "title", stT: 0, msg: null, immune: 0, flash: 0, ring: null, fight: null, bottom: false, said: new Set(),
    bubbles: [], popups: [], overlay: null, logPage: 0, logSel: 0, tab: 0, haul: null, zoneSeen: 0, prepared: false, eye: 0,
    chunks: {}, special: {},
  };
  const r = S.rng.random();                              // one thing out of the ordinary on some dives
  S.storm = r < 0.14;
  if (r >= 0.14 && r < 0.32) {
    const z = S.rng.randint(1, 4), a = S.rng.uniform(ZONES[z][1] + 20, ZONES[z][2] - 50);
    const pool = SPECIES.filter(s => s[2] === z && s[4] > 0 && s[5] >= 3 && s[6] === null).map(s => s[0]);
    S.frenzy = [a, a + 30, S.rng.choice(pool), S.rng.choice([-1, 1])];
  } else if (r >= 0.32 && r < 0.45) S.whaleAt = S.rng.uniform(150, 420);
}
function setState(st, msg) { S.state = st; S.stT = 0; S.msg = msg || null; }

function cast() {                                        // the lure is chosen: stock the ocean for it and drop the hook
  const L = LURES[S.lure];
  [S.sink, S.steerK, S.pulses, S.trophyK, S.legendK, S.pull] = L.slice(3);
  store.lure = S.lure; saveStore();
  for (const s of SPECIES) {
    if (!s[7]) continue;
    const a = ZONES[s[2]][1], b = ZONES[s[2]][2], base = C.LEGEND_CHANCE[s[0]] !== undefined ? C.LEGEND_CHANCE[s[0]] : 0.1;
    if (S.rng.random() < Math.min(0.6, base * S.legendK)) {
      let d, x;
      if (s[0] === "chest") { d = S.rng.uniform(326, 434) * M; x = S.rng.uniform(6, LW - 20); }
      else if (s[0] === "pearl") { d = DEPTH_PX - 16; x = OX + S.rng.uniform(20, 76); }
      else { d = S.rng.uniform(a + 12, b - 8) * M; x = S.rng.uniform(10, LW - 60); }
      const k = Math.floor(d / C.CHUNK);
      (S.special[k] = S.special[k] || []).push([s[0], d, x]);
    }
  }
  S.prepared = true;
  setState("down");
  play("plop"); splash(S.hx, 0);
  if (S.storm) S.popups.push(["STORM! BIG FISH ARE UP", 3.0, ORANGE]);
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
      if (s[0] === "tripod") { if (z !== 5) continue; y = DEPTH_PX - 12; }
      out.push({ id: s[0], x: rng.uniform(0, LW - 20), y, v, ph: rng.uniform(0, 6), lb: tr ? lb * 4 + 6 : lb, tr });
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
  if (S.state !== "down" || S.pulses <= 0) return;
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
    if (f.id === "jelly") { f.x += f.v * dt; if (f.x < 4) f.v = Math.abs(f.v); else if (f.x > LW - 14) f.v = -Math.abs(f.v); }
    else if (f.v) {
      const w = fishSize(f)[0];
      f.x += f.v * dt;
      if (S.pull && Math.abs(f.y - S.hy) < 60 && S.state === "down") f.x += clamp(S.hx - (f.x + w / 2), -1, 1) * S.pull * dt;   // the glow draws them in
      if (f.x < -6) f.v = Math.abs(f.v); else if (f.x > LW - w + 6) f.v = -Math.abs(f.v);
    }
  }
  gone.forEach(([i, f]) => removeFish(i, f));
}

function update(dt) {
  S.immune = Math.max(0, S.immune - dt); S.flash = Math.max(0, S.flash - dt);
  if (S.ring !== null) { S.ring += dt; if (S.ring > 0.5) S.ring = null; }
  for (const b of S.bubbles) { b[0] += b[2] * dt; b[1] += b[3] * dt; b[3] += b[6] * dt; b[4] -= dt; }
  S.bubbles = S.bubbles.filter(b => b[4] > 0);
  S.popups.forEach(p => { p[1] -= dt; });
  S.popups = S.popups.filter(p => p[1] > 0);
  swim(dt);
  const diving = ["down", "up", "fight"].includes(S.state);
  if (diving && Math.random() < 0.25) S.bubbles.push([S.hx + rnd(-2, 2), S.hy, rnd(-3, 3), -rnd(14, 30), 1.2, "#c8ecff", 0]);
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
    S.hy += (56 + Math.min(44, S.hy / M * 0.11)) * S.sink * dt;
    while (S.path.length < Math.floor(S.hy / 8) + 1) S.path.push(S.hx);
    const m = S.hy / M, z = zoneOf(m);
    if (z > S.zoneSeen) { S.zoneSeen = z; S.popups.push([ZONES[z][0], 2.0, CYAN]); play("chime", 0.5); }
    if (S.frenzy && m > S.frenzy[0] - 10) say("frenzy", "FEEDING FRENZY!", ORANGE, 2.6);
    if (S.whaleAt && m > S.whaleAt - 22) {
      const d = S.rng.choice([-1, 1]);
      S.whale = { x: d > 0 ? -140 : LW + 12, y: S.whaleAt * M, d }; S.whaleAt = null;
      say("whale", "A WHALE PASSES", CYAN, 2.6);
    }
    const hook = [Math.floor(S.hx) - 2, Math.floor(S.hy) - 2, 5, 6];
    if (S.hy > 10 * M && S.immune <= 0) {
      for (const [i, f] of visible()) {
        if (f.fl || !overlap(hook, fishRect(f))) continue;
        const legend = f.id !== "jelly" && SPEC[f.id][7];
        if (f.id === "jelly") { play("zap"); S.flash = 0.2; setState("turn", "ZAPPED!"); }       // dive over; you keep what's hooked
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
    if (S.state === "down" && S.hy >= C.BOTTOM_M * M) { S.hy = C.BOTTOM_M * M; S.bottom = true; play("chime"); setState("turn", "TOUCHED BOTTOM!"); }
    S.cam += ((S.hy - 78) - S.cam) * Math.min(1, dt * 6);
  } else if (S.state === "fight") {
    const fg = S.fight;
    fg.pos += fg.dir * fg.speed * dt;
    if (fg.pos >= 1 || fg.pos <= 0) { fg.pos = clamp(fg.pos, 0, 1); fg.dir = -fg.dir; }
    fg.shake = Math.max(0, fg.shake - dt);
  } else if (S.state === "turn") { if (S.stT > 0.75) setState("up"); }
  else if (S.state === "up") {
    steer(dt);
    const v = 190 + Math.min(200, S.hy / M * 0.5);
    if (Math.floor(S.hy / 20) !== Math.floor((S.hy - v * dt) / 20)) play("reel", 0.5);
    S.hy -= v * dt;
    S.path.length = Math.max(0, Math.min(S.path.length, Math.floor(S.hy / 8) + 1));
    S.cam += ((S.hy - 128) - S.cam) * Math.min(1, dt * 7);
    if (S.hy <= 2) beginHaul();
  } else if (S.state === "haul") {
    S.cam += (-74 - S.cam) * Math.min(1, dt * 5);
    const h = S.haul;
    while (h.shown < h.n && S.stT > 0.5 + h.shown * 0.42) { h.shown++; play("weigh", 0.8); splash(LW / 2, 0, 5); }
    if (h.shown >= h.n && !h.fanfare && S.stT > h.end) { h.fanfare = true; play(h.bonus || h.record ? "fanfare" : "chime"); }
  }
  S.cam = Math.max(S.cam, -74);
}

function land(i, f) {
  removeFish(i, f);
  S.catch.push([f.id, f.lb, f.tr]);
  catchSound(S.catch.length - 1);
  splash(S.hx, S.hy, 6, "#c8ecff");
  const legend = SPEC[f.id][7];
  if (legend) { S.flash = 0.35; S.popups.push(["LEGENDARY!", 2.4, GOLD], [SPEC[f.id][1], 2.4, GOLD]); play("fanfare"); }
  else if (f.tr) { S.flash = 0.25; S.popups.push(["TROPHY " + SPEC[f.id][1] + "!", 2.2, ORANGE]); play("chime"); }
  if (S.catch.length >= C.CAPACITY) setState("turn", "FULL HOOK");
  else {
    if (!legend && !f.tr) S.popups.push(["HOOKED " + S.catch.length + "/" + C.CAPACITY, 1.0, GOLD]);
    if (S.state !== "down") setState("down");
  }
}
function startFight(i, f) {
  const legend = SPEC[f.id][7];
  let need = f.id === "ancient" ? 4 : legend ? 3 : 2;
  if (C.FIXED.includes(f.id)) need = 2;
  S.fight = { i, f, need, hits: 0, miss: 0, pos: 0, dir: 1, shake: 0, speed: 1.0 + Math.min(0.9, f.lb / 170), win: [rnd(0.3, 0.7), 0.14] };
  S.touchX = null;
  setState("fight"); play("select");
}
function fightTap() {
  const fg = S.fight;
  if (Math.abs(fg.pos - fg.win[0]) <= fg.win[1]) {
    fg.hits++; fg.shake = 0.25; play("hit");
    if (fg.hits >= fg.need) { S.fight = null; S.immune = 0.5; land(fg.i, fg.f); return; }
    fg.win = [rnd(0.2, 0.8), Math.max(0.08, 0.14 - 0.02 * fg.hits)]; fg.speed *= 1.12;
  } else {
    fg.miss++; play("miss");
    if (fg.miss >= 2) {                                  // it throws the hook and bolts
      S.fight = null;
      if (C.FIXED.includes(fg.f.id)) removeFish(fg.i, fg.f); else scare(fg.f, fg.f.x + 10 >= S.hx ? 1 : -1, 2.0, true);
      S.popups.push(["IT GOT AWAY!", 1.8, RED]); S.immune = 1.0; setState("down");
    }
  }
}
function beginHaul() {
  const rows = [];
  for (const [fid, lb, tr] of S.catch) {
    let e = store.log[fid];
    const isNew = !e;
    if (isNew) e = store.log[fid] = { n: 0, rec: 0 };
    const rec = lb > e.rec;
    e.n++; if (tr) e.star = true; if (rec) e.rec = lb;
    const hot = fid === S.bounty;
    rows.push([fid, hot ? lb * C.BOUNTY_X : lb, hot ? "X" + C.BOUNTY_X : isNew ? "NEW" : rec ? "REC" : "", tr]);
  }
  const ids = S.catch.map(c => c[0]), zones = ids.map(i => SPEC[i][2]), sets = [];
  if (ids.length === 3) {
    if (S.catch.every(c => c[2])) sets.push([3, "TROPHY CASE"]);
    if (new Set(ids).size === 1) sets.push([3, "3 OF A KIND"]);
    if (Math.min(...zones) >= 4) sets.push([2, "DEEP TRIO"]);
    if (new Set(zones).size === 3) sets.push([2, "GRAND TOUR"]);
  }
  if (ids.length - new Set(ids).size === 1) sets.push([1.5, "A PAIR"]);
  sets.sort((a, b) => b[0] - a[0]);
  const bonus = sets[0] || null, base = rows.reduce((a, r) => a + r[1], 0);
  const total = Math.round(base * (bonus ? bonus[0] : 1)) + (S.bottom ? C.BOTTOM_BONUS : 0);
  const extra = [];
  if (bonus) extra.push([bonus[1] + " X" + bonus[0], LIME]);
  if (S.bottom) extra.push(["SEA FLOOR +" + C.BOTTOM_BONUS, CYAN]);
  const record = total > store.best;
  if (record) store.best = total;
  saveStore();
  const n = rows.length + extra.length;
  S.haul = { rows, extra, n, total, shown: 0, bonus, record, fanfare: false, end: 0.5 + n * 0.42 + 0.3 };
  setState("haul"); splash(LW / 2, 0, 14); play("plop");
}
function finishDive() {
  const total = S.haul.total;
  if (total > 0 && LB.url) {
    if (store.name) LB.submit(store.name, total);
    else askName(n => { if (n) LB.submit(n, total); });
  }
  newDive();
}

// --------------------------------------------------------------------- draw
function drawSky() {
  const t = T;
  let [top, bot] = { MORNING: [[255, 190, 150], [170, 214, 250]], DAY: [[90, 170, 250], [170, 222, 255]], DUSK: [[60, 50, 110], [250, 150, 90]], NIGHT: [[8, 12, 40], [30, 44, 96]] }[S.tod];
  if (S.storm) { top = [0, 1, 2].map(i => lerp(top[i], [30, 34, 52][i], 0.75)); bot = [0, 1, 2].map(i => lerp(bot[i], [70, 78, 100][i], 0.7)); }
  const y0 = Math.floor(-S.cam) - 80;
  for (let i = 0; i < 14; i++) rect(lerpCol(top, bot, i / 13), 0, y0 + i * 6, LW, 6);
  if (y0 > 0) rect(lerpCol(top, top, 0), 0, 0, LW, y0);
  if (!S.storm) {
    if (S.tod === "NIGHT") {
      const r = RNG(9);
      for (let i = 0; i < Math.round(26 * LW / UW); i++) { const x = r.randint(0, LW - 1), y = r.randint(0, 59); if ((Math.floor(t * 2) + x) % 7) rect(WHITE, x, y0 + y, 1, 1); }
      disc("#ececd6", LW - 28, y0 + 22, 8); disc(lerpCol(top, top, 0), LW - 25, y0 + 20, 7);
    } else { const sy = { MORNING: 56, DAY: 20, DUSK: 62 }[S.tod]; disc("#ffec96", LW - 28, y0 + sy, 9); disc("#fffad6", LW - 28, y0 + sy, 6); }
  }
  const clouds = [[10, 14, 18], [50, 30, 14], [84, 44, 12]].concat(S.storm ? [[30, 8, 30], [70, 20, 26], [100, 12, 24]] : []);
  clouds.forEach(([cx, cy, w], i) => {
    const x = Math.floor((cx * LW / UW + t * (2 + i) * (S.storm ? 4 : 1)) % (LW + 30)) - 20, c = S.storm ? "#3c4256" : S.tod !== "NIGHT" ? WHITE : "#5a6496";
    rect(c, x, y0 + cy, w, 3); rect(c, x + 3, y0 + cy - 2, w - 7, 2);
  });
  poly(lerpCol(bot, [30, 60, 90], 0.6), [[0, y0 + 80], [0, y0 + 70], [16, y0 + 62], [30, y0 + 72], [44, y0 + 80]]);
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

function drawGiant() {                                   // something very large is asleep in the sea floor. It notices the hook.
  const ey = Math.floor(DEPTH_PX + 52 - S.cam);
  if (ey > LH + 20) { S.eye = 0; return; }
  const want = ["down", "turn", "fight"].includes(S.state) && S.hy > 596 * M ? 1 : 0;
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
  const t = T, cam = S.cam, wl = Math.round(-cam), srcY = Math.max(0, Math.round(cam));
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
  const vis = visible();
  for (const [, f] of vis) {
    const sy = f.y - cam;
    if (f.id === "jelly") { const fr = "jelly" + (Math.floor(t * 2 + f.ph) % 2); spr(fr, f.x, sy - sprSize(fr)[1] / 2 + Math.sin(t * 2 + f.ph) * 3); continue; }
    const right = f.fl ? f.fl[0] > 0 : f.v >= 0, [w, h] = fishSize(f);
    let x = Math.floor(f.x);
    const y = Math.floor(sy - h / 2 + Math.sin(t * 3 + f.ph) * 1.5);
    if (S.fight && S.fight.f === f) x += Math.floor(Math.sin(t * 40) * (S.fight.shake > 0 ? 3 : 1));
    spr(f.id, x, y, !right, f.tr ? 1.7 : 1);
    if (f.tr || SPEC[f.id][7]) {                         // trophies and legends sparkle
      const col = f.tr ? ORANGE : GOLD;
      for (let k = 0; k < 3; k++) if (Math.floor(t * 6 + k * 2 + f.ph) % 3 === 0) {
        const px = x + (k * 37 + Math.floor(t * 3)) % Math.max(1, w), py = y + (k * 23 + Math.floor(t * 5)) % Math.max(1, h);
        rect(col, px - 1, py, 3, 1); rect(col, px, py - 1, 1, 3); rect(WHITE, px, py, 1, 1);
      }
    }
    if (f.id === S.bounty && Math.floor(t * 3) % 2) { const bx = x + (w >> 1); rect(INK, bx - 2, y - 7, 5, 6); rect(GOLD, bx - 1, y - 6, 3, 4); rect(INK, bx, y - 5, 1, 2); }   // today's bounty wears a tag
  }
  const diving = ["down", "turn", "up", "fight"].includes(S.state);
  if (diving) {                                          // the line, the hook and whatever is on it
    const pts = wl > -20 ? [[OX + 63, wl - 13]] : [];
    S.path.forEach((x, i) => { const sy = i * 8 - cam; if (sy >= -8 && sy <= S.hy - cam) pts.push([x, sy]); });
    pts.push([S.hx, S.hy - cam - 4]);
    for (let i = 1; i < pts.length; i++) line("#ecf0fa", pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    const hx = Math.floor(S.hx), hy = Math.floor(S.hy - cam), lid = LURES[S.lure][0];
    spr("hook", hx - 1, hy - 4);
    if (lid === "sinker") disc("#969caa", hx, hy - 7, 2);
    else if (lid === "glow") disc(Math.floor(t * 6) % 2 ? "#fffa96" : "#ffdc5a", hx, hy - 6, 2);
    else if (lid === "sonar") rect(CYAN, hx - 1, hy - 8, 3, 2);
    S.catch.forEach(([fid, , tr], i) => {                // the bunch dangles nose-up
      const a = DATA.atlas[fid], [w, h] = sprSize(fid, tr ? 1.7 : 1), ox = (i % 2 ? -1 : 1) * (2 + (i % 3)) + Math.sin(t * 9 + i * 1.7) * 1.5;
      g.save(); g.translate(Math.floor(hx + ox - h / 2), hy + 2 + i * 4 + w); g.rotate(-Math.PI / 2);
      g.drawImage(atlas, a[0], a[1], a[2], a[3], 0, 0, w, h); g.restore();
    });
    if (S.ring !== null) { const r = Math.floor(8 + S.ring * 130); ring(CYAN, hx, hy, r); if (r > 12) ring(WHITE, hx, hy, r - 8); }
  }
  for (const b of S.bubbles) { const sy = Math.floor(b[1] - cam); if (sy >= 0 && sy < LH && b[0] >= 0 && b[0] < LW) rect(b[5], b[0], sy, b[6] ? 2 : 1, b[6] ? 2 : 1); }
  // darkness: the deeper you go the less you see, except around lights
  const a = 0.84 * clamp(((diving ? S.hy : 0) / M - 300) / 180, 0, 1);
  if (a > 0.02) {
    dg.globalCompositeOperation = "source-over"; dg.clearRect(0, 0, LW, LH);
    dg.fillStyle = "rgba(0,0,8," + a + ")"; dg.fillRect(0, 0, LW, LH);
    const lights = [[Math.floor(S.hx), Math.floor(S.hy - cam), LURES[S.lure][0] === "glow" ? 56 : 42]];
    for (const [, f] of vis) if (C.GLOWS.includes(f.id) || f.tr) {
      const w = fishSize(f)[0], lx = f.id === "angler" ? f.x + (f.v >= 0 ? w - 3 : 3) : f.x + w / 2;
      lights.push([Math.floor(lx), Math.floor(f.y - cam), ["levi", "ancient", "colossal"].includes(f.id) ? 26 : 13]);
    }
    DATA.vents.forEach(v => lights.push([v[0] - BG_O + OX, Math.floor(v[1] - cam), 16]));
    if (S.eye > 0.05) lights.push([46 + OX, Math.floor(DEPTH_PX + 52 - cam), 20]);
    dg.globalCompositeOperation = "destination-out";
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,0.45)", x, y, r, dg));
    lights.forEach(([x, y, r]) => disc("rgba(0,0,0,1)", x, y, Math.floor(r * 0.68), dg));
    g.drawImage(dark, 0, 0);
  }
  if (wl > -30) {                                        // the surface, boat and angler
    for (let x = 0; x < LW; x += 4) rect(WHITE, x + Math.floor(t * 3) % 4, wl + Math.floor(Math.sin(t * 2 + x * 0.3) * (S.storm ? 2.4 : 1.2)), 2, 1);
    const bob = Math.floor(Math.sin(t * (S.storm ? 3.4 : 2)) * (S.storm ? 3 : 1.5));
    spr("critter", OX + 40, wl - 21 + bob); spr("boat", OX + 30, wl - 9 + bob);
    line("#785432", OX + 50, wl - 12 + bob, OX + 63, wl - 22 + bob);
    if (["title", "haul"].includes(S.state)) line("#ecf0fa", OX + 63, wl - 22 + bob, OX + 63, wl + 2);
  }
  if (S.flash > 0) { g.globalAlpha = 0.6 * Math.min(1, S.flash / 0.2); rect("#ffffc8", 0, 0, LW, LH); g.globalAlpha = 1; }
  if (S.overlay === "log") drawLog(); else if (S.overlay === "scores") drawScores(); else drawHud();
}

function lureIcon(i, x, y) {
  const lid = LURES[i][0], t = T;
  spr("hook", x - 1, y - 1);
  if (lid === "sinker") { disc("#969caa", x, y - 5, 3); rect(WHITE, x - 1, y - 6, 1, 1); }
  else if (lid === "glow") { disc("#ffec78", x, y - 5, 3); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t; rect("#fffabe", x + Math.cos(a) * 6, y - 5 + Math.sin(a) * 6, 1, 1); } }
  else if (lid === "sonar") [3, 6].forEach(r => ring(CYAN, x, y - 3, r + Math.floor(t * 3) % 2));
  else rect("#e65046", x - 1, y - 6, 3, 3);
}

function drawHud() {
  const t = T, st = S.state;
  g.save(); g.translate(OX, 0);                          // menus sit in a 120-wide column in the middle; x = -OX is the screen's left edge
  if (st === "title") {
    [["REEL", CYAN], ["DEEP", GOLD]].forEach(([word, col], i) => text(word, 60, 20 + i * 17 + Math.floor(Math.sin(t * 2.5 + i) * 2), 2, col));
    box(6, 58, 108, 40, CYAN);
    const extra = SPECIES.filter(s => s[6] === S.tod).map(s => s[1]);
    text(extra.length ? S.tod + ": " + extra[0] : S.tod, 60, 66, 1, WHITE, "center", null);
    text("TODAY'S BOUNTY X" + C.BOUNTY_X, 60, 78, 1, GOLD, "center", null);
    text(SPEC[S.bounty][1], 60, 89, 1, GOLD, "center", null);
    LURES.forEach((L, i) => {                            // pick a lure
      const x = 6 + i * 27, sel = i === S.lure;
      rect(sel ? "#1e285a" : INK, x, 104, 26, 32);
      g.fillStyle = sel ? GOLD : "#5a6496"; g.fillRect(x, 104, 26, 1); g.fillRect(x, 135, 26, 1); g.fillRect(x, 104, 1, 32); g.fillRect(x + 25, 104, 1, 32);
      lureIcon(i, x + 13, 116);
      for (let k = 0; k < L[5]; k++) rect(CYAN, x + 13 - L[5] * 3 + k * 6 + 1, 129, 4, 3);
    });
    text(LURES[S.lure][1], 60, 143, 1, GOLD, "center", null);
    text(LURES[S.lure][2], 60, 153, 1, "#c8d2f0", "center", null);
    const on = Math.floor(t * 2.5) % 2;
    box(34, 160, 52, 15, on ? WHITE : CYAN); text("CAST", 60, 168, 1, on ? WHITE : CYAN, "center", null);
    box(2, 180, 44, 16, CYAN); text("SCORES", 24, 188, 1, CYAN, "center", null);
    box(48, 180, 28, 16, WHITE); text(store.name || "NAME", 62, 188, 1, store.name ? WHITE : GREY, "center", null);
    box(78, 180, 40, 16, GOLD); text("LOG", 98, 188, 1, GOLD, "center", null);
    g.restore();
    return;
  }
  if (["down", "turn", "up", "fight"].includes(st)) {
    text(Math.floor(S.hy / M) + " M", 60, 9, 2);
    text("FISH " + S.catch.length + "/" + C.CAPACITY, 60, 23, 1, S.catch.length < C.CAPACITY ? GOLD : LIME);
    const gx = LW - 6 - OX, gy = 34, gh = 150;                   // depth gauge
    rect(INK, gx - 1, gy - 1, 5, gh + 2);
    ZONES.forEach(([, a, b], zi) => rect(ZONE_COL[zi], gx, gy + Math.floor(a / C.MAX_M * gh), 3, Math.floor((b - a) / C.MAX_M * gh) + 1));
    const my = gy + Math.floor(S.hy / M / C.MAX_M * gh);
    poly(WHITE, [[gx - 6, my - 3], [gx - 2, my], [gx - 6, my + 3]]);
    if (st === "down") {                                 // the pulse button
      const have = S.pulses > 0, n = LURES[S.lure][5];
      box(2 - OX, 176, 36, 22, have ? CYAN : "#505678"); text("PULSE", 20 - OX, 183, 1, have ? CYAN : "#6e7496", "center", null);
      for (let k = 0; k < n; k++) rect(k < S.pulses ? CYAN : "#3c4264", 20 - OX - n * 4 + k * 8 + 1, 190, 6, 3);
      box(2 - OX, 2, 12, 10); text("<", 8 - OX, 7, 1, WHITE, "center", null);
    }
    if (S.msg && st === "turn") {
      const sc = textW(S.msg, 2) < 106 ? 2 : 1, tw = textW(S.msg, sc), col = S.msg === "ZAPPED!" ? RED : GOLD;
      box(Math.floor(60 - tw / 2) - 5, 86, tw + 10, 22, col); text(S.msg, 60, 97, sc, col, "center", null);
    }
    if (st === "up" && Math.floor(t * 3) % 2) text("REELING IN!", 60, 184, 1, LIME);
    if (st === "down" && S.hy < 22 * M && Math.floor(t * 3) % 2) text("PICK YOUR " + C.CAPACITY + " FISH", 60 - 3, 166, 1, WHITE);
  }
  if (st === "fight") {
    const fg = S.fight, leg = SPEC[fg.f.id][7], col = leg ? GOLD : ORANGE;
    box(8, 110, 104, 58, col);
    text(leg ? "LEGENDARY!" : "TROPHY!", 60, 118, 1, col, "center", null);
    text(SPEC[fg.f.id][1], 60, 128, 1, WHITE, "center", null);
    const bx = 16, bw = 88;
    rect("#321e32", bx, 136, bw, 8);
    rect("#46dc6e", bx + Math.floor((fg.win[0] - fg.win[1]) * bw), 136, Math.floor(fg.win[1] * 2 * bw), 8);
    const mx = bx + Math.floor(fg.pos * (bw - 1));
    rect(WHITE, mx - 1, 134, 3, 12); rect(INK, mx, 136, 1, 8);
    for (let k = 0; k < fg.need; k++) rect(k < fg.hits ? LIME : "#464c6e", 16 + k * 8, 148, 6, 5);
    for (let k = 0; k < 2; k++) text("X", 100 - k * 8, 151, 1, k < fg.miss ? RED : "#464c6e", "center", null);
    if (Math.floor(t * 4) % 2) text("TAP ON GREEN!", 60, 161, 1, WHITE, "center", null);
  }
  S.popups.slice(-2).forEach((p, i) => {
    if (p[1] > 0.3 || Math.floor(t * 20) % 2) { const tw = textW(p[0], 1); box(Math.floor(60 - tw / 2) - 4, 40 + i * 13, tw + 8, 11, p[2]); text(p[0], 60, 45 + i * 13, 1, p[2], "center", null); }
  });
  if (st === "haul") {
    const h = S.haul;
    box(6, 84, 108, 112, CYAN);
    text("THE HAUL", 60, 92, 1, CYAN, "center", null);
    const rows = h.rows.slice(0, h.shown);
    rows.forEach(([fid, lb, tag, tr], i) => {
      const y = 104 + i * 10, name = ((tr ? "*" : "") + SPEC[fid][1]).slice(0, tag ? 10 : 13);
      text(name, 10, y, 1, SPEC[fid][7] ? GOLD : tr ? ORANGE : WHITE, "left", null);
      if (tag) text(tag, 92, y, 1, tag[0] === "X" ? GOLD : tag === "NEW" ? LIME : "#ff8c32", "right", null);
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
      spr(h.rows[i][0], lerp(72, 44, u) - w / 2, wl - 4 - Math.sin(u * Math.PI) * 30 - hh / 2, false, h.rows[i][3] ? 1.7 : 1);
    }
  }
  g.restore();
}

function drawLog() {
  rect("#080e28", 0, 0, LW, LH);
  g.save(); g.translate(OX, 0);
  const page = SPECIES.filter(s => s[2] === S.logPage);
  box(2, 2, 20, 13, CYAN); text("<", 12, 8, 1, CYAN, "center", null);
  box(98, 2, 20, 13, CYAN); text(">", 108, 8, 1, CYAN, "center", null);
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
    text(s[1], 60, 113, 1, s[7] ? GOLD : WHITE, "center", null);
    text("X" + e.n + " BEST " + e.rec + " LB", 60, 123, 1, CYAN, "center", null);
    text(s[7] ? "LEGENDARY" : e.star ? "* TROPHY CAUGHT" : "NO TROPHY YET", 60, 133, 1, s[7] || e.star ? GOLD : GREY, "center", null);
  } else {
    text("???", 60, 113, 1, GREY, "center", null);
    text(ZONES[s[2]][0] + (s[6] ? " " + s[6] : ""), 60, 123, 1, GREY, "center", null);
    text(s[7] ? "LEGENDARY" : "NOT CAUGHT YET", 60, 133, 1, GREY, "center", null);
  }
  text("CAUGHT " + SPECIES.filter(q => store.log[q[0]]).length + "/" + SPECIES.length, 60, 152, 1, WHITE, "center", null);
  text("TROPHIES " + Object.values(store.log).filter(v => v.star).length + "/" + SPECIES.filter(q => !q[7] && q[4] > 0).length, 60, 163, 1, GOLD, "center", null);
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
    const rows = S.tab === 0 ? LB.today : LB.all;
    if (LB.status) text(LB.status, 60, 46, 1, ORANGE, "center", null);
    else if (rows && !rows.length) text(S.tab === 0 ? "NO CATCHES YET TODAY" : "NO SCORES YET", 60, 60, 1, GREY, "center", null);
    (rows || []).slice(0, 10).forEach((r, i) => {
      const y = 46 + i * 13, me = r.n === store.name, col = i === 0 ? GOLD : me ? CYAN : WHITE;
      text(i + 1, 16, y, 1, i < 3 ? GOLD : GREY, "right", null); text(r.n, 24, y, 1, col, "left", null); text(r.s, 110, y, 1, col, "right", null);
    });
  }
  text("TAP HERE TO CLOSE", 60, 192, 1, WHITE, "center", null);
  g.restore();
}

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
canvas.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { AC = null; } }
  if (AC && AC.state === "suspended") AC.resume();
  const [rx, ly] = pointerPos(e), lx = rx - OX;          // rx: across the whole screen; lx: inside the menu column
  if (S.overlay === "log") {
    if (ly > 184) { S.overlay = null; play("back"); }
    else if (ly < 17 && (lx < 24 || lx > 96)) { S.logPage = (S.logPage + (lx > 96 ? 1 : ZONES.length - 1)) % ZONES.length; S.logSel = 0; play("tick"); }
    else if (ly >= 20 && ly < 100) { S.logSel = clamp(Math.floor((ly - 20) / 20) * 4 + Math.floor((lx - 4) / 28), 0, SPECIES.filter(s => s[2] === S.logPage).length - 1); play("tick"); }
    return;
  }
  if (S.overlay === "scores") {
    if (ly > 184) { S.overlay = null; play("back"); }
    else if (ly >= 16 && ly < 34) { S.tab = lx < 60 ? 0 : 1; play("tick"); }
    return;
  }
  if (S.state === "title") {
    if (ly >= 104 && ly < 136 && lx >= 6 && lx < 114) { S.lure = clamp(Math.floor((lx - 6) / 27), 0, LURES.length - 1); play("tick"); return; }
    if (ly > 178) {
      if (lx < 47) { S.overlay = "scores"; LB.load(); play("select"); }
      else if (lx < 77) askName();
      else { S.overlay = "log"; play("select"); }
      return;
    }
  }
  if (S.state === "down" && rx < 16 && ly < 14) { newDive(); return; }          // give up this dive
  if (S.state === "down" && rx < 40 && ly > 172) { pulse(); return; }
  if (S.state !== "fight") { S.touchX = rx; S.drift = 0; }
  tapAction();
});
canvas.addEventListener("pointermove", e => { if (S.touchX !== null) S.touchX = pointerPos(e)[0]; });
window.addEventListener("pointerup", () => { if (S) S.touchX = null; });
function keyDir(e) { return e.code === "ArrowLeft" || e.code === "KeyA" ? -1 : e.code === "ArrowRight" || e.code === "KeyD" ? 1 : 0; }
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
}
document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", e => {
  if (modal.classList.contains("open") || !S) return;
  const c = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(c)) e.preventDefault();
  if (e.repeat) return;
  if (c === "KeyF") { toggleFullscreen(); return; }
  if (S.overlay) { if (c === "Escape" || c === "Space" || c === "Enter") S.overlay = null; return; }
  const dir = keyDir(e);
  if (dir) { if (S.state === "title") { S.lure = (S.lure + dir + LURES.length) % LURES.length; play("tick"); } else S.keys.add(dir); }
  else if (c === "ShiftLeft" || c === "ShiftRight" || c === "ArrowDown") pulse();
  else if (c === "Space" || c === "Enter" || c === "ArrowUp") { if (S.state === "down" && !S.keys.size) S.drift = 0; tapAction(); }
});
window.addEventListener("keyup", e => { if (S) S.keys.delete(keyDir(e)); });
window.addEventListener("blur", () => { if (S) S.keys.clear(); });

// --------------------------------------------------------------------- loop
const WATER_COL = [[-2, [120, 206, 250]], [0, [86, 180, 240]], [55, [58, 140, 224]], [110, [36, 128, 160]], [200, [24, 92, 120]], [260, [22, 54, 120]], [320, [16, 34, 84]], [440, [8, 14, 40]], [570, [2, 3, 12]], [660, [1, 1, 6]]];
let pageCol = "";
function tintPage() {                                    // the page around the game takes the colour of the water on screen
  const m = Math.max(-2, (S.cam + 100) / M);
  let col = rgb(WATER_COL[WATER_COL.length - 1][1]);
  for (let i = 1; i < WATER_COL.length; i++) if (m <= WATER_COL[i][0]) { col = lerpCol(WATER_COL[i - 1][1].map(v => v * 0.55), WATER_COL[i][1].map(v => v * 0.55), (m - WATER_COL[i - 1][0]) / (WATER_COL[i][0] - WATER_COL[i - 1][0])); break; }
  if (col !== pageCol) { pageCol = col; document.body.style.background = col; }
}
let wasTitle = null;
function step(dt) {
  T += dt; S.stT += dt; if (!S.overlay) update(dt); draw(); tintPage();
  const title = S.state === "title" && !S.overlay;
  if (title !== wasTitle) { wasTitle = title; document.body.classList.toggle("playing", !title); }   // the key reminder only shows on the title screen
}
let last = 0;
function frame(ms) { const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; step(dt); requestAnimationFrame(frame); }
function start() {
  const c = document.createElement("canvas");
  c.width = atlas.width; c.height = atlas.height;
  const x = c.getContext("2d");
  x.drawImage(atlas, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#2c3660"; x.fillRect(0, 0, c.width, c.height);
  sil = c;
  resize();
  window.addEventListener("resize", resize);
  newDive();
  LB.load();
  window.REEL = { get S() { return S; }, get width() { return LW; }, step, store, LB, visible, fishRect, pulse, cast, tapAction };   // handy in the console
  requestAnimationFrame(frame);
}
let loaded = 0;
[atlas, water].forEach(img => { img.onload = () => { if (++loaded === 2) start(); }; });
atlas.src = "assets/atlas.png";
water.src = "assets/water.png";
