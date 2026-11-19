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
  { name: "THE FLOOR", sand: "#4c3440", sand2: "#402a36", sand3: "#5a404c", deep: "#1a0610", trench: "#38222c", edge: "#28161e", rock: "#4a3440", rockTop: "#684a58", grass: "#5a3c48", deco: ["flesh", "rock", "glow"], dark: 0.6 },
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
  healer: ["HEALER", "fc_drownedangler", 55, 18, 0.2, 0, 2, 11, "H"],
  shield: ["SHIELD", "fc_eyecluster", 50, 19, 0, 0.3, 1, 11, "S"],
  hidden: ["HIDDEN", "fc_shadowshark", 40, 30, 0, 0, 1, 9, "h"],
  grab: ["GRABBER", "fc_barnaclehand", 60, 20, 0.3, 0, 2, 11, "g"],
  brute: ["BRUTE", "fc_marrowworm", 260, 12, 0.3, 0.2, 5, 30, "b"],
};
const E_COST = { crawler: 1, runner: 1, armour: 2.4, slimy: 2, split: 2.4, float: 2, healer: 3, shield: 3, hidden: 2, grab: 3, brute: 9 };
// Which enemies each zone brings (new ones get a popup the first time).
const Z_ROSTER = [
  ["crawler", "runner", "armour"], ["crawler", "runner", "armour", "slimy"], ["crawler", "runner", "slimy", "split", "float"],
  ["runner", "armour", "split", "float", "hidden"], ["crawler", "armour", "slimy", "float", "hidden", "grab"],
  ["runner", "armour", "hidden", "healer", "grab"], ["armour", "slimy", "split", "shield", "hidden", "float"],
  ["runner", "slimy", "split", "healer", "shield", "grab"], ["armour", "split", "healer", "shield", "grab", "hidden"],
  ["runner", "float", "hidden", "healer", "shield", "grab"], ["armour", "slimy", "split", "float", "healer", "shield", "hidden", "grab"],
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
    L: [{ r: 54, boost: 0.1 }, { r: 62, boost: 0.12 }, { r: 72, boost: 0.15 }],
    S: [{ name: "LIGHTHOUSE BUOY", note: "BIG LIGHT, CRITICAL HITS", cost: 200, r: 100, boost: 0.15, crit: 0.2 },
        { name: "SONAR BUOY", note: "LIT ENEMIES TAKE MORE", cost: 200, r: 74, boost: 0.15, mark: 0.25 }] },
  { id: "kraken", name: "KRAKEN PIT", note: "HUGE SLAMS", cost: 200, up: [180, 220], kind: "slam", dmg: "phys",
    L: [{ r: 52, d: 60, t: 3.5, a: 20 }, { r: 54, d: 90, t: 3.4, a: 21 }, { r: 58, d: 130, t: 3.3, a: 22 }],
    S: [{ name: "KRAKEN", note: "CRUSHES GUARDIANS", cost: 380, r: 62, d: 260, t: 3.3, a: 24, boss: 2 },
        { name: "MAELSTROM", note: "DRAGS THEM BACK", cost: 340, r: 60, d: 40, t: 4.5, a: 32, drag: 44 }] },
];
const towerStats = t => t.spec >= 0 ? TW[t.k].S[t.spec] : TW[t.k].L[t.lv - 1];
const towerKey = t => "t" + t.k + "_" + (t.spec >= 0 ? "AB"[t.spec] : t.lv);
function towerSpent(t) { const d = TW[t.k]; let n = d.cost; for (let i = 1; i < t.lv; i++) n += d.up[i - 1]; if (t.spec >= 0) n += d.S[t.spec].cost; return n; }

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
function buildWaves(id, M) {
  const D = mapIndex(id), r = seeded(1000 + D), roster = Z_ROSTER[M.zone], out = [];
  const pool = D === 0 ? ["crawler", "runner"] : roster;
  for (let w = 0; w < M.waves; w++) {
    const budget = (12 + w * 7.5) * (1 + D * 0.14), groups = [];
    let left = budget, delay = 0;
    const kinds = w < 2 ? ["crawler"] : pool.filter(k => w >= 3 || E_COST[k] <= 2.4);
    while (left > 1 && groups.length < 4) {
      const k = r.choice(kinds), c = E_COST[k], n = clamp(Math.floor(left / c * (groups.length ? 1 : r.uniform(0.45, 0.75))), 1, 18);
      groups.push([k, n, r.randint(0, M.routes.length - 1), k === "runner" ? 0.7 : 1.1, delay]);
      left -= n * c; delay += n * (k === "runner" ? 0.7 : 1.1) * 0.6 + 1.5;
    }
    if (w === M.waves - 1 && D >= 1) groups.push(["brute", 1 + Math.floor(D / 4), r.randint(0, M.routes.length - 1), 4, delay + 2]);
    out.push(groups);
  }
  return out;
}
const hpScale = D => 1 + 0.16 * D + 0.01 * D * D;

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
  SG = { id, M, R, bg: buildBg(M, R), D: mapIndex(id), test: !!opts.test, waves: buildWaves(id, M), wave: -1, spawn: [], waveT: 0, nextT: 0,
    shells: M.start, hull: 20, towers: M.pads.map(() => null), en: [], shots: [], fx: [], burns: [], pops: [], t: 0, speed: 1, paused: false,
    ring: null, hover: null, result: null, menu: false, tip: null, seenNow: [], kills: 0, leaked: 0, hpK: hpScale(mapIndex(id)) };
  siegeResize();
  siegeTip(M.name + ": CLICK A PAD TO BUILD, THEN START.");
  play("select");
}
function siegeLeave() {
  SG = null; newDive(); resize(); play("back");
}
function siegeTip(s) { SG.tip = { s, t: 6 }; }

