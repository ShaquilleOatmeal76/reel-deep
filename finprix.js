// FIN PRIX: a Mario Kart 64 style race for your derby fish.
// Loaded after game.js and derby.js; uses their globals (g, rect, text, LW, LH, T, S, store, tav, SPEC, play, RNG...).
// Pseudo-3D road (the SNES / arcade trick): a track is a list of short segments, each with a curve, a height and a road
// width; every frame they're projected from a camera behind your kart and drawn back to front as trapezoids, then the
// racers, item boxes, boost pads and scenery are drawn as scaled sprites. Everything is drawn in code: no new art files.
// History: prototype Nov 17, 2026; drifting tried and dropped Nov 18 (Kade: "useless"); now racing lines, braking,
// boost pads and items decide it. Reached only by the test link ?finprix until the career (THE PIT) is built.
"use strict";
const FP = {
  SEG: 200, ROAD: 1300, CAM_H: 900, DEPTH: 0.84, DRAW: 160, RACERS: 8,
  MAX: 8500, ACCEL: 3800, BRAKE: -11000, DECEL: -2600, OFF_DECEL: -7000, OFF_MAX: 0.45,
  CENTRIFUGAL: 0.32, STEER: 3.0, SCRUB: 0.05, PAD: 0.7,
};
const TEST_FP = (() => { try { return new URLSearchParams(location.search).has("finprix"); } catch (e) { return false; } })();
let KART = null;
const FP_TUNE = { skill: 1.005, spread: 0.02, lead: 0.035 };   // AI difficulty; tuned with tools/tests/test_finprix.py
// The other seven racers, each with a way of driving. top: top speed; corner: speed kept through a sharp bend; line: how
// far onto the inside line they go; noise: how much they wander; lift: how late they brake for a bend (higher = later).
const FP_CREW = [
  { name: "ZIPPY", id: "marlin", style: "SPEEDSTER", top: 1.03, corner: 0.95, line: 0.4, noise: 0.06, lift: 0.85, alt: "sword" },
  { name: "APEX", id: "parrot", style: "CORNER KING", top: 0.985, corner: 1, line: 1.3, noise: 0.03, lift: 1.05, alt: "bass" },
  { name: "BRUISER", id: "shark", style: "BULLY", top: 1.005, corner: 0.95, line: 0.9, noise: 0.05, lift: 0.9, aggro: 1, alt: "grouper" },
  { name: "TRICKY", id: "octo", style: "TRICKSTER", top: 1.0, corner: 0.95, line: 0.9, noise: 0.05, lift: 0.9, trick: 1, alt: "puffer" },
  { name: "STEADY", id: "turtle", style: "STEADY", top: 0.985, corner: 0.98, line: 1, noise: 0, lift: 0.95, alt: "trout" },
  { name: "WILDFIN", id: "ember", style: "WILDCARD", top: 1.025, corner: 0.95, line: 0.8, noise: 0.2, lift: 0.9, wild: 1, alt: "perch" },
  { name: "WALL", id: "ray", style: "BLOCKER", top: 1.0, corner: 0.95, line: 0.9, noise: 0.04, lift: 0.9, block: 1, alt: "tuna" },
];

