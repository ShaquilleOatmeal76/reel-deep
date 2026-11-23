// WRECKONING: the Doom-style arena shooter inside the sunken wrecks. Loaded after siege.js and uses game.js's globals.
// Plan: the project doc "Reel Deep plan - Wreckoning (FPS)". Classic Doom looks (pixel art, status bar, the face) with modern
// Doom moves (free look, aim down sights, dash, double jump, Scuttle finishers). Arena / horde: waves until you go down.
// The world is a grid of cells, each with its own floor and ceiling height, drawn by a column raycaster at 480x270
// (letterboxed like the Siege). game.js hands over while S.state === "wreck": update, draw, pointer, keys and resize.
// Art is made here: text pixel maps for sprites and small procedural textures. Nothing here touches score, coins or chips.
// Everything sits inside one function so its names can't clash with game.js; what game.js needs is put on window.
(() => {
"use strict";
const W = 480, H = 270, VH = 238, CY = 119, FOV = 0.85;   // view 480x238 above a 32 px status bar
const TEST = (() => { try { const q = new URLSearchParams(location.search); return q.has("wreck") ? (q.get("wreck") || "hold") : null; } catch (e) { return null; } })();   // ?wreck, ?wreck=tutorial
let WK = null;                                               // the run in progress (null when not in WRECKONING)

// ---------------------------------------------------------------------------------------------------- pixel art
const PAL = { k: [16, 14, 34], w: [226, 224, 206], b: [170, 168, 156], d: [110, 108, 104], r: [196, 60, 56], R: [120, 34, 40], o: [232, 120, 60], y: [250, 214, 96], Y: [255, 244, 170],
  g: [96, 146, 104], G: [52, 92, 72], n: [44, 54, 92], N: [26, 28, 50], m: [150, 160, 176], M: [90, 98, 118], p: [214, 180, 160], c: [110, 200, 214], t: [128, 86, 54], T: [84, 56, 38],
  a: [214, 170, 74], A: [140, 104, 44], e: [255, 90, 60], u: [118, 76, 138], U: [70, 44, 92], x: [250, 250, 250], l: [176, 124, 74] };
const BRIGHT = new Set(["Y", "e", "c"]);                    // these glow in the dark (eyes, lures, glass)
function pix(rows) { const w = Math.max(...rows.map(r => r.length)); return { w, h: rows.length, px: rows.map(r => r.padEnd(w, ".")) }; }
const SP = {
  crab: pix([".kk..............kk.", "krrk............krrk", "kRok....k..k....koRk", ".krrk..kxk.kxk.krrk.", "..krrk.kek.kek.krrk.", "...krrkkkkkkkkkrrk..", "....kooooooooooook..", "...kooroooooooroook.", "..koooooooooooooook.", "...kRRRRRRRRRRRRRk..", "..kr.kr.kr..kr.kr.rk", ".kr..r...r..r...r..rk"]),
  deck: pix([".....rrrrr......", "....rRrrrrrr....", "....rrrrrrrrR...", "....kwwwwwk..R..", "....wkkwkkw.....", "....wkewkew.....", "....wwwkwww.....", ".....wkkkw......", ".....wwwww......", "......kbk.......", "...nnnnnnnnn....", "..nNwnwnwnNn....", "..nnnwnwnnnn..m.", "..wnnwnwnnnw.mm.", "..w.nnnnnn.wmm..", "..w.NnnnnN.wm...", ".ww.nnnnnn.wa...", ".k..ntttTn..A...", "....nn..nn......", "....nN..nN......", "....b....b......", "....b....b......", "....b....b......", "...bb....bb.....", "..kkk....kkk...."]),
  musket: pix([".....kkkkkk.......", "...kkNNNNNNkk.....", "..kNNNaNNaNNNk....", ".kkkkkkkkkkkkkk...", "....kwwwwwk.......", "....wkkwkkw.......", "....wkewkew.......", "....wwwkwww.......", ".....wkkkw........", "......kbk.........", "...tttttttt.......", "..ttwtwtwtTt......", "..tttwtwtttt......", "kkMMMMMMMMMMMMMkkk", ".kTTTwtwtTTTTk....", "..w.tttttt.w......", "..w.ttttttt.w.....", "....nn..nn........", "....nN..nN........", "....b....b........", "....b....b........", "...bb....bb.......", "..kkk....kkk......"]),
  puffer: pix([".......k........", "...k...y...k....", "....kkkkkkk.....", "...kyyyyyyyk....", ".kkyykyyykyykk..", "..kyyekyyekyk...", "kkyyyyyyyyyyykk.", "..kyyyyyyyyyyk..", "..kyyykkkkyyyk..", ".kkyyyyyyyyyykk.", "...kyyyyyyyyk...", "....kkkkkkkk....", "...k...y...k....", ".......k........"]),
  angler: pix(["..........kk..........", ".........kYYk.........", ".........kYYk.........", "..........kk..........", "..........k...........", "...........k..........", "......kkkkkkkkk.......", "....kkUUUUUUUUUkk.....", "...kUUUuuuuuuuUUUk....", "..kUUueekuuuueekUUk...", "..kUUuekkuuuuekkuUk...", ".kUUuuuuuuuuuuuuuUUk..", ".kUkwkwkwkwkwkwkwkUk..", ".kUkRRRRRRRRRRRRRkUk..", ".kUkwRwRRRRRRRwRwkUk..", "..kUkkwkwkwkwkwkkUk...", "...kkUUUUUUUUUUUkk....", ".....kkkkkkkkkkk......"]),
  barrel: pix(["..kkkkkk..", ".kttttttk.", "kMMMMMMMMk", "kttTtttTtk", "kttTtttTtk", "kMMMMMMMMk", "kttTtttTtk", "kttTtttTtk", "kMMMMMMMMk", ".kttttttk.", "..kkkkkk.."]),
  lantern: pix(["...k...", "...k...", "..kak..", ".kaaak.", ".kYYYk.", ".kYYYk.", ".kYYYk.", ".kaaak.", "..kkk.."]),
  shot: pix(["kkkkkkkkkk", "kaaaaaaaak", "kttttttttk", "ktyyyyyytk", "kttttttttk", "kkkkkkkkkk"]),
  harp: pix([".m.........", "mmmTTTTTTTk", ".m.........", "...........", "..m........", ".mmmTTTTTTk", "..m........"]),
  tin: pix([".kkkkkkk.", "kmmmmmmmk", "kcccrcccM", "kccrrrccM", "kcccrcccM", "kMMMMMMMk", ".kkkkkkk."]),
  helmet: pix(["...kkkk...", ".kkaaaakk.", "kaaAccAaak", "kaAcccxcAk", "kaAccccAak", "kaaAccAaak", ".kkaaaakk.", ".kAAAAAAk."]),
  blunpick: pix(["kk..................", "kakkkkkkkkkkkk......", "kaaaaaaaaaaaaakkkkk.", "kaAAAAAAAAAAAAkttttk", "kakkkkkkkkkkkkkkttTk", "kk.............kkkk."]),
  orb: pix([".YYY.", "YYxYY", "YxxxY", "YYxYY", ".YYY."]),
  ball: pix([".k.", "kMk", ".k."]),
  bub: pix([".cc.", "c..c", "c..c", ".cc."]),
  bone: pix(["w..w", "wwww", "w..w"]),
  hammer: pix(["kkkkkkkkkkkkkkkkkkkkkk", "kmmmmmmmmmmmmmmmmmmmmk", "kekmmmmmmmmmmmmmmmmkek", "kkkkkmmmmmmmmmmmmkkkkk", "....kmmmmmmmmmmmmk....", "....kmmmmmmmmmmmmk....", ".....kmkwkwkwkwmk.....", ".....kmRRRRRRRRmk.....", ".....kmkwkwkwkwmk.....", "......kmmmmmmmmk......", "....kkkmmmmmmmmkkk....", "..kkmmmkmmmmmmkmmmkk..", ".kmmmk.kmmmmmmk.kmmmk.", ".kkk...kMmmmmMk...kkk.", "........kMmmMk........", ".........kMMk.........", "..........kk.........."]),
  brute: pix([".........kkkkkkkk...........", "........kGgggggggk..........", ".......kgkkgggkkgk..........", ".......kgkekgkekgk..........", ".......kggggkggggk..........", "........kgkwkwkgk...........", "........kgRRRRRgk...........", ".....kkkkkgggggkkkkk........", "...kkgggnnnnnnnnnngggkk.....", "..kgggnnnnnnnnnnnnnngggk....", ".kggg.nnNnnnnnnnNnn.gggk....", ".kgg..nnnnnnnnnnnnn..ggk....", ".kgg..nnnnnnnnnnnnn..ggkk...", ".kgg..nNnnnnnnnnnNn..ggkMk..", "kggg..nnnnnnnnnnnnn..gggMk..", "kggk..ntttttttttttn..kgkMk..", ".kk...nnnnnnnnnnnnn...kkMk..", "......nnnnn...nnnnn...kMMMk.", "......nnnnn...nnnnn..kMkMkMk", "......nnnnn...nnnnn..kM.M.Mk", "......nNnnn...nNnnn..kMMMMMk", "......GGGGG...GGGGG...kkkkk.", ".....kkkkkk...kkkkkk........"]),
  captain: pix([".........kkkkkkkkkk.........", ".......kkNNNNNNNNNNkk.......", ".....kkNNNNNNwwNNNNNNkk.....", "...kkNNNNNNNNwwNNNNNNNNkk...", "..kNNNNNNNNNNNNNNNNNNNNNNk..", "..kkkkkkkkkkkkkkkkkkkkkkkk..", "........kppppppppk..........", ".......kppkkppkkppk.........", ".......kppkeppkeppk.........", ".......kpppppppppppk........", ".......kpppkkkkpppk.........", ".......kuuuuuuuuuuk.........", "......kuukuukuukuuk.........", "......kuk.ku.kuk.uk.........", ".....kRRRRRRRRRRRRRRk.......", "....kRRRaRRRRRRRRaRRRk......", "...kRRRRRRRRRRRRRRRRRRk.....", "...kRRkRRRRaRRaRRRRkRRk.....", "...kRk.kRRRRRRRRRRk.kRk.....", "...km...kRRRRRRRRk...kpk....", "..kmm...kRRRRRRRRk...kpk....", "..km....kRRRRRRRRk...kpk....", "........kTTT..TTTk..........", "........kTTT..TTTk..........", ".......kkkkk..kkkkk........."]),
  twinpick: pix(["kk..................", "kakkkkkkkkkkkk......", "kaaaaaaaaaaaaakkkkk.", "kakkkkkkkkkkkkkttttk", "kaaaaaaaaaaaaakttTk.", "kakkkkkkkkkkkkkkkk..", "kk.................."]),
  rivetpick: pix(["..kkkkkkkkk.....", ".kMMMMMMMMMkkkkk", "kMmmmmmmmmMmmmmk", "kMmkkkkkmmMkkkk.", "kMmkaaakmmMk....", "kMmkkkkkmmMk....", ".kMMMMMMMMk.....", "..kkkkkkkk......"]),
  torppick: pix(["....kkkkkkkkkkkk....", "..kkMMMMMMMMMMMMkkk.", ".krrMmmmmmmmmmmmMMk.", "krrrMmmmmmmmmmmmMMMk", ".krrMmmmmmmmmmmmMMk.", "..kkMMMMMMMMMMMMkkk.", "....kkkkkkkkkkkk...."]),
  sonarpick: pix(["...kkkkkkkk...", "..kcccccccck..", ".kccxxxxxxcck.", ".kcxYYYYYYxck.", ".kcxYYYYYYxck.", ".kccxxxxxxcck.", "..kcccccccck..", "...kkkkkkkk...", ".....kMMk.....", "...kkMMMMkk..."]),
  rivets: pix(["kkkkkkkkkk", "kMMMMMMMMk", "kmkmkmkmkk", "kMMMMMMMMk", "kmkmkmkmkk", "kkkkkkkkkk"]),
  torps: pix([".kkkkkkkkk..", "krMMMMMMMMk.", ".kkkkkkkkk..", ".kkkkkkkkk..", "krMMMMMMMMk.", ".kkkkkkkkk.."]),
  charge: pix(["..kkk..", ".kcxck.", "kcxYxck", "kcYYYck", "kcxYxck", ".kcxck.", "..kkk.."]),
  modbox: pix([".kkkkkkkkkk.", "kAaaaaaaaaAk", "kaYaaaaaaYak", "kkkkkkkkkkkk", "kTttttttttTk", "kttttaattttk", "ktttkaaktttk", "kTttttttttTk", "kkkkkkkkkkkk"]),
  torp: pix(["..k..", ".krk.", "krYrk", ".krk.", "..k.."]),
  chain: pix([".kkkk.", "kMMMMk", "kMmkMk", "kMkmMk", "kMMMMk", ".kkkk."]),
  ring: pix(["..ccccc..", ".cxxxxxc.", "cxx...xxc", "cx.....xc", "cx.....xc", "cx.....xc", "cxx...xxc", ".cxxxxxc.", "..ccccc.."]),
  splash: pix(["c.x.c", "xcxcx"]),
  ember: pix([".o.", "oyo", ".o."]),
  shard: pix([".c.", "cxc", ".c."]),
  ringpt: pix(["..aaa..", ".aYYYa.", "aY...Ya", "aY...Ya", "aY...Ya", ".aYYYa.", "..aaa.."]),
  mark: pix(["..YYY..", "..YYY..", "..YYY..", "YYYYYYY", ".YYYYY.", "..YYY..", "...Y..."]),
  boom: pix(["..y.y..", ".yYyYy.", "yYxxxYy", ".YxxxY.", "yYxxxYy", ".yYyYy.", "..y.y.."]),
};

// ---------------------------------------------------------------------------------------------------- textures (32x32)
const TS = 32;
const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
function seededR(s) { return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function mkTex(fn, seed) {
  const r = new Uint8Array(TS * TS), gg = new Uint8Array(TS * TS), b = new Uint8Array(TS * TS), e = new Uint8Array(TS * TS), R = seededR(seed);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = fn(x, y, R), i = y * TS + x; r[i] = c[0]; gg[i] = c[1]; b[i] = c[2]; e[i] = c[3] ? 1 : 0; }
  return { r, g: gg, b, e };
}
const nz = (c, R, a) => { const n = (R() - 0.5) * a; return [cl(c[0] + n), cl(c[1] + n), cl(c[2] + n)]; };
function plank(x, y, R, base, rowH, rib) {
  const row = (y / rowH) | 0, jx = (row * 11 + 5) % 32;
  if (rib && x < 5) { if (x === 0) return [16, 14, 34]; if (x === 4) return [78, 84, 110]; return nz([40, 44, 70], R, 6); }
  if (y % rowH === rowH - 1) return [22, 24, 42];
  if (x === jx) return [24, 26, 46];
  if (x === (jx + 2) % 32 && y % rowH === 2) return [150, 130, 90];
  let c = row % 2 ? [base[0] + 4, base[1] + 4, base[2] + 6] : base;
  if (R() < 0.05) c = [c[0] + 12, c[1] + 12, c[2] + 12];
  if (y > 24 && R() < 0.08) return [60, 110, 100];
  return nz(c, R, 8);
}
const TEX = {
  hull: mkTex((x, y, R) => plank(x, y, R, [50, 58, 84], 8, 1), 1),
  port: mkTex((x, y, R) => { const dx = x - 16.5, dy = y - 15.5, d = Math.hypot(dx, dy);
    if (d < 8.5) { const t = (dy + 8) / 16, hi = dx < -2 && dy < -2 && d > 4 && d < 6.5; return hi ? [200, 250, 250, 1] : [cl(50 + 60 * (1 - t)), cl(120 + 80 * (1 - t)), cl(150 + 70 * (1 - t)), 1]; }
    if (d < 11) return d < 9.5 ? [140, 104, 44] : nz([214, 170, 74], R, 30); if (d < 12) return [16, 14, 34];
    return plank(x, y, R, [50, 58, 84], 8, 0); }, 2),
  crate: mkTex((x, y, R) => { if (x === 0 || y === 0 || x === 31 || y === 31) return [30, 22, 18]; if (x < 4 || y < 4 || x > 27 || y > 27) return nz([96, 70, 46], R, 10);
    if (Math.abs(x - y) < 2.5) return nz([110, 80, 52], R, 10); if ((x + y) % 8 === 0 && R() < 0.3) return [90, 64, 42]; return nz([140, 106, 70], R, 12); }, 3),
  iron: mkTex((x, y, R) => { const px = x % 16, py = y % 16; if (px === 0 || py === 0) return [30, 26, 30]; if ((px === 3 || px === 12) && (py === 3 || py === 12)) return [170, 120, 90];
    if (R() < 0.08) return [150, 86, 50]; return nz(x % 16 < 8 ? [92, 74, 72] : [104, 82, 78], R, 14); }, 4),
  step: mkTex((x, y, R) => plank(x, y, R, [66, 72, 98], 6, 0), 5),
  deck: mkTex((x, y, R) => plank(y, x, R, [58, 64, 92], 8, 0), 6),
  beam: mkTex((x, y, R) => { if (y < 6) { if (y === 0 || y === 5) return [16, 14, 34]; return nz([60, 50, 46], R, 8); } return plank(x, y, R, [34, 38, 60], 8, 0); }, 7),
  mast: mkTex((x, y, R) => { if ((y > 3 && y < 7) || (y > 23 && y < 27)) return y === 4 || y === 24 ? [120, 128, 150] : [66, 70, 90]; const sh = Math.sin(x / 31 * Math.PI); return nz([60 + 40 * sh, 46 + 30 * sh, 36 + 18 * sh], R, 10); }, 8),
};

// ---------------------------------------------------------------------------------------------------- arenas
// Each arena is a text grid, one character per cell. Floors and ceilings are in cells (1 cell is about a person's height).
const LEGEND = {
  "#": { solid: 1, w: "hull" }, "o": { solid: 1, w: "port" }, "I": { solid: 1, w: "iron" }, "m": { solid: 1, w: "mast" },
  ".": {}, "g": { f: 1.15 }, "1": { f: 0.29 }, "2": { f: 0.58 }, "3": { f: 0.86 },
  "c": { f: 0.5, w: "crate", ft: "crate" }, "C": { f: 1, w: "crate", ft: "crate" }, "h": { c: 9, hole: 1 },
};
const ARENAS = {
  hold: { name: "THE CARGO HOLD", ceil: 2.4,
    rows: ["#o##o##o##o##o##o##o##o#", "#gggggggggggggggggggggg#", "#gggggggggggggggggggggg#", "#gggggggggggggggggggggg#",
      "o.................33...o", "#.................22...#", "#.................11...#", "#...CC.................#",
      "#...Ccc...hhhh..m......o", "#.........hhhh.........#", "o.........hhhh......cC.o", "#.......m.hhhh.......C.#",
      "#..c............c......#", "o..............CC......o", "#......c...............#", "#......................#",
      "#......................#", "#o##o##o##IIII##o##o##o#"],
    start: [11.5, 15.5, -Math.PI / 2],
    lamps: [[6.5, 10.5, 1.95], [17.5, 12.5, 1.95], [12, 2.5, 2.05], [3, 15, 2]],
    spawns: [[3, 10], [20, 7], [12, 2], [22, 14], [2, 5], [14, 13], [6, 2], [19, 2], [2, 15], [21, 16]],
    picks: [["shot", 9.3, 13.2], ["tin", 19.5, 14.3], ["helmet", 5.5, 2.4], ["harp", 2.5, 8.5], ["tin", 12, 6.5], ["harp", 21.5, 5.5], ["ammo", 13.5, 15.5], ["ammo", 20.5, 2.5]],
    rings: [[9.1, 11.5, 2.1], [16.5, 9.1, 2.1], [11.5, 3.6, 2.2], [2.5, 7.5, 2.1]],          // grapple anchors (x, y, height) in open cells: on the masts and beams
    guns: [[12, 2.4], [4.5, 8.5], [19.5, 15.5], [16.5, 13.5], [12, 9.5]],                       // where guns 3-7 turn up (the blunderbuss first)
    mod: [6.5, 15.5],                                                                           // where mod crates turn up
    props: [["barrel", 2.4, 15.6], ["barrel", 2.6, 14.6], ["barrel", 21.5, 15.5], ["barrel", 14.5, 4.6], ["barrel", 1.6, 2.5], ["barrel", 8.5, 1.6]],
    gun: [12, 2.4] },
};
function buildArena(id) {
  const A = ARENAS[id], h = A.rows.length, w = A.rows[0].length, cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const L = LEGEND[A.rows[y][x]] || {};
    cells.push({ f: L.f || 0, c: L.c || A.ceil, solid: !!L.solid, w: L.w || "step", ft: L.ft || "deck", ct: "beam", hole: !!L.hole, L: 0.38 });
  }
  const lights = A.lamps.map(([x, y]) => [x, y, 1]);
  cells.forEach((c, i) => { if (c.hole) lights.push([i % w + 0.5, ((i / w) | 0) + 0.5, 0.12]); });
  cells.forEach((c, i) => { const cx = i % w + 0.5, cy = ((i / w) | 0) + 0.5; let L = 0.38;
    for (const [lx, ly, s] of lights) L += s * Math.max(0, 1 - Math.hypot(cx - lx, cy - ly) / 5.5) * 0.6;
    c.L = Math.min(1.35, L); });
  return { id, A, w, h, cells };
}
const cellAt = (x, y) => { const m = WK.map; x |= 0; y |= 0; return x < 0 || y < 0 || x >= m.w || y >= m.h ? m.cells[0] : m.cells[y * m.w + x]; };
const floorAt = (x, y) => cellAt(x, y).f;
const walkable = (a, b) => !b.solid && b.c - b.f > 0.8 && b.f - a.f < 0.56;   // enemies clamber up a half crate at most; any drop is fine

// ---------------------------------------------------------------------------------------------------- weapons and enemies
// dmg per pellet; spread in px from the centre of the screen (hip, aimed). Ammo kinds: harp (harpoons), shot.
const GUNS = [
  { id: "hook", name: "BOAT HOOK", melee: 1, rate: 0.45, dmg: 4, reach: 1.45 },
  { id: "pistol", name: "HARPOON PISTOL", ammo: "harp", rate: 0.34, pellets: 1, dmg: 3, spread: [2, 0.5] },
  { id: "blun", name: "BLUNDERBUSS", ammo: "shot", rate: 0.85, pellets: 8, dmg: 1, spread: [15, 4] },
  { id: "twin", name: "TWIN BLUNDERBUSS", ammo: "shot", use: 2, rate: 1.15, pellets: 16, dmg: 1, spread: [22, 8] },
  { id: "rivet", name: "RIVET GUN", ammo: "rivet", rate: 0.1, pellets: 1, dmg: 1, spread: [6, 2] },
  { id: "torp", name: "TORPEDO LAUNCHER", ammo: "torp", rate: 0.9, proj: "torp" },
  { id: "sonar", name: "SONAR CANNON", ammo: "charge", rate: 1.8, proj: "ring", warm: 0.45 },
];                                                            // append only: later parts save guns by position
const AMMO_MAX = { harp: 80, shot: 40, rivet: 200, torp: 16, charge: 3 };
const AMMO_NAME = { harp: "HARPOONS", shot: "SHOT", rivet: "RIVETS", torp: "TORPEDOES", charge: "CHARGE" };
const AMMO_PICK = { shot: ["shot", 12], rivet: ["rivets", 50], torp: ["torps", 3], charge: ["charge", 1] };   // pickup sprite, amount
const GUN_WAVE = [0, 0, 1, 4, 6, 8, 12];                     // the wave after which each gun turns up in the arena
const GUN_PICK = [null, null, "blunpick", "twinpick", "rivetpick", "torppick", "sonarpick"];
// alt-fire on R: the pistol's grapple is built in; the others come from mod crates found mid-run
const MODS = { pistol: "GRAPPLE", blun: "CHAIN SHOT", twin: "BROADSIDE", rivet: "SPIN-UP", torp: "LOCK-ON" };
const MOD_WAVES = [3, 5, 7, 9, 11, 13];                       // a mod crate after these waves (while there's a mod left to find)
const FLARE_CD = 10, GRAPPLE_CD = 2.5, FURY_T = 10;
// h: height (cells); hp in pellets; sp: speed (cells/s); pts; cost in a wave's budget; from: first wave it can appear
const FOES = {
  crab: { h: 0.42, hp: 3, sp: 1.6, pts: 50, cost: 1, from: 1, melee: [3, 0.8] },
  deck: { h: 0.98, hp: 8, sp: 1.0, pts: 100, cost: 2, from: 1, melee: [7, 1.2] },
  puffer: { h: 0.45, hp: 2, sp: 0.8, pts: 75, cost: 1.5, from: 2, fly: 0.5 },
  musket: { h: 0.98, hp: 7, sp: 0.7, pts: 150, cost: 3, from: 3, shoot: ["ball", 2.6, 4.2, 8], keep: 4.5 },
  angler: { h: 0.7, hp: 10, sp: 0.75, pts: 200, cost: 4, from: 4, fly: 1.05, shoot: ["orb", 3.1, 3.4, 11], keep: 3.5 },
  hammer: { h: 0.75, hp: 14, sp: 0.8, pts: 300, cost: 5, from: 5, fly: 0.55, charger: 1 },
  brute: { h: 1.45, hp: 40, sp: 0.6, pts: 500, cost: 8, from: 6, melee: [18, 1.6], wind: 0.6, slam: 1 },
  captain: { h: 1.6, hp: 220, sp: 0.8, pts: 3000, cost: 0, from: 999, melee: [20, 1.4], wind: 0.45, boss: 1 },
};
const STAGGER = 0.3;                                         // below 30% health an enemy staggers once: Scuttle it

// ---------------------------------------------------------------------------------------------------- sounds
Object.assign(SOUNDS, {
  wk_blun: [[110, 0.22, "sawtooth", 0.5, 40], [700, 0.05, "square", 0.3, 120]], wk_pistol: [[900, 0.05, "square", 0.25, 300], [220, 0.12, "triangle", 0.25, 120, 0.02]],
  wk_hook: [[300, 0.08, "triangle", 0.3, 160]], wk_hurt: [[160, 0.15, "square", 0.3, 90]], wk_die: [[140, 0.25, "sawtooth", 0.3, 50]],
  wk_pick: [[880, 0.05, "square", 0.2], [1320, 0.08, "square", 0.2, 0, 0.05]], wk_scut: [[90, 0.3, "sawtooth", 0.5, 40], [1200, 0.1, "square", 0.25, 400, 0.05]],
  wk_jump: [[300, 0.08, "sine", 0.2, 600]], wk_dash: [[500, 0.12, "sawtooth", 0.15, 1400]], wk_wave: [[110, 0.3, "sawtooth", 0.3], [165, 0.3, "sawtooth", 0.3, 0, 0.3], [220, 0.5, "sawtooth", 0.3, 0, 0.6]],
  wk_boom: [[80, 0.4, "sawtooth", 0.5, 30]], wk_rivet: [[700, 0.03, "square", 0.12, 400]], wk_torp: [[200, 0.25, "sawtooth", 0.25, 500]],
  wk_sonar: [[220, 0.5, "sine", 0.4, 1800], [110, 0.6, "sawtooth", 0.3, 40, 0.1]], wk_grap: [[1200, 0.12, "square", 0.15, 300]], wk_flare: [[300, 0.35, "sawtooth", 0.25, 900]],
  wk_fury: [[110, 0.6, "sawtooth", 0.4, 55], [220, 0.6, "square", 0.25, 110, 0.05], [440, 0.5, "triangle", 0.2, 880, 0.1]], wk_swing: [[200, 0.15, "sawtooth", 0.25, 60]],
  wk_roar: [[90, 0.5, "sawtooth", 0.45, 50], [60, 0.6, "square", 0.3, 40, 0.2]], wk_shard: [[1600, 0.04, "square", 0.12]], wk_crate: [[660, 0.1, "square", 0.2], [880, 0.1, "square", 0.2, 0, 0.1], [1320, 0.2, "square", 0.2, 0, 0.2]], wk_shoot: [[500, 0.1, "square", 0.15, 200]], wk_click: [[1500, 0.02, "square", 0.15]],
});

// ---------------------------------------------------------------------------------------------------- starting a run
function newPlayer(A) {
  return { x: A.start[0], y: A.start[1], a: A.start[2], pitch: 0, feet: 0, vz: 0, jumps: 0, hp: 100, ar: 0, ammo: { harp: 30, shot: 0, rivet: 0, torp: 0, charge: 0 },
    guns: [true, true, false, false, false, false, false], gun: 1, want: 1, swap: 0, mods: {}, flareT: 0, grapT: 0, altT: 0, spin: false, fury: 0, furyT: 0, kx: 0, ky: 0, zip: null, warm: 0,
    ads: 0, adsOn: false, adsToggle: false, kick: 0, fireT: 0, flash: 0, bob: 0, hurt: 0, dashT: 0, dashN: 2, dashR: 0, dvx: 0, dvy: 0, lunge: null, mvx: 0, mvy: 0, dead: false };
}
function startWreck(id, opts) {
  opts = opts || {};
  if (!ARENAS[id]) id = "hold";
  const map = buildArena(id);
  S.state = "wreck"; S.overlay = null;
  WK = { id, map, test: !!opts.test, t: 0, P: newPlayer(map.A), foes: [], shots: [], puffs: [], picks: [], wave: 0, phase: "intro", phaseT: 2.5, budget: 0, spawnT: 0,
    kills: 0, score: 0, combo: 1, comboT: 0, shake: 0, msg: "", msgT: 0, banner: "", bannerT: 0, field: null, fly: null, fieldT: 0, paused: false, result: null,
    keys: new Set(), fireHeld: false, touch: {}, dots: [], gunPick: null,
    mine: [], quakes: [], modDue: false, boss: null, bossDue: false, intro: null,
    st: { turn: 0, look: 0, walk: 0, dashes: 0, kills: 0, scut: 0, hooks: 0, farPuff: 0, grapples: 0, flares: 0, shards: 0, chain: 0, furies: 0, furyKills: 0 }, tut: opts.tut ? { i: -1, t: 0, s0: null, tg: [] } : null };
  if (WK.tut) { WK.phase = "tutorial"; WK.phaseT = 0; }
  for (let i = 0; i < 140; i++) WK.dots.push([Math.random() * map.w, Math.random() * map.h, Math.random() * 2.3]);
  WK.P.feet = floorAt(WK.P.x, WK.P.y);
  refreshPicks();
  wreckResize();
  banner(map.A.name, 2.5);
  play("select");
}
function leaveWreck() {
  if (document.pointerLockElement && document.exitPointerLock) try { document.exitPointerLock(); } catch (e) { /* ignore */ }
  WK = null; canvas.style.cursor = ""; newDive(); resize(); play("back");
}
function wreckResize() {                                      // always 480x270: letterboxed on screens of other shapes
  canvas.width = W; canvas.height = H;
  canvas.style.height = "min(100dvh, " + (100 * H / W) + "vw)"; canvas.style.aspectRatio = W + " / " + H;
  g.imageSmoothingEnabled = false;
}
function banner(s, t) { WK.banner = s; WK.bannerT = t || 2.5; }
function say(s) { WK.msg = s; WK.msgT = 1.6; }
function refreshPicks() {                                     // pickups come back between waves
  if (WK.tut) return;                                           // the tutorial hands out its own
  const P = WK.P, kinds = ["shot", "rivet", "torp", "charge"].filter(k => GUNS.some((q, i) => P.guns[i] && q.ammo === k));
  WK.picks = WK.map.A.picks.map(([k, x, y], i) => {               // "ammo" spots hold ammo for one of your guns
    if (k !== "ammo") return { k, x, y };
    if (!kinds.length) return { k: "harp", x, y };
    const a = kinds[(WK.wave + i) % kinds.length]; if (a === "charge" && (WK.wave + i) % 3) return { k: "harp", x, y };   // charge cells are rare
    return { k: AMMO_PICK[a][0], x, y, n: AMMO_PICK[a][1] };
  });
  for (let i = 2; i < GUNS.length; i++) if (!P.guns[i] && WK.wave >= GUN_WAVE[i]) { const [x, y] = WK.map.A.guns[(i - 2) % WK.map.A.guns.length]; WK.picks.push({ k: GUN_PICK[i], x, y, gun: i }); }
  if (WK.modDue) { const [x, y] = WK.map.A.mod; WK.picks.push({ k: "modbox", x, y }); }
}
function modsLeft() { const P = WK.P; return GUNS.map((q, i) => i).filter(i => P.guns[i] && MODS[GUNS[i].id] && GUNS[i].id !== "pistol" && !P.mods[GUNS[i].id]); }

// ---------------------------------------------------------------------------------------------------- waves
function nextWave() {
  WK.wave++; WK.phase = "fight";
  WK.budget = 5 + WK.wave * 2.4; WK.spawnT = 0.5;
  if (WK.wave % 10 === 0) {                                      // every 10th wave: the Drowned Captain, with a smaller crew
    WK.budget = 4 + WK.wave; WK.intro = { name: "THE DROWNED CAPTAIN", sub: "SCOURGE OF THE SUNKEN FLEET", t: 3.4 }; WK.bossDue = true; play("wk_roar");
  } else { banner("WAVE " + WK.wave, 2.2); play("wk_wave"); }
  if (WK.wave === 2 && !WK.P.guns[2]) say("A BLUNDERBUSS ON THE GALLERY!");
}
function pickFoe() {
  const open = Object.keys(FOES).filter(k => FOES[k].from <= WK.wave && FOES[k].cost <= WK.budget + 0.01);
  if (!open.length) return null;
  const wts = open.map(k => ({ crab: 3, deck: 3, puffer: 1.5, musket: 1.6, angler: 1.2, hammer: 1, brute: 0.7 })[k] || 1);
  let r = Math.random() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < open.length; i++) { r -= wts[i]; if (r <= 0) return open[i]; }
  return open[0];
}
function spawnSpot() {                                         // a spawn point well away from you
  const P = WK.P, far = WK.map.A.spawns.filter(([x, y]) => Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) > 6);
  const list = far.length ? far : WK.map.A.spawns;
  const [x, y] = list[(Math.random() * list.length) | 0];
  return [x + 0.5, y + 0.5];
}
function addFoe(t, x, y) {
  const E = FOES[t], k = 1 + 0.06 * Math.max(0, WK.wave - 1);
  const f = { t, x, y, z: floorAt(x, y), hp: Math.ceil(E.hp * k), max: Math.ceil(E.hp * k), hit: 0, ph: Math.random() * 6, cd: 1 + Math.random() * 2, atk: 0, stag: 0, staged: false, sx: null, born: 0.6 };
  WK.foes.push(f);
  for (let i = 0; i < 6; i++) WK.puffs.push({ k: "bub", x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, z: f.z + Math.random() * 0.8, vz: 0.6, t: 0.8 });
  return f;
}
function waveTick(dt) {
  if (WK.phase === "tutorial") { tutTick(dt); return; }
  if (WK.phase === "intro") { WK.phaseT -= dt; if (WK.phaseT <= 0) nextWave(); return; }
  if (WK.phase === "break") { WK.phaseT -= dt; if (WK.phaseT <= 0) nextWave(); return; }
  const cap = 8 + Math.floor(WK.wave / 2);
  if (WK.intro) { WK.intro.t -= dt; if (WK.intro.t > 0) return; WK.intro = null; }
  if (WK.bossDue) {                                               // the Captain steps out of the farthest spawn
    WK.bossDue = false; const P = WK.P; let best = null, bd = -1;
    for (const [x, y] of WK.map.A.spawns) { const d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y); if (d > bd && Math.abs(floorAt(x + 0.5, y + 0.5) - 0) < 0.1) { bd = d; best = [x + 0.5, y + 0.5]; } }
    const c = addFoe("captain", best[0], best[1]); c.boss = true; WK.boss = c;
  }
  WK.spawnT -= dt;
  if (WK.budget > 0.5 && WK.spawnT <= 0 && WK.foes.length < cap) {
    const t = pickFoe();
    if (t) { WK.budget -= FOES[t].cost; const [x, y] = spawnSpot(); addFoe(t, x, y); }
    else WK.budget = 0;
    WK.spawnT = Math.max(0.35, 1.3 - WK.wave * 0.06);
  }
  if (WK.budget <= 0.5 && !WK.foes.length && !WK.bossDue) {
    const bonus = 250 * WK.wave * (WK.wave % 10 === 0 ? 3 : 1); WK.score += bonus; WK.boss = null;
    if (MOD_WAVES.includes(WK.wave) && modsLeft().length) WK.modDue = true;
    WK.phase = "break"; WK.phaseT = 6; banner("WAVE " + WK.wave + " CLEAR  +" + bonus, 3); play("fanfare");
    refreshPicks();
  }
}

