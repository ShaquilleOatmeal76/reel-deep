// Siege of the Deep (the tower defense DLC). Loaded after casino.js and uses game.js's globals (and island.js's isleChar).
// Plan: the Claude Doc "Reel Deep: Siege of the Deep". Kingdom Rush style: a 480x270 screen looking down on the seabed,
// red Flipside currents that fork and merge, round stone pads by the bends, towers built from the sea, waves of Flipside
// creatures, 20 hull at your buoy. game.js hands over while S.state === "siege": update, draw, pointer, keys and resize.
// Art: assets/siege.png + siege_art.js, made by tools/siege_art.py (towers, guardians, the Admiral). Enemies are the
// Flipside sprites (fc_*) recoloured to a flesh palette at start. Nothing here touches score, coins or chips.
const SIW = 480, SIH = 270;
const TEST_SIEGE = (() => { try { const q = new URLSearchParams(location.search); return q.has("siege") ? (q.get("siege") || "0.0") : null; } catch (e) { return null; } })();
let SG = null, SIMG = null, FLESH = null;
const SART = new Image(); SART.src = "assets/siege.png";

// ---------------------------------------------------------------------------------------------------- the save
function siegeSave() {
  if (!store.siege) store.siege = {};
  const q = store.siege;
  for (const [k, v] of [["v", 1], ["stars", {}], ["badges", {}], ["xp", 0], ["kit", 0], ["res", {}], ["seen", []], ["done", 0]]) if (q[k] === undefined) q[k] = v;
  return q;
}

// ---------------------------------------------------------------------------------------------------- painting
// The seabed is painted once per map onto its own canvas with crisp pixel shapes (no smoothing anywhere).
function sPainter(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d");
  const P = {
    c, x,
    rect(a, b, ww, hh, col) { x.fillStyle = col; x.fillRect(Math.floor(a), Math.floor(b), ww, hh); },
    px(a, b, col) { x.fillStyle = col; x.fillRect(Math.floor(a), Math.floor(b), 1, 1); },
    disc(cx, cy, r, col) { x.fillStyle = col; cx = Math.floor(cx); cy = Math.floor(cy); for (let dy = -r; dy <= r; dy++) { const ww = Math.floor(Math.sqrt(r * r - dy * dy)); x.fillRect(cx - ww, cy + dy, 2 * ww + 1, 1); } },
    ell(cx, cy, rx, ry, col) { x.fillStyle = col; for (let j = -ry; j <= ry; j++) { const ww = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2))); x.fillRect(Math.round(cx - ww), Math.round(cy + j), 2 * ww + 1, 1); } },
    line(x0, y0, x1, y1, col, wd) {
      x.fillStyle = col; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) { const t = i / n; x.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), wd || 1, wd || 1); }
    },
    poly(pts, col) {                                        // scanline fill, so edges stay crisp
      x.fillStyle = col;
      const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let yy = y0; yy <= y1; yy++) {
        const xs = [], cy = yy + 0.5;
        for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax)); }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) x.fillRect(Math.round(xs[i]), yy, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
      }
    },
  };
  return P;
}
const sShade = (col, k) => { const m = col.match(/\w\w/g).map(h => parseInt(h, 16)); return "#" + m.map(v => clamp(Math.round(v * k), 0, 255).toString(16).padStart(2, "0")).join(""); };
function catmull(pts, n) {                                     // a smooth curve through the control points
  n = n || 14;
  const out = [], P = [pts[0]].concat(pts, [pts[pts.length - 1]]);
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function polyline(pts) {                                       // [[x, y]...] -> {pts, len: cumulative lengths, total}
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
function atS(pl, s) {                                          // the point s pixels along, and which way it is heading
  const { pts, len } = pl;
  if (s <= 0) return [pts[0][0], pts[0][1], pts[1][0] >= pts[0][0]];
  let lo = 0, hi = len.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= s) lo = m; else hi = m; }
  const k = clamp((s - len[lo]) / Math.max(1e-6, len[hi] - len[lo]), 0, 1), a = pts[lo], b = pts[hi];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, b[0] >= a[0]];
}
const inRange = (ax, ay, bx, by, r) => { const dx = bx - ax, dy = (by - ay) / 0.7; return dx * dx + dy * dy <= r * r; };   // ranges are ellipses: you look down at an angle

// ---------------------------------------------------------------------------------------------------- themes and zones
// Zones top to bottom (the real ocean's order). Each has a look for its seabed and how dark it is.
const SZ = [
  { name: "SHALLOWS", sand: "#dccc9c", sand2: "#ccb888", sand3: "#ecdeb4", deep: "#3c96c8", trench: "#a89268", edge: "#806c4e", rock: "#646070", rockTop: "#8c8896", grass: "#46a05a", deco: ["kelp", "coral", "star"], dark: 0 },
  { name: "KELP FOREST", sand: "#b8b88c", sand2: "#a4a87c", sand3: "#c8c89c", deep: "#28786e", trench: "#8c8460", edge: "#646044", rock: "#585c5c", rockTop: "#7c8480", grass: "#3c8c50", deco: ["kelp", "kelp", "kelp", "star"], dark: 0 },
  { name: "CORAL REEF", sand: "#e4d4b0", sand2: "#d4c098", sand3: "#f0e4c8", deep: "#2c8cc8", trench: "#b09a74", edge: "#86704e", rock: "#9a6a7c", rockTop: "#c08ca0", grass: "#5ab48c", deco: ["coral", "coral", "fan", "star"], dark: 0 },
  { name: "TWILIGHT", sand: "#7a84a4", sand2: "#6a7494", sand3: "#8a94b4", deep: "#1c2c5c", trench: "#5c6484", edge: "#444c68", rock: "#4c5068", rockTop: "#666c88", grass: "#4c7c84", deco: ["kelp", "rock", "glow"], dark: 0.25 },
  { name: "THE WRECK", sand: "#6c6a7c", sand2: "#5e5c6e", sand3: "#7c7a8c", deep: "#161c3c", trench: "#4e4a5a", edge: "#3a3644", rock: "#5a4a40", rockTop: "#7a6450", grass: "#46645c", deco: ["plank", "barrel", "rock"], dark: 0.35 },
  { name: "THE ABYSS", sand: "#4a4458", sand2: "#3e384c", sand3: "#565068", deep: "#0e0e22", trench: "#30283c", edge: "#241e30", rock: "#3a3448", rockTop: "#544c64", grass: "#3c5054", deco: ["rock", "glow"], dark: 0.8 },
  { name: "CRYSTAL CAVES", sand: "#4c4870", sand2: "#403c62", sand3: "#5a5680", deep: "#140e30", trench: "#36304e", edge: "#28223c", rock: "#4a4a74", rockTop: "#6c70a8", grass: "#4a6c8c", deco: ["crystal", "crystal", "rock"], dark: 0.55 },
  { name: "VENT FIELDS", sand: "#5c4440", sand2: "#4e3834", sand3: "#6c504a", deep: "#2a0e0e", trench: "#3e2a26", edge: "#2c1c1a", rock: "#4a3a36", rockTop: "#6a5048", grass: "#6a5a3c", deco: ["vent", "rock"], dark: 0.5 },
  { name: "BONE YARD", sand: "#5a5650", sand2: "#4c4842", sand3: "#6a665e", deep: "#161414", trench: "#3e3a34", edge: "#2c2a26", rock: "#58544c", rockTop: "#7a7468", grass: "#4c5040", deco: ["bone", "bone", "rock"], dark: 0.55 },
  { name: "THE TRENCH", sand: "#3e3a4c", sand2: "#343042", sand3: "#4a4658", deep: "#08080e", trench: "#2a2636", edge: "#1c1a26", rock: "#34303e", rockTop: "#4c4858", grass: "#3a4048", deco: ["rock", "glow"], dark: 0.7 },
  { name: "THE FLOOR", sand: "#4c3440", sand2: "#402a36", sand3: "#5a404c", deep: "#1a0610", trench: "#38222c", edge: "#28161e", rock: "#4a3440", rockTop: "#684a58", grass: "#5a3c48", deco: ["flesh", "rock", "glow"], dark: 0.45 },   // lit red by the crack: dim, not dark
];

// ---------------------------------------------------------------------------------------------------- enemies
// [id, sprite, hp, speed px/s, armour (spines and shells), slime (zaps), hull cost, shells, flags]
// flags: f floater (Anemones and Urchins can't reach it), h hidden (needs light), s splits, H heals, S shields, g grabs towers, b brute
const ETYPES = {
  crawler: ["CRAWLER", "fc_crawler", 26, 22, 0, 0, 1, 5, ""],
  runner: ["RUNNER", "fc_tootheel", 16, 44, 0, 0, 1, 5, ""],
  armour: ["ARMOURED", "fc_ribcage", 50, 18, 0.6, 0, 1, 9, ""],
  slimy: ["SLIMY", "fc_blisterfish", 40, 23, 0, 0.6, 1, 7, ""],
  split: ["SPLITTER", "fc_boilleech", 40, 21, 0, 0, 1, 6, "s"],
  leech: ["LEECHLING", "fc_gapgrub", 12, 30, 0, 0, 1, 2, ""],
  float: ["FLOATER", "flurker", 30, 25, 0, 0.2, 1, 7, "f"],
  healer: ["HEALER", "fc_drownedangler", 50, 18, 0.2, 0, 1, 11, "H"],
  shield: ["SHIELD", "fc_eyecluster", 50, 19, 0, 0.3, 1, 11, "S"],
  hidden: ["HIDDEN", "fc_shadowshark", 34, 28, 0, 0, 1, 9, "h"],
  grab: ["GRABBER", "fc_barnaclehand", 60, 20, 0.3, 0, 2, 11, "g"],
  brute: ["BRUTE", "fc_marrowworm", 260, 12, 0.3, 0.2, 5, 30, "b"],
};
for (let z = 0; z < 11; z++) ETYPES["g" + z] = ["GUARDIAN", null, 1000, 9, 0.1, 0.1, 10, 150, "b"];
const E_COST = { crawler: 1, runner: 1, armour: 2.4, slimy: 2, split: 2.4, float: 2, healer: 3.6, shield: 3.2, hidden: 2.8, grab: 3.5, brute: 9 };
// Which enemies each zone brings (new ones get a popup the first time).
const Z_ROSTER = [
  ["crawler", "runner", "armour"], ["crawler", "runner", "armour", "slimy"], ["crawler", "runner", "slimy", "split", "float"],
  ["runner", "armour", "split", "float", "hidden"], ["crawler", "armour", "slimy", "float", "hidden", "grab"],
  ["runner", "armour", "hidden", "healer", "grab"], ["armour", "slimy", "split", "shield", "hidden", "float"],
  ["runner", "slimy", "split", "healer", "shield", "grab"], ["armour", "split", "healer", "shield", "grab", "hidden"],
  ["runner", "float", "hidden", "healer", "shield", "grab"], ["armour", "split", "float", "healer", "hidden", "grab"],
];
const E_TIPS = {
  runner: "RUNNERS ARE FAST. A JELLY COIL SLOWS THEM.", armour: "ARMOURED: SPINES AND SHELLS BOUNCE OFF. ZAP IT.",
  slimy: "SLIMY: ZAPS SLIDE OFF. USE CORAL OR URCHINS.", split: "SPLITTERS BURST INTO TWO WHEN THEY DIE.",
  float: "FLOATERS DRIFT ABOVE THE CURRENT. ANEMONES AND URCHINS CAN'T REACH THEM.", healer: "HEALERS PATCH UP EVERYTHING NEAR THEM. KILL THEM FIRST.",
  shield: "SHIELDS PROTECT WHAT'S NEAR THEM WHILE THEY LIVE.", hidden: "HIDDEN: INVISIBLE UNTIL A LANTERN LIGHTS THEM.",
  grab: "GRABBERS LATCH ONTO TOWERS AND SWITCH THEM OFF.", brute: "BRUTES ARE SLOW AND HUGE. EACH ONE COSTS 5 HULL.",
};

// ---------------------------------------------------------------------------------------------------- towers
// Each tower: name, short note, cost to build, upgrade costs to L2 and L3, the two level-4 specialisations, stats per level.
// Stats: r range, d damage, t seconds between attacks, plus kind-specific numbers. Damage kinds: phys (armour resists), zap (slime resists).
const TW = [
  { id: "coral", name: "CORAL SPITTER", note: "FAST SHOTS", cost: 70, up: [90, 120], kind: "shot", dmg: "phys",
    L: [{ r: 62, d: 6, t: 0.6 }, { r: 66, d: 9, t: 0.55 }, { r: 72, d: 13, t: 0.5 }],
    S: [{ name: "SNIPER CORAL", note: "LONG RANGE, PIERCES ARMOUR", cost: 220, r: 118, d: 46, t: 1.6, pierce: 1 },
        { name: "BRAIN CORAL", note: "SHOOTS 3 AT ONCE", cost: 200, r: 74, d: 12, t: 0.5, multi: 3 }] },
  { id: "urchin", name: "URCHIN MORTAR", note: "AREA DAMAGE", cost: 90, up: [110, 150], kind: "mortar", dmg: "phys",
    L: [{ r: 70, d: 14, t: 2.2, a: 18 }, { r: 74, d: 22, t: 2.1, a: 19 }, { r: 80, d: 32, t: 2.0, a: 20 }],
    S: [{ name: "SPINE STORM", note: "SHELLS BURST INTO SPINES", cost: 240, r: 84, d: 34, t: 2.0, a: 20, cluster: 4 },
        { name: "FIRE URCHIN", note: "LEAVES BURNING GROUND", cost: 240, r: 82, d: 30, t: 2.0, a: 20, burn: 9 }] },
  { id: "anemone", name: "ANEMONE TRAP", note: "GRABS AND HOLDS", cost: 80, up: [90, 120], kind: "trap", dmg: "phys",
    L: [{ r: 38, d: 3, hold: 2, n: 1, t: 2.6 }, { r: 40, d: 5, hold: 2.5, n: 1, t: 2.4 }, { r: 44, d: 7, hold: 3, n: 2, t: 2.2 }],
    S: [{ name: "GIANT ANEMONE", note: "HOLDS 3 FOR LONGER", cost: 230, r: 48, d: 8, hold: 4, n: 3, t: 2.2 },
        { name: "STINGING ANEMONE", note: "STINGS WHAT IT HOLDS", cost: 220, r: 46, d: 20, hold: 3, n: 2, t: 2.0 }] },
  { id: "jelly", name: "JELLY COIL", note: "ZAPS AND SLOWS", cost: 110, up: [120, 150], kind: "zap", dmg: "zap",
    L: [{ r: 58, d: 10, t: 1.1, chain: 2, slow: 0.3 }, { r: 62, d: 15, t: 1.05, chain: 2, slow: 0.35 }, { r: 68, d: 22, t: 1.0, chain: 3, slow: 0.4 }],
    S: [{ name: "STORM BELL", note: "CHAINS TO 6", cost: 260, r: 72, d: 26, t: 1.0, chain: 6, slow: 0.4 },
        { name: "BOX JELLY", note: "POISONS WHAT IT ZAPS", cost: 240, r: 70, d: 18, t: 1.0, chain: 3, slow: 0.4, poison: 10 }] },
  { id: "clam", name: "PEARL CLAM", note: "MAKES SHELLS", cost: 100, up: [100, 120], kind: "clam",
    L: [{ r: 0, inc: 6, t: 8 }, { r: 0, inc: 10, t: 8 }, { r: 0, inc: 15, t: 8 }],
    S: [{ name: "PEARL BANK", note: "MORE SHELLS", cost: 220, r: 0, inc: 26, t: 8 },
        { name: "BLACK PEARL", note: "SHELLS + GUARDS NEARBY TOWERS", cost: 220, r: 54, inc: 16, t: 8, guard: 1 }] },
  { id: "lantern", name: "LANTERN BUOY", note: "LIGHT + RANGE BOOST", cost: 80, up: [80, 100], kind: "light",
    L: [{ r: 64, boost: 0.1 }, { r: 74, boost: 0.12 }, { r: 86, boost: 0.15 }],
    S: [{ name: "LIGHTHOUSE BUOY", note: "BIG LIGHT, CRITICAL HITS", cost: 200, r: 120, boost: 0.15, crit: 0.2 },
        { name: "SONAR BUOY", note: "LIT ENEMIES TAKE MORE", cost: 200, r: 90, boost: 0.15, mark: 0.25 }] },
  { id: "kraken", name: "KRAKEN PIT", note: "HUGE SLAMS", cost: 200, up: [180, 220], kind: "slam", dmg: "phys",
    L: [{ r: 52, d: 60, t: 3.5, a: 20 }, { r: 54, d: 90, t: 3.4, a: 21 }, { r: 58, d: 130, t: 3.3, a: 22 }],
    S: [{ name: "KRAKEN", note: "CRUSHES GUARDIANS", cost: 380, r: 62, d: 260, t: 3.3, a: 24, boss: 2 },
        { name: "MAELSTROM", note: "DRAGS THEM BACK", cost: 340, r: 60, d: 40, t: 4.5, a: 32, drag: 44 }] },
];
function towerStats(t) {                                        // the tower's numbers, with research
  const b = t.spec >= 0 ? TW[t.k].S[t.spec] : TW[t.k].L[t.lv - 1], row = "t" + t.k;
  if (!SG || SG.test || !SG.M) return b;
  const r = resOn(row, "range") ? 1.08 : 1, d = resOn(row, "dmg") ? 1.12 : 1;
  if (r === 1 && d === 1) return b;
  const o = Object.assign({}, b); o.r = b.r * r * (TW[t.k].kind === "light" ? d : 1); if (o.d) o.d = b.d * d; if (o.inc) o.inc = Math.round(b.inc * d); return o;
}
const buildCost = k => Math.round(TW[k].cost * (resOn("t" + k, "cost") ? 0.9 : 1));
const towerKey = t => "t" + t.k + "_" + (t.spec >= 0 ? "AB"[t.spec] : t.lv);
function towerSpent(t) { if (t.spent) return t.spent; const d = TW[t.k]; let n = d.cost; for (let i = 1; i < t.lv; i++) n += d.up[i - 1]; if (t.spec >= 0) n += d.S[t.spec].cost; return n; }

// ---------------------------------------------------------------------------------------------------- maps
// Each map: segments of control points (smoothed), routes made of segments (entrance to buoy), pads, deep pools
// (nothing builds there), scenery, the buoy, and its waves. Coordinates on the 480x270 screen.
const SMAPS = {
  "0.0": { name: "SANDBAR CROSSING", zone: 0, waves: 8, start: 260,
    seg: { A: [[492, 168], [440, 170], [400, 150], [350, 158]], B: [[330, 282], [330, 240], [346, 196], [350, 158]], m: [[350, 158], [310, 128], [280, 108]],
      u: [[280, 108], [240, 98], [196, 112]], l: [[280, 108], [276, 150], [236, 166], [196, 150], [196, 112]],
      t: [[196, 112], [160, 120], [130, 156], [88, 164], [60, 120], [70, 84], [110, 60], [150, 48], [190, 46]] },
    routes: [["A", "m", "u", "t"], ["A", "m", "l", "t"], ["B", "m", "u", "t"], ["B", "m", "l", "t"]],
    pads: [[420, 134], [392, 188], [372, 222], [312, 174], [318, 96], [262, 72], [236, 132], [198, 184], [160, 90], [110, 128], [38, 150], [62, 196], [36, 66], [172, 146], [230, 66]],
    pools: [[395, 60, 70, 34], [120, 228, 60, 28]], buoy: [196, 48], seed: 21 },
  "0.1": { name: "TIDE POOL TANGLE", zone: 0, waves: 10, start: 280,
    seg: { A: [[-10, 210], [40, 206], [86, 186], [120, 150]], B: [[-10, 70], [40, 74], [80, 100], [120, 150]], m: [[120, 150], [170, 160], [214, 142], [240, 110]],
      u: [[240, 110], [270, 70], [320, 64], [360, 90]], l: [[240, 110], [280, 150], [330, 150], [360, 90]],
      t: [[360, 90], [392, 120], [400, 170], [430, 202], [458, 200]] },
    routes: [["A", "m", "u", "t"], ["A", "m", "l", "t"], ["B", "m", "u", "t"], ["B", "m", "l", "t"]],
    pads: [[70, 160], [64, 110], [120, 112], [150, 192], [196, 118], [200, 186], [250, 150], [300, 110], [300, 34], [372, 48], [330, 186], [430, 150], [372, 160], [446, 238], [400, 228], [146, 118]],
    pools: [[60, 250, 50, 20], [446, 36, 36, 18], [180, 240, 40, 18]], buoy: [460, 200], seed: 33, noPadPool: 0 },
  "0.2": { name: "KING CRAB'S COVE", zone: 0, waves: 12, start: 300,
    seg: { A: [[240, 282], [240, 240], [206, 210], [160, 214], [120, 190]], B: [[490, 120], [440, 124], [400, 150], [350, 170], [300, 160]],
      C: [[-10, 140], [30, 140], [70, 160], [120, 190]], m: [[120, 190], [110, 140], [140, 104]], n: [[300, 160], [270, 120], [230, 100], [190, 96], [140, 104]],
      t: [[140, 104], [120, 70], [160, 44], [216, 40], [250, 52]] },
    routes: [["A", "m", "t"], ["C", "m", "t"], ["B", "n", "t"]],
    pads: [[176, 186], [268, 214], [92, 216], [60, 120], [150, 144], [84, 92], [200, 128], [250, 150], [330, 130], [370, 196], [430, 160], [292, 92], [190, 66], [96, 40], [280, 30]],
    pools: [[380, 60, 80, 34], [40, 236, 40, 20], [330, 240, 60, 22], [190, 162, 26, 14]], buoy: [254, 52], seed: 47 },
};