// ---------------------------------------------------------------------------------------------------- the simulation
function callWave() {
  if (!SG || SG.result || SG.wave >= SG.waves.length - 1) return;
  if (SG.wave >= 0 && SG.nextT > 0) { const bonus = Math.ceil(SG.nextT * 1.5); SG.shells += bonus; siegePop(SIW - 70, 30, "+" + bonus, GOLD); }
  SG.wave++; SG.waveT = 0; SG.nextT = 0;
  for (const [k, n, ri, gap, delay] of SG.waves[SG.wave]) for (let i = 0; i < n; i++) SG.spawn.push([delay + i * gap, k, ri]);
  SG.spawn.sort((a, b) => a[0] - b[0]);
  const fresh = [...new Set(SG.waves[SG.wave].map(g_ => g_[0]))].filter(k => E_TIPS[k] && !siegeSave().seen.includes(k) && !SG.seenNow.includes(k));
  if (fresh.length) { SG.seenNow.push(fresh[0]); if (!SG.test) siegeSave().seen.push(fresh[0]); siegeTip("NEW: " + E_TIPS[fresh[0]]); }
  play("chime");
}
function addEnemy(k, ri, s) {
  const E = ETYPES[k], hp = Math.round(E[2] * SG.hpK);
  const e = { k, ri, s: s || 0, hp, max: hp, spd: E[3], arm: E[4], slime: E[5], hull: E[6], bounty: E[7], fl: E[8], slow: 0, slowT: 0, held: 0, poison: 0, poisonT: 0, x: 0, y: 0, right: true, hitT: 0, grabT: 0, id: Math.random() };
  const [x, y, rt] = atS(SG.R.routes[ri], e.s); e.x = x; e.y = y; e.right = rt;
  SG.en.push(e); return e;
}
function lit(x, y) {                                           // is this spot lit? (dark zones and hidden enemies need light)
  for (const t of SG.towers) if (t && TW[t.k].kind === "light" && inRange(t.x, t.y, x, y, towerStats(t).r)) return true;
  return false;
}
function visibleTo(e) { return !(e.fl.includes("h") || SZ[SG.M.zone].dark > 0.5) || lit(e.x, e.y); }
function hurt(e, dmg, kind, src) {
  if (e.hp <= 0) return;
  let k = 1;
  if (kind === "phys" && !(src && src.pierce)) k *= 1 - e.arm;
  if (kind === "zap") k *= 1 - e.slime;
  if (SG.en.some(o => o !== e && o.hp > 0 && o.fl.includes("S") && Math.hypot(o.x - e.x, o.y - e.y) < 34)) k *= 0.5;   // a shield nearby
  for (const t of SG.towers) if (t && t.spec === 1 && TW[t.k].id === "lantern" && inRange(t.x, t.y, e.x, e.y, towerStats(t).r)) { k *= 1.25; break; }   // sonar marks
  if (src && src.crit && Math.random() < src.crit) { k *= 2; siegePop(e.x, e.y - 12, "CRIT", ORANGE); }
  e.hp -= dmg * k; e.hitT = 0.1;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  SG.shells += e.bounty; SG.kills++;
  siegePop(e.x, e.y - 8, "+" + e.bounty, GOLD);
  SG.fx.push({ k: "pop", x: e.x, y: e.y, t: 0 });
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
    while (G.spawn.length && G.spawn[0][0] <= G.waveT) { const [, k, ri] = G.spawn.shift(); addEnemy(k, ri); }
    if (!G.spawn.length && G.wave < G.waves.length - 1) {
      if (G.nextT <= 0) G.nextT = 18; else { G.nextT -= dt; if (G.nextT <= 0) { G.nextT = 0; callWave(); } }
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
    if (e.fl.includes("H")) for (const o of G.en) if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 40) o.hp = Math.min(o.max, o.hp + 6 * dt);
    if (e.fl.includes("g")) {                                   // grabbers latch onto a tower they pass
      e.grabT -= dt;
      if (e.grabT <= 0) for (const t of G.towers) if (t && !t.off && Math.hypot(t.x - e.x, t.y - e.y) < 26 && !guarded(t)) { t.off = 3; e.grabT = 6; siegePop(t.x, t.y - 26, "GRABBED", RED); break; }
    }
    if (e.held > 0) { e.held -= dt; continue; }
    const pl = G.R.routes[e.ri];
    e.s += e.spd * (1 - e.slow) * dt;
    if (e.s >= pl.total) { e.hp = 0; G.hull -= e.hull; G.leaked += e.hull; siegePop(G.M.buoy[0], G.M.buoy[1] - 34, "-" + e.hull, RED); play("miss", 0.5); S.shake = 0.2; continue; }
    const [x, y, rt] = atS(pl, e.s); e.x = x; e.y = y; e.right = rt;
  }
  G.en = G.en.filter(e => e.hp > 0);
  // towers
  for (const t of G.towers) if (t) towerTick(t, dt);
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
  else if (!G.result && G.wave === G.waves.length - 1 && !G.spawn.length && !G.en.length) siegeEnd(true);
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
  const list = SG.en.filter(e => e.hp > 0 && inRange(t.x, t.y - 4, e.x, e.y, r) && visibleTo(e) && !(opts.ground && e.fl.includes("f")) && !(opts.free && e.held > 0));
  list.sort((a, b) => (b.s / SG.R.routes[b.ri].total) - (a.s / SG.R.routes[a.ri].total));
  return list;
}
function towerTick(t, dt) {
  const d = TW[t.k], st = towerStats(t), [boost, crit] = towerBoost(t), r = st.r * (1 + boost);
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
    const list = targets(t, r); if (!list.length) return;
    let prev = [t.x, t.y - 24], cur = list[0];
    const hit = [];
    for (let i = 0; i < st.chain && cur; i++) {
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
  const G = SG, stars = won ? (G.leaked <= 2 ? 3 : G.leaked <= 10 ? 2 : 1) : 0;
  G.result = { won, stars, t: 0 };
  if (won && !G.test) { const q = siegeSave(); q.stars[G.id] = Math.max(q.stars[G.id] || 0, stars); saveStore(); }
  play(won ? "fanfare" : "miss");
}

// ---------------------------------------------------------------------------------------------------- building
function ringFor(pi) {                                          // the ring menu's buttons around pad pi: [x, y, act, label, icon, cost, ok]
  const [px, py] = SG.M.pads[pi], t = SG.towers[pi], out = [];
  const put = (list, rad) => list.forEach((b, i) => { const a = -Math.PI / 2 + (i - (list.length - 1) / 2) * (list.length > 4 ? 0.78 : 1.0); b[0] = px + Math.cos(a) * rad; b[1] = py - 10 + Math.sin(a) * rad * 0.9; out.push(b); });
  if (!t) {
    const list = siegeTowersOpen().map(k => [0, 0, "build", TW[k].name, "t" + k + "_1", TW[k].cost, SG.shells >= TW[k].cost, k]);
    list.forEach((b, i) => { const n = list.length, a = -Math.PI / 2 + i / n * Math.PI * 2, rx = n > 4 ? 40 : 30, ry = n > 4 ? 34 : 26; b[0] = clamp(px + Math.cos(a) * rx, 14, SIW - 14); b[1] = clamp(py - 8 + Math.sin(a) * ry, 34, SIH - 18); out.push(b); });
  } else {
    const d = TW[t.k], list = [];
    if (t.spec < 0 && t.lv < 3) list.push([0, 0, "up", "LEVEL " + (t.lv + 1), "t" + t.k + "_" + (t.lv + 1), d.up[t.lv - 1], SG.shells >= d.up[t.lv - 1]]);
    if (t.spec < 0 && t.lv === 3) d.S.forEach((sp, i) => list.push([0, 0, "spec", sp.name, "t" + t.k + "_" + "AB"[i], sp.cost, SG.shells >= sp.cost, i]));
    put(list, 30);
    const sell = Math.floor(towerSpent(t) * 0.6);
    out.push([px, py + 18, "sell", "SELL", null, sell, true]);
  }
  return out;
}
function siegeTowersOpen() {                                    // which towers you can build (all of them on the test link)
  if (SG.test) return TW.map((_, i) => i);
  const done = siegeSave().done | 0;                            // zones reclaimed
  return [0, 1, 2].concat(done >= 1 ? [3] : [], done >= 2 ? [4] : [], done >= 3 ? [5] : [], done >= 5 ? [6] : []);
}
function ringAct(b) {
  const pi = SG.ring, [px, py] = SG.M.pads[pi];
  if (!b[6]) { play("miss"); return; }
  if (b[2] === "build") { SG.towers[pi] = { k: b[7], lv: 1, spec: -1, x: px, y: py, cd: 0.3 }; SG.shells -= b[5]; play("select"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "up") { SG.towers[pi].lv++; SG.shells -= b[5]; play("select"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "spec") { SG.towers[pi].spec = b[7]; SG.shells -= b[5]; play("fanfare"); SG.fx.push({ k: "dust", x: px, y: py, t: 0 }); }
  else if (b[2] === "sell") { SG.shells += b[5]; SG.towers[pi] = null; play("back"); }
  SG.ring = null;
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
  // range ellipse for the ring's tower
  if (G.ring !== null && G.towers[G.ring]) { const t = G.towers[G.ring], st = towerStats(t), r = st.r * (1 + towerBoost(t)[0]); if (r) { g.globalAlpha = 0.18; ell("#96dcff", t.x - r, t.y - r * 0.7, r * 2, r * 1.4); g.globalAlpha = 1; } }
  // everything that stands up, sorted by depth
  const items = [];
  for (const d of G.M._deco) items.push([d[2], 0, d]);
  G.towers.forEach(t => { if (t) items.push([t.y, 1, t]); });
  for (const e of G.en) items.push([e.y, 2, e]);
  items.push([G.M.buoy[1], 3]);
  items.sort((a, b) => a[0] - b[0]);
  const fl = fleshAtlas();
  for (const [, kind, o] of items) {
    if (kind === 0) g.drawImage(decoArt(o[0], o[3], G.M.zone), o[1] - 20, o[2] - 36);
    else if (kind === 1) {
      const a = SIEGE_ART[towerKey(o)], bob = o.anim > 0 ? -1 : 0;
      if (o.off) g.globalAlpha = 0.5;
      sSprite(towerKey(o), o.x - a[2] / 2, o.y - a[3] + 5 + bob);
      g.globalAlpha = 1;
      if (o.off) text("ZZ", o.x, o.y - a[3] - 2, 1, RED);
      if (TW[o.k].kind === "light") { g.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 4); disc("#fff0a0", o.x, o.y - a[3] + 6, 2); g.globalAlpha = 1; }
    } else if (kind === 2) {
      const E = ETYPES[o.k], vis = visibleTo(o), [w, h] = sprSize(E[1]);
      if (!vis) { rect("#ff5050", o.x - 2, o.y - 4, 1, 1); rect("#ff5050", o.x + 1, o.y - 4, 1, 1); continue; }
      g.globalAlpha = 0.25; ell("#000000", o.x - w / 2, o.y + 1, w, 3); g.globalAlpha = 1;
      const fy = o.fl.includes("f") ? o.y - h - 6 + Math.sin(G.t * 3 + o.id * 9) * 2 : o.y - h + 2;
      spr(E[1], o.x - w / 2, fy, !o.right, 1, o.hitT > 0 ? atlas : fl);
      if (o.held > 0) { g.globalAlpha = 0.6; ring("#7adc8c", o.x, o.y - 2, 6); g.globalAlpha = 1; }
      if (o.slowT > 0) rect(CYAN, o.x - 1, fy - 2, 2, 1);
      if (o.hp < o.max) { rect(INK, o.x - 6, fy - 4, 12, 3); rect(o.hp / o.max > 0.4 ? LIME : GOLD, o.x - 5, fy - 3, Math.max(1, Math.round(10 * o.hp / o.max)), 1); }
    } else if (kind === 3) drawBuoy(G.M.buoy[0], G.M.buoy[1]);
  }
  // shots and effects
  for (const s of G.shots) {
    if (s.k === "bolt") { rect(s.big ? "#ff5040" : "#ffc896", s.x - 1, s.y - 1, s.big ? 3 : 2, s.big ? 3 : 2); }
    else { disc(INK, s.x, s.y, s.small ? 1 : 2); disc("#a064dc", s.x, s.y, s.small ? 0 : 1); }
  }
  for (const f of G.fx) {
    const k = f.t / (f.dur || 0.4);
    if (f.k === "zap") { g.globalAlpha = 1 - k; zigzag(f.x, f.y, f.tx, f.ty); g.globalAlpha = 1; }
    else if (f.k === "boom") { g.globalAlpha = 1 - k; ring("#ffd28c", f.x, f.y, f.r * (0.4 + k * 0.6)); ring("#a064dc", f.x, f.y, f.r * k * 0.6); g.globalAlpha = 1; }
    else if (f.k === "pop") { g.globalAlpha = 1 - k; ring("#ff8ca0", f.x, f.y - 3, 2 + k * 6); g.globalAlpha = 1; }
    else if (f.k === "dust") { g.globalAlpha = 1 - k; ring("#f0e6d2", f.x, f.y, 6 + k * 10); g.globalAlpha = 1; }
    else if (f.k === "slam") { const u = Math.sin(Math.min(1, k * 2) * Math.PI); line("#963c6e", f.tx, f.ty - 4, lerp(f.tx, f.x, u), lerp(f.ty - 4, f.y - 2, u)); line("#963c6e", f.tx + 1, f.ty - 4, lerp(f.tx, f.x, u) + 1, lerp(f.ty - 4, f.y - 2, u)); if (k > 0.4) { g.globalAlpha = 1 - k; ring("#f0a0c8", f.x, f.y, 6 + k * 16); g.globalAlpha = 1; } }
    else if (f.k === "grab") { if (f.e.hp > 0) { g.globalAlpha = 0.7; line("#5ab464", f.tx, f.ty - 6, f.e.x, f.e.y - 2); g.globalAlpha = 1; } }
  }
  for (const p of G.pops) { g.globalAlpha = 1 - p.t; text(p.s, p.x, p.y, 1, p.col); g.globalAlpha = 1; }
  // dark zones: a mask with holes where it's lit
  if (SZ[G.M.zone].dark > 0) drawDarkness();
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
  const G = SG, Z = SZ[G.M.zone];
  if (!DARKC) { DARKC = document.createElement("canvas"); DARKC.width = SIW; DARKC.height = SIH; }
  const x = DARKC.getContext("2d");
  x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, SIW, SIH);
  x.fillStyle = "rgba(4,4,14," + (0.55 + Z.dark * 0.35) + ")"; x.fillRect(0, 0, SIW, SIH);
  x.globalCompositeOperation = "destination-out";
  const hole = (cx, cy, r) => { for (const [k, a] of [[1, 0.35], [0.8, 0.35], [0.6, 0.6], [0.45, 1]]) { x.fillStyle = "rgba(0,0,0," + a + ")"; x.beginPath(); x.ellipse(cx, cy, r * k, r * k * 0.7, 0, 0, 6.283); x.fill(); } };
  for (const t of G.towers) if (t && TW[t.k].kind === "light") hole(t.x, t.y - 4, towerStats(t).r);
  hole(G.M.buoy[0], G.M.buoy[1] - 10, 34);
  for (const t of G.towers) if (t && TW[t.k].kind !== "light") hole(t.x, t.y - 10, 14);
  for (const f of G.fx) if (f.k === "zap" || f.k === "boom") hole(f.tx || f.x, f.ty || f.y, 16);
  g.drawImage(DARKC, 0, 0);
}
function siegeCanCall() { return SG && !SG.result && SG.wave < SG.waves.length - 1 && (SG.wave < 0 || (!SG.spawn.length && SG.nextT > 0)); }
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
  text("WAVE " + Math.max(0, G.wave + 1) + "/" + G.waves.length, 129, 12, 1, "#aadcff");
  if (siegeCanCall()) { const [x, y, w, h] = SIEGE_HUD.next; siegeBtn(x, y, w, h, G.wave < 0 ? "START" : "NEXT WAVE", RED, "#3c1420"); }
  siegeBtn(...SIEGE_HUD.speed, G.speed === 2 ? "X2" : "X1", G.speed === 2 ? GOLD : null);
  siegeBtn(...SIEGE_HUD.pause, "II", G.paused ? GOLD : null);
  if (G.paused && !G.menu && !G.result) { box(SIW / 2 - 40, SIH / 2 - 10, 80, 20, GOLD); text("PAUSED", SIW / 2, SIH / 2, 1, GOLD); }
  if (G.tip) { const w = Math.min(SIW - 20, textW(G.tip.s, 1) + 14); g.globalAlpha = Math.min(1, G.tip.t); box(SIW / 2 - w / 2, SIH - 26, w, 16, GOLD); text(G.tip.s, SIW / 2, SIH - 18, 1, WHITE); g.globalAlpha = 1; }
}
function heart(x, y) { for (const [a, b] of [[1, 0], [2, 0], [5, 0], [6, 0]]) rect("#f04650", x + a, y + b, 1, 1); rect("#f04650", x, y + 1, 8, 2); rect("#f04650", x + 1, y + 3, 6, 1); rect("#f04650", x + 2, y + 4, 4, 1); rect("#f04650", x + 3, y + 5, 2, 1); }
function shellIcon(x, y) { ell(INK, x - 1, y - 1, 10, 9); ell("#fac8aa", x, y, 8, 7); rect("#c88c78", x + 3, y + 1, 1, 5); rect("#c88c78", x + 1, y + 2, 1, 3); rect("#c88c78", x + 5, y + 2, 1, 3); }
function drawResult() {
  const R_ = SG.result, w = 200, h = 96, x = SIW / 2 - w / 2, y = SIH / 2 - h / 2;
  g.globalAlpha = 0.6; rect("#060a1e", 0, 0, SIW, SIH); g.globalAlpha = 1;
  box(x, y, w, h, R_.won ? GOLD : RED);
  text(R_.won ? "ZONE HELD!" : "THE BUOY FELL", SIW / 2, y + 14, 2, R_.won ? GOLD : RED);
  if (R_.won) for (let i = 0; i < 3; i++) bigStar(SIW / 2 - 24 + i * 24, y + 40, i < R_.stars);
  else text("THE FLIPSIDE GOT THROUGH", SIW / 2, y + 40, 1, "#ffc8c8");
  text("WAVES " + Math.max(0, SG.wave + 1) + "/" + SG.waves.length + "  HULL " + SG.hull + "/20", SIW / 2, y + 58, 1, "#c8e6ff");
  siegeBtn(x + 16, y + h - 24, 76, 16, "RETRY", null);
  siegeBtn(x + w - 92, y + h - 24, 76, 16, SG.test ? "QUIT" : "CONTINUE", GOLD);
}
function bigStar(cx, cy, on) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  poly(INK, pts.map(([a, b]) => [cx + (a - cx) * 1.25, cy + (b - cy) * 1.25])); poly(on ? GOLD : "#3c465a", pts);
}
function drawSiegeMenu() {
  const w = 160, h = 82, x = SIW / 2 - w / 2, y = SIH / 2 - h / 2;
  g.globalAlpha = 0.55; rect("#060a1e", 0, 0, SIW, SIH); g.globalAlpha = 1;
  box(x, y, w, h, "#78bee6"); text("PAUSED", SIW / 2, y + 11, 1, GOLD);
  ["RESUME", "RESTART MAP", "LEAVE THE SIEGE"].forEach((lab, i) => siegeBtn(x + 16, y + 22 + i * 19, w - 32, 15, lab, i === 2 ? RED : null));
}