// ---------------------------------------------------------------------------------------------------- the tutorial
// A guided first run in the Cargo Hold before any waves: one move at a time, with training targets that don't fight back.
// Later parts add steps for what they add (the grapple, the flare, Fury...). ?wreck=tutorial on the test link; the pause
// menu has TUTORIAL (or SKIP TUTORIAL). Enter skips it. Each step: [text, second line, phone text, setup(), done(st, st0)].
function spotAhead(r, sameFloor) {                               // an open spot about r cells in front of you, in sight
  const P = WK.P;
  for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, 3.14]) for (const rr of [r, r * 0.75, r * 1.25, r * 0.5]) {
    const x = P.x + Math.cos(P.a + da) * rr, y = P.y + Math.sin(P.a + da) * rr, c = cellAt(x, y);
    if (c.solid || (sameFloor && Math.abs(c.f - P.feet) > 0.1) || !sightLine(P.x, P.y, P.feet + 0.55, x, y, c.f + 0.5)) continue;
    return [(x | 0) + 0.5, (y | 0) + 0.5];
  }
  return [P.x + Math.cos(P.a), P.y + Math.sin(P.a)];
}
function dummy(t, x, y, hp) { const f = addFoe(t, x, y); f.dummy = true; if (hp) f.hp = f.max = hp; WK.tut.tg.push(f); return f; }
const TUT = [
  ["LOOK AROUND WITH THE MOUSE", "UP AND DOWN TOO", "DRAG ON THE RIGHT SIDE TO LOOK", null, (s, s0) => s.turn - s0.turn > 2.5 && s.look - s0.look > 40],
  ["MOVE WITH W A S D", "", "DRAG ON THE LEFT SIDE TO MOVE", null, (s, s0) => s.walk - s0.walk > 5],
  ["SPACE JUMPS. PRESS IT AGAIN IN THE AIR TO DOUBLE JUMP", "GET UP ON THE TALL CRATES", "JUMP, THEN JUMP AGAIN IN THE AIR", () => { WK.tut.mark = [4.5, 7.5, 1.3]; },
    () => floorAt(WK.P.x, WK.P.y) === 1 && WK.P.feet > 0.95],
  ["SHIFT DASHES. YOU HAVE TWO. DASH TWICE", "THEY COME BACK IN A SECOND", "TAP DASH TWICE", null, (s, s0) => s.dashes - s0.dashes >= 2],
  ["CLIMB THE STAIRS AND GRAB THE BLUNDERBUSS", "", "", () => { const [x, y] = WK.map.A.gun; WK.picks.push({ k: "blunpick", x, y }); WK.tut.mark = [x, y, 1.6]; }, () => WK.P.guns[2]],
  ["LEFT CLICK FIRES. SINK THE THREE TARGETS", "", "HOLD ON THE RIGHT SIDE TO FIRE", () => { for (const [x, y] of [[8.5, 9.5], [12.5, 13.5], [15.5, 9.5]]) dummy("deck", x, y); WK.P.ammo.shot = Math.max(WK.P.ammo.shot, 20); },
    () => WK.tut.tg.every(f => !WK.foes.includes(f))],
  ["HOLD RIGHT CLICK TO AIM DOWN THE SIGHTS", "HIT THE FAR TARGET WHILE AIMING: TIGHTER SHOTS, SLOWER FEET", "TAP AIM, THEN SHOOT THE FAR TARGET", () => { const [x, y] = spotAhead(8, false); dummy("deck", x, y); },
    () => { const f = WK.tut.tg[0]; if (!WK.foes.includes(f)) { if (f.adsHit) return true; WK.tut.redo = true; say("AIM FIRST! RIGHT CLICK, THEN FIRE"); } return false; }],
  ["HURT ONE UNTIL IT FLASHES ORANGE", "THEN PRESS E UP CLOSE TO SCUTTLE IT: HEALTH, AMMO, DOUBLE POINTS", "THEN TAP E UP CLOSE", () => { const [x, y] = spotAhead(3.5, true); dummy("deck", x, y, 22); },
    (s, s0) => { if (s.scut > s0.scut) return true; if (!WK.foes.includes(WK.tut.tg[0])) { WK.tut.redo = true; say("TOO MUCH! STOP WHEN IT FLASHES, THEN E"); } return false; }],
  ["PRESS 1 FOR THE BOAT HOOK. HOOK ONE", "A HOOK KILL SPILLS AMMO. SWITCH GUNS WITH 1-3 OR THE WHEEL", "TAP GUN FOR THE HOOK, THEN HOOK IT", () => { const [x, y] = spotAhead(2.5, true); dummy("crab", x, y); },
    (s, s0) => { if (s.hooks > s0.hooks) return true; if (!WK.foes.includes(WK.tut.tg[0])) { WK.tut.redo = true; say("WITH THE HOOK! PRESS 1"); } return false; }],
  ["R WITH THE HARPOON PISTOL: GRAPPLE", "AIM AT A GOLD RING (OR AN ENEMY) AND ZIP TO IT", "TAP ALT WITH THE PISTOL TO GRAPPLE", () => { swapTo(1); const r = WK.map.A.rings[0]; WK.tut.mark = [r[0], r[1], r[2] + 0.3]; },
    (s, s0) => s.grapples > s0.grapples],
  ["G FIRES A FLARE. SET THIS ONE ALIGHT", "THEN SHOOT IT: BURNING ENEMIES SHED ARMOR", "TAP FLARE, THEN SHOOT IT", () => { const [x, y] = spotAhead(3, true); dummy("deck", x, y, 40); WK.P.ar = 0; WK.P.flareT = 0; },
    (s, s0) => { if (s.shards - s0.shards >= 3) return true; if (!WK.foes.includes(WK.tut.tg[0])) { if (s.shards > s0.shards) return true; WK.tut.redo = true; say("FLARE IT FIRST, THEN SHOOT IT"); } return false; }],
  ["MOD CRATES GIVE A GUN AN ALT-FIRE ON R", "GRAB THE CRATE, THEN FIRE THE BLUNDERBUSS CHAIN SHOT", "GRAB THE CRATE, THEN TAP ALT", () => { const [x, y] = spotAhead(2, true); WK.picks.push({ k: "modbox", x, y, mod: "blun" }); WK.P.ammo.shot = Math.max(WK.P.ammo.shot, 12); },
    (s, s0) => s.chain > s0.chain],
  ["KILLS FILL YOUR FURY BAR. WHEN IT'S FULL PRESS V", "DAVY JONES' FURY: A GHOST TRIDENT, AND NOTHING CAN HURT YOU", "TAP FURY", () => { WK.P.fury = 100; for (const d of [2.2, 3, 2.6]) { const [x, y] = spotAhead(d, true); dummy("crab", x, y); } },
    (s, s0) => s.furyKills - s0.furyKills >= 3 || (WK.P.furyT <= 0 && s.furies > s0.furies && !WK.tut.tg.some(f => WK.foes.includes(f)))],
  ["PUFFER MINES BURST. SHOOT IT BEFORE IT GETS CLOSE", "", "", () => { const [x, y] = spotAhead(7, false); dummy("puffer", x, y); },
    (s, s0) => { if (s.farPuff > s0.farPuff) return true; if (!WK.foes.includes(WK.tut.tg[0])) { WK.tut.redo = true; say("TOO CLOSE! SHOOT IT FROM AFAR"); } return false; }],
  ["TINS OF FISH HEAL. DIVING HELMETS ARE ARMOR", "GRAB BOTH", "", () => { const P = WK.P; P.hp = 60; const a = spotAhead(2, true), b = spotAhead(3, true);
      WK.picks.push({ k: "tin", x: a[0] - 0.25, y: a[1] }, { k: "helmet", x: b[0] + 0.25, y: b[1] }); },
    () => WK.picks.filter(p => p.k === "tin" || p.k === "helmet").every(p => p.got)],
  ["THAT'S EVERYTHING. NOW SURVIVE THE WAVES!", "", "", null, () => WK.tut.t > 3],
];
function tutGo(i) {
  const T = WK.tut; T.i = i; T.t = 0; T.s0 = Object.assign({}, WK.st); T.mark = null; T.redo = false;
  for (const f of T.tg) { const k = WK.foes.indexOf(f); if (k >= 0) WK.foes.splice(k, 1); }
  T.tg = [];
  if (TUT[i][3]) TUT[i][3]();
}
function tutTick(dt) {
  const T = WK.tut; T.t += dt;
  if (T.i < 0) { if (T.t > 1.2) tutGo(0); return; }
  if (T.redo) { T.redo = false; tutGo(T.i); return; }               // a target went down the wrong way: set it up again
  if (T.wait) { T.wait -= dt; if (T.wait <= 0) { T.wait = 0; if (T.i + 1 < TUT.length) tutGo(T.i + 1); else tutEnd(); } return; }
  if (TUT[T.i][4](WK.st, T.s0)) { T.wait = T.i + 1 < TUT.length ? 0.9 : 0.01; T.mark = null; if (T.i + 1 < TUT.length) { say("NICE!"); play("wk_pick"); } }
}
function tutEnd() {                                              // straight into a real run, mouse still locked
  const test = WK.test; startWreck(WK.id, { test });
}
function drawTut() {
  const T = WK.tut, st = TUT[T.i], tch = WK.touch.on, s1 = tch && st[2] ? st[2] : st[0], s2 = tch && st[2] ? "" : st[1];
  const w = Math.max(s1.length, s2.length) * 6 + 16, x = (W - w) / 2, y = 60, h = s2 ? 30 : 20;
  g.globalAlpha = 0.75; rect("#0a0e1e", x, y, w, h); g.globalAlpha = 1; rect(GOLD, x, y, w, 1);
  text(s1, W / 2, y + 9, 1, T.wait ? LIME : WHITE); if (s2) text(s2, W / 2, y + 21, 1, "#aadcff");
  text("TUTORIAL " + (T.i + 1) + "/" + TUT.length, 6, 8, 1, GOLD, "left"); text(tch ? "PAUSE MENU: SKIP" : "ENTER: SKIP", W - 6, 8, 1, "#96a0c8", "right");
}