function mapRoutes(M) {                                        // smoothed segments and full routes as polylines
  const seg = {};
  for (const k in M.seg) seg[k] = catmull(M.seg[k], 12);
  const routes = M.routes.map(r => { let pts = []; r.forEach((k, i) => { pts = pts.concat(i ? seg[k].slice(1) : seg[k]); }); return polyline(pts); });
  return { seg, routes };
}


// ---------------------------------------------------------------------------------------------------- zones 2-11 (parts 4-6)
// The other 30 maps are built from layout templates (mirrored and nudged so no two look alike), with pools and pads
// placed by the same rules everywhere (pads clear of the currents, in reach of them, spaced apart, off the HUD) and
// checked by tools/tests/test_siege.py. Each zone adds its twist; the third map of each ends with its guardian.
const TPL = {
  fork: () => ({ seg: SMAPS["0.0"].seg, routes: SMAPS["0.0"].routes, buoy: SMAPS["0.0"].buoy }),
  twin: () => ({ seg: SMAPS["0.1"].seg, routes: SMAPS["0.1"].routes, buoy: SMAPS["0.1"].buoy }),
  tri: () => ({ seg: SMAPS["0.2"].seg, routes: SMAPS["0.2"].routes, buoy: SMAPS["0.2"].buoy }),
  snake: () => ({ seg: { A: [[490, 40], [430, 44], [390, 70], [400, 108]], u: [[400, 108], [380, 150], [320, 162], [270, 134], [220, 108], [170, 112]],
    s: [[400, 108], [330, 96], [270, 78], [220, 76], [170, 112]], t: [[170, 112], [130, 142], [120, 182], [150, 214], [110, 236], [60, 232], [36, 214]] },
    routes: [["A", "u", "t"], ["A", "s", "t"]], buoy: [38, 214] }),
  cross: () => ({ seg: { L: [[-10, 120], [60, 116], [120, 142], [180, 128], [240, 122]], R: [[490, 150], [420, 146], [360, 120], [300, 122], [240, 122]], d: [[240, 122], [236, 158]],
    a: [[236, 158], [186, 184], [196, 222], [240, 236]], b: [[236, 158], [290, 184], [282, 222], [240, 236]] },
    routes: [["L", "d", "a"], ["L", "d", "b"], ["R", "d", "a"], ["R", "d", "b"]], buoy: [240, 238] }),
  spiral: () => ({ seg: { A: [[-10, 44], [80, 40], [200, 36], [330, 40], [430, 64], [450, 130]], B: [[490, 124], [450, 130]],
    C: [[450, 130], [432, 204], [330, 234], [200, 234], [96, 218], [64, 160], [96, 104], [180, 88], [298, 94], [356, 132], [326, 170], [262, 176], [228, 150], [250, 138]] },
    routes: [["A", "C"], ["B", "C"]], buoy: [252, 140] }),
  lanes: () => ({ seg: { U: [[490, 50], [400, 56], [330, 92], [250, 72], [170, 92], [100, 112], [40, 136]], D: [[490, 222], [410, 214], [340, 180], [260, 204], [180, 180], [100, 160], [40, 136]] },
    routes: [["U"], ["D"]], buoy: [38, 136] }),
  walls: () => ({ seg: { a: [[80, -10], [90, 40], [140, 70], [200, 96], [240, 110]], b: [[240, -10], [252, 40], [230, 80], [240, 110]], c: [[400, -10], [390, 40], [340, 70], [280, 96], [240, 110]],
    m: [[240, 110], [196, 150], [270, 182], [222, 212], [240, 236]] }, routes: [["a", "m"], ["b", "m"], ["c", "m"]], buoy: [240, 236] }),
  crack: () => ({ seg: { l: [[240, 132], [180, 150], [120, 192], [60, 172], [52, 110], [100, 70], [170, 56], [240, 44]], r: [[240, 132], [300, 150], [360, 192], [420, 172], [428, 110], [380, 70], [310, 56], [240, 44]] },
    routes: [["l"], ["r"]], buoy: [240, 44], crack: [240, 132] }),
  hook: () => ({ seg: { a: [[440, 282], [430, 222], [400, 162], [340, 112]], B: [[490, 60], [430, 80], [340, 112]], u: [[340, 112], [300, 72], [230, 58], [180, 92]],
    l: [[340, 112], [290, 142], [230, 142], [180, 92]], t: [[180, 92], [120, 112], [90, 160], [110, 210], [70, 236], [36, 230]] },
    routes: [["a", "u", "t"], ["a", "l", "t"], ["B", "u", "t"], ["B", "l", "t"]], buoy: [38, 228] }),
};
// [template, flip x, flip y, name, waves]
const ZMAPS = [
  null,
  [["snake", 1, 0, "SWAYING STRANDS"], ["hook", 0, 0, "THE GREEN MAZE"], ["cross", 0, 0, "THE WITCH'S GROVE"]],
  [["fork", 0, 1, "ANEMONE ALLEY"], ["spiral", 0, 0, "THE RAINBOW RING"], ["tri", 1, 0, "MANTIS HEIGHTS"]],
  [["twin", 1, 0, "THE DIMMING"], ["snake", 0, 0, "LAST LIGHT LANE"], ["hook", 1, 0, "GLOOM RAY'S DEEP"]],
  [["lanes", 0, 0, "BROKEN HULL"], ["lanes", 1, 1, "THE CARGO HOLD"], ["tri", 0, 0, "GHOST SHIP'S GRAVE"]],
  [["twin", 0, 1, "BLACK WATER", 0.85], ["fork", 1, 0, "THE LONG DARK"], ["spiral", 1, 0, "THE GULPER'S MAW"]],
  [["fork", 0, 0, "PRISM PASS"], ["twin", 0, 0, "GEODE GALLERY"], ["cross", 1, 0, "THE QUEEN'S WEB"]],
  [["twin", 1, 1, "SMOKER ROW"], ["lanes", 0, 1, "THE SCALDING"], ["tri", 0, 1, "THE BOILING POT"]],
  [["spiral", 0, 1, "RIBCAGE ROAD"], ["tri", 1, 1, "SKULL HOLLOW"], ["fork", 1, 1, "THE OSSUARY"]],
  [["walls", 0, 0, "THE DROP"], ["walls", 1, 0, "SHEER WALLS"], ["walls", 0, 0, "THE MAW'S THROAT"]],
  [["crack", 0, 0, "THE SEAM"], ["crack", 0, 1, "UNDER THE EYE"], ["crack", 0, 0, "THE SLEEPER WAKES", 0.85]],
];
function tplMap(z, m) {
  const [tp, fx, fy, name] = ZMAPS[z][m], T = TPL[tp](), r = seeded(5000 + z * 10 + m), jit = {};
  const tf = ([x, y]) => {                                          // mirror, then nudge interior points (the same nudge wherever a point is shared)
    let X = fx ? SIW - x : x, Y = fy ? SIH - y : y;
    const key = x + "," + y, edge = x < 0 || x > SIW || y < 0 || y > SIH;
    if (!edge) { if (!jit[key]) jit[key] = [r.randint(-7, 7), r.randint(-6, 6)]; X += jit[key][0]; Y += jit[key][1]; }
    return [X, Y];
  };
  const seg = {}; for (const k in T.seg) seg[k] = T.seg[k].map(tf);
  const last = T.seg[T.routes[0][T.routes[0].length - 1]], end = tf(last[last.length - 1]);
  const M = { name, zone: z, waves: 10 + (m === 2 ? 2 : m), start: 280 + z * 25 + m * 10 + (SZ[z].dark > 0.5 || z === 3 ? 140 : 0), seg, routes: T.routes, buoy: [end[0], end[1] + (fy ? -2 : 2)], seed: 700 + z * 31 + m * 7, auto: 1 };
  if (T.crack) M.crack = tf(T.crack);
  M.ease = ({ lanes: 0.56, crack: 0.6, walls: 0.8 }[tp] || 1) * (ZMAPS[z][m][4] || 1);
  if (tp === "crack" || tp === "lanes") M.start += 200;          // two fronts to hold from the start                 // routes that never meet until the buoy spread your towers thin
  return M;
}
const HUD_KEEP = [[0, 0, 170, 24], [350, 0, 130, 24], [0, 236, 138, 34]];   // pads and buoys stay off the HUD
function autoLayout(M) {                                            // pools in the open, then pads where they cover the most current
  const R = mapRoutes(M), r = seeded(M.seed + 3), pts = []; for (const k in R.seg) for (const p of R.seg[k]) pts.push(p);
  const dRoad = (x, y) => { let d = 1e9; for (const p of pts) { const q = Math.hypot(p[0] - x, p[1] - y); if (q < d) d = q; } return d; };
  M.pools = [];
  for (let tries = 0; tries < 400 && M.pools.length < 3; tries++) {
    const x = r.randint(30, SIW - 30), y = r.randint(40, SIH - 24), d = dRoad(x, y);
    if (d < 46 || M.pools.some(([a, b, rx, ry]) => Math.hypot(a - x, b - y) < rx + 50) || HUD_KEEP.some(([a, b, w, h]) => x > a - 20 && x < a + w + 20 && y > b - 20 && y < b + h + 20)) continue;
    const rx = Math.min(70, d - 14), ry = Math.round(rx * 0.45); if (rx < 22) continue;
    M.pools.push([x, y, rx, ry]);
  }
  const cands = [];
  for (const k in R.seg) {
    const pl = polyline(R.seg[k]);
    for (let s = 6; s < pl.total; s += 7) {
      const [x, y] = atS(pl, s), [x2, y2] = atS(pl, s + 2), a = Math.atan2(y2 - y, x2 - x);
      for (const sd of [-1, 1]) for (const d of [25, 31]) cands.push([x + Math.cos(a + sd * Math.PI / 2) * d, y + Math.sin(a + sd * Math.PI / 2) * d * 0.85]);
    }
  }
  const ok = ([x, y]) => x > 14 && x < SIW - 14 && y > 34 && y < SIH - 10 && dRoad(x, y) >= 19 && !inPool(M, x, y, 6) && Math.hypot(M.buoy[0] - x, M.buoy[1] - y) > 26 && !(M.crack && Math.hypot(M.crack[0] - x, M.crack[1] - y) < 30)
    && !HUD_KEEP.some(([a, b, w, h]) => x > a - 12 && x < a + w + 12 && y > b - 6 && y < b + h + 8);
  const cover = ([x, y]) => { let n = 0; for (const pl of R.routes) for (let s = 0; s < pl.total; s += 6) { const [px, py] = atS(pl, s); if (inRange(x, y - 4, px, py, 62)) n++; } return n + r.random() * 2; };
  const pool = cands.filter(ok).map(c => [c, cover(c)]).sort((a, b) => b[1] - a[1]);
  M.pads = [];
  for (const [c] of pool) { if (M.pads.length >= 15) break; if (M.pads.some(([a, b]) => Math.hypot(a - c[0], (b - c[1]) * 1.4) < 30)) continue; M.pads.push([Math.round(c[0]), Math.round(c[1])]); }
  // the zone's twist, placed along the currents
  const along = (f, k) => { const pl = R.routes[k % R.routes.length]; return atS(pl, pl.total * f).slice(0, 2).map(Math.round); };
  if (M.zone === 1) M.kelp = [along(0.32, 0), along(0.58, 1), along(0.78, 0)];
  if (M.zone === 2) M.rush = [along(0.3, 0), along(0.62, 1)];
  if (M.zone === 7) M.vents = [along(0.25, 0), along(0.5, 1), along(0.72, 0)].map(([x, y], i) => [x, y, i * 2.1]);
  if (M.zone === 4) M.doors = 1;
}
for (let z = 1; z < 11; z++) for (let m = 0; m < 3; m++) { const id = z + "." + m; SMAPS[id] = tplMap(z, m); autoLayout(SMAPS[id]); }

// ---- the guardians: one per zone, at the end of its third map. [hp at the zone's scale, speed, what it does every few seconds]
const GUARD = [
  { hp: 900, spd: 9, every: 7, name: "KING CRAB" }, { hp: 1100, spd: 9, every: 8, name: "KELP WITCH" }, { hp: 1300, spd: 10, every: 5, name: "MANTIS KING" },
  { hp: 1400, spd: 10, every: 12, name: "GLOOM RAY" }, { hp: 1700, spd: 8, every: 8, name: "GHOST SHIP" }, { hp: 1800, spd: 9, every: 6, name: "THE GULPER" },
  { hp: 1900, spd: 10, every: 7, name: "GLASS SPIDER QUEEN" }, { hp: 2100, spd: 9, every: 10, name: "THE BOIL" }, { hp: 1500, spd: 8, every: 99, name: "THE OSSUARY" },
  { hp: 2400, spd: 9, every: 9, name: "THE MAW" }, { hp: 3600, spd: 6, every: 7, name: "THE SLEEPER" },
];
function addGuardian(ri, zz) {
  const z = zz === undefined ? SG.M.zone : zz, d = GUARD[z], e = addEnemy("crawler", ri);
  Object.assign(e, { k: "g" + z, boss: z + 1, hp: Math.round(d.hp * SG.hpK * TUNE.gK), spd: d.spd, arm: z >= 8 ? 0.2 : 0.1, slime: z >= 8 ? 0.2 : 0.1, hull: 10, bounty: 150 + z * 25, fl: "b", gT: d.every * 0.6, lives: z === 8 ? 2 : 0, phase: 1 });
  e.max = e.hp; SG.guard = e;
  siegeTip(d.name + " IS COMING!"); play("growl"); S.shake = 0.6;
  return e;
}
function guardTick(e, dt) {                                         // each guardian breaks a rule
  const G = SG, z = e.boss - 1, d = GUARD[z]; e.gT -= dt;
  if (z === 10) { const ph = e.hp > e.max * 0.66 ? 1 : e.hp > e.max * 0.33 ? 2 : 3; if (ph !== e.phase) { e.phase = ph; siegeTip(ph === 2 ? "THE SLEEPER IS ANGRY!" : "THE SLEEPER IS FURIOUS!"); S.shake = 0.8; play("thunder"); e.spd = 6 + ph * 2; } }
  if (z === 7 && e.heat > 0) e.heat -= dt;
  if (e.gT > 0) return;
  e.gT = z === 10 ? 7 - e.phase : d.every;
  const towers = G.towers.map((t, i) => [t, i]).filter(([t]) => t && !t.gone), near = r => towers.filter(([t]) => inRange(e.x, e.y, t.x, t.y, r)).sort((a, b) => Math.hypot(a[0].x - e.x, a[0].y - e.y) - Math.hypot(b[0].x - e.x, b[0].y - e.y));
  const fxAt = (t, s, col) => { G.fx.push({ k: "dust", x: t.x, y: t.y, t: 0 }); siegePop(t.x, t.y - 28, s, col || RED); };
  if (z === 0) { const n = near(80)[0]; if (n) { n[0].gone = 20; fxAt(n[0], "SNIPPED!"); play("hit"); } }
  else if (z === 1) { const pads = G.M.pads.map((p, i) => i).filter(i => !(G.overgrown || {})[i]); if (pads.length) { const i = pads.sort((a, b) => Math.hypot(G.M.pads[a][0] - e.x, G.M.pads[a][1] - e.y) - Math.hypot(G.M.pads[b][0] - e.x, G.M.pads[b][1] - e.y))[0]; G.overgrown = G.overgrown || {}; G.overgrown[i] = 1; siegePop(G.M.pads[i][0], G.M.pads[i][1] - 20, "OVERGROWN", LIME); } }
  else if (z === 2) { for (const [t] of near(54)) { t.off = Math.max(t.off || 0, 3); } if (near(54).length) { siegePop(e.x, e.y - 40, "PUNCH!", ORANGE); S.shake = 0.2; play("hit"); } }
  else if (z === 3) { G.dim = 5; siegeTip("THE GLOOM RAY DIMS EVERY LIGHT!"); }
  else if (z === 4) { for (let i = 0; i < 3; i++) { const n = addEnemy(i ? "crawler" : "armour", e.ri, Math.max(0, e.s - 4 - i * 6)); n.max = n.hp; } siegePop(e.x, e.y - 40, "BOOM!", ORANGE); play("thunder", 0.5); }
  else if (z === 5) {
    const H = G.hero;
    if (H && !H.dead && Math.hypot(H.x - e.x, H.y - e.y) < 30) { heroHit(H, 9999); siegePop(e.x, e.y - 40, "GULP!", RED); }
    else { const v = G.en.filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 40)[0]; if (v) { v.hp = 0; e.hp = Math.min(e.max, e.hp + e.max * 0.12); siegePop(e.x, e.y - 40, "GULP!", RED); } }
  }
  else if (z === 6) { const n = near(80)[0]; if (n) { n[0].off = Math.max(n[0].off || 0, 5); fxAt(n[0], "WEBBED", "#c8e6ff"); } for (let i = 0; i < 2; i++) addEnemy("leech", e.ri, Math.max(0, e.s - 8 - i * 6)); }
  else if (z === 7) { e.heat = 4; siegePop(e.x, e.y - 40, "THE CURRENT BOILS!", ORANGE); }
  else if (z === 9) { const list = G.M.pads.map((p, i) => i).filter(i => !(G.eaten || {})[i]); if (list.length) { const i = list[Math.floor(Math.random() * list.length)]; G.eaten = G.eaten || {}; G.eaten[i] = 15; siegePop(G.M.pads[i][0], G.M.pads[i][1] - 20, "EATEN!", RED); play("growl", 0.5); } }
  else if (z === 10) {
    for (const [t] of near(70 + e.phase * 15)) t.off = Math.max(t.off || 0, 2 + e.phase);
    G.fx.push({ k: "shock", x: e.x, y: e.y, t: 0, dur: 0.8, r: 70 + e.phase * 15 }); S.shake = 0.5; play("thunder", 0.6);
    for (let i = 0; i < e.phase + 1; i++) { const n = addEnemy(e.phase >= 3 ? "armour" : "crawler", e.ri, Math.max(0, e.s - 8 - i * 7)); n.max = n.hp; }
  }
}
const towerBlocked = (t, i) => t.gone > 0 || (SG.overgrown && SG.overgrown[i]) || (SG.eaten && SG.eaten[i] > 0);
function zoneTick(dt) {                                             // the zone's own rules, every step
  const G = SG, M = G.M;
  if (G.dim > 0) G.dim -= dt;
  G.towers.forEach((t, i) => { if (t && t.gone > 0) { t.gone -= dt; if (t.gone <= 0) { t.gone = 0; siegePop(t.x, t.y - 26, "BACK!", LIME); } } });
  if (G.eaten) for (const i in G.eaten) { G.eaten[i] -= dt; if (G.eaten[i] <= 0) delete G.eaten[i]; }
  if (G.overgrown && G.hero && !G.hero.dead) for (const i in G.overgrown) { const [px, py] = M.pads[i]; if (Math.hypot(G.hero.x - px, G.hero.y - py) < 16) { delete G.overgrown[i]; siegePop(px, py - 20, "CUT FREE", LIME); play("tick"); } }
  if (M.doors) { G.doorT = (G.doorT || 0) + dt; const open = Math.floor(G.doorT / 20) % 2; if (open !== G.door) { if (G.door !== undefined) siegePop(SIW / 2, 40, "THE DOORS SWING!", GOLD); G.door = open; } }
  if (M.vents) for (const v of M.vents) {
    const ph = (G.t + v[2]) % 6, erupt = ph > 4.5;
    if (erupt) { for (const e of G.en) if (e.hp > 0 && !e.fl.includes("f") && Math.hypot(e.x - v[0], (e.y - v[1]) / 0.7) < 16) hurt(e, (e.boss ? 4 : 24) * dt * G.hpK, "phys"); const H = G.hero; if (H && !H.dead && Math.hypot(H.x - v[0], (H.y - v[1]) / 0.7) < 16) heroHit(H, 30 * dt); }
  }
  for (const b of G.bones || []) { b.t -= dt; if (G.hero && !G.hero.dead && Math.hypot(G.hero.x - b.x, G.hero.y - b.y) < 18) { b.t = -1; b.shattered = 1; siegePop(b.x, b.y - 10, "CRUNCH", WHITE); } if (b.t <= 0 && !b.shattered) { const n = addEnemy(b.k, b.ri, b.s); n.hp = n.max = Math.round(n.max * 0.5); n.risen = 1; G.fx.push({ k: "pop", x: b.x, y: b.y, t: 0 }); b.shattered = 1; } }
  if (G.bones) G.bones = G.bones.filter(b => b.t > 0 && !b.shattered);
  const g_ = G.en.find(e => e.boss); if (g_) guardTick(g_, dt);
}
function zoneSpeed(e) {                                             // currents that rush (reef), the Boil's heat
  let k = 1;
  if (SG.M.rush) for (const [x, y] of SG.M.rush) if (Math.hypot(e.x - x, e.y - y) < 26) k *= 1.6;
  const b = SG.guard; if (b && b.hp > 0 && b.heat > 0 && b !== e) k *= 1.3;
  return k;
}
function zoneDark() {                                               // how dark it is now: Twilight darkens wave by wave
  const z = SG.M.zone; let d = SZ[z].dark;
  if (z === 3) d = clamp(0.15 + Math.max(0, SG.wave) * 0.08, 0.15, 0.85);
  if (SG.dim > 0) d = Math.max(d, 0.85);
  return d;
}
function inKelp(e) { return SG.M.kelp && SG.M.kelp.some(([x, y]) => Math.hypot(e.x - x, (e.y - y) / 0.8) < 22); }
function drawZoneUnder() {                                          // twist art under the towers
  const G = SG, M = G.M;
  if (M.rush) for (const [x, y] of M.rush) for (let i = 0; i < 6; i++) { const k = ((G.t * 1.5 + i / 6) % 1); g.globalAlpha = 0.6 * (1 - k); line("#c8f0ff", x - 18 + k * 30, y - 6 + i * 2, x - 12 + k * 30, y - 6 + i * 2); g.globalAlpha = 1; }
  if (M.vents) for (const [x, y, o] of M.vents) {
    const ph = (G.t + o) % 6; ell(INK, x - 9, y - 4, 18, 8); ell("#5a3c34", x - 8, y - 3, 16, 6); ell(ph > 3.5 ? "#ff8c3c" : "#a0503c", x - 4, y - 2, 8, 3);
    if (ph > 3.5 && ph <= 4.5) for (let i = 0; i < 3; i++) disc("#ffb478", x + Math.sin(G.t * 9 + i) * 4, y - 4 - ((G.t * 20 + i * 5) % 10), 1);
    if (ph > 4.5) { g.globalAlpha = 0.75; for (let i = 0; i < 8; i++) disc(i % 2 ? "#ffc864" : "#ff6428", x + Math.sin(i * 2 + G.t * 7) * 5, y - 6 - i * 4, 3 - i * 0.3); g.globalAlpha = 1; }
  }
  if (M.crack) { const [x, y] = M.crack; ell("#ff3c50", x - 16, y - 5, 32, 10); ell("#3c0a14", x - 13, y - 4, 26, 8); g.globalAlpha = 0.4 + 0.3 * Math.sin(G.t * 3); ell("#ff6e78", x - 10, y - 2, 20, 4); g.globalAlpha = 1; }
  for (const b of G.bones || []) { line("#e0d6bc", b.x - 4, b.y, b.x + 4, b.y - 2); line("#e0d6bc", b.x - 3, b.y - 3, b.x + 3, b.y + 1); }
  if (M.doors) {                                                    // the wreck's doors on each route's second half
    G.R.routes.forEach((pl, i) => { const [x, y] = atS(pl, pl.total * 0.18), open = doorOpen(i); rect(INK, x - 6, y - 12, 12, 12); rect(open ? "#3c6e46" : "#6e2832", x - 5, y - 11, 10, 10); rect("#7a5a3c", x - 5, y - 11, 10, 2); text(open ? "OPEN" : "SHUT", x, y - 18, 1, open ? LIME : RED); });
  }
}
function drawZoneOver() {                                           // kelp thickets over the current
  const G = SG, M = G.M;
  if (M.kelp) for (const [x, y] of M.kelp) { const r = seeded(x * 7 + y); for (let i = 0; i < 16; i++) { const px = x + r.randint(-20, 20), py = y + r.randint(-12, 14), h = r.randint(12, 24); for (let j = 0; j < h; j++) rect(j % 5 === 4 ? "#5ab464" : "#2c7a44", px + Math.sin(j / 3 + G.t * 1.4 + i) * 1.5, py - j, 2, 1); } }
}
const doorOpen = ri => !SG.M.doors || ri % 2 === (SG.door | 0);
// the Sleeper, drawn for the siege: the arena's horned, many-eyed hulk, rising through the crack
function drawSleeperSiege(e) {
  const x = Math.round(e.x), y = Math.round(e.y), t = SG.t, ph = e.phase, BODY = "#2a2040", DARKB = "#140e22", LIGHTB = "#3c2c5c";
  g.globalAlpha = 0.3; ell("#000000", x - 34, y - 4, 68, 10); g.globalAlpha = 1;
  for (const sd of [-1, 1]) for (let j = 0; j < 12; j++) { const u = j / 11; disc(j % 3 ? "#1c1430" : "#2a1e44", x + sd * (30 + j * 1.2) + Math.sin(t * 1.6 + j * 0.5 + sd) * (2 + u * 6), y - 6 - j * 4, Math.max(1, Math.round(5 - u * 4))); }
  const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20 * 2 - 1, k = Math.pow(1 - u * u, 0.6); pts.push([x + u * 30, y - 6 - k * 40 + Math.sin(i * 1.3) * 1.2]); }
  poly(DARKB, [[x - 32, y]].concat(pts.map(([a, b]) => [a + (a < x ? -2 : 2), b - 2]), [[x + 32, y]])); poly(BODY, [[x - 30, y]].concat(pts, [[x + 30, y]]));
  for (const u of [-0.7, -0.4, 0, 0.4, 0.7]) { const px = x + u * 30, py = y - 6 - Math.pow(1 - u * u, 0.6) * 40; poly(LIGHTB, [[px - 3, py + 2], [px, py - 9], [px + 3, py + 2]]); rect("#b4a4d4", px, py - 8, 1, 3); }
  for (const sd of [-1, 1]) for (let j = 0; j < 10; j++) { const u = j / 9; disc(j % 3 === 2 ? "#a89c84" : "#d8ccb0", x + sd * (10 + j * 1.6 - u * u * 6), y - 42 - j * 1.8 + u * u * 3, Math.max(1, Math.round(3 - u * 2))); }
  const eyes = [[-12, -30, 4], [12, -30, 4], [0, -22, 3], [-20, -18, 2], [20, -18, 2], [0, -36, 2]].slice(0, 2 + ph * 1 + (ph >= 3 ? 1 : 0));
  for (const [ex, ey, r] of eyes) { disc(INK, x + ex, y + ey, r + 1); disc("#ff503c", x + ex, y + ey, r); rect("#ffdcc8", x + ex - 1, y + ey - 1, 1, 1); }
  if (ph >= 2) { g.globalAlpha = 0.45 + 0.35 * Math.sin(t * (ph >= 3 ? 9 : 4)); for (const fx of [-18, 16]) line("#c83c64", x + fx, y - 12, x + fx + 4, y - 26); g.globalAlpha = 1; }
  const mw = 9, open = ph >= 2 ? 3 : 1; ell("#0a0612", x - mw, y - 12 - open, mw * 2, open * 2);
  for (let k = -mw + 1; k < mw; k += 3) { rect("#f0e6dc", x + k, y - 12 - open, 1, 2); }
}