// ---------------------------------------------------------------------------------------------------- input
function siegePos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SIW, (e.clientY - r.top) / r.height * SIH]; }
const hitR = (x, y, [a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h;
function siegeClick(x, y) {
  const G = SG; if (!G) return;
  if (G.result) {
    const w = 200, h = 96, bx = SIW / 2 - w / 2, by = SIH / 2 - h / 2;
    if (hitR(x, y, [bx + 16, by + h - 24, 76, 16])) { const t = G.test; startSiege(G.id, { test: t }); }
    else if (hitR(x, y, [bx + w - 92, by + h - 24, 76, 16])) siegeLeave();
    return;
  }
  if (G.menu) {
    const w = 160, h = 82, bx = SIW / 2 - w / 2, by = SIH / 2 - h / 2;
    const i = [0, 1, 2].find(k => hitR(x, y, [bx + 16, by + 22 + k * 19, w - 32, 15]));
    if (i === 0) { G.menu = false; G.paused = false; } else if (i === 1) startSiege(G.id, { test: G.test }); else if (i === 2) siegeLeave(); else { G.menu = false; G.paused = false; }
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
  const pi = G.M.pads.findIndex(([px, py], i) => Math.hypot(x - px, (y - py) * 1.6) < 14 || (G.towers[i] && x > px - 10 && x < px + 10 && y > py - 30 && y < py + 4));
  if (pi >= 0) { G.ring = pi; play("tick"); }
}
function siegeTouch(e) { const [x, y] = siegePos(e); SG.hover = [x, y]; siegeClick(x, y); }
function siegeMove(e) { if (SG) SG.hover = siegePos(e); }
function siegeKey(e, down) {
  if (!SG || !down) return;
  const c = e.code, G = SG;
  if (c === "Escape") { e.preventDefault(); if (G.result) return; if (G.ring !== null) { G.ring = null; return; } G.menu = !G.menu; G.paused = G.menu; play("tick"); return; }
  if (G.result || G.menu) { if (c === "Space" || c === "Enter") { e.preventDefault(); if (G.result) { if (c === "Enter") siegeLeave(); else startSiege(G.id, { test: G.test }); } else { G.menu = false; G.paused = false; } } return; }
  if (c === "Space") { e.preventDefault(); G.paused = !G.paused; return; }
  if (c === "KeyN") { callWave(); return; }
  if (c === "Tab") { e.preventDefault(); G.speed = G.speed === 2 ? 1 : 2; play("tick"); return; }
  if (/^Digit[1-9]$/.test(c) && G.ring !== null) { const btns = ringFor(G.ring).filter(b => b[2] !== "sell"), b = btns[+c.slice(5) - 1]; if (b) ringAct(b); return; }
  if (c === "KeyX" && G.ring !== null && G.towers[G.ring]) { ringAct(ringFor(G.ring).find(b => b[2] === "sell")); return; }
}
function siegeUpdate(dt) {
  if (!SG) return;
  S.shake = Math.max(0, (S.shake || 0) - dt);
  if (SG.result) { SG.result.t += dt; return; }
  if (SG.paused) return;
  let left = dt * SG.speed;
  while (left > 0 && SG && !SG.result) { const h = Math.min(left, 1 / 60); siegeStep(h); left -= h; }
}
window.SIEGE = { get SG() { return SG; }, set SG(v) { SG = v; }, startSiege, siegeStep, callWave, ringFor, ringAct, siegeClick, siegeKey, SMAPS, TW, ETYPES, buildWaves, mapRoutes, siegeSave, towerStats, inRange, atS, polyline, catmull, onRoad, inPool, hpScale, Z_ROSTER, E_COST, SZ };
if (TEST_SIEGE) { const w = setInterval(() => { if (S && atlas && atlas.complete) { clearInterval(w); startSiege(SMAPS[TEST_SIEGE] ? TEST_SIEGE : "0.0", { test: true }); } }, 50); }