// ---------------------------------------------------------------------------------------------------- the flow field
// Walkers follow a breadth-first distance map from your cell (steps up of 0.36 at most), so they use the stairs and go
// round crates. Swimmers (the angler, the puffer) get one that ignores heights. Rebuilt a few times a second.
function buildField(fly) {
  const m = WK.map, n = m.w * m.h, d = new Int16Array(n).fill(-1), q = new Int32Array(n);
  const s = ((WK.P.y | 0) * m.w + (WK.P.x | 0)); d[s] = 0; q[0] = s; let qh = 0, qt = 1;
  while (qh < qt) {
    const i = q[qh++], x = i % m.w, y = (i / m.w) | 0, a = m.cells[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const j = ny * m.w + nx, b = m.cells[j]; if (d[j] >= 0 || b.solid) continue;
      if (!fly && !walkable(b, a)) continue;                  // can a foe walk from b to a (towards you)?
      d[j] = d[i] + 1; q[qt++] = j;
    }
  }
  return d;
}
function fieldDir(f, fly) {                                    // which way to go from here
  const m = WK.map, d = fly ? WK.fly : WK.field, x = f.x | 0, y = f.y | 0, me = d[y * m.w + x], here = m.cells[y * m.w + x];
  const can = (cx, cy) => { const v = d[cy * m.w + cx]; return v >= 0 && (fly || walkable(here, m.cells[cy * m.w + cx])); };
  if (me <= 1) return null;
  let best = null, bd = me < 0 ? 1e9 : me;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
    const v = d[ny * m.w + nx]; if (v >= bd || !can(nx, ny)) continue;
    if (dx && dy && (!can(nx, y) || !can(x, ny))) continue;   // no corner cutting...
    if (dx && dy && !fly && (Math.abs(m.cells[y * m.w + nx].f - here.f) > 0.3 || Math.abs(m.cells[ny * m.w + x].f - here.f) > 0.3)) continue;   // ...or diagonals past a drop (off the stairs)
    bd = v; best = [nx + 0.5, ny + 0.5];
  }
  return best;
}
function sightLine(ax, ay, az, bx, by, bz) {                  // a clear line between two points (for shooters)
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.2);
  for (let i = 1; i < n; i++) { const k = i / n, c = cellAt(ax + (bx - ax) * k, ay + (by - ay) * k), z = az + (bz - az) * k; if (c.solid || c.f > z || c.c < z) return false; }
  return true;
}