// ---- the seabed, painted once
function buildBg(M, R) {
  const Z = SZ[M.zone], P = sPainter(SIW, SIH), r = seeded(M.seed);
  P.rect(0, 0, SIW, SIH, Z.sand);
  for (let i = 0; i < 160; i++) { const x = r.randint(-20, SIW), y = r.randint(-20, SIH), rr = r.randint(6, 26); P.ell(x, y, rr, Math.max(2, rr >> 1), r.random() < 0.6 ? Z.sand2 : Z.sand3); }
  for (let i = 0; i < 180; i++) { const x = r.randint(0, SIW), y = r.randint(0, SIH); for (let k = 0; k < 9; k++) P.px(x + k, y + Math.round(Math.sin(k / 9 * Math.PI) * -2), Z.sand2); }
  for (let i = 0; i < 600; i++) P.px(r.randint(0, SIW), r.randint(0, SIH), Z.sand3);
  for (const [cx, cy, rx, ry] of M.pools) {                    // drop-offs into deep water
    const pts = [], ph = r.random() * 6;
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, f = 1 + 0.16 * Math.sin(a * 3 + ph); pts.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]); }
    P.poly(pts, Z.edge);
    P.poly(pts.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.84 + 2]), Z.deep);
    P.poly(pts.map(([x, y]) => [cx + (x - cx) * 0.6, cy + (y - cy) * 0.52 + 4]), sShade(Z.deep, 0.78));
  }
  const dense = Object.values(R.seg).map(sg => { const pl = polyline(sg), out = []; for (let d = 0; d <= pl.total; d += 1.5) out.push(atS(pl, d)); return out; });
  for (const sg of dense) for (const [x, y] of sg) P.disc(x, y, 11, Z.edge);   // the currents' channels
  for (const sg of dense) for (const [x, y] of sg) P.disc(x, y, 9, Z.trench);
  for (const sg of dense) for (const [x, y] of sg) P.disc(x, y, 4, "#b03246");
  for (let i = 0; i < 70; i++) {                               // little tufts and pebbles
    const x = r.randint(0, SIW), y = r.randint(0, SIH);
    if (onRoad(R, x, y, 14) || inPool(M, x, y)) continue;
    for (let k = 0; k < 3; k++) P.line(x + k, y, x + k + r.randint(-2, 2), y - r.randint(3, 6), Z.grass);
  }
  M._deco = [];                                                // scenery that stands up is drawn with the towers, by depth
  const tries = 26 + (Z.deco.includes("kelp") ? 10 : 0);
  for (let i = 0; i < tries; i++) {
    const x = r.randint(6, SIW - 6), y = r.randint(24, SIH - 4), kind = r.random() < 0.3 ? "boulder" : r.choice(Z.deco);
    if (onRoad(R, x, y, 18) || inPool(M, x, y, 6) || M.pads.some(p => Math.hypot(p[0] - x, (p[1] - y) * 1.4) < 22) || Math.hypot(M.buoy[0] - x, M.buoy[1] - y) < 28) continue;
    if (y < 22 && x < 160) continue;
    M._deco.push([kind, x, y, r.randint(0, 9999)]);
  }
  for (const p of M.pads) {                                    // the pads (towers stand on them)
    P.ell(p[0] + 1, p[1] + 3, 13, 6, "rgba(0,0,0,0.25)");
    P.ell(p[0], p[1], 12, 6, INK); P.ell(p[0], p[1], 11, 5, "#6c6674"); P.ell(p[0], p[1] - 1, 9, 4, "#968f9c");
  }
  return P.c;
}
function onRoad(R, x, y, d) { for (const k in R.seg) for (const p of R.seg[k]) if (Math.abs(p[0] - x) < d && Math.abs(p[1] - y) < d && Math.hypot(p[0] - x, p[1] - y) < d) return true; return false; }
function inPool(M, x, y, pad) { pad = pad || 0; return M.pools.some(([cx, cy, rx, ry]) => ((x - cx) / (rx + pad)) ** 2 + ((y - cy) / (ry + pad)) ** 2 < 1.15); }

// Scenery that stands up off the seabed (drawn sorted by depth with towers and enemies)
const DECO_ART = {};
function decoArt(kind, seed, z) {
  const key = kind + seed + "_" + z;
  if (DECO_ART[key]) return DECO_ART[key];
  const Z = SZ[z], r = seeded(seed), P = sPainter(40, 40), dk = Z.dark > 0.5;
  if (kind === "boulder") {
    const w = r.randint(16, 28), h = r.randint(9, 15), x = 20, y = 36;
    P.ell(x + 2, y + 1, w / 2 + 1, 3, "rgba(0,0,0,0.25)");
    const pts = [[x - w / 2, y], [x - w / 3, y - h], [x + w / 4, y - h - 2], [x + w / 2, y - h / 3], [x + w / 2, y + 1], [x - w / 3, y + 2]];
    P.poly(pts.map(([a, b], i) => [a + (a < x ? -1 : 1), b + (b < y - 1 ? -1 : 1)]), INK);
    P.poly(pts, Z.rock);
    P.poly([[x - w / 3 + 1, y - h + 1], [x + w / 4, y - h - 1], [x + w / 2 - 2, y - h / 3], [x - w / 4, y - h / 2]], Z.rockTop);
  } else if (kind === "kelp") {
    for (let k = 0; k < 3; k++) {
      const h = r.randint(16, 30);
      for (let i = 0; i < h; i++) { const px = 17 + k * 3 + Math.sin(i / 3 + k) * 2; P.rect(px, 38 - i, 2, 1, dk ? "#2c5050" : "#388c50"); if (i % 5 === 4) P.ell(px + 1, 38 - i, 2, 1, dk ? "#3c6464" : "#5ab464"); }
    }
  } else if (kind === "coral" || kind === "fan") {
    const cols = ["#f06e5a", "#fa9e46", "#e65a96", "#966ede", "#5ac8b4"];
    for (let k = 0; k < r.randint(3, 5); k++) {
      const c = r.choice(cols), ox = 20 + r.randint(-7, 7), oy = 34 + r.randint(-3, 3);
      if (kind === "fan" || r.random() < 0.5) { for (let j = 0; j < 3; j++) P.line(ox, oy, ox + r.randint(-5, 5), oy - r.randint(6, 11), c, 2); }
      else { P.ell(ox, oy - 2, 4, 3, INK); P.ell(ox, oy - 2, 3, 2, c); }
    }
  } else if (kind === "star") {
    const c = r.random() < 0.5 ? "#f07850" : "#fac85a";
    for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; P.line(20, 34, 20 + Math.cos(a) * 4, 34 + Math.sin(a) * 4, c, 2); }
  } else if (kind === "glow") {
    for (let k = 0; k < 4; k++) { const x = 20 + r.randint(-8, 8), y = 34 + r.randint(-3, 3); P.line(x, y, x + r.randint(-2, 2), y - r.randint(5, 10), "#3c6464"); P.disc(x, y - 10, 1, "#78ffdc"); }
  } else if (kind === "crystal") {
    for (let k = 0; k < 3; k++) { const x = 16 + k * 4 + r.randint(-1, 1), h = r.randint(8, 18); P.poly([[x - 2, 37], [x, 37 - h], [x + 2, 37]], INK); P.poly([[x - 1, 36], [x, 38 - h], [x + 1, 36]], k % 2 ? "#8ce6ff" : "#c0a0ff"); }
  } else if (kind === "vent") {
    P.ell(20, 34, 7, 3, INK); P.ell(20, 33, 6, 2, "#5a3c34"); P.ell(20, 33, 3, 1, "#ff8c3c");
    for (let k = 0; k < 4; k++) P.px(19 + r.randint(-2, 2), 28 - k * 3, "rgba(230,230,240,0.6)");
  } else if (kind === "plank" || kind === "barrel") {
    if (kind === "plank") { P.poly([[8, 34], [30, 30], [32, 33], [10, 37]], INK); P.poly([[9, 34], [30, 31], [31, 32], [10, 36]], "#7a5a3c"); }
    else { P.ell(20, 30, 6, 7, INK); P.ell(20, 30, 5, 6, "#7a5a3c"); P.rect(15, 27, 11, 1, "#4c4c54"); P.rect(15, 33, 11, 1, "#4c4c54"); }
  } else if (kind === "bone") {
    P.line(10, 34, 30, 30, "#e0d6bc", 2); P.disc(10, 34, 2, "#e0d6bc"); P.disc(30, 30, 2, "#e0d6bc");
    if (r.random() < 0.5) { P.disc(22, 26, 4, "#e0d6bc"); P.px(21, 25, INK); P.px(23, 25, INK); }
  } else if (kind === "flesh") {
    for (let k = 0; k < 3; k++) P.line(14 + k * 5, 37, 14 + k * 5 + r.randint(-3, 3), 37 - r.randint(6, 14), "#a03c50", 2);
  } else if (kind === "rock") return decoArt("boulder", seed, z);
  DECO_ART[key] = P.c;
  return P.c;
}

// ---------------------------------------------------------------------------------------------------- waves
// Waves are built from a threat budget that grows wave by wave and map by map, from the zone's roster, the same for
// everyone (seeded by the map). Each wave: groups of [type, count, route, gap seconds, delay].
function mapIndex(id) { const [z, m] = id.split(".").map(Number); return z * 3 + m; }
// Difficulty: every map starts from scratch, so most of the climb is wave by wave inside a map, plus a gentle rise map by map.
const TUNE = { b0: 8, b1: 3.5, b2: 0.15, bD: 0.01, hD: 0.03, hW: 0.025, gK: 0.6 };
function buildWaves(id, M, mult) {
  const D = mapIndex(id), r = seeded(1000 + D), roster = Z_ROSTER[M.zone], out = [];
  const pool = D === 0 ? ["crawler", "runner"] : roster;
  for (let w = 0; w < M.waves; w++) {
    const budget = (TUNE.b0 + TUNE.b1 * w + TUNE.b2 * w * w) * (1 + TUNE.bD * D * Math.min(1, w / 4)) * (M.ease || 1) * (mult || 1), groups = [];   // the zone's extra weight comes in over the first four waves
    let left = budget, delay = 0;
    const kinds = w < 2 ? ["crawler"] : pool.filter(k => w >= 3 || E_COST[k] <= 2.4);
    while (left > 1 && groups.length < 4) {
      const k = r.choice(kinds), c = E_COST[k], n = clamp(Math.floor(left / c * (groups.length ? 1 : r.uniform(0.45, 0.75))), 1, 18);
      groups.push([k, n, r.randint(0, M.routes.length - 1), k === "runner" ? 0.7 : 1.1, delay]);
      left -= n * c; delay += n * (k === "runner" ? 0.7 : 1.1) * 0.6 + 1.5;
    }
    if (w === M.waves - 1 && D >= 1 && D % 3 !== 2) groups.push(["brute", 1 + Math.min(3, Math.floor(M.zone / 3)), r.randint(0, M.routes.length - 1), 4, delay + 2]);
    if (w === M.waves - 1 && D % 3 === 2) groups.push(["GUARD", 1, r.randint(0, M.routes.length - 1), 1, delay + 3]);
    out.push(groups);
  }
  return out;
}
const hpScale = D => 1 + TUNE.hD * D;

// ---------------------------------------------------------------------------------------------------- start and leave
function fleshAtlas() {                                        // the Flipside sprites recoloured into the invaders' flesh tones
  if (FLESH) return FLESH;
  const c = document.createElement("canvas"); c.width = atlas.width; c.height = atlas.height;
  const x = c.getContext("2d"); x.drawImage(atlas, 0, 0);
  try {
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    const pal = [[40, 14, 30], [110, 30, 60], [190, 60, 80], [240, 130, 130], [255, 220, 200]];
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 2550;
      if (l < 0.12) { d[i] = 24; d[i + 1] = 10; d[i + 2] = 20; continue; }
      const t = Math.min(0.999, l) * 4, k = Math.floor(t), f = t - k;
      for (let j = 0; j < 3; j++) d[i + j] = Math.round(pal[k][j] + (pal[k + 1][j] - pal[k][j]) * f);
    }
    x.putImageData(im, 0, 0);
  } catch (e) { /* file:// can't read pixels: plain colours */ }
  FLESH = c;
  return c;
}
function siegeResize() {                                       // always 480x270: letterboxed on screens of other shapes
  canvas.width = SIW; canvas.height = SIH;
  canvas.style.height = "min(100dvh, " + (100 * SIH / SIW) + "vw)"; canvas.style.aspectRatio = SIW + " / " + SIH;
  g.imageSmoothingEnabled = false;
}
function startSiege(id, opts) {
  opts = opts || {};
  const M = SMAPS[id]; if (!M) return;
  siegeSave(); fleshAtlas();
  const R = mapRoutes(M);
  S.state = "siege"; S.overlay = null;
  const mode = opts.mode || "normal";
  SG = { id, M, R, bg: buildBg(M, R), D: mapIndex(id), test: !!opts.test, mode, endless: mode === "endless", waves: mode === "endless" ? [] : buildWaves(id, M, mode === "riptide" ? 1.2 : 1), wave: -1, spawn: [], waveT: 0, nextT: 0,
    shells: M.start + (resOn("post", "shells") ? 40 : 0), hull: resOn("post", "hull") ? 23 : 20, hullMax: resOn("post", "hull") ? 23 : 20, towers: M.pads.map(() => null), en: [], shots: [], fx: [], burns: [], pops: [], t: 0, speed: 1, paused: false,
    ring: null, hover: null, result: null, menu: false, tip: null, seenNow: [], kills: 0, leaked: 0, hpK: hpScale(mapIndex(id)), earned: 0 };
  SG.heroXp0 = opts.test ? (opts.xp || 0) : siegeSave().xp;
  SG.hero = newHero(opts.kit !== undefined ? opts.kit : kitNow(), SG.heroXp0);
  siegeResize();
  if (mode === "riptide") { SG.hull = SG.hullMax = 1; SG.hpK *= 1.3; }
  if (mode === "iron") SG.iron = ironPair(id);
  if (mode === "endless") SG.hpK = hpScale(Math.min(SG.D, 12));   // every week's map is about as tough: the map brings its look, layout and twist
  siegeTip(mode === "riptide" ? "RIPTIDE: TOUGHER WAVES, AND ONE LEAK ENDS IT." : mode === "iron" ? "IRON: ONLY " + SG.iron.map(k => TW[k].name).join(" AND ") + "." : mode === "endless" ? "HOLD THE LINE: HOW MANY WAVES CAN YOU SURVIVE?" : M.name + ": CLICK A PAD TO BUILD, THEN START.");
  play("select");
}
function siegeLeave() {
  SG = null; newDive(); resize(); play("back");
}
function siegeTip(s) { SG.tip = { s, t: 6 }; }
function siegeDone() {                                          // after a map: the campaign (or the boat, from the test link)
  if (SG.test) { siegeLeave(); return; }
  const id = SG.id, [z, m] = id.split(".").map(Number), won = SG.result && SG.result.won, nx = m < 2 ? z + "." + (m + 1) : (z + 1) + ".0";
  const endless = SG.endless;
  openCampaign(won && SG.mode === "normal" && SMAPS[nx] && mapOpen(nx) ? nx : id);
  if (endless) { SG.camp.tab = "endless"; endlessBoards(); }
}
function siegeAgain() { return { test: SG.test, kit: SG.hero ? SG.hero.kit : 0, xp: SG.test ? SG.heroXp0 || 0 : undefined, mode: SG.mode }; }