// ---- tracks: colours, scenery, and pieces [ease in, hold, ease out, curve, hill, options]
// Piece lengths are in quarter-units (x2.5 when built). Options: b: a row of item boxes; p: boost pad xs; w: road width
// (1 = normal; x beyond the width is off the road); h: hazards {t: "post" (k: what it is) | "jelly" | "geyser", n: how many};
// c: [x0, x1] a current lane (faster inside it); arch: ribcage arches over the road.
// Track options: bg (what's on the horizon), dark (0-1: how dark it is past your lights), jelly (jellyfish colour).
const FP_CUPS = [
  { id: "minnow", name: "MINNOW CUP", tracks: ["kelp", "coral", "sandbar"] },
  { id: "reef", name: "REEF CUP", tracks: ["wreck", "crystal", "city"] },
  { id: "deep", name: "DEEP CUP", tracks: ["vents", "bones", "whale"] },
  { id: "abyss", name: "ABYSS CUP", tracks: ["trench", "lantern", "flip"], secret: true },
];
const FP_ORDER = FP_CUPS.flatMap(c => c.tracks);
const FP_TRACKS = {
  kelp: {
    name: "KELP CIRCUIT", laps: 3, bg: "rocks",
    pal: { top: [60, 140, 200], water: [12, 40, 86], fog: [26, 70, 120], road: ["#c8b480", "#bca874"], off: ["#1e5a50", "#1a5048"], rumble: ["#f05050", "#fafaff"], lane: "#e6dcb4", hills: ["#163c5e", "#1c4870"], rays: 0.12 },
    deco: [["kelp", 5, 1.3, 2.4], ["rock", 11, 1.25, 2], ["coral", 17, 1.2, 1.8]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, -9, 5], [6, 12, 6, 0, 0, { p: [0.4] }], [6, 6, 6, 7, 0, { w: 0.85 }], [6, 6, 6, -7, 0, { w: 0.85 }],
      [10, 40, 10, 0, 15, { b: 1, p: [-0.5, 0.5] }], [15, 25, 15, 5, -15], [6, 8, 6, -10, 0], [8, 20, 8, 0, 10, { b: 1 }], [6, 6, 6, 8, -5], [6, 6, 6, -8, -5],
      [10, 25, 10, 3, 0, { p: [0] }], [8, 30, 8, 0, 0],
    ],
  },
  coral: {
    name: "CORAL GARDEN", laps: 3, bg: "rocks",
    pal: { top: [90, 190, 220], water: [20, 80, 130], fog: [60, 140, 170], road: ["#f0dcb4", "#e6d0a6"], off: ["#2a8c8c", "#26807e"], rumble: ["#ff6eaa", "#fff0a0"], lane: "#fff6dc", hills: ["#2a6e96", "#3480a8"], rays: 0.18 },
    deco: [["coral", 4, 1.25, 2.2], ["fan", 7, 1.3, 2.4], ["anemone", 9, 1.2, 1.9], ["star", 6, 1.15, 1.6]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [10, 15, 10, 6, 0], [8, 25, 8, 0, 5, { h: { t: "jelly", n: 3 }, p: [0] }], [8, 10, 8, -8, 0], [8, 10, 8, 8, -5, { w: 0.9 }],
      [10, 35, 10, 0, 0, { b: 1, w: 1.2, h: { t: "jelly", n: 4 } }], [12, 20, 12, -5, 10], [6, 8, 6, 9, 0], [8, 25, 8, 0, -10, { p: [-0.5, 0.5] }],
      [10, 15, 10, -6, 0, { b: 1 }], [8, 30, 8, 0, 0],
    ],
  },
  sandbar: {
    name: "SANDBAR SPRINT", laps: 3, bg: "rocks",
    pal: { top: [120, 200, 230], water: [40, 110, 160], fog: [110, 170, 190], road: ["#e8d8a0", "#dccc94"], off: ["#d2be8c", "#c8b482"], rumble: ["#3caaff", "#fafaff"], lane: "#fffbe6", hills: ["#5a96b4", "#6aa6c2"], rays: 0.22 },
    deco: [["dune", 9, 1.6, 3], ["star", 5, 1.2, 2], ["shell", 7, 1.2, 1.8], ["kelp", 23, 1.6, 2.6]],
    pieces: [
      [10, 40, 10, 0, 0, { b: 1, w: 1.25 }], [15, 20, 15, 4, 20, { w: 1.25 }], [10, 40, 10, 0, -20, { p: [-0.4, 0.4], w: 1.25 }], [10, 15, 10, -7, 0],
      [10, 50, 10, 0, 25, { b: 1, p: [0], w: 1.25 }], [15, 20, 15, -4, -25, { w: 1.25 }], [8, 10, 8, 8, 0], [10, 40, 10, 0, 0, { p: [-0.5, 0.5], w: 1.2 }],
      [12, 15, 12, 5, 0, { b: 1 }], [10, 30, 10, 0, 0, { w: 1.25 }],
    ],
  },
  wreck: {
    name: "WRECK RUN", laps: 3, bg: "wreck",
    pal: { top: [40, 100, 130], water: [10, 32, 56], fog: [24, 56, 76], road: ["#9c8c6e", "#928264"], off: ["#24443c", "#203c36"], rumble: ["#b4643c", "#d2c8aa"], lane: "#c8b896", hills: ["#14303e", "#1a3a4a"], rays: 0.08 },
    deco: [["mast", 13, 1.4, 2.6], ["hull", 19, 1.6, 2.6], ["anchor", 11, 1.2, 1.8], ["rock", 7, 1.25, 2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, -8, 0], [8, 25, 8, 0, 0, { h: { t: "post", k: "barrel", n: 4 }, p: [0] }], [6, 6, 6, 9, 0, { w: 0.8 }], [6, 6, 6, -9, 0, { w: 0.8 }],
      [10, 30, 10, 0, 10, { b: 1 }], [10, 15, 10, 6, -10], [8, 30, 8, 0, 0, { h: { t: "post", k: "barrel", n: 5 }, w: 1.1 }], [6, 10, 6, -10, 0],
      [8, 20, 8, 0, 0, { p: [-0.5, 0.5] }], [10, 12, 10, 7, 0, { b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  crystal: {
    name: "CRYSTAL CAVES", laps: 3, bg: "cave", dark: 0.35,
    pal: { top: [30, 24, 60], water: [16, 12, 40], fog: [40, 30, 80], road: ["#7a6e9c", "#706492"], off: ["#2a2050", "#261c48"], rumble: ["#5ae6ff", "#c87aff"], lane: "#c8beff", hills: ["#1c1440", "#24184c"], rays: 0 },
    deco: [["crystal", 5, 1.25, 2.2], ["stalag", 9, 1.3, 2.2], ["rock", 13, 1.25, 2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1, w: 0.9 }], [8, 12, 8, 7, 0], [6, 8, 6, -9, -5, { w: 0.8 }], [8, 25, 8, 0, -10, { h: { t: "post", k: "stalag", n: 4 }, p: [0] }], [10, 15, 10, -6, 0],
      [6, 6, 6, 9, 5], [6, 6, 6, -9, 5], [10, 30, 10, 0, 10, { b: 1, w: 1.1, p: [-0.5, 0.5] }], [8, 12, 8, 8, 0, { w: 0.85 }], [8, 20, 8, 0, 0, { h: { t: "post", k: "stalag", n: 3 } }],
      [10, 12, 10, -7, -5, { b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  city: {
    name: "SUNKEN CITY", laps: 3, bg: "city",
    pal: { top: [50, 120, 150], water: [14, 44, 70], fog: [40, 86, 110], road: ["#b4aa96", "#aaa08c"], off: ["#3c5a5a", "#365252"], rumble: ["#e6be50", "#f0ebdc"], lane: "#ebe1c8", hills: ["#1e3c50", "#28485c"], rays: 0.14 },
    deco: [["pillar", 6, 1.3, 2], ["ruin", 15, 1.6, 2.6], ["kelp", 11, 1.3, 2.2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, -7, 0], [10, 35, 10, 0, 0, { w: 1.4, h: { t: "post", k: "pillar", n: 6 }, p: [0] }], [6, 8, 6, 9, 0], [8, 15, 8, -5, 10],
      [6, 6, 6, 8, 0, { w: 0.85 }], [6, 6, 6, -8, 0, { w: 0.85 }], [10, 30, 10, 0, -10, { b: 1, p: [-0.5, 0.5] }], [8, 10, 8, -9, 0],
      [10, 25, 10, 0, 0, { w: 1.3, h: { t: "post", k: "pillar", n: 4 } }], [10, 15, 10, 6, 0, { b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  vents: {
    name: "VENT FIELDS", laps: 3, bg: "vents", dark: 0.2,
    pal: { top: [60, 30, 30], water: [24, 12, 16], fog: [70, 34, 28], road: ["#5a5054", "#50484c"], off: ["#2a2024", "#261c20"], rumble: ["#ff7828", "#ffd25a"], lane: "#a09096", hills: ["#2c1416", "#381a1a"], rays: 0.04 },
    deco: [["vent", 7, 1.3, 2.4], ["tube", 5, 1.15, 1.8], ["rock", 11, 1.3, 2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, 8, 0], [8, 30, 8, 0, 5, { h: { t: "geyser", n: 4 }, p: [0] }], [6, 8, 6, -10, 0], [6, 6, 6, 8, -5, { w: 0.85 }],
      [10, 30, 10, 0, 0, { b: 1, h: { t: "geyser", n: 5 } }], [12, 20, 12, -6, 10], [6, 8, 6, 10, 0], [8, 25, 8, 0, -10, { p: [-0.5, 0.5], h: { t: "geyser", n: 3 } }],
      [10, 12, 10, -7, 0, { b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  bones: {
    name: "BONE YARD", laps: 3, bg: "rocks", dark: 0.2,
    pal: { top: [40, 60, 70], water: [14, 22, 28], fog: [44, 58, 60], road: ["#8c8a78", "#82806e"], off: ["#2e3830", "#2a332c"], rumble: ["#e6e1c8", "#5a6450"], lane: "#d2cdb4", hills: ["#1c2628", "#243032"], rays: 0.05 },
    deco: [["bone", 6, 1.3, 2.2], ["skull", 17, 1.4, 2.2], ["rock", 9, 1.25, 2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 25, 8, 0, 0, { arch: 1, w: 0.8 }], [8, 10, 8, -9, 0], [8, 15, 8, 6, 0, { arch: 1, w: 0.85 }], [6, 6, 6, -8, 5],
      [10, 30, 10, 0, 10, { b: 1, p: [0], h: { t: "post", k: "skull", n: 3 } }], [10, 15, 10, 7, -10, { arch: 1, w: 0.8 }], [6, 8, 6, -10, 0], [8, 25, 8, 0, 0, { p: [-0.5, 0.5] }],
      [8, 20, 8, 5, 0, { arch: 1, w: 0.8, b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  whale: {
    name: "WHALE HIGHWAY", laps: 3, bg: "whales",
    pal: { top: [30, 80, 150], water: [8, 22, 60], fog: [20, 50, 100], road: ["#4e5c78", "#485672"], off: ["#14284a", "#122444"], rumble: ["#78dcff", "#fafaff"], lane: "#c8dcff", hills: ["#0e2048", "#142a56"], rays: 0.1 },
    deco: [["buoy", 6, 1.25, 1.4], ["rock", 13, 1.5, 2.6], ["kelp", 19, 1.5, 2.6]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [10, 40, 10, 3, 0, { c: [-0.3, 0.1] }], [8, 10, 8, -8, 0], [10, 40, 10, 0, 10, { c: [0.1, 0.5], b: 1, h: { t: "jelly", n: 3 } }],
      [12, 25, 12, -4, -10, { c: [-0.5, -0.1] }], [6, 8, 6, 9, 0], [10, 35, 10, 0, 0, { p: [-0.5, 0.5] }], [10, 40, 10, 5, 0, { c: [-0.2, 0.2], b: 1 }],
      [6, 8, 6, -9, 0], [8, 25, 8, 0, 0],
    ],
  },
  trench: {
    name: "THE TRENCH", laps: 3, bg: "cliffs", dark: 0.45,
    pal: { top: [16, 30, 60], water: [4, 8, 20], fog: [12, 22, 44], road: ["#4c5464", "#444c5c"], off: ["#141c2c", "#121828"], rumble: ["#3c78c8", "#b4c8e6"], lane: "#8c96aa", hills: ["#0a1020", "#0e1428"], rays: 0.03 },
    deco: [["cliff", 4, 1.3, 1.7], ["rock", 7, 1.2, 1.5]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1, w: 0.9 }], [8, 20, 8, 0, -30, { w: 0.75 }], [8, 10, 8, -9, 0, { w: 0.8 }], [8, 20, 8, 0, 30, { w: 0.75, h: { t: "post", k: "rock", n: 3 } }],
      [6, 8, 6, 10, 0], [6, 6, 6, -9, -15, { w: 0.8 }], [10, 30, 10, 0, -15, { b: 1, p: [0] }], [8, 10, 8, 8, 0, { w: 0.75 }],
      [8, 25, 8, 0, 20, { h: { t: "post", k: "rock", n: 4 } }], [6, 8, 6, -10, 0], [8, 20, 8, 0, 10, { b: 1, p: [-0.4, 0.4] }], [8, 25, 8, 0, 0],
    ],
  },
  lantern: {
    name: "LANTERN DARK", laps: 3, bg: "none", dark: 0.9, jelly: "#78ffdc",
    pal: { top: [6, 8, 18], water: [2, 3, 8], fog: [4, 6, 14], road: ["#3a3e4c", "#343844"], off: ["#0c0e16", "#0a0c14"], rumble: ["#ffc850", "#2a2c34"], lane: "#787c8c", hills: ["#06080e", "#080a12"], rays: 0 },
    deco: [["lantern", 8, 1.25, 1.3], ["rock", 11, 1.4, 2]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, 7, 0], [8, 25, 8, 0, 0, { h: { t: "jelly", n: 3 }, p: [0] }], [6, 8, 6, -9, 0], [6, 6, 6, 9, 0, { w: 0.85 }],
      [10, 30, 10, 0, 10, { b: 1 }], [10, 15, 10, -6, -10], [8, 25, 8, 0, 0, { h: { t: "post", k: "rock", n: 3 }, p: [-0.5, 0.5] }], [6, 8, 6, 10, 0],
      [10, 15, 10, -5, 0, { b: 1 }], [8, 25, 8, 0, 0],
    ],
  },
  flip: {
    name: "THE FLIPSIDE", laps: 3, bg: "flesh", dark: 0.5, jelly: "#e05a78",
    pal: { top: [90, 20, 40], water: [30, 6, 18], fog: [70, 16, 34], road: ["#6e3c5a", "#643452"], off: ["#3c1020", "#360e1c"], rumble: ["#ff8cb4", "#2a0a14"], lane: "#c88caa", hills: ["#4a0e22", "#5a1428"], rays: 0.05 },
    deco: [["flesh", 6, 1.3, 2.2], ["tooth", 9, 1.25, 2], ["bone", 15, 1.4, 2.4]],
    pieces: [
      [10, 30, 10, 0, 0, { b: 1 }], [8, 10, 8, -9, 0], [8, 25, 8, 0, 10, { h: { t: "jelly", n: 4 } }], [6, 6, 6, 9, 0, { w: 0.8 }], [6, 6, 6, -9, 0, { w: 0.8 }],
      [10, 30, 10, 0, -10, { b: 1, p: [0], h: { t: "post", k: "tooth", n: 4 } }], [8, 10, 8, 10, 0], [10, 20, 10, 0, 0, { h: { t: "geyser", n: 3 } }], [6, 8, 6, -10, 0],
      [8, 20, 8, 0, 0, { b: 1, p: [-0.5, 0.5] }], [10, 12, 10, 8, 0], [8, 25, 8, 0, 0],
    ],
  },
};
function fpTrack(key) {
  const def = FP_TRACKS[key] || FP_TRACKS.kelp, segs = [], rng = RNG(77 + FP_ORDER.indexOf(key) * 101);
  const ease = u => u * u, easeIO = u => -Math.cos(u * Math.PI) / 2 + 0.5;
  for (const [e0, h0, l0, curve, hill, opt] of def.pieces) {
    const enter = Math.round(e0 * 2.5), hold = Math.round(h0 * 2.5), leave = Math.round(l0 * 2.5), n = enter + hold + leave, o = opt || {};
    const y0 = segs.length ? segs[segs.length - 1].p2.y : 0, y1 = y0 + (hill || 0) * FP.SEG, start = segs.length, w0 = segs.length ? segs[segs.length - 1].w : 1;
    for (let i = 0; i < n; i++) {
      const c = i < enter ? curve * ease(i / enter) : i < enter + hold ? curve : curve * (1 - ease((i - enter - hold) / leave));
      const ya = lerp(y0, y1, easeIO(i / n)), yb = lerp(y0, y1, easeIO((i + 1) / n)), k = segs.length;
      const w = lerp(w0, o.w || 1, Math.min(1, i / 10));     // the road narrows or widens smoothly
      segs.push({ i: k, curve: c, w, p1: { y: ya, z: k * FP.SEG }, p2: { y: yb, z: (k + 1) * FP.SEG }, deco: [], boxes: [], pads: [], haz: [],
        cur: o.c && i > 4 && i < n - 4 ? o.c : null, arch: o.arch && i > 6 && i < n - 6 && i % 5 === 0 });
    }
    const mid = start + Math.floor(n / 2);
    if (o.b) [-0.6, -0.2, 0.2, 0.6].forEach(x => segs[mid].boxes.push({ x, gone: 0 }));
    if (o.p) for (let q = 0; q < 4; q++) o.p.forEach(x => segs[mid - 8 + q].pads.push(x));
    if (o.h) {                                               // hazards spread through the middle of the piece
      let last = 9;
      for (let j = 0; j < o.h.n; j++) {
        let at = start + enter + Math.floor(hold * (j + 0.5) / o.h.n);
        if (Math.abs(at - mid) < 4 && (o.b || o.p)) at = mid + (o.p ? 6 : 4);
        const s = segs[at], lanes = [-0.6, -0.2, 0.2, 0.6].filter(x => x !== last);
        const x = rng.choice(lanes) * s.w; last = x / s.w;
        if (o.h.t === "post") s.haz.push({ t: "post", k: o.h.k || "rock", x });
        else if (o.h.t === "jelly") s.haz.push({ t: "jelly", x: 0, amp: 0.65 * s.w, sp: 0.9 + rng.random() * 0.6, ph: rng.random() * 7 });
        else s.haz.push({ t: "geyser", x, ph: rng.random() });
      }
    }
  }
  const total = segs[segs.length - 1].p2.y;                  // close the loop: ease the last height back to zero
  if (Math.abs(total) > 1) segs.forEach((s, k) => { s.p1.y -= total * k / segs.length; s.p2.y -= total * (k + 1) / segs.length; });
  segs.forEach((s, k) => {
    def.deco.forEach(([kind, every, lo, hi]) => { if (k % every === kind.length % every) s.deco.push([kind, rng.choice([-1, 1]) * rng.uniform(lo, hi) * Math.max(1, s.w)]); });
    if (Math.abs(s.curve) >= 6 && k % 9 === 0) s.deco.push(["sign", -Math.sign(s.curve) * 1.3 * s.w, Math.sign(s.curve)]);   // turn arrows on the outside of sharp bends
  });
  segs.map = fpMapPath(segs);
  segs.def = def; segs.key = FP_TRACKS[key] ? key : "kelp";
  return segs;
}
function fpMapPath(segs) {                   // a top-down outline of the track for the minimap: [x, y] per segment, 0..1
  // The pseudo-3D road isn't a real loop in 2D, so: scale the bends so the sharpest piece turns about 150 degrees, then
  // spread whatever turning is missing (to make one full lap of 360) evenly along the track, in the track's main direction.
  let best = 1, run = 0, prev = 0;
  for (const s of segs) { if (Math.sign(s.curve) !== Math.sign(prev) || !s.curve) run = 0; run += s.curve; best = Math.max(best, Math.abs(run)); prev = s.curve; }
  const k = Math.PI * 0.85 / best, sum = segs.reduce((a, s) => a + s.curve, 0) * k, dir = sum >= 0 ? 1 : -1, bias = (dir * Math.PI * 2 - sum) / segs.length;
  let h = 0, x = 0, y = 0; const pts = [];
  for (const s of segs) { pts.push([x, y]); h += s.curve * k + bias; x += Math.sin(h); y -= Math.cos(h); }
  const ex = x / segs.length, ey = y / segs.length;          // nudge the end back onto the start
  pts.forEach((p, i) => { p[0] -= ex * i; p[1] -= ey * i; });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), sc = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  return pts.map(p => [(p[0] - x0) / sc, (p[1] - y0) / sc]);
}

// ---- racers
const FP_NAMES = ["FINN", "BUBBLES", "GILL", "SHELLY", "CORAL", "RIPTIDE", "NEMO JR", "SCALES", "DORY 2", "BARNACLE"];
const FP_COLS = {};
function fpFishColors(id) { return FP_COLS[id] || (FP_COLS[id] = fpFishColors0(id)); }
function fpFishColors0(id) {                 // the two main colours of a fish sprite, for its rear view
  const fb = ["#ff8c32", "#fafaff"];
  try {
    const a = DATA.atlas[id], c = document.createElement("canvas"); c.width = a[2]; c.height = a[3];
    const x = c.getContext("2d"); x.drawImage(atlas, a[0], a[1], a[2], a[3], 0, 0, a[2], a[3]);
    const d = x.getImageData(0, 0, a[2], a[3]).data, n = {};
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 150) { const k = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5); n[k] = (n[k] || 0) + 1; }
    const top = Object.entries(n).sort((p, q) => q[1] - p[1]).map(([k]) => { k = +k; return "rgb(" + [(k >> 6) * 36 + 16, ((k >> 3) & 7) * 36 + 16, (k & 7) * 36 + 16] + ")"; });
    return [top[0] || fb[0], top[1] || top[0] || fb[1]];
  } catch (e) { return fb; }
}
function startKart(test, bot, track, mode) { // bot (tests only): a robot drives your fish: { noise, lag, lv }. mode: { cup } or { tt: true }
  mode = mode || {};
  const segs = fpTrack(track), len = segs.length * FP.SEG, f = tav().fish, rng = RNG((Math.random() * 4294967296) >>> 0), cup = mode.cup || null;
  const me = { name: f ? f.name : "YOU", id: f ? f.id : "clown", me: true, lv: bot ? bot.lv : f ? f.lv : [5, 5, 5], bot, look: fpData().eq, laps: [], rec: [] };
  const skill = cup ? FP_CUP_SKILL[cup.id] : FP_TUNE.skill;
  let racers = mode.tt ? [me] : [me].concat(FP_CREW.map(p => ({ id: p.id === me.id ? p.alt : p.id, name: p.name, p, skill: skill + rng.random() * FP_TUNE.spread })));
  for (let i = racers.length - 1; i > 1; i--) { const j = 1 + Math.floor(rng.random() * i); [racers[i], racers[j]] = [racers[j], racers[i]]; }   // a shuffled grid behind you
  racers.forEach((r, i) => {
    Object.assign(r, { z: (FP.RACERS - 1 - i) * -FP.SEG * 2.2 + len, x: (i % 2 ? 0.45 : -0.45), speed: 0, lap: 0, done: false, place: i + 1, item: null, roll: 0,
      spin: 0, boost: 0, dir: 0, ink: 0, zap: 0, shield: 0, cols: fpFishColors(r.id), finishT: 0, aiItemT: 2 + Math.random() * 4 });
    if (r.me) r.z = len - FP.SEG * 2.2 * 7.5;            // you start at the back, MK style
  });
  if (cup && cup.last) racers.forEach(r => { const p = cup.last.indexOf(r.name); r.z = len - FP.SEG * 2.2 * (p + 0.5); r.x = p % 2 ? 0.45 : -0.45; });   // later races: the grid is the last finishing order
  racers.forEach(r => { r.z = ((r.z % len) + len) % len; r.lap = r.z > len / 2 ? -1 : 0; });
  if (mode.tt) me.item = "shrimp";
  KART = { test: !!test, cup, tt: !!mode.tt, shrimps: mode.tt ? 3 : 0, ghost: mode.tt ? fpGhosts()[segs.key] || null : null, track: segs.key, laps: segs.def.laps, segs, len, racers, me, t: 0, phase: "count", ct: 3.6, keys: new Set(), shots: [], mines: [], flash: 0, shake: 0, msg: "", msgT: 0, touch: null, ink: 0 };
  S.state = "kart"; S.overlay = null;
}
const fpSeg = z => KART.segs[Math.floor(((z % KART.len) + KART.len) % KART.len / FP.SEG)];
const fpDist = r => r.lap * KART.len + r.z;                         // how far round the race a racer is

// ---- items: weighted by place, like the real thing (the back of the pack gets the good stuff)
const FP_ITEMS = { shrimp: ["TURBO SHRIMP", "#ff8c64"], puffer: ["PUFFERFISH", "#e6c850"], ink: ["INK CLOUD", "#3c3c5a"], urchin: ["URCHIN", "#b45adc"], zap: ["EEL ZAP", "#ffe650"], shield: ["SHELL SHIELD", "#8ce6ff"] };
function fpRollItem(place) {
  const w = place <= 2 ? { puffer: 5, urchin: 3, shield: 3, shrimp: 1, ink: 1 } : place <= 5 ? { puffer: 2, urchin: 3, shrimp: 3, ink: 2, shield: 1, zap: 1 } : { shrimp: 5, ink: 3, zap: 3, urchin: 2 };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k;
  return "shrimp";
}
function fpUseItem(r) {
  const it = r.item; if (!it || r.roll > 0) return;
  r.item = null;
  if (it === "shrimp") { r.boost = Math.max(r.boost, 1.4); if (r.me) play("pulse"); if (KART.tt && --KART.shrimps > 0) r.item = "shrimp"; }
  else if (it === "shield") { r.shield = 10; if (r.me) play("chime"); }
  else if (it === "zap") {                                   // EEL ZAP: everyone ahead of you is shocked and slowed
    KART.racers.forEach(o => { if (o !== r && fpDist(o) > fpDist(r)) { if (o.shield > 0) o.shield = 0; else { o.zap = 1.2; o.speed *= 0.7; } } });
    KART.zapFx = 0.3; play("zap"); if (KART.me.zap > 0 && !r.me) { KART.msg = "ZAPPED!"; KART.msgT = 1.2; }
  }
  else if (it === "puffer") KART.mines.push({ z: r.z - FP.SEG * 1.5, x: r.x, t: 0 });
  else if (it === "urchin") KART.shots.push({ z: r.z + FP.SEG, x: r.x, owner: r, life: 4 });
  else if (it === "ink") { KART.racers.forEach(o => { if (fpDist(o) > fpDist(r)) { o.ink = 3.5; } }); if (KART.me.ink > 0 && !r.me) { KART.msg = "INKED!"; KART.msgT = 1.5; } play("zap"); }
}
function fpSpin(r, why) {                    // hit by a mine or an urchin (a shell shield takes the hit instead)
  if (r.spin > 0 || r.boost > 1.2) return;
  if (r.shield > 0) { r.shield = 0; if (r.me) { KART.msg = "BLOCKED!"; KART.msgT = 1; play("tick"); } return; }
  r.spin = 1.1 * (r.me ? 1.15 - r.lv[1] * 0.03 : 1);            // stamina: a trained fish shakes it off quicker
  if (r.me) { KART.shake = 0.4; KART.msg = why; KART.msgT = 1.2; play("miss"); }
}

// ---- each frame
function kartKey(e, down) {
  const c = e.code;
  if (down) KART.keys.add(c); else KART.keys.delete(c);
  if (!down) return;
  if (c === "Escape") { if (KART.test) { KART = null; newDive(); } else fpExit(); return; }
  if ((KART.phase === "done" || KART.phase === "cupdone") && ["Space", "Enter"].includes(c)) { fpNext(); return; }
  if (c === "KeyH" && KART.phase === "race") { fpHorn(); return; }
  if (KART.phase === "done" && KART.test && ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(c)) {   // the test: try another track
    const i = FP_ORDER.indexOf(KART.track), d = c === "ArrowLeft" || c === "KeyA" ? -1 : 1; startKart(true, null, FP_ORDER[(i + d + FP_ORDER.length) % FP_ORDER.length]); play("tick"); return;
  }
  if ((c === "Space" || c === "KeyE" || c === "Enter") && KART.phase === "race") fpUseItem(KART.me);
}
function kartTouch(rx, ly, down) {           // touch: hold the left / right side to steer; the bottom-right corner uses your item
  if (!KART) return;
  if (KART.phase === "done" || KART.phase === "cupdone") { if (down) fpNext(); return; }
  if (down && ly > 160 && rx > LW - 44) { fpUseItem(KART.me); return; }
  KART.touch = down ? [rx, ly] : null;
}
function kartUpdate(dt) {
  const K = KART;
  K.t += dt; K.flash = Math.max(0, K.flash - dt); K.shake = Math.max(0, K.shake - dt); K.msgT -= dt; K.zapFx = Math.max(0, (K.zapFx || 0) - dt);
  if (K.phase === "count") { const was = Math.ceil(K.ct); K.ct -= dt; if (Math.ceil(K.ct) !== was && K.ct > 0) play(K.ct < 1 ? "chime" : "tick"); if (K.ct <= 0) { K.phase = "race"; play("select"); } }
  const key = c => K.keys.has(c);
  const me = K.me, lead = K.racers.slice().sort((a, b) => fpDist(b) - fpDist(a));
  lead.forEach((r, i) => { if (!r.done) r.place = i + 1; });
  for (const r of K.racers) {
    if (K.phase === "count") continue;
    const seg = fpSeg(r.z), max = FP.MAX * (r.me ? 0.97 + r.lv[0] * 0.004 : r.skill * r.p.top * fpRubber(r, me) * (r.surge > 0 ? 1.12 : 1)), spdPct = r.speed / FP.MAX;
    let steer = 0, gas = true, brake = false;                  // the AI always has its foot down; you press W / Up
    if (r.me && !r.bot && !r.done) {
      steer = heldDir("L", "R"); brake = key("ArrowDown") || key("KeyS"); gas = key("KeyW") || key("ArrowUp");
      if (K.touch) { steer = K.touch[0] < LW * 0.4 ? -1 : K.touch[0] > LW * 0.6 ? 1 : 0; gas = true; }   // touch: holding anywhere is gas
    } else steer = fpAI(r, seg, dt);
    r.dir = lerp(r.dir, steer, Math.min(1, dt * 10));
    r.yaw = lerp(r.yaw || 0, r.dir * 0.35, Math.min(1, dt * 8));
    r.zap = Math.max(0, r.zap - dt); r.shield = Math.max(0, r.shield - dt); r.hitT = Math.max(0, (r.hitT || 0) - dt);
    if (r.spin > 0) { r.spin -= dt; r.speed = Math.max(0, r.speed + FP.BRAKE * 0.35 * dt); continue_(r, seg, dt); continue; }
    r.x += steer * FP.STEER * dt * spdPct;
    r.x -= dt * spdPct * spdPct * seg.curve * FP.CENTRIFUGAL;   // curves push you outward
    for (const px of seg.pads) if (Math.abs(r.x - px) < 0.22) { if (r.boost < FP.PAD * 0.5 && r.me) play("pulse"); r.boost = Math.max(r.boost, FP.PAD); }   // boost pads
    fpHazards(r);
    const inCur = seg.cur && r.x > seg.cur[0] && r.x < seg.cur[1];
    const off = Math.abs(r.x) > seg.w, boostK = r.me ? 1.25 + r.lv[2] * 0.02 : 1.35;   // burst: how hard a boost kicks
    const top = (off ? max * FP.OFF_MAX : max) * (r.boost > 0 ? boostK : 1) * (r.ink > 0 && !r.me ? 0.88 : 1) * (r.zap > 0 ? 0.6 : 1) * (inCur ? 1.15 : 1) * (r.p && Math.abs(seg.curve) > 3 ? r.p.corner : 1);
    let cap = top;
    if (!r.me || r.bot) {                                     // the AI lifts for a bend it can't hold flat out (APEX later, ZIPPY earlier)
      const bend = Math.max(Math.abs(seg.curve), Math.abs(fpSeg(r.z + FP.SEG * 5).curve)), need = bend * FP.CENTRIFUGAL / FP.STEER, lift = r.p ? r.p.lift : 0.9;
      if (need > lift) cap = Math.min(cap, FP.MAX * lift / need);
    }
    if (brake) r.speed += FP.BRAKE * dt;
    else if (r.speed > cap) r.speed += (off ? FP.OFF_DECEL : FP.DECEL * 1.5) * dt;
    else if (gas) r.speed += FP.ACCEL * (0.85 + (r.me ? r.lv[1] : 6) * 0.03) * dt * (1 - r.speed / (cap * 1.05));
    else r.speed += FP.DECEL * dt;                              // off the gas: coast
    if (spdPct > 0.7) r.speed -= Math.abs(steer) * Math.abs(seg.curve) * FP.MAX * FP.SCRUB * 0.1 * dt;   // a little speed lost turning hard
    if (r.boost > 0) { r.boost -= dt; r.speed = Math.max(r.speed, top * 0.98); }
    r.speed = clamp(r.speed, 0, FP.MAX * 1.6); r.x = clamp(r.x, -2.2, 2.2);
    continue_(r, seg, dt);
  }
  if (K.phase !== "count") fpObjects(dt);
  if (K.phase === "race" && me.done) { K.phase = "done"; K.doneT = K.t; play(me.place === 1 ? "fanfare" : "chime"); fpRaceOver(); }
}
function continue_(r, seg, dt) {             // move along, count laps, item boxes, bumps
  const K = KART, z0 = r.z;
  r.z += r.speed * dt; r.ink = Math.max(0, r.ink - dt); r.surge = Math.max(0, (r.surge || 0) - dt);
  if (r.me) KART.bumpT = Math.max(0, (KART.bumpT || 0) - dt);
  if (r.roll > 0) { r.roll -= dt; if (r.roll <= 0) r.item = r.rolling; }
  if (r.me) {                                 // lap times, and a ghost of this lap (sampled every 0.05 s)
    if (r.lapStart !== undefined) { const i = Math.floor((K.t - r.lapStart) / 0.05); while (r.rec.length <= i) r.rec.push([Math.round(r.z), Math.round(r.x * 100)]); }
    if (r.z >= K.len) { if (r.lapStart !== undefined) fpLapDone(r, K.t - r.lapStart); r.lapStart = K.t; r.rec = []; }
  }
  if (r.z >= K.len) { r.z -= K.len; r.lap++; if (r.lap >= K.laps && !r.done) { r.done = true; r.finishT = K.t; if (r.me) { K.msg = "FINISH!"; K.msgT = 3; } } else if (r.me && r.lap === K.laps - 1) { K.msg = "FINAL LAP!"; K.msgT = 2; play("chime"); } }
  const s = fpSeg(r.z);
  if (s !== fpSeg(z0) || true) for (const b of s.boxes) if (!K.tt && !b.gone && Math.abs(b.x - r.x) < 0.22 && !r.item && !(r.roll > 0)) {
    b.gone = 3; r.roll = r.me ? 1.2 : 0.4; r.rolling = fpRollItem(r.place); if (r.me) play("chime");
  }
  for (const o of K.racers) if (o !== r && Math.abs(fpDist(o) - fpDist(r)) < FP.SEG * 0.6 && Math.abs(o.x - r.x) < 0.28) {   // bump
    const hard = (r.p && r.p.aggro) || (o.p && o.p.aggro) ? 2.6 : 1, push = (r.x < o.x ? -1 : 1) * 0.6 * dt * 8 * hard;
    r.x += push * 0.5 * (r.p && r.p.aggro ? 0.3 : 1); o.x -= push * 0.5 * (o.p && o.p.aggro ? 0.3 : 1);
    if (hard > 1 && (r.me || o.me) && !KART.bumpT) { KART.shake = 0.25; KART.bumpT = 0.6; play("hit"); }
  }
}
const fpHazX = (h, t) => h.t === "jelly" ? h.x + Math.sin(t * h.sp + h.ph) * h.amp : h.x;
const fpGeyser = (h, t) => (t / 2.4 + h.ph) % 1;             // 0.5-0.7: bubbling (a warning); over 0.7: erupting
function fpHazards(r) {                      // posts slow you right down; jellyfish and geysers spin you out
  const K = KART; if (r.hitT > 0) return;
  for (const s of [fpSeg(r.z), fpSeg(r.z - FP.SEG)]) for (const h of s.haz) {
    const dx = Math.abs(r.x - fpHazX(h, K.t));
    if (h.t === "post" && dx < 0.2) { r.speed *= 0.4; r.x += (r.x < h.x ? -1 : 1) * 0.12; r.hitT = 0.6; if (r.me) { K.shake = 0.3; K.msg = "BONK!"; K.msgT = 0.8; play("hit"); } return; }
    if (h.t === "jelly" && dx < 0.22) { r.hitT = 0.8; fpSpin(r, "JELLYFISH!"); return; }
    if (h.t === "geyser" && dx < 0.26 && fpGeyser(h, K.t) > 0.7) { r.hitT = 0.8; fpSpin(r, "GEYSER!"); return; }
  }
}
function fpRubber(r, me) {                   // the AI's rubber band: harder when you lead, a little help when far behind
  const gap = (fpDist(me) - fpDist(r)) / KART.len;
  let k = 1;
  if (gap > 0) k += Math.min(0.07, gap * 0.35);              // behind you: catch up
  else k -= Math.min(0.05, -gap * 0.2);                        // ahead: ease off a touch
  if (me.place === 1) k += FP_TUNE.lead;                       // you're leading: everyone pushes
  return k;
}
function fpAI(r, seg, dt) {                  // -> steer: drive the way this racer drives
  const K = KART, p = r.p || { line: 1, noise: r.bot ? r.bot.noise : 0.12 }, ahead = fpSeg(r.z + FP.SEG * 12), me = K.me;
  const noise = r.bot ? r.bot.noise : p.noise, wob = p.wild ? Math.sin(K.t * 1.7 + r.z * 0.0007) * Math.sin(K.t * 0.53) : Math.sin(K.t * 0.7 + (r.skill || 1) * 40);
  const lim = 0.65 * Math.min(seg.w, ahead.w);
  let target = clamp(ahead.curve * 0.12 * (p.line || 1), -lim, lim) + wob * noise;   // the inside of the coming bend
  const near = o => fpDist(o) - fpDist(r);                    // + ahead of me, - behind me
  if (p.aggro && Math.abs(near(me)) < FP.SEG * 3 && !me.done) target = me.x;                       // BRUISER: go for you
  if (p.block) { const chaser = K.racers.find(o => o !== r && near(o) < 0 && near(o) > -FP.SEG * 4); if (chaser) target = lerp(target, chaser.x, 0.8); }   // WALL: sit in their line
  if (p.trick && !r.item) for (const b of fpSeg(r.z + FP.SEG * 10).boxes) if (!b.gone) { target = b.x; break; }                                  // TRICKY: always grabs a box
  for (const m of K.mines) { const dz = m.z - r.z; if (dz > 0 && dz < FP.SEG * 8 && Math.abs(m.x - target) < 0.35 && !p.wild) target += m.x > target ? -0.45 : 0.45; }
  if (!p.trick && !r.item) for (const b of fpSeg(r.z + FP.SEG * 6).boxes) if (!b.gone && Math.abs(b.x - target) < 0.4) target = lerp(target, b.x, 0.5);
  for (const px of fpSeg(r.z + FP.SEG * 6).pads) if (Math.abs(px - target) < 0.45) target = lerp(target, px, 0.7);                               // aim for boost pads
  const cur = fpSeg(r.z + FP.SEG * 6).cur; if (cur && !p.aggro) target = lerp(target, (cur[0] + cur[1]) / 2, 0.6);                              // ride the current
  for (let d = 1; d <= 10; d++) for (const h of fpSeg(r.z + FP.SEG * d).haz) {                                                              // steer round hazards
    const hx = fpHazX(h, K.t + d * FP.SEG / Math.max(2000, r.speed)), gap = h.t === "jelly" ? 0.42 : 0.36;
    if (Math.abs(hx - target) < gap) target = hx + gap * (hx > 0.5 * seg.w ? -1 : hx < -0.5 * seg.w ? 1 : target < hx ? -1 : 1);
  }
  target = clamp(target, -0.85 * seg.w, 0.85 * seg.w);
  if (p.wild) { r.wildT = (r.wildT || 3) - dt; if (r.wildT <= 0) { r.wildT = 3 + Math.random() * 5; if (Math.random() < 0.4) r.surge = 1.2; else if (Math.random() < 0.3) r.swerve = 0.8 * (Math.random() < 0.5 ? -1 : 1); } }   // WILDFIN: bursts and blunders
  if (r.swerve) { target += r.swerve; r.swerve *= Math.pow(0.2, dt); if (Math.abs(r.swerve) < 0.05) r.swerve = 0; }
  const ff = seg.curve * FP.CENTRIFUGAL * (r.speed / FP.MAX) / FP.STEER;   // lean into the curve
  let steer = clamp((target - r.x) * 6 + ff, -1, 1);
  if (r.bot && r.bot.lag) { r.lagSteer = lerp(r.lagSteer || 0, steer, Math.min(1, dt / r.bot.lag)); steer = r.lagSteer; }
  fpAIItems(r, p, dt);
  return steer;
}
function fpAIItems(r, p, dt) {               // when to use an item, by personality
  const K = KART;
  r.aiItemT -= dt;
  if (!r.item || r.aiItemT > 0) return;
  const near = o => fpDist(o) - fpDist(r), others = K.racers.filter(o => o !== r);
  const inFront = others.some(o => near(o) > 0 && near(o) < FP.SEG * 15 && Math.abs(o.x - r.x) < 0.35);
  const behind = others.some(o => near(o) < 0 && near(o) > -FP.SEG * 10), bendSoon = Math.abs(fpSeg(r.z + FP.SEG * 10).curve) > 3;
  let use;
  if (p.trick) use = r.item === "puffer" ? behind && bendSoon : r.item === "urchin" ? inFront : r.item === "ink" ? r.place > 2 : Math.abs(fpSeg(r.z).curve) < 0.5;   // TRICKY waits for the moment
  else if (r.item === "shield") use = true;
  else if (r.item === "zap") use = r.place >= 3;
  else if (p.style === "STEADY") use = r.item === "shrimp" ? Math.abs(fpSeg(r.z).curve) < 0.5 : r.item === "urchin" ? inFront : true;
  else if (p.aggro) use = r.item === "urchin" ? inFront || Math.abs(near(K.me)) < FP.SEG * 6 : true;
  else use = r.item === "shrimp" || r.item === "ink" || (r.item === "urchin" && inFront) || (r.item === "puffer" && behind);
  if (use) { fpUseItem(r); r.aiItemT = 1 + Math.random() * 2.5; } else r.aiItemT = 0.3;
}
function fpObjects(dt) {
  const K = KART;
  K.segs.forEach(s => s.boxes.forEach(b => { if (b.gone > 0) b.gone = Math.max(0, b.gone - dt); }));
  for (const sh of K.shots) {                 // urchins roll straight ahead, faster than anyone
    sh.z += FP.MAX * 1.6 * dt; sh.life -= dt;
    for (const r of K.racers) if (r !== sh.owner && Math.abs(((r.z - sh.z + K.len * 1.5) % K.len) - K.len / 2) < FP.SEG * 0.7 && Math.abs(r.x - sh.x) < 0.3) { fpSpin(r, "URCHIN!"); sh.life = 0; }
  }
  K.shots = K.shots.filter(s => s.life > 0);
  for (const m of K.mines) {
    m.t += dt;
    for (const r of K.racers) if (m.t > 0.4 && Math.abs(((r.z - m.z + K.len * 1.5) % K.len) - K.len / 2) < FP.SEG * 0.6 && Math.abs(r.x - m.x) < 0.25) { fpSpin(r, "PUFFERFISH!"); m.dead = true; }
  }
  K.mines = K.mines.filter(m => !m.dead);
}

// ---- scenery: the horizon behind each track, and the things beside (and on) the road
function fpBackdrop(bg, P, sky, t) {
  const wrap = (x, span) => ((x % span) + span) % span - 30;
  const hills = (tall) => { for (let k = 0; k < 14; k++) { const x = wrap(k * 41 - sky * 60, LW + 60), h = (10 + (k * 37) % 18) * (tall || 1); rect(P.hills[0], x, 84 - h, 30, h + 4); rect(P.hills[1], x + 4, 84 - h - 4, 18, 6); } };
  if (bg === "none") return;
  if (bg === "wreck") {
    for (let k = 0; k < 3; k++) { const x = wrap(k * 150 - sky * 35, LW + 150), y = 78 - k * 3; g.fillStyle = P.hills[1]; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 70, y - 14); g.lineTo(x + 62, y + 4); g.lineTo(x + 6, y + 4); g.fill(); rect(P.hills[1], x + 22, y - 44, 2, 32); rect(P.hills[1], x + 44, y - 36, 2, 24); rect(P.hills[1], x + 14, y - 38, 18, 1); }
    hills(0.6);
  } else if (bg === "city") {
    for (let k = 0; k < 12; k++) {
      const x = wrap(k * 37 - sky * 50, LW + 60), h = 22 + (k * 53) % 34, wd = 16 + (k % 3) * 6;
      rect(P.hills[k % 2], x, 84 - h, wd, h + 4); if (k % 3 === 0) disc(P.hills[k % 2], x + wd / 2, 84 - h, wd / 2);
      for (let q = 0; q < 4; q++) if ((k * 7 + q * 3) % 5 === 0) rect("rgba(230,190,80,0.35)", x + 3 + (q % 2) * 7, 84 - h + 6 + q * 6, 2, 3);
    }
  } else if (bg === "vents") {
    hills(1.2);
    for (let k = 0; k < 4; k++) { const x = wrap(k * 97 - sky * 55, LW + 100) + 20; rect(P.hills[1], x - 3, 60, 7, 26); for (let q = 0; q < 6; q++) { const u = (t * 0.25 + q / 6 + k * 0.3) % 1; g.globalAlpha = 0.25 * (1 - u); disc("#504046", x + Math.sin(u * 6 + k) * 4 * u * 3, 58 - u * 50, 3 + u * 9); } g.globalAlpha = 1; }
  } else if (bg === "whales") {
    for (let k = 0; k < 2; k++) {
      const x = wrap(t * (5 + k * 3) + k * 230 - sky * 25, LW + 220) - 40, y = 28 + k * 22, s = 1 - k * 0.35;
      g.fillStyle = k ? P.hills[1] : "#1a3666"; g.beginPath(); g.ellipse(x, y, 46 * s, 10 * s, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - 40 * s, y); g.lineTo(x - 62 * s, y - 9 * s + Math.sin(t * 1.5 + k) * 3); g.lineTo(x - 62 * s, y + 9 * s + Math.sin(t * 1.5 + k) * 3); g.fill();
      g.beginPath(); g.moveTo(x + 4 * s, y + 6 * s); g.lineTo(x - 8 * s, y + 16 * s); g.lineTo(x - 14 * s, y + 6 * s); g.fill();
    }
    hills(0.8);
  } else if (bg === "cave") {
    for (let k = 0; k < 18; k++) { const x = wrap(k * 27 - sky * 70, LW + 60), h = 14 + (k * 31) % 26; g.fillStyle = P.hills[k % 2]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x + 9, h); g.fill(); if (k % 4 === 1) rect(Math.floor(t * 2 + k) % 3 ? "#5ae6ff" : "#c87aff", x + 8, h - 3, 2, 2); }
    hills(1.1);
  } else if (bg === "cliffs") {
    hills(2.2);
    g.fillStyle = P.hills[0]; g.fillRect(-4, 0, LW * 0.16, 90); g.fillRect(LW * 0.86, 0, LW * 0.16, 90);
  } else if (bg === "flesh") {
    g.fillStyle = P.hills[0]; g.beginPath(); g.moveTo(-4, 90);
    for (let x = -4; x <= LW + 4; x += 4) g.lineTo(x, 74 - Math.sin((x + sky * 60) * 0.05) * 8 - Math.sin((x + sky * 60) * 0.013 + t * 0.6) * 6);
    g.lineTo(LW + 4, 90); g.fill();
    for (let k = 0; k < 6; k++) { const x = wrap(k * 70 - sky * 60, LW + 60); rect("#7a1830", x, 66 + (k % 3) * 4, 24, 1); rect("#7a1830", x + 10, 62 + (k % 3) * 4, 1, 8); }
  } else hills();
}
const FP_DECO = { kelp: [70, 600], rock: [170, 120], coral: [120, 150], fan: [160, 180], anemone: [100, 80], star: [60, 22], shell: [70, 50], dune: [420, 70],
  mast: [40, 520], hull: [320, 170], anchor: [90, 120], crystal: [80, 170], stalag: [70, 210], pillar: [70, 280], ruin: [240, 190], vent: [90, 230], tube: [60, 110],
  bone: [60, 220], skull: [120, 100], cliff: [300, 760], lantern: [30, 230], buoy: [40, 80], flesh: [70, 270], tooth: [80, 190], sign: [70, 70], barrel: [70, 80] };
function fpDeco(k, px, py, w, h, F, s, extra, glows) {   // F(rgb) fogs a colour; draws one thing standing at (px, py), w x h
  const t = KART.t, poly = (col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill(); };
  if (k === "kelp") { for (let q = 0; q < 10; q++) { const ww = w * (1 - q * 0.06), sw = Math.sin(t * 1.6 + q * 0.6 + s.i) * w * 0.5 * q / 10; rect(F(q % 2 ? [46, 150, 76] : [34, 118, 62]), px - ww / 2 + sw, py - h * (q + 1) / 10, ww, h / 10 + 1); if (q % 3 === 1 && w > 3) rect(F([60, 170, 90]), px + ww / 2 + sw, py - h * (q + 0.5) / 10, w * 0.6, Math.max(1, h / 30)); } }
  else if (k === "rock") { rect(F([70, 80, 96]), px - w / 2, py - h, w, h); rect(F([96, 108, 124]), px - w / 3, py - h * 1.2, w * 0.6, h * 0.3); }
  else if (k === "coral") { const c = F([240, 110, 140]); rect(c, px - w / 2, py - h * 0.6, w * 0.2, h * 0.6); rect(c, px - w * 0.1, py - h, w * 0.2, h); rect(c, px + w * 0.3, py - h * 0.7, w * 0.2, h * 0.7); }
  else if (k === "fan") { rect(F([150, 50, 110]), px - w * 0.03, py - h * 0.3, w * 0.06, h * 0.3); g.fillStyle = F([210, 80, 160]); g.beginPath(); g.ellipse(px, py - h * 0.35, w / 2, h * 0.6, 0, Math.PI, 0); g.fill(); if (w > 8) for (let q = 1; q < 6; q++) { const a = Math.PI + q * Math.PI / 6; rect(F([160, 50, 120]), px + Math.cos(a) * w * 0.25, py - h * 0.35 + Math.sin(a) * h * 0.3, 1, 1); } }
  else if (k === "anemone") { disc(F([200, 90, 60]), px, py - h * 0.2, w * 0.3); for (let q = 0; q < 7; q++) rect(F(q % 2 ? [255, 160, 90] : [255, 120, 150]), px - w * 0.4 + q * w * 0.13 + Math.sin(t * 2 + q + s.i) * w * 0.06, py - h, Math.max(1, w * 0.07), h * 0.8); }
  else if (k === "star") { const c = F([255, 120, 60]); rect(c, px - w / 2, py - h * 0.6, w, h * 0.4); rect(c, px - w * 0.12, py - h * 1.2, w * 0.24, h * 1.2); disc(c, px, py - h * 0.5, w * 0.18); }
  else if (k === "shell") { g.fillStyle = F([245, 225, 200]); g.beginPath(); g.ellipse(px, py, w / 2, h, 0, Math.PI, 0); g.fill(); if (w > 6) for (let q = 1; q < 5; q++) rect(F([210, 170, 140]), px - w / 2 + q * w / 5, py - h * 0.8, 1, h * 0.8); }
  else if (k === "dune") { g.fillStyle = F([225, 205, 150]); g.beginPath(); g.ellipse(px, py, w / 2, h, 0, Math.PI, 0); g.fill(); g.fillStyle = F([240, 225, 175]); g.beginPath(); g.ellipse(px - w * 0.08, py - h * 0.1, w * 0.3, h * 0.7, 0, Math.PI, 0); g.fill(); }
  else if (k === "mast") { g.save(); g.translate(px, py); g.rotate(s.i % 2 ? 0.18 : -0.12); rect(F([90, 64, 44]), -w * 0.15, -h, w * 0.3, h); rect(F([90, 64, 44]), -w * 1.4, -h * 0.8, w * 2.8, Math.max(1, w * 0.18)); g.globalAlpha = 0.8; poly(F([170, 165, 150]), [[-w * 1.2, -h * 0.78], [w * 1.2, -h * 0.78], [w * 0.7, -h * 0.4], [-w * 0.4, -h * 0.5]]); g.globalAlpha = 1; g.restore(); }
  else if (k === "hull") { poly(F([96, 70, 50]), [[px - w / 2, py - h * 0.5], [px + w / 2, py - h], [px + w * 0.4, py], [px - w * 0.45, py]]); if (w > 10) { for (let q = 1; q < 4; q++) rect(F([70, 50, 36]), px - w * 0.45, py - h * q / 4.5, w * 0.85, 1); disc(F([20, 24, 30]), px + w * 0.1, py - h * 0.45, w * 0.08); } }
  else if (k === "anchor") { const c = F([110, 116, 124]); rect(c, px - w * 0.06, py - h, w * 0.12, h); rect(c, px - w * 0.3, py - h * 0.8, w * 0.6, Math.max(1, w * 0.08)); g.strokeStyle = c; g.lineWidth = Math.max(1, w * 0.1); g.beginPath(); g.arc(px, py - h * 0.35, w * 0.4, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(px, py - h, w * 0.12, 0, 7); g.stroke(); }
  else if (k === "crystal" || k === "stalag") {
    const c1 = k === "crystal" ? F([90, 220, 255]) : F([110, 96, 150]), c2 = k === "crystal" ? F([200, 120, 255]) : F([90, 78, 126]);
    poly(c1, [[px - w * 0.2, py], [px, py - h], [px + w * 0.2, py]]); poly(c2, [[px - w / 2, py], [px - w * 0.3, py - h * 0.6], [px - w * 0.1, py]]); poly(c2, [[px + w * 0.1, py], [px + w * 0.35, py - h * 0.5], [px + w / 2, py]]);
    if (k === "crystal" && w > 3) { rect("rgba(255,255,255,0.6)", px - w * 0.05, py - h * 0.8, Math.max(1, w * 0.06), h * 0.4); glows.push([px, py - h * 0.5, w * 0.5, Math.floor(s.i / 5) % 2 ? "#5ae6ff" : "#c87aff"]); }
  }
  else if (k === "pillar") { const c = F([200, 190, 170]), top = (s.i * 7) % 3 === 0 ? 0.65 : 1; rect(c, px - w * 0.6, py - h * 0.05, w * 1.2, h * 0.05); rect(c, px - w / 2, py - h * top, w, h * top); if (top === 1) rect(c, px - w * 0.65, py - h, w * 1.3, h * 0.06); if (w > 5) for (let q = -1; q <= 1; q++) rect(F([160, 150, 130]), px + q * w * 0.25, py - h * top * 0.95, 1, h * top * 0.9); }
  else if (k === "ruin") { rect(F([170, 160, 140]), px - w / 2, py - h, w, h); g.fillStyle = F([40, 70, 80]); g.beginPath(); g.ellipse(px, py - h * 0.45, w * 0.22, h * 0.32, 0, Math.PI, 0); g.fill(); rect(F([40, 70, 80]), px - w * 0.22, py - h * 0.45, w * 0.44, h * 0.45); poly(F([40, 70, 80]), [[px + w * 0.2, py - h - 1], [px + w / 2 + 1, py - h - 1], [px + w / 2 + 1, py - h * 0.6]]); }
  else if (k === "vent") { poly(F([40, 34, 38]), [[px - w / 2, py], [px - w * 0.2, py - h], [px + w * 0.2, py - h], [px + w / 2, py]]); rect("#ff8c3c", px - w * 0.15, py - h, w * 0.3, Math.max(1, h * 0.03)); glows.push([px, py - h, w * 0.4, "#ff7828"]); for (let q = 0; q < 4; q++) { const u = (t * 0.6 + q / 4 + s.i * 0.13) % 1; g.globalAlpha = 0.5 * (1 - u); disc(F([60, 50, 56]), px + Math.sin(u * 5 + s.i) * w * 0.3, py - h - u * h * 0.8, w * (0.2 + u * 0.5)); } g.globalAlpha = 1; }
  else if (k === "tube") { for (let q = 0; q < 4; q++) { const x = px - w * 0.4 + q * w * 0.26, hh = h * (0.6 + (q % 2) * 0.4), sw = Math.sin(t * 1.5 + q + s.i) * w * 0.05; rect(F([235, 230, 220]), x + sw, py - hh, Math.max(1, w * 0.12), hh); rect(F([230, 40, 50]), x + sw - w * 0.03, py - hh - h * 0.1, Math.max(1, w * 0.18), h * 0.12); } }
  else if (k === "bone") { const c = F([225, 220, 196]); poly(c, [[px - w * 0.3, py], [px + w * 0.15 * (s.i % 2 ? 1 : -1), py - h], [px + w * 0.3, py]]); disc(c, px - w * 0.25, py, w * 0.25); disc(c, px + w * 0.25, py, w * 0.25); }
  else if (k === "skull") { const c = F([225, 220, 196]); disc(c, px, py - h * 0.6, w * 0.42); rect(c, px - w * 0.28, py - h * 0.3, w * 0.56, h * 0.3); if (w > 4) { disc(F([30, 34, 30]), px - w * 0.16, py - h * 0.62, w * 0.11); disc(F([30, 34, 30]), px + w * 0.16, py - h * 0.62, w * 0.11); for (let q = 0; q < 4; q++) rect(F([30, 34, 30]), px - w * 0.2 + q * w * 0.13, py - h * 0.12, 1, h * 0.12); } }
  else if (k === "cliff") { rect(F([24, 32, 50]), px - w / 2, py - h, w, h); rect(F([44, 56, 80]), px + (px < LW / 2 ? w / 2 - w * 0.06 : -w / 2), py - h, w * 0.06, h); }
  else if (k === "lantern") { rect(F([40, 40, 48]), px - w * 0.12, py - h, w * 0.24, h); rect(F([40, 40, 48]), px - w * 0.12, py - h, w * 0.8 * (px < LW / 2 ? 1 : -1), Math.max(1, w * 0.15)); const lx = px + w * 0.7 * (px < LW / 2 ? 1 : -1); rect("#ffd264", lx - w * 0.25, py - h * 0.95, w * 0.5, w * 0.6); glows.push([lx, py - h * 0.92, Math.max(3, w * 2.2), "#ffc850"]); }
  else if (k === "buoy") { rect(F([60, 70, 90]), px - w * 0.1, py - h, w * 0.2, h); disc(Math.floor(t * 3 + s.i / 6) % 2 ? "#78dcff" : "#3c8cc8", px, py - h, w * 0.35); glows.push([px, py - h, w * 0.8, "#78dcff"]); }
  else if (k === "flesh") { const sw = Math.sin(t * 1.2 + s.i) * w * 0.3; poly(F([170, 50, 80]), [[px - w * 0.3, py], [px + sw - w * 0.15, py - h], [px + sw + w * 0.15, py - h], [px + w * 0.3, py]]); disc(F([240, 230, 220]), px + sw, py - h, w * 0.4); disc("#1a0a10", px + sw + (LW / 2 - px) * 0.01, py - h + w * 0.05, Math.max(1, w * 0.16)); }
  else if (k === "tooth") { poly(F([235, 228, 205]), [[px - w / 2, py], [px - w * 0.1, py - h], [px + w * 0.15, py - h * 0.9], [px + w / 2, py]]); rect(F([200, 90, 110]), px - w * 0.6, py - h * 0.08, w * 1.2, h * 0.08); }
  else if (k === "barrel") { rect(F([130, 84, 48]), px - w / 2, py - h, w, h); rect(F([70, 70, 76]), px - w / 2, py - h * 0.8, w, Math.max(1, h * 0.1)); rect(F([70, 70, 76]), px - w / 2, py - h * 0.3, w, Math.max(1, h * 0.1)); rect(F([160, 110, 66]), px - w * 0.3, py - h, w * 0.15, h); }
  else if (k === "sign") { rect(F([50, 50, 56]), px - w * 0.04, py - h, w * 0.08, h); rect(F([24, 22, 30]), px - w / 2, py - h * 1.6, w, h * 0.7); if (w > 4) for (let q = 0; q < 2; q++) { const cx = px + (q - 0.5) * w * 0.4, d = extra; poly("#ffd232", [[cx - d * w * 0.15, py - h * 1.55], [cx + d * w * 0.15, py - h * 1.25], [cx - d * w * 0.15, py - h * 0.95], [cx - d * w * 0.02, py - h * 1.25]]); } }
}

// ---- drawing
function fpProject(p, cx, cy, cz, len) {
  const z = p.z - cz + (p.loop ? len : 0), sc = FP.DEPTH / Math.max(1, z);
  return { x: Math.round(LW / 2 + sc * (p.x - cx) * LW / 2), y: Math.round(LH * 0.42 - sc * (p.y - cy) * LH / 2), w: Math.round(sc * FP.ROAD * LW / 2), sc, z };
}
const fpMix = (c, f, k) => "rgb(" + c.map((v, i) => Math.round(v + (f[i] - v) * k)) + ")";
const fpHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function fpQuad(col, x1, y1, w1, x2, y2, w2) { g.fillStyle = col; g.beginPath(); g.moveTo(x1 - w1, y1 + 1); g.lineTo(x2 - w2, y2); g.lineTo(x2 + w2, y2); g.lineTo(x1 + w1, y1 + 1); g.fill(); }
function drawKart() {
  const K = KART, me = K.me, t = K.t, len = K.len;
  K.ghostR = null;
  if (K.ghost && me.lapStart !== undefined && K.phase === "race") {     // your best lap, replayed
    const u = (t - me.lapStart) / 0.05, i = Math.floor(u), a = K.ghost[i], b = K.ghost[i + 1] || a;
    if (a) { let bz = b[0]; if (bz < a[0] - len / 2) bz += len; K.ghostR = { id: me.id, cols: me.cols, look: me.look, yaw: 0, spin: 0, boost: 0, z: lerp(a[0], bz, u - i) % len, x: lerp(a[1], b[1], u - i) / 100 }; }
  }
  const camZ = (((me.z - FP.CAM_H * FP.DEPTH * 1.6) % len) + len) % len, base = fpSeg(camZ), bp = (((camZ % FP.SEG) + FP.SEG) % FP.SEG) / FP.SEG;
  const camY = lerp(base.p1.y, base.p2.y, bp) + FP.CAM_H, camX = me.x * FP.ROAD;
  const sh = K.shake > 0 ? Math.round(Math.sin(t * 60) * 2) : 0, P = K.segs.def.pal, fogC = P.fog;
  g.save(); g.translate(sh, 0);
  // the water: a gradient to the surface, light rays, distant rocks moving with the curves
  for (let i = 0; i < 12; i++) rect(fpMix(P.top, P.water, i / 11), -4, i * 8, LW + 8, 8);
  rect(fpMix(P.top, P.water, 1), -4, 96, LW + 8, LH);
  K.sky = (K.sky || 0) + base.curve * me.speed / FP.MAX * 0.004;
  g.globalAlpha = P.rays; for (let k = 0; k < 6; k++) { const x = ((k * 70 - K.sky * 120 + t * 4) % (LW + 80) + LW + 80) % (LW + 80) - 40; fpQuad("#c8f0ff", x, 0, 6, x - 30, 84, 22); } g.globalAlpha = 1;
  fpBackdrop(K.segs.def.bg, P, K.sky, t);
  const glows = [], dark = K.segs.def.dark || 0;
  // the road, back to front clipping
  let x = 0, dx = -base.curve * bp, maxY = LH;
  const drawn = [];
  for (let n = 0; n < FP.DRAW; n++) {
    const s = K.segs[(base.i + n) % K.segs.length], loop = s.i < base.i;
    const a = fpProject({ x: 0 + x, y: s.p1.y, z: s.p1.z, loop }, camX, camY, camZ, len), b = fpProject({ x: 0 + x + dx, y: s.p2.y, z: s.p2.z, loop }, camX, camY, camZ, len);
    x += dx; dx += s.curve * 1.4;
    s.a = a; s.clip = maxY;
    if (a.z <= FP.DEPTH * 1.2 || b.y >= a.y || b.y >= maxY) { drawn.push(s); continue; }
    const fog = Math.min(1, n / FP.DRAW * 1.4), alt = Math.floor(s.i / 3) % 2;
    const ya = Math.min(a.y, maxY);
    const wa = a.w * s.w, wb = b.w * s.w;                      // the road's width here
    g.fillStyle = fpMix(fpHex(P.off[alt]), fogC, fog); g.fillRect(-4, b.y, LW + 8, ya - b.y + 1);
    fpQuad(fpMix(fpHex(P.rumble[alt]), fogC, fog), a.x, ya, wa * 1.12, b.x, b.y, wb * 1.12);
    fpQuad(fpMix(fpHex(P.road[alt]), fogC, fog), a.x, ya, wa, b.x, b.y, wb);
    if (alt) for (const l of [-0.33, 0.33]) fpQuad(fpMix(fpHex(P.lane), fogC, fog), a.x + wa * l, ya, Math.max(0.5, a.w * 0.015), b.x + wb * l, b.y, Math.max(0.5, b.w * 0.015));
    if (s.cur) {                                               // a current lane: streaks running along it
      const cx = (s.cur[0] + s.cur[1]) / 2, hw = (s.cur[1] - s.cur[0]) / 2, on = Math.floor(t * 10 - s.i / 2) % 4 === 0;
      g.globalAlpha = on ? 0.55 : 0.3; fpQuad(on ? "#b4f0ff" : "#50a0dc", a.x + a.w * cx, ya, a.w * hw, b.x + b.w * cx, b.y, b.w * hw); g.globalAlpha = 1;
    }
    for (const px of s.pads) {                                 // boost pads: glowing chevrons
      const on = Math.floor(t * 8 - s.i) % 2 === 0;
      fpQuad(fpMix(on ? [255, 220, 90] : [255, 150, 60], fogC, fog * 0.6), a.x + a.w * px, ya, a.w * 0.2, b.x + b.w * px, b.y, b.w * 0.2);
      if (a.w > 30) fpQuad(fpMix([255, 250, 220], fogC, fog), a.x + a.w * px, ya, a.w * 0.06, b.x + b.w * px, b.y, b.w * 0.02);
    }
    if (s.i < 2 || (s.i >= 2 && s.i < 4)) fpQuad(Math.floor(s.i) % 2 ? "#fafaff" : "#1a1628", a.x, ya, a.w, b.x, b.y, b.w);   // the start line
    maxY = b.y; drawn.push(s);
  }
  // sprites, far to near: scenery, item boxes, mines, urchins, racers
  for (let n = drawn.length - 1; n >= 0; n--) {
    const s = drawn[n], a = s.a; if (!a || a.z <= FP.DEPTH * 1.2) continue;
    const fog = Math.min(1, n / FP.DRAW * 1.4), at = (ox, w, h) => [a.x + a.w * ox, a.y, w * a.w / 400, h * a.w / 400];
    g.save(); g.beginPath(); g.rect(-4, 0, LW + 8, s.clip); g.clip();
    const F = c => fpMix(c, fogC, fog);
    for (const [k, ox, ex] of s.deco) {
      const [px, py, w, h] = at(ox, FP_DECO[k][0], FP_DECO[k][1]);
      if (w >= 0.6) fpDeco(k, px, py, w, h, F, s, ex, glows);
    }
    if (s.arch) {                                              // a ribcage arch over the road
      const R = a.w * s.w * 1.25; g.strokeStyle = F([225, 220, 196]); g.lineWidth = Math.max(1, a.w * 0.07);
      g.beginPath(); g.ellipse(a.x, a.y, R, R * 0.8, 0, Math.PI, Math.PI * 2); g.stroke();
      if (a.w > 20) { g.lineWidth = Math.max(1, a.w * 0.03); g.beginPath(); g.ellipse(a.x, a.y - R * 0.05, R * 0.82, R * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
    }
    for (const hz of s.haz) {                                  // hazards on the road
      const hx = fpHazX(hz, t);
      if (hz.t === "post") { const sz = FP_DECO[hz.k] || [100, 80], [px, py, w, h] = at(hx, sz[0] * 0.8, sz[1] * 0.6); if (w >= 0.6) fpDeco(hz.k, px, py, w, h, F, s, 0, glows); if (dark) glows.push([px, py - h * 0.5, Math.max(2, w * 0.5), "#ff5a3c"]); }
      else if (hz.t === "jelly") {
        const [px, py, w] = at(hx, 70, 70), y = py - w * 1.2 + Math.sin(t * 3 + hz.ph) * w * 0.12, col = K.segs.def.jelly || "#ffa0dc";
        if (w < 0.6) continue;
        g.globalAlpha = 0.75; g.fillStyle = col; g.beginPath(); g.ellipse(px, y, w / 2, w * 0.38, 0, Math.PI, 0); g.fill();
        for (let q = 0; q < 4; q++) rect(col, px - w * 0.36 + q * w * 0.24 + Math.sin(t * 5 + q) * w * 0.04, y, Math.max(1, w * 0.06), w * (0.5 + (q % 2) * 0.3));
        g.globalAlpha = 1; glows.push([px, y - w * 0.15, w * 0.7, col]);
      } else {
        const [px, py, w] = at(hx, 80, 80), f = fpGeyser(hz, t);
        if (w < 0.6) continue;
        g.fillStyle = F([30, 24, 26]); g.beginPath(); g.ellipse(px, py, w * 0.45, Math.max(1, w * 0.12), 0, 0, 7); g.fill();
        if (f > 0.5 && f < 0.7) for (let q = 0; q < 4; q++) rect("#ffd2a0", px - w * 0.3 + ((q * 37 + Math.floor(t * 20)) % 10) / 10 * w * 0.6, py - ((t * 3 + q / 4) % 1) * w * 0.6, Math.max(1, w * 0.08), Math.max(1, w * 0.08));
        if (f > 0.7) { const hh = w * 4 * Math.min(1, (f - 0.7) * 8) * (f > 0.95 ? (1 - f) * 20 : 1); for (let q = 0; q < 12; q++) { const u = q / 12; rect(q % 3 ? "#fff4e6" : "#ff9a50", px - w * 0.25 + Math.sin(t * 20 + q) * w * 0.12, py - hh * u - w * 0.1, w * 0.5, Math.max(1, hh / 12 + 1)); } glows.push([px, py - hh * 0.5, w, "#ff9a50"]); }
      }
    }
    for (const bx of s.boxes) if (!bx.gone) {
      const [px, py, w] = at(bx.x, 70, 70), bob = Math.sin(t * 4 + bx.x * 5) * w * 0.1;
      g.globalAlpha = 0.85; rect(fpMix([120, 220, 255], fogC, fog * 0.5), px - w / 2, py - w * 1.3 + bob, w, w); g.globalAlpha = 1; if (dark) glows.push([px, py - w * 0.8, w * 0.8, "#78dcff"]);
      if (w > 4) { rect("#fafaff", px - w / 2, py - w * 1.3 + bob, w, Math.max(1, w * 0.12)); text("?", px, py - w * 0.8 + bob, Math.max(1, Math.round(w / 9)), "#fafaff", "center", null); }
    }
    for (const m of K.mines) if (fpSeg(m.z) === s) { const [px, py, w] = at(m.x, 55, 55); disc("#e6c850", px, py - w * 0.6, Math.max(1, w / 2)); if (w > 6) { rect(INK, px - w * 0.2, py - w * 0.7, 2, 2); rect(INK, px + w * 0.1, py - w * 0.7, 2, 2); } }
    for (const u of K.shots) if (fpSeg(u.z) === s) { const [px, py, w] = at(u.x, 45, 45); disc("#b45adc", px, py - w * 0.6, Math.max(1, w / 2)); for (let q = 0; q < 6; q++) rect("#e6b4ff", px + Math.cos(q + t * 9) * w * 0.7, py - w * 0.6 + Math.sin(q + t * 9) * w * 0.7, 1, 1); }
    if (K.ghostR && fpSeg(K.ghostR.z) === s && K.ghostR.z > me.z - FP.SEG * 0.5) { const [px, py, w0] = at(K.ghostR.x, 90, 90), w = Math.min(w0, 40); if (w > 1) { g.globalAlpha = 0.45; fpKart(K.ghostR, px, py, w, 0.6); g.globalAlpha = 1; } }
    for (const r of K.racers) if (!r.me && fpSeg(r.z) === s && fpDist(r) > fpDist(me) - FP.SEG * 0.5) { const [px, py, w0] = at(r.x, 90, 90), w = Math.min(w0, 40); if (w > 1) { fpKart(r, px, py, w, fog); if (dark) glows.push([px, py - w * 0.2, w * 0.4, "#ff5050"]); } }   // (racers behind you aren't drawn: they'd be between you and the camera)
    g.restore();
  }
  // you, big at the bottom
  const pw = 34 + (me.boost > 0 ? 2 : 0), py = LH - 22 + Math.sin(t * 8) * 1;
  fpKart(me, LW / 2 + me.dir * 4, py, pw, 0);
  if (me.boost > 0) for (let q = 0; q < 8; q++) rect(q % 2 ? "#fafaff" : "#c8f0ff", LW / 2 - 6 + Math.random() * 12, py + 6 + Math.random() * 14, 1, 2);
  // ink on your screen
  if (dark) {                                                 // the dark: only what's near you, and things that glow
    const gr = g.createRadialGradient(LW / 2, LH - 26, 12, LW / 2, LH - 50, LH * 0.8);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.45, "rgba(0,0,0," + dark * 0.55 + ")"); gr.addColorStop(1, "rgba(0,0,0," + dark + ")");
    g.fillStyle = gr; g.fillRect(-4, 0, LW + 8, LH);
    g.globalCompositeOperation = "lighter";
    for (const [x, y, r0, c] of glows) { const r = Math.min(r0, 12); g.globalAlpha = 0.35 * dark; disc(c, x, y, r); g.globalAlpha = 0.15 * dark; disc(c, x, y, r * 2.2); }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  if (K.zapFx > 0) { g.globalAlpha = K.zapFx * 1.5; rect("#fff6a0", -4, 0, LW + 8, LH); g.globalAlpha = 1; }
  if (me.zap > 0 && Math.floor(t * 20) % 2) for (let q = 0; q < 4; q++) { const zx = LW / 2 - 16 + Math.random() * 32; rect("#ffe650", zx, py - 20 + Math.random() * 16, 1, 6); }
  if (me.ink > 0) { g.globalAlpha = Math.min(0.85, me.ink / 2); for (let q = 0; q < 7; q++) disc("#14121e", (q * 53 + 30) % LW, 40 + (q * 37) % 110, 18 + (q % 3) * 8); g.globalAlpha = 1; }
  g.restore();
  fpHud();
}
function fpShadow(x, y, w) { g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(x, y, w * 0.42, Math.max(1, w * 0.09), 0, 0, 7); g.fill(); }
// ---- kart looks: bodies, paint jobs and trails (sold in the chip shop or won in cups; looks only, never speed)
const FP_PAINTS = {
  stock: null, cherry: ["#e63c46", "#a01e2a"], lime: ["#8cdc3c", "#4a9a28"], ocean: ["#3c8cdc", "#1e4e9a"], sunset: ["#ff8c3c", "#c83c78"],
  midnight: ["#2a2c4e", "#6a6ec0"], bubblegum: ["#ff8cc8", "#fafaff"], chrome: ["#dce6f0", "#8c9aaa"], gold: ["#ffd23c", "#c8961e"],
};
function fpLook(r) { const k = r.look || {}; return { body: k.body || "shell", cols: FP_PAINTS[k.paint] || r.cols, paint: k.paint || "stock", trail: k.trail || "bubbles" }; }
// each body is drawn from behind around (0, 0); fish() draws the rider at a height; h = w * 0.42
const FP_BODIES = {
  shell(c1, c2, w, h, t, fish) {
    fish(-h * 0.55);
    g.fillStyle = "#e8e0c8"; g.beginPath(); g.ellipse(0, -h * 0.5, w * 0.36, h * 0.18, 0, 0, 7); g.fill();          // the cockpit rim
    g.fillStyle = c2; g.beginPath(); g.ellipse(0, -h * 0.15, w * 0.46, h * 0.5, 0, Math.PI, 0); g.fill();               // the shell (back half)
    g.fillStyle = c1; g.fillRect(-w * 0.46, -h * 0.17, w * 0.92, h * 0.42);                                               // the body
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-w * 0.4, -h * 0.12, w * 0.8, Math.max(1, h * 0.07));
    g.fillStyle = "#2a2438"; g.fillRect(-w * 0.34, h * 0.08, w * 0.18, h * 0.2); g.fillRect(w * 0.16, h * 0.08, w * 0.18, h * 0.2);   // two bubble jets
    g.fillStyle = c2; g.beginPath(); g.moveTo(-w * 0.46, -h * 0.1); g.lineTo(-w * 0.6, h * 0.2); g.lineTo(-w * 0.46, h * 0.25); g.fill();
    g.beginPath(); g.moveTo(w * 0.46, -h * 0.1); g.lineTo(w * 0.6, h * 0.2); g.lineTo(w * 0.46, h * 0.25); g.fill();
    return [[-w * 0.25, h * 0.18], [w * 0.25, h * 0.18]];                                                                 // where the jets are
  },
  sub(c1, c2, w, h, t, fish) {
    g.fillStyle = c2; g.fillRect(-w * 0.03, -h * 1.75, w * 0.06, h * 0.6); g.fillRect(-w * 0.03, -h * 1.75, w * 0.14, h * 0.12);   // periscope
    fish(-h * 0.5);
    g.globalAlpha *= 0.35; g.fillStyle = "#b4f0ff"; g.beginPath(); g.ellipse(0, -h * 0.55, w * 0.34, h * 0.75, 0, Math.PI, 0); g.fill(); g.globalAlpha /= 0.35;   // the glass dome
    g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(-w * 0.2, -h * 1.05, Math.max(1, w * 0.05), h * 0.3);
    g.fillStyle = c1; g.beginPath(); g.ellipse(0, 0, w * 0.48, h * 0.55, 0, 0, 7); g.fill();                              // the hull
    g.fillStyle = c2; g.fillRect(-w * 0.48, -h * 0.05, w * 0.96, Math.max(1, h * 0.12));
    for (const sx of [-1, 1]) { g.fillStyle = "#e8e0c8"; g.beginPath(); g.arc(sx * w * 0.3, -h * 0.05, Math.max(1, w * 0.08), 0, 7); g.fill(); g.fillStyle = "#3c6e8c"; g.beginPath(); g.arc(sx * w * 0.3, -h * 0.05, Math.max(1, w * 0.05), 0, 7); g.fill(); }   // portholes
    const sp = t * 18; g.fillStyle = "#2a2438"; g.fillRect(-w * 0.04, h * 0.35, w * 0.08, h * 0.25);                      // the propeller
    g.fillStyle = "#c8c8d2"; g.fillRect(-w * 0.2 * Math.abs(Math.cos(sp)), h * 0.5, w * 0.4 * Math.abs(Math.cos(sp)), Math.max(1, h * 0.1));
    g.fillStyle = c2; g.beginPath(); g.moveTo(-w * 0.4, h * 0.1); g.lineTo(-w * 0.62, h * 0.35); g.lineTo(-w * 0.35, h * 0.35); g.fill(); g.beginPath(); g.moveTo(w * 0.4, h * 0.1); g.lineTo(w * 0.62, h * 0.35); g.lineTo(w * 0.35, h * 0.35); g.fill();
    return [[0, h * 0.55]];
  },
  bathtub(c1, c2, w, h, t, fish) {
    fish(-h * 0.45);
    g.fillStyle = "#fafaff"; for (let q = 0; q < 7; q++) { g.beginPath(); g.arc(-w * 0.4 + q * w * 0.13, -h * 0.42 + Math.sin(t * 3 + q) * h * 0.04, w * 0.08, 0, 7); g.fill(); }   // foam
    g.fillStyle = "#f0f0f6"; g.beginPath(); g.moveTo(-w * 0.52, -h * 0.4); g.lineTo(w * 0.52, -h * 0.4); g.lineTo(w * 0.44, h * 0.3); g.lineTo(-w * 0.44, h * 0.3); g.fill();   // the tub
    g.fillStyle = "#c8c8d6"; g.fillRect(-w * 0.52, -h * 0.42, w * 1.04, Math.max(1, h * 0.1));
    g.fillStyle = c1; g.fillRect(-w * 0.47, -h * 0.05, w * 0.94, Math.max(1, h * 0.14));                                 // a painted stripe
    g.fillStyle = "#d2aa3c"; for (const sx of [-0.38, 0.38]) { g.fillRect(w * sx - w * 0.05, h * 0.3, w * 0.1, h * 0.22); g.fillRect(w * sx - w * 0.08, h * 0.46, w * 0.16, h * 0.08); }   // claw feet
    g.fillStyle = "#ffd232"; g.beginPath(); g.arc(w * 0.38, -h * 0.55, w * 0.07, 0, 7); g.fill(); g.beginPath(); g.arc(w * 0.44, -h * 0.68, w * 0.05, 0, 7); g.fill(); g.fillStyle = "#ff8c32"; g.fillRect(w * 0.47, -h * 0.68, w * 0.04, w * 0.02);   // rubber duck
    return [[0, h * 0.35]];
  },
  turtle(c1, c2, w, h, t, fish) {
    const pad = Math.sin(t * 8) * h * 0.15;
    g.fillStyle = "#64b464"; g.beginPath(); g.ellipse(-w * 0.52, h * 0.05 + pad, w * 0.16, h * 0.1, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(w * 0.52, h * 0.05 - pad, w * 0.16, h * 0.1, 0.5, 0, 7); g.fill();   // flippers
    g.beginPath(); g.ellipse(0, h * 0.45, w * 0.06, h * 0.12, 0, 0, 7); g.fill();                                         // tail
    g.fillStyle = c2; g.beginPath(); g.ellipse(0, 0, w * 0.5, h * 0.6, 0, Math.PI, 0); g.fill(); g.fillRect(-w * 0.5, -1, w, h * 0.3);   // the shell
    g.fillStyle = c1; for (const [px, py] of [[0, -0.32], [-0.26, -0.12], [0.26, -0.12], [-0.13, 0.08], [0.13, 0.08]]) { g.beginPath(); g.ellipse(w * px, h * py, w * 0.11, h * 0.13, 0, 0, 7); g.fill(); }   // plates
    g.fillStyle = "#e6dcb4"; g.fillRect(-w * 0.5, h * 0.24, w, Math.max(1, h * 0.08));
    fish(-h * 0.5);
    return [[-w * 0.3, h * 0.3], [w * 0.3, h * 0.3]];
  },
  chest(c1, c2, w, h, t, fish) {
    g.fillStyle = "#6e4628"; g.fillRect(-w * 0.46, -h * 1.15, w * 0.92, h * 0.6); g.fillStyle = "#ffd23c"; g.fillRect(-w * 0.46, -h * 1.15, w * 0.92, Math.max(1, h * 0.08));   // the open lid behind
    fish(-h * 0.5);
    for (let q = 0; q < 5; q++) { g.fillStyle = q % 2 ? "#ffd23c" : "#ffe68c"; g.beginPath(); g.arc(-w * 0.34 + q * w * 0.17, -h * 0.45, w * 0.07, 0, 7); g.fill(); }   // gold heaped up
    g.fillStyle = "#8c5a32"; g.fillRect(-w * 0.48, -h * 0.45, w * 0.96, h * 0.85);                                       // the chest
    g.fillStyle = "#6e4628"; for (let q = 1; q < 3; q++) g.fillRect(-w * 0.48, -h * 0.45 + q * h * 0.28, w * 0.96, 1);
    g.fillStyle = "#ffd23c"; g.fillRect(-w * 0.4, -h * 0.45, w * 0.08, h * 0.85); g.fillRect(w * 0.32, -h * 0.45, w * 0.08, h * 0.85); g.fillRect(-w * 0.07, -h * 0.2, w * 0.14, h * 0.2);   // bands and lock
    if (Math.floor(t * 3) % 4 === 0) { g.fillStyle = "#fffbe6"; g.fillRect(w * 0.2, -h * 0.6, 2, 2); }
    return [[-w * 0.25, h * 0.4], [w * 0.25, h * 0.4]];
  },
  maw(c1, c2, w, h, t, fish) {
    for (const sx of [-1, 1]) { const sw = Math.sin(t * 2 + sx) * w * 0.05; g.fillStyle = "#b43c5a"; g.fillRect(sx * w * 0.32 + sw, -h * 1.3, Math.max(1, w * 0.05), h * 0.8); g.fillStyle = "#f0e6dc"; g.beginPath(); g.arc(sx * w * 0.33 + sw, -h * 1.35, w * 0.09, 0, 7); g.fill(); g.fillStyle = "#1a0a10"; g.beginPath(); g.arc(sx * w * 0.33 + sw, -h * 1.33, w * 0.04, 0, 7); g.fill(); }   // eye stalks
    g.fillStyle = "#5a0e22"; g.beginPath(); g.ellipse(0, -h * 0.35, w * 0.4, h * 0.35, 0, 0, 7); g.fill();               // the throat
    fish(-h * 0.45);
    g.fillStyle = "#c84664"; g.beginPath(); g.ellipse(0, 0, w * 0.5, h * 0.55, 0, 0, Math.PI); g.fill(); g.fillRect(-w * 0.5, -h * 0.35, w * 0.1, h * 0.4); g.fillRect(w * 0.4, -h * 0.35, w * 0.1, h * 0.4);   // the lower jaw
    g.fillStyle = "#f0e6c8"; for (let q = 0; q < 6; q++) { const tx = -w * 0.38 + q * w * 0.152; g.beginPath(); g.moveTo(tx, -h * 0.05); g.lineTo(tx + w * 0.07, -h * 0.05); g.lineTo(tx + w * 0.035, -h * 0.32); g.fill(); }   // teeth
    g.fillStyle = "#a02846"; g.fillRect(-w * 0.3, h * 0.25, w * 0.6, Math.max(1, h * 0.06));
    if (Math.floor(t * 2) % 3 === 0) { g.fillStyle = "#e05a78"; g.fillRect(-w * 0.2, h * 0.45 + (t * 20 % 6), Math.max(1, w * 0.04), Math.max(1, w * 0.05)); }   // a drip
    return [[-w * 0.2, h * 0.4], [w * 0.2, h * 0.4]];
  },
};
const FP_TRAILS = {                          // what comes out the back: [colours, shape]
  bubbles: [["#c8f0ff"], "dot"], sparkle: [["#ffe68c", "#fafaff"], "star"], ink: [["#1e1a2e", "#3c3c5a"], "puff"],
  flame: [["#ff5a28", "#ffb43c", "#ffe68c"], "flame"], rainbow: [["#ff5050", "#ffb43c", "#ffe650", "#64dc64", "#50a0ff", "#b46eff"], "dot"], coins: [["#ffd23c", "#ffe68c"], "coin"],
};
function fpTrail(kind, boost, x, y, w, t, jets) {
  const [cols, shape] = FP_TRAILS[kind] || FP_TRAILS.bubbles, n = shape === "puff" ? 4 : 3;
  if (shape === "flame") { for (const [jx, jy] of jets) { const L = w * (0.22 + Math.random() * 0.12) * (boost ? 1.5 : 1), fw = Math.max(1, w * 0.09); rect(cols[0], x + jx - fw / 2, y + jy, fw, L); rect(cols[1], x + jx - fw / 3, y + jy, fw * 0.66, L * 0.7); rect(cols[2], x + jx - fw / 6, y + jy, Math.max(1, fw / 3), L * 0.4); } return; }
  for (const [jx, jy] of jets) for (let q = 0; q < n; q++) {
    const u = (t * 3 + q / n + w) % 1, px = x + jx + Math.sin(q * 7 + t * 9) * w * 0.04, py = y + jy + u * w * 0.35, c = boost && kind === "bubbles" ? "#ffe08c" : cols[(q + Math.floor(t * 6)) % cols.length];
    if (shape === "dot") rect(c, px, py, Math.max(1, w * 0.04), Math.max(1, w * 0.04));
    else if (shape === "star") { rect(c, px - w * 0.04, py, w * 0.08 + 1, 1); rect(c, px, py - w * 0.04, 1, w * 0.08 + 1); }
    else if (shape === "coin") { g.fillStyle = c; g.beginPath(); g.ellipse(px, py, Math.max(1, w * 0.04 * Math.abs(Math.cos(t * 8 + q))), Math.max(1, w * 0.04), 0, 0, 7); g.fill(); }
    else { g.globalAlpha = 0.8 * (1 - u); g.fillStyle = c; g.beginPath(); g.arc(px, py, Math.max(1, w * (0.04 + u * 0.08)), 0, 7); g.fill(); g.globalAlpha = 1; }
  }
}
function fpKart(r, x, y, w, fog) {           // a kart from behind, with the fish riding in it (its real sprite), like a Mario Kart driver
  const L = fpLook(r), [c1, c2] = L.cols, a = DATA.atlas[r.id], yaw = r.spin > 0 ? Math.sin(r.spin * 18) : r.yaw || 0, h = w * 0.42, t = KART ? KART.t : performance.now() / 1000;
  fpShadow(x, y, w);
  g.save(); if (fog > 0.05) g.globalAlpha = 1 - fog * 0.5;
  g.translate(x, y - h * 0.15); g.rotate(yaw * 0.22 + (r.tilt || 0));
  const fk = Math.min(w * 0.85 / a[2], h * 1.5 / a[3]), fw = a[2] * fk, fh = a[3] * fk, face = yaw > 0.05 ? 1 : yaw < -0.05 ? -1 : (r.face || 1);
  r.face = face;
  const fish = fy => { g.save(); g.translate(yaw * w * 0.06, fy + Math.sin(t * 7 + w) * w * 0.015 - (r.hop || 0) * h * 0.5); g.scale(face, 1); g.drawImage(atlas, a[0], a[1], a[2], a[3], Math.round(-fw / 2), Math.round(-fh), Math.round(fw), Math.round(fh)); g.restore(); };
  const jets = (FP_BODIES[L.body] || FP_BODIES.shell)(c1, c2, w, h, t, fish);
  if ((L.paint === "chrome" || L.paint === "gold") && w > 8) { const sx = ((t * 0.8) % 1.6 - 0.3) * w; g.globalAlpha *= 0.5; g.fillStyle = "#ffffff"; g.fillRect(-w * 0.5 + sx, -h * 0.4, Math.max(1, w * 0.06), h * 0.8); g.globalAlpha = 1; }   // a shine sweeping across
  if (w > 10 && L.body === "shell") { g.fillStyle = r.boost > 0 ? "#ffe08c" : "#8ce6ff"; g.fillRect(-w * 0.3, h * 0.12, w * 0.1, h * 0.12); g.fillRect(w * 0.2, h * 0.12, w * 0.1, h * 0.12); }
  g.restore(); g.globalAlpha = 1;
  if (r.shield > 0) { g.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1; g.strokeStyle = "#8ce6ff"; g.lineWidth = Math.max(1, w * 0.04); g.beginPath(); g.ellipse(x, y - h * 0.6, w * 0.62, h * 1.25, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }   // shell shield bubble
  if (r.zap > 0 && w > 4 && Math.floor(t * 20) % 2) rect("#ffe650", x - w * 0.3 + Math.random() * w * 0.6, y - h * 1.2, 1, Math.max(2, h * 0.5));
  if (w > 8) fpTrail(L.trail, r.boost > 0, x, y - h * 0.15, w, t, jets);
  if (r.me && r.look && r.look.plate === "plate" && w >= 24) { const s = (r.name || "").slice(0, 6), pw = s.length * 6 + 3; rect("#fafaff", x - pw / 2, y + 1, pw, 9); outline(x - pw / 2, y + 1, pw, 9, "#2a2438"); text(s, x + 1, y + 5, 1, "#2a2438", "center", null); }
}
const ORD = n => n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH");
function fpTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return m + ":" + (r < 10 ? "0" : "") + r.toFixed(2); }
function fpHud() {
  const K = KART, me = K.me, raceT = Math.max(0, K.t - 3.6);
  text("LAP " + Math.min(K.laps, Math.max(1, me.lap + 1)) + "/" + K.laps, 4, 8, 1, WHITE, "left");
  text(fpTime(me.done ? me.finishT - 3.6 : raceT), LW - 4, 8, 1, WHITE, "right");
  const ic = me.roll > 0 ? Object.keys(FP_ITEMS)[Math.floor(K.t * 12) % 6] : me.item;   // the item box, top middle
  box(LW / 2 - 13, 2, 26, 22, me.item ? GOLD : "#5a6496");
  if (ic) { fpItemIcon(ic, LW / 2, 13); if (me.item) text(KEYS ? "SPACE" : "TAP", LW / 2, 29, 1, GOLD, "center", null); }
  const pl = me.place, col = pl === 1 ? GOLD : pl <= 3 ? "#c8d2f0" : ORANGE;
  text(pl, 14, LH - 20, 3, col, "center"); text(ORD(pl).slice(-2), 26, LH - 22, 1, col, "left");
  if (me.speed > 0) { const sp = Math.round(me.speed / FP.MAX * 100); text(sp + " KN", LW - 4, LH - 8, 1, me.boost > 0 ? ORANGE : "#c8f0ff", "right", null); }
  const over = K.phase === "done" || K.phase === "cupdone", mapH = over ? 0 : fpMinimap();
  if (K.tt && !over) {                                            // time trial: your laps and your record, under the map
    const best = fpData().best[K.track], y0 = 20 + mapH;
    if (LW >= 200) { text("BEST " + (best ? best.toFixed(2) : "-"), LW - 4, y0, 1, GOLD, "right", null); me.laps.forEach((lt, i) => text("LAP " + (i + 1) + " " + lt.toFixed(2), LW - 4, y0 + 10 + i * 9, 1, best && lt <= best + 0.001 ? GOLD : WHITE, "right", null)); }
    if (K.ghost && LW >= 200) text("GHOST ON", LW - 4, y0 + 42, 1, "#8c96c8", "right", null);
  }
  if (!K.tt && !over) K.racers.slice().sort((a, b) => a.place - b.place).forEach((r, i) => {                 // the running order, under the map
    if (LW < 200) return;
    const y = 20 + mapH + i * 9; rect(r.me ? "#1e285a" : "rgba(0,0,0,0.3)", LW - 62, y - 4, 58, 8);
    text(i + 1, LW - 58, y, 1, r.me ? GOLD : GREY, "left", null); text(r.name.slice(0, 7), LW - 50, y, 1, r.me ? GOLD : WHITE, "left", null);
  });
  if (K.cup) text("RACE " + (K.cup.i + 1) + "/3", 4, 18, 1, "#8c96c8", "left", null);
  if (K.tt) text("TIME TRIAL", 4, 18, 1, "#8c96c8", "left", null);
  if (K.phase === "count" && LW >= 300 && !K.tt) {                       // who you're racing, and how they drive
    g.globalAlpha = 0.8; rect(INK, 4, 30, 112, 82); g.globalAlpha = 1; outline(4, 30, 112, 82, "#5a6496");
    text("THE FIELD", 60, 37, 1, GOLD, "center", null);
    K.racers.filter(r => r.p).forEach((r, i) => { text(r.name, 8, 47 + i * 9, 1, WHITE, "left", null); text(r.p.style, 112, 47 + i * 9, 1, "#8c96c8", "right", null); });
  }
  if (K.phase === "count") { const cup = FP_CUPS.find(c => c.tracks.includes(K.track)); text(K.segs.def.name, LW / 2, 44, 1, GOLD, "center"); if (K.tt) text("TIME TRIAL", LW / 2, 54, 1, "#8c96c8", "center", null); else if (cup) text(cup.name + " " + (cup.tracks.indexOf(K.track) + 1) + "/3", LW / 2, 54, 1, "#8c96c8", "center", null); }
  if (K.phase === "count") { const n = Math.ceil(K.ct - 0.6); text(n > 0 ? String(n) : "GO!", LW / 2, 80, 4, n > 0 ? WHITE : LIME, "center"); }
  else if (K.msgT > 0 && K.phase === "race") text(K.msg, LW / 2, 70, 2, GOLD, "center");
  if (K.test && K.phase !== "done") text(KEYS ? "TEST  ESC: QUIT" : "TEST", 4, 18, 1, GREY, "left", null);
  if (K.phase === "race" && K.t < 12) (KEYS ? ["W: GAS   S: BRAKE   A D: STEER", "SPACE: USE ITEM   H: HORN", "HIT THE ORANGE PADS FOR A BOOST"] : ["HOLD A SIDE TO STEER"]).forEach((l, i) => text(l, LW / 2, 104 + i * 10, 1, WHITE, "center", null));
  if (K.phase === "done") fpResults();
  if (K.phase === "cupdone") fpCupResults();
}
function fpMinimap() {                       // the track from above, with everyone on it -> height used
  const K = KART, pts = K.segs.map, wide = LW >= 300, sz = wide ? 58 : LW >= 160 ? 34 : 28, x0 = LW - sz - 4, y0 = wide ? 14 : 26, t = K.t;
  g.globalAlpha = 0.45; rect(INK, x0 - 2, y0 - 2, sz + 4, sz + 4); g.globalAlpha = 1;
  const P = i => { const q = pts[((i % pts.length) + pts.length) % pts.length]; return [x0 + 2 + q[0] * (sz - 4), y0 + 2 + q[1] * (sz - 4)]; };
  for (let i = 0; i < pts.length; i += 2) { const [px, py] = P(i); rect(K.segs[i].pads.length ? ORANGE : K.segs[i].cur ? "#78dcff" : "#c8b480", px, py, 1, 1); }
  const [sx, sy] = P(0); rect("#fafaff", sx - 1, sy - 1, 3, 3);
  for (const m of K.mines) { const [px, py] = P(Math.floor(m.z / FP.SEG)); rect("#e6c850", px, py, 1, 1); }
  for (const u of K.shots) { const [px, py] = P(Math.floor(u.z / FP.SEG)); rect("#b45adc", px, py, 1, 1); }
  const lead = K.racers.find(r => r.place === 1);
  K.racers.forEach(r => { if (r.me) return; const [px, py] = P(Math.floor(r.z / FP.SEG)); rect(r === lead ? "#fafaff" : r.cols[0], px - 1, py - 1, 2, 2); if (r === lead) outline(px - 2, py - 2, 4, 4, GOLD); });
  const [mx, my] = P(Math.floor(K.me.z / FP.SEG)); if (Math.floor(t * 4) % 2) rect(GOLD, mx - 1.5, my - 1.5, 3, 3); else rect("#fff4c8", mx - 1, my - 1, 2, 2);
  return wide ? sz + 4 : 0;
}
function fpItemIcon(k, x, y) {
  if (k === "shrimp") { rect("#ff8c64", x - 6, y - 2, 10, 5); rect("#ffb48c", x + 3, y - 4, 4, 4); rect(INK, x + 5, y - 3, 1, 1); for (let q = 0; q < 3; q++) rect("#ff8c64", x - 8 - q, y + 3 - q, 2, 1); }
  else if (k === "puffer") { disc("#e6c850", x, y, 6); for (let q = 0; q < 8; q++) rect("#b49628", x + Math.cos(q * 0.8) * 7, y + Math.sin(q * 0.8) * 7, 1, 1); rect(INK, x - 3, y - 2, 2, 2); rect(INK, x + 1, y - 2, 2, 2); }
  else if (k === "ink") { disc("#3c3c5a", x, y + 1, 6); disc("#3c3c5a", x - 4, y - 3, 3); disc("#3c3c5a", x + 4, y - 3, 3); }
  else if (k === "zap") { for (let q = 0; q < 5; q++) rect("#ffe650", x - 6 + q * 3, y - 6 + (q % 2 ? 4 : 0) + q, 3, 3); rect("#fff8c8", x - 1, y - 1, 2, 2); }
  else if (k === "shield") { disc("#8ce6ff", x, y, 7); disc("#e6c88c", x, y + 1, 5); rect("#b4965a", x - 4, y, 8, 1); rect("#b4965a", x, y - 3, 1, 8); }
  else { disc("#b45adc", x, y, 5); for (let q = 0; q < 8; q++) rect("#e6b4ff", x + Math.cos(q * 0.8) * 7, y + Math.sin(q * 0.8) * 7, 1, 1); }
}
function fpResults() {
  const K = KART, order = fpOrder(), w = 150, x = LW / 2 - w / 2, t = K.t, mePl = order.indexOf(K.me) + 1, f = tav().fish;
  g.globalAlpha = 0.88; rect(INK, x, 30, w, 140); g.globalAlpha = 1; outline(x, 30, w, 140, GOLD);
  if (K.tt) {                                                     // time trial: the laps
    const best = fpData().best[K.track];
    text(K.newBest ? "NEW RECORD!" : "TIME TRIAL", LW / 2, 40, 2, K.newBest ? GOLD : WHITE, "center");
    K.me.laps.forEach((lt, i) => text("LAP " + (i + 1) + "   " + lt.toFixed(2), LW / 2, 64 + i * 12, 1, best && lt <= best + 0.001 ? GOLD : WHITE, "center", null));
    text("TOTAL " + fpTime(K.me.finishT - 3.6), LW / 2, 108, 1, "#c8d2f0", "center", null);
    text("BEST LAP " + (best ? best.toFixed(2) : "-"), LW / 2, 122, 1, GOLD, "center", null);
    if (K.track === "kelp") text("ON THE TAVERN BOARD", LW / 2, 134, 1, CYAN, "center", null);
  } else {
    text(mePl === 1 ? "YOU WIN!" : ORD(mePl) + " PLACE", LW / 2, 40, 2, mePl === 1 ? GOLD : WHITE, "center");
    order.forEach((r, i) => {
      const y = 58 + i * 12; text(ORD(i + 1), x + 8, y, 1, i < 3 ? GOLD : GREY, "left", null); fitDraw(atlas, r.id, x + 44, y, 18, 9, 1); text(r.name.slice(0, 9), x + 56, y, 1, r.me ? GOLD : WHITE, "left", null);
      if (K.cup) text("+" + FP_POINTS[i], x + w - 6, y, 1, CHIP, "right", null);
      else { if (r.p && LW >= 300) text(r.p.style, x + w + 6, y, 1, "#7a86b4", "left", null); if (r.done) text(fpTime(r.finishT - 3.6), x + w - 6, y, 1, "#c8d2f0", "right", null); }
    });
    if (K.cup && LW >= 300) { text("STANDINGS", x + w + 40, 46, 1, GOLD, "center", null); fpCupStandings().forEach(([r, p], i) => { text(r.name.slice(0, 7), x + w + 6, 58 + i * 12, 1, r.me ? GOLD : WHITE, "left", null); text(p, x + w + 74, 58 + i * 12, 1, CHIP, "right", null); }); }
  }
  if (LW >= 300 && f && !K.test && (K.tt || mePl <= 3)) { const pose = fpData().eq.pose || "wave"; rect("#2a3466", x - 70, 140, 52, 10); rect("#3c4a8a", x - 70, 140, 52, 2); fpPose(pose, Object.assign({}, K.me, { shield: 0, zap: 0, spin: 0 }), x - 44, 140, 44, t, 1); }   // your victory pose
  if (K.test) text((KEYS ? "A D: TRACK   " : "") + K.segs.def.name, LW / 2, 182, 1, "#8c96c8", "center", null);
  const nxt = K.test || K.tt ? "RACE AGAIN" : K.cup && K.cup.i < 2 ? "NEXT RACE" : K.cup ? "CUP RESULTS" : "CONTINUE";
  if (Math.floor(t * 2) % 2) text((KEYS ? "SPACE: " : "TAP: ") + nxt, LW / 2, 162, 1, WHITE, "center", null);
  if (KEYS) text("ESC: " + (K.test ? "QUIT" : "BACK TO THE PIT"), LW / 2, 174, 1, GREY, "center", null);
}
function fpCupResults() {                    // after the third race: standings, your medal, what you won
  const K = KART, e = K.cupEnd, w = 170, x = LW / 2 - w / 2, cup = FP_CUPS.find(c => c.id === K.cup.id);
  g.globalAlpha = 0.9; rect(INK, x, 20, w, 160); g.globalAlpha = 1; outline(x, 20, w, 160, FP_MEDAL_COL[e.medal] === "#5a6496" ? GOLD : FP_MEDAL_COL[e.medal]);
  text(cup.name, LW / 2, 28, 1, GOLD, "center", null);
  text(e.medal ? FP_MEDALS[e.medal] + "!" : ORD(e.pos + 1) + " OVERALL", LW / 2, 42, 2, e.medal ? FP_MEDAL_COL[e.medal] : WHITE, "center");
  e.st.forEach(([r, p], i) => { const y = 60 + i * 10; text(ORD(i + 1), x + 8, y, 1, i < 3 ? FP_MEDAL_COL[3 - i] : GREY, "left", null); text(r.name.slice(0, 10), x + 34, y, 1, r.me ? GOLD : WHITE, "left", null); text(p, x + w - 8, y, 1, CHIP, "right", null); });
  const lines = [];
  if (e.chips) lines.push(["+" + e.chips + " CHIPS" + (e.wasNew ? "" : " (REPEAT)"), CHIP]);
  e.got.forEach(n => lines.push(["NEW: " + n, GOLD]));
  if (e.opened) lines.push([e.opened === "???" ? "SOMETHING OPENED..." : e.opened + " OPEN", CYAN]);
  lines.slice(0, 4).forEach(([l, c], i) => text(l.slice(0, 27), LW / 2, 144 + i * 9, 1, c, "center", null));
  if (Math.floor(K.t * 2) % 2) text(KEYS ? "SPACE: BACK TO THE PIT" : "TAP: BACK TO THE PIT", LW / 2, 188, 1, WHITE, "center", null);
  K.t += 0;                                                       // (the race clock keeps running for the blink)
}


// ---- the career: cups, time trials, looks, and THE PIT (a garage off the tavern). Built Nov 18, 2026.
// Saved in tav().fp: { cups: {cupId: best medal 1-3}, best: {track: best time-trial lap, s}, own: ["body.sub", ...],
// eq: {body, paint, trail, pose, horn, plate}, races, wins, v }. Ghost laps live in their own localStorage key (too big
// for save codes). Nothing here changes a dive's score: looks are looks, and racing pays chips.
const FP_CUP_SKILL = { minnow: 0.985, reef: 0.995, deep: 1.005, abyss: 1.015 };     // the AI gets harder each cup
const FP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const FP_MEDALS = ["-", "BRONZE", "SILVER", "GOLD"], FP_MEDAL_COL = ["#5a6496", "#d28c50", "#c8d2f0", "#ffd23c"];
const FP_FIRST_CHIPS = [0, 100, 250, 500], FP_AGAIN_CHIPS = [0, 10, 15, 30];   // a new best medal pays the difference; repeats pay a little
const FP_CATS = [["body", "BODY"], ["paint", "PAINT"], ["trail", "TRAIL"], ["pose", "POSE"], ["horn", "HORN"], ["plate", "PLATE"]];
// [id, name, price in chips (0 = free, null = won, not sold), won by (cup id, or "all" for gold in every cup)]
const FP_LOOKS = {
  body: [["shell", "SHELL KART", 0], ["sub", "MINI SUB", 1500], ["bathtub", "BATHTUB", 2000], ["turtle", "TURTLE SHELL", null, "minnow"], ["chest", "TREASURE CHEST", null, "reef"], ["maw", "MAW KART", null, "abyss"]],
  paint: [["stock", "STOCK", 0], ["cherry", "CHERRY", 400], ["lime", "LIME", 400], ["ocean", "OCEAN", 400], ["sunset", "SUNSET", 400], ["midnight", "MIDNIGHT", 400], ["bubblegum", "BUBBLEGUM", 400], ["chrome", "CHROME", null, "deep"], ["gold", "GOLD", null, "all"]],
  trail: [["bubbles", "BUBBLES", 0], ["sparkle", "SPARKLE", 800], ["ink", "INK", 800], ["flame", "FLAME", null, "deep"], ["coins", "COINS", null, "reef"], ["rainbow", "RAINBOW", null, "all"]],
  pose: [["wave", "FIN WAVE", 0], ["spin", "SPIN", 600], ["hop", "HOP", 600], ["fireworks", "FIREWORKS", 1200], ["golden", "GOLDEN FIN", null, "all"]],
  horn: [["honk", "HONK", 0], ["squeak", "SQUEAK", 300], ["foghorn", "FOGHORN", 300], ["kazoo", "KAZOO", 300], ["whale", "WHALE SONG", null, "all"]],
  plate: [["none", "NO PLATE", 0], ["plate", "NAMEPLATE", 200]],
};
const FP_CUP_TITLE = { minnow: "minnowcup", reef: "reefcup", deep: "deepcup", abyss: "abysscup" };
const FP_WHO = { minnow: "MINNOW CUP GOLD", reef: "REEF CUP GOLD", deep: "DEEP CUP GOLD", abyss: "ABYSS CUP GOLD", all: "GOLD IN EVERY CUP" };
Object.assign(SOUNDS, {                       // the horns (H in a race)
  fp_honk: [[330, 0.12, "square", 0.25], [330, 0.16, "square", 0.25, 0, 0.16]], fp_squeak: [[900, 0.08, "triangle", 0.3, 1400], [1300, 0.1, "triangle", 0.3, 800, 0.09]],
  fp_foghorn: [[90, 0.7, "sawtooth", 0.25, 80]], fp_kazoo: [[420, 0.12, "sawtooth", 0.18, 520], [520, 0.2, "sawtooth", 0.18, 380, 0.12]],
  fp_whale: [[180, 0.6, "sine", 0.35, 320], [320, 0.8, "sine", 0.3, 140, 0.55]],
});
function fpData() {
  const q = tav();
  q.fp = Object.assign({ cups: {}, best: {}, own: [], eq: {}, races: 0, wins: 0 }, q.fp || {});
  if (!q.fp.v) { q.fp.v = 1; q.stats.fast = 0; }               // stats.fast used to be a derby time; it's a lap time now
  return q.fp;
}
const fpItem = key => { const [c, id] = key.split("."); return (FP_LOOKS[c] || []).find(e => e[0] === id); };
const fpOwns = key => { const it = fpItem(key); return !!it && (it[2] === 0 || fpData().own.includes(key)); };
const fpCupOpen = i => { const c = fpData().cups; return i === 0 || (i < 3 ? (c[FP_CUPS[i - 1].id] || 0) >= 1 : (c.deep || 0) >= 3); };   // bronze opens the next; the Abyss needs Deep gold
const fpTrackOpen = k => FP_CUPS.some((c, i) => fpCupOpen(i) && c.tracks.includes(k));
const fpAllGold = () => FP_CUPS.every(c => (fpData().cups[c.id] || 0) >= 3);
function fpGhosts() { try { return JSON.parse(localStorage.getItem("reeldeep_ghosts") || "{}"); } catch (e) { return {}; } }
function fpSaveGhost(track, rec) { try { const g0 = fpGhosts(); g0[track] = rec; localStorage.setItem("reeldeep_ghosts", JSON.stringify(g0)); } catch (e) { /* no room: fine */ } }
function fpHorn() { const h = (KART && KART.me.look && KART.me.look.horn) || "honk"; play("fp_" + h); }

function fpLapDone(r, lt) {                  // you finished a lap: time trials keep records (and Kelp Circuit's goes on the tavern board)
  const K = KART;
  r.laps.push(lt);
  if (!K.tt) return;
  const d = fpData(), best = d.best[K.track];
  if (!best || lt < best) {
    d.best[K.track] = +lt.toFixed(2); fpSaveGhost(K.track, r.rec); K.newBest = true;
    K.msg = "NEW BEST LAP!"; K.msgT = 2; play("fanfare");
    if (K.track === "kelp") { tav().stats.fast = Math.round(lt * 100); tav().postedAt = 0; tavPost(); }
    saveStore();
  }
}
function fpOrder() { return KART.racers.slice().sort((a, b) => (a.done && b.done ? a.finishT - b.finishT : b.done - a.done || fpDist(b) - fpDist(a))); }
function fpRaceOver() {                      // the race just ended for you
  const K = KART, f = tav().fish, d = fpData();
  if (K.test) return;
  if (K.cup) {
    const order = fpOrder();
    order.forEach((r, i) => { K.cup.pts[r.name] = (K.cup.pts[r.name] || 0) + FP_POINTS[i]; });
    K.cup.gain = order.map((r, i) => FP_POINTS[i]); K.cup.last = order.map(r => r.name);
    d.races++; if (order[0] === K.me) { d.wins++; if (f) f.wins++; }
    if (f) f.races++;
    saveStore();
  }
}
function fpCupStandings() { const c = KART.cup; return KART.racers.map(r => [r, c.pts[r.name] || 0]).sort((a, b) => b[1] - a[1] || c.last.indexOf(a[0].name) - c.last.indexOf(b[0].name)); }
function fpCupEnd() {                        // the third race is done: medal, chips, rewards
  const K = KART, c = K.cup, d = fpData(), st = fpCupStandings(), pos = st.findIndex(e => e[0] === K.me), medal = pos < 3 ? 3 - pos : 0;
  const prev = d.cups[c.id] || 0, got = [];
  let chips = 0;
  if (medal > prev) { chips = FP_FIRST_CHIPS[medal] - FP_FIRST_CHIPS[prev]; d.cups[c.id] = medal; } else chips = FP_AGAIN_CHIPS[medal];
  if (medal === 3) {
    for (const [cat, list] of Object.entries(FP_LOOKS)) for (const it of list) if (it[3] === c.id && !d.own.includes(cat + "." + it[0])) { d.own.push(cat + "." + it[0]); got.push(it[1]); }
    if (award(FP_CUP_TITLE[c.id])) got.push("TITLE: " + titleName(FP_CUP_TITLE[c.id]));
    if (fpAllGold()) {
      for (const [cat, list] of Object.entries(FP_LOOKS)) for (const it of list) if (it[3] === "all" && !d.own.includes(cat + "." + it[0])) { d.own.push(cat + "." + it[0]); got.push(it[1]); }
      if (award("finlegend")) got.push("TITLE: FIN PRIX LEGEND");
    }
  }
  if (chips) addChips(chips);
  K.cupEnd = { st, pos, medal, chips, got, wasNew: medal > prev, opened: medal >= 1 && !prev && FP_CUPS.findIndex(x => x.id === c.id) < 2 ? FP_CUPS[FP_CUPS.findIndex(x => x.id === c.id) + 1].name : medal === 3 && c.id === "deep" && prev < 3 ? "???" : null };
  K.phase = "cupdone"; play(medal === 3 ? "fanfare" : medal ? "chime" : "miss");
  saveStore();
}
function fpNext() {                          // Space / tap after a race
  const K = KART;
  if (K.test) { startKart(true, null, K.track); return; }
  if (K.tt) { startKart(false, null, K.track, { tt: true }); return; }
  if (K.cup && K.phase === "done") {
    const cup = FP_CUPS.find(x => x.id === K.cup.id);
    if (K.cup.i < 2) startKart(false, null, cup.tracks[K.cup.i + 1], { cup: Object.assign({}, K.cup, { i: K.cup.i + 1 }) });
    else fpCupEnd();
    return;
  }
  fpExit();
}
function fpExit() { KART = null; newDive(); S.overlay = "pit"; play("back"); }
function fpStartCup(i) { const c = FP_CUPS[i]; startKart(false, null, c.tracks[0], { cup: { id: c.id, i: 0, pts: {}, last: null } }); }

// ---- THE PIT
let PIT = { tab: "cups", cup: 0, track: "kelp", cat: 0, sel: 0 };
function pitOpen(tab) { fpData(); if (tab) PIT.tab = tab; PIT.sel = 0; openOverlay("pit"); }
const PIT_TABS = [["cups", "CUPS", "CUPS"], ["trial", "LAPS", "TIME TRIAL"], ["garage", "KART", "GARAGE"], ["train", "GYM", "TRAINING"]];
function pitGeo() { const wide = wideMenus(); return { wide, X: wide ? WX() : OX, W: wide ? 348 : 120 }; }
function pitHits() {                         // [id, x, y, w, h, value] in screen coordinates
  const { wide, X, W } = pitGeo(), h = [], tw = W / 4;
  if (!tav().fish) return h;
  PIT_TABS.forEach(([id], i) => h.push(["tab", X + i * tw, 16, tw - 2, 12, id]));
  if (PIT.tab === "cups") {
    FP_CUPS.forEach((c, i) => h.push(["cup", X, 34 + i * (wide ? 30 : 27), wide ? 200 : W, wide ? 27 : 24, i]));
    h.push(["race", wide ? X + 214 : X + 20, wide ? 140 : 156, wide ? 134 : 80, 16, 0]);
  } else if (PIT.tab === "trial") {
    FP_ORDER.forEach((k, i) => h.push(wide ? ["track", X + (i % 2) * 176, 34 + Math.floor(i / 2) * 16, 172, 14, k] : ["track", X, 32 + i * 11, W, 10, k]));
    h.push(["race", wide ? X + 107 : X + 20, wide ? 154 : 166, wide ? 134 : 80, 15, 0]);
  } else if (PIT.tab === "garage") {
    if (wide) FP_CATS.forEach((c, i) => h.push(["cat", X + i * 58, 31, 56, 12, i]));
    else { h.push(["catp", X, 31, 20, 12, -1]); h.push(["catp", X + W - 20, 31, 20, 12, 1]); }
    FP_LOOKS[FP_CATS[PIT.cat][0]].forEach((it, i) => h.push(["look", X, 48 + i * (wide ? 14 : 11), wide ? 170 : W, wide ? 13 : 10, i]));
    h.push(["act", wide ? X + 214 : X + 20, wide ? 152 : 170, wide ? 134 : 80, 15, 0]);
  } else h.push(["gym", wide ? X + 214 : X + 20, wide ? 150 : 166, wide ? 134 : 80, 15, 0]);
  return h;
}
function pitLookState(cat, i) {              // -> [button label, colour, note]
  const it = FP_LOOKS[cat][i], key = cat + "." + it[0], d = fpData(), on = (d.eq[cat] || FP_LOOKS[cat][0][0]) === it[0];
  if (on) return ["EQUIPPED", GREY, cat === "horn" ? "TAP TO HEAR IT" : "YOURS"];
  if (fpOwns(key)) return ["EQUIP", CHIP, "YOURS"];
  if (it[2] === null) return ["WIN IT", GOLD, FP_WHO[it[3]]];
  return ["BUY " + it[2], tav().chips >= it[2] ? GOLD : GREY, it[2] + " CHIPS"];
}
function pitAct(id, v) {
  const d = fpData();
  if (id === "tab") { PIT.tab = v; PIT.sel = 0; play("tick"); }
  else if (id === "cup") { if (PIT.cup === v && fpCupOpen(v)) fpStartCup(v); else { PIT.cup = v; play(fpCupOpen(v) ? "tick" : "miss"); } }
  else if (id === "race" && PIT.tab === "cups") { if (fpCupOpen(PIT.cup)) fpStartCup(PIT.cup); else play("miss"); }
  else if (id === "track") { if (!fpTrackOpen(v)) { play("miss"); return; } if (PIT.track === v) startKart(false, null, v, { tt: true }); else { PIT.track = v; play("tick"); } }
  else if (id === "race") { if (fpTrackOpen(PIT.track)) startKart(false, null, PIT.track, { tt: true }); else play("miss"); }
  else if (id === "cat") { PIT.cat = v; PIT.sel = 0; play("tick"); }
  else if (id === "catp") { PIT.cat = (PIT.cat + v + FP_CATS.length) % FP_CATS.length; PIT.sel = 0; play("tick"); }
  else if (id === "look") { if (PIT.sel === v) pitAct("act"); else { PIT.sel = v; play("tick"); if (FP_CATS[PIT.cat][0] === "horn") play("fp_" + FP_LOOKS.horn[v][0]); } }
  else if (id === "act") {
    const cat = FP_CATS[PIT.cat][0], it = FP_LOOKS[cat][PIT.sel], key = cat + "." + it[0];
    if (fpOwns(key)) { d.eq[cat] = it[0]; play(cat === "horn" ? "fp_" + it[0] : "select"); }
    else if (it[2] && tav().chips >= it[2]) { addChips(-it[2]); d.own.push(key); d.eq[cat] = it[0]; play("fanfare"); }
    else play("miss");
    saveStore();
  } else if (id === "gym") { TAV.fishBack = "pit"; openOverlay("myfish"); }
}
function pitTap(rx, ly) {
  if (ly > 186) { closeOverlay(); return; }
  const h = hitAt(pitHits(), rx, ly);
  if (h) pitAct(h[0], h[5]);
}
function pitKey(dir) { const i = PIT_TABS.findIndex(t => t[0] === PIT.tab); PIT.tab = PIT_TABS[(i + dir + 4) % 4][0]; PIT.sel = 0; play("tick"); }
function pitBg(X, W) {
  rect("#16161e", -4, 0, LW + 8, LH);
  for (let x = -((T * 6) % 24); x < LW + 24; x += 24) { rect("#1c1c26", x, 0, 12, LH); }
  rect("#26262f", -4, 176, LW + 8, 24); for (let x = 0; x < LW; x += 16) rect(x % 32 ? "#ffd23c" : "#1a1a1a", x, 176, 16, 3);   // the hazard stripe on the floor
}
function pitKartPreview(x, y, w, look, pose) {
  const f = tav().fish, r = { id: f.id, name: f.name, me: true, cols: fpFishColors(f.id), look, yaw: 0, spin: 0, boost: 0 };
  fpPose(pose || "", r, x, y, w, T, 0);
}
function drawPit() {
  const { wide, X, W } = pitGeo(), d = fpData(), f = tav().fish, cx = X + W / 2;
  pitBg(X, W);
  text("THE PIT", wide ? X : cx, 7, 1, ORANGE, wide ? "left" : "center", null);
  if (wide) chipsAt(X + W, 7, "right");
  if (!f) {
    ["YOU NEED A RACER.", "THE CHIP SHOP SELLS", "DERBY FISH:", "200 CHIPS"].forEach((l, i) => text(l, cx, 70 + i * 12, 1, i === 3 ? GOLD : WHITE, "center", null));
    closeLine ? closeLine("TAP HERE TO GO BACK") : text("TAP HERE TO GO BACK", cx, 194, 1, WHITE, "center", null); return;
  }
  const hits = pitHits();
  for (const [id, x, y, w, h, v] of hits) {
    if (id === "tab") { const on = PIT.tab === v, t = PIT_TABS.find(q => q[0] === v); rect(on ? "#3a2a14" : "#20202a", x, y, w, h); outline(x, y, w, h, on ? ORANGE : "#3c3c4a"); text(wide ? t[2] : t[1], x + w / 2, y + 6, 1, on ? ORANGE : GREY, "center", null); }
    else if (id === "cup") {
      const c = FP_CUPS[v], open = fpCupOpen(v), md = d.cups[c.id] || 0, sel = PIT.cup === v, hidden = c.secret && !open;
      rect(sel ? "#2a2a3c" : "#1c1c26", x, y, w, h); outline(x, y, w, h, sel ? WHITE : "#3c3c4a");
      text(hidden ? "???" : c.name, x + 4, y + 6, 1, open ? WHITE : GREY, "left", null);
      disc(FP_MEDAL_COL[md], x + w - 9, y + 8, 4); if (md) text(FP_MEDALS[md][0], x + w - 9, y + 8, 1, INK, "center", null);
      const short = k => FP_TRACKS[k].name.replace(/^THE /, "").split(" ")[0];
      const sub = hidden ? (wide ? "WIN DEEP CUP GOLD" : "???") : !open ? (wide ? "BRONZE IN " + FP_CUPS[v - 1].name.replace(" CUP", "") + " FIRST" : "LOCKED") : c.tracks.map(short).join(wide ? " / " : " ");
      text(sub.slice(0, wide ? 32 : 18), x + 4, y + (wide ? 18 : 17), 1, open ? "#8c96c8" : "#5a5a6e", "left", null);
    }
    else if (id === "track") {
      const open = fpTrackOpen(v), sel = PIT.track === v, best = d.best[v];
      rect(sel ? "#2a2a3c" : "#1c1c26", x, y, w, h); if (sel) outline(x, y, w, h, WHITE);
      text(open ? FP_TRACKS[v].name.slice(0, 14) : "???", x + 3, y + h / 2, 1, open ? (v === "kelp" ? CYAN : WHITE) : "#5a5a6e", "left", null);
      if (open && best) text(best.toFixed(2), x + w - 3, y + h / 2, 1, GOLD, "right", null);
    }
    else if (id === "cat") { const on = PIT.cat === v; rect(on ? "#3a2a14" : "#20202a", x, y, w, h); outline(x, y, w, h, on ? ORANGE : "#3c3c4a"); text(FP_CATS[v][1], x + w / 2, y + 6, 1, on ? ORANGE : GREY, "center", null); }
    else if (id === "catp") text(v < 0 ? "<" : ">", x + w / 2, y + 6, 1, ORANGE, "center", null);
    else if (id === "look") {
      const cat = FP_CATS[PIT.cat][0], it = FP_LOOKS[cat][v], key = cat + "." + it[0], own = fpOwns(key), on = (d.eq[cat] || FP_LOOKS[cat][0][0]) === it[0], sel = PIT.sel === v;
      rect(sel ? "#2a2a3c" : "#1c1c26", x, y, w, h); if (sel) outline(x, y, w, h, WHITE);
      text(it[1].slice(0, wide ? 16 : 14), x + 3, y + h / 2, 1, on ? ORANGE : own ? WHITE : it[2] === null ? GOLD : "#a0a0b4", "left", null);
      text(on ? "ON" : own ? "" : it[2] === null ? "*" : it[2], x + w - 3, y + h / 2, 1, on ? ORANGE : it[2] === null ? GOLD : CHIP, "right", null);
    }
  }
  if (PIT.tab === "cups") {
    const c = FP_CUPS[PIT.cup], open = fpCupOpen(PIT.cup), md = d.cups[c.id] || 0;
    const rw = Object.values(FP_LOOKS).flatMap(l => l.filter(it => it[3] === c.id).map(it => it[1]));
    if (wide) {
      const px = X + 214; rect("#1c1c26", px, 34, 134, 100); outline(px, 34, 134, 100, "#3c3c4a");
      text(c.secret && !open ? "???" : c.name, px + 67, 42, 1, GOLD, "center", null);
      text("BEST: " + FP_MEDALS[md], px + 67, 54, 1, FP_MEDAL_COL[md], "center", null);
      text("GOLD WINS:", px + 67, 70, 1, "#8c96c8", "center", null);
      (c.secret && !open ? ["???"] : rw.concat([titleName(FP_CUP_TITLE[c.id])])).forEach((n, i) => text(n, px + 67, 80 + i * 10, 1, WHITE, "center", null));
      text("3 RACES. POINTS 10-8-6-5-4-3-2-1", X + 100, 160, 1, "#8c96c8", "center", null);
    } else text(open ? "GOLD: " + (rw[0] || "") : "LOCKED", cx, 146, 1, open ? GOLD : GREY, "center", null);
    const [, bx, by, bw, bh] = hits.find(q => q[0] === "race"); btn(bx, by, bw, bh, open ? "START CUP" : "LOCKED", open ? ORANGE : GREY);
  } else if (PIT.tab === "trial") {
    if (wide) { text("3 SHRIMP, NO RIVALS. RACE YOUR BEST-LAP GHOST", cx, 134, 1, "#8c96c8", "center", null); text("KELP CIRCUIT LAPS GO ON THE TAVERN BOARD", cx, 144, 1, CYAN, "center", null); }
    const [, bx, by, bw, bh] = hits.find(q => q[0] === "race"), ok = fpTrackOpen(PIT.track); btn(bx, by, bw, bh, ok ? "TIME TRIAL" : "LOCKED", ok ? ORANGE : GREY);
  } else if (PIT.tab === "garage") {
    const cat = FP_CATS[PIT.cat][0], it = FP_LOOKS[cat][PIT.sel], [lab, col, note] = pitLookState(cat, PIT.sel), look = Object.assign({}, d.eq, { [cat]: it[0] });
    if (!wide) text(FP_CATS[PIT.cat][1], cx, 37, 1, ORANGE, "center", null);
    if (wide) { const px = X + 214; rect("#1c1c26", px, 48, 134, 98); outline(px, 48, 134, 98, "#3c3c4a"); pitKartPreview(px + 67, 120, 60, look, cat === "pose" ? it[0] : ""); text(it[1], px + 67, 56, 1, WHITE, "center", null); text(note, px + 67, 138, 1, col, "center", null); }
    else { pitKartPreview(X + 100, 160, 28, look, cat === "pose" ? it[0] : ""); text(note.slice(0, 13), X + 2, 156, 1, col, "left", null); }
    const [, bx, by, bw, bh] = hits.find(q => q[0] === "act"); btn(bx, by, bw, bh, lab, col);
  } else {
    fitDraw(atlas, f.id, cx, 52, wide ? 80 : 50, 30, wide ? 2 : 1);
    text(f.name, cx, 74, 1, GOLD, "center", null);
    (wide ? ["SPEED: TOP SPEED", "STAMINA: PICK-UP, HITS", "BURST: BOOST POWER"] : ["SPEED", "STAMINA", "BURST"]).forEach((l, i) => { text(l, wide ? cx - 80 : X + 2, 92 + i * 16, 1, WHITE, "left", null); for (let k = 0; k < 10; k++) rect(k < f.lv[i] ? CHIP : "#3c2a1e", (wide ? cx - 80 : X + 2) + k * 7, 100 + i * 16, 6, 3); });
    text(d.races + " RACES  " + d.wins + " WINS", cx, 144, 1, "#8c96c8", "center", null);
    const [, bx, by, bw, bh] = hits.find(q => q[0] === "gym"); btn(bx, by, bw, bh, "TRAIN", ORANGE);
  }
  if (!wide) chipsLine ? (g.save(), g.translate(OX, 0), chipsLine(185), g.restore()) : 0;
  closeLine("TAP HERE TO GO BACK");
}
WIDE.pit = { draw: drawPit, tap: pitTap, key: pitKey };

// ---- victory poses (the podium after a race, and the garage)
function fpPose(kind, r, x, y, w, t, stand) {
  const h = w * 0.42; r.tilt = 0; r.hop = 0; r.yaw = 0;
  if (kind === "wave") r.tilt = Math.sin(t * 6) * 0.25;
  else if (kind === "spin") { r.yaw = Math.sin(t * 5); r.face = r.yaw > 0 ? 1 : -1; }
  else if (kind === "hop") { r.hop = Math.abs(Math.sin(t * 4)) * 1.2; y -= Math.abs(Math.sin(t * 4)) * w * 0.2; }
  fpKart(r, x, y, w, 0);
  if (kind === "wave") rect("#ffb46e", x + w * 0.35, y - h * 1.6 + Math.sin(t * 12) * w * 0.06, Math.max(1, w * 0.07), Math.max(2, w * 0.15));
  if (kind === "fireworks" || kind === "golden") for (let q = 0; q < 3; q++) { const u = (t * 0.7 + q / 3) % 1, fx = x + (q - 1) * w * 0.5, fy = y - w * (1 + u * 0.4); for (let k = 0; k < 8; k++) rect(["#ff5a5a", "#ffe650", "#78dcff"][q], fx + Math.cos(k * 0.8) * u * w * 0.3, fy + Math.sin(k * 0.8) * u * w * 0.3, 1, 1); }
  if (kind === "golden") { const cw = Math.max(6, w * 0.35); rect("#ffd23c", x - cw / 2, y - h * 2.6, cw, cw * 0.35); for (let q = 0; q < 3; q++) rect("#ffd23c", x - cw / 2 + q * cw * 0.42, y - h * 2.6 - cw * 0.3, Math.max(1, cw * 0.16), cw * 0.3); }
  r.tilt = 0; r.hop = 0;
}

window.FPX = { fpData, PIT, pitOpen, pitHits, pitAct, fpStartCup, fpNext, fpExit, FP_LOOKS, get KART() { return KART; }, FP_TUNE, FP_CREW, FP_TRACKS, FP_CUPS, FP_ORDER, get K() { return KART; }, startKart, FP, fpDist, fpTrack, kartUpdate,
  race(bot, track) {                        // simulate one whole race with a robot driving: -> stats
    startKart(true, bot, track); const K = KART; let off = 0, n = 0;
    while (!K.me.done && K.t < 400) { kartUpdate(1 / 60); K.racers.forEach(r => { if (!r.me) { n++; if (Math.abs(r.x) > 1) off++; } }); }
    const order = K.racers.slice().sort((a, b) => (a.done && b.done ? a.finishT - b.finishT : b.done - a.done || fpDist(b) - fpDist(a)));
    return { place: order.indexOf(K.me) + 1, time: K.me.finishT - 3.6, aiOff: off / n, first: order[0].done ? order[0].finishT - 3.6 : 0 };
  } };   // handy in the console and the tests
if (TEST_FP) { const w = setInterval(() => { if (S && atlas) { clearInterval(w); let k = null; try { k = new URLSearchParams(location.search).get("finprix"); } catch (e) {} startKart(true, null, FP_TRACKS[k] ? k : "kelp"); } }, 50); }   // the test link: ?finprix or ?finprix=<track>