// ---------------------------------------------------------------------------------------------------- the player
function canGo(x, y) { const c = cellAt(x, y); return !c.solid && c.c - c.f > 0.8 && c.f - WK.P.feet < 0.36; }
function move(dx, dy) {
  const P = WK.P, r = 0.22, nx = P.x + dx, ny = P.y + dy, ox = P.x, oy = P.y;
  if (canGo(nx + Math.sign(dx) * r, P.y + r * 0.7) && canGo(nx + Math.sign(dx) * r, P.y - r * 0.7)) P.x = nx;
  if (canGo(P.x + r * 0.7, ny + Math.sign(dy) * r) && canGo(P.x - r * 0.7, ny + Math.sign(dy) * r)) P.y = ny;
  WK.st.walk += Math.hypot(P.x - ox, P.y - oy);
}
function jump() { const P = WK.P; if (P.dead || P.jumps >= 2) return; P.vz = P.jumps ? 3.3 : 3.7; P.jumps++; play("wk_jump"); }
function dash() {
  const P = WK.P; if (P.dead || P.dashN < 1 || P.dashT > 0) return;
  P.dashN--; P.dashT = 0.16; let mx = P.mvx, my = P.mvy; if (!mx && !my) { mx = Math.cos(P.a); my = Math.sin(P.a); }
  const l = Math.hypot(mx, my); P.dvx = mx / l; P.dvy = my / l; play("wk_dash"); WK.st.dashes++;
}
function hurtMe(dmg) {
  const P = WK.P; if (P.dead || P.lunge || P.furyT > 0) return;   // nothing touches you during Fury
  if (P.ar > 0) { const a = Math.min(P.ar, Math.ceil(dmg / 3)); P.ar -= a; dmg -= a; }
  P.hp = Math.max(0, P.hp - dmg); P.hurt = 1; WK.shake = Math.max(WK.shake, 0.2); play("wk_hurt");
  if (P.hp <= 0) die();
}
function die() {
  const P = WK.P; P.dead = true; P.adsOn = false; WK.fireHeld = false;
  WK.result = { wave: WK.wave, kills: WK.kills, score: WK.score, t: 0 };
  play("wk_die");
}
function swapTo(i) { const P = WK.P; if (!P.guns[i] || P.gun === i || P.dead) return; P.want = i; P.swap = 0.25; play("wk_click"); }
function cycle(dir) { const P = WK.P; for (let k = 1; k <= GUNS.length; k++) { const i = (P.want + dir * k + GUNS.length * 4) % GUNS.length; if (P.guns[i]) { swapTo(i); return; } } }
function hitAt(sx, sy) {                                       // the nearest enemy drawn at this screen pixel (behind no wall)
  let best = null;
  for (const f of WK.foes) { if (!f.sx) continue; const [x0, x1, yt, yb, ty] = f.sx;
    if (sx < x0 || sx >= x1 || sy < yt || sy >= yb) continue;
    const cc = WK.clips[sx]; let k = 0; while (k + 1 < cc.length && cc[k + 1][0] < ty) k++;
    if (sy < cc[k][1] || sy >= cc[k][2]) continue;
    if (!best || ty < best.sx[4]) best = f; }
  return best;
}
function wallPoint() {                                          // where the centre of the screen meets a wall (for puffs)
  const P = WK.P, cc = WK.clips[W >> 1]; const d = Math.min(12, cc[cc.length - 1][0] || 12) - 0.1;
  return [P.x + Math.cos(P.a) * d, P.y + Math.sin(P.a) * d];
}
function fire() {
  const P = WK.P; if (P.dead || P.fireT > 0 || P.swap > 0 || P.lunge || P.zip) return;
  if (P.furyT > 0) { trident(); return; }
  const G = GUNS[P.gun], use = G.use || 1;
  if (G.ammo && P.ammo[G.ammo] < use) {                          // empty: click, then swap to the best gun with ammo (the hook if none)
    P.fireT = 0.3; play("wk_click"); say("OUT OF " + AMMO_NAME[G.ammo]); P.warm = 0;
    for (let i = GUNS.length - 1; i >= 0; i--) if (P.guns[i] && (!GUNS[i].ammo || P.ammo[GUNS[i].ammo] >= (GUNS[i].use || 1))) { swapTo(i); break; }
    return; }
  if (G.warm && P.warm < G.warm) return;                          // the sonar cannon hums up first (hold the trigger)
  const spin = G.id === "rivet" && P.spin && P.mods.rivet;
  P.fireT = spin ? 0.045 : G.rate; P.kick = G.id === "rivet" ? 0.3 : 1; P.warm = 0;
  if (G.melee) {                                                // the boat hook: a short swing at whatever's in front
    play("wk_hook");
    let best = null, bd = G.reach;
    for (const f of WK.foes) { const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy); if (d > bd) continue;
      let da = Math.atan2(dy, dx) - P.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 0.6 && Math.abs(f.z - P.feet) < 1.2) { bd = d; best = f; } }
    if (best) { best.hooked = true; hurtFoe(best, G.dmg, 0.25); best.hooked = false; }
    return;
  }
  P.ammo[G.ammo] -= use; P.flash = 1;
  if (G.proj) { launch(G.proj); return; }
  shoot(G.pellets, G.dmg, G.spread[P.ads > 0.5 ? 1 : 0] * (spin ? 1.6 : 1));
  WK.shake = Math.max(WK.shake, G.pellets > 8 ? 0.3 : G.pellets > 1 ? 0.18 : 0.04); P.pitch = Math.min(85, P.pitch + (G.pellets > 8 ? 5 : G.pellets > 1 ? 3 : 0.6));
  play(G.id === "blun" || G.id === "twin" ? "wk_blun" : G.id === "rivet" ? "wk_rivet" : "wk_pistol");
  if (G.id === "twin") push(-Math.cos(P.a) * 2, -Math.sin(P.a) * 2);
}
function shoot(n, dmg, spr) {                                    // hitscan pellets at random points within the spread
  const P = WK.P, hits = new Map();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, r = i ? Math.sqrt(Math.random()) * spr : Math.random() * spr * 0.3;
    const sx = clamp(Math.round(W / 2 + Math.cos(a) * r), 0, W - 1), sy = Math.round(CY + Math.sin(a) * r * 0.8);
    const f = hitAt(sx, sy); if (f) hits.set(f, (hits.get(f) || 0) + dmg);
  }
  if (!hits.size) { const [x, y] = wallPoint(); WK.puffs.push({ k: "bub", x, y, z: P.feet + 0.5 + P.pitch / 300, vz: 0.4, t: 0.6 }); }
  for (const [f, d] of hits) { if (P.ads > 0.5) f.adsHit = true; hurtFoe(f, d, 0.06, true); }
}
function aimDir() {                                              // where the centre of the screen points, as a 3D direction
  const P = WK.P, kz = FOV / (1 + P.ads * 0.75), SC = (W / 2) / kz;
  return [Math.cos(P.a), Math.sin(P.a), P.pitch / SC];
}
function launch(k, opts) {                                       // your projectiles: torpedoes, chain shot, the sonar ring
  const P = WK.P, [dx, dy, dz] = aimDir(), z = P.feet + 0.5;
  const o = Object.assign({ k, x: P.x + dx * 0.3, y: P.y + dy * 0.3, z, t: 4 }, opts || {});
  const sp = k === "torp" ? 8 : k === "chain" ? 7 : 5;
  o.vx = dx * sp; o.vy = dy * sp; o.vz = dz * sp + (k === "chain" ? 1.5 : 0);
  if (k === "ring") { o.t = 3; o.hits = new Set(); play("wk_sonar"); WK.shake = 0.4; }
  else play(k === "torp" ? "wk_torp" : "wk_blun");
  WK.mine.push(o);
  return o;
}
function mineTick(o, dt) {
  const P = WK.P;
  if (o.home && WK.foes.includes(o.home)) {                      // lock-on: steer toward the target
    const f = o.home, tx = f.x - o.x, ty = f.y - o.y, tz = f.z + FOES[f.t].h * 0.5 - o.z, l = Math.hypot(tx, ty, tz) || 1, sp = Math.hypot(o.vx, o.vy, o.vz);
    o.vx += (tx / l * sp - o.vx) * Math.min(1, dt * 5); o.vy += (ty / l * sp - o.vy) * Math.min(1, dt * 5); o.vz += (tz / l * sp - o.vz) * Math.min(1, dt * 5);
  }
  if (o.k === "chain") o.vz -= 6 * dt;
  if (o.stuck) { o.fuse -= dt; if (o.stuck !== true && WK.foes.includes(o.stuck)) { o.x = o.stuck.x; o.y = o.stuck.y; o.z = o.stuck.z + 0.5; } if (o.fuse <= 0) { boom(o.x, o.y, o.z, 1.7, 12, 0.5); o.t = 0; } return; }
  const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt, nz = o.z + o.vz * dt, c = cellAt(nx, ny);
  const wall = c.solid || nz < c.f || nz > c.c;
  if (o.k === "ring") {                                          // the sonar ring rolls through everything in its path, then bursts
    for (const f of WK.foes.slice()) if (!o.hits.has(f) && Math.hypot(f.x - o.x, f.y - o.y) < 1.4) { o.hits.add(f); hurtFoe(f, 25, 0.2, true); }
    o.t -= dt; if (wall || o.t <= 0) { sonarBlast(o); o.t = 0; return; }
    o.x = nx; o.y = ny; o.z = nz; return;
  }
  const hit = WK.foes.find(f => Math.hypot(f.x - nx, f.y - ny) < 0.45 && nz > f.z - 0.1 && nz < f.z + FOES[f.t].h + 0.1);
  if (o.k === "chain" && (hit || wall)) { o.stuck = hit || true; o.fuse = 0.8; if (wall) { o.vz = 0; } play("wk_click"); return; }
  if (hit || wall) { boom(o.x, o.y, o.z, o.mini ? 1.1 : 1.8, o.mini ? 8 : 14, o.mini ? 0.3 : 0.5); o.t = 0; return; }
  o.x = nx; o.y = ny; o.z = nz; o.t -= dt; if (o.t <= 0) boom(o.x, o.y, o.z, 1.8, 14, 0.5);
}
function sonarBlast(o) {                                         // the burst: everything you can see nearby takes a hit
  WK.puffs.push({ k: "ring", x: o.x, y: o.y, z: o.z - 0.4, vz: 0, t: 0.5, big: 1 });
  WK.shake = 0.7; play("wk_boom"); say("SONAR BLAST!");
  const P = WK.P;
  for (const f of WK.foes.slice()) if (Math.hypot(f.x - P.x, f.y - P.y) < 10 && sightLine(P.x, P.y, P.feet + 0.55, f.x, f.y, f.z + FOES[f.t].h * 0.5)) hurtFoe(f, 20, 0.25, true);
}
function boom(x, y, z, r, dmg, self) {                           // an explosion: hurts everything close, can throw you (rocket jumps)
  WK.puffs.push({ k: "boom", x, y, z, vz: 0, t: 0.35 });
  play("wk_boom"); WK.shake = Math.max(WK.shake, 0.4);
  const P = WK.P, d = Math.hypot(P.x - x, P.y - y, (P.feet + 0.4 - z) * 0.8);
  if (d < r) { const k = 1 - d / r; if (!WK.tut) hurtMe(Math.round(dmg * self * k)); const a = Math.atan2(P.y - y, P.x - x); push(Math.cos(a) * 5 * k, Math.sin(a) * 5 * k); if (z < P.feet + 0.6) { P.vz = Math.max(P.vz, 6 * k); P.jumps = 1; } }
  for (const o of WK.foes.slice()) { const e = Math.hypot(o.x - x, o.y - y); if (e < r) hurtFoe(o, Math.max(1, Math.round(dmg * (1 - e / r * 0.6))), 0.12, true); }
}
function push(vx, vy) { const P = WK.P; P.kx += vx; P.ky += vy; }
function altFire(down) {                                         // R: the gun's mod (the pistol's grapple is built in)
  const P = WK.P; if (P.dead || P.lunge || P.zip || P.swap > 0) return;
  const G = GUNS[P.gun];
  if (G.id === "rivet") { if (!P.mods.rivet) { if (down) say("NO MOD YET: FIND A MOD CRATE"); return; } P.spin = down; return; }
  if (!down) return;
  if (P.furyT > 0) return;
  if (G.id === "pistol") { grapple(); return; }
  if (!MODS[G.id]) { say(G.id === "hook" ? "THE HOOK HAS NO MOD" : "NO MOD FOR THIS ONE"); return; }
  if (!P.mods[G.id]) { say("NO MOD YET: FIND A MOD CRATE"); return; }
  if (P.altT > 0) { play("wk_click"); return; }
  if (G.id === "blun") { if (P.ammo.shot < 2) { say("OUT OF SHOT"); return; } P.ammo.shot -= 2; launch("chain"); P.altT = 3.5; WK.st.chain++; }
  else if (G.id === "twin") { if (P.ammo.shot < 4) { say("NEED 4 SHOT"); return; } P.ammo.shot -= 4; P.flash = 1; P.kick = 1.5; shoot(34, 1, P.ads > 0.5 ? 14 : 26); play("wk_blun"); play("wk_boom");
    WK.shake = 0.6; push(-Math.cos(P.a) * 6, -Math.sin(P.a) * 6); P.altT = 4; say("BROADSIDE!"); }
  else if (G.id === "torp") { if (P.ammo.torp < 3) { say("NEED 3 TORPEDOES"); return; } const f = hitAt(W >> 1, CY) || lockTarget(); if (!f) { say("NOTHING TO LOCK ON TO"); return; }
    P.ammo.torp -= 3; for (let i = 0; i < 3; i++) { const o = launch("torp", { home: f, mini: 1, t: 4 }); const a = (i - 1) * 0.5; o.vx = Math.cos(P.a + a) * 6; o.vy = Math.sin(P.a + a) * 6; } P.altT = 3; say("LOCKED ON!"); }
}
function lockTarget() {                                          // the enemy nearest the crosshair, if one is close to it
  let best = null, bd = 30;
  for (const f of WK.foes) { if (!f.sx) continue; const [x0, x1, yt, yb] = f.sx, cx = (x0 + x1) / 2, cy = (yt + yb) / 2, d = Math.hypot(cx - W / 2, cy - CY); if (d < bd) { bd = d; best = f; } }
  return best;
}
function grapple() {                                             // hook an enemy or a gold ring and zip to it
  const P = WK.P;
  if (P.grapT > 0) { play("wk_click"); return; }
  const f = hitAt(W >> 1, CY) || lockTarget();
  if (f && Math.hypot(f.x - P.x, f.y - P.y) < 12) { P.zip = { f, t: 0.6 }; P.grapT = GRAPPLE_CD; play("wk_grap"); WK.st.grapples++; return; }
  const [dx, dy] = aimDir(); let best = null, bd = 0.25;
  for (const r of WK.map.A.rings) { const ox = r[0] - P.x, oy = r[1] - P.y, d = Math.hypot(ox, oy); if (d > 13 || d < 1) continue;
    const aa = Math.atan2(oy, ox) - P.a, da = Math.abs(Math.atan2(Math.sin(aa), Math.cos(aa))), up = Math.atan2(r[2] - P.feet - 0.55, d), pa = Math.atan2(P.pitch, 280);
    const score = da + Math.abs(up - pa) * 0.6; if (score < bd && sightLine(P.x, P.y, P.feet + 0.6, r[0], r[1], r[2] - 0.1)) { bd = score; best = r; } }
  if (best) { P.zip = { r: best, t: 0.9 }; P.grapT = GRAPPLE_CD; play("wk_grap"); WK.st.grapples++; return; }
  say("NOTHING TO GRAPPLE"); play("wk_click");
}
function zipTick(dt) {                                           // being reeled in along the grapple line
  const P = WK.P, z = P.zip; z.t -= dt;
  const tx = z.f ? z.f.x : z.r[0], ty = z.f ? z.f.y : z.r[1], tz = z.f ? z.f.z + 0.2 : z.r[2] - 0.55;
  const vx = tx - P.x, vy = ty - P.y, d = Math.hypot(vx, vy);
  if (z.f && !WK.foes.includes(z.f)) { P.zip = null; return; }
  const sp = 15 * dt;
  if (d > (z.f ? 0.9 : 0.45)) {                                  // fly straight along the line (it was clear when you fired it)
    const k = Math.min(1, sp / d); P.x += vx * k; P.y += vy * k;
    P.feet += (Math.max(P.feet, tz) - P.feet) * Math.min(1, dt * 10); P.vz = 0;
  }
  if (d <= (z.f ? 0.9 : 0.45) || z.t <= 0) {
    if (cellAt(P.x, P.y).solid) { P.x -= vx / (d || 1) * 0.5; P.y -= vy / (d || 1) * 0.5; }   // never end up inside a wall
    if (z.f) { hurtFoe(z.f, 4, 0.2, true); P.vz = 2.5; WK.shake = 0.3; play("wk_hook"); }
    else { P.vz = 3; P.jumps = 1; }                              // let go at the ring with a little hop
    P.zip = null;
  }
}
function flare() {                                               // G: set everything in front of you alight; burning enemies shed armour
  const P = WK.P; if (P.dead || P.zip) return;
  if (P.flareT > 0) { play("wk_click"); return; }
  P.flareT = FLARE_CD; play("wk_flare"); P.flash = 1;
  for (let i = 0; i < 14; i++) { const a = P.a + (Math.random() - 0.5) * 0.9, r = 0.6 + Math.random() * 3.5; WK.puffs.push({ k: "ember", x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: P.feet + 0.3 + Math.random() * 0.5, vz: 0.6, t: 0.7 }); }
  let n = 0;
  for (const f of WK.foes) { const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy); if (d > 4.8) continue;
    let da = Math.atan2(dy, dx) - P.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.5 && sightLine(P.x, P.y, P.feet + 0.5, f.x, f.y, f.z + 0.3)) { f.burn = 6; n++; } }
  WK.st.flares++;
  if (!n) say("NOTHING CAUGHT FIRE");
}
function shed(f, n) {                                            // armour shards fly out of a burning enemy
  for (let i = 0; i < n; i++) WK.picks.push({ k: "shard", x: f.x + (Math.random() - 0.5) * 0.8, y: f.y + (Math.random() - 0.5) * 0.8, life: 10, shard: 1 });
}
function fury() {                                                // V: Davy Jones' Fury
  const P = WK.P; if (P.dead || P.fury < 100 || P.furyT > 0) return;
  P.fury = 0; P.furyT = FURY_T; P.adsOn = false; P.spin = false; WK.shake = 0.8; play("wk_fury"); banner("DAVY JONES' FURY!", 2); WK.st.furies++;
}
function trident() {                                             // the ghost trident: a wide sweep that sinks nearly anything
  const P = WK.P; P.fireT = 0.35; P.kick = 1; play("wk_swing");
  let n = 0;
  for (const f of WK.foes.slice()) { const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy); if (d > 2.7) continue;
    let da = Math.atan2(dy, dx) - P.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.85 && Math.abs(f.z - P.feet) < 1.6) { hurtFoe(f, FOES[f.t].boss ? 18 : 40, 0.2, true); n++; } }
  if (n) WK.shake = Math.max(WK.shake, 0.3);
}
function hurtFoe(f, dmg, flash, mine) {
  if (!WK.foes.includes(f)) return;
  f.hp -= dmg; f.hit = flash || 0.06;
  if (f.burn > 0 && mine && Math.random() < 0.45) shed(f, 1);      // hit a burning enemy: armour
  if (f.hp <= 0) { killFoe(f, false); return; }
  const E = FOES[f.t];
  if (E.boss) { for (const k of [0.66, 0.33]) if (f.hp <= f.max * k && !f["st" + k]) { f["st" + k] = true; f.stag = 3; } return; }
  if (!f.staged && f.hp <= Math.max(1, Math.ceil(f.max * STAGGER))) { f.stag = 3; f.staged = true; }
}
function killFoe(f, fin) {
  const E = FOES[f.t], i = WK.foes.indexOf(f); if (i < 0) return;
  if (E.boss && fin) {                                           // Scuttling the Captain: a big chunk, not a kill
    f.hp -= Math.round(f.max * 0.15); f.stag = 0; WK.P.hp = Math.min(100, WK.P.hp + 20); WK.shake = 0.6; say("SCUTTLED!"); play("wk_scut"); WK.st.scut++;
    if (f.hp > 0) return; fin = false;
  }
  WK.foes.splice(i, 1);
  for (let k = 0; k < (fin ? 14 : 8) * (E.boss ? 4 : 1); k++) { const b = k % 2 === 1; WK.puffs.push({ k: b ? "bone" : "bub", x: f.x + (Math.random() - 0.5) * 0.3 * (E.boss ? 3 : 1), y: f.y + (Math.random() - 0.5) * 0.3 * (E.boss ? 3 : 1), z: f.z + Math.random() * E.h,
    vz: b ? 1 + Math.random() * 1.5 : 0.4 + Math.random() * 0.5, vx: b ? (Math.random() - 0.5) * 2 : 0, vy: b ? (Math.random() - 0.5) * 2 : 0, t: 1.2 }); }
  WK.combo = WK.comboT > 0 ? Math.min(8, WK.combo + 1) : 1; WK.comboT = 3;
  WK.score += E.pts * WK.combo * (fin ? 2 : 1); WK.kills++;
  WK.st.kills++; if (fin) WK.st.scut++; if (f.hooked) WK.st.hooks++; if (f.t === "puffer" && Math.hypot(f.x - WK.P.x, f.y - WK.P.y) > 2.2) WK.st.farPuff++;
  const P = WK.P;
  if (P.furyT > 0) WK.st.furyKills++;
  else P.fury = Math.min(100, P.fury + (fin ? 12 : 0) + E.pts / 25);
  if (f.t === "puffer") boom(f.x, f.y, f.z, 1.7, 20, 1);
  if (f.burn > 0) shed(f, 3);
  const drop = (k, n) => WK.picks.push({ k, x: f.x + (Math.random() - 0.5) * 0.4, y: f.y + (Math.random() - 0.5) * 0.4, n, life: 20 });
  if (f.hooked && !fin) {                                        // the boat hook spills ammo, for every gun you carry
    drop("harp", 6); for (const a of ["shot", "rivet", "torp"]) if (GUNS.some((q, j) => P.guns[j] && q.ammo === a)) drop(AMMO_PICK[a][0], Math.ceil(AMMO_PICK[a][1] / 3));
    say("HOOKED! AMMO"); }
  else if (f.t === "deck" && Math.random() < 0.4) drop("harp", 5);
  else if (f.t === "musket" && Math.random() < 0.5) drop(P.guns[2] ? "shot" : "harp", P.guns[2] ? 4 : 6);
  else if (f.t === "brute") { drop("tin", 0); if (P.guns[5]) drop("torps", 2); }
  if (fin) { P.hp = Math.min(100, P.hp + 15); P.ammo.shot = Math.min(AMMO_MAX.shot, P.ammo.shot + (P.guns[2] ? 3 : 0)); P.ammo.harp = Math.min(AMMO_MAX.harp, P.ammo.harp + 4);
    WK.shake = 0.5; say("SCUTTLED!"); play("wk_scut"); }
  else play("wk_die", 0.6);
  if (E.boss) { banner("THE CAPTAIN IS SUNK!", 3); WK.shake = 1; play("fanfare"); for (let k = 0; k < 4; k++) drop(["tin", "helmet", "charge", "torps"][k], k > 1 ? 2 : 0); }
}
function pop(f) { boom(f.x, f.y, f.z, 1.7, 20, 1); }
function scuttleTarget() {
  const P = WK.P; let best = null, bd = 2.4;
  for (const f of WK.foes) { if (f.stag <= 0) continue; const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd && Math.abs(f.z - P.feet) < 1.3) { bd = d; best = f; } }
  return best;
}
function scuttle() { const P = WK.P, f = scuttleTarget(); if (!f || P.lunge || P.dead) return; P.lunge = { f, t: 0.2 }; }
function pickTick(dt) {
  const P = WK.P;
  for (const p of WK.picks) if (p.life !== undefined) { p.life -= dt; if (p.life <= 0) p.got = true; }   // dropped ammo sinks away after a while
  for (const p of WK.picks) {
    if (p.shard && !p.got && Math.hypot(p.x - P.x, p.y - P.y) < 2.2) { const a = Math.atan2(P.y - p.y, P.x - p.x); p.x += Math.cos(a) * 4 * dt; p.y += Math.sin(a) * 4 * dt; }   // shards fly to you
    if (p.got || Math.hypot(p.x - P.x, p.y - P.y) > 0.55 || Math.abs(floorAt(p.x, p.y) - P.feet) > 0.6) continue;
    if (p.k === "tin") { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + 25); say("TIN OF FISH +25"); }
    else if (p.k === "helmet") { if (P.ar >= 100) continue; P.ar = Math.min(100, P.ar + 35); say("DIVING HELMET +35 ARMOR"); }
    else if (p.k === "shot") { if (!P.guns[2] || P.ammo.shot >= AMMO_MAX.shot) continue; const n = p.n || 12; P.ammo.shot = Math.min(AMMO_MAX.shot, P.ammo.shot + n); say("SHOT +" + n); }
    else if (p.k === "harp") { if (P.ammo.harp >= AMMO_MAX.harp) continue; const n = p.n || 15; P.ammo.harp = Math.min(AMMO_MAX.harp, P.ammo.harp + n); say("HARPOONS +" + n); }
    else if (p.k === "blunpick") { P.guns[2] = true; P.ammo.shot = Math.max(P.ammo.shot, 16); swapTo(2); banner("BLUNDERBUSS!", 2); }
    else if (p.gun) { const i = p.gun, G = GUNS[i]; P.guns[i] = true; P.ammo[G.ammo] = Math.min(AMMO_MAX[G.ammo], P.ammo[G.ammo] + (G.ammo === "shot" ? 16 : G.ammo === "rivet" ? 120 : G.ammo === "torp" ? 6 : 2)); swapTo(i); banner(G.name + "!", 2); }
    else if (p.k === "rivets" || p.k === "torps" || p.k === "charge") { const a = p.k === "rivets" ? "rivet" : p.k === "torps" ? "torp" : "charge", n = p.n || AMMO_PICK[a][1];
      if (!GUNS.some((q, j) => P.guns[j] && q.ammo === a) || P.ammo[a] >= AMMO_MAX[a]) continue; P.ammo[a] = Math.min(AMMO_MAX[a], P.ammo[a] + n); say(AMMO_NAME[a] + " +" + n); }
    else if (p.k === "shard") { if (P.ar >= 100) continue; P.ar = Math.min(100, P.ar + 4); WK.st.shards++; p.got = true; play("wk_shard"); continue; }
    else if (p.k === "modbox") { const left = p.mod ? [GUNS.findIndex(q => q.id === p.mod)] : modsLeft(); if (!left.length) { p.got = true; continue; }
      const i = left[(Math.random() * left.length) | 0], id = GUNS[i].id; P.mods[id] = true; WK.modDue = false; banner(MODS[id] + " FOR THE " + GUNS[i].name, 3); say("PRESS R WITH IT"); play("wk_crate"); swapTo(i); p.got = true; continue; }
    p.got = true; play("wk_pick");
  }
}