// ---------------------------------------------------------------------------------------------------- the simulation
function callWave() {
  if (!SG || SG.result || (!SG.endless && SG.wave >= SG.waves.length - 1)) return;
  if (SG.endless && SG.waves.length <= SG.wave + 1) SG.waves.push(endlessWave(SG.wave + 1));
  if (SG.wave >= 0 && SG.nextT > 0) { const bonus = Math.ceil(SG.nextT * 1.5 * (resOn("post", "call") ? 1.5 : 1)); SG.shells += bonus; siegePop(SIW - 70, 30, "+" + bonus, GOLD); }
  SG.wave++; SG.waveT = 0; SG.nextT = 0;
  for (const [k, n, ri, gap, delay] of SG.waves[SG.wave]) for (let i = 0; i < n; i++) SG.spawn.push([delay + i * gap, k, ri]);
  SG.spawn.sort((a, b) => a[0] - b[0]);
  const fresh = [...new Set(SG.waves[SG.wave].map(g_ => g_[0]).filter(k => k !== "GUARD"))].filter(k => E_TIPS[k] && !siegeSave().seen.includes(k) && !SG.seenNow.includes(k));
  if (fresh.length) { SG.seenNow.push(fresh[0]); if (!SG.test) siegeSave().seen.push(fresh[0]); siegeTip("NEW: " + E_TIPS[fresh[0]]); }
  play("chime");
}
function addEnemy(k, ri, s) {
  const w = Math.max(0, SG.wave), E = ETYPES[k], hp = Math.round(E[2] * (1 + (SG.hpK - 1) * Math.min(1, w / 4)) * (1 + TUNE.hW * w) * (SG.endless && w > 12 ? 1 + (w - 12) * 0.05 : 1));   // Hold the Line keeps climbing
  const e = { k, ri, s: s || 0, hp, max: hp, spd: E[3], arm: E[4], slime: E[5], hull: E[6], bounty: Math.round(E[7] * (1 + 0.02 * SG.D)),   // deeper zones pay more
    fl: E[8], slow: 0, slowT: 0, held: 0, poison: 0, poisonT: 0, x: 0, y: 0, right: true, hitT: 0, grabT: 0, id: Math.random() };
  const [x, y, rt] = atS(SG.R.routes[ri], e.s); e.x = x; e.y = y; e.right = rt;
  SG.en.push(e); return e;
}
function lit(x, y) {                                           // is this spot lit? (dark zones and hidden enemies need light)
  if (!(SG.dim > 0)) for (const t of SG.towers) if (t && !t.gone && TW[t.k].kind === "light" && inRange(t.x, t.y, x, y, towerStats(t).r)) return true;
  const H = SG.hero;
  if (H && !H.dead && H.kit === 2 && inRange(H.x, H.y, x, y, heroLight(H))) return true;
  if (H && H.flareT > 0 && inRange(H.flareX, H.flareY, x, y, 84)) return true;
  return false;
}
function visibleTo(e) {                                         // hidden ones need real light; in the dark, every tower also glows a little
  if (e.boss) return true;
  if (e.fl.includes("h")) return lit(e.x, e.y) || SG.towers.some(t => t && !t.gone && Math.hypot(t.x - e.x, (t.y - e.y) / 0.7) < 24);   // spotted right next to a tower
  return true;
}
const darkK = t => zoneDark() > 0.5 && !lit(t.x, t.y - 4) ? 0.65 : 1;   // in the dark, towers outside a light see 35% less far
function hurt(e, dmg, kind, src) {
  if (e.hp <= 0) return;
  let k = 1;
  if (kind === "phys" && !(src && src.pierce)) k *= 1 - e.arm;
  if (kind === "zap") k *= 1 - e.slime;
  if (SG.en.some(o => o !== e && o.hp > 0 && o.fl.includes("S") && Math.hypot(o.x - e.x, o.y - e.y) < 34)) k *= 0.6;   // a shield nearby
  for (const t of SG.towers) if (t && t.spec === 1 && TW[t.k].id === "lantern" && inRange(t.x, t.y, e.x, e.y, towerStats(t).r)) { k *= 1.25; break; }   // sonar marks
  if (src && src.crit && Math.random() < src.crit) { k *= 2; siegePop(e.x, e.y - 12, "CRIT", ORANGE); }
  e.hp -= dmg * k; e.hitT = 0.1;
  if (e.hp <= 0 && e.lives > 0) { e.lives--; e.hp = e.max * 0.5; e.held = 2; siegePop(e.x, e.y - 50, "IT REBUILDS ITSELF!", RED); S.shake = 0.4; play("growl"); return; }
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  SG.shells += e.bounty; SG.kills++; SG.earned += e.bounty;
  siegePop(e.x, e.y - 8, "+" + e.bounty, GOLD);
  SG.fx.push({ k: "pop", x: e.x, y: e.y, t: 0 });
  if (SG.M.zone === 8 && !e.risen && !e.boss && e.k !== "leech") (SG.bones = SG.bones || []).push({ x: e.x, y: e.y, k: e.k, ri: e.ri, s: e.s, t: 3 });
  if (e.boss) { SG.fx.push({ k: "shock", x: e.x, y: e.y, t: 0, dur: 1, r: 60 }); S.shake = 0.8; siegeTip(GUARD[e.boss - 1].name + " IS BEATEN!"); play("fanfare"); }
  if (e.fl.includes("s")) for (let i = 0; i < 2; i++) { const n = addEnemy("leech", e.ri, Math.max(0, e.s - 6 + i * 10)); n.max = n.hp = Math.round(n.hp); }
  play("hit", 0.4);
}
function siegePop(x, y, s, col) { SG.pops.push({ x, y, s, col, t: 0 }); }

function siegeStep(dt) {
  const G = SG; G.t += dt;
  if (G.tip) { G.tip.t -= dt; if (G.tip.t <= 0) G.tip = null; }
  // spawning
  if (G.wave >= 0) {
    G.waveT += dt;
    while (G.spawn.length && G.spawn[0][0] <= G.waveT) { let [, k, ri] = G.spawn.shift(); if (!doorOpen(ri)) ri = (ri + 1) % G.R.routes.length; if (k === "GUARD") addGuardian(ri, G.endless ? Math.min(10, Math.floor((G.wave + 1) / 10) - 1) : undefined); else addEnemy(k, ri); }
    if (!G.spawn.length && (G.endless || G.wave < G.waves.length - 1)) {
      if (G.nextT <= 0) G.nextT = 25; else { G.nextT -= dt; if (G.nextT <= 0) { G.nextT = 0; callWave(); } }
    }
  }
  // enemies
  for (const e of G.en) {
    if (e.hp <= 0) continue;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    if (e.poisonT > 0) { e.poisonT -= dt; hurt(e, e.poison * dt, "zap"); if (e.hp <= 0) continue; }
    for (const b of G.burns) if (Math.hypot(b.x - e.x, (b.y - e.y) / 0.7) < b.r) { hurt(e, b.dps * dt, "phys"); if (e.hp <= 0) break; }
    if (e.hp <= 0) continue;
    if (e.fl.includes("H")) for (const o of G.en) if (o !== e && o.hp > 0 && o.healT !== G.t && Math.hypot(o.x - e.x, o.y - e.y) < 40) { o.hp = Math.min(o.max, o.hp + o.max * 0.03 * dt); o.healT = G.t; }   // one healer at a time
    if (e.fl.includes("g")) {                                   // grabbers latch onto a tower they pass
      e.grabT -= dt;
      if (e.grabT <= 0) for (const t of G.towers) if (t && !t.off && !(t.grabbedAt > G.t - 6) && Math.hypot(t.x - e.x, t.y - e.y) < 26 && !guarded(t)) { t.off = 2.5; t.grabbedAt = G.t; e.grabT = 8; siegePop(t.x, t.y - 26, "GRABBED", RED); break; }
    }
    if (e.held > 0) { e.held -= dt; continue; }
    if (e.block) { if (e.block.dead || e.block.block !== e) e.block = null; else { heroHit(e.block, eDps(e) * dt); continue; } }
    const pl = G.R.routes[e.ri];
    e.s += e.spd * (1 - e.slow) * zoneSpeed(e) * dt;
    if (e.s >= pl.total) { e.hp = 0; G.hull -= e.hull; G.leaked += e.hull; (G.leakBy = G.leakBy || {})[e.k] = (G.leakBy[e.k] || 0) + 1; siegePop(G.M.buoy[0], G.M.buoy[1] - 34, "-" + e.hull, RED); play("miss", 0.5); S.shake = 0.2; continue; }
    const [x, y, rt] = atS(pl, e.s); e.x = x; e.y = y; e.right = rt;
  }
  G.en = G.en.filter(e => e.hp > 0);
  heroTick(dt);
  zoneTick(dt);
  // towers
  G.towers.forEach((t, i) => { if (t && !towerBlocked(t, i)) towerTick(t, dt); });
  // shots in flight
  for (const s of G.shots) {
    s.t += dt;
    if (s.k === "bolt") {
      const e = s.e, tx = e.hp > 0 ? e.x : s.tx, ty = e.hp > 0 ? e.y - 4 : s.ty; s.tx = tx; s.ty = ty;
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), v = 300 * dt;
      if (d <= v) { s.done = true; if (e.hp > 0) hurt(e, s.d, "phys", s); } else { s.x += dx / d * v; s.y += dy / d * v; }
    } else if (s.k === "shell") {
      if (s.t >= s.dur) {
        s.done = true; boom(s.tx, s.ty, s.a, s.d, s.air);
        if (s.cluster) for (let i = 0; i < s.cluster; i++) { const a = i / s.cluster * 6.283; G.shots.push({ k: "shell", x: s.tx, y: s.ty, sx: s.tx, sy: s.ty, tx: s.tx + Math.cos(a) * 22, ty: s.ty + Math.sin(a) * 15, t: 0, dur: 0.35, d: 12, a: 12, small: 1 }); }
        if (s.burn) G.burns.push({ x: s.tx, y: s.ty, r: 20, dps: s.burn, t: 3 });
      } else { const k = s.t / s.dur; s.x = lerp(s.sx, s.tx, k); s.y = lerp(s.sy, s.ty, k) - Math.sin(k * Math.PI) * (s.small ? 8 : 34); }
    }
  }
  G.shots = G.shots.filter(s => !s.done);
  for (const b of G.burns) b.t -= dt;
  G.burns = G.burns.filter(b => b.t > 0);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < (f.dur || 0.4));
  for (const p of G.pops) { p.t += dt; p.y -= 14 * dt; }
  G.pops = G.pops.filter(p => p.t < 1);
  // the end
  if (G.hull <= 0 && !G.result) { G.hull = 0; siegeEnd(false); }
  else if (!G.result && !G.endless && G.wave === G.waves.length - 1 && !G.spawn.length && !G.en.length) siegeEnd(true);
}
function guarded(t) { return SG.towers.some(o => o && o !== t && TW[o.k].id === "clam" && o.spec === 1 && inRange(o.x, o.y, t.x, t.y, 54)); }
function boom(x, y, a, d, air) {
  SG.fx.push({ k: "boom", x, y, r: a, t: 0 });
  for (const e of SG.en) if (e.hp > 0 && (air || !e.fl.includes("f")) && inRange(x, y, e.x, e.y, a)) hurt(e, d, "phys");
}
function towerBoost(t) {                                        // lanterns lengthen the range of towers in their light
  let b = 0, crit = 0;
  for (const o of SG.towers) if (o && o !== t && TW[o.k].kind === "light" && inRange(o.x, o.y, t.x, t.y, towerStats(o).r)) { const st = towerStats(o); b = Math.max(b, st.boost); crit = Math.max(crit, st.crit || 0); }
  return [b, crit];
}
function targets(t, r, opts) {                                  // enemies in range, the furthest along first
  opts = opts || {};
  const list = SG.en.filter(e => e.hp > 0 && inRange(t.x, t.y - 4, e.x, e.y, r) && visibleTo(e) && !inKelp(e) && !(opts.ground && e.fl.includes("f")) && !(opts.free && e.held > 0));
  list.sort((a, b) => (b.s / SG.R.routes[b.ri].total) - (a.s / SG.R.routes[a.ri].total));
  return list;
}
function towerTick(t, dt) {
  const d = TW[t.k], st = towerStats(t), [boost, crit] = towerBoost(t), r = st.r * (1 + boost) * darkK(t);
  t.cd = Math.max(0, (t.cd || 0) - dt); t.anim = Math.max(0, (t.anim || 0) - dt);
  if (t.off) { t.off -= dt; if (t.off <= 0) t.off = 0; return; }
  if (d.kind === "clam") { t.acc = (t.acc || 0) + dt; if (t.acc >= st.t) { t.acc = 0; SG.shells += st.inc; siegePop(t.x, t.y - 26, "+" + st.inc, GOLD); t.anim = 0.4; } return; }
  if (d.kind === "light" || t.cd > 0) return;
  if (d.kind === "shot") {
    const list = targets(t, r); if (!list.length) return;
    for (const e of list.slice(0, st.multi || 1)) SG.shots.push({ k: "bolt", x: t.x, y: t.y - 22, e, tx: e.x, ty: e.y, d: st.d, pierce: st.pierce, crit, t: 0, big: !!st.pierce });
    t.cd = st.t; t.anim = 0.15; play("tick", 0.3);
  } else if (d.kind === "mortar") {
    const list = targets(t, r, { ground: true }); if (!list.length) return;
    const e = list[0], lead = e.spd * (1 - e.slow) * 0.8 * (e.held > 0 ? 0 : 1), [px, py] = atS(SG.R.routes[e.ri], e.s + lead);
    SG.shots.push({ k: "shell", x: t.x, y: t.y - 20, sx: t.x, sy: t.y - 20, tx: px, ty: py, t: 0, dur: 0.8, d: st.d, a: st.a, cluster: st.cluster, burn: st.burn });
    t.cd = st.t; t.anim = 0.2; play("plop", 0.3);
  } else if (d.kind === "trap") {
    const list = targets(t, r, { ground: true, free: true }).filter(e => !e.fl.includes("b")); if (!list.length) return;
    for (const e of list.slice(0, st.n)) { e.held = st.hold; e.poison = Math.max(e.poison, st.d); e.poisonT = Math.max(e.poisonT, st.hold); SG.fx.push({ k: "grab", x: e.x, y: e.y, t: 0, dur: st.hold, tx: t.x, ty: t.y, e }); }
    t.cd = st.t + st.hold; t.anim = 0.3;
  } else if (d.kind === "zap") {
    const crys = SG.M.zone === 6, list = targets(t, r * (crys ? 1.15 : 1)); if (!list.length) return;
    let prev = [t.x, t.y - 24], cur = list[0];
    const hit = [];
    for (let i = 0; i < st.chain + (crys ? 2 : 0) && cur; i++) {
      hit.push(cur); SG.fx.push({ k: "zap", x: prev[0], y: prev[1], tx: cur.x, ty: cur.y - 3, t: 0, dur: 0.15 });
      cur.slow = Math.max(cur.slow, st.slow); cur.slowT = 1.2;
      if (st.poison) { cur.poison = Math.max(cur.poison, st.poison); cur.poisonT = 4; }
      prev = [cur.x, cur.y - 3];
      cur = SG.en.filter(e => e.hp > 0 && !hit.includes(e) && visibleTo(e) && Math.hypot(e.x - prev[0], e.y - prev[1]) < 40).sort((a, b) => Math.hypot(a.x - prev[0], a.y - prev[1]) - Math.hypot(b.x - prev[0], b.y - prev[1]))[0];
    }
    for (const e of hit) hurt(e, st.d, "zap", { crit });
    t.cd = st.t; t.anim = 0.15; play("zap", 0.2);
  } else if (d.kind === "slam") {
    const list = targets(t, r, { ground: true }); if (!list.length) return;
    const e = list[0], x = e.x, y = e.y;
    SG.fx.push({ k: "slam", x, y, t: 0, dur: 0.5, tx: t.x, ty: t.y });
    for (const o of SG.en) if (o.hp > 0 && !o.fl.includes("f") && inRange(x, y, o.x, o.y, st.a)) {
      hurt(o, st.d * (o.boss ? (st.boss || 1) : 1), "phys", { crit });
      if (st.drag && o.hp > 0) { o.s = Math.max(0, o.s - st.drag); }
    }
    t.cd = st.t; t.anim = 0.4; play("thunder", 0.4);
  }
}
function siegeEnd(won) {
  const G = SG, stars = won && G.mode === "normal" ? (G.leaked <= 2 ? 3 : G.leaked <= 10 ? 2 : 1) : 0;
  G.result = { won, stars, t: 0, mode: G.mode };
  if (G.endless) endlessDone();
  if (won && !G.test && (G.mode === "riptide" || G.mode === "iron")) { siegeSave().badges[G.id + (G.mode === "iron" ? "i" : "r")] = 1; G.result.badge = G.mode === "iron" ? "IRON BADGE!" : "RIPTIDE BADGE!"; }
  const xp = Math.round(G.earned * 0.5 + (won ? 60 + 20 * G.D : 0));
  G.result.xp = xp; G.result.lv0 = G.hero ? G.hero.lv : 1; G.result.lv1 = heroLevel(G.heroXp0 + xp);
  if (won && G.id === "10.2") G.result.ending = 1;
  if (!G.test) { const q = siegeSave(), before = q.done | 0; q.xp += xp; if (won && G.mode === "normal") q.stars[G.id] = Math.max(q.stars[G.id] || 0, stars); q.done = zonesDone(); if (q.done > before) G.result.zone = SZ[q.done - 1].name + " RECLAIMED!"; saveStore(); }
  if (!G.test) siegeAwards();
  play(won ? "fanfare" : "miss");
}