// ---------------------------------------------------------------------------------------------------- the simulation
function sim(dt) {
  const P = WK.P; WK.t += dt;
  if (P.la !== undefined) { WK.st.turn += Math.abs(P.a - P.la); WK.st.look += Math.abs(P.pitch - P.lp); } P.la = P.a; P.lp = P.pitch;
  P.ads += ((P.adsOn && !P.dead && !GUNS[P.gun].melee ? 1 : 0) - P.ads) * Math.min(1, dt * 14);
  let mvx = 0, mvy = 0; const fx = Math.cos(P.a), fy = Math.sin(P.a), k = WK.keys;
  if (!P.dead) {
    if (k.has("KeyW")) { mvx += fx; mvy += fy; } if (k.has("KeyS")) { mvx -= fx; mvy -= fy; }
    if (k.has("KeyA")) { mvx += fy; mvy -= fx; } if (k.has("KeyD")) { mvx -= fy; mvy += fx; }
    const T = WK.touch; if (T.move) { const [ax, ay] = T.move.v; mvx += fx * -ay + -fy * ax; mvy += fy * -ay + fx * ax; }
    const turn = P.ads > 0.5 ? 1.2 : 2.4;
    if (k.has("ArrowLeft")) P.a -= turn * dt; if (k.has("ArrowRight")) P.a += turn * dt;
    if (k.has("ArrowUp")) P.pitch = Math.min(85, P.pitch + 120 * dt); if (k.has("ArrowDown")) P.pitch = Math.max(-85, P.pitch - 120 * dt);
  }
  P.mvx = mvx; P.mvy = mvy;
  const sp = (P.ads > 0.5 ? 1.6 : 2.9) * (P.furyT > 0 ? 1.25 : 1) * (P.spin && GUNS[P.gun].id === "rivet" ? 0.6 : 1) * dt;
  if (P.kx || P.ky) { move(P.kx * dt, P.ky * dt); const fr = Math.max(0, 1 - dt * 6); P.kx *= fr; P.ky *= fr; if (Math.abs(P.kx) + Math.abs(P.ky) < 0.05) P.kx = P.ky = 0; }   // knockback
  if (P.zip) zipTick(dt);
  else if (P.lunge) {
    const f = P.lunge.f, vx = f.x - P.x, vy = f.y - P.y, d = Math.hypot(vx, vy); P.lunge.t -= dt;
    if (d > 0.6) move(vx / d * 9 * dt, vy / d * 9 * dt);
    if (P.lunge.t <= 0 || d <= 0.6) { P.lunge = null; if (WK.foes.includes(f)) killFoe(f, true); }
  } else if (P.dashT > 0) { P.dashT = Math.max(0, P.dashT - dt); move(P.dvx * 11 * dt, P.dvy * 11 * dt); }
  else if (mvx || mvy) { const l = Math.max(1, Math.hypot(mvx, mvy)); move(mvx / l * sp, mvy / l * sp); if (!P.vz) P.bob += dt * (P.ads > 0.5 ? 5 : 9); }
  if (P.dashN < 2) { P.dashR += dt; if (P.dashR > 1.3) { P.dashR = 0; P.dashN++; } }
  const gnd = floorAt(P.x, P.y);
  if (P.zip) { /* the line holds you up */ }
  else if (P.vz || P.feet > gnd + 0.001) { P.vz -= 11 * dt; P.feet += P.vz * dt; if (P.feet <= gnd) { P.feet = gnd; P.vz = 0; P.jumps = 0; } }
  else { P.feet += (gnd - P.feet) * Math.min(1, dt * 14); P.jumps = 0; }
  if (P.ammo.harp < 10) { P.harpT = (P.harpT || 0) + dt; if (P.harpT > 1.5) { P.harpT = 0; P.ammo.harp++; } }   // never fully dry: harpoons trickle back up to 10
  if (P.swap > 0) { P.swap -= dt; if (P.swap <= 0.125 && P.gun !== P.want) P.gun = P.want; }
  const trig = WK.fireHeld || (WK.touch.look && WK.touch.look.fire);
  if (GUNS[P.gun].warm && trig && P.ammo.charge > 0 && !P.furyT) { if (P.warm === 0) play("wk_grap", 0.5); P.warm += dt; } else if (!trig) P.warm = 0;   // the sonar cannon hums while held
  if (trig) fire();
  P.flareT = Math.max(0, P.flareT - dt); P.grapT = Math.max(0, P.grapT - dt); P.altT = Math.max(0, P.altT - dt);
  if (P.furyT > 0) { P.furyT -= dt; P.dashN = 2; if (P.furyT <= 0) { P.furyT = 0; say("THE FURY FADES"); } }
  P.fireT = Math.max(0, P.fireT - dt); P.flash = Math.max(0, P.flash - dt * 8); P.hurt = Math.max(0, P.hurt - dt * 1.5); P.kick = Math.max(0, P.kick - dt * 5);
  WK.shake = Math.max(0, WK.shake - dt); WK.msgT = Math.max(0, WK.msgT - dt); WK.bannerT = Math.max(0, WK.bannerT - dt);
  WK.comboT -= dt; if (WK.comboT <= 0) WK.combo = 1;
  if (!P.dead) pickTick(dt);
  if (WK.picks.some(p => p.got && p.life !== undefined)) WK.picks = WK.picks.filter(p => !(p.got && p.life !== undefined));
  WK.fieldT -= dt; if (WK.fieldT <= 0 || !WK.field) { WK.field = buildField(false); WK.fly = buildField(true); WK.fieldT = 0.25; }
  for (const f of WK.foes.slice()) foeTick(f, dt);
  for (const o of WK.mine.slice()) mineTick(o, dt);
  WK.mine = WK.mine.filter(o => o.t > 0);
  for (const q of WK.quakes) {                                   // a Brute's slam: a ring along the floor. Jump it.
    q.r += 4.2 * dt; const d = Math.hypot(P.x - q.x, P.y - q.y);
    if (!q.done && Math.abs(d - q.r) < 0.35 && P.feet - floorAt(P.x, P.y) < 0.15 && Math.abs(floorAt(P.x, P.y) - q.f) < 0.3) { q.done = true; hurtMe(q.dmg); push((P.x - q.x) / d * 4, (P.y - q.y) / d * 4); }
  }
  WK.quakes = WK.quakes.filter(q => q.r < q.max);
  for (const o of WK.shots) { o.x += o.vx * dt; o.y += o.vy * dt; o.z += (o.dz || 0) * dt; o.t -= dt; const c = cellAt(o.x, o.y); if (c.solid || c.f > o.z || c.c < o.z) o.t = 0;
    if (!P.dead && Math.hypot(o.x - P.x, o.y - P.y) < 0.32 && o.z > P.feet - 0.1 && o.z < P.feet + 0.9) { o.t = 0; hurtMe(o.dmg); } }
  WK.shots = WK.shots.filter(o => o.t > 0);
  for (const p of WK.puffs) { p.t -= dt; if (p.k === "bone" || p.k === "ember" && p.vx) { p.vz -= 4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } p.z = Math.max(floorAt(p.x, p.y), p.z + p.vz * dt); }
  WK.puffs = WK.puffs.filter(p => p.t > 0);
  for (const d of WK.dots) { d[2] += dt * 0.06; if (d[2] > 2.3) d[2] = 0; d[0] += Math.sin(WK.t + d[1]) * dt * 0.03; }
  if (!P.dead) waveTick(dt);
  if (WK.result) WK.result.t += dt;
}
function chargerTick(f, E, dt, d, vx, vy, sees) {               // the Hammerhead: lines up, then charges in a straight line
  const P = WK.P;
  if (f.charge > 0) {
    f.charge -= dt; const nx = f.x + f.cvx * dt, ny = f.y + f.cvy * dt, c = cellAt(nx, ny);
    if (c.solid || c.c - c.f < 0.6) { f.charge = 0; f.stag = 1.6; WK.shake = Math.max(WK.shake, 0.3); play("wk_boom", 0.5); say("IT HIT THE WALL! SCUTTLE IT"); return true; }   // stunned: Scuttle-able
    f.x = nx; f.y = ny;
    if (Math.hypot(P.x - f.x, P.y - f.y) < 0.7 && Math.abs(f.z - P.feet - 0.3) < 0.9) { f.charge = 0; hurtMe(15); push(f.cvx * 0.8, f.cvy * 0.8); f.cd = 2; }
    return true;
  }
  if (f.wind > 0) { f.wind -= dt; if (f.wind <= 0) { f.charge = 1.7; f.cvx = f.tx * 6.5; f.cvy = f.ty * 6.5; play("wk_dash"); } return true; }
  f.cd -= dt;
  if (sees && d < 9 && d > 1.5 && f.cd <= 0) { f.wind = 0.65; f.tx = vx / d; f.ty = vy / d; f.cd = 2.8; play("wk_roar", 0.35); return true; }
  return false;                                                  // otherwise it swims about like the others
}
function captainTick(f, dt, d, sees) {                           // the Drowned Captain: pistol volleys, calls his crew, blinks away
  const P = WK.P; f.vt = (f.vt || 0) - dt; f.sum = (f.sum === undefined ? 8 : f.sum) - dt; f.blink = (f.blink === undefined ? 9 : f.blink) - dt;
  if (f.volley > 0 && f.vt <= 0) { f.volley--; f.vt = 0.18; const z0 = f.z + 1.1, a = Math.atan2(P.y - f.y, P.x - f.x) + (Math.random() - 0.5) * 0.12;
    WK.shots.push({ k: "ball", x: f.x, y: f.y, z: z0, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, t: 5, dmg: 8, dz: (P.feet + 0.45 - z0) / (d / 4.5) }); play("wk_pistol", 0.6); }
  if (!f.volley && sees && d > 2 && (f.cd -= 0) <= 0 && f.vt <= -2.2) { f.volley = 3; f.vt = 0; }
  if (f.sum <= 0) { f.sum = 15; say("ALL HANDS!"); for (let k = 0; k < 3; k++) { const a = k * 2.1, x = f.x + Math.cos(a), y = f.y + Math.sin(a); if (!cellAt(x, y).solid) addFoe("deck", x, y); } }
  if (f.hp < f.max * 0.5 && f.blink <= 0) { f.blink = 9; for (let k = 0; k < 10; k++) WK.puffs.push({ k: "bub", x: f.x + (Math.random() - 0.5) * 0.6, y: f.y + (Math.random() - 0.5) * 0.6, z: f.z + Math.random() * 1.5, vz: 0.6, t: 0.8 });
    const [x, y] = spawnSpot(); f.x = x; f.y = y; f.born = 0.4; play("wk_grap"); }
}
function foeTick(f, dt) {
  const E = FOES[f.t], P = WK.P;
  f.ph += dt * (f.t === "crab" ? 3 : 1.3); f.hit = Math.max(0, f.hit - dt); f.born = Math.max(0, f.born - dt);
  if (f.burn > 0) {                                               // burning: slow damage, flickers of flame
    f.burn -= dt; f.bt = (f.bt || 0) + dt;
    if (f.bt > 0.5) { f.bt = 0; if (f.hp > 1) { f.hp -= 0.5; f.hit = 0.03; } WK.puffs.push({ k: "ember", x: f.x + (Math.random() - 0.5) * 0.3, y: f.y + (Math.random() - 0.5) * 0.3, z: f.z + Math.random() * E.h, vz: 0.8, t: 0.5 }); }
  }
  if (f.stag > 0) { f.stag -= dt; return; }
  const vx = P.x - f.x, vy = P.y - f.y, d = Math.hypot(vx, vy) || 0.001;
  if (f.dummy) {                                                  // tutorial targets stand still; the training puffer drifts at you
    if (E.fly) f.z = Math.max(floorAt(f.x, f.y) + 0.1, P.feet + E.fly + Math.sin(f.ph) * 0.12);
    if (f.t === "puffer" && f.born <= 0) { const nx = f.x + vx / d * 0.5 * dt, ny = f.y + vy / d * 0.5 * dt; if (!cellAt(nx, ny).solid) { f.x = nx; f.y = ny; }
      if (d < 0.9) { pop(f); WK.foes.splice(WK.foes.indexOf(f), 1); } }
    return;
  }
  const base = floorAt(f.x, f.y);
  f.z = E.fly ? Math.max(base + 0.1, Math.min(cellAt(f.x, f.y).c - E.h - 0.1, P.feet + E.fly + Math.sin(f.ph) * 0.12)) : base;
  if (f.born > 0 || P.dead) return;
  const sees = d < 11 && sightLine(f.x, f.y, f.z + E.h * 0.8, P.x, P.y, P.feet + 0.5);
  if (E.charger && chargerTick(f, E, dt, d, vx, vy, sees)) return;
  if (E.boss) captainTick(f, dt, d, sees);
  if (E.slam) { f.slamT = (f.slamT === undefined ? 3 + Math.random() * 2 : f.slamT) - dt;
    if (f.slamT <= 0 && sees && d < 5.5 && Math.abs(P.feet - f.z) < 0.5) { f.slamT = 5; f.leap = 0.55; play("wk_roar", 0.5); } }
  if (f.leap > 0) { f.leap -= dt; f.z = floorAt(f.x, f.y) + Math.sin((1 - f.leap / 0.55) * Math.PI) * 0.5;   // up... and SLAM
    if (f.leap <= 0) { f.z = floorAt(f.x, f.y); WK.quakes.push({ x: f.x, y: f.y, f: f.z, r: 0.3, max: 5.5, dmg: 12 }); WK.shake = Math.max(WK.shake, 0.5); play("wk_boom"); }
    return; }
  let goal = null;                                               // walk the field, or straight at you once close and in sight
  if (E.keep && sees && d < E.keep + 1.5) goal = d < E.keep - 1 ? [f.x - vx / d, f.y - vy / d] : null;   // shooters keep their distance
  else if (sees && d < 2.5 && (E.fly || Math.abs(P.feet - f.z) < 0.4)) goal = [P.x, P.y];   // same level: straight in
  else goal = fieldDir(f, !!E.fly) || (sees ? [P.x, P.y] : null);
  if (goal) {
    let gx = goal[0] - f.x, gy = goal[1] - f.y; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    if (f.t === "crab") { const w = Math.sin(f.ph * 3) * 0.7; const ox = -gy * w, oy = gx * w; gx += ox; gy += oy; }
    for (const o of WK.foes) { if (o === f) continue; const ox = f.x - o.x, oy = f.y - o.y, od = Math.hypot(ox, oy); if (od < 0.5 && od > 0) { gx += ox / od * 0.6; gy += oy / od * 0.6; } }
    const s = E.sp * dt, nx = f.x + gx * s, ny = f.y + gy * s, here = cellAt(f.x, f.y);
    const goalCell = cellAt(goal[0], goal[1]);                  // walkers don't step off a ledge unless that's where they're going
    const ok = (x, y) => { const c = cellAt(x, y); return !c.solid && (E.fly ? c.c - c.f > 0.6 : walkable(here, c) && (c === here || c === goalCell || here.f - c.f < 0.4)); };
    if (d > 0.75) { if (ok(nx, f.y)) f.x = nx; if (ok(f.x, ny)) f.y = ny; }
  }
  f.atk -= dt; f.cd -= dt;
  const reach = E.h > 1.2 ? 1.4 : 1.0;
  if (E.melee && d < reach && Math.abs(f.z - P.feet) < 0.8) { f.wind = (f.wind || 0) + dt; if (f.wind > (E.wind || 0.35) && f.atk <= 0) { f.atk = E.melee[1]; f.wind = 0; hurtMe(E.melee[0]); if (E.h > 1.2) push(vx / d * 3, vy / d * 3); } }   // a wind-up: back off or dash out
  else f.wind = 0;
  if (f.t === "puffer" && d < 0.9 && Math.abs(f.z - P.feet - 0.4) < 0.9) { killFoe(f, false); return; }
  if (E.shoot && sees && d < 9 && f.cd <= 0) {
    const [k, spd, every, dmg] = E.shoot, z0 = f.z + E.h * 0.55, tz = P.feet + 0.45, t = d / spd;
    WK.shots.push({ k, x: f.x, y: f.y, z: z0, vx: vx / d * spd, vy: vy / d * spd, vz: 0, t: 6, dmg, dz: (tz - z0) / t });
    f.cd = every * (0.8 + Math.random() * 0.4); play("wk_shoot", 0.5);
  }
}