// ---------------------------------------------------------------------------------------------------- building
function ringFor(pi) {                                          // the ring menu's buttons around pad pi: [x, y, act, label, icon, cost, ok]
  const [px, py] = SG.M.pads[pi], t = SG.towers[pi], out = [];
  if ((SG.overgrown && SG.overgrown[pi]) || (SG.eaten && SG.eaten[pi] > 0) || (t && t.gone > 0)) return out;
  const put = (list, rad) => list.forEach((b, i) => { const a = -Math.PI / 2 + (i - (list.length - 1) / 2) * (list.length > 4 ? 0.78 : 1.0); b[0] = px + Math.cos(a) * rad; b[1] = py - 10 + Math.sin(a) * rad * 0.9; out.push(b); });
  if (!t) {
    const list = siegeTowersOpen().map(k => [0, 0, "build", TW[k].name, "t" + k + "_1", buildCost(k), SG.shells >= buildCost(k), k]);
    list.forEach((b, i) => { const n = list.length, a = -Math.PI / 2 + i / n * Math.PI * 2, rx = n > 4 ? 40 : 30, ry = n > 4 ? 34 : 26; b[0] = clamp(px + Math.cos(a) * rx, 14, SIW - 14); b[1] = clamp(py - 8 + Math.sin(a) * ry, 34, SIH - 18); out.push(b); });
  } else {
    const d = TW[t.k], list = [];
    if (t.spec < 0 && t.lv < 3) list.push([0, 0, "up", "LEVEL " + (t.lv + 1), "t" + t.k + "_" + (t.lv + 1), d.up[t.lv - 1], SG.shells >= d.up[t.lv - 1]]);
    if (t.spec < 0 && t.lv === 3) d.S.forEach((sp, i) => { if (resHas("t" + t.k, i ? "specB" : "specA")) list.push([0, 0, "spec", sp.name, "t" + t.k + "_" + "AB"[i], sp.cost, SG.shells >= sp.cost, i]); });
    if (t.spec < 0 && t.lv === 3 && !list.length) list.push([0, 0, "none", "RESEARCH IT", "t" + t.k + "_3", 0, false]);
    put(list, 30);
    const sell = Math.floor(towerSpent(t) * 0.6);
    out.push([px, py + 18, "sell", "SELL", null, sell, true]);
  }
  return out;
}
function siegeTowersOpen(raw) {                                 // which towers you can build (all of them on the test link)
  if (SG.iron && !raw) return SG.iron.slice();
  if (SG.test) return TW.map((_, i) => i);
  const done = siegeSave().done | 0;                            // zones reclaimed
  return [0, 1, 2].concat(done >= 1 ? [3] : [], done >= 2 ? [4] : [], done >= 3 ? [5] : [], done >= 5 ? [6] : []);
}
function ringAct(b) {
  const pi = SG.ring, [px, py] = SG.M.pads[pi];
  if (!b[6]) { play("miss"); return; }
  if (b[2] === "none") { play("miss"); siegeTip("RESEARCH ITS SPECIALISATIONS WITH STARS, ON THE MAP SCREEN."); SG.ring = null; return; }
  if (b[2] === "build") { SG.towers[pi] = { k: b[7], lv: 1, spec: -1, x: px, y: py, cd: 0.3, spent: b[5] }; SG.shells -= b[5]; play("select"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "up") { SG.towers[pi].lv++; SG.towers[pi].spent = towerSpent(SG.towers[pi]) + b[5]; SG.shells -= b[5]; play("select"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "spec") { SG.towers[pi].spent = towerSpent(SG.towers[pi]) + b[5]; SG.towers[pi].spec = b[7]; SG.shells -= b[5]; play("fanfare"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "sell") { SG.shells += b[5]; SG.towers[pi] = null; play("back"); }
  SG.ring = null;
}


// ---------------------------------------------------------------------------------------------------- the hero
// Your angler swims onto the field in your topside look (every character fights the same). Click open seabed to send
// them there. They stop the nearest creature and fight it; the Harpooner also throws harpoons from range. Knocked out,
// they swim back in from the buoy after 15 s. Three kits, each with two abilities (Q and E). Levels 1-20 carry over.
const KITS = [
  { name: "HARPOONER", q: ["BIG CATCH", "CATCH", 18], e: ["HARPOON VOLLEY", "VOLLEY", 24], melee: 10, range: 58, throwD: 8, light: 0 },
  { name: "NETCASTER", q: ["CAST NET", "NET", 16], e: ["HAUL IN", "HAUL", 24], melee: 14, range: 0, throwD: 0, light: 0 },
  { name: "LAMPLIGHTER", q: ["FLARE", "FLARE", 18], e: ["PULSE", "PULSE", 22], melee: 11, range: 0, throwD: 0, light: 46 },
];
const heroXpFor = L => 50 * (L - 1) * L;                       // total xp to reach level L (level 20 = 19,000)
function heroLevel(xp) { let L = 1; while (L < 20 && xp >= heroXpFor(L + 1)) L++; return L; }
const kitNow = () => kitsOpen().includes(siegeSave().kit | 0) ? siegeSave().kit | 0 : 0;
function kitsOpen() { if (SG && SG.test) return [0, 1, 2]; const d = siegeSave().done | 0; return [0].concat(d >= 2 ? [1] : [], d >= 4 ? [2] : []); }
function newHero(kit, xp) {
  const lv = heroLevel(xp), [bx, by] = SG.M.buoy, max = Math.round(120 * (1 + 0.06 * (lv - 1)) * (resOn("hero", "hp") ? 1.15 : 1));
  return { kit, lv, x: bx, y: by + 20, tx: null, ty: null, hp: max, max, atkT: 0, cdQ: 0, cdE: 0, dead: 0, face: 1, walk: 0, block: null, calm: 0, flareT: 0, pet: { x: bx - 12, y: by + 20 }, flag: 0 };
}
const heroK = H => (1 + 0.05 * (H.lv - 1)) * (resOn("hero", "dmg") ? 1.15 : 1);                      // damage and ability strength by level
function heroLight(H) { if (!H || H.dead) return 0; return Math.max(KITS[H.kit].light, 22); }
function heroTick(dt) {
  const G = SG, H = G.hero; if (!H) return;
  H.cdQ = Math.max(0, H.cdQ - dt); H.cdE = Math.max(0, H.cdE - dt); H.flareT = Math.max(0, H.flareT - dt); H.flag = Math.max(0, H.flag - dt);
  if (H.dead > 0) { H.dead -= dt; if (H.dead <= 0) { const [bx, by] = G.M.buoy; Object.assign(H, { dead: 0, hp: H.max, x: bx, y: by + 20, tx: null, block: null }); siegePop(bx, by - 30, "BACK IN!", LIME); } return; }
  const d = KITS[H.kit], k = heroK(H);
  if (H.tx !== null) {                                          // swimming to where you clicked
    if (H.block) { H.block.block = null; H.block = null; }
    const dx = H.tx - H.x, dy = H.ty - H.y, dist = Math.hypot(dx, dy), v = 58 * dt;
    if (dist <= v) { H.x = H.tx; H.y = H.ty; H.tx = null; } else { H.x += dx / dist * v; H.y += dy / dist * v; H.face = dx >= 0 ? 1 : -1; H.walk += dt; }
  } else {
    if (H.block && (H.block.hp <= 0 || Math.hypot(H.block.x - H.x, H.block.y - H.y) > 26)) { H.block.block = null; H.block = null; }
    if (!H.block) {                                             // stop the nearest creature that comes by
      const e = G.en.filter(e => e.hp > 0 && !e.block && !e.fl.includes("f") && !e.boss && visibleTo(e) && Math.hypot(e.x - H.x, e.y - H.y) < 22).sort((a, b) => Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y))[0];
      if (e) { H.block = e; e.block = H; }
    }
  }
  H.atkT = Math.max(0, H.atkT - dt);
  if (H.block && H.atkT <= 0) { hurt(H.block, d.melee * k, H.kit === 2 ? "zap" : "phys"); H.atkT = 0.8; H.face = H.block.x >= H.x ? 1 : -1; H.swing = 0.2; H.calm = 0; }
  else if (!H.block && d.range && H.atkT <= 0) {
    const e = G.en.filter(e => e.hp > 0 && visibleTo(e) && inRange(H.x, H.y, e.x, e.y, d.range)).sort((a, b) => (b.s / G.R.routes[b.ri].total) - (a.s / G.R.routes[a.ri].total))[0];
    if (e) { G.shots.push({ k: "bolt", x: H.x, y: H.y - 10, e, tx: e.x, ty: e.y, d: d.throwD * k, t: 0, harpoon: 1 }); H.atkT = 1.3; H.face = e.x >= H.x ? 1 : -1; }
  }
  H.calm += dt; H.swing = Math.max(0, (H.swing || 0) - dt);
  if (H.calm > 3 && !H.block) H.hp = Math.min(H.max, H.hp + H.max * 0.04 * dt);
  const P = H.pet, px = H.x - 12 * H.face, py = H.y - 2;      // the pet follows
  if (Math.hypot(px - P.x, py - P.y) > 2) { const kk = Math.min(1, dt * 4); P.x += (px - P.x) * kk; P.y += (py - P.y) * kk; }
}
function heroHit(H, dmg) {
  if (H.dead) return;
  H.hp -= dmg; H.calm = 0;
  if (H.hp <= 0) { H.hp = 0; H.dead = 15; if (H.block) { H.block.block = null; H.block = null; } siegePop(H.x, H.y - 20, "KNOCKED OUT", RED); play("miss"); }
}
const eDps = e => (2 + ETYPES[e.k][2] * 0.07) * Math.sqrt(SG.hpK);
function heroAbility(which) {
  const G = SG, H = G && G.hero; if (!H || H.dead || G.result || G.paused) return;
  const cd = which === "q" ? "cdQ" : "cdE"; if (H[cd] > 0) { play("miss", 0.4); return; }
  const k = heroK(H), near = r => G.en.filter(e => e.hp > 0 && inRange(H.x, H.y, e.x, e.y, r));
  if (H.kit === 0 && which === "q") {                           // BIG CATCH: reel the furthest-along creature back down the current
    const e = near(90).filter(e => !e.boss && visibleTo(e)).sort((a, b) => (b.s / G.R.routes[b.ri].total) - (a.s / G.R.routes[a.ri].total))[0];
    if (!e) { play("miss", 0.4); return; }
    G.fx.push({ k: "reel", x: H.x, y: H.y - 8, tx: e.x, ty: e.y, t: 0, dur: 0.5 });
    e.s = Math.max(0, e.s - 80); hurt(e, 30 * k, "phys"); e.held = Math.max(e.held, 0.6); play("reel");
  } else if (H.kit === 0) {                                     // HARPOON VOLLEY: everything nearby
    const list = near(72); if (!list.length) { play("miss", 0.4); return; }
    for (const e of list) { G.fx.push({ k: "harpoon", x: H.x, y: H.y - 10, tx: e.x, ty: e.y - 3, t: 0, dur: 0.3 }); hurt(e, 40 * k, "phys"); }
    play("hit");
  } else if (H.kit === 1 && which === "q") {                    // CAST NET: slow everything in an area
    for (const e of near(56)) { e.slow = Math.max(e.slow, 0.6); e.slowT = 4; }
    G.fx.push({ k: "net", x: H.x, y: H.y, r: 56, t: 0, dur: 0.6 }); play("plop");
  } else if (H.kit === 1) {                                     // HAUL IN: drag a group back into a bunch and hold them
    const list = near(64).filter(e => !e.boss); if (!list.length) { play("miss", 0.4); return; }
    for (const e of list) { e.s = Math.max(0, e.s - 34); e.held = Math.max(e.held, 1.5); hurt(e, 20 * k, "phys"); }
    G.fx.push({ k: "net", x: H.x, y: H.y, r: 64, t: 0, dur: 0.8, haul: 1 }); play("reel");
  } else if (H.kit === 2 && which === "q") {                    // FLARE: light a wide area for 8 seconds
    H.flareT = 8; H.flareX = H.x; H.flareY = H.y; play("chime");
  } else {                                                      // PULSE: stun everything nearby
    for (const e of near(58)) { e.held = Math.max(e.held, e.boss ? 0.8 : 2.5); hurt(e, 25 * k, "zap"); }
    G.fx.push({ k: "pulse", x: H.x, y: H.y - 6, t: 0, dur: 0.5 }); play("pulse");
  }
  H[cd] = KITS[H.kit][which][2] * (resOn("hero", "cd") ? 0.85 : 1);
}
function drawHero(H) {
  if (H.dead) return;
  const legs = H.tx !== null ? Math.floor(H.walk * 8) % 2 : 0, c = isleChar(H.face > 0 ? "side" : "left", legs, false);
  g.globalAlpha = 0.25; ell("#000000", H.x - 6, H.y - 1, 12, 4); g.globalAlpha = 1;
  ring(GOLD, H.x, H.y, 7);
  const bob = H.swing > 0 ? -1 : 0;
  g.drawImage(c, Math.round(H.x - c.width / 2), Math.round(H.y - c.height + 1 + bob));
  const h = store.eq.hat, a = h && DATA.atlas["hat" + h];
  if (a) g.drawImage(atlas, a[0], a[1], a[2], a[3], Math.round(H.x - a[2] / 2), Math.round(H.y - 13 - a[3] + bob), a[2], a[3]);
  if (H.kit === 0) line("#dcdce6", H.x + 5 * H.face, H.y - 9, H.x + 11 * H.face, H.y - 16 - (H.swing > 0 ? 3 : 0));
  else if (H.kit === 1) { g.globalAlpha = 0.8; for (let i = 0; i < 3; i++) line("#dcd2aa", H.x - 7 * H.face, H.y - 8 + i * 2, H.x - 3 * H.face, H.y - 2 + i); g.globalAlpha = 1; }
  else { rect("#6e5a46", H.x + 6 * H.face, H.y - 16, 1, 12); rect(INK, H.x + 6 * H.face - 2, H.y - 19, 5, 5); rect("#fff08c", H.x + 6 * H.face - 1, H.y - 18, 3, 3); }
  if (H.hp < H.max) { rect(INK, H.x - 7, H.y - 20, 14, 3); rect(H.hp / H.max > 0.4 ? LIME : RED, H.x - 6, H.y - 19, Math.max(1, Math.round(12 * H.hp / H.max)), 1); }
}
function drawPet(H) {
  const p = store.eq.pet, a = p && DATA.atlas["pet" + p]; if (!a || H.dead) return;
  const P = H.pet, flip = H.x < P.x, hop = Math.hypot(H.x - P.x, H.y - P.y) > 14 ? Math.abs(Math.sin(SG.t * 10)) * 2 : 0;
  g.save(); g.translate(Math.round(P.x), 0); if (flip) g.scale(-1, 1);
  g.drawImage(atlas, a[0], a[1], a[2], a[3], -Math.round(a[2] / 2), Math.round(P.y - a[3] - 6 - hop), a[2], a[3]); g.restore();
}
const HERO_PANEL = [4, SIH - 31, 134, 27];
const heroBtn = i => [HERO_PANEL[0] + 26 + i * 53, HERO_PANEL[1] + 15, 50, 10];
function drawHeroPanel() {
  const G = SG, H = G.hero; if (!H) return;
  const [x, y, w, h] = HERO_PANEL, d = KITS[H.kit];
  rect(INK, x, y, w, h); rect("#0e1a30", x + 1, y + 1, w - 2, h - 2); outline(x + 1, y + 1, w - 2, h - 2, "#78bee6");
  const face = isleChar("front", 0, false); if (H.dead) g.globalAlpha = 0.35; g.drawImage(face, x + 6, y + 5); g.globalAlpha = 1;
  text("LV " + H.lv, x + 26, y + 7, 1, GOLD, "left");
  text(H.dead ? "BACK IN " + Math.ceil(H.dead) : d.name, x + w - 6, y + 7, 1, H.dead ? RED : "#aadcff", "right");
  rect(INK, x + 5, y + 20, 16, 3); rect(H.hp / H.max > 0.4 ? LIME : RED, x + 6, y + 21, Math.max(0, Math.round(14 * H.hp / H.max)), 1);
  ["q", "e"].forEach((wk, i) => {
    const [bx, by, bw, bh] = heroBtn(i), cd = i ? H.cdE : H.cdQ, col = i ? ORANGE : CYAN;
    rect(INK, bx, by, bw, bh); rect("#18284a", bx + 1, by + 1, bw - 2, bh - 2); outline(bx, by, bw, bh, col);
    text(wk.toUpperCase() + " " + d[wk][1], bx + 3, by + 5, 1, col, "left", null);
    if (cd > 0) { g.globalAlpha = 0.65; rect("#060a1e", bx + 1, by + 1, Math.min(bw - 2, Math.round((bw - 2) * cd / d[wk][2])), bh - 2); g.globalAlpha = 1; }
  });
}

// ---------------------------------------------------------------------------------------------------- drawing
function sSprite(key, x, y, flip) {
  const a = SIEGE_ART[key]; if (!a) return;
  x = Math.floor(x); y = Math.floor(y);
  if (flip) { g.save(); g.translate(x + a[2], y); g.scale(-1, 1); g.drawImage(SART, a[0], a[1], a[2], a[3], 0, 0, a[2], a[3]); g.restore(); }
  else g.drawImage(SART, a[0], a[1], a[2], a[3], x, y, a[2], a[3]);
}
function drawSiege() {
  const G = SG; if (!G) return;
  if (G.camp) { drawCampaign(); return; }
  g.save();
  if (S.shake > 0) g.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-1, 1)));
  g.drawImage(G.bg, 0, 0);
  // the currents flow: little chevrons drift along each route
  const off = (G.t * 22) % 24;
  for (const k in G.R.seg) {
    const pl = polyline(G.R.seg[k]);
    for (let s = off; s < pl.total; s += 24) { const [x, y] = atS(pl, s), [x2, y2] = atS(pl, s + 2), a = Math.atan2(y2 - y, x2 - x); for (const sg of [-1, 1]) { line("#ff8c9a", x, y, x - Math.cos(a + sg * 0.7) * 3, y - Math.sin(a + sg * 0.7) * 3); } }
  }
  for (const b of G.burns) { g.globalAlpha = 0.5 * Math.min(1, b.t); ell("#ff7828", b.x - b.r, b.y - b.r * 0.6, b.r * 2, b.r * 1.2); g.globalAlpha = 1; }
  drawZoneUnder();
  // range ellipse for the ring's tower
  if (G.ring !== null && G.towers[G.ring]) { const t = G.towers[G.ring], st = towerStats(t), r = st.r * (1 + towerBoost(t)[0]) * (TW[t.k].kind === "light" ? 1 : darkK(t)); if (r) { g.globalAlpha = 0.18; ell("#96dcff", t.x - r, t.y - r * 0.7, r * 2, r * 1.4); g.globalAlpha = 1; } }
  // everything that stands up, sorted by depth
  const items = [];
  for (const d of G.M._deco) items.push([d[2], 0, d]);
  G.towers.forEach(t => { if (t) items.push([t.y, 1, t]); });
  for (const e of G.en) items.push([e.y, 2, e]);
  items.push([G.M.buoy[1], 3]);
  if (G.hero) { items.push([G.hero.y + 0.1, 4]); items.push([G.hero.pet.y, 5]); }
  items.sort((a, b) => a[0] - b[0]);
  const fl = fleshAtlas();
  for (const [, kind, o] of items) {
    if (kind === 0) g.drawImage(decoArt(o[0], o[3], G.M.zone), o[1] - 20, o[2] - 36);
    else if (kind === 1) {
      if (o.gone > 0) { text("SNIPPED " + Math.ceil(o.gone), o.x, o.y - 8, 1, RED); continue; }
      const a = SIEGE_ART[towerKey(o)], bob = o.anim > 0 ? -1 : 0;
      if (o.off) g.globalAlpha = 0.5;
      sSprite(towerKey(o), o.x - a[2] / 2, o.y - a[3] + 5 + bob);
      g.globalAlpha = 1;
      if (o.off) text("ZZ", o.x, o.y - a[3] - 2, 1, RED);
      if (TW[o.k].kind === "light") { g.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 4); disc("#fff0a0", o.x, o.y - a[3] + 6, 2); g.globalAlpha = 1; }
    } else if (kind === 2) {
      if (o.boss) { drawGuardian(o); continue; }
      const E = ETYPES[o.k], vis = visibleTo(o), [w, h] = sprSize(E[1]);
      if (!vis) { rect("#ff5050", o.x - 2, o.y - 4, 1, 1); rect("#ff5050", o.x + 1, o.y - 4, 1, 1); continue; }
      g.globalAlpha = 0.25; ell("#000000", o.x - w / 2, o.y + 1, w, 3); g.globalAlpha = 1;
      const fy = o.fl.includes("f") ? o.y - h - 6 + Math.sin(G.t * 3 + o.id * 9) * 2 : o.y - h + 2;
      spr(E[1], o.x - w / 2, fy, !o.right, 1, o.hitT > 0 ? atlas : fl);
      if (o.held > 0) { g.globalAlpha = 0.6; ring("#7adc8c", o.x, o.y - 2, 6); g.globalAlpha = 1; }
      if (o.slowT > 0) rect(CYAN, o.x - 1, fy - 2, 2, 1);
      if (o.hp < o.max) { rect(INK, o.x - 6, fy - 4, 12, 3); rect(o.hp / o.max > 0.4 ? LIME : GOLD, o.x - 5, fy - 3, Math.max(1, Math.round(10 * o.hp / o.max)), 1); }
    } else if (kind === 3) drawBuoy(G.M.buoy[0], G.M.buoy[1]);
    else if (kind === 4) drawHero(G.hero);
    else if (kind === 5) drawPet(G.hero);
  }
  // shots and effects
  for (const s of G.shots) {
    if (s.k === "bolt" && s.harpoon) { const a = Math.atan2(s.ty - s.y, s.tx - s.x); line("#e6e6f0", s.x, s.y, s.x - Math.cos(a) * 6, s.y - Math.sin(a) * 6); }
    else if (s.k === "bolt") { rect(s.big ? "#ff5040" : "#ffc896", s.x - 1, s.y - 1, s.big ? 3 : 2, s.big ? 3 : 2); }
    else { disc(INK, s.x, s.y, s.small ? 1 : 2); disc("#a064dc", s.x, s.y, s.small ? 0 : 1); }
  }
  for (const f of G.fx) {
    const k = f.t / (f.dur || 0.4);
    if (f.k === "zap") { g.globalAlpha = 1 - k; zigzag(f.x, f.y, f.tx, f.ty); g.globalAlpha = 1; }
    else if (f.k === "boom") { g.globalAlpha = 1 - k; ring("#ffd28c", f.x, f.y, f.r * (0.4 + k * 0.6)); ring("#a064dc", f.x, f.y, f.r * k * 0.6); g.globalAlpha = 1; }
    else if (f.k === "pop") { g.globalAlpha = 1 - k; ring("#ff8ca0", f.x, f.y - 3, 2 + k * 6); g.globalAlpha = 1; }
    else if (f.k === "dust") { g.globalAlpha = 1 - k; ring("#f0e6d2", f.x, f.y, 6 + k * 10); g.globalAlpha = 1; }
    else if (f.k === "slam") { const u = Math.sin(Math.min(1, k * 2) * Math.PI); line("#963c6e", f.tx, f.ty - 4, lerp(f.tx, f.x, u), lerp(f.ty - 4, f.y - 2, u)); line("#963c6e", f.tx + 1, f.ty - 4, lerp(f.tx, f.x, u) + 1, lerp(f.ty - 4, f.y - 2, u)); if (k > 0.4) { g.globalAlpha = 1 - k; ring("#f0a0c8", f.x, f.y, 6 + k * 16); g.globalAlpha = 1; } }
    else if (f.k === "reel" || f.k === "harpoon") { g.globalAlpha = 1 - k; line(f.k === "reel" ? "#dcd2aa" : "#e6e6f0", f.x, f.y, f.tx, f.ty); g.globalAlpha = 1; }
    else if (f.k === "net") { g.globalAlpha = 0.8 * (1 - k); const r = f.r * (0.5 + 0.5 * Math.min(1, k * 2)); ring("#dcd2aa", f.x, f.y, r); for (let i = -2; i <= 2; i++) { line("#dcd2aa", f.x - r, f.y + i * r * 0.25, f.x + r, f.y + i * r * 0.25); line("#dcd2aa", f.x + i * r * 0.35, f.y - r * 0.7, f.x + i * r * 0.35, f.y + r * 0.7); } g.globalAlpha = 1; }
    else if (f.k === "shock") { g.globalAlpha = 1 - k; ring("#ff6e78", f.x, f.y - 10, f.r * k); ring("#ffc8c8", f.x, f.y - 10, f.r * k * 0.8); g.globalAlpha = 1; }
    else if (f.k === "pulse") { g.globalAlpha = 1 - k; ring("#82f0ff", f.x, f.y, 6 + k * 52); ring("#ffffff", f.x, f.y, 4 + k * 40); g.globalAlpha = 1; }
    else if (f.k === "grab") { if (f.e.hp > 0) { g.globalAlpha = 0.7; line("#5ab464", f.tx, f.ty - 6, f.e.x, f.e.y - 2); g.globalAlpha = 1; } }
  }
  drawZoneOver();
  drawPadMarks();
  for (const p of G.pops) { g.globalAlpha = 1 - p.t; text(p.s, p.x, p.y, 1, p.col); g.globalAlpha = 1; }
  if (G.hero && G.hero.flareT > 0) { g.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 9); disc("#ffdc78", G.hero.flareX, G.hero.flareY - 30, 2); g.globalAlpha = 1; }
  if (G.hero && G.hero.flag > 0 && G.hero.tx !== null) { line(GOLD, G.hero.tx, G.hero.ty, G.hero.tx, G.hero.ty - 8); rect(GOLD, G.hero.tx + 1, G.hero.ty - 8, 4, 3); }
  // dark zones: a mask with holes where it's lit
  if (zoneDark() > 0) drawDarkness();
  // the red markers where waves come in, while one is waiting
  if (siegeCanCall()) entryMarkers();
  if (G.ring !== null) drawRing();
  drawSiegeHud();
  g.restore();
  if (G.result) drawResult();
  else if (G.menu) drawSiegeMenu();
}
function zigzag(x0, y0, x1, y1) {
  let px = x0, py = y0;
  for (let i = 1; i <= 5; i++) { const k = i / 5, x = lerp(x0, x1, k) + (i < 5 ? rnd(-3, 3) : 0), y = lerp(y0, y1, k) + (i < 5 ? rnd(-3, 3) : 0); line("#fffa78", px, py, x, y); px = x; py = y; }
}
function drawBuoy(x, y) {
  ell("rgba(0,0,0,0.25)", x - 20, y - 4, 40, 14);
  ell(INK, x - 18, y - 8, 36, 16); ell("#82786e", x - 17, y - 7, 34, 14); ell("#aaa092", x - 14, y - 7, 28, 10);
  rect("#46464e", x - 1, y - 22, 2, 20);
  ell(INK, x - 8, y - 32, 16, 14); ell("#e63c3c", x - 7, y - 31, 14, 12); rect("#fafafa", x - 7, y - 26, 14, 2);
  rect("#46464e", x, y - 42, 1, 10);
  poly(INK, [[x + 1, y - 43], [x + 12, y - 39], [x + 1, y - 34]]); poly(GOLD, [[x + 1, y - 42], [x + 10, y - 39], [x + 1, y - 35]]);
}
let DARKC = null;
function drawDarkness() {
  const G = SG, dk = zoneDark();
  if (!DARKC) { DARKC = document.createElement("canvas"); DARKC.width = SIW; DARKC.height = SIH; }
  const x = DARKC.getContext("2d");
  x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, SIW, SIH);
  x.fillStyle = "rgba(4,4,14," + (dk > 0.5 ? 0.35 + dk * 0.35 : dk * 0.8) + ")"; x.fillRect(0, 0, SIW, SIH);
  x.globalCompositeOperation = "destination-out";
  const hole = (cx, cy, r) => { for (const [k, a] of [[1, 0.35], [0.8, 0.35], [0.6, 0.6], [0.45, 1]]) { x.fillStyle = "rgba(0,0,0," + a + ")"; x.beginPath(); x.ellipse(cx, cy, r * k, r * k * 0.7, 0, 0, 6.283); x.fill(); } };
  if (!(G.dim > 0)) for (const t of G.towers) if (t && !t.gone && TW[t.k].kind === "light") hole(t.x, t.y - 4, towerStats(t).r);
  hole(G.M.buoy[0], G.M.buoy[1] - 10, 34);
  if (G.hero && !G.hero.dead) hole(G.hero.x, G.hero.y - 6, heroLight(G.hero));
  if (G.hero && G.hero.flareT > 0) hole(G.hero.flareX, G.hero.flareY, 84 * Math.min(1, G.hero.flareT));
  for (const t of G.towers) if (t && !t.gone && TW[t.k].kind !== "light") hole(t.x, t.y - 4, 26);
  for (const f of G.fx) if (f.k === "zap" || f.k === "boom") hole(f.tx || f.x, f.ty || f.y, 16);
  g.drawImage(DARKC, 0, 0);
}
function siegeCanCall() { return SG && !SG.result && (SG.endless || SG.wave < SG.waves.length - 1) && (SG.wave < 0 || (!SG.spawn.length && SG.nextT > 0)); }
function entryMarkers() {
  const seen = new Set();
  for (const pl of SG.R.routes) {
    const [x0, y0] = pl.pts[0], key = x0 + "," + y0; if (seen.has(key)) continue; seen.add(key);
    const [x, y] = markerPos(pl), p = 0.5 + 0.5 * Math.sin(SG.t * 6);
    disc(INK, x, y, 10); disc("#3c0a14", x, y, 9); ring("#ff6e78", x, y, 9); g.globalAlpha = p; ring("#ff6e78", x, y, 12); g.globalAlpha = 1;
    spr("fc_crawler", x - 8, y - 4, false, 1, fleshAtlas());
    if (SG.wave >= 0) text(Math.ceil(SG.nextT), x, y + 15, 1, GOLD);
  }
}
function markerPos(pl) { let [x, y] = pl.pts[0]; x = clamp(x, 12, SIW - 12); y = clamp(y, 30, SIH - 12); return [x, y]; }
function drawRing() {
  const G = SG, [px, py] = G.M.pads[G.ring], btns = ringFor(G.ring);
  for (const b of btns) {
    const [x, y, act, lab, icon, cost, ok] = b, hov = G.hover && Math.hypot(G.hover[0] - x, G.hover[1] - y) < 11;
    if (act === "sell") { box(x - 18, y - 6, 36, 12, hov ? GOLD : "#ff9696"); text("SELL " + cost, x, y, 1, "#ffd2d2", "center", null); continue; }
    disc(INK, x, y, 12); disc(hov ? "#28406c" : "#0e1a30", x, y, 11); ring(ok ? (hov ? GOLD : "#78bee6") : "#6e5050", x, y, 11);
    if (icon) { const a = SIEGE_ART[icon]; g.globalAlpha = ok ? 1 : 0.45; sSprite(icon, x - a[2] / 2, y - a[3] / 2 - 4); g.globalAlpha = 1; }
    const cs = String(cost); rect("#140e06", x - textW(cs, 1) / 2 - 2, y + 7, textW(cs, 1) + 4, 9); text(cs, x, y + 11, 1, ok ? GOLD : "#a08c78", "center", null);
  }
  const hb = btns.find(b => G.hover && (b[2] === "sell" ? Math.abs(G.hover[0] - b[0]) < 18 && Math.abs(G.hover[1] - b[1]) < 6 : Math.hypot(G.hover[0] - b[0], G.hover[1] - b[1]) < 11));
  if (hb && hb[2] !== "sell") {                                  // what the hovered button does
    const d = hb[2] === "build" ? TW[hb[7]] : TW[G.towers[G.ring].k], st = hb[2] === "spec" ? d.S[hb[7]] : null;
    const l1 = hb[3], l2 = st ? st.note : d.note, w = Math.max(textW(l1, 1), textW(l2, 1)) + 12, bx = clamp(px - w / 2, 2, SIW - w - 2), by = py + 26 > SIH - 30 ? py - 70 : py + 26;
    box(bx, by, w, 22, "#78bee6"); text(l1, bx + w / 2, by + 7, 1, GOLD, "center"); text(l2, bx + w / 2, by + 16, 1, "#c8e6ff", "center");
  }
}
function siegeBtn(x, y, w, h, lab, col, fill) { rect(INK, x, y, w, h); rect(fill || "#0e1a30", x + 1, y + 1, w - 2, h - 2); outline(x + 1, y + 1, w - 2, h - 2, col || "#78bee6"); text(lab, x + w / 2, y + h / 2 + 1, 1, col === RED ? "#ffdcdc" : WHITE, "center"); }
const SIEGE_HUD = { next: [SIW - 118, 4, 74, 15], speed: [SIW - 42, 4, 19, 15], pause: [SIW - 21, 4, 17, 15] };
function drawSiegeHud() {
  const G = SG;
  rect(INK, 4, 4, 86, 15); rect("#0e1a30", 5, 5, 84, 13); outline(5, 5, 84, 13, "#78bee6");
  heart(9, 8); text(G.hull, 20, 12, 1, WHITE, "left");
  shellIcon(42, 7); text(G.shells, 54, 12, 1, GOLD, "left");
  rect(INK, 94, 4, 70, 15); rect("#0e1a30", 95, 5, 68, 13); outline(95, 5, 68, 13, "#78bee6");
  text(G.endless ? "WAVE " + Math.max(0, G.wave + 1) : "WAVE " + Math.max(0, G.wave + 1) + "/" + G.waves.length, 129, 12, 1, G.mode === "riptide" ? CYAN : G.mode === "iron" ? "#c8c8d2" : "#aadcff");
  if (siegeCanCall()) { const [x, y, w, h] = SIEGE_HUD.next; siegeBtn(x, y, w, h, G.wave < 0 ? "START" : "NEXT WAVE", RED, "#3c1420"); }
  siegeBtn(...SIEGE_HUD.speed, G.speed === 2 ? "X2" : "X1", G.speed === 2 ? GOLD : null);
  siegeBtn(...SIEGE_HUD.pause, "II", G.paused ? GOLD : null);
  if (G.paused && !G.menu && !G.result) { box(SIW / 2 - 40, SIH / 2 - 10, 80, 20, GOLD); text("PAUSED", SIW / 2, SIH / 2, 1, GOLD); }
  drawHeroPanel();
  drawBossBar();
  if (G.tip) { const w = Math.min(SIW - 20, textW(G.tip.s, 1) + 14); g.globalAlpha = Math.min(1, G.tip.t); box(SIW / 2 - w / 2, SIH - 26, w, 16, GOLD); text(G.tip.s, SIW / 2, SIH - 18, 1, WHITE); g.globalAlpha = 1; }
}
function heart(x, y) { for (const [a, b] of [[1, 0], [2, 0], [5, 0], [6, 0]]) rect("#f04650", x + a, y + b, 1, 1); rect("#f04650", x, y + 1, 8, 2); rect("#f04650", x + 1, y + 3, 6, 1); rect("#f04650", x + 2, y + 4, 4, 1); rect("#f04650", x + 3, y + 5, 2, 1); }
function shellIcon(x, y) { ell(INK, x - 1, y - 1, 10, 9); ell("#fac8aa", x, y, 8, 7); rect("#c88c78", x + 3, y + 1, 1, 5); rect("#c88c78", x + 1, y + 2, 1, 3); rect("#c88c78", x + 5, y + 2, 1, 3); }
function drawResult() {
  const R_ = SG.result, w = 200, h = 96, x = SIW / 2 - w / 2, y = SIH / 2 - h / 2;
  g.globalAlpha = 0.6; rect("#060a1e", 0, 0, SIW, SIH); g.globalAlpha = 1;
  box(x, y, w, h, R_.won ? GOLD : RED);
  text(R_.ending ? "THE CRACK IS SEALED!" : R_.badge ? R_.badge : SG.endless ? "HELD TO WAVE " + (R_.wave || 0) : R_.won ? "ZONE HELD!" : "THE BUOY FELL", SIW / 2, y + 14, R_.ending ? 1 : 2, R_.won || SG.endless ? GOLD : RED);
  if (R_.ending) text("THE OCEAN IS YOURS AGAIN. THE ADMIRAL SALUTES.", SIW / 2, y - 22, 1, WHITE);
  if (SG.endless) { text(SG.test ? "(TEST: NOTHING SAVED)" : "YOUR BEST THIS WEEK: WAVE " + (R_.best || 0), SIW / 2, y + 36, 1, WHITE); if (R_.note) text(R_.note, SIW / 2, y + 46, 1, ORANGE); }
  else if (R_.won && R_.mode === "normal") for (let i = 0; i < 3; i++) bigStar(SIW / 2 - 24 + i * 24, y + 40, i < R_.stars);
  else if (R_.won) text("A BADGE FOR " + SG.M.name, SIW / 2, y + 40, 1, WHITE);
  else text("THE FLIPSIDE GOT THROUGH", SIW / 2, y + 40, 1, "#ffc8c8");
  text("WAVES " + Math.max(0, SG.wave + 1) + (SG.endless ? "" : "/" + SG.waves.length) + "  HULL " + SG.hull + "/" + SG.hullMax + "  +" + R_.xp + " XP", SIW / 2, y + 58, 1, "#c8e6ff");
  if (R_.lv1 > R_.lv0 && !SG.test) text("HERO LEVEL " + R_.lv1 + "!", SIW / 2, y + 68, 1, GOLD);
  siegeBtn(x + 16, y + h - 24, 76, 16, "RETRY", null);
  siegeBtn(x + w - 92, y + h - 24, 76, 16, SG.test ? "QUIT" : "CONTINUE", GOLD);
  if (R_.zone) text(R_.zone, SIW / 2, y - 10, 1, GOLD);
  (SG.rewards || []).slice(0, 4).forEach((r, i) => text("TOPSIDE REWARD! " + r, SIW / 2, y + h + 10 + i * 10, 1, GOLD));
}
function bigStar(cx, cy, on) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  poly(INK, pts.map(([a, b]) => [cx + (a - cx) * 1.25, cy + (b - cy) * 1.25])); poly(on ? GOLD : "#3c465a", pts);
}
function drawSiegeMenu() {
  const w = 160, h = 82, x = SIW / 2 - w / 2, y = SIH / 2 - h / 2;
  g.globalAlpha = 0.55; rect("#060a1e", 0, 0, SIW, SIH); g.globalAlpha = 1;
  box(x, y, w, h, "#78bee6"); text("PAUSED", SIW / 2, y + 11, 1, GOLD);
  ["RESUME", "RESTART MAP", SG.test ? "LEAVE THE SIEGE" : "BACK TO THE MAP LIST"].forEach((lab, i) => siegeBtn(x + 16, y + 22 + i * 19, w - 32, 15, lab, i === 2 ? RED : null));
}

// ---------------------------------------------------------------------------------------------------- input
function siegePos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SIW, (e.clientY - r.top) / r.height * SIH]; }
const hitR = (x, y, [a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h;
function siegeClick(x, y) {
  const G = SG; if (!G) return;
  if (G.camp) { campClick(x, y); return; }
  if (G.result) {
    const w = 200, h = 96, bx = SIW / 2 - w / 2, by = SIH / 2 - h / 2;
    if (hitR(x, y, [bx + 16, by + h - 24, 76, 16])) startSiege(G.id, siegeAgain());
    else if (hitR(x, y, [bx + w - 92, by + h - 24, 76, 16])) siegeDone();
    return;
  }
  if (G.menu) {
    const w = 160, h = 82, bx = SIW / 2 - w / 2, by = SIH / 2 - h / 2;
    const i = [0, 1, 2].find(k => hitR(x, y, [bx + 16, by + 22 + k * 19, w - 32, 15]));
    if (i === 0) { G.menu = false; G.paused = false; } else if (i === 1) startSiege(G.id, siegeAgain()); else if (i === 2) siegeDone(); else { G.menu = false; G.paused = false; }
    play("tick"); return;
  }
  if (siegeCanCall() && hitR(x, y, SIEGE_HUD.next)) { callWave(); return; }
  if (hitR(x, y, SIEGE_HUD.speed)) { G.speed = G.speed === 2 ? 1 : 2; play("tick"); return; }
  if (hitR(x, y, SIEGE_HUD.pause)) { G.paused = !G.paused; play("tick"); return; }
  if (siegeCanCall()) for (const pl of G.R.routes) { const [mx, my] = markerPos(pl); if (Math.hypot(x - mx, y - my) < 12) { callWave(); return; } }
  if (G.ring !== null) {
    const b = ringFor(G.ring).find(b => b[2] === "sell" ? Math.abs(x - b[0]) < 18 && Math.abs(y - b[1]) < 7 : Math.hypot(x - b[0], y - b[1]) < 12);
    if (b) { ringAct(b); return; }
    G.ring = null;
  }
  if (G.hero) for (const i of [0, 1]) if (hitR(x, y, heroBtn(i))) { heroAbility(i ? "e" : "q"); return; }
  if (hitR(x, y, HERO_PANEL)) return;
  const pi = G.M.pads.findIndex(([px, py], i) => Math.hypot(x - px, (y - py) * 1.6) < 14 || (G.towers[i] && x > px - 10 && x < px + 10 && y > py - 30 && y < py + 4));
  if (pi >= 0) { G.ring = pi; play("tick"); return; }
  if (G.hero && !G.hero.dead && y > 22) { G.hero.tx = clamp(x, 6, SIW - 6); G.hero.ty = clamp(y, 26, SIH - 4); G.hero.flag = 1.2; play("tick", 0.5); }
}
function siegeTouch(e) { const [x, y] = siegePos(e); if (SG.camp) SG.camp.hover = [x, y]; else SG.hover = [x, y]; siegeClick(x, y); }
function siegeMove(e) { if (!SG) return; if (SG.camp) SG.camp.hover = siegePos(e); else SG.hover = siegePos(e); }
function siegeKey(e, down) {
  if (!SG || !down) return;
  if (SG.camp) { campKey(e); return; }
  const c = e.code, G = SG;
  if (c === "Escape") { e.preventDefault(); if (G.result) return; if (G.ring !== null) { G.ring = null; return; } G.menu = !G.menu; G.paused = G.menu; play("tick"); return; }
  if (G.result || G.menu) { if (c === "Space" || c === "Enter") { e.preventDefault(); if (G.result) { if (c === "Enter") siegeDone(); else startSiege(G.id, siegeAgain()); } else { G.menu = false; G.paused = false; } } return; }
  if (c === "Space") { e.preventDefault(); G.paused = !G.paused; return; }
  if (c === "KeyN") { callWave(); return; }
  if (c === "KeyQ") { heroAbility("q"); return; }
  if (c === "KeyE") { heroAbility("e"); return; }
  if (c === "Tab") { e.preventDefault(); G.speed = G.speed === 2 ? 1 : 2; play("tick"); return; }
  if (/^Digit[1-9]$/.test(c) && G.ring !== null) { const btns = ringFor(G.ring).filter(b => b[2] !== "sell"), b = btns[+c.slice(5) - 1]; if (b) ringAct(b); return; }
  if (c === "KeyX" && G.ring !== null && G.towers[G.ring]) { ringAct(ringFor(G.ring).find(b => b[2] === "sell")); return; }
}
function siegeUpdate(dt) {
  if (!SG) return;
  if (SG.camp) { SG.camp.t += dt; if (SG.camp.msg) { SG.camp.msg.t -= dt; if (SG.camp.msg.t <= 0) SG.camp.msg = null; } return; }
  S.shake = Math.max(0, (S.shake || 0) - dt);
  if (SG.result) { SG.result.t += dt; return; }
  if (SG.paused) return;
  let left = dt * SG.speed;
  while (left > 0 && SG && !SG.result) { const h = Math.min(left, 1 / 60); siegeStep(h); left -= h; }
}

// ---------------------------------------------------------------------------------------------------- the campaign (part 3)
// The ocean from the Shallows down: each zone has three maps, the third ends with its guardian. Win a map to open the
// next; win all three to reclaim the zone (it turns from red to blue) and open the one below. Stars buy research.
// SG.camp is set while you're on the campaign screen (SG.M is not), so every handler checks it first.
const Z_TWIST = ["THE TUTORIAL ZONE", "KELP HIDES CREATURES FROM TOWERS", "SIDE CURRENTS SPEED THEM UP", "LIGHT FADES: LIGHT YOUR TOWERS",
  "TWO PATHS: THE DOORS SWITCH THEM", "DARK: UNLIT TOWERS SEE LESS", "CRYSTALS BOUNCE ZAPS", "VENTS ERUPT ON A TIMER",
  "THE FALLEN RISE ONCE", "THEY COME DOWN THE WALLS", "THEY POUR FROM THE CRACK"];
const Z_GUARD = ["KING CRAB", "KELP WITCH", "MANTIS KING", "GLOOM RAY", "GHOST SHIP", "THE GULPER", "GLASS SPIDER QUEEN", "THE BOIL", "THE OSSUARY", "THE MAW", "THE SLEEPER"];
// Research, bought with stars, one node at a time along each row. [id, label, what it does, stars]
const SPEC_SHORT = [["SNIPER", "BRAIN"], ["SPINES", "FIRE"], ["GIANT", "STINGER"], ["STORM", "BOX"], ["BANK", "BLACK"], ["BIG LIGHT", "SONAR"], ["KRAKEN", "MAELSTROM"]];
const RES = TW.map((d, i) => ({ id: "t" + i, name: d.name, icon: "t" + i + "_1", nodes: [["cost", "-10% COST", "BUILDS 10% CHEAPER", 1], ["range", "+8% RANGE", "8% MORE RANGE", 2], ["dmg", d.kind === "clam" ? "+12% PAY" : d.kind === "light" ? "+12% GLOW" : "+12% DMG", d.kind === "clam" ? "MAKES 12% MORE SHELLS" : d.kind === "light" ? "A 12% WIDER LIGHT" : "12% MORE DAMAGE", 3], ["specA", SPEC_SHORT[i][0], "UNLOCKS " + d.S[0].name + ": " + d.S[0].note, 2], ["specB", SPEC_SHORT[i][1], "UNLOCKS " + d.S[1].name + ": " + d.S[1].note, 2]] }))
  .concat([{ id: "hero", name: "YOUR HERO", icon: null, nodes: [["hp", "+15% HP", "YOUR HERO HAS 15% MORE HEALTH", 2], ["cd", "-15% WAIT", "ABILITIES COME BACK 15% SOONER", 3], ["dmg", "+15% DMG", "YOUR HERO HITS 15% HARDER", 3]] },
    { id: "post", name: "THE OUTPOST", icon: null, nodes: [["shells", "+40 START", "START EVERY MAP WITH 40 MORE SHELLS", 2], ["hull", "+3 HULL", "YOUR BUOY HAS 23 HULL", 3], ["call", "+50% CALL", "CALLING A WAVE EARLY PAYS 50% MORE", 2]] }]);
const resHas = (row, node) => { if (SG && SG.test) return true; const n = siegeSave().res[row] | 0, i = RES.find(r => r.id === row).nodes.findIndex(x => x[0] === node); return i >= 0 && n > i; };
const resOn = (row, node) => !(SG && SG.test) && resHas(row, node);
function starsTotal() { return Object.values(siegeSave().stars).reduce((a, b) => a + b, 0); }
function starsSpent() { const q = siegeSave(); let n = 0; for (const r of RES) for (let i = 0; i < (q.res[r.id] | 0); i++) n += r.nodes[i][3]; return n; }
function mapOpen(id) {                                         // a map opens when the one before it is won (and the zone above is reclaimed)
  if (SG && SG.test) return !!SMAPS[id];
  const [z, m] = id.split(".").map(Number), q = siegeSave();
  if (!SMAPS[id]) return false;
  if (m > 0) return !!q.stars[z + "." + (m - 1)];
  return z === 0 || zoneDone(z - 1);
}
const zoneOpen = z => (SG && SG.test) || z === 0 || zoneDone(z - 1);
const zoneDone = z => [0, 1, 2].every(m => siegeSave().stars[z + "." + m]);
function zonesDone() { let n = 0; while (n < 11 && zoneDone(n)) n++; return n; }

function openCampaign(sel) {
  siegeSave(); fleshAtlas();
  S.state = "siege"; S.overlay = null;
  const q = siegeSave(); q.done = zonesDone();
  let cur = sel; if (!cur) { cur = "0.0"; for (let z = 0; z < 11; z++) for (let m = 0; m < 3; m++) { const id = z + "." + m; if (mapOpen(id) && !q.stars[id]) { cur = id; z = 99; break; } } if (!mapOpen(cur)) cur = "0.0"; }
  const zi = +cur.split(".")[0];
  SG = { camp: { sel: cur, tab: "map", scroll: clamp(zi * 27 - 80, 0, 11 * 27 - 236), hover: null, t: 0, msg: null } };
  siegeResize(); play("select");
  siegeAwards();
}
let SILH = {};
function silhouette(key) {
  if (SILH[key]) return SILH[key];
  const a = SIEGE_ART[key], c = document.createElement("canvas"); c.width = a[2]; c.height = a[3];
  const x = c.getContext("2d"); x.drawImage(SART, a[0], a[1], a[2], a[3], 0, 0, a[2], a[3]); x.globalCompositeOperation = "source-atop"; x.fillStyle = "#140810"; x.fillRect(0, 0, a[2], a[3]);
  SILH[key] = c; return c;
}
const CB = { X0: 4, X1: 250, Y0: 22, BH: 27 };                // the zone list on the left
const CAMP_BTN = { map: [256, 3, 30, 14], research: [288, 3, 54, 14], hero: [344, 3, 32, 14], endless: [378, 3, 50, 14], defend: [262, 178, 112, 20], back: [262, 202, 112, 13], leave: [430, 3, 46, 14] };
function campRows() {                                           // visible zone rows: [z, y]
  const C = SG.camp, out = [];
  for (let z = 0; z < 11; z++) { const y = CB.Y0 + z * CB.BH - C.scroll; if (y > CB.Y0 - CB.BH && y < SIH) out.push([z, y]); }
  return out;
}
const nodeXY = (m, y) => [CB.X0 + 100 + m * 34, y + 14];
function drawCampaign() {
  const C = SG.camp, q = siegeSave();
  rect("#0a1020", 0, 0, SIW, SIH);
  g.save(); g.beginPath(); g.rect(CB.X0, CB.Y0, CB.X1 - CB.X0, SIH - CB.Y0 - 4); g.clip();
  for (const [z, y] of campRows()) {
    const Z = SZ[z], won = zoneDone(z), open = zoneOpen(z);
    rect(Z.sand, CB.X0, y, CB.X1 - CB.X0, CB.BH);
    rect(Z.sand2, CB.X0, y + CB.BH - 6, CB.X1 - CB.X0, 5);
    for (let i = 0; i < 6; i++) ell(Z.sand3, CB.X0 + 20 + i * 40, y + 6 + (i % 2) * 6, 18, 5);
    if (!won) { g.globalAlpha = 0.45; rect("#8c1428", CB.X0, y, CB.X1 - CB.X0, CB.BH); g.globalAlpha = 0.35; for (let k = 8; k < CB.X1 - CB.X0; k += 41) { line("#ff5064", CB.X0 + k, y + CB.BH - 1, CB.X0 + k + 5, y + 14); line("#ff5064", CB.X0 + k + 5, y + 14, CB.X0 + k + 2, y + 2); } g.globalAlpha = 1; }
    rect(INK, CB.X0, y + CB.BH - 1, CB.X1 - CB.X0, 1);
    text(Z.name, CB.X0 + 4, y + 7, 1, won ? WHITE : open ? "#ffd2d2" : "#c89696", "left");
    for (let m = 0; m < 3; m++) {
      const id = z + "." + m, [nx, ny] = nodeXY(m, y), st = q.stars[id] || 0, op = mapOpen(id), sel = C.sel === id;
      const col = st ? CYAN : op ? GOLD : "#6e3c46";
      if (m < 2) line(st ? CYAN : "#503038", nx + 6, ny, nx + 28, ny);
      disc(INK, nx, ny, 6); disc(sel ? "#28406c" : "#0e1a30", nx, ny, 5); ring(col, nx, ny, 5); if (sel) ring(WHITE, nx, ny, 7);
      text(m + 1, nx + 1, ny + 1, 1, col, "center", null);
      if (st) for (let s = 0; s < 3; s++) rect(s < st ? GOLD : "#3c465a", nx - 5 + s * 4, ny + 7, 3, 2);
    }
    const gk = "g" + z, a = SIEGE_ART[gk], gx = CB.X0 + 210;
    if (open || won) g.drawImage(SART, a[0], a[1], a[2], a[3], gx - a[2] / 4, y + 1, a[2] / 2, a[3] / 2);
    else g.drawImage(silhouette(gk), 0, 0, a[2], a[3], gx - a[2] / 4, y + 1, a[2] / 2, a[3] / 2);
    if (won) text("OK", gx + 22, y + 18, 1, LIME, "left");
  }
  g.restore();
  text("THE SIEGE", CB.X0 + 2, 12, 1, GOLD, "left");
  text("STARS " + starsTotal() + "/99  BADGES " + Object.keys(q.badges).length + "/66", CB.X1 - 2, 12, 1, "#aadcff", "right");
  // the right-hand panel
  for (const k of ["map", "research", "hero", "endless"]) { const [x, y, w, h] = CAMP_BTN[k]; siegeBtn(x, y, w, h, k.toUpperCase(), C.tab === k ? GOLD : null); }
  siegeBtn(...CAMP_BTN.leave, "LEAVE", null);
  if (C.tab === "map") drawCampMap();
  else if (C.tab === "research") drawResearch();
  else if (C.tab === "endless") drawEndlessTab();
  else drawHeroTab();
  if (C.msg) { const w = textW(C.msg.s, 1) + 14; g.globalAlpha = Math.min(1, C.msg.t); box(SIW / 2 - w / 2, SIH - 22, w, 16, GOLD); text(C.msg.s, SIW / 2, SIH - 14, 1, WHITE); g.globalAlpha = 1; }
}
function drawCampMap() {
  const C = SG.camp, id = C.sel, M = SMAPS[id], [z, m] = id.split(".").map(Number), q = siegeSave();
  rect(INK, 256, 22, 220, 196); rect("#0e1a30", 257, 23, 218, 194); outline(257, 23, 218, 194, "#78bee6");
  text(SZ[z].name + " " + (m + 1), 264, 32, 1, GOLD, "left");
  text(M ? M.name : "COMING SOON", 264, 44, 1, "#c8e6ff", "left");
  if (M) {
    text(M.waves + " WAVES" + (m === 2 ? " + " + Z_GUARD[z] : ""), 264, 58, 1, "#c8e6ff", "left");
    text(Z_TWIST[z], 264, 70, 1, "#aadcff", "left");
    const fresh = Z_ROSTER[z].filter(k => !q.seen.includes(k) && E_TIPS[k]);
    text(fresh.length ? "NEW:" : "FOES:", 264, 84, 1, fresh.length ? "#ffaaaa" : "#96a0c8", "left");
    (fresh.length ? fresh : Z_ROSTER[z]).slice(0, 5).forEach((k, i) => { const sp = ETYPES[k][1], [w, h] = sprSize(sp); spr(sp, 296 + i * 30 + (24 - w) / 2, 80 - h / 2, false, 1, fleshAtlas()); });
    const st = q.stars[id] || 0;
    text("BEST", 264, 104, 1, "#96a0c8", "left"); for (let s = 0; s < 3; s++) bigStarS(304 + s * 14, 104, s < st);
    drawChallenges(id);
  }
  text("HERO KIT", 264, 122, 1, "#96a0c8", "left");
  const open = kitsOpen();
  KITS.forEach((k, i) => { const x = 264 + i * 70, on = open.includes(i), sel = kitNow() === i; siegeBtn(x, 130, 66, 14, on ? k.name.slice(0, 10) : "???", sel ? GOLD : on ? null : "#5a5a6e"); });
  text("LV " + heroLevel(q.xp) + "  STARS TO SPEND " + (starsTotal() - starsSpent()), 264, 160, 1, "#aadcff", "left");
  const ok = M && mapOpen(id);
  siegeBtn(...CAMP_BTN.defend, ok ? "DEFEND" : "LOCKED", ok ? RED : "#5a5a6e", ok ? "#3c1420" : null);
}
function bigStarS(cx, cy, on) { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2 : 5; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(on ? GOLD : "#3c465a", pts); }
// ---- research (full screen over the map list)
const RES_ROW = i => 42 + i * 22, RES_NODE = (i, j) => [104 + j * 75, RES_ROW(i) - 8, 73, 16], RES_RESET = [SIW - 70, 238, 64, 13];
function drawResearch() {
  const C = SG.camp, q = siegeSave();
  rect("#0a1020", 0, 20, SIW, SIH - 20);
  text("RESEARCH", 8, 28, 1, GOLD, "left");
  text("STARS TO SPEND " + (starsTotal() - starsSpent()) + " OF " + starsTotal() + "  (DOTS = COST)", SIW / 2, 28, 1, "#aadcff");
  siegeBtn(...RES_RESET, "RESET", null);
  let hov = null;
  RES.forEach((row, i) => {
    const y = RES_ROW(i), have = q.res[row.id] | 0;
    if (row.icon) { const a = SIEGE_ART[row.icon]; g.drawImage(SART, a[0], a[1], a[2], a[3], 4, y - 11, a[2] * 0.6, a[3] * 0.6); }
    else if (row.id === "hero") g.drawImage(isleChar("front", 0, false), 8, y - 8); else drawBuoyMini(14, y + 4);
    text(row.name, 25, y, 1, WHITE, "left");
    row.nodes.forEach((n, j) => {
      const [x, ny, w, h] = RES_NODE(i, j), bought = j < have, next = j === have, afford = starsTotal() - starsSpent() >= n[3];
      const hv = C.hover && hitR(C.hover[0], C.hover[1], [x, ny, w, h]); if (hv) hov = [row, n, bought, next];
      rect(INK, x, ny, w, h); rect(bought ? "#3c3010" : "#0e1a30", x + 1, ny + 1, w - 2, h - 2);
      outline(x + 1, ny + 1, w - 2, h - 2, bought ? GOLD : next && afford ? (hv ? WHITE : "#78bee6") : "#3c465a");
      text(n[1], x + 4, ny + 8, 1, bought ? GOLD : next ? WHITE : "#6e788c", "left", null);
      if (!bought) for (let k = 0; k < n[3]; k++) rect(next && afford ? GOLD : "#4c566a", x + w - 5, ny + 3 + k * 4, 2, 2);
    });
  });
  if (hov) { const [row, n, bought, next] = hov, s = row.name + ": " + n[2] + (bought ? " (DONE)" : " - " + n[3] + " STAR" + (n[3] > 1 ? "S" : "") + (next ? "" : ", AFTER THE ONE BEFORE")); box(SIW / 2 - (textW(s, 1) + 12) / 2, SIH - 16, textW(s, 1) + 12, 13, "#78bee6"); text(s, SIW / 2, SIH - 9, 1, WHITE); }
}
function drawBuoyMini(x, y) { rect("#46464e", x, y - 14, 1, 10); ell("#e63c3c", x - 4, y - 10, 9, 7); rect("#fafafa", x - 4, y - 7, 9, 1); }
function researchClick(x, y) {
  const q = siegeSave();
  if (hitR(x, y, RES_RESET)) { q.res = {}; saveStore(); play("back"); campMsg("RESEARCH RESET. ALL STARS BACK."); return; }
  RES.forEach((row, i) => row.nodes.forEach((n, j) => {
    if (!hitR(x, y, RES_NODE(i, j))) return;
    const have = q.res[row.id] | 0;
    if (j !== have) { play("miss"); return; }
    if (starsTotal() - starsSpent() < n[3]) { play("miss"); campMsg("NOT ENOUGH STARS. WIN MAPS WITH LESS HULL LOST."); return; }
    q.res[row.id] = have + 1; saveStore(); play("select");
  }));
}
// ---- the hero tab
function drawHeroTab() {
  const q = siegeSave(), lv = heroLevel(q.xp), open = kitsOpen();
  rect("#0a1020", 0, 20, SIW, SIH - 20);
  text("YOUR HERO", 8, 28, 1, GOLD, "left");
  text("LEVEL " + lv, SIW / 2, 28, 1, GOLD);
  const nx = lv < 20 ? heroXpFor(lv + 1) : heroXpFor(20), px = heroXpFor(lv), k = lv < 20 ? (q.xp - px) / (nx - px) : 1;
  rect(INK, SIW / 2 - 80, 36, 160, 6); rect(LIME, SIW / 2 - 79, 37, Math.round(158 * k), 4);
  text(lv < 20 ? (q.xp - px) + "/" + (nx - px) + " XP" : "MAX LEVEL", SIW / 2, 50, 1, "#aadcff");
  KITS.forEach((d, i) => {
    const x = 12 + i * 156, y = 62, on = open.includes(i), sel = kitNow() === i;
    rect(INK, x, y, 148, 150); rect("#0e1a30", x + 1, y + 1, 146, 148); outline(x + 1, y + 1, 146, 148, sel ? GOLD : on ? "#78bee6" : "#3c465a");
    if (on) {
      const c = isleChar("front", 0, false); g.drawImage(c, 0, 0, c.width, c.height, x + 74 - c.width * 1.5, y + 12, c.width * 3, c.height * 3);
      text(d.name, x + 74, y + 64, 1, GOLD);
      text("Q " + d.q[0], x + 8, y + 80, 1, CYAN, "left"); text("E " + d.e[0], x + 8, y + 92, 1, ORANGE, "left");
      const notes = [["THROWS HARPOONS", "REELS ONE BACK", "HITS A CROWD"], ["HITS HARDEST UP CLOSE", "SLOWS AN AREA", "BUNCHES THEM UP"], ["CARRIES A LIGHT", "LIGHTS AN AREA", "STUNS A CROWD"]][i];
      notes.forEach((s, j) => text(s, x + 8, y + 108 + j * 10, 1, "#96a0c8", "left"));
      siegeBtn(x + 30, y + 132, 88, 13, sel ? "CHOSEN" : "CHOOSE", sel ? GOLD : null);
    } else {
      text("???", x + 74, y + 50, 2, "#5a5a6e");
      text(i === 1 ? "RECLAIM THE KELP FOREST" : "RECLAIM TWILIGHT", x + 74, y + 90, 1, "#96a0c8");
    }
  });
  text("EVERY CHARACTER FIGHTS THE SAME. YOUR LOOK COMES WITH YOU.", SIW / 2, SIH - 12, 1, "#96a0c8");
}
function campMsg(s) { SG.camp.msg = { s, t: 3 }; }
function campClick(x, y) {
  const C = SG.camp, q = siegeSave();
  for (const k of ["map", "research", "hero", "endless"]) if (hitR(x, y, CAMP_BTN[k])) { C.tab = k; play("tick"); if (k === "endless") endlessBoards(); return; }
  if (hitR(x, y, CAMP_BTN.leave)) { siegeLeave(); return; }
  if (C.tab === "research") { researchClick(x, y); return; }
  if (C.tab === "endless") { endlessClick(x, y); return; }
  if (C.tab === "map" && q.stars[C.sel] && SMAPS[C.sel]) for (let i = 0; i < 2; i++) if (hitR(x, y, CH_BTN[i])) { startSiege(C.sel, { kit: kitNow(), mode: i ? "iron" : "riptide" }); return; }
  if (C.tab === "hero") {
    KITS.forEach((d, i) => { const bx = 12 + i * 156; if (hitR(x, y, [bx + 30, 194, 88, 13]) && kitsOpen().includes(i)) { q.kit = i; saveStore(); play("select"); } });
    return;
  }
  for (const [z, ry] of campRows()) for (let m = 0; m < 3; m++) { const [nx, ny] = nodeXY(m, ry); if (ry >= CB.Y0 - 8 && Math.hypot(x - nx, y - ny) < 9) { C.sel = z + "." + m; play("tick"); return; } }
  for (let i = 0; i < 3; i++) if (hitR(x, y, [264 + i * 70, 130, 66, 14])) { if (kitsOpen().includes(i)) { q.kit = i; saveStore(); play("select"); } else { play("miss"); campMsg(i === 1 ? "RECLAIM THE KELP FOREST TO OPEN THE NETCASTER." : "RECLAIM TWILIGHT TO OPEN THE LAMPLIGHTER."); } return; }
  if (hitR(x, y, CAMP_BTN.defend)) { if (SMAPS[C.sel] && mapOpen(C.sel)) startSiege(C.sel, { kit: kitNow() }); else { play("miss"); campMsg(SMAPS[C.sel] ? "WIN THE MAP BEFORE IT FIRST." : "THIS PART OF THE OCEAN ISN'T READY YET."); } }
}
function campKey(e) {
  const C = SG.camp, c = e.code;
  if (c === "Escape") { e.preventDefault(); if (C.tab !== "map") { C.tab = "map"; play("tick"); } else siegeLeave(); return; }
  const dy = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
  if (dy && C.tab === "map") { e.preventDefault(); C.scroll = clamp(C.scroll + dy * CB.BH, 0, 11 * CB.BH - 236); return; }
  if ((c === "Enter" || c === "Space") && C.tab === "map") { e.preventDefault(); campClick(CAMP_BTN.defend[0] + 2, CAMP_BTN.defend[1] + 2); }
}
function campWheel(e) { if (SG && SG.camp && SG.camp.tab === "map") SG.camp.scroll = clamp(SG.camp.scroll + Math.sign(e.deltaY) * CB.BH, 0, 11 * CB.BH - 236); }
canvas.addEventListener("wheel", e => { if (S && S.state === "siege" && SG && SG.camp) { e.preventDefault(); campWheel(e); } }, { passive: false });

function drawGuardian(e) {
  const z = e.boss - 1;
  g.globalAlpha = 0.3; ell("#000000", e.x - 26, e.y - 3, 52, 8); g.globalAlpha = 1;
  if (z === 10) drawSleeperSiege(e);
  else { const a = SIEGE_ART["g" + z], bob = Math.round(Math.sin(SG.t * 3) * 1.5); if (e.hitT > 0) g.globalAlpha = 0.75; sSprite("g" + z, e.x - a[2] / 2, e.y - a[3] + 4 + bob, !e.right); g.globalAlpha = 1; }
  if (e.held > 0) { g.globalAlpha = 0.6; ring("#82f0ff", e.x, e.y - 16, 20); g.globalAlpha = 1; }
  if (z === 7 && e.heat > 0) { g.globalAlpha = 0.4 + 0.3 * Math.sin(SG.t * 10); ring("#ff8c3c", e.x, e.y - 20, 28); g.globalAlpha = 1; }
}
function drawBossBar() {
  const e = SG.en.find(o => o.boss && o.hp > 0); if (!e) return;
  const w = 180, x = SIW / 2 - w / 2, y = 24;
  rect(INK, x, y, w, 12); rect("#3c0a14", x + 1, y + 1, w - 2, 10); rect("#e63c50", x + 1, y + 1, Math.round((w - 2) * e.hp / e.max), 10);
  text(GUARD[e.boss - 1].name + (e.lives ? " x" + (e.lives + 1) : ""), SIW / 2, y + 6, 1, WHITE);
}
function drawPadMarks() {
  const G = SG;
  for (const i in G.overgrown || {}) { const [x, y] = G.M.pads[i], r = seeded(i * 17); for (let k = 0; k < 9; k++) { const px = x + r.randint(-10, 10), h = r.randint(10, 20); for (let j = 0; j < h; j++) rect(j % 4 === 3 ? "#5ab464" : "#2c7a44", px + Math.sin(j / 3 + G.t * 2 + k) * 1.5, y + 3 - j, 2, 1); } text("WALK HERE", x, y + 12, 1, LIME); }
  for (const i in G.eaten || {}) { const [x, y] = G.M.pads[i]; ell("#3c0a14", x - 12, y - 6, 24, 12); for (let k = -10; k <= 10; k += 4) { rect("#f0e6dc", x + k, y - 5, 2, 3); rect("#f0e6dc", x + k + 1, y + 3, 2, 3); } text(Math.ceil(G.eaten[i]), x, y - 14, 1, RED); }
}

// ---------------------------------------------------------------------------------------------------- the leak and the Admiral (part 7)
// Once you have 10 dives, red Flipside spawn drift through about one dive in two (caught like bottles: no hook slot, no
// weight, no score). LEAK n/15 shows under your coins. At 15 the Admiral moors his iron gunboat by the Rusty Hook, and
// tapping it opens the siege (on phones, THE SIEGE is in the MORE menu). Rewards come back topside: titles, songs, a hat,
// a pet, a flag, a boat and a FIN PRIX paint, all earned, never sold.
const LEAK = { AT: 10, N: 15, P: 0.5 };
const leakN = () => (store.siege && store.siege.leak) | 0;
const siegeUnlocked = () => leakN() >= LEAK.N;
function siegeCast() {                                           // game.js: end of cast()
  S.spawns = [];
  if (siegeUnlocked() || store.dives < LEAK.AT) return;
  const r = RNG((S.seed ^ 0x5ee9e) >>> 0);
  if (r.random() < LEAK.P) S.spawns.push({ x: r.uniform(10, LW - 24), y: r.uniform(60, 1080) * M });
}
function siegeHook() {                                           // game.js: in hookCheck, beside the bottle
  if (!S.spawns) return;
  for (const d of S.spawns) {
    if (d.got) continue;
    const cx = d.x + 7, dy = S.hy - d.y;
    if (Math.abs(dy) < 40) d.x += clamp(S.hx - cx, -0.3, 0.3);
    if (Math.abs(S.hx - cx) < 8 && Math.abs(dy) < 9) {
      d.got = true; const q = siegeSave(); q.leak = Math.min(LEAK.N, (q.leak | 0) + 1);
      S.popups.push(["FLIPSIDE SPAWN! " + q.leak + "/" + LEAK.N, 2.6, "#ff6e78"]);
      if (q.leak === 1) S.popups.push(["SOMETHING IS LEAKING UP FROM BELOW...", 3.2, "#ffc8c8"]);
      if (q.leak === LEAK.N) S.popups.push(["THE ADMIRAL HAS MOORED BY THE RUSTY HOOK!", 3.6, GOLD]);
      saveStore(); splash(S.hx, S.hy, 6, "#ff6e78"); play("growl", 0.5);
    }
  }
}
function siegeDraw(cam, t) {                                     // game.js: in the ocean, with the raft parts
  if (!S.spawns || !S.prepared) return;
  for (const d of S.spawns) {
    if (d.got) continue;
    const [x, y] = driftXY(d, cam, t);
    if (y < -12 || y > LH + 12) continue;
    const pu = 0.5 + 0.5 * Math.sin(t * 4);
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.12 + 0.1 * pu; disc("#ff3c50", x + 7, y, 10); disc("#ff3c50", x + 7, y, 5); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    const a = SIEGE_ART.egg; g.drawImage(SART, a[0], a[1], a[2], a[3], x, y - (a[3] >> 1), a[2], a[3]);
  }
}
function siegeLights(lights, cam, t) { if (!S.spawns || !S.prepared) return; for (const d of S.spawns) if (!d.got) { const [x, y] = driftXY(d, cam, t); lights.push([x + 7, y, 14]); } }
const gunboatX = () => OX - 78;                                  // moored left of the Rusty Hook, on wide screens
function siegeScene(wl) {                                        // game.js: the title screen's shore
  if (S.state !== "title" || S.overlay) return;
  if (!siegeUnlocked() && leakN() > 0) text("LEAK " + leakN() + "/" + LEAK.N, 4, 20, 1, "#ff6e78", "left");
  if (!siegeUnlocked() || !wideMenus()) return;
  const x = gunboatX(), bob = Math.round(Math.sin(T * 1.8) * 1), a = SIEGE_ART.gunboat, ad = SIEGE_ART.admiral;
  g.drawImage(SART, a[0], a[1], a[2], a[3], x, wl - a[3] + 6 + bob, a[2], a[3]);
  g.drawImage(SART, ad[0], ad[1], ad[2], ad[3], x + 20 - ad[2] / 2 + 2, wl - a[3] - ad[3] + 18 + bob, ad[2], ad[3]);
  if (!siegeSave().met && Math.floor(T * 2) % 2) text("!", x + 22, wl - a[3] - ad[3] + 10 + bob, 1, GOLD);
}
function siegeTap(rx, ly, wl) {                                  // game.js: titleTap, before the tavern
  if (!siegeUnlocked() || !wideMenus()) return false;
  const x = gunboatX(), a = SIEGE_ART.gunboat;
  if (rx >= x - 2 && rx < x + a[2] + 2 && ly >= wl - a[3] - 22 && ly < wl + 8) { siegeEnter(); return true; }
  return false;
}
const siegeAtMore = () => siegeUnlocked() && !wideMenus();       // phones: THE SIEGE in the MORE menu
const siegeLeakBottle = () => leakN() >= 1 && !siegeUnlocked();  // bottle 17 waits for the first spawn
BOTTLES.push(["THE RED EGGS ARE NOT FISH. SOMEONE SHOULD BE COUNTING THEM.", "leak"]);
const ADMIRAL_TALK = [
  "AHOY THERE. THOSE RED EGGS YOU'VE BEEN FISHING UP? FLIPSIDE SPAWN. THE CRACK IS LEAKING.",
  "THEY'VE HATCHED. THE WHOLE OCEAN IS CRAWLING WITH THEM, FROM THE FLOOR ALL THE WAY UP TO THE SHALLOWS.",
  "WE TAKE IT BACK. ZONE BY ZONE, FROM THE SHALLOWS DOWN TO THE CRACK ITSELF.",
  "YOU BUILD THE DEFENCES AND LEAD FROM THE FRONT. I'LL KEEP THE CHARTS. SHALL WE BEGIN?",
];
function siegeEnter() {
  play("select");
  if (siegeSave().met) { openCampaign(); return; }
  S.overlay = "admiral"; S.admPage = 0;
}
EXTRA_OV.admiral = {
  draw() {
    const W = wideMenus() ? 300 : 116, X = Math.round((LW - W) / 2), y = wideMenus() ? 40 : 20, h = wideMenus() ? 120 : 160;
    g.globalAlpha = 0.7; rect("#060a1e", 0, 0, LW, LH); g.globalAlpha = 1;
    box(X, y, W, h, GOLD);
    const ad = SIEGE_ART.admiral, k = wideMenus() ? 3 : 2;
    g.drawImage(SART, ad[0], ad[1], ad[2], ad[3], X + 8, y + 10, ad[2] * k, ad[3] * k);
    text("THE ADMIRAL", X + 8 + ad[2] * k / 2, y + 14 + ad[3] * k, 1, GOLD);
    const tx = wideMenus() ? X + 70 : X + 6, tw = wideMenus() ? 36 : 18, ty = wideMenus() ? y + 14 : y + 70;
    wrap(ADMIRAL_TALK[S.admPage], tw).forEach((l, i) => text(l, tx, ty + i * 10, 1, WHITE, "left"));
    text(S.admPage < ADMIRAL_TALK.length - 1 ? "TAP TO GO ON" : "TAP TO OPEN THE CHARTS", X + W / 2, y + h - 9, 1, Math.floor(T * 2) % 2 ? GOLD : "#c8a03c");
  },
  tap() { if (S.admPage < ADMIRAL_TALK.length - 1) { S.admPage++; play("tick"); } else { siegeSave().met = 1; saveStore(); S.overlay = null; openCampaign(); } },
  key(code) { if (code === "Space" || code === "Enter") EXTRA_OV.admiral.tap(); },
  back: null,
};
// ---- topside rewards: idempotent, checked whenever the campaign opens and after every map
const SIEGE_TITLES = [["shorewarden", "SHORE WARDEN", "RECLAIM THE SHALLOWS IN THE SIEGE"], ["lightbringer", "LIGHTBRINGER", "RECLAIM THE ABYSS IN THE SIEGE"],
  ["cracksealer", "CRACK SEALER", "SEAL THE CRACK: FINISH THE SIEGE"], ["ironadmiral", "IRON ADMIRAL", "EVERY IRON BADGE IN THE SIEGE"],
  ["riptide", "RIPTIDE", "EVERY RIPTIDE BADGE IN THE SIEGE"], ["holdline", "HOLD THE LINE", "REACH WAVE 50 IN HOLD THE LINE"]];
SIEGE_TITLES.forEach(t => { if (!TITLES.some(q => q[0] === t[0])) { TITLES.push(t); SHOP_TITLE_IDS.push(TITLES.length - 1); } });
const SIEGE_SONGS = [["WAR DRUMS", null, "BEAT YOUR FIRST SIEGE GUARDIAN", 132, "D4 - D4 - F4 - D4 - A4 - G4 - F4 - E4 - D4 - D4 - F4 - A4 - D5 - - - C5 - A4 -", "D2 - D2 - D2 - D2 - A2 - A2 - D2 - D2 - D2 - D2 - F2 - F2 - G2 - - - A2 - A2 -"],
  ["VICTORY AT SEA", null, "FINISH THE SIEGE", 104, "C4 - E4 - G4 - C5 - - - B4 - G4 - A4 - F4 - G4 - - - E4 - G4 - C5 - E5 - D5 - C5 - - -", "C3 - - - G2 - - - F2 - - - G2 - - - C3 - - - A2 - - - F2 - G2 - C3 - - -"]];
const SIEGE_SONG_I = SIEGE_SONGS.map(sg => { let i = SONGS.findIndex(q => q && q[0] === sg[0]); if (i < 0) { SONGS.push(sg); i = SONGS.length - 1; } if (!SONG_IDS.includes(i)) SONG_IDS.push(i); return i; });
if (typeof FP_PAINTS !== "undefined") { FP_PAINTS.ironclad = ["#464a56", "#c83c3c"]; if (!FP_LOOKS.paint.some(q => q[0] === "ironclad")) FP_LOOKS.paint.push(["ironclad", "IRONCLAD", null, "siege99"]); FP_WHO.siege99 = "EARN 99 SIEGE STARS"; }
// cosmetics are worn from the Secrets page, like the secret rewards: [id, name, how, list, item name, earned?]
const SIEGE_COS = [["siege_crab", "THE KING CRAB", "3 STARS ON EVERY SHALLOWS MAP IN THE SIEGE", "pet", "KING CRAB", q => ["0.0", "0.1", "0.2"].every(id => q.stars[id] === 3)],
  ["siege_flag", "THE SIEGE FLAG", "50 STARS IN THE SIEGE", "flag", "THE SIEGE", () => starsTotal() >= 50],
  ["siege_hat", "THE SIEGE BICORNE", "SEAL THE CRACK IN THE SIEGE", "hat", "SIEGE BICORNE", () => zoneDone(10)],
  ["siege_boat", "THE IRONCLAD", "EVERY IRON BADGE IN THE SIEGE", "boat", "IRONCLAD", () => ironAll()]];
const COS_LIST = { pet: "pets", flag: "flags", hat: "hats", boat: "boats" };
for (const [id, name, how, kind, item] of SIEGE_COS) { const i = DATA[COS_LIST[kind]].indexOf(item); if (i > 0 && !SECRETS.some(q => q[0] === id)) SECRETS.push([id, name, how, [kind, i]]); }
const ironAll = () => { const b = siegeSave().badges; return Object.keys(SMAPS).every(id => b[id + "i"]); };
const riptideAll = () => { const b = siegeSave().badges; return Object.keys(SMAPS).every(id => b[id + "r"]); };
function siegeAwards() {
  const q = siegeSave(), got = [];
  const t = (id, ok) => { if (ok && award(id)) got.push("TITLE: " + TITLES.find(x => x[0] === id)[1]); };
  t("shorewarden", zoneDone(0)); t("lightbringer", zoneDone(5)); t("cracksealer", zoneDone(10)); t("ironadmiral", ironAll()); t("riptide", riptideAll()); t("holdline", (q.endBest | 0) >= 50);
  if (zoneDone(0) && !songOwned(SIEGE_SONG_I[0])) { tav().songs.push(SIEGE_SONG_I[0]); got.push("SONG: WAR DRUMS"); }
  if (zoneDone(10) && !songOwned(SIEGE_SONG_I[1])) { tav().songs.push(SIEGE_SONG_I[1]); got.push("SONG: VICTORY AT SEA"); }
  for (const [id, name, , kind, item, ok] of SIEGE_COS) {
    const i = DATA[COS_LIST[kind]].indexOf(item);
    if (i > 0 && ok(q) && !store.sec.found.includes(id)) { store.sec.found.push(id); if (!store.own[kind].includes(i)) store.own[kind].push(i); got.push(name + " (WEAR IT FROM SECRETS)"); }
  }
  if (typeof fpData === "function" && starsTotal() >= 99 && !fpData().own.includes("paint.ironclad")) { fpData().own.push("paint.ironclad"); got.push("FIN PRIX PAINT: IRONCLAD"); }
  if (got.length) { saveStore(); if (SG && SG.camp) campMsg("TOPSIDE REWARD! " + got[0]); (SG && (SG.rewards = (SG.rewards || []).concat(got))); }
  return got;
}

// ---------------------------------------------------------------------------------------------------- challenges and Hold the Line (part 8)
// Once a map is won, two challenges open on it, each worth a badge: RIPTIDE (tougher waves, 1 hull) and IRON (only two
// tower types, picked by the game). HOLD THE LINE: one endless map a week, the same for everyone (once the Kelp Forest is
// reclaimed); waves keep coming and keep getting harder, and the score is the wave you reach. Shared board under /siege
// (This Week and All Time). That's the one part of the siege that needs database rules (siege node in database.rules.json).
function ironPair(id) {                                          // the two towers an Iron run allows
  const r = seeded(9000 + mapIndex(id)), open = siegeTowersOpen(true), dmg = open.filter(k => [0, 1, 3, 6].includes(k)), z = SMAPS[id].zone;
  const a = r.choice(dmg), rest = open.filter(k => k !== a && k !== 4);
  const b = SZ[z].dark > 0.5 && rest.includes(5) ? 5 : r.choice(rest.filter(k => k !== 5).concat(rest.includes(5) ? [5] : []));
  return [a, b].sort((x, y) => x - y);
}
const weekNow = () => typeof dealerWeek === "function" ? dealerWeek() : Math.floor((Date.now() / 864e5 + 3) / 7);
function endlessMap(wk) { const ids = Object.keys(SMAPS).filter(id => SMAPS[id].zone < 10); return ids[((wk === undefined ? weekNow() : wk) * 7 + 3) % ids.length]; }   // the Floor's split loops make a poor arena
const endlessOpen = () => (SG && SG.test) || zoneDone(1);
function endlessWave(w) {                                        // wave w of Hold the Line: the zone's foes and everything above it, growing without end
  const G = SG, D = Math.min(G.D, 12), r = seeded(weekNow() * 1000 + w), z = G.M.zone, pool = [...new Set(Z_ROSTER.slice(0, z + 1).flat())];
  const budget = (TUNE.b0 + TUNE.b1 * w + TUNE.b2 * w * w) * (1 + TUNE.bD * D) * (w > 12 ? 1 + (w - 12) * 0.09 : 1) * (G.M.ease || 1), groups = [];
  let left = budget, delay = 0;
  const kinds = w < 2 ? ["crawler"] : pool;
  while (left > 1 && groups.length < 5) {
    const k = r.choice(kinds), c = E_COST[k], n = clamp(Math.floor(left / c * (groups.length ? 1 : r.uniform(0.4, 0.6))), 1, 24);
    groups.push([k, n, r.randint(0, G.M.routes.length - 1), k === "runner" ? 0.6 : 0.9, delay]);
    left -= n * c; delay += n * 0.5 + 1.2;
  }
  if (w % 10 === 9) groups.push(["GUARD", 1, r.randint(0, G.M.routes.length - 1), 1, delay + 2]);
  return groups;
}
function endlessDone() {                                         // the buoy fell: score the run, save the best, post it
  const G = SG, wave = Math.max(0, G.wave), wk = weekNow(); G.result.wave = wave;
  if (G.test) return;
  const q = siegeSave(); q.endBest = Math.max(q.endBest | 0, wave); q.endWk = q.endWk && q.endWk[0] === wk ? [wk, Math.max(q.endWk[1], wave)] : [wk, wave];
  G.result.best = q.endWk[1]; saveStore();
  if (store.name && wave > 0 && LB.url) {
    const body = JSON.stringify({ n: store.name, s: wave, k: G.hero ? G.hero.kit : 0, m: G.id, t: Date.now() });
    const post = path => fetch(LB.url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    Promise.all([post("/siege/week/" + wk + ".json"), post("/siege/all.json")]).then(([a, b]) => { if (!a.ok || !b.ok) G.result.note = "UPDATE THE DATABASE RULES"; }).catch(() => {});
  }
}
async function endlessBoards() {                                 // This Week and All Time, for the ENDLESS tab
  const C = SG && SG.camp; if (!C) return;
  C.boards = { status: LB.url ? "LOADING..." : "NO SHARED BOARD SET UP" };
  if (!LB.url) return;
  try { const [w, a] = await Promise.all([LB.top("/siege/week/" + weekNow()), LB.top("/siege/all")]); if (SG && SG.camp) SG.camp.boards = { week: w, all: a, status: "" }; }
  catch (e) { if (SG && SG.camp) SG.camp.boards = { status: "CAN'T REACH THE BOARD" }; }
}
const CH_BTN = [[352, 97, 56, 13], [412, 97, 56, 13]];
function drawChallenges(id) {                                    // on the MAP tab, once the map is won
  const q = siegeSave(); if (!q.stars[id] || !SMAPS[id]) return;
  ["RIPTIDE", "IRON"].forEach((lab, i) => { const got = q.badges[id + (i ? "i" : "r")]; siegeBtn(...CH_BTN[i], (got ? "* " : "") + lab, got ? GOLD : i ? "#c8c8d2" : CYAN); });
  const ip = ironPair(id).map(k => TW[k].name.split(" ")[0]).join(" + ");
  if (SG.camp.hover && hitR(SG.camp.hover[0], SG.camp.hover[1], CH_BTN[0])) text("TOUGHER WAVES, ONLY 1 HULL", 410, 116, 1, CYAN);
  else if (SG.camp.hover && hitR(SG.camp.hover[0], SG.camp.hover[1], CH_BTN[1])) text("ONLY " + ip, 410, 116, 1, "#c8c8d2");
}
function drawEndlessTab() {
  const C = SG.camp, q = siegeSave(), wk = weekNow(), id = endlessMap(wk), M = SMAPS[id];
  rect("#0a1020", 0, 20, SIW, SIH - 20);
  text("HOLD THE LINE", 8, 28, 1, GOLD, "left");
  if (!endlessOpen()) { text("RECLAIM THE KELP FOREST TO OPEN HOLD THE LINE.", SIW / 2, SIH / 2, 1, "#96a0c8"); return; }
  text("THIS WEEK: " + M.name + " (" + SZ[M.zone].name + ")", SIW / 2, 28, 1, "#aadcff");
  text("ONE MAP A WEEK, THE SAME FOR EVERYONE. WAVES NEVER STOP. HOW FAR CAN YOU HOLD?", SIW / 2, 40, 1, "#96a0c8");
  const mine = q.endWk && q.endWk[0] === wk ? q.endWk[1] : 0;
  text("YOUR BEST THIS WEEK: WAVE " + mine + "   ALL TIME: WAVE " + (q.endBest | 0), SIW / 2, 52, 1, WHITE);
  const B = C.boards || { status: "" };
  [["THIS WEEK", B.week], ["ALL TIME", B.all]].forEach(([lab, rows], i) => {
    const x = 20 + i * 228, y = 62;
    rect(INK, x, y, 212, 140); rect("#0e1a30", x + 1, y + 1, 210, 138); outline(x + 1, y + 1, 210, 138, "#78bee6");
    text(lab, x + 106, y + 9, 1, GOLD);
    if (!rows || !rows.length) text(B.status || "NO WAVES HELD YET", x + 106, y + 70, 1, "#96a0c8");
    else rows.forEach((e, k) => { const yy = y + 22 + k * 11, me = e.n === store.name; text((k + 1) + ". " + e.n, x + 8, yy, 1, me ? GOLD : WHITE, "left"); text("WAVE " + e.s, x + 150, yy, 1, me ? GOLD : "#aadcff", "right"); text(KITS[e.k | 0] ? KITS[e.k | 0].name.slice(0, 4) : "", x + 204, yy, 1, "#96a0c8", "right"); });
  });
  KITS.forEach((k, i) => { const on = kitsOpen().includes(i); siegeBtn(20 + i * 70, 212, 66, 14, on ? k.name.slice(0, 10) : "???", kitNow() === i ? GOLD : on ? null : "#5a5a6e"); });
  siegeBtn(330, 210, 130, 18, "HOLD THE LINE", RED, "#3c1420");
  if (!store.name) text("SET YOUR INITIALS IN MORE TO GO ON THE BOARD", 330 + 65, 236, 1, "#96a0c8");
}
function endlessClick(x, y) {
  if (!endlessOpen()) return;
  KITS.forEach((k, i) => { if (hitR(x, y, [20 + i * 70, 212, 66, 14]) && kitsOpen().includes(i)) { siegeSave().kit = i; saveStore(); play("select"); } });
  if (hitR(x, y, [330, 210, 130, 18])) startSiege(endlessMap(), { mode: "endless", kit: kitNow() });
}

window.SIEGE = { get SG() { return SG; }, set SG(v) { SG = v; }, startSiege, ironPair, endlessMap, endlessWave, weekNow, endlessOpen, siegeCast, siegeHook, siegeAwards, siegeEnter, siegeUnlocked, LEAK, SIEGE_COS, SIEGE_TITLES, TUNE, GUARD, addGuardian, zoneDark, doorOpen, inKelp, ZMAPS, autoLayout, HUD_KEEP, openCampaign, campClick, mapOpen, zonesDone, starsTotal, starsSpent, RES, resHas, heroAbility, heroTick, heroLevel, heroXpFor, KITS, kitsOpen, newHero, siegeStep, callWave, ringFor, ringAct, siegeClick, siegeKey, SMAPS, TW, ETYPES, buildWaves, mapRoutes, siegeSave, towerStats, inRange, atS, polyline, catmull, onRoad, inPool, hpScale, Z_ROSTER, E_COST, SZ };
if (TEST_SIEGE) { const w = setInterval(() => { if (S && atlas && atlas.complete) { clearInterval(w); if (TEST_SIEGE === "campaign") { openCampaign(); return; } if (TEST_SIEGE === "endless") { startSiege(endlessMap(), { test: true, mode: "endless" }); return; } let kit = 0; try { kit = clamp(parseInt(new URLSearchParams(location.search).get("kit"), 10) || 0, 0, 2); } catch (e) {} startSiege(SMAPS[TEST_SIEGE] ? TEST_SIEGE : "0.0", { test: true, kit }); } }, 50); }