// ---------------------------------------------------------------------------------------------------- drawing
const FOG = [14, 32, 50];
let img = null, buf = null;
function pk(r, gg, b) { return 0xff000000 | (cl(b) << 16) | (cl(gg) << 8) | cl(r); }
function shade(tex, i, L, fog, glow) {
  let r = tex.r[i], gg = tex.g[i], b = tex.b[i];
  if (!tex.e[i]) { r *= L; gg *= L; b *= L; } else fog *= 0.5;
  return pk(r + (FOG[0] - r) * fog + glow * 120, gg + (FOG[1] - gg) * fog + glow * 190, b + (FOG[2] - b) * fog + glow * 200);
}
const fogOf = d => Math.min(0.93, 1 - Math.exp(-d * 0.115));
function render() {
  if (!img) { img = g.createImageData(W, VH); buf = new Uint32Array(img.data.buffer); }
  const P = WK.P, T = WK.t, sh = WK.shake * 7;
  const HOR = Math.round(CY + P.pitch + (Math.random() - 0.5) * sh);
  const kz = FOV * (1 + P.dashT * 1.2) / (1 + P.ads * 0.75), SC = (W / 2) / kz;
  const eye = P.feet + 0.55 + Math.sin(P.bob) * 0.025, dx = Math.cos(P.a), dy = Math.sin(P.a), plx = -dy * kz, ply = dx * kz, fl = 1 + P.flash * 0.5;
  const sy = (h, d) => HOR - (h - eye) * SC / d;
  const clips = WK.clips || (WK.clips = new Array(W));
  for (let x = 0; x < W; x++) {
    const cx = 2 * (x + 0.5) / W - 1, rx = dx + plx * cx, ry = dy + ply * cx;
    let mx = P.x | 0, my = P.y | 0; const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), stx = rx < 0 ? -1 : 1, sty = ry < 0 ? -1 : 1;
    let sdx = rx < 0 ? (P.x - mx) * ddx : (mx + 1 - P.x) * ddx, sdy = ry < 0 ? (P.y - my) * ddy : (my + 1 - P.y) * ddy;
    let yT = 0, yB = VH, dp = 0.0001, cell = cellAt(mx, my), glow = 0; const c2 = [[0, 0, VH]];
    for (let s = 0; s < 64; s++) {
      let d, side; if (sdx < sdy) { d = sdx; sdx += ddx; mx += stx; side = 0; } else { d = sdy; sdy += ddy; my += sty; side = 1; }
      if (cell.f < eye) {                                         // this cell's floor, from the last boundary to this one
        const top = Math.max(yT, Math.ceil(sy(cell.f, d))), bot = Math.min(yB, Math.ceil(sy(cell.f, dp))), tx = TEX[cell.ft];
        for (let y = top; y < bot; y++) {
          const rd = (eye - cell.f) * SC / (y + 0.5 - HOR), wx = P.x + rx * rd, wy = P.y + ry * rd;
          const i = ((((wy * TS) | 0) & 31) * TS) + (((wx * TS) | 0) & 31); let L = cell.L * fl;
          const ca = Math.sin(wx * 3.1 + T * 1.3) + Math.sin(wy * 3.7 - T * 1.1) + Math.sin((wx + wy) * 2.3 + T * 0.7); if (ca > 2.1) L += cell.hole ? 0.5 : 0.22;
          buf[y * W + x] = shade(tx, i, L, fogOf(rd), Math.min(0.3, glow * 0.1));
        }
        if (top < yB) yB = Math.max(yT, top);
      }
      if (cell.c > eye) {                                         // ...and its ceiling (or the open water above a hole)
        const top = Math.max(yT, Math.ceil(sy(cell.c, dp))), bot = Math.min(yB, Math.ceil(sy(cell.c, d)));
        if (cell.hole) for (let y = top; y < bot; y++) { const t = Math.max(0, Math.min(1, (y - HOR + CY) / CY)), rip = Math.sin(x * 0.09 + T * 2 + y * 0.3) * 0.5 + 0.5; buf[y * W + x] = pk(70 + 80 * (1 - t) + rip * 30, 150 + 70 * (1 - t) + rip * 20, 165 + 60 * (1 - t) + rip * 15); }
        else { const tx = TEX[cell.ct]; for (let y = top; y < bot; y++) { const rd = (cell.c - eye) * SC / (HOR - y - 0.5), wx = P.x + rx * rd, wy = P.y + ry * rd;
          buf[y * W + x] = shade(tx, ((((wy * TS) | 0) & 31) * TS) + (((wx * TS) | 0) & 31), cell.L * 0.8 * fl, fogOf(rd), Math.min(0.3, glow * 0.1)); } }
        if (bot > yT) yT = Math.min(yB, bot);
      }
      if (cell.hole) glow += d - dp;
      const nx = cellAt(mx, my); let u = side === 0 ? P.y + d * ry : P.x + d * rx; u -= Math.floor(u);
      const ui = (u * TS) | 0, fg = fogOf(d), gl = Math.min(0.3, glow * 0.1), L = (side ? 0.82 : 1) * cell.L * fl;
      const wall = (tx0, y0, y1) => { for (let y = y0; y < y1; y++) { const wh = eye + (HOR - y - 0.5) * d / SC, v = ((Math.floor(wh * TS) % TS) + TS) % TS;
        const tx = tx0 === TEX.port && Math.floor(wh) !== 1 ? TEX.hull : tx0; buf[y * W + x] = shade(tx, (TS - 1 - v) * TS + ui, L, fg, gl); } };
      if (nx.solid) { wall(TEX[nx.w], yT, yB); yB = yT; c2.push([d, yT, yB]); break; }
      if (nx.f > cell.f) { const ya = Math.max(yT, Math.ceil(sy(nx.f, d))); if (ya < yB) { wall(TEX[nx.w], ya, yB); yB = ya; } }
      if (nx.c < cell.c) { const yb = Math.min(yB, Math.ceil(sy(nx.c, d))); if (yb > yT) { wall(TEX.hull, yT, yb); yT = yb; } }
      c2.push([d, yT, yB]); cell = nx; dp = d; if (yT >= yB) break;
    }
    if (yT < yB) for (let y = yT; y < yB; y++) buf[y * W + x] = pk(FOG[0], FOG[1], FOG[2]);
    clips[x] = c2;
  }
  // sprites, far to near, each column clipped to the window left open at its distance
  const list = [];
  for (const [k, x, y] of WK.map.A.props) list.push({ s: SP[k], x, y, z: floorAt(x, y), h: 0.55 });
  for (const [x, y, z] of WK.map.A.lamps) list.push({ s: SP.lantern, x, y, z: z - 0.35, h: 0.35, lamp: 1 });
  if (WK.tut && WK.tut.mark) { const [x, y, z] = WK.tut.mark; list.push({ s: SP.mark, x, y, z: z + Math.sin(T * 4) * 0.08, h: 0.22, lamp: 1 }); }
  for (const p of WK.picks) if (!p.got) list.push({ s: SP[p.k], x: p.x, y: p.y, z: floorAt(p.x, p.y) + 0.03 + Math.sin(T * 3 + p.x) * 0.03, h: p.k === "blunpick" ? 0.18 : 0.22, lamp: p.k === "blunpick" });
  for (const f of WK.foes) { const E = FOES[f.t]; list.push({ s: SP[f.t], x: f.x, y: f.y, z: f.z, h: E.h * (f.born > 0 ? 1 - f.born : 1), hit: f.hit > 0, stag: f.stag > 0 && Math.sin(T * 14) > -0.4, flip: !E.fly && !E.boss && !f.stag && Math.sin(f.ph * 2) > 0, foe: f, burn: f.burn > 0, wind: f.wind > 0 && E.charger }); }
  for (const r of WK.map.A.rings) list.push({ s: SP.ringpt, x: r[0], y: r[1], z: r[2] - 0.12, h: 0.24, lamp: 1, flat: 1 });
  for (const o of WK.mine) list.push({ s: SP[o.k], x: o.x, y: o.y, z: o.z - (o.k === "ring" ? 0.45 : 0.08), h: o.k === "ring" ? 0.9 : o.k === "chain" ? 0.14 : 0.12, lamp: o.k !== "chain" });
  for (const q of WK.quakes) for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283, x = q.x + Math.cos(a) * q.r, y = q.y + Math.sin(a) * q.r; if (!cellAt(x, y).solid) list.push({ s: SP.splash, x, y, z: q.f, h: 0.12, lamp: 1 }); }
  for (const o of WK.shots) list.push({ s: SP[o.k], x: o.x, y: o.y, z: o.z - 0.08, h: o.k === "orb" ? 0.16 : 0.1, lamp: o.k === "orb" });
  for (const p of WK.puffs) list.push({ s: SP[p.k], x: p.x, y: p.y, z: p.z, h: p.k === "boom" ? 0.9 * (1 - p.t / 0.35) + 0.3 : p.big ? 3 * (1 - p.t / 0.5) + 0.5 : p.k === "bone" ? 0.07 : p.k === "ember" ? 0.08 : 0.09, lamp: p.k === "boom" || p.k === "ember" || p.big });
  const inv = 1 / (plx * dy - dx * ply);
  for (const o of list) { const ox = o.x - P.x, oy = o.y - P.y; o.tx = inv * (dy * ox - dx * oy); o.ty = inv * (-ply * ox + plx * oy); }
  list.sort((a, b) => b.ty - a.ty);
  for (const f of WK.foes) f.sx = null;
  for (const o of list) {
    if (o.ty < 0.15 || o.h <= 0) continue;
    const s = o.s, sc = SC / o.ty, hpx = o.h * sc, wpx = hpx * s.w / s.h, mid = W / 2 * (1 + o.tx / o.ty);
    const x0 = Math.round(mid - wpx / 2), x1 = Math.round(mid + wpx / 2), yb = HOR - (o.z - eye) * sc, yt = yb - hpx;
    if (o.foe) o.foe.sx = [x0, x1, yt, yb, o.ty];
    const L = (o.lamp ? 1.3 : cellAt(o.x, o.y).L * 1.15) * fl, fg = fogOf(o.ty);
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const cc = clips[x]; let k = 0; while (k + 1 < cc.length && cc[k + 1][0] < o.ty) k++;
      const top = Math.max(cc[k][1], Math.ceil(yt)), bot = Math.min(cc[k][2], Math.ceil(yb));
      let sxp = ((x - x0) / (x1 - x0) * s.w) | 0; if (o.flip) sxp = s.w - 1 - sxp;
      for (let y = top; y < bot; y++) {
        const ch = s.px[Math.min(s.h - 1, ((y - yt) / hpx * s.h) | 0)][sxp]; if (ch === ".") continue; const c = PAL[ch];
        if (o.hit) { buf[y * W + x] = pk(255, 255, 255); continue; }
        if (o.stag && ch !== "k") { buf[y * W + x] = pk(255, 150 + c[1] * 0.3, 60); continue; }
        if (o.wind && ch === "e") { buf[y * W + x] = pk(255, 255, 120); continue; }
        if (o.burn && ch !== "k" && ((x + y + (T * 20 | 0)) & 3) === 0) { buf[y * W + x] = pk(255, 140, 40); continue; }
        const lit = BRIGHT.has(ch) || o.lamp, l = lit ? 1.25 : L, f2 = lit ? fg * 0.4 : fg;
        buf[y * W + x] = pk(c[0] * l + (FOG[0] - c[0] * l) * f2, c[1] * l + (FOG[1] - c[1] * l) * f2, c[2] * l + (FOG[2] - c[2] * l) * f2);
      }
    }
  }
  for (const [x, y, z] of WK.dots) {                             // drifting specks in the water
    const ox = x - P.x, oy = y - P.y, tx = inv * (dy * ox - dx * oy), ty = inv * (-ply * ox + plx * oy); if (ty < 0.2 || ty > 9) continue;
    const sx = Math.round(W / 2 * (1 + tx / ty)), syy = Math.round(HOR - (z - eye) * SC / ty); if (sx < 0 || sx >= W || syy < 0 || syy >= VH) continue;
    const cc = clips[sx]; let k = 0; while (k + 1 < cc.length && cc[k + 1][0] < ty) k++; if (syy < cc[k][1] || syy >= cc[k][2]) continue;
    const a = 1 - fogOf(ty); buf[syy * W + sx] = pk(60 + 120 * a, 90 + 120 * a, 110 + 110 * a);
  }
  if (P.dashT > 0) for (let i = 0; i < 40; i++) { const yy = (Math.random() * VH) | 0, len = 20 + Math.random() * 50, x0 = Math.random() < 0.5 ? 0 : W - len; for (let x = x0; x < x0 + len; x++) buf[yy * W + (x | 0)] = pk(200, 240, 240); }
  if (P.furyT > 0) for (let i = 0; i < W * VH; i += 1) { const v = buf[i], r = v & 255, gg = (v >> 8) & 255, b = (v >> 16) & 255; buf[i] = pk(r * 0.55, gg * 0.9 + 40, b * 0.7 + 20); }   // Fury: everything goes ghost green
  drawGun();
  g.putImageData(img, 0, 0);
}
// ---- the gun in your hands: drawn straight into the frame, hip or aimed
function drawGun() {
  const P = WK.P, T = WK.t, G = GUNS[P.gun];
  const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && x < W && y >= 0 && y < VH) buf[y * W + x] = pk(c[0], c[1], c[2]); };
  const swapDrop = P.swap > 0 ? (0.25 - Math.abs(P.swap - 0.125) * 2) * 260 : 0;   // down and back up when you switch
  const kick = P.kick * 10, flashOn = P.fireT > G.rate - 0.08 && !G.melee;
  const flash = (bx, by, s) => { for (let y = -26 * s; y < 14 * s; y++) for (let x = -30 * s; x < 30 * s; x++) { const r = Math.hypot(x, y * 1.4), an = Math.atan2(y, x), sp = (14 + 7 * Math.sin(an * 7 + T * 40)) * s;
    if (r < sp) put(bx + x, by + y, r < sp * 0.45 ? [255, 255, 230] : r < sp * 0.75 ? [255, 220, 110] : [240, 140, 60]); } };
  const bob = Math.abs(Math.sin(P.bob * 0.5)) * 5;
  if (P.furyT > 0) {                                               // Davy Jones' Fury: a ghostly trident
    const sw = P.fireT > 0 ? Math.sin((1 - P.fireT / 0.35) * Math.PI) : 0, bx = W / 2 + 60 - sw * 110, by = VH + 20 - sw * 24 + bob, gl = 0.7 + 0.3 * Math.sin(T * 8);
    const gc = [110 * gl, 255 * gl, 190 * gl], lt = [200, 255, 230], dk = [30, 110, 80];
    for (let i = 0; i < 96; i++) { const x = bx - i * 0.45, y = by - i; for (let k = -6; k <= 6; k++) put(x + k, y, Math.abs(k) >= 5 ? dk : k < -2 ? lt : gc); }
    const hx = bx - 43, hy = by - 98;
    for (let k = -42; k <= 42; k++) for (let j = 0; j < 8; j++) put(hx + k, hy + j, Math.abs(k) > 39 || j === 0 || j === 7 ? dk : j < 3 ? lt : gc);
    for (const px of [-36, 0, 36]) for (let i = 0; i < 64; i++) { const w = i > 48 ? Math.max(0.5, 6 - (i - 48) * 0.6) : 4; for (let k = -w; k <= w; k++) put(hx + px + k, hy - i, Math.abs(k) >= w - 0.8 ? dk : k < 0 ? lt : gc); }
    for (const px of [-36, 36]) for (let i = 0; i < 10; i++) for (let k = 0; k < 4; k++) put(hx + px + (px < 0 ? -5 - k : 5 + k), hy - 46 - i - k, dk);   // barbs
    return;
  }
  if (G.melee) {                                                   // the boat hook: a pole from the right, swung on a click
    const sw = P.fireT > 0 ? Math.sin((1 - P.fireT / G.rate) * Math.PI) : 0, bx = W / 2 + 70 - sw * 70, by = VH + swapDrop - sw * 30 + Math.abs(Math.sin(P.bob * 0.5)) * 5;
    for (let i = 0; i < 90; i++) { const x = bx - i * 0.55, y = by - i; for (let k = -3; k <= 3; k++) put(x + k, y, k === -3 || k === 3 ? [16, 14, 34] : k < 0 ? [160, 110, 70] : [128, 86, 54]); }
    const hx = bx - 50, hy = by - 92;
    for (let a = 0; a < 3.6; a += 0.04) { const x = hx - 10 + Math.cos(a) * 12, y = hy + Math.sin(a) * 12 - 6; for (let k = -2; k <= 2; k++) put(x + k, y, k === -2 || k === 2 ? [16, 14, 34] : [150, 160, 176]); }
    for (let k = 0; k < 8; k++) for (let j = -3; j <= 3; j++) put(hx + 2 + j, hy - 4 + k, [90, 98, 118]);
    return;
  }
  if (P.ads > 0.5 && G.id !== "torp" && G.id !== "sonar") {     // aimed: sight down the barrel to the bead
    const by = ((1 - P.ads) * 80 + kick + swapDrop) | 0, bx = W / 2 + (Math.sin(P.bob * 0.5) * 1.5 | 0), wide = G.id === "blun" ? 1 : 0.6;
    if (flashOn) flash(bx, CY + 1, 0.75);
    for (let y = CY + 6; y < VH; y++) { const t = (y - CY - 6) / (VH - CY - 6), hw = (5 + t * 30) * wide;
      for (let x = -hw; x <= hw; x++) { let c = x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -hw * 0.45 ? [240, 206, 110] : x < hw * 0.3 ? [214, 170, 74] : [140, 104, 44];
        if (G.id === "pistol" || G.id === "rivet") c = x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -hw * 0.45 ? [190, 200, 214] : x < hw * 0.3 ? [150, 160, 176] : [90, 98, 118];
        if (t > 0.72) c = x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : (x + y) % 7 === 0 ? [90, 58, 38] : [128, 86, 54];
        if ((y - CY) % 14 < 2 && t < 0.72) c = G.id === "pistol" ? [90, 98, 118] : [140, 104, 44];
        put(bx + x, y + by, c); } }
    if (G.id === "blun" || G.id === "twin") for (let y = -3; y <= 3; y++) for (let x = -10; x <= 10; x++) { const e = x * x / 100 + y * y / 9; if (e <= 1) put(bx + x, CY + 5 + y + by, e > 0.7 ? [16, 14, 34] : y < 0 ? [250, 220, 130] : [214, 170, 74]); }
    else for (let y = 0; y < 6; y++) for (let x = -1; x <= 1; x++) put(bx + x, CY + y + by, y < 2 ? [210, 220, 230] : [150, 160, 176]);
    for (let y = 0; y < 3; y++) for (let x = -1; x <= 1; x++) put(bx + x, CY + 1 + y + by, y === 0 ? [255, 240, 170] : [214, 170, 74]);
    for (const s of [-1, 1]) for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) put(bx + s * (6 + x), CY + 18 + y + by, [16, 14, 34]);
    return;
  }
  const bx = W / 2 + Math.cos(P.bob * 0.5) * 6 | 0, by = (Math.abs(Math.sin(P.bob * 0.5)) * 5 | 0) + (kick | 0) + ((P.ads * 2 * 90) | 0) + (swapDrop | 0);
  if (G.id === "pistol") {                                          // the harpoon pistol: a grey barrel with a harpoon in it
    if (flashOn) flash(bx, VH - 74 + by, 0.55);
    for (let y = VH - 26; y < VH; y++) { const hw = 16 - (VH - y) * 0.25; for (let x = -hw; x < hw; x++) put(bx + x, y + by, x < -hw + 2 || x > hw - 2 ? [16, 14, 34] : (x + y) % 7 === 0 ? [90, 58, 38] : [128, 86, 54]); }
    for (let y = VH - 64; y < VH - 24; y++) { const hw = 5; for (let x = -hw; x <= hw; x++) put(bx + x, y + by, x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -1 ? [190, 200, 214] : x < 2 ? [150, 160, 176] : [90, 98, 118]); }
    if (P.fireT < G.rate - 0.12) for (let y = 0; y < 12; y++) { const hw = Math.max(0, 4 - y * 0.4); for (let x = -hw; x <= hw; x++) put(bx + x, VH - 66 - y + by, x === 0 ? [240, 240, 250] : [170, 178, 196]); }
    return;
  }
  const metal = (x, hw, i) => x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -hw * 0.4 ? [190, 200, 214] : x < hw * 0.3 ? [150, 160, 176] : [90, 98, 118];
  if (G.id === "twin") {                                            // two barrels side by side
    if (flashOn) { flash(bx - 14, VH - 74 + by, 0.8); flash(bx + 14, VH - 74 + by, 0.8); }
    for (let y = VH - 30; y < VH; y++) { const hw = 36 - (VH - y) * 0.35; for (let x = -hw; x < hw; x++) put(bx + x, y + by, x < -hw + 2 || x > hw - 2 ? [16, 14, 34] : (x + y) % 7 === 0 ? [90, 58, 38] : [128, 86, 54]); }
    for (const o of [-14, 14]) { for (let y = VH - 66; y < VH - 28; y++) { const hw = 6; for (let x = -hw; x <= hw; x++) put(bx + o + x, y + by, x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -2 ? [240, 206, 110] : x < 2 ? [214, 170, 74] : [140, 104, 44]); }
      for (let y = -6; y <= 6; y++) for (let x = -12; x <= 12; x++) { const e = x * x / 144 + y * y / 36; if (e > 1) continue; put(bx + o + x, VH - 70 + y + by, e > 0.8 ? [16, 14, 34] : e < 0.45 ? [10, 8, 20] : [214, 170, 74]); } }
    return;
  }
  if (G.id === "rivet") {                                           // a grey box with a drum and a short spinning barrel
    if (flashOn) flash(bx, VH - 78 + by, 0.45);
    const spin = (WK.t * (P.fireT > 0 ? 40 : 4)) | 0;
    for (let y = VH - 46; y < VH; y++) { const hw = 22; for (let x = -hw; x <= hw; x++) put(bx + x, y + by, metal(x, hw)); }
    for (let y = VH - 76; y < VH - 46; y++) { const hw = 7; for (let x = -hw; x <= hw; x++) { let c = metal(x, hw); if ((y + spin) % 6 < 2 && Math.abs(x) < hw - 1) c = [70, 76, 96]; put(bx + x, y + by, c); } }
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { const d = Math.hypot(x, y); if (d > 12) continue; put(bx - 28 + x, VH - 22 + y + by, d > 11 ? [16, 14, 34] : d < 4 ? [214, 170, 74] : (Math.atan2(y, x) * 3 + spin * 0.2 | 0) % 2 ? [120, 128, 150] : [90, 98, 118]); }
    if (P.spin && P.mods.rivet) for (let i = 0; i < 6; i++) put(bx - 7 + Math.random() * 14, VH - 78 + by - Math.random() * 4, [255, 220, 110]);
    return;
  }
  if (G.id === "torp") {                                            // a fat launch tube with a torpedo nose peeking out
    const ly = P.ads > 0.5 ? 30 : 0;
    for (let y = VH - 40; y < VH; y++) { const hw = 34; for (let x = -hw; x <= hw; x++) put(bx + 20 + x, y + by + ly, metal(x, hw)); }
    for (let y = -16; y <= 16; y++) for (let x = -26; x <= 26; x++) { const e = x * x / 676 + y * y / 256; if (e > 1) continue; const i2 = x * x / 400 + y * y / 144;
      let c = e > 0.82 ? [16, 14, 34] : i2 < 1 ? [20, 18, 36] : [120, 128, 150];
      if (i2 < 0.55 && P.fireT < G.rate - 0.3 && P.ammo.torp > 0) c = i2 < 0.18 ? [255, 244, 170] : [196, 60, 56];
      put(bx + 20 + x, VH - 52 + y + by + ly, c); }
    if (flashOn) flash(bx + 20, VH - 60 + by + ly, 0.7);
    return;
  }
  if (G.id === "sonar") {                                           // a brass dish with a cyan heart that brightens as it hums
    const ly = P.ads > 0.5 ? 30 : 0, wm = Math.min(1, P.warm / (G.warm || 1)), pulse = 0.6 + 0.4 * Math.sin(T * (6 + wm * 30));
    for (let y = VH - 34; y < VH; y++) { const hw = 26 - (VH - y) * 0.2; for (let x = -hw; x <= hw; x++) put(bx + x, y + by + ly, x < -hw + 2 || x > hw - 2 ? [16, 14, 34] : (x + y) % 7 === 0 ? [90, 58, 38] : [128, 86, 54]); }
    for (let y = -22; y <= 22; y++) for (let x = -30; x <= 30; x++) { const e = x * x / 900 + y * y / 484; if (e > 1) continue;
      const c = e > 0.88 ? [16, 14, 34] : e > 0.62 ? (y < 0 ? [240, 206, 110] : [214, 170, 74]) : e > 0.5 ? [140, 104, 44] : [cl(60 + 120 * pulse * (0.4 + wm)), cl(140 + 110 * pulse * (0.3 + wm)), cl(170 + 85 * pulse)];
      put(bx + x, VH - 62 + y + by + ly, c); }
    if (wm > 0.2) for (let a = 0; a < 6.28; a += 0.12) { const r = 34 + (1 - wm) * 30; put(bx + Math.cos(a) * r, VH - 62 + Math.sin(a) * r * 0.7 + by + ly, [160, 240, 250]); }
    return;
  }
  if (flashOn) flash(bx, VH - 80 + by, 1);                          // the blunderbuss
  for (let y = VH - 30; y < VH; y++) { const hw = 30 - (VH - y) * 0.35; for (let x = -hw; x < hw; x++) { let c = (x + y) % 7 === 0 ? [90, 58, 38] : [128, 86, 54]; if (x < -hw + 2 || x > hw - 2) c = [16, 14, 34]; else if (x < -hw + 5) c = [160, 110, 70]; put(bx + x, y + by, c); } }
  for (let y = VH - 70; y < VH - 28; y++) { const hw = 7 + (VH - 28 - y) * 0.06; for (let x = -hw; x <= hw; x++) { let c = x < -hw + 1.5 || x > hw - 1.5 ? [16, 14, 34] : x < -hw / 3 ? [240, 206, 110] : x < hw / 3 ? [214, 170, 74] : [140, 104, 44]; if ((y - VH + 70) % 12 < 2) c = [140, 104, 44]; put(bx + x, y + by, c); } }
  for (let y = -9; y <= 9; y++) for (let x = -20; x <= 20; x++) { const e = x * x / 400 + y * y / 81; if (e > 1) continue; const i = x * x / 169 + y * y / 25;
    put(bx + x, VH - 78 + y + by, e > 0.86 ? [16, 14, 34] : i < 1 ? (i < 0.6 ? [10, 8, 20] : [60, 44, 24]) : y < -3 ? [250, 220, 130] : [214, 170, 74]); }
}
// ---- what's drawn over the view: crosshair, prompts, the status bar, menus
function drawWreck() {
  if (!WK) return;
  render();
  const P = WK.P;
  if (P.hurt > 0) { g.globalAlpha = P.hurt * 0.18; rect("#c81e1e", 0, 0, W, VH); g.globalAlpha = 1; }
  if (P.ads < 0.5 && !P.dead) { const s = P.fireT > 0.2 && !GUNS[P.gun].melee ? 7 : 4; g.globalAlpha = 0.85; for (const [a, b] of [[-s - 2, 0], [s, 0], [0, -s - 2], [0, s]]) rect("#e6f0f0", W / 2 + a, CY + b, a ? 2 : 1, a ? 1 : 2); rect("#e6f0f0", W / 2, CY, 1, 1); g.globalAlpha = 1; }
  const near = !P.dead && scuttleTarget();
  if (near) { const s = (WK.touch.on ? "TAP E" : "E") + "  SCUTTLE"; g.globalAlpha = 0.7; rect("#0a0e1e", W / 2 - s.length * 3 - 4, CY - 31, s.length * 6 + 8, 11); g.globalAlpha = 1; text(s, W / 2, CY - 26, 1, "#ffa050"); }
  if (WK.msgT > 0) { g.globalAlpha = Math.min(1, WK.msgT * 2); text(WK.msg, W / 2, 50, 1, "#ffa050"); g.globalAlpha = 1; }
  if (WK.bannerT > 0 && !WK.paused && !WK.result) { g.globalAlpha = Math.min(1, WK.bannerT * 1.5); text(WK.banner, W / 2, 24, 2, GOLD); g.globalAlpha = 1; }
  for (let i = 0; i < 2; i++) rect(i < P.dashN ? "#9fd8e2" : "#2c3358", W / 2 - 9 + i * 10, VH - 6, 8, 2);
  rect(P.grapT > 0 ? "#2c3358" : "#e6f0f0", W / 2 - 22, VH - 6, 8, 2); rect(P.flareT > 0 ? "#2c3358" : "#ff9a50", W / 2 + 14, VH - 6, 8, 2);   // grapple, flare
  if (P.flareT > 0) rect("#ff9a50", W / 2 + 14, VH - 6, Math.round(8 * (1 - P.flareT / FLARE_CD)), 1);
  if (GUNS[P.gun].id !== "pistol" && P.mods[GUNS[P.gun].id] && !P.furyT) text("R " + MODS[GUNS[P.gun].id], 6, VH - 8, 1, P.altT > 0 ? "#5a6488" : "#aadcff", "left");
  if (P.fury >= 100 && !P.furyT && !P.dead) { g.globalAlpha = 0.6 + 0.4 * Math.sin(WK.t * 6); text((WK.touch.on ? "TAP FURY" : "V") + ": DAVY JONES' FURY", W / 2, VH - 16, 1, "#8affc8"); g.globalAlpha = 1; }
  if (P.furyT > 0) text("FURY " + Math.ceil(P.furyT), W / 2, VH - 16, 1, "#8affc8");
  if (WK.boss && WK.foes.includes(WK.boss)) { const b = WK.boss, w = 200, x = (W - w) / 2;
    text("THE DROWNED CAPTAIN", W / 2, 8, 1, "#ff9a90"); rect(INK, x - 1, 13, w + 2, 6); rect("#3a1018", x, 14, w, 4); rect("#d23c3c", x, 14, Math.round(w * Math.max(0, b.hp) / b.max), 4); }
  if (WK.intro) { const t = WK.intro.t, k = Math.min(1, (3.4 - t) * 3, t * 2);   // letterbox bars and the name
    rect("#000", 0, 0, W, Math.round(34 * k)); rect("#000", 0, VH - Math.round(34 * k), W, Math.round(34 * k));
    g.globalAlpha = Math.max(0, k); text(WK.intro.name, W / 2, CY - 6, 3, "#ff6a5a"); text(WK.intro.sub, W / 2, CY + 18, 1, "#d8dcea"); g.globalAlpha = 1; }
  if (WK.phase === "break" && !P.dead) text("NEXT WAVE IN " + Math.ceil(WK.phaseT), W / 2, 40, 1, "#aadcff");
  if (WK.tut && WK.tut.i >= 0 && !WK.paused) drawTut();
  hud();
  if (WK.touch.on) drawTouch();
  if (WK.result) drawResult();
  else if (WK.paused) drawPause();
}
function hud() {
  const P = WK.P, Y = VH, G = GUNS[P.gun];
  rect("#1e2340", 0, Y, W, 32); rect("#d6aa4a", 0, Y, W, 1); rect("#8c682c", 0, Y + 1, W, 1);
  for (const [x, w] of [[0, 70], [70, 82], [152, 62], [214, 52], [266, 82], [348, 132]]) { rect("#141830", x + 2, Y + 4, w - 4, 26); rect("#2c3358", x + 2, Y + 29, w - 4, 1); rect("#8c682c", x + 3, Y + 5, 1, 1); rect("#8c682c", x + w - 4, Y + 5, 1, 1); }
  const lab = (s, cx) => text(s, cx, Y + 25, 1, "#8a93b4", "center", false);
  const fy = P.furyT > 0 ? P.furyT / FURY_T : P.fury / 100;          // the Fury meter runs along the top of the bar
  rect("#10301e", 0, Y - 2, W, 2); rect(P.fury >= 100 || P.furyT > 0 ? "#8affc8" : "#3ca070", 0, Y - 2, Math.round(W * fy), 2);
  if (P.furyT > 0) { text("--", 35, Y + 13, 2, "#8affc8", "center", false); lab("TRIDENT", 35); }
  else { text(G.ammo ? String(P.ammo[G.ammo]) : "--", 35, Y + 13, 2, G.ammo && P.ammo[G.ammo] <= (G.ammo === "rivet" ? 20 : 3) ? "#ff6a50" : "#fad660", "center", false); lab(G.ammo ? AMMO_NAME[G.ammo] : "HOOK", 35); }
  text(P.hp + "%", 111, Y + 13, 2, P.hp < 30 ? "#ff6a50" : "#fad660", "center", false); lab("HEALTH", 111);
  GUNS.forEach((q, i) => text(String(i + 1), 162 + i * 8, Y + 12, 1, P.gun === i ? WHITE : P.guns[i] ? "#fad660" : "#3c4466", "left", false));
  lab("ARMS", 183);
  face(240, Y + 16);
  text(P.ar + "%", 307, Y + 13, 2, "#9fd8e2", "center", false); lab("ARMOR", 307);
  text(WK.tut ? "TRAINING" : "WAVE " + Math.max(1, WK.wave), 356, Y + 9, 1, "#d8dcea", "left", false); text("KILLS " + WK.kills, 356, Y + 20, 1, "#8a93b4", "left", false);
  text(String(WK.score), 474, Y + 9, 1, "#fad660", "right", false);
  if (WK.combo > 1) text("X" + WK.combo, 474, Y + 20, 1, "#ff9a50", "right", false); else text("SCORE", 474, Y + 20, 1, "#8a93b4", "right", false);
}
function face(cx, cy) {                                          // you, behind your helmet glass: looks around, winces when hit
  const P = WK.P, T = WK.t;
  for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) {
    const d = Math.hypot(x, y); if (d > 13.4) continue;
    let c = d > 12.4 ? "#100e22" : d > 9.6 ? (y < -4 ? "#f0ce6e" : "#d6aa4a") : d > 8.6 ? "#8c682c" : null;
    if (!c) { c = P.hp < 30 ? "#3a1e2a" : "#1c3c4c"; if (x > -7 && x < 7 && y > -6 && y < 8) c = P.dead ? "#8a8a96" : P.hurt > 0 ? "#e0a090" : "#d6b49a"; if (y === -6 && x > -6 && x < 6) c = "#5a3c2a"; }
    rect(c, cx + x, cy + y, 1, 1);
  }
  for (const [x, y] of [[-11, 0], [11, 0], [0, -11], [0, 11]]) rect("#8c682c", cx + x, cy + y, 1, 1);
  const look = Math.sin(T * 0.7) > 0.6 ? 1 : Math.sin(T * 0.7) < -0.6 ? -1 : 0, ey = P.hurt > 0 ? -2 : -1;
  for (const ex of [-3, 3]) { if (P.dead) { rect("#100e22", cx + ex - 1, cy + ey, 3, 1); continue; } rect("#100e22", cx + ex + look, cy + ey, 1, 2); if (P.hurt > 0) { rect("#5a3c2a", cx + ex - 1, cy + ey - 2, 1, 1); rect("#5a3c2a", cx + ex + 1, cy + ey - 2, 1, 1); } }
  rect(P.hurt > 0 ? "#7a2a2a" : "#8a5a4a", cx - 2, cy + 4, 5, 1);
  rect("#e6fbff", cx - 5, cy - 4, 1, 1); rect("#e6fbff", cx - 4, cy - 5, 1, 1);
}
const BTN = { resume: [170, 112, 140, 18], tut: [170, 134, 140, 18], quit: [170, 156, 140, 18], again: [150, 168, 180, 18], leave: [150, 192, 180, 18] };
function button(r, lab, col) { const [x, y, w, h] = r; rect(INK, x, y, w, h); rect("#0e1a30", x + 1, y + 1, w - 2, h - 2); rect(col, x + 1, y + 1, w - 2, 1); rect(col, x + 1, y + h - 2, w - 2, 1); text(lab, x + w / 2, y + h / 2 + 1, 1, WHITE); }
function drawPause() {
  g.globalAlpha = 0.6; rect("#060a1e", 0, 0, W, H); g.globalAlpha = 1;
  text("WRECKONING", W / 2, 60, 3, GOLD);
  text("PAUSED", W / 2, 90, 1, "#aadcff");
  button(BTN.resume, "RESUME (CLICK)", "#78bee6"); button(BTN.tut, WK.tut ? "SKIP TUTORIAL" : "TUTORIAL", GOLD); button(BTN.quit, WK.test ? "LEAVE (ENTER)" : "LEAVE THE WRECK (ENTER)", RED);
  text("WASD MOVE  MOUSE LOOK  CLICK FIRE  RIGHT CLICK AIM", W / 2, 188, 1, "#96a0c8");
  text("SPACE JUMP (TWICE)  SHIFT DASH  E SCUTTLE  1-7 OR WHEEL: GUNS", W / 2, 201, 1, "#96a0c8");
  text("R GRAPPLE / MOD  G FLARE  V FURY", W / 2, 214, 1, "#96a0c8");
}
function drawResult() {
  const R = WK.result, a = Math.min(1, R.t * 1.5);
  g.globalAlpha = 0.7 * a; rect("#1a0610", 0, 0, W, H); g.globalAlpha = a;
  text("SUNK!", W / 2, 54, 4, RED);
  text("YOU WENT DOWN ON WAVE " + R.wave, W / 2, 86, 1, WHITE);
  text("KILLS " + R.kills + "     SCORE " + R.score, W / 2, 104, 1, GOLD);
  if (WK.test) text("TEST RUN: NOTHING IS SAVED", W / 2, 120, 1, "#96a0c8");
  if (R.t > 0.8) { button(BTN.again, "AGAIN (SPACE)", "#78bee6"); button(BTN.leave, "LEAVE (ENTER)", RED); }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------- touch (phones)
// Left half: a stick that moves you. Right half: drag to look; hold to fire. Buttons up the right side.
const TBTN = { pause: [452, 4, 24, 14, "II"], jump: [420, 176, 52, 22, "JUMP"], dash: [420, 150, 52, 22, "DASH"], aim: [364, 176, 52, 22, "AIM"], e: [364, 150, 52, 22, "E"], gun: [420, 124, 52, 22, "GUN"],
  alt: [364, 124, 52, 22, "ALT"], flare: [420, 98, 52, 22, "FLARE"], fury: [364, 98, 52, 22, "FURY"] };
function drawTouch() {
  const T = WK.touch;
  g.globalAlpha = 0.35;
  for (const k in TBTN) { const [x, y, w, h, l] = TBTN[k]; rect("#0a0e1e", x, y, w, h); rect("#aadcff", x, y, w, 1); text(l, x + w / 2, y + h / 2 + 1, 1, WHITE, "center", false); }
  if (T.move) { const [x0, y0] = T.move.o; for (let a = 0; a < 6.3; a += 0.3) rect("#aadcff", x0 + Math.cos(a) * 24, y0 + Math.sin(a) * 24, 1, 1); rect("#aadcff", x0 + T.move.v[0] * 24 - 4, y0 + T.move.v[1] * 24 - 4, 8, 8); }
  g.globalAlpha = 1;
}
function pos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
const inR = (x, y, [a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h;
function wreckTouch(e) {
  if (!WK) return;
  const [x, y] = pos(e), P = WK.P;
  if (WK.result) { if (WK.result.t > 0.8) { if (inR(x, y, BTN.again)) again(); else if (inR(x, y, BTN.leave)) leaveWreck(); } return; }
  if (e.pointerType === "touch") {
    WK.touch.on = true;
    if (WK.paused) { if (inR(x, y, BTN.quit)) leaveWreck(); else { if (inR(x, y, BTN.tut)) { if (WK.tut) tutEnd(); else startWreck(WK.id, { test: WK.test, tut: true }); WK.touch.on = true; } WK.paused = false; } return; }
    for (const k in TBTN) if (inR(x, y, TBTN[k])) { if (k === "pause") { WK.paused = true; return; } if (k === "jump") jump(); else if (k === "dash") dash(); else if (k === "aim") P.adsOn = !P.adsOn; else if (k === "e") scuttle(); else if (k === "alt") { altFire(true); if (GUNS[P.gun].id === "rivet") P.spin = !P.spin; } else if (k === "flare") flare(); else if (k === "fury") fury(); else cycle(1); return; }
    if (x < W / 2) WK.touch.move = { id: e.pointerId, o: [x, y], v: [0, 0] };
    else WK.touch.look = { id: e.pointerId, at: [x, y], t: performance.now(), fire: false, moved: 0 };
    return;
  }
  if (WK.paused) { if (inR(x, y, BTN.quit)) { leaveWreck(); return; } if (inR(x, y, BTN.tut)) { if (WK.tut) tutEnd(); else startWreck(WK.id, { test: WK.test, tut: true }); } lockMouse(); WK.paused = false; return; }
  if (!locked()) { lockMouse(); return; }
  if (e.button === 0) WK.fireHeld = true;
  if (e.button === 2) P.adsOn = true;
  if (e.button === 1 || e.button === 3 || e.button === 4) { e.preventDefault(); altFire(true); }   // middle or side button: the mod
}
function wreckMove(e) {
  if (!WK) return;
  const T = WK.touch, [x, y] = pos(e), P = WK.P;
  if (T.move && T.move.id === e.pointerId) { let vx = (x - T.move.o[0]) / 24, vy = (y - T.move.o[1]) / 24; const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; } T.move.v = [vx, vy]; }
  if (T.look && T.look.id === e.pointerId) { const dx = x - T.look.at[0], dy = y - T.look.at[1]; T.look.at = [x, y]; T.look.moved += Math.abs(dx) + Math.abs(dy);
    const s = P.ads > 0.5 ? 0.5 : 1; P.a += dx * 0.012 * s; P.pitch = clamp(P.pitch - dy * 0.9 * s, -85, 85);
    if (T.look.moved < 6 && performance.now() - T.look.t > 220) T.look.fire = true; }
}
function wreckUp(e) {
  if (!WK) return;
  const T = WK.touch;
  if (T.move && T.move.id === e.pointerId) T.move = null;
  if (T.look && T.look.id === e.pointerId) { if (T.look.moved < 6 && performance.now() - T.look.t < 220) { WK.fireHeld = true; fire(); WK.fireHeld = false; } T.look = null; }
  if (e.pointerType !== "touch") { if (e.button === 0) WK.fireHeld = false; if (e.button === 2) WK.P.adsOn = WK.P.adsToggle; if (e.button === 1 || e.button === 3 || e.button === 4) altFire(false); }
}
// ---- mouse: pointer lock for looking around; losing it (Escape) pauses
const locked = () => document.pointerLockElement === canvas;
function lockMouse() { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }
document.addEventListener("pointerlockchange", () => { if (!WK) return; if (!locked() && !WK.result && !WK.touch.on) { WK.paused = true; WK.fireHeld = false; WK.P.adsOn = false; } canvas.style.cursor = locked() ? "none" : ""; });
document.addEventListener("mousemove", e => {
  if (!WK || !locked() || WK.paused || WK.P.dead) return;
  const P = WK.P, s = P.ads > 0.5 ? 0.45 : 1;
  P.a += e.movementX * 0.0032 * s; P.pitch = clamp(P.pitch - e.movementY * 0.45 * s, -85, 85);
});
canvas.addEventListener("contextmenu", e => { if (WK) e.preventDefault(); });
canvas.addEventListener("wheel", e => { if (!WK || WK.paused) return; e.preventDefault(); cycle(e.deltaY > 0 ? 1 : -1); }, { passive: false });
function again() { const id = WK.id, test = WK.test; startWreck(id, { test }); if (!WK.touch.on) lockMouse(); }
function wreckKey(e, down) {
  if (!WK) return;
  const c = e.code;
  if (!down) { WK.keys.delete(c); if (c === "KeyR") altFire(false); return; }
  if (["Space", "ShiftLeft", "ShiftRight", "Tab"].includes(c) || c.startsWith("Arrow")) e.preventDefault();
  if (WK.result) { if (WK.result.t > 0.8) { if (c === "Space") again(); else if (c === "Enter" || c === "Escape") leaveWreck(); } return; }
  if (WK.paused) { if (c === "Enter") leaveWreck(); else if (c === "Escape" || c === "Space") { WK.paused = false; lockMouse(); } return; }
  if (c === "Escape") { WK.paused = true; WK.fireHeld = false; return; }
  WK.keys.add(c);
  if (c === "Space") jump();
  else if (c === "ShiftLeft" || c === "ShiftRight") dash();
  else if (c === "KeyE") scuttle();
  else if (c === "KeyR") altFire(true);
  else if (c === "KeyG") flare();
  else if (c === "KeyV") fury();
  else if (c === "KeyQ") { WK.P.adsToggle = !WK.P.adsToggle; WK.P.adsOn = WK.P.adsToggle; }
  else if (/^Digit[1-7]$/.test(c)) swapTo(+c.slice(5) - 1);
  else if (c === "Enter" && WK.tut) tutEnd();                    // skip the tutorial
  else if (c === "KeyJ" || c === "Enter") { WK.fireHeld = true; fire(); WK.fireHeld = false; }   // keyboard-only fire
}
// ---- music: a driving minor shanty riff while a wave is on, heavier and faster when the Captain is out
const RIFF = { bpm: 168, lead: "D4 D4 F4 D4 A4 - G4 F4 E4 E4 G4 E4 C5 - A4 G4 D4 D4 F4 D4 A4 - D5 C5 A4 G4 F4 E4 D4 - - -", bass: "D2 D2 D3 D2 D2 D2 D3 D2 C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2 A1 A1 A2 A1 D2 D2 D3 D2" };
const BOSS_RIFF = { bpm: 190, lead: "D4 - D4 F4 G#4 - A4 - D5 - C5 A4 G#4 - F4 - D4 - D4 F4 G#4 - A4 - F5 - E5 D5 C5 - A4 -", bass: "D2 D2 D2 D2 D2 D2 D2 D2 F2 F2 F2 F2 E2 E2 E2 E2 D2 D2 D2 D2 D2 D2 D2 D2 A1 A1 A1 A1 C2 C2 C2 C2" };
const hz = n => n === "G#4" ? 415.3 : noteHz(n);
let WMUS = { on: null, step: 0, next: 0 };
function wreckMusic() {
  if (typeof AC === "undefined" || !AC || AC.state !== "running") return;
  const want = WK && !WK.paused && !WK.result && (WK.phase === "fight" || WK.intro) ? (WK.boss || WK.intro ? BOSS_RIFF : RIFF) : null;
  if (want !== WMUS.on) WMUS = { on: want, step: 0, next: AC.currentTime + 0.05 };
  if (!want) return;
  const L = want.lead.split(" "), B = want.bass.split(" "), dt = 30 / want.bpm;
  while (WMUS.next < AC.currentTime + 0.25) {
    const i = WMUS.step % L.length;
    if (hz(L[i])) tone(hz(L[i]), WMUS.next, dt * 0.85, "sawtooth", 0.022);
    if (hz(B[i % B.length])) { tone(hz(B[i % B.length]), WMUS.next, dt * 0.7, "square", 0.04); }
    if (WMUS.step % 2 === 0) tone(55, WMUS.next, 0.08, "sine", 0.12);              // kick
    if (WMUS.step % 4 === 2) tone(180, WMUS.next, 0.05, "square", 0.03);          // snare-ish tick
    WMUS.step++; WMUS.next += dt;
  }
}
function wreckUpdate(dt) {
  if (WK) try { wreckMusic(); } catch (e) { /* sound is optional */ }
  if (!WK || WK.paused) return;
  let left = dt;
  while (left > 0 && WK) { const h = Math.min(left, 1 / 60); sim(h); left -= h; }
}

// ---------------------------------------------------------------------------------------------------- hand-over for game.js
Object.assign(window, { wreckOn: () => !!WK, wreckResize, wreckUpdate, drawWreck, wreckTouch, wreckMove, wreckUp, wreckKey, startWreck });
window.WRECK = { get WK() { return WK; }, altFire, grapple, flare, fury, boom, launch, refreshPicks, modsLeft, MODS, GUN_WAVE, AMMO_MAX, TUT, tutTick, tutEnd, tutGo, startWreck, leaveWreck, sim, render, fire, scuttle, dash, jump, swapTo, cycle, hurtFoe, killFoe, addFoe, nextWave, buildArena, buildField, sightLine, scuttleTarget, hitAt,
  ARENAS, FOES, GUNS, SP, TEX, LEGEND, STAGGER, cellAt, floorAt };
if (TEST) { const w = setInterval(() => { if (S && atlas && atlas.complete) { clearInterval(w); if (TEST === "tutorial") startWreck("hold", { test: true, tut: true }); else startWreck(TEST, { test: true }); } }, 50); }
})();
