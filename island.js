// Driftwood Isle (the island DLC). Loaded after finprix.js and uses game.js's globals.
// Part 1: the raft. After RAFT.AT dives a shipwright waits on a little pier by the boat. Planks drift in the sea (like
// bottles: touching one takes it without using a hook slot), a rope turns up in the Kelp Forest, a sail around the Wreck,
// and the old fisherman sells a compass for chips. With all of it he builds the raft, and the island appears on the
// horizon for good. Nothing here touches score. Save: store.isle (defaults in game.js).
// game.js calls: raftCast (cast), raftHook (hookCheck), raftDraw / raftLights (the ocean), raftScene (after drawShack),
// raftTap (titleTap); overlays "raft" and "raftbuild" go through EXTRA_OV.

const RAFT = { AT: 50, PLANKS: 60, PLANK_P: 0.6, ROPE_P: 0.25, SAIL_P: 0.2, COMPASS: 300 };
const isle = () => store.isle;
const raftOpen = () => store.dives >= RAFT.AT || isle().built;      // the shipwright has turned up
const raftNeeds = () => { const q = isle(); return { planks: q.planks >= RAFT.PLANKS, rope: !!q.rope, sail: !!q.sail, compass: !!q.compass }; };
const raftReady = () => { const n = raftNeeds(); return n.planks && n.rope && n.sail && n.compass; };
SOUNDS.hammer = [[200, 0.05, "square", 0.22, 90], [120, 0.08, "triangle", 0.2, 0, 0.03]];

// ---- little row-art sprites, drawn once with the game's dark outline
const ISPR = {};
function pix(name, rows, pal) {
  if (ISPR[name]) return ISPR[name];
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), c = document.createElement("canvas"), x = c.getContext("2d");
  c.width = w + 2; c.height = h + 2;
  const solid = (i, j) => j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== ".";
  x.fillStyle = INK;
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++)
    if (!solid(i, j) && (solid(i + 1, j) || solid(i - 1, j) || solid(i, j + 1) || solid(i, j - 1))) x.fillRect(i + 1, j + 1, 1, 1);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") { x.fillStyle = pal[ch]; x.fillRect(i + 1, j + 1, 1, 1); } }));
  return (ISPR[name] = c);
}
const WOODP = { b: "#b07a48", d: "#7c5232", l: "#d29c64", n: "#4a3a3a" };
const ISLE_ART = {
  plank: [["bbbbbbbbbbbbbb", "blbbnbbbbbnbbd", "bbbbbbbdbbbbbd", "dddddddddddddd"], WOODP],
  rope: [["..yyyy..", ".yddddy.", "yd.yy.dy", "yd.yy.dy", ".yddddy.", "..yyyy.y"], { y: "#e2c47a", d: "#a8864a" }],
  sail: [["wwwwwwww..", "wwwwwwwww.", "wwsswwwwww", "wwwwwssww.", "wwwwwwww..", ".bbbbbbb.."], { w: "#f4ecd6", s: "#c8bea6", b: "#7c5232" }],
  compass: [["..gggg..", ".gwwwwg.", "gwwrwwwg", "gwwrwwwg", "gwwwkwwg", "gwwwkwwg", ".gwwwwg.", "..gggg.."], { g: "#ffd246", w: "#f6f2e6", r: "#f05050", k: "#3c3c50" }],
  wright: [["...nnnnnn...", "..nnnnnnnn..", ".nnnnnnnnnn.", "...ssssss...", "...kssssk...", "...sssssss..", "..rrssssrr..",
    "..rrrrrrrrr.", ".rrwrrrrwrr.", ".rrwrrrrwrr.", "..bbbbbbbb..", "..bb....bb..", "..aa....aa.."],
    { n: "#284682", s: "#ecbea0", k: INK, r: "#b0503c", w: "#e6dcc8", b: "#503c32", a: "#3c3c46" }],
};
const ispr = k => pix(k, ...ISLE_ART[k]);

// ---- at sea: the drifting raft parts
function raftCast() {
  S.rparts = [];
  if (!raftOpen() || isle().built) return;
  const r = RNG((S.seed ^ 0x51ab1e) >>> 0), q = isle(), at = z => ({ x: r.uniform(10, LW - 24), y: r.uniform(ZONES[z][1] + 8, ZONES[z][2] - 8) * M });
  if (q.planks < RAFT.PLANKS && r.random() < RAFT.PLANK_P) S.rparts.push({ k: "plank", x: r.uniform(10, LW - 24), y: r.uniform(20, 600) * M });
  if (!q.rope && r.random() < RAFT.ROPE_P) S.rparts.push(Object.assign({ k: "rope" }, at(1)));
  if (!q.sail && r.random() < RAFT.SAIL_P) S.rparts.push(Object.assign({ k: "sail" }, at(3)));
}
function raftHook() {
  if (!S.rparts) return;
  for (const d of S.rparts) {
    if (d.got) continue;
    const w = ispr(d.k).width, cx = d.x + w / 2, dy = S.hy - d.y;
    if (Math.abs(dy) < 40) d.x += clamp(S.hx - cx, -0.3, 0.3);           // a plank drifts gently toward a hook that's close
    if (Math.abs(S.hx - cx) < 8 && Math.abs(dy) < 9) {
      d.got = true; const q = isle();
      if (d.k === "plank") { q.planks = Math.min(RAFT.PLANKS, q.planks + 1); S.popups.push(["PLANK! " + q.planks + "/" + RAFT.PLANKS, 2.4, "#d29c64"]); }
      else { q[d.k] = 1; S.popups.push([d.k === "rope" ? "A ROPE FOR THE RAFT!" : "A SAIL FOR THE RAFT!", 2.6, "#f4ecd6"]); }
      if (raftReady()) S.popups.push(["THE RAFT CAN BE BUILT!", 3, GOLD]);
      saveStore(); splash(S.hx, S.hy, 6, "#e2c47a"); play("chime");
    }
  }
}
const driftXY = (d, cam, t) => [Math.floor(d.x + Math.sin(t * 0.8 + d.y) * 2), Math.floor(d.y - cam + Math.sin(t * 1.6 + d.x) * 1.5)];
function raftDraw(cam, t) {
  if (!S.rparts || !S.prepared) return;
  for (const d of S.rparts) {
    if (d.got) continue;
    const [x, y] = driftXY(d, cam, t), c = ispr(d.k);
    if (y < -12 || y > LH + 12) continue;
    const pu = 0.5 + 0.5 * Math.sin(t * 3); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.1 + 0.08 * pu; disc("#ffd890", x + c.width / 2, y, 9); disc("#ffd890", x + c.width / 2, y, 5); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    g.drawImage(c, x, y - (c.height >> 1));
  }
}
function raftLights(lights, cam, t) {
  if (!S.rparts || !S.prepared) return;
  for (const d of S.rparts) if (!d.got) { const [x, y] = driftXY(d, cam, t); lights.push([x + 7, y, 16]); }
}

// ---- topside: the pier, the shipwright, the raft taking shape, and the island once it's built
const pierX = () => OX + 76;
const isleX = () => wideMenus() ? LW - 64 : LW - 17;
function raftScene(wl) {
  if (!raftOpen()) return;
  const t = T, px = pierX(), q = isle();
  if (q.built && S.state === "title") drawIsleFar(isleX(), wl);
  for (const k of [2, 20]) rect("#5a4030", px + k, wl - 3, 2, 7);                     // the pier
  rect("#8a6040", px, wl - 5, 24, 2); rect("#5a4030", px, wl - 3, 24, 1);
  const rx = px + 26, bob = Math.round(Math.sin(t * 2) * 1);
  if (q.built) {                                                                      // the finished raft, tied up
    for (let k = 0; k < 4; k++) rect(k % 2 ? "#a06c40" : "#c08850", rx, wl - 3 + bob + k, 18, 1);
    rect("#5a4030", rx + 8, wl - 17 + bob, 1, 14);
    poly("#f4ecd6", [[rx + 9, wl - 16 + bob], [rx + 17, wl - 9 + bob], [rx + 9, wl - 5 + bob]]);
    if (S.state === "title" && Math.floor(t * 2) % 2) rect(GOLD, rx + 8, wl - 21 + bob, 1, 2);
    return;
  }
  const logs = Math.floor(q.planks / RAFT.PLANKS * 6);                                   // the raft takes shape as planks come in
  for (let k = 0; k < logs; k++) rect(k % 2 ? "#a06c40" : "#c08850", rx + k * 3, wl - 2 + bob, 3, 3);
  if (q.rope) rect("#e2c47a", rx + 1, wl - 3 + bob, 2, 1);
  g.drawImage(ispr("wright"), px + 6, wl - 19 + (Math.floor(t * 1.4) % 2));
  if (!q.met || raftReady()) {                                                         // "!" when there's something to say
    const ey = wl - 27 + Math.round(Math.sin(t * 4));
    rect(INK, px + 11, ey - 1, 4, 9); rect(GOLD, px + 12, ey, 2, 5); rect(GOLD, px + 12, ey + 6, 2, 1);
  }
}
function drawIsleFar(x, wl) {                                                          // Driftwood Isle, far off on the horizon
  const hz = "#5a7a8a", hz2 = "#6e8e9a";
  poly(hz, [[x - 14, wl], [x - 6, wl - 7], [x + 2, wl - 9], [x + 9, wl - 5], [x + 16, wl]]);
  poly(hz2, [[x - 4, wl], [x + 2, wl - 9], [x + 9, wl - 5], [x + 12, wl]]);
  rect(hz, x - 7, wl - 13, 1, 7); rect(hz, x - 10, wl - 14, 7, 1); rect(hz, x - 9, wl - 15, 2, 1); rect(hz, x - 5, wl - 15, 2, 1);   // a palm
  rect("#e6e6ee", x + 6, wl - 15, 2, 9); rect("#c84a3c", x + 6, wl - 16, 2, 2);         // a lighthouse, not lit yet
}
function raftTap(rx, ly, wl) {
  if (!raftOpen()) return false;
  const px = pierX(), q = isle();
  if (q.built) {
    const ix = isleX();
    if ((rx >= px && rx < px + 46 && ly >= wl - 22 && ly < wl + 4) || (rx >= ix - 16 && rx < ix + 18 && ly >= wl - 18 && ly < wl + 2)) { sailToIsle(); return true; }
    return false;
  }
  if (rx >= px && rx < px + 46 && ly >= wl - 28 && ly < wl + 4) { q.met = 1; saveStore(); openOverlay("raft"); return true; }
  return false;
}
function sailToIsle() {
  if (typeof startIsland === "function") { startIsland(); return; }
  S.popups.push(["THE ISLAND'S NOT READY", 2.6, GOLD], ["FOR VISITORS YET. SOON!", 2.6, WHITE]); play("tick");
}

// ---- the raft board (both widths: X/W are the 120 column on phones, the 348 block on PC)
function raftGeo() { const wide = wideMenus(); return { wide, X: wide ? WX() : OX, W: wide ? 348 : 120 }; }
function raftSay() {
  const q = isle(), n = raftNeeds();
  if (raftReady()) return "THAT'S EVERYTHING. LET'S BUILD HER!";
  if (!q.planks && !q.rope && !q.sail && !q.compass) return "NEED A RAFT BUILT? PLANKS DRIFT BY OUT THERE. BRING ME " + RAFT.PLANKS + ".";
  if (n.planks) return "PLANKS ARE DONE. NOW THE REST.";
  return ["KEEP THE PLANKS COMING.", "THERE'S AN ISLAND OUT THERE. I'VE SEEN IT.", "ROPE TANGLES IN THE KELP. SAILS SINK BY THE WRECK.", "THE OLD MAN HAS A COMPASS. HE'LL WANT CHIPS."][Math.floor(T / 5) % 4];
}
function raftRows() {
  const q = isle(), n = raftNeeds();
  return [["plank", "PLANKS", n.planks, q.planks + "/" + RAFT.PLANKS, "DRIFTING IN THE SEA"], ["rope", "ROPE", n.rope, "GOT IT", "IN THE KELP FOREST"],
    ["sail", "SAIL", n.sail, "GOT IT", "AROUND THE WRECK"], ["compass", "COMPASS", n.compass, "GOT IT", "RUSTY HOOK, " + RAFT.COMPASS + " CHIPS"]];
}
function raftHits() { const { wide, X, W } = raftGeo(); return [["build", wide ? X + 214 : X + 20, wide ? 150 : 166, wide ? 134 : 80, 16, 0]]; }
function drawRaft() {
  const { wide, X, W } = raftGeo(), cx = X + W / 2, q = isle(), say = raftSay();
  rect("#0c1830", 0, 0, LW, LH);
  for (let y = 0; y < LH; y += 8) rect(y % 16 ? "#0f1c38" : "#0c1830", 0, y, LW, 4);
  text("THE RAFT", wide ? X : cx, 7, 1, GOLD, wide ? "left" : "center", null);
  const sp = ispr("wright");
  if (wide) {
    rect("#14244a", X, 18, 196, 54); outline(X, 18, 196, 54, "#3c5080");
    g.drawImage(sp, 0, 0, sp.width, sp.height, X + 6, 22, sp.width * 3, sp.height * 3);
    wrap(say, 24).slice(0, 4).forEach((l, i) => text(l, X + 50, 30 + i * 10, 1, WHITE, "left", null));
  } else {
    g.drawImage(sp, 0, 0, sp.width, sp.height, cx - sp.width, 15, sp.width * 2, sp.height * 2);
    wrap(say, 19).slice(0, 3).forEach((l, i) => text(l, cx, 50 + i * 9, 1, WHITE, "center", null));
  }
  raftRows().forEach(([k, name, done, got, where], i) => {
    const y = wide ? 82 + i * 22 : 80 + i * 20, x = X, w = wide ? 196 : W;
    rect(done ? "#16302a" : "#14244a", x, y, w, wide ? 20 : 18); outline(x, y, w, wide ? 20 : 18, done ? CHIP : "#3c5080");
    const c = ispr(k); g.drawImage(c, x + 3, y + ((wide ? 20 : 18) - c.height >> 1));
    text(name, x + 21, y + 5, 1, done ? CHIP : WHITE, "left", null);
    if (k === "plank") {
      const bw = w - 24 - 4, f = q.planks / RAFT.PLANKS; rect("#24305e", x + 21, y + 11, bw, 3); rect(done ? CHIP : "#d29c64", x + 21, y + 11, Math.round(bw * f), 3);
      text(got, x + w - 3, y + 5, 1, done ? CHIP : "#d29c64", "right", null);
    } else text(done ? got : wide ? where : where.split(",")[0], done ? x + w - 3 : x + 21, y + 13, 1, done ? CHIP : GREY, done ? "right" : "left", null);
  });
  if (wide) {
    const px = X + 214; rect("#14244a", px, 18, 134, 124); outline(px, 18, 134, 124, "#3c5080");
    text("WHAT FOR?", px + 67, 28, 1, GOLD, "center", null);
    ["AN ISLAND, FAR OUT.", "NOBODY'S BEEN THERE", "IN YEARS.", "", "PLANKS DRIFT BY LIKE", "BOTTLES: TOUCH ONE,", "IT'S YOURS. NO HOOK", "SPACE USED."].forEach((l, i) => text(l, px + 67, 44 + i * 10, 1, i < 3 ? WHITE : GREY, "center", null));
    drawIsleFar(px + 67, 136);
  }
  const [, bx, by, bw, bh] = raftHits()[0], ok = raftReady();
  btn(bx, by, bw, bh, ok ? "BUILD IT!" : "NOT YET", ok ? GOLD : GREY);
  closeLine("TAP HERE TO GO BACK");
}
function raftTapOv(rx, ly) {
  if (ly > 186) { closeOverlay(); return; }
  const h = hitAt(raftHits(), rx, ly);
  if (h && raftReady()) { RB = { t0: T, hits: 0 }; S.overlay = "raftbuild"; play("select"); }
  else if (h) play("miss");
}

// ---- building it: a short scene, then the island is on the horizon for good
let RB = null;
function drawRaftBuild() {
  const e = T - RB.t0, cx = LW / 2, cy = 96, n = Math.min(6, Math.floor(e / 0.35));
  rect("#0c1830", 0, 0, LW, LH);
  rect("#3a7ab4", 0, cy + 4, LW, LH); for (let x = 0; x < LW; x += 6) rect("#6ab4dc", x + Math.floor(e * 6) % 6, cy + 4 + Math.round(Math.sin(e * 2 + x) * 1), 3, 1);
  if (n > RB.hits) { RB.hits = n; play("hammer"); }
  const sail = Math.max(0, Math.min(1, (e - 2.4) / 0.6)), go = Math.max(0, e - 3.4), x0 = cx - 18 + go * 26;
  for (let k = 0; k < n; k++) { rect(k % 2 ? "#a06c40" : "#c08850", x0 + k * 6, cy - 2, 6, 6); rect("#7c5232", x0 + k * 6, cy + 3, 6, 1); }
  if (e > 2.2) rect("#5a4030", x0 + 17, cy - 26, 2, 24);
  if (sail > 0) poly("#f4ecd6", [[x0 + 19, cy - 25], [x0 + 19 + 15 * sail, cy - 12], [x0 + 19, cy - 4]]);
  if (e < 2.2) g.drawImage(ispr("wright"), cx - 40, cy - 12 + (Math.floor(e * 6) % 2));
  if (e > 3.4) {
    g.globalAlpha = Math.min(1, (e - 3.4) / 1.2); drawIsleFar(cx + (wideMenus() ? 120 : 40), cy + 4); g.globalAlpha = 1;
    text("THE RAFT IS READY!", cx, 40, wideMenus() ? 2 : 1, GOLD, "center");
    text("DRIFTWOOD ISLE IS ON THE HORIZON", cx, 140, 1, WHITE, "center", null);
    if (e > 4.2) text("TAP TO GO BACK", cx, 194, 1, GREY, "center", null);
  }
}
function raftBuildTap() {
  if (T - RB.t0 < 4.2) return;
  const q = isle(); q.built = 1; RB = null;
  if (award("castaway")) S.popups.push(["NEW TITLE: CASTAWAY", 3, GOLD]);
  saveStore(); S.overlay = null; play("fanfare");
}
EXTRA_OV.raft = { draw: drawRaft, tap: raftTapOv };
EXTRA_OV.raftbuild = { draw: drawRaftBuild, tap: raftBuildTap };

// =====================================================================================================================
// Part 2: the island engine. Its own screen (about 384x216 on PC, 240 wide on phones, 16 px tiles), its own clock
// (a day is about 12 real minutes, 6 am to 2 am; 28-day seasons), weather, tides, areas you walk between, your shack.
// game.js hands over while S.state === "isle": update, draw, pointer, keys and resize. Save: store.isle.g.
const TS = 16, DAY_START = 360, DAY_END = 1560, GAME_MIN_PER_S = (DAY_END - DAY_START) / 720;   // 12 real minutes a day
const SEASONS = [["SPRING", "SPR"], ["SUMMER", "SUM"], ["FALL", "FAL"], ["WINTER", "WIN"]], SEASON_DAYS = 28;
const WALK = 80;                                            // pixels a second: 5 tiles
let ISLE = null, IW = 384, IH = 216;

function isleResize() {                                     // the island's own screen: 16:9 on PC, a taller column on phones
  const a = window.innerWidth / window.innerHeight;
  if (a >= 1) { IH = 216; IW = clamp(Math.round(216 * a), 288, 384); } else { IW = 240; IH = clamp(Math.round(240 / a), 240, 432); }
  canvas.width = IW; canvas.height = IH;
  canvas.style.height = "min(100dvh, " + (100 * IH / IW) + "vw)"; canvas.style.aspectRatio = IW + " / " + IH;
  g.imageSmoothingEnabled = false;
}
function isleSave() {                                        // the island's part of the save
  const q = isle();
  if (!q.g) q.g = { year: 1, season: 0, day: 1, min: DAY_START, sd: 0, intro: 0, area: "port", x: 0, y: 0 };
  const g_ = q.g;
  if (!g_.inv) {                                              // the starting kit (part 3): a hoe, a watering can, some seeds, 100 sand dollars
    g_.inv = Array(INV_N).fill(null); g_.inv[0] = ["hoe", 1]; g_.inv[1] = ["can", 1]; g_.inv[2] = ["s_lettuce", 15]; g_.inv[3] = ["rod", 1]; g_.inv[4] = ["net", 1]; g_.inv[5] = ["axe", 1]; g_.inv[6] = ["pick", 1]; g_.fish0 = 1; g_.p5 = 1;
    g_.sel = 0; g_.water = WATER_MAX; g_.sd = (g_.sd || 0) + 100; g_.farm = {}; g_.bin = []; g_.forage = null; g_.earned = 0; g_.kit = 0;
  }
  if (!g_.fish0) {                                            // part 4: a fishing rod and a net for saves from before it
    g_.fish0 = 1; g_.rodMsg = 1;
    for (const id of ["rod", "net"]) { const i = g_.inv.indexOf(null); if (i >= 0) g_.inv[i] = [id, 1]; else g_.rodLater = 1; }
  }
  if (!g_.log) { g_.log = {}; g_.pots = []; g_.pools = null; }
  if (!g_.p5) {                                               // part 5: an axe and a pick for saves from before it
    g_.p5 = 1; g_.woodsMsg = 1;
    for (const id of ["axe", "pick"]) { const i = g_.inv.indexOf(null); if (i >= 0) g_.inv[i] = [id, 1]; }
  }
  for (const [k, v] of [["crate", []], ["cut", {}], ["placed", []], ["chests", {}], ["rest", {}], ["donated", {}], ["up", {}], ["mach", {}], ["news", []]]) if (!g_[k]) g_[k] = v;
  return g_;
}

// ---- small painter for offscreen sprites
function paintCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d");
  const P = {
    c, x,
    px(a, b, col) { x.fillStyle = col; x.fillRect(a, b, 1, 1); },
    rect(a, b, ww, hh, col) { x.fillStyle = col; x.fillRect(a, b, ww, hh); },
    rows(rows, pal, a, b, outline) {
      const hh = rows.length, solid = (i, j) => j >= 0 && j < hh && i >= 0 && i < rows[j].length && rows[j][i] !== ".";
      if (outline !== false) { x.fillStyle = INK; for (let j = -1; j <= hh; j++) for (let i = -1; i <= 40; i++) if (!solid(i, j) && (solid(i + 1, j) || solid(i - 1, j) || solid(i, j + 1) || solid(i, j - 1))) x.fillRect(a + i, b + j, 1, 1); }
      rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") { x.fillStyle = pal[ch]; x.fillRect(a + i, b + j, 1, 1); } }));
    },
    text(s, a, b, col) { x.fillStyle = col; for (const ch of String(s)) { const gl = DATA.glyphs[ch]; if (gl) gl.forEach((row, j) => [...row].forEach((bit, i) => { if (bit === "1") x.fillRect(a + i, b + j, 1, 1); })); a += 6; } },
    shadow(cx, cy, rx, ry) { x.fillStyle = "rgba(0,0,0,0.22)"; for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i / rx) ** 2 + (j / ry) ** 2 <= 1) x.fillRect(cx + i, cy + j, 1, 1); },
  };
  return P;
}
function seeded(n) { return RNG((n * 2654435761) >>> 0); }

// ---- art for the Port (matches the approved mock-up)
const IART = {};
function artPalm() {
  const P = paintCanvas(28, 42);
  P.shadow(13, 38, 10, 3);
  for (let j = 0; j < 22; j++) { const b = Math.round(2 * Math.sin(j / 7)); P.rect(11 + b, 9 + j, 4, 1, j % 3 ? "#96683e" : "#78502e"); P.px(10 + b, 9 + j, INK); P.px(15 + b, 9 + j, INK); }
  P.rows(["....gg....gg....", "..gggggggggggg..", ".gglggggggglggg.", "gg.gglggggglg.gg", "g...gggllggg...g", "....gg.oo.gg....", "...g..oooo..g...", "........o......."], { g: "#3c8c46", l: "#60b45a", o: "#825a32" }, 6, 2);
  return P.c;
}
function artBush(big) {
  const P = paintCanvas(16, 12);
  P.shadow(7, 9, 7, 2);
  P.rows(big ? ["...gggg....", ".ggglgggg..", "gglggggglgg", "ggggggggggg", "ggggrggggg.", ".ggggggggg."] : ["..gggg..", ".glggggg", "gglgggg.", "gggggggg", ".gggggg."], { g: "#3e8442", l: "#64b05c", r: "#dc4650" }, 2, 1);
  return P.c;
}
function artShack() {                                       // your shack: patched, but it has a roof
  const P = paintCanvas(80, 84), y0 = 22, x0 = 4;
  P.shadow(x0 + 34, y0 + 56, 38, 5);
  for (let j = 0; j < 26; j++) for (let i = 0; i < 60; i++) { let c = j % 5 ? "#96643c" : "#845632"; if (i % 17 === 0) c = "#845632"; if ((i * 7 + j * 3) % 41 === 0) c = "#aa764a"; P.px(x0 + 4 + i, y0 + 26 + j, c); }
  P.rect(x0 + 4, y0 + 51, 60, 1, INK);
  for (let j = 0; j < 26; j++) for (let i = -2; i < 70; i++) { let c = (Math.floor(i / 4) + Math.floor(j / 3)) % 2 ? "#b85242" : "#a4463a"; if (j % 3 === 2) c = "#80362e"; P.px(x0 + i, y0 + j, c); }
  P.rect(x0 + 44, y0 + 6, 14, 9, "#c6aa70"); for (let k = 0; k < 3; k++) P.rect(x0 + 44, y0 + 7 + k * 3, 14, 1, "#a08254");
  P.rect(x0 - 2, y0 + 25, 72, 2, INK); P.rect(x0 - 2, y0 - 1, 72, 1, INK);
  for (let j = 0; j < 27; j++) { P.px(x0 - 3, y0 + j, INK); P.px(x0 + 70, y0 + j, INK); }
  P.rect(x0 + 52, y0 - 8, 7, 9, "#827878"); P.rect(x0 + 52, y0 - 9, 7, 1, INK);
  P.rect(x0 + 28, y0 + 34, 12, 18, "#603e26"); P.rect(x0 + 28, y0 + 34, 12, 1, INK); P.px(x0 + 37, y0 + 43, "#f0c85a");
  for (const wx of [x0 + 10, x0 + 48]) { P.rect(wx - 1, y0 + 31, 12, 10, INK); P.rect(wx, y0 + 32, 10, 8, "#ffd678"); P.rect(wx + 4, y0 + 32, 1, 8, "#78502e"); P.rect(wx, y0 + 35, 10, 1, "#78502e"); }
  P.rect(x0 + 22, y0 + 52, 24, 4, "#b08050"); P.rect(x0 + 22, y0 + 56, 24, 1, INK);
  P.rows([".ff.", "ffff", "fwwf", ".ff."], { f: "#e6783c", w: "#ffdc78" }, x0 + 66, y0 + 44);
  return P.c;                                                // the walls run from y 48 to 74; the door is x 32..44
}
function artRuin(sign, roof) {                              // a building that needs restoring
  const P = paintCanvas(64, 62), x0 = 2, y0 = 10, sw = sign.length * 6 + 2;
  P.shadow(x0 + 30, y0 + 46, 33, 4);
  for (let j = 0; j < 24; j++) for (let i = 0; i < 56; i++) { let c = (Math.floor(j / 4) + Math.floor(i / 8)) % 2 ? "#b4a896" : "#a69a8a"; if (j % 4 === 0) c = "#8c8274"; P.px(x0 + 2 + i, y0 + 20 + j, c); }
  for (let i = 0; i < 60; i++) {
    const top = 20 - (i < 24 ? 0 : Math.floor(10 * Math.sin((i - 24) / 36 * Math.PI)));
    for (let j = top - 6; j < 20; j++) { if (i < 24 && j < 12) continue; P.px(x0 + i, y0 + j, (Math.floor(i / 3) + Math.floor(j / 2)) % 2 ? roof[0] : roof[1]); }
  }
  for (let i = 0; i < 24; i++) P.rect(x0 + i, y0 + 12 + (i % 5 === 0 ? 1 : 0), 1, 8, roof[1]);
  P.rect(x0 + 4, y0 + 14, 6, 6, "#5a3c28");
  P.rect(x0 + 20, y0 + 30, 14, 14, "#5a4634"); for (let k = 0; k < 3; k++) P.rect(x0 + 19, y0 + 32 + k * 4, 16, 2, "#b08a5a");
  P.rect(x0 + 42, y0 + 26, 10, 8, INK); P.rect(x0 + 43, y0 + 27, 8, 6, "#465a6e"); P.rect(x0 + 41, y0 + 29, 12, 2, "#b08a5a");
  const sx = x0 + Math.max(2, Math.min(56 - sw, 18 - (sw >> 1) + 8));
  P.rect(sx, y0 + 21, sw, 9, "#785432"); P.rect(sx, y0 + 21, sw, 1, INK); P.text(sign, sx + 1, y0 + 22, "#ecdcb4");
  P.rows(["g.g", "ggg", ".g."], { g: "#509650" }, x0 + 50, y0 + 40, false); P.rows(["g..g", "gggg"], { g: "#509650" }, x0 + 8, y0 + 42, false);
  return P.c;                                                // walls y 30..54
}
function artAquarium() {
  const P = paintCanvas(76, 72), x0 = 2, y0 = 8;
  P.shadow(x0 + 36, y0 + 52, 38, 5);
  for (let j = 0; j < 30; j++) for (let i = 0; i < 68; i++) { let c = (Math.floor(j / 5) + Math.floor(i / 9)) % 2 ? "#c4c8d2" : "#b4bac6"; if (j % 5 === 0) c = "#969caa"; P.px(x0 + 2 + i, y0 + 22 + j, c); }
  const cx = x0 + 36, cy = y0 + 24, r = 20;
  for (let j = -r; j <= 0; j++) for (let i = -r; i <= r; i++) { const d = i * i + j * j; if (d <= r * r) P.px(cx + i, cy + j, d < (r - 3) ** 2 ? ((i + j) % 7 === 0 ? "#b4e6f0" : "#78c4dc") : "#5a96b4"); else if (d <= (r + 1) ** 2) P.px(cx + i, cy + j, INK); }
  [[2, -14], [4, -11], [3, -8], [6, -6], [5, -3]].forEach(([a, b]) => { P.px(cx + a, cy + b, INK); P.px(cx + a + 1, cy + b + 1, INK); });
  P.rect(x0 + 1, y0 + 24, 70, 2, INK);
  P.rect(x0 + 28, y0 + 34, 16, 18, "#3c5064"); P.rect(x0 + 28, y0 + 34, 16, 1, INK); for (let k = 0; k < 4; k++) P.rect(x0 + 27, y0 + 36 + k * 4, 18, 1, "#b08a5a");
  for (const sx of [x0 + 8, x0 + 54]) { P.rect(sx - 1, y0 + 31, 12, 12, INK); P.rect(sx, y0 + 32, 10, 10, "#466e82"); P.px(sx + 2, y0 + 34, "#8cbed2"); }
  const vr = seeded(5);
  for (const vx of [x0 + 4, x0 + 22, x0 + 62]) { const n = 10 + Math.floor(vr.random() * 10); for (let j = 0; j < n; j++) { P.px(vx + (Math.floor(j / 3) % 2), y0 + 24 + j, "#468c46"); if (j % 4 === 0) P.px(vx + 2, y0 + 24 + j, "#64b05a"); } }
  P.rect(x0 + 10, y0 + 56, 52, 7, "#785432"); P.rect(x0 + 10, y0 + 56, 52, 1, INK); P.text("AQUARIUM", x0 + 12, y0 + 57, "#ecdcb4");
  return P.c;                                                // walls y 30..60
}
function artBoard() { const P = paintCanvas(24, 30); P.shadow(11, 27, 10, 2); P.rect(3, 13, 2, 14, "#6e482a"); P.rect(17, 13, 2, 14, "#6e482a"); P.rect(0, 0, 22, 15, INK); P.rect(1, 1, 20, 13, "#b08250"); P.rect(3, 3, 6, 4, "#faf4dc"); P.rect(12, 4, 6, 4, "#f0dca0"); P.rect(5, 9, 6, 4, "#faf4dc"); return P.c; }
function artCrate() {
  const P = paintCanvas(18, 18); P.shadow(8, 15, 8, 2);
  P.rows(["kkkkkkkkkkkkkk", "kbbbbbbbbbbbbk", "kbmbbbbbbbbmbk", "kbbmbbbbbbmbbk", "kbbbmbbbbmbbbk", "kbbbbmbbmbbbbk", "kbbbbbmmbbbbbk", "kbbbbbmmbbbbbk", "kbbbbmbbmbbbbk", "kbbbmbbbbmbbbk", "kkkkkkkkkkkkkk"], { k: "#603e26", b: "#ba8c58", m: "#96683e" }, 1, 4, false);
  P.rows(["..cc", "ccc.", "c..."], { c: "#5ab4d2" }, 11, 1); return P.c;
}
function artLog() { const P = paintCanvas(26, 9); P.shadow(12, 6, 12, 2); P.rows(["..bbbbbbbbbbbbbbbbbbb.", ".bbbbbbbbbbbbbbbbbbbbr", ".bdbbbbbbbbbbbbbbbbbbr", "..bbbbbbbbbbbbbbbbbbr."], { b: "#967450", d: "#76583a", r: "#c4a070" }, 1, 1); return P.c; }
function artPile() {                                        // driftwood across a path: a way that opens later
  const P = paintCanvas(36, 22); P.shadow(17, 18, 16, 3);
  const L = (x, y, w, c) => { P.rect(x, y, w, 4, INK); P.rect(x + 1, y + 1, w - 2, 2, c); };
  L(2, 12, 30, "#a08060"); L(6, 8, 26, "#8c6c4c"); L(0, 15, 22, "#b49470"); L(14, 5, 18, "#a08060"); L(10, 2, 14, "#c4a070");
  P.rect(30, 0, 1, 10, "#6e482a"); P.rect(26, -1, 9, 6, INK); P.rect(27, 0, 7, 4, "#e6d2a0"); return P.c;
}
function artRaftMoored() {
  const P = paintCanvas(44, 34);
  for (let k = 0; k < 5; k++) { P.rect(2, 12 + k * 4, 40, 4, k % 2 ? "#96643c" : "#ac784a"); P.rect(2, 15 + k * 4, 40, 1, "#6e482a"); P.px(1, 13 + k * 4, INK); P.px(42, 13 + k * 4, INK); }
  P.rect(2, 11, 40, 1, INK); P.rect(2, 32, 40, 1, INK); P.rect(20, 0, 2, 13, "#6e482a");
  for (let j = 0; j < 10; j++) P.rect(22, 1 + j, Math.max(1, 8 - Math.abs(j - 5)), 1, "#f4ecd6");
  P.rect(6, 18, 3, 8, "#e2c47a"); return P.c;
}
function artCottage(roof) {                               // an empty cottage: someone could live here one day
  const P = paintCanvas(50, 48), x0 = 2, y0 = 8;
  P.shadow(x0 + 23, y0 + 36, 23, 3);
  for (let j = 0; j < 18; j++) for (let i = 0; i < 40; i++) P.px(x0 + 3 + i, y0 + 16 + j, j % 4 === 0 ? "#b4a48a" : (i % 13 === 0 ? "#b4a48a" : "#d2c4a6"));
  const dk = c => "#" + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * 0.78).toString(16).padStart(2, "0")).join("");
  for (let j = 0; j < 17; j++) for (let i = 0; i < 46; i++) P.px(x0 + i, y0 + j, j % 3 === 2 || (Math.floor(i / 4) + Math.floor(j / 3)) % 2 ? dk(roof) : roof);
  P.rect(x0 - 1, y0 + 16, 48, 1, INK); P.rect(x0 - 1, y0 - 1, 48, 1, INK); for (let j = 0; j < 17; j++) { P.px(x0 - 1, y0 + j, INK); P.px(x0 + 46, y0 + j, INK); }
  P.rect(x0 + 17, y0 + 22, 10, 12, "#5a4634"); P.rect(x0 + 16, y0 + 25, 12, 2, "#b08a5a"); P.rect(x0 + 16, y0 + 30, 12, 2, "#b08a5a");
  for (const wx of [x0 + 6, x0 + 32]) { P.rect(wx - 1, y0 + 20, 9, 8, INK); P.rect(wx, y0 + 21, 7, 6, "#465a6e"); P.rect(wx - 1, y0 + 23, 9, 1, "#b08a5a"); }
  P.rect(x0 + 3, y0 + 34, 40, 1, INK);
  return P.c;                                                // walls y 24..42
}
function artWell() { const P = paintCanvas(24, 26); P.shadow(11, 22, 10, 3); P.rect(2, 12, 18, 9, INK); P.rect(3, 13, 16, 7, "#9a9aa6"); for (let k = 0; k < 4; k++) P.rect(3 + k * 4, 13, 1, 7, "#7a7a86"); P.rect(5, 13, 12, 2, "#2a4664"); P.rect(3, 2, 2, 11, "#6e482a"); P.rect(17, 2, 2, 11, "#6e482a"); P.rect(1, 0, 20, 3, INK); P.rect(2, 1, 18, 1, "#a4463a"); P.rect(10, 3, 1, 8, "#c8b48c"); return P.c; }
function artLamp() { const P = paintCanvas(10, 24); P.shadow(4, 21, 4, 1); P.rect(4, 6, 2, 15, "#3c3c46"); P.rect(2, 1, 6, 6, INK); P.rect(3, 2, 4, 4, "#ffd678"); P.rect(3, 20, 4, 2, "#3c3c46"); return P.c; }
function artRock() { const P = paintCanvas(12, 9); P.shadow(5, 7, 5, 1); P.rows([".ssss.", "sslsss", "ssssss", ".ssss."], { s: "#8c8c96", l: "#b4b4be" }, 1, 2); return P.c; }
function artBarrel() { const P = paintCanvas(13, 14); P.shadow(6, 12, 5, 1); P.rows([".bbbbbbbb.", "bbbbbbbbbb", "kkkkkkkkkk", "bbbbbbbbbb", "bbbbbbbbbb", "kkkkkkkkkk", "bbbbbbbbbb", ".bbbbbbbb."], { b: "#a06c40", k: "#5a4030" }, 1, 2); return P.c; }
function artNPC(rows, pal) { const P = paintCanvas(rows[0].length + 2, rows.length + 4); P.shadow(rows[0].length / 2 + 1, rows.length + 1, 5, 2); P.rows(rows, pal, 1, 1); return P.c; }
const CAT_ROWS = ["e..e.", "eeee.", "ekek.", "eeeee", ".e.e."];

// ---- the shack, inside
function artBed() { const P = paintCanvas(28, 34); P.rect(0, 0, 28, 34, INK); P.rect(1, 1, 26, 32, "#7c5232"); P.rect(3, 3, 22, 8, "#f4ecd6"); P.rect(3, 12, 22, 19, "#4a78b4"); for (let k = 0; k < 4; k++) P.rect(3, 14 + k * 5, 22, 1, "#3c64a0"); return P.c; }
function artTable() { const P = paintCanvas(26, 20); P.shadow(12, 17, 11, 2); P.rect(0, 0, 26, 12, INK); P.rect(1, 1, 24, 10, "#a06c40"); P.rect(3, 12, 2, 6, "#6e482a"); P.rect(21, 12, 2, 6, "#6e482a"); P.rect(10, 3, 5, 4, "#f4ecd6"); return P.c; }
function artStove() { const P = paintCanvas(18, 24); P.rect(0, 0, 18, 22, INK); P.rect(1, 1, 16, 20, "#46464e"); P.rect(4, 10, 10, 7, "#2a2a30"); P.rect(5, 12, 8, 4, "#ff8c3c"); P.rect(7, -1, 4, 2, "#46464e"); return P.c; }
function artChest() { const P = paintCanvas(18, 14); P.rect(0, 0, 18, 13, INK); P.rect(1, 1, 16, 11, "#96643c"); P.rect(1, 5, 16, 1, "#603e26"); P.rect(8, 4, 2, 3, "#ffd246"); return P.c; }

// ---- areas. Terrain comes from smooth shapes painted pixel by pixel; tiles are classified from the same shapes.
// Tile kinds: g grass, s sand, w wet sand, t tidal flat (under water at high tide), a shallow, d deep, p path, k dock,
// f wood floor, x wall.
const TIDE_BAND = 40;
const AREAS = {
  port: {
    name: "THE PORT", w: 70, h: 50, outdoor: true,
    grass: x => 470 + 14 * Math.sin(x / 90) + 6 * Math.sin(x / 37 + 1),
    shore: x => 612 + 14 * Math.sin(x / 120 + 2) + 7 * Math.sin(x / 43),
    paths: [[[0, 452], [300, 446], [560, 452], [860, 444], [1120, 450]],          // the coast road, west to east
      [[600, 452], [604, 230], [600, 0]],                                          // north, between the cottages
      [[574, 452], [574, 600]],                                                     // down to the dock
      [[152, 446], [152, 410]], [[400, 446], [400, 412]], [[598, 412], [598, 300]],
      [[170, 244], [604, 236]], [[604, 236], [1010, 244]],                          // the back lane past the cottages
      [[860, 444], [900, 520]]],
    dock: [[560, 596, 32, 204], [592, 716, 64, 40]],
    exits: [{ side: "e", a: 410, b: 490, to: "flats", x: 14, y: 300 }, { side: "n", a: 560, b: 640, to: "lagoon", x: 560, y: 862 }, { side: "w", a: 410, b: 490, to: "woods", x: 1266, y: 560 }],
  },
  flats: {                                                    // the Tide Flats: the old garden, tide pools, the long beach
    name: "TIDE FLATS", w: 80, h: 60, outdoor: true,
    grass: x => 236 + 16 * Math.sin(x / 80) + 6 * Math.sin(x / 29 + 2),
    shore: x => 712 + 22 * Math.sin(x / 140 + 1) + 9 * Math.sin(x / 51),
    paths: [[[0, 300], [250, 300], [460, 340]], [[250, 300], [760, 296], [1100, 330]], [[760, 296], [820, 600]]],
    garden: [304, 368, 320, 192],                            // farmable ground (x, y, w, h): 20 x 12 tiles
    exits: [{ side: "w", a: 260, b: 340, to: "port", x: 1106, y: 450 }],
  },
  lagoon: {                                                   // the Lagoon: a freshwater lake, the river through it, the old hatchery
    name: "THE LAGOON", w: 70, h: 55, outdoor: true, fresh: true,
    lakes: [[480, 430, 250, 160], [300, 370, 120, 105], [650, 510, 140, 86]],
    river: [[[820, -20], [780, 120], [700, 230], [600, 300]], [[700, 470], [860, 520], [1000, 540], [1140, 560]]], riverW: 22,
    paths: [[[560, 880], [560, 700], [470, 650]], [[560, 700], [760, 690], [990, 600], [1120, 600]], [[470, 650], [300, 600], [140, 520], [140, 300], [560, 60], [600, -10]], [[760, 690], [760, 760]]],
    dock: [[460, 556, 24, 76], [988, 506, 30, 76]],           // a little pier into the lake, and a footbridge over the river
    exits: [{ side: "s", a: 520, b: 600, to: "port", x: 602, y: 24 }],
  },
  woods: {                                                    // Driftwood Woods: trees to chop, rocks to break, a pond
    name: "DRIFTWOOD WOODS", w: 80, h: 70, outdoor: true, fresh: true, forest: true,
    lakes: [[660, 780, 90, 56]], river: [], riverW: 0,
    paths: [[[1290, 560], [900, 560], [640, 480], [300, 420], [-10, 420]], [[640, 480], [640, 240], [600, -10]], [[900, 560], [760, 700]]],
    exits: [{ side: "e", a: 520, b: 600, to: "port", x: 14, y: 452 }],
  },
  aqua: { name: "THE AQUARIUM", w: 20, h: 12, outdoor: false, door: [9, 10], wall: [[40, 62, 90], [30, 48, 72]], floor: [[150, 170, 190], [128, 148, 170]] },
  shack: { name: "YOUR SHACK", w: 12, h: 10, outdoor: false },
};
function portObjects() {                                   // everything standing in the Port: [art key, x, y (top-left), solid rect (relative), act]
  const o = [];
  const add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act });
  const say = (...text) => ({ kind: "say", text });
  add("shack", 112, 334, [6, 50, 66, 24], { kind: "door", to: "shack", rect: [30, 74, 18, 6] });
  add("store", 370, 356, [4, 32, 56, 22], { kind: "restore", b: "store" });
  add("aquarium", 562, 340, [4, 32, 68, 28], { kind: "restore", b: "aquarium" });
  add("inn", 760, 352, [4, 32, 56, 22], { kind: "restore", b: "inn" });
  add("smoke", 940, 350, [4, 32, 56, 22], { kind: "restore", b: "smoke" });
  [[150, "#8a5246"], [300, "#52788a"], [440, "#6a6a4a"], [700, "#7a5a8a"], [850, "#52788a"], [990, "#8a5246"]].forEach(([x, rc], i) =>
    add("cot" + (i % 3), x, 176, [3, 26, 42, 16], say(["AN EMPTY COTTAGE. THE DOOR IS BOARDED UP.", "AN EMPTY COTTAGE. SOMEONE LEFT A TEAPOT ON THE STEP.", "AN EMPTY COTTAGE. IVY HAS TAKEN THE WINDOWS."][i % 3], "MAYBE SOMEONE WILL MOVE IN ONE DAY.")));
  add("yard", 870, 480, [4, 32, 56, 22], { kind: "restore", b: "yard" });
  add("well", 478, 404, [1, 10, 20, 10], { kind: "water" });
  add("board", 300, 400, [2, 22, 18, 6], say("WELCOME TO DRIFTWOOD ISLE. POP: 1", "SOMEONE HAS SCRATCHED UNDERNEATH: 'THE LIGHT WILL SHOW THE WAY.'"));
  add("crate", 530, 560, [1, 8, 15, 8], { kind: "crate" });
  add("cat", 551, 562, null, say("A SCRUFFY CAT. IT IS STARING AT THE CRATE."));
  add("wright", 566, 604, [2, 10, 10, 6], { kind: "talk" });
  add("raft", 652, 726, [2, 10, 40, 22], { kind: "raft" });
  add("bin", 196, 388, [1, 8, 20, 10], { kind: "bin" });
  add("stand", 438, 384, [1, 14, 28, 10], { kind: "shop" });
  [90, 250, 470, 700, 820, 1000].forEach(x => add("lamp", x, 418, [2, 18, 4, 3]));
  [[230, 520], [470, 590], [1010, 560], [70, 560]].forEach(([x, y]) => add("log", x, y, [2, 2, 22, 5]));
  [[96, 410], [690, 410], [1060, 410]].forEach(([x, y]) => add("barrel", x, y, [1, 6, 10, 6]));
  const r = seeded(77), A = AREAS.port;                      // trees along the top and between buildings, clear of everything else
  const clear = (x, y, w, h) => !o.some(q => x + w > q.x - 6 && x < q.x + IART[q.k].width + 6 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 18;
  for (let i = 0; i < 400; i++) {
    const x = r.uniform(-10, 1100), y = r.random() < 0.5 ? r.uniform(-30, 40) : r.uniform(40, A.grass(x) - 50), palm = r.random() < 0.5;
    const [w, h] = palm ? [28, 42] : [16, 12];
    if (!clear(x, y, w, h)) continue;
    if (palm) add("palm", x, y, [10, 30, 8, 6]); else add(r.random() < 0.5 ? "bush" : "bushb", x, y, [3, 6, 10, 4]);
  }
  for (let i = 0; i < 40; i++) { const x = r.uniform(0, 1100), y = r.uniform(A.grass(x) + 10, A.shore(x) - 30); if (clear(x, y, 10, 8)) add("rock", x, y, [1, 3, 8, 4]); }
  return o;
}
function shackObjects() {
  return [{ k: "bed", x: 20, y: 34, solid: [0, 0, 28, 34], act: { kind: "bed" } }, { k: "table", x: 120, y: 74, solid: [0, 4, 26, 12] },
    { k: "stove", x: 150, y: 28, solid: [0, 4, 18, 18], act: { kind: "cook" } },
    { k: "chest", x: 60, y: 34, solid: [0, 0, 18, 13], act: { kind: "say", text: ["A STORAGE CHEST. EMPTY."] } },
    { k: "door", x: 88, y: 148, solid: null, act: { kind: "door", to: "port", rect: [0, 0, 16, 12] } }];
}
function pathDist(A, x, y) {
  let best = 1e9;
  for (const pl of A.paths || []) for (let i = 1; i < pl.length; i++) {
    const [ax, ay] = pl[i - 1], [bx, by] = pl[i], dx = bx - ax, dy = by - ay, k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - k * dx, y - ay - k * dy));
  }
  return best;
}
function inDock(A, x, y) { return (A.dock || []).some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h); }
function freshDepth(A, x, y) {                              // how far inside the Lagoon's water a point is (px; negative = on land)
  let d = -99;
  for (const [cx, cy, rx, ry] of A.lakes) { const e = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2; d = Math.max(d, e * Math.min(rx, ry) * 0.5); }
  for (const pl of A.river) for (let i = 1; i < pl.length; i++) {
    const [ax, ay] = pl[i - 1], [bx, by] = pl[i], dx = bx - ax, dy = by - ay, k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    d = Math.max(d, A.riverW - Math.hypot(x - ax - k * dx, y - ay - k * dy));
  }
  return d;
}
function riverNear(A, x, y) { const sav = A.lakes; A.lakes = []; const d = freshDepth(A, x, y); A.lakes = sav; return d > -10; }
function terrainAt(A, x, y) {                               // -> tile kind at pixel x, y (outdoor areas)
  if (inDock(A, x, y)) return "k";
  if (A.fresh) {
    const d = freshDepth(A, x, y);
    if (d > 26) return "d";
    if (d > 0) return "a";
    if (d > -6) return "w";
    return pathDist(A, x, y) < 9 ? "p" : "g";
  }
  if (A.seaD) { const d = A.seaD(x, y); return d > 70 ? "d" : d > 0 ? "a" : d > -16 ? "s" : pathDist(A, x, y) < 9 ? "p" : "g"; }   // a headland with sea all round (part 7)
  const sh = A.shore(x);
  if (y >= sh + TIDE_BAND + 60) return "d";
  if (y >= sh + TIDE_BAND) return "a";
  if (y >= sh) return "t";
  if (A.garden && x >= A.garden[0] && x < A.garden[0] + A.garden[2] && y >= A.garden[1] && y < A.garden[1] + A.garden[3]) return "m";
  if (pathDist(A, x, y) < 9) return "p";
  if (y < A.grass(x)) return "g";
  return y > sh - 12 ? "w" : "s";
}
const TCOL = { g: [[96, 164, 80], [110, 178, 88], [84, 148, 72], [128, 192, 98]], s: [[236, 212, 158], [226, 200, 144], [244, 226, 180], [214, 186, 130]],
  p: [[204, 168, 116], [192, 156, 104], [214, 180, 128], [204, 168, 116]], m: [[150, 116, 82], [138, 106, 74], [162, 128, 92], [126, 96, 66]],
  f: [[70, 128, 64], [80, 140, 70], [60, 112, 56], [96, 156, 80]] };
function buildArea(id) {                                    // paint the ground once into a canvas; classify tiles
  const A = AREAS[id], W = A.w * TS, H = A.h * TS, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d"), img = x.createImageData(W, H), d = img.data, r = seeded(id.length * 991 + 7), tiles = [];
  const put = (i, col) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  if (A.outdoor) {
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4, n = r.random(), t = terrainAt(A, px, py);
      let col;
      if (t === "g") col = (A.forest ? TCOL.f : TCOL.g)[n < .7 ? 0 : n < .85 ? 1 : n < .97 ? 2 : 3];
      else if (t === "p") col = TCOL.p[n < .7 ? 0 : n < .85 ? 1 : 2];
      else if (t === "m") col = TCOL.m[n < .7 ? 0 : n < .85 ? 1 : n < .97 ? 2 : 3];
      else if (t === "k") { const yy = py - 596; col = yy % 4 === 0 ? [120, 80, 46] : [164, 114, 70]; if ((px - 560) % 32 === 0 || (px - 591) % 32 === 0) col = INKC; }
      else if (t === "s" || t === "w" || t === "t") { col = TCOL.s[n < .75 ? 0 : n < .9 ? 1 : n < .97 ? 2 : 3]; if (t !== "s") col = col.map(v => Math.round(v * (t === "t" ? 0.8 : 0.88))); }
      else if (A.fresh) { const dep = freshDepth(A, px, py); col = dep < 8 ? [104, 178, 168] : dep < 26 ? [72, 148, 156] : [52, 116, 140]; if (dep >= 26 && dep < 29 && (px + py) % 2) col = [72, 148, 156]; }
      else { const dep = A.seaD ? A.seaD(px, py) - 4 : py - A.shore(px) - TIDE_BAND; col = dep < 14 ? [118, 204, 214] : dep < 50 ? [78, 172, 204] : [52, 140, 190]; if (((dep >= 14 && dep < 17) || (dep >= 50 && dep < 53)) && (px + py) % 2) col = dep < 30 ? [118, 204, 214] : [78, 172, 204]; }
      put(i, col);
    }
    for (let k = 0; k < W * 0.8; k++) {                     // grass blades and tufts
      const px = Math.floor(r.random() * W), py = Math.floor(r.random() * H);
      if (terrainAt(A, px, py) === "g" && terrainAt(A, px, py + 1) === "g") { put((py * W + px) * 4, TCOL.g[3]); put(((py + 1) * W + px) * 4, TCOL.g[2]); }
    }
    const FL = [[250, 230, 120], [240, 140, 170], [250, 250, 250], [190, 150, 240]];
    for (let k = 0; k < W * H / 900; k++) {                 // little clusters of flowers
      const px = Math.floor(r.random() * W), py = Math.floor(r.random() * H), col = FL[Math.floor(r.random() * 4)];
      if (terrainAt(A, px, py) !== "g" || pathDist(A, px, py) < 14) continue;
      for (const [a, b] of [[0, 0], [2, 1], [-1, 2], [1, -2]]) if (r.random() < 0.8 && terrainAt(A, px + a, py + b) === "g") put(((py + b) * W + px + a) * 4, col);
    }
  } else {                                                  // the shack: plank floor, back wall
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4, tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      const dr = A.door || [5, 6], wall = ty < 2 || tx === 0 || tx === A.w - 1 || (ty === A.h - 1 && !dr.includes(tx));
      let col = wall ? (py % 8 === 0 ? [70, 46, 30] : [96, 64, 40]) : ((py % 8 === 0 || (px + (Math.floor(py / 8) % 2) * 12) % 24 === 0) ? [120, 82, 50] : [150, 104, 64]);
      if (A.wall && wall) col = py % 8 === 0 ? A.wall[1] : A.wall[0];
      if (A.floor && !wall) col = (Math.floor(px / 16) + Math.floor(py / 16)) % 2 ? A.floor[0] : A.floor[1];
      if (wall && ty === 1 && py % 16 > 12) col = A.wall ? [20, 30, 50] : [60, 40, 26];
      put(i, col);
    }
  }
  x.putImageData(img, 0, 0);
  if (id === "shack") {                                      // a window and a rug
    x.fillStyle = INK; x.fillRect(88, 6, 24, 16); x.fillStyle = "#9ad2ec"; x.fillRect(89, 7, 22, 14); x.fillStyle = "#6e482a"; x.fillRect(99, 7, 2, 14); x.fillRect(89, 13, 22, 2);
    x.fillStyle = "#a03c32"; x.fillRect(64, 92, 64, 36); x.fillStyle = "#c85a46"; x.fillRect(68, 96, 56, 28); x.fillStyle = "#e6c45a"; x.fillRect(72, 108, 48, 2);
  }
  for (let ty = 0; ty < A.h; ty++) { const row = []; for (let tx = 0; tx < A.w; tx++) {
    if (A.outdoor) row.push(terrainAt(A, tx * TS + 8, ty * TS + 8));
    else row.push(ty < 2 || tx === 0 || tx === A.w - 1 || (ty === A.h - 1 && !(A.door || [5, 6]).includes(tx)) ? "x" : "f");
  } tiles.push(row); }
  const objs = id === "port" ? portObjects() : id === "flats" ? flatsObjects() : id === "lagoon" ? lagoonObjects() : id === "woods" ? woodsObjects() : id === "aqua" ? aquaObjects() : shackObjects();
  const glints = [], pools = [];
  if (A.outdoor) for (let k = 0; k < 900 && glints.length < 120; k++) {
    const gx = r.random() * W, gy = r.random() * H, t = terrainAt(A, gx, gy);
    if ((t === "a" || t === "d") && !inDock(A, gx, gy)) glints.push([gx, gy, r.random() * 6]);
  }
  if (A.shore) for (const o of objs) if (o.k === "rock" && o.y > A.shore(o.x) && pools.length < (id === "flats" ? 12 : 4) && !pools.some(q => Math.hypot(q[0] - o.x, q[1] - o.y) < 40)) pools.push([o.x + 14, o.y + 4]);
  return { id, A, c, tiles, objs, W, H, glints, pools };
}
const INKC = [26, 22, 40];
function isleArt() {
  if (IART.shack) return;
  IART.palm = artPalm(); IART.bush = artBush(false); IART.bushb = artBush(true); IART.shack = artShack();
  IART.store = artRuin("STORE", ["#52788a", "#466874"]); IART.inn = artRuin("INN", ["#8a5246", "#744238"]); IART.smoke = artRuin("SMOKEHOUSE", ["#5a5a62", "#4a4a52"]);
  IART.yard = artRuin("SHIPYARD", ["#6a6a4a", "#58583c"]); IART.aquarium = artAquarium(); IART.board = artBoard(); IART.crate = artCrate(); IART.log = artLog();
  IART.pile = artPile(); IART.raft = artRaftMoored(); IART.wright = artNPC(ISLE_ART.wright[0], ISLE_ART.wright[1]); IART.cat = artNPC(CAT_ROWS, { e: "#5a5a64", k: "#fadc5a" });
  IART.cot0 = artCottage("#a4504a"); IART.cot1 = artCottage("#4a7894"); IART.cot2 = artCottage("#6a8a4a");
  IART.well = artWell(); IART.lamp = artLamp(); IART.rock = artRock(); IART.barrel = artBarrel();
  IART.fenceh = artFenceH(); IART.fencev = artFenceV(); IART.wbarrel = artWaterBarrel(); IART.bin = artBin(); IART.stand = artStand();
  IART.sgarden = artSign("THE OLD GARDEN"); IART.sport = artSign("PORT");
  IART.hatch = artRuin("HATCHERY", ["#5a7a8a", "#4a6874"]); IART.slagoon = artSign("THE LAGOON"); IART.reed = artReed(); IART.lily = artLily();
  IART.bed = artBed(); IART.table = artTable(); IART.stove = artStove(); IART.chest = artChest(); IART.door = paintCanvas(16, 12).c;
}

// ---- your character, from the topside wardrobe
function isleChar(view, legs, blink) {
  const ci = store.eq.char | 0, key = "pc" + ci + view + legs + (blink ? "b" : "");
  if (ISPR[key]) return ISPR[key];
  const ch = DATA.isle.chars[ci] || DATA.isle.chars[0], v = ch.views[view === "left" ? "side" : view];
  let rows = v[0].slice(); if (blink) rows = rows.map(r => r.split("e").join(ch.blink));
  rows = rows.concat([legs ? v[2] : v[1]]);
  if (view === "left") rows = rows.map(r => r.padEnd(12, ".").split("").reverse().join(""));
  return pix(key, rows, ch.pal);
}

// ---- time, weather, tides
const isleMin = () => isleSave().min;
function clockText(min) { const m = Math.floor(min / 10) * 10 % 1440, h = Math.floor(m / 60), mm = m % 60, h12 = h % 12 || 12; return h12 + ":" + (mm < 10 ? "0" : "") + mm + (h < 12 ? "AM" : "PM"); }
function weatherOf(s) {
  if (s.day === 1) return "sun";
  const r = seeded(s.year * 1000 + s.season * 40 + s.day).random();
  if (s.season === 3) return r < 0.3 ? "snow" : "sun";
  return r < (s.season === 1 ? 0.15 : 0.25) ? "rain" : "sun";
}
function tideLevel(s) {                                      // 1 = high tide, 0 = low; two lows a day, a little later each day
  const off = (s.day * 47 + s.season * 130) % 720;
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * (s.min - off) / 720);
}
function tideEdge(A, x, s) { return A.shore(x) + TIDE_BAND * (1 - tideLevel(s)); }   // water reaches down to here... and above it is dry
function darkness(min) {                                     // how dark it is outdoors, 0..0.55
  if (min < 420) return 0.12 * (1 - (min - DAY_START) / 60);
  if (min < 1080) return 0;
  return Math.min(0.55, 0.55 * (min - 1080) / 180);
}

// ---- entering and leaving
function startIsland() {
  isleArt();
  const s = isleSave(), first = !s.intro;
  S.state = "isle"; S.overlay = null;
  ISLE = { maps: {}, map: null, px: 0, py: 0, dir: "up", walk: 0, moving: false, msg: null, menu: null, fade: 1, target: null, saveT: 0, wake: 0, lastMin: s.min };
  isleResize();
  isleGo("port", 576, 744, "up");                          // the raft always lands at the dock
  const kit = ["HE HANDS YOU A HOE, A WATERING CAN, SEEDS, A ROD, A NET, AN AXE AND A PICK. 'THERE'S AN OLD GARDEN ON THE TIDE FLATS, EAST OF HERE. I CLEARED THE WAY.'",
    "'SELL WHAT YOU GROW IN THE BIN BY YOUR SHACK. MORE SEEDS AT THE STAND BY THE STORE.'"];
  if (first) { s.intro = 1; s.kit = 1; isleSay(["THE RAFT BUMPS AGAINST AN OLD DOCK.", "DRIFTWOOD ISLE. NOBODY HAS LIVED HERE IN YEARS.", "THE SHIPWRIGHT TIES THE RAFT UP. 'THAT SHACK UP THE HILL STILL HAS A ROOF. IT'S YOURS IF YOU WANT IT.'"].concat(kit)); }
  else if (!s.kit) { s.kit = 1; isleSay(["THE SHIPWRIGHT IS WAITING ON THE DOCK."].concat(kit)); }
  else isleSay(["DRIFTWOOD ISLE. " + SEASONS[s.season][0] + " " + s.day + ", YEAR " + s.year + "."]);
  forageCheck();
  if (s.woodsMsg) { s.woodsMsg = 0; ISLE.msg.pages.push("THE SHIPWRIGHT CLEARED THE DRIFTWOOD WEST OF THE PORT. HE LEFT YOU AN AXE AND A PICK.", "'DRIFTWOOD WOODS. WOOD AND STONE FOR FIXING THIS PLACE UP. C OPENS CRAFTING.'"); }
  if (s.rodMsg) { s.rodMsg = 0; ISLE.msg.pages.push("THE SHIPWRIGHT LEFT AN OLD FISHING ROD AND A NET ON YOUR STEP.", "'THE LAGOON'S OPEN, NORTH OF THE PORT. HOLD E TO CAST, LET GO TO THROW. THE NET IS FOR THE TIDE POOLS.'"); }
  saveStore(); play("plop");
}
function isleLeave() {
  isleStore(); saveStore();
  ISLE = null; newDive(); resize(); play("back");
}
function isleStore() { if (!ISLE || !ISLE.map) return; const s = isleSave(); s.area = ISLE.map.id; s.x = Math.round(ISLE.px); s.y = Math.round(ISLE.py); }
function isleGo(id, x, y, dir) {
  if (!ISLE.maps[id]) ISLE.maps[id] = buildArea(id);
  ISLE.map = ISLE.maps[id]; ISLE.px = x; ISLE.py = y; ISLE.dir = dir || ISLE.dir; ISLE.fade = 1; ISLE.target = null;
  isleStore();
}

// ---- messages and choices
function isleSay(pages, choice) { ISLE.msg = { pages: pages.slice(), i: 0, choice: choice || null, sel: 0, t: 0 }; }
function isleMsgAdvance() {
  const m = ISLE.msg;
  if (m.i < m.pages.length - 1) { m.i++; m.t = 0; play("tick"); return; }
  ISLE.msg = null;
  if (m.choice) m.choice.act[m.sel](); else play("tick");
}

// ---- moving about
function isleSolidAt(x, y) {                                 // is the point x, y blocked?
  const M_ = ISLE.map, s = isleSave();
  if (x < 0 || y < 0 || x >= M_.W || y >= M_.H) return true;
  const t = M_.tiles[Math.floor(y / TS)][Math.floor(x / TS)];
  if (t === "x" || t === "a" || t === "d") return true;
  if (t === "t" && y > tideEdge(M_.A, x, s) - 2) return true;   // the tide's in over this bit of beach
  for (const o of M_.objs) if (o.solid && !objGone(o)) { const [a, b, w, h] = o.solid; if (x >= o.x + a && x < o.x + a + w && y >= o.y + b && y < o.y + b + h) return true; }
  return placedSolidAt(x, y);
}
const feetBlocked = (x, y) => isleSolidAt(x - 4, y) || isleSolidAt(x + 4, y) || isleSolidAt(x - 4, y - 3) || isleSolidAt(x + 4, y - 3);
function facingPoint() { const d = { up: [0, -10], down: [0, 8], left: [-11, -2], right: [11, -2] }[ISLE.dir]; return [ISLE.px + d[0], ISLE.py + d[1]]; }
function objAt(x, y) {
  for (const o of ISLE.map.objs) {
    if (!o.act || objGone(o)) continue;
    const r = o.act.rect || (o.solid ? [o.solid[0] - 6, o.solid[1] - 6, o.solid[2] + 12, o.solid[3] + 16] : [0, 0, IART[o.k].width, IART[o.k].height]);
    if (x >= o.x + r[0] && x < o.x + r[0] + r[2] && y >= o.y + r[1] && y < o.y + r[1] + r[3]) return o;
  }
  return null;
}
const WRIGHT_LINES = ["'THESE OLD BUILDINGS COULD BE FIXED UP. BRING WOOD AND STONE FROM THE WOODS, AND SOME SAND DOLLARS.'", "'ONE FISH FROM EVERY DIVE YOU MAKE OUT THERE ENDS UP IN THE CRATE ON THE BEACH.'", "'THE OLD GARDEN'S ON THE TIDE FLATS. WATER WHAT YOU PLANT EVERY DAY, UNLESS IT RAINS.'",
  "'THINGS WASH UP ON THE BEACHES EVERY MORNING. SHELLS AND SUCH. THEY SELL.'", "'THE RAFT'S TIED UP AT THE END OF THE DOCK WHENEVER YOU WANT TO GO BACK.'", "'THIS WHOLE PORT WAS BUSY ONCE. BOATS EVERYWHERE.'",
  "'THOSE DRIFTWOOD PILES? I'LL CLEAR THEM WHEN THERE'S A REASON TO GO OUT THERE.'", "'THE MAN WHO LIVED IN YOUR SHACK WROTE A LOT OF LETTERS. PUT THEM IN BOTTLES, I HEARD.'"];
function isleAct(o) {
  const a = o.act, s = isleSave();
  if (a.kind === "say") isleSay(a.text);
  else if (a.kind === "talk") { isleSay([WRIGHT_LINES[(s.day + Math.floor(s.min / 120)) % WRIGHT_LINES.length]]); }
  else if (a.kind === "raft") isleSay(["SAIL BACK TO YOUR BOAT?"], { opts: ["YES", "NOT YET"], act: [isleLeave, () => play("tick")] });
  else if (a.kind === "bed") isleSay(["GO TO BED FOR THE NIGHT?"], { opts: ["SLEEP", "NOT YET"], act: [() => isleSleep(false), () => play("tick")] });
  else if (a.kind === "door") isleDoor(a.to, a.go);
  else if (a.kind === "bin") binAct();
  else if (a.kind === "shop") { ISLE.shop = { sel: 0 }; play("select"); }
  else if (a.kind === "water") canFill();
  else isleAct5(o);
}
function isleDoor(to, a) {
  play("tick");
  if (a && a.x !== undefined) isleGo(to, a.x, a.y, a.dir === "up" ? "up" : "down");
  else if (to === "shack") isleGo("shack", 96, 140, "up"); else isleGo("port", 151, 416, "down");
}
function isleSleep(passedOut) {                              // a new day: in bed, 6 am
  const s = isleSave();
  s.min = DAY_START; s.day++;
  if (s.day > SEASON_DAYS) { s.day = 1; s.season = (s.season + 1) % 4; if (s.season === 0) s.year++; }
  isleGo("shack", 34, 86, "down");
  ISLE.wake = 2.4;
  const paid = farmNewDay(s), news = s.news.splice(0);
  const w = weatherOf(s), wt = w === "rain" ? "IT'S RAINING. THE GARDEN GETS WATERED." : w === "snow" ? "IT'S SNOWING." : "IT'S A CLEAR DAY.";
  isleSay((passedOut ? ["YOU FELL ASLEEP WHERE YOU STOOD AND WOKE UP IN BED. NO HARM DONE."] : []).concat(paid ? ["THE BIN PAID " + paid + " SAND DOLLARS OVERNIGHT."] : []).concat(news).concat([SEASONS[s.season][0] + " " + s.day + ". " + wt]));
  saveStore(); play("select");
}

function isleUpdate(dt) {
  if (!ISLE) return;
  const I = ISLE, s = isleSave();
  I.fade = Math.max(0, I.fade - dt * 3); I.wake = Math.max(0, I.wake - dt);
  I.toasts = (I.toasts || []).filter(q => (q[1] -= dt) > 0);
  if (I.msg) { I.msg.t += dt; return; }
  if (I.menu || I.shop || I.inv || I.log || I.card || I.list || I.chest) return;
  shadowsTick(dt);
  if (I.fish) { fishTick(dt); if (I.fish && I.fish.phase !== "wait") return; }
  s.min += dt * GAME_MIN_PER_S;                              // the clock runs while you're out and about
  if (s.min >= DAY_END) { isleSleep(true); return; }
  if (Math.floor(s.min / 10) !== Math.floor(I.lastMin / 10) && I.map.A.outdoor && Math.floor(s.min / 60) !== Math.floor(I.lastMin / 60)) play("tick", 0.3);
  I.lastMin = s.min;
  let mx = heldDir("L", "R"), my = heldDir("U", "D");
  if (!mx && !my && I.target) {                              // tap to walk
    const dx = I.target[0] - I.px, dy = I.target[1] - I.py;
    if (Math.hypot(dx, dy) < 3) { const o = I.target[2]; I.target = null; if (o) isleTryAct(o); }
    else { mx = Math.abs(dx) > 2 ? Math.sign(dx) : 0; my = Math.abs(dy) > 2 ? Math.sign(dy) : 0; }
  } else if (mx || my) I.target = null;
  if (I.fish && (mx || my)) { I.fish = null; play("back"); }        // walking off reels the line in
  I.moving = !!(mx || my);
  if (I.moving) {
    I.dir = Math.abs(mx) > Math.abs(my) || (mx && !my) ? (mx < 0 ? "left" : "right") : (my < 0 ? "up" : "down");
    const k = (mx && my ? 0.7071 : 1) * WALK * dt, ex = isleExitAt(I.px + mx * k, I.py + my * k);
    if (ex) {
      const ns = ex.side === "n" || ex.side === "s";
      isleGo(ex.to, ns ? clamp(ex.x + (I.px - (ex.a + ex.b) / 2), 8, AREAS[ex.to].w * TS - 8) : ex.x, ns ? ex.y : clamp(ex.y + (I.py - (ex.a + ex.b) / 2), 8, AREAS[ex.to].h * TS - 8), I.dir);
      play("tick"); return;
    }
    if (mx && !feetBlocked(I.px + mx * k, I.py)) I.px += mx * k;
    if (my && !feetBlocked(I.px, I.py + my * k)) I.py += my * k;
    I.walk += dt;
    if (I.target && feetBlocked(I.px + mx * k, I.py) && feetBlocked(I.px, I.py + my * k)) { const o = I.target[2]; I.target = null; if (o) isleTryAct(o); }
  } else I.walk = 0;
  for (const o of I.map.objs) if (o.act && o.act.kind === "door" && o.act.rect) {   // walking into a door goes through it
    const [a, b, w, h] = o.act.rect, inside = I.px >= o.x + a && I.px < o.x + a + w && I.py >= o.y + b && I.py < o.y + b + h;
    if (inside && I.dir === (o.act.dir || (o.act.to === "shack" ? "up" : "down")) && I.moving) { isleDoor(o.act.to, o.act.go); break; }
  }
  I.saveT += dt; if (I.saveT > 10) { I.saveT = 0; isleStore(); saveStore(); }
}
function isleTryAct(o) { const d = Math.hypot((o.x + (o.solid ? o.solid[0] + o.solid[2] / 2 : 8)) - ISLE.px, (o.y + (o.solid ? o.solid[1] + o.solid[3] / 2 : 8)) - ISLE.py); if (d < 48) isleAct(o); }
function isleInteract() {
  if (ISLE.msg) { isleMsgAdvance(); return; }
  if (ISLE.menu) { isleMenuPick(); return; }
  if (ISLE.shop) { shopPick(1); return; }
  if (ISLE.inv) { invPick(); return; }
  if (ISLE.card) { ISLE.card = null; play("tick"); return; }
  if (ISLE.list) { listPick(false); return; }
  if (ISLE.chest) { chestPick(); return; }
  if (ISLE.log) { ISLE.log = null; return; }
  if (ISLE.fish) { fishPress(); return; }
  const [fx, fy] = facingPoint(), f = forageAt(fx, fy) || forageAt(ISLE.px, ISLE.py - 4);
  if (f) { forageTake(f); return; }
  const o = objAt(fx, fy) || objAt(ISLE.px, ISLE.py - 4);
  if (o) { isleAct(o); return; }
  if (potInteract()) return;
  if (placedInteract()) return;
  const it = held();
  if (it && (it[0] === "axe" || it[0] === "pick")) { toolHit(it[0]); return; }
  if (it && ITEMS[it[0]].kind === "place") { placeItem(); return; }
  if (it && it[0] === "mulch") { mulchUse(); return; }
  if (it && it[0] === "rod") { fishPress(); return; }
  if (it && it[0] === "net") { netUse(); return; }
  if (it && it[0] === "pot") { potPlace(); return; }
  isleUse();
}

// ---- drawing
function isleCam() {
  const M_ = ISLE.map;
  const cx = M_.W <= IW ? -(IW - M_.W) / 2 : clamp(ISLE.px - IW / 2, 0, M_.W - IW);
  const cy = M_.H <= IH ? -(IH - M_.H) / 2 : clamp(ISLE.py - 8 - IH / 2, 0, M_.H - IH);
  return [Math.round(cx), Math.round(cy)];
}
function drawIsle() {
  const I = ISLE, M_ = I.map, s = isleSave(), [cx, cy] = isleCam(), t = T, A = M_.A;
  g.fillStyle = A.outdoor ? "#2c5a8c" : "#0c0a14"; g.fillRect(0, 0, IW, IH);
  g.drawImage(M_.c, -cx, -cy);
  if (A.outdoor && !A.shore) for (const [x, y, ph] of M_.glints) if (Math.sin(t * 1.6 + ph) > 0.5 && x > cx - 4 && x < cx + IW && y > cy && y < cy + IH) rect("#a6dcd6", x - cx + Math.round(Math.sin(t + ph) * 2), y - cy, 3, 1);
  if (A.outdoor && A.shore) {                                // the tide over the flats, foam, and glints on the water
    const lv = tideLevel(s);
    for (let x = Math.max(0, cx - (cx % 2)); x < Math.min(M_.W, cx + IW + 2); x += 2) {
      const sh = A.shore(x), e = tideEdge(A, x, s), bot = sh + TIDE_BAND;
      if (e < bot) { rect("#76ccd6", x - cx, Math.floor(e - cy), 2, Math.ceil(bot - e) + 1); rect(Math.sin(x / 7 + t * 2) > 0 ? "#f0fafc" : "#d2f0f6", x - cx, e - cy, 2, 1); }
    }
    for (const [a, b, w, h] of A.dock || []) g.drawImage(M_.c, a, b, w, h, a - cx, b - cy, w, h);   // the dock stands above the tide
    const gr = seeded(3);
    for (let k = 0; k < 90; k++) {
      const x = gr.uniform(0, M_.W), y = gr.uniform(640, M_.H), ph = gr.random() * 6;
      if (y < tideEdge(A, x, s) + 6 || inDock(A, x, y)) continue;
      if (Math.sin(t * 1.6 + ph) > 0.5) rect("#aae2ec", x - cx + Math.round(Math.sin(t + ph) * 2), y - cy, 3, 1);
    }
    void lv;
  }
  drawFarmSoil(cx, cy); drawPools(cx, cy); drawShadows(cx, cy); drawPots(cx, cy);
  drawPlacedFlat(cx, cy);
  const list = M_.objs.filter(o => !objGone(o) || o.res.kind === "tree").map(o => [o.y + (o.solid ? o.solid[1] + o.solid[3] : IART[o.k].height - 2), o]);
  placedSprites(list);
  list.push([I.py, null]);
  farmSprites(list); forageSprites(list);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, o] of list) {
    if (o && o.draw) { o.draw(cx, cy); continue; }
    if (o) {
      if (o.k === "raft") { g.drawImage(IART.raft, o.x - cx, o.y - cy + Math.round(Math.sin(t * 2) * 1)); continue; }
      if (o.k === "cat") { g.drawImage(IART.cat, o.x - cx, o.y - cy - (Math.floor(t * 0.7) % 4 === 0 ? 1 : 0)); continue; }
      if (o.k === "wright") { g.drawImage(IART.wright, o.x - cx, o.y - cy + (Math.floor(t * 1.4) % 2)); continue; }
      if (o.k === "door") continue;
      if (objGone(o)) { g.drawImage(IART.stump, o.x - cx + 6, o.y - cy + IART[o.k].height - 12); continue; }
      g.drawImage(IART[artKey(o)], o.x - cx + (o.hit > 0 ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0), o.y - cy);
      if (o.hit > 0) { o.hit -= 1 / 60; }
      if (o.k === "tank") drawTankFish(o, cx, cy);
      if (o.k === "shack") for (let k = 0; k < 3; k++) { const u = (t * 0.45 + k / 3) % 1; g.globalAlpha = 0.7 * (1 - u); rect("#e6e6ec", o.x - cx + 58 + Math.round(Math.sin(u * 6 + k) * 2 + u * 4), o.y - cy + 12 - Math.round(u * 16), 2 + Math.round(u * 2), 2); g.globalAlpha = 1; }
    } else if (o === null) drawIslePlayer(I.px - cx, I.py - cy, t);
  }
  const [fx, fy] = facingPoint(), near = !I.msg && !I.menu && !I.shop && !I.inv && !I.fish && !I.list && !I.chest && (forageAt(fx, fy) || forageAt(I.px, I.py - 4) || objAt(fx, fy) || objAt(I.px, I.py - 4));
  if (!near && !I.msg && !I.menu && !I.shop && !I.inv && A.outdoor) drawTileCursor(cx, cy);
  if (near) { const bx = Math.round(I.px - cx), by = Math.round(I.py - cy) - 26 + Math.round(Math.sin(t * 5)); rect(INK, bx - 4, by - 4, 9, 9); rect(WHITE, bx - 3, by - 3, 7, 7); text("E", bx + 1, by + 1, 1, INK, "center", null); }
  if (A.outdoor) {                                          // weather and night
    const w = weatherOf(s);
    if (w === "rain") { g.globalAlpha = 0.12; rect("#283c64", 0, 0, IW, IH); g.globalAlpha = 1; for (let k = 0; k < 90; k++) { const x = (k * 53 + t * 40) % (IW + 20) - 10, y = (k * 97 + t * 260) % (IH + 20) - 10; rect("#b4c8e6", x, y, 1, 4); } }
    if (w === "snow") for (let k = 0; k < 70; k++) { const x = (k * 53 + Math.sin(t + k) * 8 + t * 6) % IW, y = (k * 97 + t * 30) % IH; rect("#ffffff", x, y, 1, 1); }
    const dk = darkness(s.min);
    if (dk > 0) {
      g.globalAlpha = dk; rect("#141a40", 0, 0, IW, IH); g.globalAlpha = 1;
      g.globalCompositeOperation = "lighter"; g.globalAlpha = dk * 0.5;
      for (const o of M_.objs) if (o.k === "lamp") disc("#ffc864", o.x - cx + 5, o.y - cy + 4, 9);
      for (const p of s.placed) if (p.a === M_.id && PL[p.id].light) disc("#ffc864", p.x * TS + 8 - cx, p.y * TS + 2 - cy, 10);
      for (const o of M_.objs) if (o.k === "shack") { disc("#ffb450", o.x - cx + 19, o.y - cy + 58, 10); disc("#ffb450", o.x - cx + 57, o.y - cy + 58, 10); disc("#ff9640", o.x - cx + 72, o.y - cy + 68, 8); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
  } else if (A.cave) caveDark(cx, cy);
  else { const dk = darkness(s.min) * 0.5; if (dk > 0) { g.globalAlpha = dk; rect("#141a40", 0, 0, IW, IH); g.globalAlpha = 1; } }
  drawIsleHud(s);
  drawFishing(cx, cy);
  drawToolbar(s); drawToasts();
  if (I.msg) drawIsleMsg(I.msg);
  if (I.shop) drawShopIsle();
  if (I.inv) drawInvIsle();
  if (I.log) drawLogIsle();
  if (I.list) drawList();
  if (I.chest) drawChest();
  if (I.card) drawCatchCard();
  if (I.menu) drawIsleMenu();
  if (I.fade > 0) { g.globalAlpha = I.fade; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1; }
}
function drawIslePlayer(x, y, t) {
  const I = ISLE, legs = I.moving ? Math.floor(I.walk * 7) % 2 : 0, blink = Math.floor(t * 0.5 + 0.3) % 6 === 0 && (t * 0.5 % 1) < 0.1;
  const c = isleChar(I.dir === "down" ? "front" : I.dir === "up" ? "back" : I.dir === "left" ? "left" : "side", legs, blink && I.dir === "down");
  g.globalAlpha = 0.22; g.fillStyle = "#000"; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), 6, 2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height + 1 - (I.moving && legs ? 1 : 0)));
}
function islePanel(x, y, w, h) { rect("#3c2c22", x + 1, y, w - 2, h); rect("#3c2c22", x, y + 1, w, h - 2); rect("#f4e4c0", x + 1, y + 1, w - 2, h - 2); rect("#e8d4aa", x + 2, y + 2, w - 4, h - 4); }
function drawIsleHud(s) {
  const x = IW - 68, BR = "#5a3c28";
  islePanel(x, 4, 64, 44);
  text(SEASONS[s.season][1] + " " + s.day, x + 5, 11, 1, BR, "left", null);
  const night = s.min >= 1080;
  if (night) { disc("#f0e6c8", x + 7, 23, 3); disc("#e8d4aa", x + 8, 22, 2); } else { rect("#ffbe3c", x + 5, 21, 5, 5); rect("#ffbe3c", x + 7, 19, 1, 9); rect("#ffbe3c", x + 3, 23, 9, 1); }
  text(clockText(s.min).replace(/[AP]M$/, ""), x + 13, 23, 1, BR, "left", null); text(clockText(s.min).slice(-2), x + 60, 23, 1, "#8c6c50", "right", null);
  rect("#f0ecdc", x + 5, 32, 5, 5); rect("#bea88c", x + 6, 33, 1, 1); rect("#bea88c", x + 8, 35, 1, 1);
  text(s.sd, x + 13, 35, 1, BR, "left", null);
  islePanel(4, 4, 16, 14); for (let k = 0; k < 3; k++) rect(BR, 7, 7 + k * 3, 10, 1);   // the menu button
  if (ISLE.map && ISLE.fade > 0.4) text(ISLE.map.A.name, IW / 2, 14, 1, WHITE, "center");
}
function isleMsgBox() { const w = Math.min(IW - 16, 300), h = 46; return [Math.round((IW - w) / 2), IH - h - 6, w, h]; }
function drawIsleMsg(m) {
  const [x, y, w, h] = isleMsgBox(), lines = wrap(m.pages[m.i], Math.floor((w - 12) / 6)), n = Math.min(lines.length, 4), shown = Math.floor(m.t * 60);
  islePanel(x, y, w, h);
  let left = shown;
  lines.slice(0, 4).forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length; text(part, x + 6, y + 9 + i * 9, 1, "#3c2c22", "left", null); });
  void n;
  const done = left >= 0;
  if (m.choice && m.i === m.pages.length - 1 && done) {
    m.choice.opts.forEach((o, i) => { const bx = x + w - 64, by = y - 14 - (m.choice.opts.length - 1 - i) * 13; islePanel(bx, by, 60, 12); text((m.sel === i ? "> " : "  ") + o, bx + 4, by + 6, 1, m.sel === i ? "#b4461e" : "#3c2c22", "left", null); });
  } else if (done && Math.floor(T * 3) % 2) rect("#3c2c22", x + w - 9, y + h - 7, 4, 3);
}
const ISLE_MENU = [["RESUME", () => { ISLE.menu = null; }], ["ISLAND LOG", () => { ISLE.menu = null; ISLE.log = { page: 0, sel: 0 }; }], ["CRAFTING", () => { ISLE.menu = null; openCraft(); }], ["GO BACK TO YOUR BOAT", () => { ISLE.menu = null; isleLeave(); }]];
function drawIsleMenu() {
  g.globalAlpha = 0.5; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  const w = 160, h = 22 + ISLE_MENU.length * 16 + 26, x = Math.round((IW - w) / 2), y = Math.round((IH - h) / 2), s = isleSave();
  islePanel(x, y, w, h);
  text("DRIFTWOOD ISLE", x + w / 2, y + 10, 1, "#b4461e", "center", null);
  ISLE_MENU.forEach(([lab], i) => { const by = y + 20 + i * 16; rect(ISLE.menu.sel === i ? "#f4e4c0" : "#e8d4aa", x + 8, by, w - 16, 13); if (ISLE.menu.sel === i) outline(x + 8, by, w - 16, 13, "#b4461e"); text(lab, x + w / 2, by + 7, 1, "#3c2c22", "center", null); });
  const by = y + 24 + ISLE_MENU.length * 16;
  text(SEASONS[s.season][0] + " " + s.day + ", YEAR " + s.year, x + w / 2, by + 4, 1, "#8c6c50", "center", null);
  text("WASD MOVE  E USE  TAB BAG", x + w / 2, by + 14, 1, "#8c6c50", "center", null);
}
function isleMenuPick() { ISLE_MENU[ISLE.menu.sel][1](); play("select"); }

// ---- input (from game.js while S.state === "isle")
function isleKey(e, down) {
  if (!ISLE || !down) return;
  const c = e.code, I = ISLE;
  if (I.card) { if (["Space", "Enter", "KeyE", "Escape"].includes(c)) { e.preventDefault(); I.card = null; play("tick"); } return; }
  if (I.log && !I.msg) { logKey(e); return; }
  if (I.list && !I.msg) { listKey(e); return; }
  if (I.chest && !I.msg) { chestKey(e); return; }
  if (c === "KeyC" && !I.msg && !I.menu && !I.fish) { openCraft(); return; }
  if (I.shop && !I.msg) { shopKey(e); return; }
  if (I.inv && !I.msg) { invKey(e); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); isleInteract(); return; }
  if (c === "Escape") { e.preventDefault(); if (I.msg) { I.msg = null; return; } I.menu = I.menu ? null : { sel: 0 }; play("tick"); return; }
  if (c === "KeyL" && !I.msg && !I.menu) { I.log = { page: 0, sel: 0 }; play("select"); return; }
  if ((c === "Tab" || c === "KeyI") && !I.msg && !I.menu) { e.preventDefault(); I.inv = { sel: isleSave().sel, held: -1 }; play("select"); return; }
  if (/^Digit[1-9]$/.test(c) && !I.msg && !I.menu) { isleSave().sel = +c.slice(5) - 1; play("tick"); return; }
  if ((c === "KeyQ" || c === "BracketLeft" || c === "BracketRight") && !I.msg && !I.menu) { const d = c === "KeyQ" || c === "BracketRight" ? 1 : -1; isleSave().sel = (isleSave().sel + d + 9) % 9; play("tick"); return; }
  const v = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
  if (v && I.menu) { I.menu.sel = (I.menu.sel + v + ISLE_MENU.length) % ISLE_MENU.length; play("tick"); }
  else if (v && I.msg && I.msg.choice && I.msg.i === I.msg.pages.length - 1) { I.msg.sel = (I.msg.sel + v + I.msg.choice.opts.length) % I.msg.choice.opts.length; play("tick"); }
}
function islePos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * IW, (e.clientY - r.top) / r.height * IH]; }
function isleTouch(e) {
  if (!ISLE) return;
  const [x, y] = islePos(e), I = ISLE;
  if (I.menu) {
    const w = 160, h = 22 + ISLE_MENU.length * 16 + 26, mx = Math.round((IW - w) / 2), my = Math.round((IH - h) / 2), i = Math.floor((y - my - 20) / 16);
    if (x >= mx && x < mx + w && i >= 0 && i < ISLE_MENU.length) { I.menu.sel = i; isleMenuPick(); } else I.menu = null;
    return;
  }
  if (I.msg) {
    const m = I.msg, [bx0, by0, bw] = isleMsgBox();
    if (m.choice && m.i === m.pages.length - 1) {
      const k = m.choice.opts.findIndex((o, i) => { const bx = bx0 + bw - 64, by = by0 - 14 - (m.choice.opts.length - 1 - i) * 13; return x >= bx && x < bx + 60 && y >= by && y < by + 12; });
      if (k >= 0) { m.sel = k; isleMsgAdvance(); }
      return;
    }
    isleMsgAdvance(); return;
  }
  if (I.card) { I.card = null; play("tick"); return; }
  if (I.log) { logTouch(x, y); return; }
  if (I.list) { listTouch(x, y); return; }
  if (I.chest) { chestTouch(x, y); return; }
  if (I.shop) { shopTouch(x, y); return; }
  if (I.inv) { invTouch(x, y); return; }
  if (x < 22 && y < 20) { I.menu = { sel: 0 }; play("tick"); return; }
  if (toolbarTouch(x, y)) return;
  if (I.fish) { fishPress(); return; }
  { const it = held(), [cx0, cy0] = isleCam(), wx0 = x + cx0, wy0 = y + cy0;     // holding the rod: a tap on water casts toward it
    if (it && it[0] === "rod" && (I.map.A.outdoor || I.map.A.cave) && isWaterAt(wx0, wy0)) { const dx = wx0 - I.px, dy = wy0 - I.py; I.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"); fishPress(); I.touchFish = true; return; } }
  const [cx, cy] = isleCam(), wx = x + cx, wy = y + cy, o = objAt(wx, wy), f = forageAt(wx, wy);
  if (f && Math.hypot(wx - I.px, wy - I.py) < 30) { forageTake(f); return; }
  if (o && Math.hypot(wx - I.px, wy - I.py) < 36) { isleAct(o); return; }
  const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS), ptx = Math.floor(I.px / TS), pty = Math.floor((I.py - 4) / TS);
  if (!o && Math.abs(tx - ptx) <= 1 && Math.abs(ty - pty) <= 1 && (tx !== ptx || ty !== pty) && I.map.A.outdoor) {   // a tap next to you uses what you're holding there
    I.dir = Math.abs(tx - ptx) >= Math.abs(ty - pty) ? (tx < ptx ? "left" : "right") : (ty < pty ? "up" : "down");
    isleUse(tx, ty); return;
  }
  I.target = [wx, wy + 6, o];
}

// =====================================================================================================================
// Part 3: farming and selling. The Tide Flats open east of the Port with the old garden (20 x 12 tiles of good ground).
// A hoe tills it, the watering can waters it (refill at the well, the garden barrel or the sea), seeds from the stand by
// the store grow a stage for each watered day (rain waters everything) and die if their season ends. Sell in the bin by
// your shack; it pays overnight. Things wash up on the beaches each morning. Toolbar of 9 + a bag of 9 more.
const INV_N = 18, WATER_MAX = 30;
// [id, name, seasons, days to grow, seed price, sells for, regrows every (0 = once), shape, leaf, fruit]
const CROPS = [
  ["lettuce", "SEA LETTUCE", [0], 3, 15, 28, 0, "leaf", "#5ac85a", "#9ae67a"], ["kale", "SEA KALE", [0], 4, 20, 38, 0, "leaf", "#3c9a6a", "#7ad2a0"],
  ["onion", "SALT ONION", [0], 5, 25, 50, 0, "bulb", "#6ab45a", "#f0e6d2"], ["pea", "BEACH PEA", [0], 5, 25, 18, 3, "vine", "#5ab45a", "#a0e05a"],
  ["glasswort", "GLASSWORT", [0], 6, 30, 62, 0, "tall", "#4ab478", "#8cf0b4"], ["beet", "SEA BEET", [0], 7, 40, 84, 0, "bulb", "#4a9a5a", "#b43c5a"],
  ["berry", "DUNE BERRY", [0], 8, 60, 32, 4, "bush", "#5ab45a", "#f05050"], ["kelp", "KELP SPROUT", [0, 1], 8, 50, 105, 0, "tall", "#3c8c5a", "#8cb43c"],
  ["samphire", "SAMPHIRE", [1], 4, 20, 42, 0, "tall", "#5ac85a", "#a0f078"], ["dulse", "DULSE", [1], 5, 30, 62, 0, "leaf", "#a03c50", "#dc6478"],
  ["pepper", "CORAL PEPPER", [1], 5, 40, 22, 3, "bush", "#4a9a4a", "#ff6e46"], ["grape", "SEA GRAPES", [1], 6, 40, 26, 3, "vine", "#4ab45a", "#5ad2b4"],
  ["squash", "SUNFIN SQUASH", [1], 7, 50, 105, 0, "round", "#5aa04a", "#ffbe3c"], ["oyster", "OYSTER PLANT", [1], 9, 70, 150, 0, "leaf", "#5a8cb4", "#b4dcf0"],
  ["tomato", "BEACH TOMATO", [1], 10, 50, 36, 4, "vine", "#4a9a4a", "#f04646"], ["melon", "SAND MELON", [1], 12, 80, 260, 0, "round", "#4a9a4a", "#e6d28c"],
  ["nori", "NORI", [2], 4, 25, 52, 0, "leaf", "#2c5a3c", "#46825a"], ["potato", "SALT POTATO", [2], 6, 40, 82, 0, "bulb", "#6a9a4a", "#c8a06e"],
  ["redkelp", "RED KELP", [2], 7, 50, 105, 0, "tall", "#8c3c3c", "#c85a46"], ["bean", "SEA BEANS", [2], 8, 40, 26, 3, "vine", "#5a9a4a", "#8cc85a"],
  ["bog", "BOG BERRY", [2], 7, 120, 58, 5, "bush", "#4a7a4a", "#c83c5a"], ["cabbage", "FOG CABBAGE", [2], 9, 60, 140, 0, "round", "#6aa08c", "#b4dcc8"],
  ["corn", "AMBER CORN", [1, 2], 12, 80, 48, 4, "tall", "#6aa04a", "#ffd246"], ["pumpkin", "DRIFT PUMPKIN", [2], 13, 100, 330, 0, "round", "#4a8a4a", "#ff8c32"],
  ["icelettuce", "ICE LETTUCE", [3], 5, 30, 62, 0, "leaf", "#8cc8dc", "#dcf0fa"], ["frostkelp", "FROST KELP", [3], 6, 40, 92, 0, "tall", "#4a8c9a", "#a0d2e6"],
  ["wrack", "WINTER WRACK", [3], 8, 50, 124, 0, "bush", "#6a6a3c", "#c8be5a"], ["pearlonion", "PEARL ONION", [3], 10, 90, 230, 0, "bulb", "#6aa08c", "#f6f2fa"],
];
const CROP = {}; CROPS.forEach(c => { CROP[c[0]] = { id: c[0], name: c[1], seasons: c[2], days: c[3], price: c[4], sell: c[5], regrow: c[6], shape: c[7], leaf: c[8], fruit: c[9] }; });
const ITEMS = { hoe: { name: "HOE", kind: "tool" }, can: { name: "WATERING CAN", kind: "tool" },
  shell: { name: "SEA SHELL", kind: "forage", sell: 12 }, drift: { name: "DRIFTWOOD", kind: "forage", sell: 6 }, glass: { name: "SEA GLASS", kind: "forage", sell: 25 },
  starfish: { name: "STARFISH", kind: "forage", sell: 40 }, pearl: { name: "PEARL", kind: "forage", sell: 300 } };
CROPS.forEach(c => { ITEMS["s_" + c[0]] = { name: c[1] + " SEEDS", kind: "seed", crop: c[0] }; ITEMS[c[0]] = { name: c[1], kind: "crop", sell: c[5], crop: c[0] }; });
const sellable = id => ITEMS[id] && ITEMS[id].sell;

// ---- the bag
function invAdd(id, n) {                                      // -> how many didn't fit
  const inv = isleSave().inv;
  for (let i = 0; i < inv.length && n > 0; i++) if (inv[i] && inv[i][0] === id && ITEMS[id].kind !== "tool") { inv[i][1] += n; n = 0; }
  for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { inv[i] = [id, n]; n = 0; }
  return n;
}
function invUse(slot, n) { const inv = isleSave().inv; if (!inv[slot]) return; inv[slot][1] -= n || 1; if (inv[slot][1] <= 0) inv[slot] = null; }
const held = () => isleSave().inv[isleSave().sel];
function toast(t, col) { ISLE.toasts = (ISLE.toasts || []).concat([[t, 2.2, col || WHITE]]).slice(-3); }

// ---- item icons and crop sprites
function trimRows(rows) {
  let l = 99, r = 0; rows.forEach(row => [...row].forEach((ch, i) => { if (ch !== ".") { l = Math.min(l, i); r = Math.max(r, i); } }));
  return rows.map(row => row.padEnd(r + 1, ".").slice(l, r + 1));
}
const CROP_ROWS = {
  leaf: [["l.l", ".l."], ["l...l", "lll.lll", "..lll..", "...l..."], [".l..l.l..l.", "llll.l.llll", ".lldllldll.", "..llllll...", "....ll....."], ["..f.f..f.f.", ".fff.f.fff.", "ffllflflff.", ".lldllldll.", "..llllll...", "....ll....."]],
  bulb: [["l", "l"], ["l.l", ".l.", ".l."], ["l.l.l", ".lll.", "..l..", "..l.."], ["l.l.l", ".lll.", ".fff.", "fffff", ".fff."]],
  vine: [["l", "s"], [".s.", "lsl", ".s.", "lsl", ".s."], [".lsl.", "llsll", ".lsl.", "llsll", ".lsl.", "..s.."], [".flslf", ".llsll", "fllslf", ".llsll", ".flslf", "...s.."]],
  tall: [["l", "l"], [".l", "ll", ".l", ".l"], ["..l..", ".lll.", "l.l.l", "..l..", ".ll..", "..l..", "..l.."], ["..l...", ".lfl..", ".lfll.", ".lflll", "l.f.l.", "..l...", ".ll...", "..l..."]],
  round: [["l.l"], ["l.l", ".l."], [".l..l..", ".llll.l", "lldlll.", "..ll..."], ["..l..l..", ".lsl....", ".ffffff.", "ffhfffff", "ffffffff", ".gffffg."]],
  bush: [["l.l"], [".l.l", "lll.", ".l.."], ["l.lll.l", "lllllll", ".lldll.", "..lll..", "...s..."], ["lflllfl", "llflfll", ".flflf.", "..lll..", "...s..."]],
};
const shade = (c, k) => "#" + [1, 3, 5].map(i => clamp(Math.round(parseInt(c.slice(i, i + 2), 16) * k), 0, 255).toString(16).padStart(2, "0")).join("");
function cropSprite(id, stage, dead) {
  const key = "crop_" + id + stage + (dead ? "x" : "");
  if (ISPR[key]) return ISPR[key];
  const c = CROP[id];
  if (dead) return pix(key, ["s..s", ".ss.", ".s.."], { s: "#7a5a3a" });
  if (stage === 0) return pix(key, ["s.s", ".s."], { s: "#5a3c24" });
  return pix(key, trimRows(CROP_ROWS[c.shape][stage - 1]), { l: c.leaf, d: shade(c.leaf, 0.7), f: c.fruit, h: shade(c.fruit, 1.25), g: shade(c.fruit, 0.75), s: "#7a5a3a" });
}
function itemIcon(id) {
  const key = "icon_" + id;
  if (ISPR[key]) return ISPR[key];
  const it = ITEMS[id];
  if (id === "hoe") return pix(key, ["....ss", "...s..", "..b...", ".b....", "b....."], { s: "#a0a8b8", b: "#96683e" });
  if (id === "can") return pix(key, ["..bbb...", ".b...b..", "bbbbbb.w", "bccccbbw", "bccccb..", ".bbbb..."], { b: "#4a78b4", c: "#78a8dc", w: "#4a78b4" });
  if (id === "shell") return pix(key, [".p.p.p.", "ppppppp", ".ppppp.", "..ppp..", "...p..."], { p: "#f0b4c8" });
  if (id === "drift") return pix(key, ["......dd", "....ddd.", "..ddd...", "dddd....", ".d......"], { d: "#b49a78" });
  if (id === "glass") return pix(key, [".gg.", "gwgg", "gggg", ".gg."], { g: "#6edcc8", w: "#d2fff4" });
  if (id === "starfish") return pix(key, ["..o..", "ooooo", ".ooo.", "o...o"], { o: "#ff8c46" });
  if (id === "pearl") return pix(key, [".ww.", "wwhw", "wwww", ".ww."], { w: "#ece8f4", h: "#ffffff" });
  if (it.kind === "seed") { const c = CROP[it.crop]; return pix(key, ["pppppp", "pffffp", "pfllfp", "pffffp", "pppppp"], { p: "#d2b482", f: "#f4e6c8", l: c.fruit }); }
  const c = CROP[it.crop], sh = c.shape, pal = { l: c.leaf, f: c.fruit, h: shade(c.fruit, 1.3), g: shade(c.fruit, 0.75) };
  const R = { leaf: ["l.l.l", "lllll", "lflfl", ".lll.", "..l.."], bulb: ["..l..", ".l.l.", ".fff.", "ffhff", ".fff."], vine: ["..l..", ".fh..", "ffff.", ".ffff", "..ff."],
    tall: ["..l..", ".fhf.", ".fff.", ".fff.", ".lfl."], round: ["..l...", ".ffff.", "ffhfff", "ffffff", ".gffg."], bush: [".h.h.", "fffff", "ff.ff", ".f.f."] }[sh];
  return pix(key, R, pal);
}

// ---- the Tide Flats
function artFenceH() { const P = paintCanvas(16, 14); P.rect(1, 2, 3, 10, "#7c5232"); P.rect(0, 1, 5, 1, INK); P.rect(0, 4, 16, 2, "#a07040"); P.rect(0, 8, 16, 2, "#a07040"); P.rect(1, 2, 1, 10, "#5a3c24"); return P.c; }
function artFenceV() { const P = paintCanvas(6, 16); P.rect(1, 0, 4, 16, "#a07040"); P.rect(1, 0, 1, 16, "#7c5232"); P.rect(0, 0, 6, 1, INK); return P.c; }
function artWaterBarrel() { const P = paintCanvas(16, 18); P.shadow(7, 15, 6, 2); P.rows([".bbbbbbbbb.", "bwwwwwwwwwb", "bbbbbbbbbbb", "kkkkkkkkkkk", "bbbbbbbbbbb", "bbbbbbbbbbb", "kkkkkkkkkkk", "bbbbbbbbbbb", ".bbbbbbbbb."], { b: "#a06c40", k: "#5a4030", w: "#5aaadc" }, 2, 3); return P.c; }
function artSign(label) { const w = label.length * 6 + 4, P = paintCanvas(w + 2, 22); P.shadow(w / 2, 19, 5, 1); P.rect(w / 2 - 1, 8, 2, 11, "#6e482a"); P.rect(0, 0, w + 2, 10, INK); P.rect(1, 1, w, 8, "#b08250"); P.text(label, 3, 2, "#3c2c22"); return P.c; }
function artBin() { const P = paintCanvas(24, 22); P.shadow(11, 19, 10, 2); P.rect(1, 5, 20, 13, INK); P.rect(2, 6, 18, 11, "#96643c"); P.rect(2, 10, 18, 1, "#6e482a"); P.rect(0, 2, 22, 4, INK); P.rect(1, 3, 20, 2, "#b47e4a"); P.rect(9, 12, 4, 2, "#ffd246"); return P.c; }
function artStand() {
  const P = paintCanvas(32, 30); P.shadow(15, 27, 14, 2);
  P.rect(2, 14, 28, 12, INK); P.rect(3, 15, 26, 10, "#a06c40"); P.rect(3, 19, 26, 1, "#7c5232");
  P.rect(3, 4, 2, 11, "#7c5232"); P.rect(27, 4, 2, 11, "#7c5232"); P.rect(0, 0, 32, 5, INK);
  for (let i = 0; i < 8; i++) P.rect(1 + i * 4, 1, 4, 3, i % 2 ? "#f4ecd6" : "#c84a3c");
  ["#f05050", "#ffbe3c", "#5ac85a", "#5ad2b4", "#ff8c32"].forEach((c, i) => { P.rect(5 + i * 5, 11, 4, 4, "#d2b482"); P.rect(6 + i * 5, 12, 2, 2, c); });
  P.rect(13, 20, 6, 4, "#3c2c22"); P.rect(14, 20, 4, 1, "#ffd246"); return P.c;
}
function flatsObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act }), A = AREAS.flats, [gx, gy, gw, gh] = A.garden;
  for (let x = gx - 8; x < gx + gw + 8; x += 16) { if (x < 436 || x > 472) add("fenceh", x, gy - 14, [0, 6, 16, 6]); add("fenceh", x, gy + gh, [0, 6, 16, 6]); }   // a gate on the north side
  for (let y = gy - 8; y < gy + gh + 8; y += 16) { add("fencev", gx - 10, y, [1, 0, 4, 16]); add("fencev", gx + gw + 4, y, [1, 0, 4, 16]); }
  add("wbarrel", 408, 330, [2, 8, 12, 8], { kind: "water" });
  add("sgarden", 478, 318, [24, 10, 6, 8], { kind: "say", text: ["THE OLD GARDEN. GOOD GROUND, EVEN THIS CLOSE TO THE SEA.", "TILL IT WITH THE HOE, PLANT SEEDS, AND WATER THEM EVERY DAY."] });
  add("sport", 18, 260, [10, 10, 6, 8], { kind: "say", text: ["WEST: THE PORT."] });
  const r = seeded(91), clear = (x, y, w, h) => !o.some(q => x + w > q.x - 6 && x < q.x + IART[q.k].width + 6 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 18
    && !(x + w > gx - 20 && x < gx + gw + 20 && y + h > gy - 24 && y < gy + gh + 20);
  for (let i = 0; i < 300; i++) {
    const x = r.uniform(-10, 1270), y = r.random() < 0.6 ? r.uniform(-30, 60) : r.uniform(60, A.grass(x) - 50), palm = r.random() < 0.5, [w, h] = palm ? [28, 42] : [16, 12];
    if (!clear(x, y, w, h)) continue;
    if (palm) add("palm", x, y, [10, 30, 8, 6]); else add(r.random() < 0.5 ? "bush" : "bushb", x, y, [3, 6, 10, 4]);
  }
  for (let i = 0; i < 70; i++) {                              // rocks out on the tide flats: the tide pools
    const x = r.uniform(820, 1260), y = A.shore(x) + r.uniform(6, 34);
    if (clear(x, y, 12, 9)) add("rock", x, y, [1, 3, 8, 4]);
  }
  for (let i = 0; i < 14; i++) { const x = r.uniform(40, 1240), y = r.uniform(A.grass(x) + 20, A.shore(x) - 20); if (clear(x, y, 26, 9)) add(r.random() < 0.3 ? "log" : "rock", x, y, r.random() < 0.3 ? [2, 2, 22, 5] : [1, 3, 8, 4]); }
  return o;
}
function isleExitAt(x, y) {
  const M_ = ISLE.map;
  for (const e of M_.A.exits || []) {
    if (e.side === "e" && x > M_.W - 6 && y >= e.a && y < e.b) return e;
    if (e.side === "w" && x < 6 && y >= e.a && y < e.b) return e;
    if (e.side === "n" && y < 6 && x >= e.a && x < e.b) return e;
    if (e.side === "s" && y > M_.H - 4 && x >= e.a && x < e.b) return e;
  }
  return null;
}

// ---- tools on the ground
function facingTile() { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[ISLE.dir]; return [Math.floor(ISLE.px / TS) + d[0], Math.floor((ISLE.py - 3) / TS) + d[1]]; }
const farmKey = (tx, ty) => ISLE.map.id + ":" + tx + "," + ty;
function tileAt(tx, ty) { const M_ = ISLE.map; return ty >= 0 && ty < M_.A.h && tx >= 0 && tx < M_.A.w ? M_.tiles[ty][tx] : "x"; }
function isWaterTile(tx, ty) { const t = tileAt(tx, ty); if (t === "a" || t === "d") return true; if (t === "t") { const A = ISLE.map.A; return ty * TS + 8 > tideEdge(A, tx * TS + 8, isleSave()); } return false; }
function canFill() { const s = isleSave(); if (!s.inv.some(q => q && q[0] === "can")) { isleSay(["FRESH WATER. YOU'D NEED A WATERING CAN."]); return; } s.water = waterMax(); toast("THE CAN IS FULL", "#78c8f0"); play("plop"); }
function isleUse(tx, ty) {
  if (tx === undefined) [tx, ty] = facingTile();
  const s = isleSave(), it = held(), key = farmKey(tx, ty), e = s.farm[key], id = it && it[0];
  if (e && e.c && !e.dead && e.d >= CROP[e.c].days) { harvest(key, e); return; }    // anything ripe in front of you comes first
  if (id === "hoe") {
    if (tileAt(tx, ty) !== "m") { play("miss"); toast("THE HOE ONLY WORKS IN THE GARDEN"); return; }
    if (placedAt(tx, ty)) { play("miss"); return; }
    if (e && e.dead) { delete s.farm[key]; s.farm[key] = { c: null, d: 0, w: 0 }; play("hit"); return; }
    if (e) { play("miss"); return; }
    s.farm[key] = { c: null, d: 0, w: weatherOf(s) === "rain" ? 1 : 0 }; play("hit"); splashDust(tx, ty, "#8c6a46");
    if (s.up.hoe) { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[ISLE.dir]; for (let k = 1; k <= 2; k++) { const ax = tx + d[0] * k, ay = ty + d[1] * k, kk = farmKey(ax, ay); if (tileAt(ax, ay) === "m" && !s.farm[kk] && !placedAt(ax, ay)) s.farm[kk] = { c: null, d: 0, w: weatherOf(s) === "rain" ? 1 : 0 }; } }
  } else if (id === "can") {
    if (isWaterTile(tx, ty)) { canFill(); return; }
    if (!e) { play("miss"); return; }
    if (s.water <= 0) { toast("THE CAN IS EMPTY. FILL IT AT WATER", "#78c8f0"); play("miss"); return; }
    if (!e.w) { e.w = 1; s.water--; play("plop"); splashDust(tx, ty, "#78c8f0"); }
  } else if (it && ITEMS[id].kind === "seed") {
    const c = CROP[ITEMS[id].crop];
    if (!e || e.c) { play("miss"); if (!e) toast("TILL THE GROUND FIRST"); return; }
    if (!c.seasons.includes(s.season)) { toast(c.name + " WON'T GROW IN " + SEASONS[s.season][0]); play("miss"); return; }
    e.c = c.id; e.d = 0; e.dead = 0; invUse(s.sel); play("tick");
  } else if (e && e.dead) toast("DEAD. CLEAR IT WITH THE HOE");
}
function harvest(key, e) {
  const s = isleSave(), c = CROP[e.c], n = 1 + (["leaf", "bulb"].includes(c.shape) && Math.random() < 0.2 ? 1 : 0);
  if (invAdd(c.id, n) > 0) { toast("YOUR BAG IS FULL"); play("miss"); return; }
  if (c.regrow) e.d = c.days - c.regrow; else { e.c = null; e.d = 0; }
  toast("+" + n + " " + c.name, c.fruit); play("chime");
  s.harvests = (s.harvests || 0) + n;
}
function splashDust(tx, ty, col) { ISLE.dust = (ISLE.dust || []).concat([[tx * TS + 8, ty * TS + 8, 0.4, col]]); }
function farmNewDay(s) {                                      // after the day has moved on: grow, wither, rain, pay the bin, wash up forage
  const rain = weatherOf(s) === "rain";
  for (const key in s.farm) {
    const e = s.farm[key];
    if (e.c && !e.dead) { if (!CROP[e.c].seasons.includes(s.season)) e.dead = 1; else if (e.w) e.d = Math.min(e.d + 1, CROP[e.c].days); }
    e.w = rain || e.mulch ? 1 : 0;
  }
  sprinklersWater(s);
  const paid = s.bin.reduce((a, [id, n]) => a + (sellable(id) || 0) * n, 0);
  s.sd += paid; s.earned = (s.earned || 0) + paid; s.bin = [];
  forageCheck(); potsNewDay(s); newDay5(s);
  return paid;
}
function drawFarmSoil(cx, cy) {
  const s = isleSave(), pre = ISLE.map.id + ":";
  for (const key in s.farm) {
    if (!key.startsWith(pre)) continue;
    const [tx, ty] = key.slice(pre.length).split(",").map(Number), x = tx * TS - cx, y = ty * TS - cy, e = s.farm[key];
    if (x < -16 || y < -16 || x > IW || y > IH) continue;
    rect(e.w ? "#4e3622" : "#6e4e32", x + 1, y + 1, 14, 14); rect(e.w ? "#3e2a1a" : "#5a3e28", x + 1, y + 13, 14, 2);
    for (let k = 0; k < 3; k++) rect(e.w ? "#3e2a1a" : "#5a3e28", x + 3 + k * 4, y + 4 + (k % 2) * 4, 2, 1);
  }
  for (const d of ISLE.dust || []) { g.globalAlpha = d[2] / 0.4; for (let k = 0; k < 5; k++) rect(d[3], d[0] - cx + Math.cos(k * 1.3) * (1 - d[2]) * 14, d[1] - cy - (0.4 - d[2]) * 20 + Math.sin(k) * 3, 2, 2); g.globalAlpha = 1; d[2] -= 1 / 60; }
  ISLE.dust = (ISLE.dust || []).filter(d => d[2] > 0);
}
function farmSprites(list) {
  const s = isleSave(), pre = ISLE.map.id + ":";
  for (const key in s.farm) {
    const e = s.farm[key];
    if (!key.startsWith(pre) || !e.c) continue;
    const [tx, ty] = key.slice(pre.length).split(",").map(Number), c = CROP[e.c];
    const stage = e.dead ? 0 : e.d >= c.days ? 4 : Math.min(3, Math.floor(e.d / c.days * 4));
    list.push([ty * TS + 14, { draw(cx, cy) {
      const sp = cropSprite(e.c, stage, e.dead), x = tx * TS + 8 - (sp.width >> 1) - cx, y = ty * TS + 14 - sp.height - cy;
      if (x < -20 || y < -30 || x > IW || y > IH) return;
      g.drawImage(sp, x, y + (stage === 4 ? Math.round(Math.sin(T * 2 + tx) * 0.5) : 0));
      if (stage === 4 && Math.floor(T * 2 + tx + ty) % 4 === 0) rect(WHITE, x + sp.width - 2, y, 1, 1);   // ripe: a little glint
    } }]);
  }
}
function drawTileCursor(cx, cy) {
  const it = held(); if (!it) return;
  const [tx, ty] = facingTile(), t = tileAt(tx, ty), k = ITEMS[it[0]].kind;
  const ok = (it[0] === "hoe" && t === "m") || (it[0] === "can" && (isleSave().farm[farmKey(tx, ty)] || isWaterTile(tx, ty))) || (k === "seed" && isleSave().farm[farmKey(tx, ty)]);
  if (!ok) return;
  const x = tx * TS - cx, y = ty * TS - cy, c = "rgba(255,255,255,0.8)";
  [[0, 0], [12, 0], [0, 12], [12, 12]].forEach(([a, b]) => { rect(c, x + a, y + b, 4, 1); rect(c, x + a + (a ? 3 : 0), y + b, 1, 4); rect(c, x + a, y + b + (b ? 3 : 0), 4, 1); });
}

// ---- things that wash up
function forageCheck() {
  const s = isleSave(), day = s.year * 1000 + s.season * 100 + s.day;
  if (s.forage && s.forage.day === day) return;
  const r = seeded(day * 7 + 3), items = [];
  const pick = () => { const v = r.random(); return v < 0.42 ? "shell" : v < 0.66 ? "drift" : v < 0.86 ? "glass" : v < 0.97 ? "starfish" : "pearl"; };
  for (let k = 0, tries = 0; k < 6 && tries < 300; tries++) {          // the woods: mushrooms, berries, garlic, pinecones
    const A = AREAS.woods, x = r.uniform(30, A.w * TS - 30), y = r.uniform(30, A.h * TS - 30);
    if (terrainAt(A, x, y) !== "g") continue;
    const pool = ["mushroom", "mushroom"].concat(s.season === 0 ? ["garlic", "garlic"] : s.season === 1 ? ["wildberry", "wildberry"] : ["pinecone", "pinecone"]);
    items.push(["woods", Math.round(x), Math.round(y), pool[Math.floor(r.random() * pool.length)]]); k++;
  }
  for (const [id, n] of [["flats", 7], ["port", 3]]) {
    const A = AREAS[id];
    for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
      const x = r.uniform(30, A.w * TS - 30), y = r.uniform(A.grass(x) + 24, A.shore(x) - 6), t = terrainAt(A, x, y);
      if (t !== "s" && t !== "w") continue;
      let f = pick(); if (id === "port" && f === "pearl") f = "shell";
      items.push([id, Math.round(x), Math.round(y), f]); k++;
    }
  }
  s.forage = { day, items };
}
function forageAt(x, y) { const s = isleSave(); return s.forage && ISLE.map ? s.forage.items.find(f => f[0] === ISLE.map.id && Math.abs(f[1] - x) < 9 && Math.abs(f[2] - y) < 9) : null; }
function forageTake(f) {
  if (invAdd(f[3], 1) > 0) { toast("YOUR BAG IS FULL"); play("miss"); return; }
  const s = isleSave(); s.forage.items = s.forage.items.filter(q => q !== f);
  toast("+1 " + ITEMS[f[3]].name, "#f0dcb4"); play("chime");
}
function forageSprites(list) {
  const s = isleSave(); if (!s.forage) return;
  for (const f of s.forage.items) if (f[0] === ISLE.map.id) list.push([f[2], { draw(cx, cy) { const c = itemIcon(f[3]); g.drawImage(c, f[1] - (c.width >> 1) - cx, f[2] - c.height + 2 - cy); if (Math.floor(T * 1.5 + f[1]) % 5 === 0) rect(WHITE, f[1] + 3 - cx, f[2] - c.height - cy, 1, 1); } }]);
}

// ---- the selling bin
function binAct() {
  const s = isleSave(), it = held();
  if (it && sellable(it[0])) {
    s.bin.push([it[0], it[1]]); s.inv[s.sel] = null;
    const v = sellable(it[0]) * it[1]; toast(it[1] + " " + ITEMS[it[0]].name + " IN THE BIN: +" + v, GOLD); play("select"); return;
  }
  const n = s.bin.reduce((a, q) => a + q[1], 0), v = s.bin.reduce((a, [id, k]) => a + sellable(id) * k, 0);
  isleSay(["THE SELLING BIN. HOLD SOMETHING YOU WANT TO SELL AND USE THE BIN. IT PAYS OVERNIGHT."].concat(n ? ["IN THE BIN: " + n + " THINGS, WORTH " + v + " SAND DOLLARS."] : []));
}

// ---- the seed stand by the store (an honour box until the store is fixed up)
const shopList = () => CROPS.filter(c => c[2].includes(isleSave().season)).map(c => { const k = CROP[c[0]]; return { item: "s_" + k.id, name: k.name, price: k.price, info: k.days + " DAYS. SELLS " + k.sell + (k.regrow ? ", REGROWS " + k.regrow : "") + (k.seasons.length > 1 ? ". 2 SEASONS" : "") }; })
  .concat([{ item: "pot", name: "CRAB POT", price: 120, info: "PUT IT IN WATER. CHECK IT EACH MORNING." }]);
function shopGeo() { const w = Math.min(IW - 16, 300), n = shopList().length, h = 56 + n * 11; return [Math.round((IW - w) / 2), Math.max(4, Math.round((IH - h) / 2)), w, h]; }
function drawShopIsle() {
  const [x, y, w, h] = shopGeo(), L = shopList(), s = isleSave(), sel = L[ISLE.shop.sel];
  g.globalAlpha = 0.45; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("SEEDS & TACKLE", x + 8, y + 9, 1, "#b4461e", "left", null); text(SEASONS[s.season][0], x + w / 2 + 10, y + 9, 1, "#8c6c50", "center", null);
  rect("#f0ecdc", x + w - 46, y + 6, 5, 5); text(s.sd, x + w - 38, y + 9, 1, "#5a3c28", "left", null);
  text("AN HONOUR BOX. LEAVE THE MONEY.", x + 8, y + 20, 1, "#8c6c50", "left", null);
  L.forEach((c, i) => {
    const ry = y + 28 + i * 11, on = i === ISLE.shop.sel;
    if (on) { rect("#f4e4c0", x + 5, ry, w - 10, 10); outline(x + 5, ry, w - 10, 10, "#b4461e"); }
    g.drawImage(itemIcon(c.item), x + 8, ry + 1);
    text(c.name, x + 18, ry + 5, 1, "#3c2c22", "left", null);
    text(c.price, x + w - 9, ry + 5, 1, s.sd >= c.price ? "#3c2c22" : "#b46446", "right", null);
  });
  const dy = y + 30 + L.length * 11;
  if (sel) text(sel.info, x + 8, dy + 4, 1, "#5a3c28", "left", null);
  text(wideMenus() || IW >= 300 ? "E: BUY 1  SHIFT+E: BUY 5  ESC: DONE" : "TAP: BUY 1   OUT: DONE", x + 8, dy + 15, 1, "#8c6c50", "left", null);
}
function shopPick(n) {
  const c = shopList()[ISLE.shop.sel], s = isleSave(); if (!c) return;
  let got = 0;
  for (let k = 0; k < n; k++) { if (s.sd < c.price || invAdd(c.item, 1) > 0) break; s.sd -= c.price; got++; }
  if (got) { toast("+" + got + " " + ITEMS[c.item].name, "#5ac85a"); play("select"); saveStore(); } else { toast(s.sd < c.price ? "NOT ENOUGH SAND DOLLARS" : "YOUR BAG IS FULL"); play("miss"); }
}
function shopKey(e) {
  const c = e.code, L = shopList();
  if (c === "Escape" || c === "Tab") { e.preventDefault(); ISLE.shop = null; play("back"); return; }
  const v = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
  if (v) { ISLE.shop.sel = (ISLE.shop.sel + v + L.length) % L.length; play("tick"); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); shopPick(e.shiftKey ? 5 : 1); }
}
function shopTouch(x, y) {
  const [px, py, w, h] = shopGeo(), i = Math.floor((y - py - 28) / 11), L = shopList();
  if (x < px || x > px + w || y < py || y > py + h) { ISLE.shop = null; play("back"); return; }
  if (i >= 0 && i < L.length) { if (ISLE.shop.sel === i) shopPick(1); else { ISLE.shop.sel = i; play("tick"); } }
}

// ---- the toolbar and the bag
const TB_SLOT = 18;
function tbGeo() { const w = 9 * TB_SLOT; return [Math.round((IW - w) / 2), IH - TB_SLOT - 4]; }
function drawSlot(x, y, it, on, s) {
  rect("#3c2c22", x, y, TB_SLOT - 1, TB_SLOT - 1); rect(on ? "#fff0b4" : "#e8d4aa", x + 1, y + 1, TB_SLOT - 3, TB_SLOT - 3);
  if (on) outline(x - 1, y - 1, TB_SLOT + 1, TB_SLOT + 1, "#ffd246");
  if (!it) return;
  const c = itemIcon(it[0]); g.drawImage(c, x + ((TB_SLOT - 1 - c.width) >> 1), y + ((TB_SLOT - 1 - c.height) >> 1));
  if (it[0] === "can") { rect("#3c2c22", x + 2, y + TB_SLOT - 5, TB_SLOT - 5, 2); rect("#5aaadc", x + 2, y + TB_SLOT - 5, Math.round((TB_SLOT - 5) * Math.min(1, s.water / waterMax())), 2); }
  else if (it[1] > 1) text(it[1], x + TB_SLOT - 2, y + TB_SLOT - 5, 1, WHITE, "right", INK);
}
function drawToolbar(s) {
  if (ISLE.msg || ISLE.inv) return;
  const [x0, y] = tbGeo();
  islePanel(x0 - 24, y + 1, 18, 16); rect("#7c5232", x0 - 20, y + 6, 10, 8); rect("#5a3c24", x0 - 18, y + 4, 6, 3);   // the bag button
  for (let i = 0; i < 9; i++) drawSlot(x0 + i * TB_SLOT, y, s.inv[i], i === s.sel, s);
  const it = s.inv[s.sel];
  if (it && ISLE.selShow !== s.sel + ":" + it[0]) { ISLE.selShow = s.sel + ":" + it[0]; ISLE.selT = 1.6; }
  if (ISLE.selT > 0) { ISLE.selT -= 1 / 60; if (it) text(ITEMS[it[0]].name, IW / 2, y - 6, 1, WHITE, "center"); }
}
function toolbarTouch(x, y) {
  const [x0, ty] = tbGeo(); if (y < ty - 2 || ISLE.msg) return false;
  if (x >= x0 - 24 && x < x0 - 4) { ISLE.inv = { sel: isleSave().sel, held: -1 }; play("select"); return true; }
  const i = Math.floor((x - x0) / TB_SLOT); if (i >= 0 && i < 9) { isleSave().sel = i; play("tick"); return true; }
  return false;
}
function drawToasts() {
  const [, y] = tbGeo();
  (ISLE.toasts || []).forEach((q, i, a) => { g.globalAlpha = Math.min(1, q[1] * 2); text(q[0], IW / 2, y - 16 - (a.length - 1 - i) * 10, 1, q[2], "center"); g.globalAlpha = 1; });
}
function invGeo() { const rows = isleSave().inv.length / 9, w = 9 * TB_SLOT + 16, h = rows * (TB_SLOT + 2) + 50; return [Math.round((IW - w) / 2), Math.round((IH - h) / 2), w, h]; }
function drawInvIsle() {
  const [x, y, w, h] = invGeo(), s = isleSave(), I = ISLE.inv;
  g.globalAlpha = 0.45; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("YOUR BAG", x + 8, y + 9, 1, "#b4461e", "left", null); rect("#f0ecdc", x + w - 46, y + 6, 5, 5); text(s.sd, x + w - 38, y + 9, 1, "#5a3c28", "left", null);
  for (let i = 0; i < s.inv.length; i++) { const sx = x + 8 + (i % 9) * TB_SLOT, sy = y + 18 + Math.floor(i / 9) * (TB_SLOT + 2); drawSlot(sx, sy, I.held === i ? null : s.inv[i], i === I.sel, s); if (i === s.sel) rect("#b4461e", sx + 6, sy - 2, 5, 1); }
  const it = s.inv[I.held >= 0 ? I.held : I.sel], ly = y + 18 + (s.inv.length / 9) * (TB_SLOT + 2) + 4;
  if (it) text(ITEMS[it[0]].name + (sellable(it[0]) ? "  SELLS " + sellable(it[0]) : ""), x + 8, ly + 3, 1, "#3c2c22", "left", null);
  text(I.held >= 0 ? "PICK WHERE IT GOES" : "E: MOVE  TOP ROW = TOOLBAR", x + 8, ly + 14, 1, "#8c6c50", "left", null);
  if (I.held >= 0 && s.inv[I.held]) { const c = itemIcon(s.inv[I.held][0]), sx = x + 8 + (I.sel % 9) * TB_SLOT, sy = y + 18 + Math.floor(I.sel / 9) * (TB_SLOT + 2); g.drawImage(c, sx + 9, sy - 6); }
}
function invPick() {
  const s = isleSave(), I = ISLE.inv;
  if (I.held < 0) { if (s.inv[I.sel]) { I.held = I.sel; play("tick"); } return; }
  const a = s.inv[I.held], b = s.inv[I.sel];
  if (b && a && b[0] === a[0] && I.held !== I.sel && ITEMS[a[0]].kind !== "tool") { b[1] += a[1]; s.inv[I.held] = null; }
  else { s.inv[I.held] = b; s.inv[I.sel] = a; }
  I.held = -1; play("select");
}
function invKey(e) {
  const c = e.code, I = ISLE.inv;
  if (c === "Escape" || c === "Tab" || c === "KeyI") { e.preventDefault(); if (I.held >= 0) { I.held = -1; return; } if (I.sel < 9) isleSave().sel = I.sel; ISLE.inv = null; play("back"); return; }
  const d = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -9, KeyW: -9, ArrowDown: 9, KeyS: 9 }[c];
  const N = isleSave().inv.length; if (d) { I.sel = (I.sel + d + N) % N; play("tick"); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); invPick(); }
}
function invTouch(x, y) {
  const [px, py, w, h] = invGeo(), I = ISLE.inv;
  if (x < px || x > px + w || y < py || y > py + h) { ISLE.inv = null; play("back"); return; }
  const col = Math.floor((x - px - 8) / TB_SLOT), row = Math.floor((y - py - 18) / (TB_SLOT + 2));
  if (col >= 0 && col < 9 && row >= 0 && row < isleSave().inv.length / 9) { I.sel = row * 9 + col; invPick(); if (I.held < 0 && I.sel < 9) isleSave().sel = I.sel; }
}

// =====================================================================================================================
// Part 4: chill fishing and the island log. The rod: hold E to cast (the bar swings), let go to throw. Fish shadows drift in
// the water; one wanders over, nibbles, then pulls the bobber under: press E, then hold to reel and ease off when the line
// glows. Nothing snaps; a fish that gets away just swims off. The net searches tide pools at low tide; crab pots fill
// overnight. Every catch goes in the island log (isle_fish.js, 175 entries) with the lost angler's journal note.
const FISH = {};
ISLE_FISH.forEach(f => {
  const [id, name, page, where, seasons, time, weather, min, max, shape, c1, c2, sell, w, note] = f;
  FISH[id] = { id, name, page, where, seasons, time, weather, min, max, shape, c1, c2, sell, w, note };
  ITEMS["f_" + id] = { name, kind: "fish", sell, fish: id };
});
ITEMS.rod = { name: "FISHING ROD", kind: "tool" }; ITEMS.net = { name: "NET", kind: "tool" }; ITEMS.pot = { name: "CRAB POT", kind: "pot" };
const LOG_PAGES = [["sea", "THE SEA", "SEA"], ["fresh", "LAGOON AND RIVER", "FRESH"], ["pool", "TIDE POOLS", "POOLS"], ["pot", "CRAB POTS", "POTS"],
  ["cave", "THE CAVES", "CAVES"], ["legend", "LEGENDS", "LGND"], ["special", "SPECIALS", "SPCL"]];
const TIME_WIN = { a: [360, 1560], m: [360, 660], d: [660, 1020], e: [1020, 1260], n: [1260, 1560], w: [360, 420] };
const LATER = /^(fest_|light)/;                                 // festival days and the lighthouse (caves opened in part 7, the last areas in part 8)
function fishOk(f, s) {
  if ((LATER.test(f.where) && !(typeof laterOpen === "function" && laterOpen(f, s))) || !f.seasons.includes(String(s.season))) return false;
  const [a, b] = TIME_WIN[f.time]; if (s.min < a || s.min >= b) return false;
  const w = weatherOf(s);
  if ((f.weather === "r" && w !== "rain") || (f.weather === "s" && w !== "sun") || (f.weather === "n" && w !== "snow")) return false;
  if (f.id === "moonfish" && s.day !== 14) return false;          // the island's full moon: the middle of each season
  return true;
}
function pickFish(where, s) {
  const pool = Object.values(FISH).filter(f => (f.where === where || (where === "deep" && f.where === "sea")) && fishOk(f, s));
  let tot = pool.reduce((a, f) => a + f.w, 0), r = Math.random() * tot;
  for (const f of pool) if ((r -= f.w) <= 0) return f.id;
  return pool.length ? pool[pool.length - 1].id : null;
}
function isWaterAt(x, y) {
  const M_ = ISLE.map; if (x < 0 || y < 0 || x >= M_.W || y >= M_.H || inDock(M_.A, x, y)) return false;
  const t = M_.tiles[Math.floor(y / TS)][Math.floor(x / TS)];
  if (t === "a" || t === "d") return true;
  return t === "t" && y > tideEdge(M_.A, x, isleSave()) + 2;
}
function waterKind(x, y) {
  const M_ = ISLE.map, A = M_.A;
  if (A.cave) return "cave" + A.layer;
  if (A.marsh) return "marsh";
  if (A.fresh) return riverNear(A, x, y) ? "river" : "lake";
  return M_.tiles[Math.floor(y / TS)][Math.floor(x / TS)] === "d" ? "deep" : "sea";
}
const shadowR = sp => { const f = FISH[sp]; return f.page === "legend" ? 9 : f.max >= 24 ? 7 : f.max >= 8 ? 5 : 3; };

// ---- fish shadows in the water
function spawnShadow(x, y) {
  if (!isWaterAt(x, y)) return null;
  const sp = pickFish(waterKind(x, y), isleSave()); if (!sp) return null;
  const f = { x, y, sp, size: Math.random(), vx: 0, vy: 0, t: 0, ph: Math.random() * 6 };
  ISLE.shadows.push(f); return f;
}
function shadowsTick(dt) {
  const I = ISLE, M_ = I.map;
  if (!M_.A.outdoor && !M_.A.cave) { I.shadows = []; return; }
  if (I.shadowArea !== M_.id) { I.shadows = []; I.shadowArea = M_.id; }
  const [cx, cy] = isleCam();
  I.shadows = I.shadows.filter(f => !f.gone && f.x > cx - 90 && f.x < cx + IW + 90 && f.y > cy - 90 && f.y < cy + IH + 90);
  I.shadowT = (I.shadowT || 0) - dt;
  if (I.shadows.length < 7 && I.shadowT <= 0) { I.shadowT = 0.3; spawnShadow(cx + Math.random() * IW, cy + Math.random() * IH); }
  for (const f of I.shadows) {
    if (f.hook) continue;                                        // the one coming to the bobber moves in fishTick
    if (f.flee) { f.x += f.vx * dt * 3; f.y += f.vy * dt * 3; f.flee -= dt; if (f.flee <= 0) f.gone = true; continue; }
    f.t -= dt;
    if (f.t <= 0) { const a = Math.random() * 6.28, sp = 4 + Math.random() * 8; f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp * 0.6; f.t = 1.5 + Math.random() * 3; }
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
    if (isWaterAt(nx, ny)) { f.x = nx; f.y = ny; } else { f.vx = -f.vx; f.vy = -f.vy; }
  }
}
function drawShadows(cx, cy) {
  for (const f of ISLE.shadows || []) {
    const r = shadowR(f.sp), x = f.x - cx, y = f.y - cy, dir = (f.vx || 1) >= 0 ? 1 : -1, wig = Math.sin(T * 6 + f.ph) * 0.8;
    if (x < -20 || y < -10 || x > IW + 20 || y > IH + 10) continue;
    g.globalAlpha = 0.32; g.fillStyle = "#0a2232";
    g.beginPath(); g.ellipse(Math.round(x), Math.round(y), r, Math.max(1.5, r * 0.4), 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - dir * r, y); g.lineTo(x - dir * (r + r * 0.7), y - r * 0.4 + wig); g.lineTo(x - dir * (r + r * 0.7), y + r * 0.4 + wig); g.fill();
    g.globalAlpha = 1;
    if (FISH[f.sp].page === "legend" && Math.floor(T * 2) % 2) { g.globalAlpha = 0.35; outline(Math.round(x - r - 2), Math.round(y - 4), r * 2 + 4, 8, "#ffd246"); g.globalAlpha = 1; }
  }
}

// ---- the rod
function fishPress() {
  const I = ISLE, F = I.fish;
  if (!F) { if (!I.map.A.outdoor && !I.map.A.cave) { toast("NO WATER IN HERE"); play("miss"); return; } I.fish = { phase: "charge", p: 0, d: 1 }; return; }
  if (F.phase === "wait") { if (F.bite > 0) startReel(); else { I.fish = null; if (F.sh) F.sh.hook = false; play("back"); } return; }
  if (F.phase === "reel") F.hold = true;
}
function fishRelease() { const F = ISLE.fish; if (!F) return; if (F.phase === "charge") castLine(); else if (F.phase === "reel") F.hold = false; }
function isleKeyUp(e) { if (ISLE && ["Space", "Enter", "KeyE"].includes(e.code)) fishRelease(); }
function isleTouchUp(e) { if (ISLE) { fishRelease(); ISLE.touchFish = false; } }
function rodTip() { const I = ISLE, d = { up: [3, -22], down: [6, -6], left: [-10, -14], right: [10, -14] }[I.dir]; return [I.px + d[0], I.py + d[1]]; }
function castLine() {
  const I = ISLE, F = I.fish, d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[I.dir], dist = (20 + F.p * 76) * (isleSave().up.rod ? 1.4 : 1);
  const tx = clamp(I.px + d[0] * dist, 4, I.map.W - 4), ty = clamp(I.py - 4 + d[1] * dist, 4, I.map.H - 4);
  const bait = invCount("bait") > 0 && isWaterAt(tx, ty); if (bait) invTake("bait", 1);
  I.fish = { phase: "fly", t: 0, sx: rodTip()[0], sy: rodTip()[1], x: tx, y: ty, wet: isWaterAt(tx, ty), bait };
  play("tick");
}
function startReel() {
  const I = ISLE, F = I.fish, sh = F.sh;
  I.fish = { phase: "reel", sp: sh.sp, size: sh.size, prog: 0.15, ten: 0.25, hold: true, over: 0, surge: 0, surgeT: 1.5, x: F.x, y: F.y };
  sh.gone = true; play("hit");
}
function fishTick(dt) {
  const I = ISLE, F = I.fish, s = isleSave();
  if (F.phase === "charge") { F.p += F.d * dt / 0.9; if (F.p >= 1) { F.p = 1; F.d = -1; } else if (F.p <= 0) { F.p = 0; F.d = 1; } return; }
  if (F.phase === "fly") {
    F.t += dt;
    if (F.t >= 0.35) {
      if (!F.wet) { I.fish = null; toast("THE LINE LANDS ON DRY GROUND"); play("miss"); return; }
      Object.assign(F, { phase: "wait", t: F.bait ? 3 : 0, sh: null, nib: 0, nibT: 0, bite: 0, look: 0, dip: 0 }); play("plop");
    }
    return;
  }
  if (F.phase === "wait") {
    F.t += dt; F.dip = Math.max(0, F.dip - dt);
    if (!F.sh) {
      F.look -= dt;
      if (F.look <= 0) {
        F.look = 0.6;
        const near = I.shadows.filter(q => !q.hook && !q.flee && Math.hypot(q.x - F.x, q.y - F.y) < 80).sort((a, b) => Math.hypot(a.x - F.x, a.y - F.y) - Math.hypot(b.x - F.x, b.y - F.y))[0];
        if (near && Math.random() < (F.bait ? 0.9 : 0.6)) { F.sh = near; near.hook = true; F.nib = 1 + Math.floor(Math.random() * 3); F.nibT = 1 + Math.random(); }
        else if (F.t > 3 && Math.random() < 0.35) { const a = Math.random() * 6.28, sh = spawnShadow(F.x + Math.cos(a) * 50, F.y + Math.sin(a) * 30); if (sh) { F.sh = sh; sh.hook = true; F.nib = 1 + Math.floor(Math.random() * 3); F.nibT = 1 + Math.random(); } }
      }
      return;
    }
    const sh = F.sh, dx = F.x - sh.x, dy = F.y - sh.y, dd = Math.hypot(dx, dy);
    if (dd > 5) { sh.vx = dx / dd * 14; sh.vy = dy / dd * 14; sh.x += sh.vx * dt; sh.y += sh.vy * dt; return; }
    if (F.bite > 0) {
      F.bite -= dt;
      if (F.bite <= 0) { sh.hook = false; sh.flee = 1.5; sh.vx = -sh.vx || 10; sh.vy = -sh.vy; F.sh = null; F.t = 0; toast("IT SWAM OFF. NO HARM DONE"); }
      return;
    }
    F.nibT -= dt;
    if (F.nibT <= 0) {
      if (F.nib > 0) { F.nib--; F.dip = 0.18; F.nibT = 0.6 + Math.random() * 0.8; play("tick", 0.4); }
      else { F.bite = 1.2; play("plop"); }
    }
    return;
  }
  if (F.phase === "reel") {
    const f = FISH[F.sp], str = clamp(f.max / 30 + (f.page === "legend" ? 1.4 : 0) + F.size * 0.5, 0.2, 3.2);
    F.surgeT -= dt; if (F.surgeT <= 0) { F.surge = F.surge ? 0 : 1; F.surgeT = F.surge ? 0.5 + Math.random() * 0.8 : 1.2 + Math.random() * 2; }
    if (F.hold) { F.prog += dt * (0.34 - str * 0.06) * (isleSave().up.rod ? 1.25 : 1); F.ten += dt * (0.32 + str * 0.22 + F.surge * 0.45); }
    else { F.ten -= dt * 0.75; F.prog -= dt * 0.04 * (1 + F.surge); }
    F.prog = clamp(F.prog, 0.02, 1); F.ten = clamp(F.ten, 0, 1);
    F.over = F.ten >= 1 ? F.over + dt : Math.max(0, F.over - dt * 2);
    if (F.over > 1.1) { I.fish = null; toast("IT SLIPPED OFF THE HOOK. NO HARM DONE"); play("miss"); return; }
    if (F.prog >= 1) { I.fish = null; logCatch(F.sp, F.size, "rod"); }
  }
}
function logCatch(sp, size, how) {                               // into the bag and the log; a card the first time
  const s = isleSave(), f = FISH[sp], inches = Math.round(f.min + (f.max - f.min) * size), e = s.log[sp], isNew = !e;
  if (invAdd("f_" + sp, 1) > 0) { toast("YOUR BAG IS FULL. YOU LET IT GO"); play("miss"); return; }
  const best = e ? e.best : 0;
  s.log[sp] = { n: (e ? e.n : 0) + 1, best: Math.max(best, inches) };
  if (isNew) { ISLE.card = { sp, inches, how }; play("fanfare"); }
  else { toast("+1 " + f.name + ", " + inches + " IN" + (inches > best ? ". NEW BEST!" : ""), inches > best ? GOLD : WHITE); play("chime"); }
  saveStore();
}
function drawFishing(cx, cy) {
  const I = ISLE, F = I.fish; if (!F) return;
  const [rx, ry] = rodTip(), px = Math.round(I.px - cx), py = Math.round(I.py - cy);
  if (F.phase === "charge") {
    rect(INK, px + 10, py - 30, 5, 24); rect("#3c2c22", px + 11, py - 29, 3, 22);
    const h = Math.round(22 * F.p); rect(F.p > 0.85 ? "#ffd246" : F.p > 0.5 ? "#82f082" : "#5ae6ff", px + 11, py - 7 - h, 3, h);
    line("#c8b48c", rx - cx, ry - cy, rx - cx + 2, ry - cy - 8);
    return;
  }
  let bx = F.x, by = F.y;
  if (F.phase === "fly") { const k = F.t / 0.35; bx = lerp(F.sx, F.x, k); by = lerp(F.sy, F.y, k) - Math.sin(k * Math.PI) * 24; }
  const under = F.phase === "wait" && F.bite > 0, dip = F.phase === "wait" && F.dip > 0 ? 1 : 0;
  g.globalAlpha = 0.8; g.strokeStyle = "#e6e6e6"; g.lineWidth = 1; g.beginPath(); g.moveTo(rx - cx + 0.5, ry - cy + 0.5);
  g.quadraticCurveTo((rx + bx) / 2 - cx, Math.max(ry, by) - cy + 8, bx - cx + 0.5, by - cy + 0.5); g.stroke(); g.globalAlpha = 1;
  if (F.phase === "reel") {
    const t = T, wob = Math.sin(t * 9) * 2; rect("#ffffff", F.x - cx - 4 + wob, F.y - cy, 3, 1); rect("#ffffff", F.x - cx + 3 - wob, F.y - cy + 1, 2, 1);
  } else if (!under) { rect(INK, bx - cx - 2, by - cy - 3 + dip, 5, 6); rect("#f05050", bx - cx - 1, by - cy - 2 + dip, 3, 2); rect("#fafaff", bx - cx - 1, by - cy + dip, 3, 2); }
  if (F.phase === "wait") { const rr = (T * 0.8) % 1; g.globalAlpha = 0.5 * (1 - rr); g.strokeStyle = "#e6faff"; g.beginPath(); g.ellipse(bx - cx, by - cy + 2, 3 + rr * (under ? 10 : 6), 1 + rr * 3, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
  if (under && Math.floor(T * 8) % 2) text("!", px, py - 30, 2, GOLD, "center");
  if (F.phase === "reel") {
    const w = Math.min(IW - 16, 250), x = Math.round((IW - w) / 2), y = tbGeo()[1] - 42, bx = x + 42, bw = w - 48;
    islePanel(x, y, w, 36);
    text(IW >= 300 ? "HOLD E TO REEL. EASE OFF WHEN THE LINE GLOWS" : "HOLD TO REEL. EASE OFF", x + w / 2, y + 8, 1, "#5a3c28", "center", null);
    text("CATCH", x + 6, y + 18, 1, "#3c2c22", "left", null); rect("#3c2c22", bx, y + 15, bw, 6); rect("#5ac85a", bx + 1, y + 16, Math.round((bw - 2) * F.prog), 4);
    const tc = F.ten > 0.85 ? (Math.floor(T * 10) % 2 ? "#ff5a3c" : "#ffd246") : F.ten > 0.6 ? "#ffa046" : "#e6e6e6";
    text("LINE", x + 6, y + 28, 1, "#3c2c22", "left", null); rect("#3c2c22", bx, y + 25, bw, 6); rect(tc, bx + 1, y + 26, Math.round((bw - 2) * F.ten), 4);
  }
}

// ---- tide pools (the net, at low tide) and crab pots (overnight)
function poolDry(p) { const A = ISLE.map.A; return p[1] < tideEdge(A, p[0], isleSave()) - 3; }
function poolsToday() { const s = isleSave(), day = s.year * 1000 + s.season * 100 + s.day; if (!s.pools || s.pools.day !== day) s.pools = { day, used: [] }; return s.pools; }
function drawPools(cx, cy) {
  const M_ = ISLE.map; if (!M_.pools || !M_.pools.length) return;
  const used = poolsToday().used;
  M_.pools.forEach((p, i) => {
    if (!poolDry(p)) return;
    const x = p[0] - cx, y = p[1] - cy; if (x < -20 || y < -10 || x > IW + 20 || y > IH + 10) return;
    g.fillStyle = "#3c7884"; g.beginPath(); g.ellipse(x, y, 9, 4, 0, 0, 7); g.fill();
    g.fillStyle = "#5aa0a8"; g.beginPath(); g.ellipse(x - 1, y - 1, 6, 2, 0, 0, 7); g.fill();
    if (!used.includes(M_.id + i) && Math.floor(T * 2 + i) % 3 === 0) { rect(WHITE, x + 3, y - 2, 1, 1); rect(WHITE, x - 4, y, 1, 1); }
  });
}
function netUse() {
  const I = ISLE, M_ = I.map, [fx, fy] = facingPoint();
  const i = (M_.pools || []).findIndex(p => Math.hypot(p[0] - fx, p[1] - fy) < 14 || Math.hypot(p[0] - I.px, p[1] - I.py) < 14);
  if (i < 0) { toast(M_.A.shore ? "THE NET IS FOR TIDE POOLS ON THE FLATS" : "THE NET IS FOR TIDE POOLS BY THE SEA"); play("miss"); return; }
  if (!poolDry(M_.pools[i])) { toast("THE TIDE IS IN OVER THIS POOL"); play("miss"); return; }
  const pt = poolsToday();
  if (pt.used.includes(M_.id + i)) { toast("YOU'VE SEARCHED THIS POOL TODAY"); play("miss"); return; }
  pt.used.push(M_.id + i); splashDust(Math.floor(M_.pools[i][0] / TS), Math.floor(M_.pools[i][1] / TS), "#a0dce6");
  const sp = Math.random() < 0.72 ? pickFish("pool", isleSave()) : null;
  if (sp) logCatch(sp, Math.random(), "net"); else { toast("JUST SAND AND A CONFUSED BARNACLE"); play("tick"); }
}
function potAt(tx, ty) { const s = isleSave(); return s.pots.find(p => p.a === ISLE.map.id && p.x === tx && p.y === ty); }
function potPlace() {
  const s = isleSave(), [tx, ty] = facingTile(), x = tx * TS + 8, y = ty * TS + 8;
  if (!isWaterAt(x, y)) { toast("CRAB POTS GO IN THE WATER"); play("miss"); return; }
  if (potAt(tx, ty)) { play("miss"); return; }
  if (s.pots.length >= 12) { toast("12 POTS IS PLENTY"); play("miss"); return; }
  s.pots.push({ a: ISLE.map.id, x: tx, y: ty, c: null }); invUse(s.sel); play("plop"); toast("THE POT IS SET. CHECK IT TOMORROW");
}
function potInteract() {
  const [tx, ty] = facingTile(), p = potAt(tx, ty) || potAt(tx, ty + 1) || potAt(tx, ty - 1);
  if (!p) return false;
  if (p.c) { const c = p.c; p.c = null; logCatch(c, Math.random(), "pot"); return true; }
  isleSay(["AN EMPTY CRAB POT. PICK IT UP?"], { opts: ["PICK UP", "LEAVE IT"], act: [() => { if (invAdd("pot", 1) === 0) { const s = isleSave(); s.pots = s.pots.filter(q => q !== p); play("select"); } else toast("YOUR BAG IS FULL"); }, () => play("tick")] });
  return true;
}
function potsNewDay(s) { for (const p of s.pots) if (!p.c && Math.random() < 0.85) p.c = pickFish(AREAS[p.a].fresh ? "freshpot" : "seapot", s); }
function drawPots(cx, cy) {
  const s = isleSave();
  for (const p of s.pots) if (p.a === ISLE.map.id) {
    const x = p.x * TS + 8 - cx, y = p.y * TS + 8 - cy + Math.round(Math.sin(T * 2 + p.x) * 1);
    if (x < -10 || y < -10 || x > IW + 10 || y > IH + 10) continue;
    rect("#c8b48c", x, y + 2, 1, 4); rect(INK, x - 3, y - 3, 7, 6); rect("#f05050", x - 2, y - 2, 5, 2); rect("#fafaff", x - 2, y, 5, 2);
    if (p.c && Math.floor(T * 3) % 2) rect(GOLD, x, y - 8, 1, 3);
  }
}

// ---- the Lagoon
function artReed() { const P = paintCanvas(8, 16); P.rect(2, 4, 1, 12, "#5a8c3c"); P.rect(5, 2, 1, 14, "#4a7a32"); P.rect(1, 2, 3, 5, "#7a5232"); P.rect(4, 0, 3, 5, "#6e482a"); P.rect(0, 9, 3, 1, "#6ea046"); P.rect(5, 8, 3, 1, "#6ea046"); return P.c; }
function artLily() { const P = paintCanvas(10, 6); P.rows([".gggg.", "gggggg", "ggg.gg", ".gggg."], { g: "#468c46" }, 1, 1, false); P.rect(5, 1, 2, 2, "#f0b4c8"); return P.c; }
function lagoonObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act }), A = AREAS.lagoon, say = (...text) => ({ kind: "say", text });
  add("hatch", 704, 616, [4, 32, 56, 22], say("THE OLD HATCHERY. TANKS AND TROUGHS, ALL DRY. SOMEONE BRED FISH HERE ONCE.", "IT COULD BE FIXED UP ONE DAY."));
  add("slagoon", 590, 790, [24, 10, 6, 8], say("THE LAGOON. FRESH WATER, AND FISH YOU WON'T FIND IN THE SEA."));
  add("pile", 580, 4, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE PATH NORTH. A SIGN ON TOP SAYS: LIGHTHOUSE POINT."));
  add("pile", 1084, 584, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE WAY. A SIGN ON TOP SAYS: MANGROVE MARSH."));
  const r = seeded(123);
  for (let i = 0; i < 260; i++) { const x = r.uniform(0, A.w * TS), y = r.uniform(0, A.h * TS), d = freshDepth(A, x, y + 14); if (d > -7 && d < -1 && !inDock(A, x, y + 14)) add("reed", x - 4, y, null); }
  for (let i = 0; i < 400 && o.filter(q => q.k === "lily").length < 28; i++) { const x = r.uniform(0, A.w * TS), y = r.uniform(0, A.h * TS); if (A.lakes.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.8) && freshDepth(A, x, y) > 10 && !inDock(A, x, y) && !riverNear(A, x, y)) add("lily", x, y, null); }
  const clear = (x, y, w, h) => !o.some(q => q.solid && x + w > q.x - 6 && x < q.x + IART[q.k].width + 6 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 18
    && freshDepth(A, x + w / 2, y + h - 2) < -12 && freshDepth(A, x + 2, y + h - 2) < -12 && freshDepth(A, x + w - 2, y + h - 2) < -12;
  for (let i = 0; i < 500; i++) {
    const x = r.uniform(-10, A.w * TS - 10), y = r.uniform(-30, A.h * TS - 40), palm = r.random() < 0.45, [w, h] = palm ? [28, 42] : [16, 12];
    if (!clear(x, y, w, h)) continue;
    if (palm) add("palm", x, y, [10, 30, 8, 6]); else add(r.random() < 0.5 ? "bush" : "bushb", x, y, [3, 6, 10, 4]);
  }
  for (let i = 0; i < 30; i++) { const x = r.uniform(20, 1100), y = r.uniform(20, 860); if (clear(x, y, 12, 9)) add("rock", x, y, [1, 3, 8, 4]); }
  return o;
}

// ---- fish sprites, drawn from each species' shape and colours
function fishPal(f) {
  const pat = f.c2[0] === "~" || f.c2[0] === "*", c2 = pat ? f.c2.slice(1) : f.c2;
  return { b: f.c1, c: pat ? shade(f.c1, 1.3) : c2, p: pat ? c2 : f.c1, d: shade(f.c1, 0.72), e: INK, w: "#fafaff" };
}
const SHAPE_ROWS = {
  crab: ["b.....b", "bb...bb", ".bbbbb.", "bbebebb", "bbbbbbb", ".ccccc.", "b.b.b.b"],
  prawn: ["d........", ".d.......", "..bbb....", ".bpbbbbe.", "..bbpbbbb", "....bbpbb", "...b.b.cc"],
  star: ["...b...", "...b...", "bbbpbbb", ".bbbbb.", ".bb.bb.", "b.....b"],
  urchin: ["d.d.d", ".bbb.", "dbpbd", ".bbb.", "d.d.d"],
  anemone: ["p.p.p.p", ".ppppp.", "..bbb..", "..bbb..", ".ccccc."],
  shell: ["...bb..", "..bpbb.", ".bbbpbb", "bbpbbbb", "ccccccb", ".e....."],
  slug: ["p....p.", "bbbbbbb", "bpbbpbb", ".ccccc."],
  horse: [".bbb.", "bbebb", "..bbb", "..bb.", ".bbp.", ".bb..", "..bb.", "...b."],
  jelly: [".bbbbb.", "bbpbpbb", "bbbbbbb", ".c.c.c.", ".c.c.c.", "c.c.c.."],
  squid: [".......bb", "..bbbbbbb", "ccbbbbebb", "..bbbbbbb", ".......bb"],
  octo: ["..bbbb..", ".bbbbbb.", ".bebbeb.", "..bbbb..", ".b.bb.b.", "b..bb..b"],
  ray: ["...bb....", "..bbbb...", ".bbpbbb..", "bbbbbbbbd", ".bbbbbb..", "..bbbb...", "...bb...."],
};
function fishRows(f) {
  const sh = f.shape;
  if (SHAPE_ROWS[sh]) return SHAPE_ROWS[sh];
  const L = { small: 9, fish: 13, long: 15, eel: 15, shark: 15, flat: 12, round: 11 }[sh] || 12, H = { small: 5, fish: 7, long: 4, eel: 5, shark: 7, flat: 7, round: 9 }[sh] || 6;
  const stripe = f.c2[0] === "~", spots = f.c2[0] === "*", rows = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < L; x++) {
      let ch = ".";
      const tail = sh === "round" ? 2 : 3, cy0 = (H - 1) / 2;
      if (sh === "eel") { const off = Math.round(Math.sin(x / 2.2) * 1); if (Math.abs(y - 2 - off) <= 0.5 + (x > L - 4 ? 0.5 : 0)) ch = "b"; }
      else if (x < tail) { if (Math.abs(y - cy0) <= (tail - x) * H / 7 + 0.5 && sh !== "flat") ch = "d"; }
      else { const ex = (x - tail - (L - tail) / 2) / ((L - tail) / 2), ey = (y - cy0) / (H / 2); if (ex * ex + ey * ey <= 1) ch = y > cy0 + (sh === "flat" ? 1 : 0.5) ? "c" : "b"; }
      if (ch === "b" && stripe && x % 3 === 1 && sh !== "eel") ch = "p";
      if ((ch === "b" || ch === "c") && spots && (x * 7 + y * 3) % 5 === 0) ch = "p";
      row += ch;
    }
    rows.push(row);
  }
  const ey = Math.max(1, Math.floor((H - 1) / 2) - 1), ex = sh === "eel" ? L - 2 : L - 3;
  rows[ey] = rows[ey].slice(0, ex) + "e" + rows[ey].slice(ex + 1);
  if (sh === "shark" || sh === "fish") { const mid = Math.floor(L / 2) + (sh === "shark" ? 0 : 1); rows.unshift(".".repeat(mid) + (sh === "shark" ? "dd" : "d") + ".".repeat(L - mid - (sh === "shark" ? 2 : 1))); }
  return rows;
}
function fishIcon(sp, sil) {
  const key = "fish_" + sp + (sil ? "s" : "");
  if (ISPR[key]) return ISPR[key];
  const f = FISH[sp], pal = sil ? Object.fromEntries("bcpdew".split("").map(k => [k, "#3c4058"])) : fishPal(f);
  return pix(key, fishRows(f), pal);
}
const _itemIcon = itemIcon;
itemIcon = function (id) { return id.startsWith("f_") ? fishIcon(id.slice(2)) : id === "rod" ? pix("icon_rod", ["......b", ".....b.", "....b..", "...b..l", "..b...l", ".h....l", "h.....w"], { b: "#96683e", h: "#5a3c24", l: "#e6e6e6", w: "#f05050" })
  : id === "net" ? pix("icon_net", ["nnnn...", "n.n.n..", "nnnn...", "n.n.n..", "nnnnb..", "....b..", ".....b."], { n: "#c8c8b4", b: "#96683e" })
  : id === "pot" ? pix("icon_pot", [".kkkkk.", "kmkmkmk", "kkkkkkk", "kmkmkmk", ".kkkkk."], { k: "#7c5232", m: "#c8b48c" }) : _itemIcon(id); };

// ---- the island log
function logGeo() { const wide = IW >= 300, w = wide ? Math.min(IW - 12, 372) : IW - 8; return [Math.round((IW - w) / 2), 4, w, IH - 8, wide]; }
const logList = p => ISLE_FISH.filter(f => f[2] === LOG_PAGES[p][0]).map(f => FISH[f[0]]);
const WHERE_TXT = { sea: "THE SEA", deep: "DEEP SEA WATER", lake: "THE LAGOON", river: "THE RIVER", pool: "TIDE POOLS, LOW TIDE", seapot: "CRAB POTS IN THE SEA", freshpot: "CRAB POTS IN THE LAGOON",
  marsh: "THE MARSH", wreck: "THE WRECK", gull: "GULL ROCK", light: "???" };
function whereTxt(f) { return f.where.startsWith("cave") ? "THE CAVES, LAYER " + f.where.slice(4) : f.where.startsWith("fest_") ? "A FESTIVAL" : WHERE_TXT[f.where]; }
function whenTxt(f) {
  const ss = f.seasons.length === 4 ? "ALL YEAR" : f.seasons.split("").map(d => SEASONS[+d][1]).join(" ");
  const tt = { a: "", m: ", MORNINGS", d: ", DAYTIME", e: ", EVENINGS", n: ", NIGHTS", w: ", DAWN" }[f.time], ww = { a: "", r: ", RAIN", s: ", SUN", n: ", SNOW" }[f.weather];
  return ss + tt + ww;
}
function logCells() {
  const [x, y, w, h, wide] = logGeo(), L = logList(ISLE.log.page), cols = 8, cw = 20, ch = 17, out = [];
  L.forEach((f, i) => out.push([x + 6 + (i % cols) * cw, y + 32 + Math.floor(i / cols) * ch, cw - 2, ch - 2, i]));
  return out;
}
function drawLogIsle() {
  const [x, y, w, h, wide] = logGeo(), s = isleSave(), P = ISLE.log, L = logList(P.page), got = Object.keys(s.log).length;
  g.globalAlpha = 0.55; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("ISLAND LOG", x + 8, y + 9, 1, "#b4461e", "left", null); text(got + "/" + ISLE_FISH.length, x + w - 8, y + 9, 1, "#5a3c28", "right", null);
  const tw = (w - 12) / LOG_PAGES.length;
  LOG_PAGES.forEach(([k, name, short], i) => { const tx = Math.round(x + 6 + i * tw), on = i === P.page; rect(on ? "#f4e4c0" : "#dcc49a", tx, y + 16, Math.round(tw) - 2, 12); if (on) outline(tx, y + 16, Math.round(tw) - 2, 12, "#b4461e"); text(short, tx + tw / 2 - 1, y + 22, 1, on ? "#b4461e" : "#5a3c28", "center", null); });
  for (const [cx_, cy_, cw, ch, i] of logCells()) {
    const f = L[i], e = s.log[f.id], on = i === P.sel;
    rect(on ? "#fff0b4" : "#e8d4aa", cx_, cy_, cw, ch); outline(cx_, cy_, cw, ch, on ? "#b4461e" : "#c8b088");
    const c = fishIcon(f.id, !e), k = Math.min(1, (cw - 2) / c.width, (ch - 2) / c.height);
    g.drawImage(c, 0, 0, c.width, c.height, Math.round(cx_ + (cw - c.width * k) / 2), Math.round(cy_ + (ch - c.height * k) / 2), Math.round(c.width * k), Math.round(c.height * k));
  }
  const f = L[P.sel], e = f && s.log[f.id], rows = Math.ceil(L.length / 8);
  const dx = wide ? x + 6 + 8 * 20 + 6 : x + 8, dy = wide ? y + 34 : y + 34 + rows * 17 + 4, dw = wide ? x + w - 6 - dx : w - 16, cols = Math.floor(dw / 6);
  if (!f) return;
  if (e) {
    text(f.name, dx, dy + 3, 1, f.page === "legend" ? "#b4781e" : "#3c2c22", "left", null);
    text("CAUGHT " + e.n + "  BEST " + e.best + " IN", dx, dy + 14, 1, "#5a3c28", "left", null);
    wrap(whereTxt(f) + ". " + whenTxt(f) + ".", cols).slice(0, 2).forEach((l, i) => text(l, dx, dy + 25 + i * 9, 1, "#8c6c50", "left", null));
    text("SELLS " + f.sell, dx, dy + 45, 1, "#8c6c50", "left", null);
    wrap(f.note, cols).slice(0, wide ? 6 : 8).forEach((l, i) => text(l, dx, dy + 58 + i * 9, 1, "#5a3c28", "left", null));
  } else {
    text("???", dx, dy + 3, 1, "#3c2c22", "left", null);
    const hint = ["legend", "special"].includes(f.page) ? "NOT CAUGHT YET. THE STORIES SAY IT'S OUT THERE." : LATER.test(f.where) ? "SOMEWHERE YOU HAVEN'T BEEN YET." : whereTxt(f) + ". " + whenTxt(f) + ".";
    wrap(hint, cols).slice(0, 4).forEach((l, i) => text(l, dx, dy + 16 + i * 9, 1, "#8c6c50", "left", null));
  }
  text(wide ? "ARROWS: PICK   TAB: NEXT PAGE   ESC: CLOSE" : "TAP A TAB OR A FISH", x + w / 2, y + h - 7, 1, "#8c6c50", "center", null);
}
function logKey(e) {
  const c = e.code, P = ISLE.log, n = logList(P.page).length;
  if (["Escape", "KeyL", "Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); ISLE.log = null; play("back"); return; }
  if (c === "Tab" || c === "BracketRight") { e.preventDefault(); P.page = (P.page + 1) % LOG_PAGES.length; P.sel = 0; play("tick"); return; }
  if (c === "BracketLeft") { P.page = (P.page + LOG_PAGES.length - 1) % LOG_PAGES.length; P.sel = 0; play("tick"); return; }
  if (/^Digit[1-7]$/.test(c)) { P.page = +c.slice(5) - 1; P.sel = 0; play("tick"); return; }
  const d = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -8, KeyW: -8, ArrowDown: 8, KeyS: 8 }[c];
  if (d) { P.sel = clamp(P.sel + d, 0, n - 1); play("tick"); }
}
function logTouch(x, y) {
  const [px, py, w, h] = logGeo(), P = ISLE.log;
  if (x < px || x > px + w || y < py || y > py + h) { ISLE.log = null; play("back"); return; }
  if (y >= py + 16 && y < py + 28) { P.page = clamp(Math.floor((x - px - 6) / ((w - 12) / LOG_PAGES.length)), 0, LOG_PAGES.length - 1); P.sel = 0; play("tick"); return; }
  const c = hitAt(logCells(), x, y); if (c) { P.sel = c[4]; play("tick"); }
}
function drawCatchCard() {
  const C_ = ISLE.card, f = FISH[C_.sp], w = Math.min(IW - 20, 240), h = 112, x = Math.round((IW - w) / 2), y = Math.round((IH - h) / 2) - 10;
  g.globalAlpha = 0.5; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("NEW IN THE LOG!", x + w / 2, y + 9, 1, "#b4461e", "center", null);
  const c = fishIcon(f.id), k = Math.min(4, 60 / c.width, 34 / c.height);
  g.drawImage(c, 0, 0, c.width, c.height, Math.round(x + w / 2 - c.width * k / 2), y + 16 + Math.round((34 - c.height * k) / 2), Math.round(c.width * k), Math.round(c.height * k));
  text(f.name, x + w / 2, y + 58, 1, f.page === "legend" ? "#b4781e" : "#3c2c22", "center", null);
  text(C_.inches + " IN   SELLS " + f.sell, x + w / 2, y + 68, 1, "#5a3c28", "center", null);
  wrap(f.note, Math.floor((w - 12) / 6)).slice(0, 3).forEach((l, i) => text(l, x + w / 2, y + 80 + i * 9, 1, "#8c6c50", "center", null));
}

// =====================================================================================================================
// Part 5: crafting, cooking and restoring the port. Driftwood Woods (west of the Port) has trees for the axe, rocks for
// the pick and tall grass for fiber; they grow back. C opens crafting (machines, paths, furniture to place anywhere), the
// shack's stove cooks, and five ruins can be restored with wood, stone and sand dollars, each opening something: the store,
// the smokehouse, the aquarium (walk in; donate topside fish), the shipyard (upgrades) and the inn. One fish from every
// topside dive lands in the fish crate on the beach.
const DAYN = s => (s.year - 1) * 112 + s.season * 28 + s.day;
const waterMax = () => isleSave().up.can ? 60 : WATER_MAX;
Object.assign(ITEMS, { axe: { name: "AXE", kind: "tool" }, pick: { name: "PICK", kind: "tool" },
  wood: { name: "WOOD", kind: "mat", sell: 2 }, stone: { name: "STONE", kind: "mat", sell: 2 }, fiber: { name: "FIBER", kind: "mat", sell: 1 },
  mushroom: { name: "MUSHROOM", kind: "forage", sell: 30 }, wildberry: { name: "WILD BERRY", kind: "forage", sell: 15 }, garlic: { name: "WILD GARLIC", kind: "forage", sell: 20 },
  pinecone: { name: "PINECONE", kind: "forage", sell: 6 }, bait: { name: "BAIT", kind: "bait", sell: 1 }, mulch: { name: "MULCH", kind: "mulch", sell: 1 } });
// topside fish (from the crate): t_<species>
const TOPFISH = SPECIES.filter(sp => !HIDDEN.includes(sp[0]));
TOPFISH.forEach(sp => { const avg = (sp[3][0] + sp[3][1]) / 2; ITEMS["t_" + sp[0]] = { name: sp[1], kind: "topfish", sell: Math.min(600, Math.round(avg * 1.2 + 6) * (sp[7] ? 3 : 1)), top: sp[0] }; });
// what the pickle jar and the fish smoker make
CROPS.forEach(c => { ITEMS["j_" + c[0]] = { name: "PICKLED " + c[1], kind: "artisan", sell: Math.round(c[5] * 2.2) }; });
Object.keys(ITEMS).filter(k => ITEMS[k].kind === "fish" || ITEMS[k].kind === "topfish").forEach(k => { ITEMS["k_" + k] = { name: "SMOKED " + ITEMS[k].name, kind: "artisan", sell: ITEMS[k].sell * 2 }; });
const isFishItem = id => ITEMS[id] && (ITEMS[id].kind === "fish" || ITEMS[id].kind === "topfish");

// ---- things you place: [id, name, solid, flat, light, art rows, palette]
const W_ = "#a06c40", WD = "#6e482a", ST = "#9a9aa6", SD_ = "#6e6e7a";
const PLACE = [
  ["chest", "CHEST", 1, 0, 0, [".wwwwwwwwww.", "wkkkkkkkkkkw", "wwwwwyywwwww", "wkkkkkkkkkkw", "wwwwwwwwwwww"], { w: W_, k: WD, y: "#ffd246" }],
  ["sprinkler", "SPRINKLER", 1, 0, 0, ["..b..", ".bbb.", "bsssb", ".sss."], { b: "#5aaadc", s: ST }],
  ["sprinkler2", "GOOD SPRINKLER", 1, 0, 0, ["b.b.b", ".bbb.", "bsysb", ".sss."], { b: "#5aaadc", s: ST, y: "#ffd246" }],
  ["jar", "PICKLE JAR", 1, 0, 0, ["..kk..", ".gggg.", "gwgggg", "gggggg", "gggggg", ".gggg."], { k: WD, g: "#8cc8a0", w: "#f0fff8" }],
  ["smoker", "FISH SMOKER", 1, 0, 0, ["..ss..", "..ss..", "ssssss", "sbbbbs", "sboobs", "ssssss"], { s: SD_, b: "#3c3c46", o: "#ff8c3c" }],
  ["lamp", "LANTERN POST", 1, 0, 1, [".kkk.", ".kyk.", ".kkk.", "..s..", "..s..", "..s..", "..s..", ".sss."], { k: INK, y: "#ffd678", s: "#3c3c46" }],
  ["pathstone", "STONE PATH", 0, 1, 0, null, null], ["pathwood", "WOOD PATH", 0, 1, 0, null, null],
  ["fence", "FENCE", 1, 0, 0, ["w..w..w", "wwwwwww", "w..w..w", "wwwwwww", "w..w..w"], { w: W_ }],
  ["table", "TABLE", 1, 0, 0, ["wwwwwwwwww", "wkkkkkkkkw", ".k......k.", ".k......k."], { w: W_, k: WD }],
  ["chair", "CHAIR", 1, 0, 0, ["w...", "w...", "wwww", "w..w"], { w: W_ }],
  ["bench", "BENCH", 1, 0, 0, ["wwwwwwwwww", "kkkkkkkkkk", "w........w"], { w: W_, k: WD }],
  ["stool", "STOOL", 1, 0, 0, ["wwww", ".kk.", "k..k"], { w: W_, k: WD }],
  ["shelf", "BOOKSHELF", 1, 0, 0, ["wwwwwwww", "wrbgyrbw", "wwwwwwww", "wgyrbgyw", "wwwwwwww"], { w: W_, r: "#c84a3c", b: "#4a78b4", g: "#5aa04a", y: "#e6c45a" }],
  ["wcrate", "WOODEN CRATE", 1, 0, 0, ["wwwwwww", "wkwwwkw", "wwkwkww", "wwwkwww", "wwkwkww", "wwwwwww"], { w: "#ba8c58", k: "#96683e" }],
  ["wbarrel2", "BARREL", 1, 0, 0, [".wwwww.", "kkkkkkk", "wwwwwww", "kkkkkkk", ".wwwww."], { w: W_, k: WD }],
  ["rug", "RUG", 0, 1, 0, null, null], ["shellrug", "SHELL RUG", 0, 1, 0, null, null],
  ["plantpot", "PLANT POT", 1, 0, 0, [".g.g.", "ggggg", ".ggg.", "rrrrr", ".rrr."], { g: "#5aa04a", r: "#b4643c" }],
  ["fern", "FERN", 0, 0, 0, ["g.g.g", ".ggg.", "ggggg", "..g.."], { g: "#4a8c46" }],
  ["fishbowl", "FISH BOWL", 1, 0, 0, [".ggg.", "gwbbg", "gbobg", "gbbbg", ".ggg."], { g: "#c8ecf0", w: "#ffffff", b: "#5ab4dc", o: "#ff8c32" }],
  ["shelllamp", "SHELL LAMP", 1, 0, 1, [".ppp.", "ppppp", "..y..", "..s..", ".sss."], { p: "#f0b4c8", y: "#ffd678", s: "#c8b48c" }],
  ["chime", "WIND CHIME", 0, 0, 0, ["wwwww", "p.p.p", "p.p.p", "..p.."], { w: "#b49a78", p: "#f0dcc8" }],
  ["signpost", "SIGNPOST", 1, 0, 0, ["wwwwww", "wwwwww", "..k...", "..k..."], { w: "#b08250", k: WD }],
  ["bell", "SHIP'S BELL", 1, 0, 0, ["k.....k", "kkkkkkk", "..yyy..", ".yyyyy.", ".yyyyy.", "..y.y.."], { k: WD, y: "#e6b43c" }],
  ["anchor", "ANCHOR", 1, 0, 0, ["..s..", ".s.s.", "..s..", "sssss", "..s..", "s.s.s", ".sss."], { s: "#6e6e7a" }],
  ["wheel", "SHIP'S WHEEL", 1, 0, 0, ["..w..", ".wkw.", "wk.kw", ".wkw.", "..w.."], { w: W_, k: WD }],
  ["buoy", "BUOY", 1, 0, 0, [".r.", "rrr", "www", "rrr", ".k."], { r: "#f05050", w: "#fafaff", k: WD }],
  ["netdecor", "HANGING NET", 0, 0, 0, ["kkkkkkk", "n.n.n.n", ".n.n.n.", "n.n.n.n"], { k: WD, n: "#c8c8b4" }],
  ["trophy", "FISH TROPHY", 1, 0, 0, ["wwwwwww", "wbbbbbw", "wbbbbbe", "wwwwwww"], { w: W_, b: "#5a8cb4", e: INK }],
  ["crabstatue", "STONE CRAB", 1, 0, 0, ["s.....s", "ss...ss", ".sssss.", "sssssss", "s.s.s.s"], { s: ST }],
  ["plantern", "PAPER LANTERN", 0, 0, 1, ["..k..", ".ooo.", "ooyoo", ".ooo.", "..k.."], { k: WD, o: "#ff8c46", y: "#ffd678" }],
  ["driftart", "DRIFTWOOD ART", 1, 0, 0, ["d...d", ".d.d.", "..d..", ".d.d.", "dd.dd"], { d: "#b49a78" }],
  ["mosaic", "SEA GLASS MOSAIC", 1, 0, 0, ["kkkkkk", "kgbgbk", "kbgwgk", "kgbgbk", "kkkkkk"], { k: WD, g: "#6edcc8", b: "#5a96dc", w: "#d2fff4" }],
  ["wreath", "STARFISH WREATH", 0, 0, 0, [".ggg.", "go.og", "g...g", "go.og", ".ggg."], { g: "#5aa04a", o: "#ff8c46" }],
  ["pearlbox", "PEARL BOX", 1, 0, 0, ["wwwww", "wpppw", "wwwww"], { w: W_, p: "#ece8f4" }],
  ["scarer", "GULL SCARER", 1, 0, 0, ["..h..", ".www.", "wwwww", "..w..", ".w.w."], { h: "#e6c45a", w: "#b49a78" }],
  ["painting", "PAINTING", 1, 0, 0, ["kkkkkkk", "kbbbbbk", "kbgggbk", "kgsggsk", "kkkkkkk"], { k: "#b4823c", b: "#78c8f0", g: "#5aa04a", s: "#f0e6a0" }],
  ["palmpot", "POTTED PALM", 1, 0, 0, ["g.g.g", ".ggg.", "..w..", "..w..", ".rrr."], { g: "#3c8c46", w: "#96683e", r: "#b4643c" }],
  ["chart", "SEA CHART", 1, 0, 0, ["wwwwwww", "wbbybbw", "wbgbbbw", "wbbbgbw", "wwwwwww"], { w: "#e6d2a0", b: "#78b4dc", y: "#f05050", g: "#5aa04a" }],
];
const PL = {}; PLACE.forEach(([id, name, solid, flat, light, rows, pal]) => { PL[id] = { id, name, solid, flat, light, rows, pal }; ITEMS[id] = { name, kind: "place", sell: 0 }; });
// [output, how many, ingredients]
const CRAFT = [["chest", 1, [["wood", 40]]], ["sprinkler", 1, [["stone", 15], ["glass", 2]]], ["sprinkler2", 1, [["stone", 30], ["glass", 5], ["pearl", 1]]],
  ["jar", 1, [["wood", 25], ["glass", 3]]], ["smoker", 1, [["stone", 30], ["wood", 15]]], ["pot", 1, [["wood", 20], ["stone", 5]]], ["bait", 5, [["fiber", 3], ["shell", 1]]],
  ["mulch", 5, [["fiber", 5]]], ["lamp", 1, [["wood", 5], ["stone", 5], ["glass", 1]]], ["pathstone", 5, [["stone", 2]]], ["pathwood", 5, [["wood", 2]]], ["fence", 4, [["wood", 4]]],
  ["table", 1, [["wood", 15]]], ["chair", 1, [["wood", 8]]], ["bench", 1, [["wood", 12]]], ["stool", 1, [["wood", 5]]], ["shelf", 1, [["wood", 30]]], ["wcrate", 1, [["wood", 10]]],
  ["wbarrel2", 1, [["wood", 12]]], ["rug", 1, [["fiber", 20]]], ["shellrug", 1, [["fiber", 20], ["shell", 5]]], ["plantpot", 1, [["stone", 8], ["fiber", 2]]], ["fern", 1, [["fiber", 6]]],
  ["fishbowl", 1, [["glass", 6], ["anyfish", 1]]], ["shelllamp", 1, [["shell", 6], ["glass", 2]]], ["chime", 1, [["shell", 4], ["drift", 2]]], ["signpost", 1, [["wood", 6]]],
  ["bell", 1, [["stone", 10], ["wood", 4]]], ["anchor", 1, [["stone", 25]]], ["wheel", 1, [["wood", 20]]], ["buoy", 1, [["wood", 6], ["fiber", 4]]], ["netdecor", 1, [["fiber", 15]]],
  ["trophy", 1, [["wood", 10], ["anyfish", 1]]], ["crabstatue", 1, [["stone", 30]]], ["plantern", 1, [["fiber", 8]]], ["driftart", 1, [["drift", 10]]], ["mosaic", 1, [["glass", 12]]],
  ["wreath", 1, [["starfish", 3], ["fiber", 4]]], ["pearlbox", 1, [["pearl", 1], ["wood", 10]]], ["scarer", 1, [["wood", 10], ["fiber", 10]]]];
// ---- cooking: [id, name, ingredients, needs the smokehouse, colour]
const COOK = [
  ["grilled", "GRILLED FISH", [["anyfish", 1]], 0, "#c8965a"], ["stew", "FISH STEW", [["anyfish", 2], ["onion", 1]], 0, "#dc8c50"],
  ["salad", "SEAWEED SALAD", [["lettuce", 1], ["kale", 1]], 0, "#6ec85a"], ["noodles", "KELP NOODLES", [["kelp", 2]], 0, "#8cb43c"],
  ["sampbutter", "SAMPHIRE BUTTER", [["samphire", 2]], 0, "#c8dc78"], ["beetsoup", "BEET SOUP", [["beet", 2], ["onion", 1]], 0, "#b43c5a"],
  ["peasoup", "PEA SOUP", [["pea", 3]], 0, "#a0e05a"], ["berrytart", "BERRY TART", [["berry", 3]], 0, "#f05050"],
  ["grapebowl", "SEA GRAPE BOWL", [["grape", 3]], 0, "#5ad2b4"], ["peppers", "STUFFED PEPPERS", [["pepper", 2], ["anycrop", 1]], 0, "#ff6e46"],
  ["squashbake", "SQUASH BAKE", [["squash", 1], ["onion", 1]], 0, "#ffbe3c"], ["gratin", "OYSTER GRATIN", [["oyster", 1], ["potato", 1]], 0, "#b4dcf0"],
  ["tomsoup", "TOMATO SOUP", [["tomato", 3]], 0, "#f04646"], ["melonslice", "MELON SLICES", [["melon", 1]], 0, "#e6d28c"],
  ["norirolls", "NORI ROLLS", [["nori", 2], ["anyfish", 1]], 0, "#46825a"], ["chips", "SALT POTATO CHIPS", [["potato", 2]], 0, "#e6c878"],
  ["crisps", "RED KELP CRISPS", [["redkelp", 2]], 0, "#c85a46"], ["beanstew", "BEAN STEW", [["bean", 3], ["onion", 1]], 0, "#8cc85a"],
  ["jam", "BOG BERRY JAM", [["bog", 3]], 0, "#c83c5a"], ["cabrolls", "CABBAGE ROLLS", [["cabbage", 1], ["anyfish", 1]], 0, "#b4dcc8"],
  ["chowdercorn", "CORN CHOWDER", [["corn", 2], ["potato", 1]], 0, "#ffd246"], ["pie", "PUMPKIN PIE", [["pumpkin", 1], ["bog", 1]], 0, "#ff8c32"],
  ["frosty", "FROSTY SALAD", [["icelettuce", 2]], 0, "#dcf0fa"], ["broth", "KELP BROTH", [["frostkelp", 2]], 0, "#a0d2e6"],
  ["wrackchips", "WRACK CHIPS", [["wrack", 2]], 0, "#c8be5a"], ["oniontart", "PEARL ONION TART", [["pearlonion", 2]], 0, "#f6f2fa"],
  ["sardtoast", "SARDINES ON TOAST", [["f_sardine", 2], ["anycrop", 1]], 0, "#9ab4c8"], ["pate", "MACKEREL PATE", [["f_mackerel", 1], ["onion", 1]], 0, "#3c78a0"],
  ["fishchips", "FISH AND CHIPS", [["anyfish", 1], ["potato", 2]], 0, "#e6b45a"], ["crabcakes", "CRAB CAKES", [["crab", 2]], 0, "#e6a06e"],
  ["cocktail", "PRAWN COCKTAIL", [["prawn", 2], ["lettuce", 1]], 0, "#f0a08c"], ["lobroll", "LOBSTER ROLL", [["f_lobster", 1]], 1, "#dc5a46"],
  ["salmonplate", "SALMON PLATTER", [["f_salmon", 1], ["anycrop", 2]], 1, "#f08c6e"], ["troutsupper", "TROUT SUPPER", [["f_rainbow", 1], ["bean", 1]], 1, "#8cb46e"],
  ["chowder", "SHELLFISH CHOWDER", [["shellfish", 3], ["potato", 1]], 1, "#f0e6c8"], ["urchintoast", "URCHIN TOAST", [["f_urchin", 2]], 1, "#c88cdc"],
  ["shellstew", "SHELLFISH STEW", [["shellfish", 2], ["tomato", 1]], 1, "#dc7864"], ["mushsoup", "MUSHROOM SOUP", [["mushroom", 3]], 1, "#a08c6e"],
  ["forager", "FORAGER'S PLATE", [["mushroom", 1], ["wildberry", 1], ["garlic", 1]], 1, "#7a5a8c"], ["breakfast", "THE ANGLER'S BREAKFAST", [["anyfish", 1], ["onion", 1], ["potato", 1], ["mushroom", 1]], 1, "#ffbe3c"],
];
const TAG_EST = { anyfish: 40, anycrop: 40, crab: 30, prawn: 30, shellfish: 15 };
COOK.forEach(([id, name, ing, , col]) => { ITEMS["d_" + id] = { name, kind: "dish", sell: Math.round(ing.reduce((a, [k, n]) => a + (TAG_EST[k] || (ITEMS[k] && ITEMS[k].sell) || 20) * n, 0) * 1.5 + 10), col }; });
// ---- the buildings: what restoring them takes
const RESTORE = {
  store: { name: "THE GENERAL STORE", ruin: "THE OLD GENERAL STORE. THE ROOF CAVED IN YEARS AGO.", need: [["wood", 100], ["stone", 40]], sd: 800, done: "THE STORE IS OPEN AGAIN: SEEDS, TACKLE AND FURNITURE." },
  smoke: { name: "THE SMOKEHOUSE", ruin: "A SMOKEHOUSE. IT STILL SMELLS FAINTLY OF FISH.", need: [["wood", 60], ["stone", 120], ["anyfish", 5]], sd: 600, done: "THE SMOKEHOUSE IS FIRED UP. IT COOKS THE BETTER RECIPES." },
  aquarium: { name: "THE AQUARIUM", ruin: "AN AQUARIUM, OF ALL THINGS. THE GLASS DOME IS CRACKED AND THE TANKS ARE EMPTY.", need: [["stone", 200], ["glass", 15]], sd: 1500, done: "THE AQUARIUM'S TANKS ARE FULL OF CLEAN WATER. NOW IT NEEDS FISH." },
  yard: { name: "THE SHIPYARD", ruin: "THE SHIPYARD. HALF A HULL IS STILL ON THE SLIPWAY.", need: [["wood", 250], ["stone", 60], ["fiber", 40]], sd: 2000, done: "THE SHIPYARD IS BACK IN BUSINESS. THE SHIPWRIGHT CAN UPGRADE YOUR GEAR." },
  inn: { name: "THE INN", ruin: "THE INN. THE SIGN STILL SWINGS. NOBODY HAS SLEPT HERE IN A LONG TIME.", need: [["wood", 200], ["stone", 150], ["fiber", 60]], sd: 3000, done: "THE INN HAS CLEAN SHEETS AND A FIRE IN THE GRATE. GUESTS WILL COME." },
};
const UPGRADES = [["bag", "BIGGER BAG", "+9 BAG SLOTS", 1500, [["wood", 50]]], ["can", "BIG CAN", "HOLDS 60 WATER", 1000, [["stone", 30]]], ["rod", "GOOD ROD", "CASTS FARTHER, REELS EASIER", 1500, [["wood", 30]]],
  ["hoe", "STEEL HOE", "TILLS 3 TILES IN A ROW", 1200, [["stone", 40]]], ["axe", "SHARP AXE", "TREES IN 2 CHOPS", 800, [["stone", 20]]], ["pick", "STRONG PICK", "ROCKS IN 1 HIT", 800, [["wood", 20]]]];

// ---- counting and taking things from the bag (ids or tags)
function matches(id, spec) {
  if (!id) return false;
  if (spec === "anyfish") return isFishItem(id);
  if (spec === "anycrop") return ITEMS[id].kind === "crop";
  if (spec === "crab" || spec === "prawn" || spec === "shellfish") { const f = id.startsWith("f_") && FISH[id.slice(2)]; return !!f && (spec === "crab" ? f.shape === "crab" : spec === "prawn" ? f.shape === "prawn" : f.shape === "shell"); }
  return id === spec;
}
function invCount(spec) { return isleSave().inv.reduce((a, q) => a + (q && matches(q[0], spec) ? q[1] : 0), 0); }
function invTake(spec, n) { const inv = isleSave().inv; for (let i = 0; i < inv.length && n > 0; i++) if (inv[i] && matches(inv[i][0], spec)) { const k = Math.min(n, inv[i][1]); inv[i][1] -= k; n -= k; if (!inv[i][1]) inv[i] = null; } }
const specName = sp => ({ anyfish: "ANY FISH", anycrop: "ANY CROP", crab: "CRABS", prawn: "PRAWNS", shellfish: "SHELLFISH" })[sp] || ITEMS[sp].name;
const canPay = (need, sd) => need.every(([k, n]) => invCount(k) >= n) && isleSave().sd >= (sd || 0);
function pay(need, sd) { need.forEach(([k, n]) => invTake(k, n)); isleSave().sd -= sd || 0; }

// ---- art for the woods and the restored buildings
function artPine() {
  const P = paintCanvas(24, 40); P.shadow(11, 36, 9, 3); P.rect(10, 28, 4, 9, "#6e482a");
  for (let j = 0; j < 29; j++) { const tier = j % 9, half = Math.min(10, 1 + tier * 1.1 + Math.floor(j / 9) * 1.4); for (let i = -Math.round(half); i <= Math.round(half); i++) P.px(12 + i, 1 + j, Math.abs(i) === Math.round(half) || tier === 8 ? "#1e5030" : i < 0 && tier < 5 ? "#46965a" : "#2c6e3c"); }
  return P.c;
}
function artOak() {
  const P = paintCanvas(30, 38); P.shadow(14, 34, 11, 3); P.rect(12, 22, 6, 13, "#7c5232"); P.rect(12, 22, 2, 13, "#5a3c24");
  const r = seeded(9);
  for (let j = 0; j < 24; j++) for (let i = 0; i < 28; i++) { const e = ((i - 13.5) / 13.5) ** 2 + ((j - 11) / 11) ** 2; if (e <= 1) P.px(1 + i, 1 + j, e > 0.82 ? "#3c7432" : r.random() < 0.12 ? "#6eb45a" : j < 9 && i < 14 && r.random() < 0.3 ? "#5aa04a" : "#4a8c3c"); else if (e <= 1.12) P.px(1 + i, 1 + j, INK); }
  return P.c;
}
function artStump() { const P = paintCanvas(14, 10); P.shadow(6, 7, 6, 2); P.rows([".bbbbbb.", "brrrrrrb", "bbbbbbbb"], { b: "#7c5232", r: "#c8a070" }, 2, 2); return P.c; }
function artBoulder() { const P = paintCanvas(22, 16); P.shadow(10, 13, 10, 2); P.rows(["...ssssss...", ".sslsssssss.", "sslssssssdss", "ssssssssssds", ".ssssssssds."], { s: "#8c8c96", l: "#b4b4be", d: "#6e6e78" }, 2, 3); return P.c; }
function artTallGrass() { const P = paintCanvas(14, 12); P.rows(["g..g..g", ".g.gg.g", "gggggg.", ".ggggg.", "ggggggg"], { g: "#5aa04a" }, 2, 3, false); return P.c; }
function artBuilt(sign, roof, wall) {                         // a restored building: whole roof, open door, lit windows
  const P = paintCanvas(64, 62), x0 = 2, y0 = 10, sw = sign.length * 6 + 2;
  P.shadow(x0 + 30, y0 + 46, 33, 4);
  for (let j = 0; j < 24; j++) for (let i = 0; i < 56; i++) P.px(x0 + 2 + i, y0 + 20 + j, j % 4 === 0 ? shade(wall, 0.85) : (i % 14 === 0 ? shade(wall, 0.9) : wall));
  for (let j = 0; j < 20; j++) for (let i = -2; i < 62; i++) if (Math.abs(i - 30) <= 32 - Math.max(0, 10 - j) * 0) P.px(x0 + i, y0 + j, j % 3 === 2 ? shade(roof, 0.75) : (Math.floor(i / 4) + Math.floor(j / 3)) % 2 ? roof : shade(roof, 0.9));
  P.rect(x0 - 2, y0 + 19, 64, 2, INK); P.rect(x0 - 2, y0 - 1, 64, 1, INK);
  P.rect(x0 + 21, y0 + 30, 12, 14, "#3c2818"); P.rect(x0 + 21, y0 + 30, 12, 1, INK); P.px(x0 + 30, y0 + 37, "#f0c85a");
  for (const wx of [x0 + 6, x0 + 42]) { P.rect(wx - 1, y0 + 25, 11, 9, INK); P.rect(wx, y0 + 26, 9, 7, "#ffd678"); P.rect(wx + 4, y0 + 26, 1, 7, "#78502e"); }
  const sx = x0 + 27 - (sw >> 1); P.rect(sx, y0 + 21, sw, 8, "#785432"); P.rect(sx, y0 + 21, sw, 1, INK); P.text(sign, sx + 1, y0 + 22, "#ffe6a0");
  P.rect(x0 + 2, y0 + 44, 56, 1, INK);
  return P.c;
}
function artAquaFixed() { const c = artAquarium(), x = c.getContext("2d"); x.fillStyle = "#78c4dc"; for (const [a, b] of [[2, -14], [4, -11], [3, -8], [6, -6], [5, -3]]) { x.fillRect(38 + a, 32 + b, 2, 2); } x.fillStyle = "#1e3c50"; x.fillRect(31, 43, 14, 16); return c; }
function artTank(n) { const P = paintCanvas(52, 34); P.rect(0, 0, 52, 30, INK); P.rect(1, 1, 50, 28, "#2c5a78"); P.rect(2, 2, 48, 22, "#4a8cb4"); P.rect(2, 22, 48, 4, "#c8b48c"); for (let k = 0; k < 4; k++) P.rect(6 + k * 11, 18, 2, 5, "#4a8c46"); P.rect(0, 30, 52, 4, "#6e482a"); return P.c; }
function artDonate() { const P = paintCanvas(18, 22); P.shadow(8, 19, 7, 2); P.rect(1, 4, 16, 14, INK); P.rect(2, 5, 14, 12, "#96643c"); P.rect(5, 6, 8, 2, "#3c2818"); P.text("+", 6, 9, "#ffd246"); return P.c; }
function artPlaque() { const P = paintCanvas(30, 14); P.rect(0, 0, 30, 12, INK); P.rect(1, 1, 28, 10, "#b4823c"); P.rect(3, 3, 24, 6, "#e6c878"); return P.c; }
function isleArt5() {
  if (IART.pine) return;
  Object.assign(IART, { pine: artPine(), oak: artOak(), stump: artStump(), boulder: artBoulder(), tgrass: artTallGrass(), sign_woods: artSign("DRIFTWOOD WOODS"),
    store_r: artBuilt("STORE", "#52788a", "#d8ccb4"), inn_r: artBuilt("INN", "#8a5246", "#e0d2b8"), smoke_r: artBuilt("SMOKEHOUSE", "#5a5a62", "#c8bea8"),
    yard_r: artBuilt("SHIPYARD", "#6a6a4a", "#d2c4a0"), aquarium_r: artAquaFixed(), tank: artTank(), donate: artDonate(), plaque: artPlaque(), adoor: paintCanvas(32, 12).c });
}
const _isleArt = isleArt; isleArt = function () { _isleArt(); isleArt5(); };
function artKey(o) { return o.act && o.act.kind === "restore" && isleSave().rest[o.act.b] === "done" ? o.k + "_r" : o.k; }
function objGone(o) { return !!(o.res && (isleSave().cut[o.res.key] || 0) > DAYN(isleSave())); }

// ---- the woods
function woodsObjects() {
  const o = [], add = (k, x, y, solid, act, res) => o.push({ k, x, y, solid, act, res }), A = AREAS.woods, r = seeded(555);
  add("sign_woods", 1180, 520, [44, 10, 6, 8], { kind: "say", text: ["DRIFTWOOD WOODS. TREES FOR THE AXE, ROCKS FOR THE PICK, GRASS FOR FIBER. IT ALL GROWS BACK."] });
  add("pile", 2, 404, [0, 4, 36, 16], { kind: "say", text: ["A PILE OF DRIFTWOOD BLOCKS THE WAY. A SIGN ON TOP SAYS: SHIPWRECK BEACH."] });
  const clear = (x, y, w, h) => !o.some(q => x + w > q.x - 2 && x < q.x + IART[q.k].width + 2 && y + h > q.y && y < q.y + IART[q.k].height) && pathDist(A, x + w / 2, y + h - 4) > 16
    && freshDepth(A, x + w / 2, y + h - 2) < -10 && Math.hypot(x + w / 2 - 1180, y + h - 540) > 60;
  for (let i = 0; i < 1400; i++) {
    const x = r.uniform(-12, A.w * TS - 12), y = r.uniform(-36, A.h * TS - 36), pine = r.random() < 0.55, [w, h] = pine ? [24, 40] : [30, 36];
    if (clear(x, y + h - 12, w, 12)) add(pine ? "pine" : "oak", x, y, pine ? [9, 28, 6, 8] : [11, 26, 8, 8], null, { kind: "tree" });
  }
  for (let i = 0; i < 300; i++) { const x = r.uniform(10, A.w * TS - 30), y = r.uniform(10, A.h * TS - 20); if (clear(x, y, 22, 16)) add("boulder", x, y, [3, 6, 16, 8], null, { kind: "rock", big: 1 }); }
  for (let i = 0; i < 900; i++) { const x = r.uniform(10, A.w * TS - 20), y = r.uniform(10, A.h * TS - 20); if (clear(x, y, 14, 12)) add("tgrass", x, y, null, { kind: "grass", rect: [0, 0, 14, 12] }, { kind: "grass" }); }
  for (let i = 0; i < 80; i++) { const x = r.uniform(0, A.w * TS), y = r.uniform(0, A.h * TS), d = freshDepth(A, x, y + 14); if (d > -7 && d < -1) add("reed", x - 4, y, null); }
  return o;
}
function aquaObjects() {
  const o = [];
  for (let k = 0; k < 5; k++) o.push({ k: "tank", x: 14 + k * 60, y: 22, solid: [0, 0, 52, 34], act: { kind: "tank", z: k } });
  for (let k = 0; k < 5; k++) o.push({ k: "tank", x: 14 + k * 60, y: 96, solid: [0, 0, 52, 34], act: { kind: "tank", z: k + 5 } });
  o.push({ k: "donate", x: 110, y: 150, solid: [1, 10, 16, 8], act: { kind: "donate" } });
  o.push({ k: "plaque", x: 196, y: 156, solid: [0, 4, 30, 8], act: { kind: "plaque" } });
  o.push({ k: "adoor", x: 144, y: 180, solid: null, act: { kind: "door", to: "port", rect: [0, 0, 32, 12], dir: "down", go: { x: 598, y: 414, dir: "down" } } });
  return o;
}
const _buildArea = buildArea;
buildArea = function (id) {                                     // number the things that can be cut down; rocks everywhere break
  const m = _buildArea(id);
  m.objs.forEach((o, i) => { if (o.k === "rock" && !o.res) o.res = { kind: "rock" }; if (o.res) o.res.key = id + ":" + i; });
  return m;
};
function resAt(x, y) {
  for (const o of ISLE.map.objs) {
    if (!o.res || objGone(o)) continue;
    const r = o.solid ? [o.solid[0] - 6, o.solid[1] - 10, o.solid[2] + 12, o.solid[3] + 14] : [0, 0, IART[o.k].width, IART[o.k].height];
    if (x >= o.x + r[0] && x < o.x + r[0] + r[2] && y >= o.y + r[1] && y < o.y + r[1] + r[3]) return o;
  }
  return null;
}
function toolHit(tool) {
  const s = isleSave(), [fx, fy] = facingPoint(), o = resAt(fx, fy) || resAt(ISLE.px, ISLE.py - 6);
  if (!o) { play("miss"); return; }
  const k = o.res.kind, want = k === "tree" ? "axe" : k === "rock" ? "pick" : null;
  if (k === "grass") { cutGrass(o); return; }
  if (want !== tool) { toast(k === "tree" ? "THAT NEEDS THE AXE" : "THAT NEEDS THE PICK"); play("miss"); return; }
  const full = k === "tree" ? 3 : o.res.big ? 2 : 1, dmg = (tool === "axe" && s.up.axe) || (tool === "pick" && s.up.pick) ? 2 : 1;
  o.hp = (o.hp === undefined ? full : o.hp) - dmg; o.hit = 0.2; play("hit"); splashDust(Math.floor((o.x + 12) / TS), Math.floor((o.y + IART[o.k].height - 6) / TS), k === "tree" ? "#8c6a46" : "#b4b4be");
  if (o.hp > 0) return;
  o.hp = undefined;
  const n = k === "tree" ? (o.k === "oak" ? 5 : 4) : o.res.big ? 3 + Math.floor(Math.random() * 3) : 1, item = k === "tree" ? "wood" : "stone";
  const left = invAdd(item, n); if (left) toast("YOUR BAG IS FULL");
  toast("+" + (n - left) + " " + ITEMS[item].name, "#d2b482"); play("chime");
  s.cut[o.res.key] = DAYN(s) + (k === "tree" ? 7 : o.res.big ? 6 : 3);
  if (k === "tree" && Math.random() < 0.15) { invAdd("fiber", 2); toast("+2 FIBER", "#a0dc78"); }
}
function cutGrass(o) {
  const s = isleSave(), n = 1 + (Math.random() < 0.5 ? 1 : 0);
  if (invAdd("fiber", n) > 0) { toast("YOUR BAG IS FULL"); play("miss"); return; }
  s.cut[o.res.key] = DAYN(s) + 2; toast("+" + n + " FIBER", "#a0dc78"); play("tick");
}

// ---- placing things
function placedAt(tx, ty, area) { const a = area || ISLE.map.id; return isleSave().placed.find(p => p.a === a && p.x === tx && p.y === ty); }
function placedSolidAt(x, y) { const p = placedAt(Math.floor(x / TS), Math.floor(y / TS)); return !!(p && PL[p.id].solid); }
function placeItem() {
  const s = isleSave(), it = held(), [tx, ty] = facingTile(), t = tileAt(tx, ty), cx = tx * TS + 8, cy = ty * TS + 8;
  const blocked = ["a", "d", "x", "t"].includes(t) || placedAt(tx, ty) || s.farm[farmKey(tx, ty)] || isleSolidAt(cx, cy) || isleSolidAt(cx, cy + 6) || (Math.floor(ISLE.px / TS) === tx && Math.floor((ISLE.py - 2) / TS) === ty);
  if (blocked) { toast("IT WON'T FIT THERE"); play("miss"); return; }
  s.placed.push({ a: ISLE.map.id, x: tx, y: ty, id: it[0] }); invUse(s.sel); play("hit");
}
function plSprite(id) { const P_ = PL[id]; return P_.rows ? pix("pl_" + id, P_.rows, P_.pal) : null; }
function drawPlacedFlat(cx, cy) {
  for (const p of isleSave().placed) {
    if (p.a !== ISLE.map.id || !PL[p.id].flat) continue;
    const x = p.x * TS - cx, y = p.y * TS - cy; if (x < -16 || y < -16 || x > IW || y > IH) continue;
    if (p.id === "pathstone") { rect("#8c8c96", x + 1, y + 1, 14, 14); rect("#a0a0aa", x + 2, y + 2, 6, 5); rect("#a0a0aa", x + 9, y + 8, 5, 5); rect("#76767e", x + 2, y + 9, 5, 4); }
    else if (p.id === "pathwood") { for (let k = 0; k < 4; k++) { rect(k % 2 ? "#a06c40" : "#b47e4a", x, y + k * 4, 16, 4); rect("#6e482a", x, y + k * 4 + 3, 16, 1); } }
    else { const c1 = p.id === "rug" ? "#a03c32" : "#4a78b4", c2 = p.id === "rug" ? "#e6c45a" : "#f0b4c8"; rect(c1, x, y + 1, 16, 14); rect(c2, x + 2, y + 3, 12, 1); rect(c2, x + 2, y + 12, 12, 1); rect(c2, x + 6, y + 6, 4, 4); }
  }
}
function placedSprites(list) {
  for (const p of isleSave().placed) {
    if (p.a !== ISLE.map.id || PL[p.id].flat) continue;
    list.push([p.y * TS + 15, { draw(cx, cy) {
      const c = plSprite(p.id), x = p.x * TS + 8 - (c.width >> 1) - cx, y = p.y * TS + 15 - c.height - cy;
      if (x < -20 || y < -30 || x > IW || y > IH) return;
      g.globalAlpha = 0.22; g.fillStyle = "#000"; g.beginPath(); g.ellipse(p.x * TS + 8 - cx, p.y * TS + 14 - cy, 6, 2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      g.drawImage(c, x, y);
      if (p.m && p.m.ready <= DAYN(isleSave()) && Math.floor(T * 3) % 2) rect(GOLD, p.x * TS + 8 - cx, y - 4, 1, 3);
      if (p.m && p.m.ready > DAYN(isleSave()) && p.id === "smoker") { g.globalAlpha = 0.5; rect("#c8c8d2", p.x * TS + 7 - cx + Math.round(Math.sin(T * 3)), y - 3 - (T * 6 % 6), 2, 2); g.globalAlpha = 1; }
    } }]);
  }
}
function placedInteract() {
  const s = isleSave(), [tx, ty] = facingTile(), p = placedAt(tx, ty);
  if (!p) return false;
  const P_ = PL[p.id], it = held(), day = DAYN(s);
  if (p.id === "chest") { ISLE.chest = { p, side: 0, sel: 0 }; play("select"); return true; }
  if (p.id === "jar" || p.id === "smoker") {
    if (p.m && p.m.ready <= day) { if (invAdd(p.m.out, 1) > 0) { toast("YOUR BAG IS FULL"); return true; } toast("+1 " + ITEMS[p.m.out].name, GOLD); p.m = null; play("chime"); return true; }
    if (p.m) { toast(p.id === "jar" ? "STILL PICKLING. TRY TOMORROW" : "STILL SMOKING. READY TOMORROW"); return true; }
    if (it && p.id === "jar" && ITEMS[it[0]].kind === "crop") { p.m = { out: "j_" + it[0], ready: day + 2 }; invUse(s.sel); toast("PICKLING. READY IN 2 DAYS"); play("plop"); return true; }
    if (it && p.id === "smoker" && isFishItem(it[0])) { p.m = { out: "k_" + it[0], ready: day + 1 }; invUse(s.sel); toast("SMOKING. READY TOMORROW"); play("plop"); return true; }
    isleSay([p.id === "jar" ? "A PICKLE JAR. HOLD A CROP AND USE IT: PICKLES IN 2 DAYS, WORTH MORE THAN TWICE AS MUCH." : "A FISH SMOKER. HOLD A FISH AND USE IT: SMOKED BY MORNING, WORTH TWICE AS MUCH."], { opts: ["PICK IT UP", "LEAVE IT"], act: [() => pickUp(p), () => play("tick")] });
    return true;
  }
  isleSay([P_.name + ".", "PICK IT UP?"], { opts: ["PICK IT UP", "LEAVE IT"], act: [() => pickUp(p), () => play("tick")] });
  return true;
}
function pickUp(p) {
  const s = isleSave();
  if (p.id === "chest" && (s.chests[p.a + ":" + p.x + "," + p.y] || []).some(Boolean)) { toast("EMPTY THE CHEST FIRST"); return; }
  if (invAdd(p.id, 1) > 0) { toast("YOUR BAG IS FULL"); return; }
  s.placed = s.placed.filter(q => q !== p); play("select");
}
function sprinklersWater(s) {
  for (const p of s.placed) if (p.id === "sprinkler" || p.id === "sprinkler2" || p.id === "sprinkler3") {
    const R = p.id === "sprinkler" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : p.id === "sprinkler2" ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [-2, -1, 0, 1, 2].flatMap(a => [-2, -1, 0, 1, 2].map(b => [a, b])).filter(([a, b]) => a || b);    // part 7: the iron sprinkler, 5 x 5
    for (const [a, b] of R) { const e = s.farm[p.a + ":" + (p.x + a) + "," + (p.y + b)]; if (e) e.w = 1; }
  }
}
function mulchUse() {
  const s = isleSave(), [tx, ty] = facingTile(), e = s.farm[farmKey(tx, ty)];
  if (!e || e.mulch) { toast(e ? "ALREADY MULCHED" : "MULCH GOES ON TILLED GROUND"); play("miss"); return; }
  e.mulch = 1; e.w = 1; invUse(s.sel); toast("MULCHED: IT STAYS WATERED", "#a0dc78"); play("plop");
}

// ---- the chest
const chestKey_ = p => p.a + ":" + p.x + "," + p.y;
function chestSlots() { const s = isleSave(), k = chestKey_(ISLE.chest.p); if (!s.chests[k]) s.chests[k] = Array(18).fill(null); return s.chests[k]; }
function chestGeo() { const w = 9 * TB_SLOT + 16, bagRows = isleSave().inv.length / 9, h = (2 + bagRows) * (TB_SLOT + 2) + 46; return [Math.round((IW - w) / 2), Math.max(2, Math.round((IH - h) / 2)), w, h]; }
function chestCells() {
  const [x, y] = chestGeo(), out = [], bagRows = isleSave().inv.length / 9;
  for (let i = 0; i < 18; i++) out.push([x + 8 + (i % 9) * TB_SLOT, y + 18 + Math.floor(i / 9) * (TB_SLOT + 2), TB_SLOT, TB_SLOT, 0, i]);
  for (let i = 0; i < bagRows * 9; i++) out.push([x + 8 + (i % 9) * TB_SLOT, y + 26 + (2 + Math.floor(i / 9)) * (TB_SLOT + 2), TB_SLOT, TB_SLOT, 1, i]);
  return out;
}
function drawChest() {
  const [x, y, w, h] = chestGeo(), s = isleSave(), C_ = ISLE.chest, ch = chestSlots();
  g.globalAlpha = 0.45; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h); text("CHEST", x + 8, y + 9, 1, "#b4461e", "left", null);
  chestCells().forEach(([cx_, cy_, , , side, i]) => drawSlot(cx_, cy_, side ? s.inv[i] : ch[i], C_.side === side && C_.sel === i, s));
  text("YOUR BAG", x + 8, y + 18 + 2 * (TB_SLOT + 2) + 4, 1, "#b4461e", "left", null);
  text("E: MOVE A STACK ACROSS", x + 8, y + h - 7, 1, "#8c6c50", "left", null);
}
function chestPick() {
  const s = isleSave(), C_ = ISLE.chest, ch = chestSlots(), from = C_.side ? s.inv : ch, to = C_.side ? ch : s.inv, it = from[C_.sel];
  if (!it) return;
  let n = it[1];
  for (let i = 0; i < to.length && n > 0; i++) if (to[i] && to[i][0] === it[0] && ITEMS[it[0]].kind !== "tool") { to[i][1] += n; n = 0; }
  for (let i = 0; i < to.length && n > 0; i++) if (!to[i]) { to[i] = [it[0], n]; n = 0; }
  if (n) { it[1] = n; toast("NO ROOM"); } else from[C_.sel] = null;
  play("select");
}
function chestKey(e) {
  const c = e.code, C_ = ISLE.chest, n = C_.side ? isleSave().inv.length : 18;
  if (c === "Escape" || c === "Tab") { e.preventDefault(); ISLE.chest = null; play("back"); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); chestPick(); return; }
  const d = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -9, KeyW: -9, ArrowDown: 9, KeyS: 9 }[c]; if (!d) return;
  let i = C_.sel + d;
  if (i < 0 && C_.side) { C_.side = 0; i += 18; } else if (i >= n && !C_.side) { C_.side = 1; i -= 18; }
  C_.sel = clamp(i, 0, (C_.side ? isleSave().inv.length : 18) - 1); play("tick");
}
function chestTouch(x, y) {
  const [px, py, w, h] = chestGeo(); if (x < px || x > px + w || y < py || y > py + h) { ISLE.chest = null; play("back"); return; }
  const c = hitAt(chestCells(), x, y); if (c) { ISLE.chest.side = c[4]; ISLE.chest.sel = c[5]; chestPick(); }
}

// ---- one list menu for crafting, cooking, the store and the shipyard
function openCraft() { ISLE.list = { kind: "craft", sel: 0, top: 0 }; play("select"); }
function listRows() {
  const L = ISLE.list, s = isleSave(), rows = [];
  if (L.kind === "craft") for (const [out, n, ing] of CRAFT) rows.push({ icon: out, name: ITEMS[out].name + (n > 1 ? " X" + n : ""), info: ing.map(([k, m]) => m + " " + specName(k)).join(", "), ok: canPay(ing), act: () => { pay(ing); if (invAdd(out, n)) toast("YOUR BAG IS FULL"); toast("MADE " + ITEMS[out].name, "#a0dc78"); } });
  else if (L.kind === "cook") for (const [id, name, ing, smoke] of COOK) { const lock = smoke && L.where !== "smoke"; rows.push({ icon: "d_" + id, name, info: lock ? "COOKED AT THE SMOKEHOUSE" : ing.map(([k, m]) => m + " " + specName(k)).join(", "), ok: !lock && canPay(ing), act: () => { pay(ing); invAdd("d_" + id, 1); s.cooked = s.cooked || {}; s.cooked[id] = (s.cooked[id] || 0) + 1; toast("COOKED " + name, "#ffbe3c"); } }); }
  else if (L.kind === "store") {
    const stock = shopList().map(r => [r.item, r.price, r.info]).concat([["bait", 30, "5 BAIT. FISH BITE SOONER"], ["mulch", 40, "5 MULCH. KEEPS GROUND WATERED"], ["rug", 150, "A RUG"], ["table", 200, "A TABLE"], ["chair", 90, "A CHAIR"],
      ["shelllamp", 260, "A LAMP OF SHELLS"], ["painting", 400, "A PAINTING OF THE HARBOUR"], ["palmpot", 300, "A POTTED PALM"], ["chart", 500, "AN OLD SEA CHART"]]);
    for (const [item, price, info] of stock) { const n = ["bait", "mulch"].includes(item) ? 5 : 1; rows.push({ icon: item, name: ITEMS[item].name, info: info + ". " + price + " SD", ok: s.sd >= price, act: () => { if (invAdd(item, n)) { toast("YOUR BAG IS FULL"); return; } s.sd -= price; toast("+" + n + " " + ITEMS[item].name, "#5ac85a"); } }); }
  } else if (L.kind === "yard") for (const [id, name, info, sd, ing] of UPGRADES) { const done = s.up[id]; rows.push({ icon: id === "bag" ? "chest" : id === "can" ? "can" : id === "rod" ? "rod" : id, name: name + (done ? " (DONE)" : ""), info: done ? info : info + ". " + sd + " SD, " + ing.map(([k, m]) => m + " " + specName(k)).join(", "), ok: !done && canPay(ing, sd), act: () => { pay(ing, sd); s.up[id] = 1; if (id === "bag") s.inv.push(...Array(9).fill(null)); toast(name + "!", GOLD); play("fanfare"); } }); }
  return rows;
}
const LIST_TITLE = { craft: "CRAFTING", cook: "COOKING", store: "THE GENERAL STORE", yard: "THE SHIPYARD" };
function listGeo() { const w = Math.min(IW - 12, 320), h = IH - 12; return [Math.round((IW - w) / 2), 6, w, h, Math.floor((h - 46) / 11)]; }
function drawList() {
  const [x, y, w, h, vis] = listGeo(), L = ISLE.list, rows = listRows(), s = isleSave();
  if (L.sel < L.top) L.top = L.sel; if (L.sel >= L.top + vis) L.top = L.sel - vis + 1;
  g.globalAlpha = 0.5; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text(LIST_TITLE[L.kind] + (L.kind === "cook" ? (L.where === "smoke" ? ": SMOKEHOUSE" : ": STOVE") : ""), x + 8, y + 9, 1, "#b4461e", "left", null);
  rect("#f0ecdc", x + w - 46, y + 6, 5, 5); text(s.sd, x + w - 38, y + 9, 1, "#5a3c28", "left", null);
  rows.slice(L.top, L.top + vis).forEach((r, k) => {
    const i = L.top + k, ry = y + 18 + k * 11, on = i === L.sel;
    if (on) { rect("#f4e4c0", x + 5, ry, w - 10, 10); outline(x + 5, ry, w - 10, 10, "#b4461e"); }
    const c = itemIcon(r.icon), kk = Math.min(1, 9 / c.height, 12 / c.width); g.drawImage(c, 0, 0, c.width, c.height, x + 8, ry + 1, Math.round(c.width * kk), Math.round(c.height * kk));
    text(r.name.slice(0, Math.floor((w - 40) / 6)), x + 22, ry + 5, 1, r.ok ? "#3c2c22" : "#a08c78", "left", null);
    if (r.ok) rect("#5ac85a", x + w - 12, ry + 3, 4, 4);
  });
  if (L.top > 0) text("-", x + w / 2, y + 15, 1, "#8c6c50", "center", null);
  const sel = rows[L.sel]; if (sel) wrap(sel.info, Math.floor((w - 16) / 6)).slice(0, 2).forEach((l, i) => text(l, x + 8, y + h - 24 + i * 9, 1, "#5a3c28", "left", null));
  text(IW >= 300 ? "E: " + (({ craft: "MAKE", cook: "COOK", store: "BUY", yard: "UPGRADE", boat: "SAIL", lift: "GO", pages: "READ" })[L.kind] || "PICK") + "   ESC: DONE" : "TAP TWICE: DO IT", x + 8, y + h - 6, 1, "#8c6c50", "left", null);
}
function listPick() { const r = listRows()[ISLE.list.sel]; if (!r) return; if (!r.ok) { play("miss"); toast(ISLE.list.kind === "store" || ISLE.list.kind === "yard" ? "YOU CAN'T AFFORD IT YET" : "MISSING SOMETHING"); return; } r.act(); play("select"); saveStore(); }
function listKey(e) {
  const c = e.code, L = ISLE.list, n = listRows().length;
  if (c === "Escape" || c === "Tab" || (c === "KeyC" && L.kind === "craft")) { e.preventDefault(); ISLE.list = null; play("back"); return; }
  const v = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1, ArrowLeft: -10, ArrowRight: 10 }[c];
  if (v) { L.sel = clamp(L.sel + v, 0, n - 1); play("tick"); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); listPick(); }
}
function listTouch(x, y) {
  const [px, py, w, h, vis] = listGeo(), L = ISLE.list, i = L.top + Math.floor((y - py - 18) / 11);
  if (x < px || x > px + w || y < py || y > py + h) { ISLE.list = null; play("back"); return; }
  if (y >= py + 18 && i < L.top + vis && i < listRows().length) { if (L.sel === i) listPick(); else { L.sel = i; play("tick"); } }
  else if (y < py + 18 && L.top > 0) { L.sel = Math.max(0, L.sel - vis); }
  else if (y > py + h - 30) { L.sel = Math.min(listRows().length - 1, L.sel + vis); }
}

// ---- restoring buildings, the crate, the aquarium
function isleAct5(o) {
  const a = o.act, s = isleSave();
  if (a.kind === "cook") { ISLE.list = { kind: "cook", where: "stove", sel: 0, top: 0 }; play("select"); }
  else if (a.kind === "grass") cutGrass(o);
  else if (a.kind === "crate") crateAct();
  else if (a.kind === "restore") {
    const R = RESTORE[a.b], st = s.rest[a.b];
    if (st === "done") restoredAct(a.b);
    else if (st === "work") isleSay(["WORK ON " + R.name + " IS UNDERWAY. IT'LL BE READY TOMORROW MORNING."]);
    else {
      const need = R.need.map(([k, n]) => n + " " + specName(k) + " (" + Math.min(invCount(k), n) + ")").join(", ") + ", " + R.sd + " SAND DOLLARS";
      if (canPay(R.need, R.sd)) isleSay([R.ruin, "RESTORE IT? IT TAKES " + need + "."], { opts: ["RESTORE IT", "NOT YET"], act: [() => { pay(R.need, R.sd); s.rest[a.b] = "work"; toast("WORK BEGINS. READY TOMORROW", GOLD); play("fanfare"); saveStore(); }, () => play("tick")] });
      else isleSay([R.ruin, "TO RESTORE IT: " + need + "."]);
    }
  }
  else if (a.kind === "tank") { const z = ZONES[a.z], all = TOPFISH.filter(sp => sp[2] === a.z), got = all.filter(sp => s.donated[sp[0]]).length; isleSay([z[0] + " TANK. " + got + " OF " + all.length + " DONATED."]); }
  else if (a.kind === "donate") donateAct();
  else if (a.kind === "plaque") { const n = Object.keys(s.donated).length; isleSay(["THE AQUARIUM. DONATED: " + n + " OF " + TOPFISH.length + " FISH FROM THE OPEN SEA.", "EVERY 10 DONATIONS, THE TOWN SENDS 300 SAND DOLLARS AS THANKS."]); }
}
function restoredAct(b) {
  if (b === "store") { ISLE.list = { kind: "store", sel: 0, top: 0 }; play("select"); }
  else if (b === "smoke") { ISLE.list = { kind: "cook", where: "smoke", sel: 0, top: 0 }; play("select"); }
  else if (b === "yard") { ISLE.list = { kind: "yard", sel: 0, top: 0 }; play("select"); }
  else if (b === "aquarium") isleDoor("aqua", { x: 160, y: 172, dir: "up" });
  else isleSay(["THE INN. FRESH SHEETS, A FIRE IN THE GRATE AND NOBODY HERE YET.", "THE SHIPWRIGHT SAYS PEOPLE WILL COME NOW THERE'S SOMEWHERE TO STAY."]);
}
function newDay5(s) {
  for (const b in s.rest) if (s.rest[b] === "work") { s.rest[b] = "done"; s.news.push(RESTORE[b].name + " IS RESTORED! " + RESTORE[b].done); }
}
function crateAdd(catch_) {                                     // from game.js, on every haul: one fish from the dive goes to the island
  if (!store.isle.built) return null;
  const fish = (catch_ || []).filter(c => !HIDDEN.includes(c[0]) && ITEMS["t_" + c[0]]);
  if (!fish.length) return null;
  const s = isleSave(), f = fish[Math.floor(Math.random() * fish.length)];
  if (s.crate.length >= 99) s.crate.shift();
  s.crate.push(f[0]);
  return SPEC[f[0]][1];
}
function crateAct() {
  const s = isleSave();
  if (!s.crate.length) { isleSay(["THE FISH CRATE. ONE FISH FROM EVERY DIVE YOU MAKE OUT AT SEA ENDS UP IN HERE."]); return; }
  let got = 0;
  while (s.crate.length && invAdd("t_" + s.crate[0], 1) === 0) { s.crate.shift(); got++; }
  toast(got ? "+" + got + " FISH FROM THE CRATE" : "YOUR BAG IS FULL", got ? GOLD : WHITE); play(got ? "chime" : "miss");
}
function donateAct() {
  const s = isleSave(), before = Object.keys(s.donated).length;
  let n = 0;
  for (const q of s.inv) if (q && q[0].startsWith("t_") && !s.donated[q[0].slice(2)]) { s.donated[q[0].slice(2)] = 1; q[1]--; n++; }
  s.inv.forEach((q, i) => { if (q && q[1] <= 0) s.inv[i] = null; });
  if (!n) { isleSay(["THE DONATION BOX. BRING FISH FROM THE OPEN SEA (THE CRATE ON THE BEACH FILLS FROM YOUR DIVES). ONE OF EACH KIND."]); return; }
  const after = before + n, gifts = Math.floor(after / 10) - Math.floor(before / 10);
  if (gifts) { s.sd += 300 * gifts; s.news.push("THE TOWN SENT " + 300 * gifts + " SAND DOLLARS FOR YOUR DONATIONS."); }
  toast("DONATED " + n + " NEW FISH. " + after + "/" + TOPFISH.length + (gifts ? ". +" + 300 * gifts + " SD" : ""), GOLD); play("fanfare");
}
function drawTankFish(o, cx, cy) {                               // donated fish swim in their zone's tank
  const s = isleSave(), list = TOPFISH.filter(sp => sp[2] === o.act.z && s.donated[sp[0]]).slice(0, 6);
  list.forEach((sp, i) => {
    const a = DATA.atlas[sp[0]]; if (!a) return;
    const k = Math.min(1, 12 / a[2], 8 / a[3]), w = Math.max(1, Math.round(a[2] * k)), h = Math.max(1, Math.round(a[3] * k));
    const t = T * (0.3 + i * 0.07) + i * 2, x = o.x + 6 + ((Math.sin(t) + 1) / 2) * (40 - w), y = o.y + 4 + (i % 3) * 6 + Math.sin(t * 2) * 1;
    g.save(); if (Math.cos(t) < 0) { g.translate(Math.round(x - cx) + w, 0); g.scale(-1, 1); g.drawImage(atlas, a[0], a[1], a[2], a[3], 0, Math.round(y - cy), w, h); }
    else g.drawImage(atlas, a[0], a[1], a[2], a[3], Math.round(x - cx), Math.round(y - cy), w, h);
    g.restore();
  });
}
// topside fish icons come from the topside sprites; wood, stone and the rest get small row art
const _itemIcon5 = itemIcon;
itemIcon = function (id) {
  if (id.startsWith("t_")) { const key = "icon_" + id; if (ISPR[key]) return ISPR[key]; const a = DATA.atlas[id.slice(2)], k = Math.min(1, 14 / a[2], 11 / a[3]), w = Math.max(1, Math.round(a[2] * k)), h = Math.max(1, Math.round(a[3] * k)), c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(atlas, a[0], a[1], a[2], a[3], 0, 0, w, h); return (ISPR[key] = c); }
  if (id.startsWith("j_")) return pix("icon_" + id, [".kk.", "gggg", "gffg", "gffg", "gggg"], { k: "#6e482a", g: "#b4e6c8", f: CROP[id.slice(2)].fruit });
  if (id.startsWith("k_")) { const base = itemIcon(id.slice(2)), key = "icon_" + id; if (ISPR[key]) return ISPR[key]; const c = document.createElement("canvas"); c.width = base.width; c.height = base.height; const x = c.getContext("2d"); x.drawImage(base, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(120,60,20,0.5)"; x.fillRect(0, 0, c.width, c.height); return (ISPR[key] = c); }
  if (id.startsWith("d_")) return pix("icon_" + id, [".fff.", "fffff", "wwwww", ".www."], { f: ITEMS[id].col || "#c8965a", w: "#fafaff" });
  if (PL[id]) return PL[id].rows ? plSprite(id) : pix("icon_" + id, ["rrrrr", "rwwwr", "rrrrr"], { r: id === "pathstone" ? "#8c8c96" : id === "pathwood" ? "#a06c40" : id === "rug" ? "#a03c32" : "#4a78b4", w: "#e6c45a" });
  const R = { axe: [["..ss", ".sss", ".bs.", "b...", "b..."], { s: "#a0a8b8", b: "#96683e" }], pick: [["ssss.", "s.b.s", "..b..", "..b..", "..b.."], { s: "#a0a8b8", b: "#96683e" }],
    wood: [["bbbbbb", "brbbrb", "bbbbbb"], { b: "#a06c40", r: "#c8a070" }], stone: [[".ss.", "slss", "ssss"], { s: "#8c8c96", l: "#b4b4be" }], fiber: [["g.g", "ggg", "gg."], { g: "#8cc85a" }],
    mushroom: [[".rrr.", "rwrwr", "..w..", "..w.."], { r: "#c8643c", w: "#f0e6d2" }], wildberry: [[".g.", "rrr", "rrr"], { g: "#5aa04a", r: "#a03c8c" }], garlic: [["..g..", ".www.", "wwwww", ".www."], { g: "#5aa04a", w: "#f0ece0" }],
    pinecone: [[".b.", "bbb", "bbb", ".b."], { b: "#8c5a32" }], bait: [["..rr", ".rr.", "rr.."], { r: "#c86e8c" }], mulch: [[".bb.", "bbbb", "bbbb"], { b: "#5a3c24" }] }[id];
  return R ? pix("icon_" + id, R[0], R[1]) : _itemIcon5(id);
};

// =====================================================================================================================
// Part 6: villagers. Twelve people (and a cat) move in as the Port is restored (data in isle_folk.js). Each keeps a daily
// schedule and walks between places (tile paths in the area you're in; elsewhere they just get there), has friendship
// hearts (talk once a day, one gift a day, birthdays count triple), story events at 2, 5 and 8 hearts, and a house you can
// visit. The Villagers screen (menu or V) shows hearts, birthdays and the gifts you've learned they love.
const HEART = 100, HEART_MAX = 10, FOLK_WALK = 34;
const FOLK = {}; ISLE_FOLK.forEach((v, i) => { v.i = i; FOLK[v.id] = v; });
const COT_X = [150, 300, 440, 700, 850, 990];
const folkHome = v => v.home === null ? null : v.home === "inn" ? "inn_rooms" : "home_" + v.id;
// places villagers go: [area, x, y]
const SPOTS = {
  dock: ["port", 574, 640], dockend: ["port", 616, 738], crate: ["port", 550, 592], porch: ["port", 128, 424], square: ["port", 524, 452],
  board: ["port", 316, 442], beach: ["port", 330, 540], lane: ["port", 400, 240], well: ["port", 470, 444],
  storefront: ["port", 400, 422], smokefront: ["port", 970, 422], innfront: ["port", 790, 422], aqua: ["port", 626, 424], yardfront: ["port", 900, 548],
  garden: ["flats", 470, 352], pools: ["flats", 820, 600], lagoonpier: ["lagoon", 472, 604], lagoonside: ["lagoon", 300, 604], woods: ["woods", 640, 482],
  innbar: ["innin", 160, 44], aquain: ["aqua", 64, 160],
};
const INN_SEATS = [[60, 104], [100, 132], [222, 104], [262, 132], [120, 150], [200, 150], [40, 140], [280, 150], [150, 104], [240, 72], [70, 72], [180, 132]];
const WORK = { yard: ["yard", "yardfront", "dock"], store: ["store", "storefront", "square"], smoke: ["smoke", "smokefront", "square"], aquain: ["aquarium", "aquain", "aqua"], innbar: ["inn", "innbar", "innfront"] };

// ---- the save: friendship and who has arrived
const _isleSave6 = isleSave;
isleSave = function () {
  const g_ = _isleSave6();
  for (const [k, v] of [["folk", {}], ["flags", {}], ["owed", []]]) if (!g_[k]) g_[k] = v;
  if (!g_.arrived) g_.arrived = { bram: DAYN(g_), pickles: DAYN(g_) };
  return g_;
};
function folkRec(id) { const f = isleSave().folk; return f[id] || (f[id] = { pts: 0, talk: 0, gift: 0, ev: 0, evDay: 0, known: {}, met: 0 }); }
const hearts = id => Math.floor(folkRec(id).pts / HEART);
const folkHere = () => ISLE_FOLK.filter(v => isleSave().arrived[v.id]);

// ---- how they look: one body, seven hair styles, any colours
const NPC_HAIR = {
  short: [["...hhhhhh...", "..hhhhhhhh..", "..hssssssh.."], ["....hhhhh...", "...hhhhhhh..", "...hhsssss.."]],
  long: [["...hhhhhh...", "..hhhhhhhh..", "..hssssssh.."], ["....hhhhh...", "...hhhhhhh..", "..hhhsssss.."]],
  bun: [[".....hh.....", "...hhhhhh...", "..hhhhhhhh..", "..hssssssh.."], [".hh.........", "..hhhhhh....", "...hhhhhhh..", "...hhsssss.."]],
  bald: [["...ssssss...", "..ssssssss..", "..hssssssh.."], ["....sssss...", "...sssssss..", "...hhsssss.."]],
  hat: [["...nnnnnn...", ".nnnnnnnnnn.", "..hssssssh.."], ["....nnnnn...", "..nnnnnnnnn.", "...hhsssss.."]],
  cap: [["...nnnnnn...", "..nnnnnnnn..", "..hssssssh.."], ["....nnnnn...", "...nnnnnnnnn", "...hhsssss.."]],
  curly: [["..hhhhhhhh..", ".hhhhhhhhhh.", ".hhsssssshh."], ["...hhhhhh...", "..hhhhhhhh..", "..hhhsssss.."]],
};
function npcRows(v, view, legs) {
  const L = v.look, hr = NPC_HAIR[L.hair] || NPC_HAIR.short, long = L.hair === "long", beard = L.beard;
  let rows;
  if (view === "side") {
    rows = hr[1].concat(["...hssssks..", "...hsssssss.", "....ssssm...", "....cccccc..", "....cscccc..", "....cscccc..", "....cccccc..", "....pppppp.."]);
    const o = rows.length - 8;
    if (long) for (let j = o; j < o + 5; j++) rows[j] = rows[j].slice(0, 3) + "h" + rows[j].slice(4);
    if (beard) { rows[o + 1] = "...hsssbbbb."; rows[o + 2] = "....sbbbb..."; }
    rows = rows.concat(legs ? ["...pp...pp..", "...ff...ff.."] : ["....pp.pp...", "....ff.ff..."]);
  } else {
    const face = view === "back"
      ? ["..hhhhhhhh..", "..hhhhhhhh..", "...ssssss..."]
      : ["..skssssks..", "..ssssssss..", "...ssmmss..."];
    rows = hr[0].slice();
    if (view === "back") rows[rows.length - 1] = L.hair === "bald" ? "..hssssssh.." : "..hhhhhhhh..";
    rows = rows.concat(face, ["..cccccccc..", ".sccccccccs.", ".sccccccccs.", "..cccccccc..", "..pppppppp.."]);
    const o = rows.length - 8;
    if (long) for (let j = o - 1; j < o + 5; j++) rows[j] = "." + "h" + rows[j].slice(2, 10) + "h" + ".";
    if (long && view === "back") { rows[o + 3] = ".hcchhhhcch."; rows[o + 4] = ".hcchhhhcch."; }
    if (beard && view === "front") { rows[o + 1] = "..bssssssb.."; rows[o + 2] = "...bbmmbb..."; }
    rows = rows.concat(legs ? ["...pp..pp...", "...ff..ff..."] : ["..pp....pp..", "..ff....ff.."]);
  }
  return rows;
}
function npcSprite(v, dir, legs) {
  if (v.cat) { const key = "npc_cat" + (dir === "left" ? "l" : ""); return ISPR[key] || pix(key, dir === "left" ? CAT_ROWS.map(r => r.split("").reverse().join("")) : CAT_ROWS, v.look.pal); }
  const view = dir === "down" ? "front" : dir === "up" ? "back" : "side", key = "npc_" + v.id + view + legs + (dir === "left" ? "l" : "");
  if (ISPR[key]) return ISPR[key];
  const P_ = v.look.pal, pal = { h: P_.h, s: P_.s, k: "#2c222c", m: shade(P_.s, 0.78), c: P_.c, p: P_.p, f: "#3c2c22", n: P_.n || P_.h, b: P_.b || P_.h };
  let rows = npcRows(v, view, legs);
  if (dir === "left") rows = rows.map(r => r.padEnd(12, ".").split("").reverse().join(""));
  return pix(key, rows, pal);
}
function heartIcon(full) { return pix(full ? "heart1" : "heart0", [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."], { r: full ? "#e64a5a" : "#b4a08c" }); }

// ---- areas: the cottages and the inn get insides; everything hangs off the Port
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
ISLE_FOLK.forEach(v => {
  if (typeof v.home !== "number") return;
  const c = hexRGB(v.look.pal.c);
  AREAS["home_" + v.id] = { name: v.name + "'S HOUSE", w: 12, h: 10, outdoor: false, wall: [c.map(k => Math.round(k * 0.55 + 40)), c.map(k => Math.round(k * 0.4 + 30))] };
});
AREAS.innin = { name: "THE INN", w: 20, h: 12, outdoor: false, door: [9, 10] };
const LINK = {};                                                // [parent, leave the parent here, arrive here; leave this area here, arrive in the parent here]
function folkLinks() {
  if (LINK.flats) return;
  const edge = (A, e) => { const W = A.w * TS, H = A.h * TS, m = (e.a + e.b) / 2; return e.side === "e" ? [W - 6, m] : e.side === "w" ? [6, m] : e.side === "n" ? [m, 6] : [m, H - 6]; };
  for (const [id, par] of [["flats", "port"], ["lagoon", "port"], ["woods", "port"], ["point", "lagoon"], ["marsh", "lagoon"], ["wreck", "woods"]]) {
    const out = AREAS[par].exits.find(e => e.to === id), back = AREAS[id].exits.find(e => e.to === par);
    if (!out || !back) continue;
    LINK[id] = { parent: par, outPt: edge(AREAS[par], out), arriveA: [out.x, out.y], inPt: edge(AREAS[id], back), arriveP: [back.x, back.y] };
  }
  ISLE_FOLK.forEach(v => { if (typeof v.home === "number") { const d = [COT_X[v.home] + 24, 228]; LINK["home_" + v.id] = { parent: "port", outPt: d, arriveP: d, inPt: [96, 152], arriveA: [96, 134] }; } });
  LINK.innin = { parent: "port", outPt: [789, 416], arriveP: [789, 416], inPt: [160, 184], arriveA: [160, 168] };
  LINK.aqua = { parent: "port", outPt: [598, 416], arriveP: [598, 416], inPt: [160, 184], arriveA: [160, 168] };
  LINK.inn_rooms = { parent: "innin", outPt: [292, 64], arriveP: [292, 64], inPt: [0, 0], arriveA: [0, 0] };
}
function areaChain(a) { const c = [a]; while (LINK[c[c.length - 1]]) c.push(LINK[c[c.length - 1]].parent); return c; }
function route(a, b) {                                           // the areas you pass through going from a to b
  const ca = areaChain(a), cb = areaChain(b), common = ca.find(x => cb.includes(x));
  return ca.slice(0, ca.indexOf(common) + 1).concat(cb.slice(0, cb.indexOf(common)).reverse());
}
function hopPts(h, h2) {                                         // leave h at [0], appear in h2 at [1]
  if (LINK[h2] && LINK[h2].parent === h) return [LINK[h2].outPt, LINK[h2].arriveA];
  return [LINK[h].inPt, LINK[h].arriveP];
}

// ---- where each villager wants to be right now
function spotFor(v, name) {
  const s = isleSave();
  if (name === "home") { const h = folkHome(v); return h === "inn_rooms" ? ["inn_rooms", 0, 0] : h ? [h, 64, 96] : SPOTS.porch; }
  if (name === "work") name = v.work;
  if (name === "inn") { if (s.rest.inn !== "done") return SPOTS.square; const p = INN_SEATS[v.i % INN_SEATS.length]; return ["innin", p[0], p[1]]; }
  if (WORK[name]) { const [b, open, closed] = WORK[name]; return SPOTS[s.rest[b] === "done" ? open : closed]; }
  if (name === "aquain" && s.rest.aquarium !== "done") return SPOTS.aqua;
  return SPOTS[name] || SPOTS.square;
}
function folkTarget(v) {
  const s = isleSave(), list = (weatherOf(s) === "rain" && v.sched.rain) || v.sched.sun;
  let cur = list[0][1];
  for (const [m, p] of list) if (s.min >= m) cur = p;
  if (v.id === "bram" && cur === "inn" && s.rest.inn !== "done") cur = "dock";
  const t = spotFor(v, cur), jig = (v.i * 37) % 13 - 6;            // two villagers in one place don't stand on each other
  return t[0] === "inn_rooms" || cur === "home" || cur === "innbar" || cur === "inn" ? t : [t[0], t[1] + jig, t[2] + ((v.i * 19) % 7) - 3];
}

// ---- walking: tile paths through the area you're standing in
function folkGrid() {
  const M_ = ISLE.map, s = isleSave(), key = s.placed.length + ":" + Object.keys(s.cut).length + ":" + DAYN(s);
  if (M_.fg && M_.fgk === key) return M_.fg;
  const G = [];
  for (let ty = 0; ty < M_.A.h; ty++) { const row = []; for (let tx = 0; tx < M_.A.w; tx++) { const t = M_.tiles[ty][tx]; row.push(t !== "t" && !isleSolidAt(tx * TS + 8, ty * TS + 10) && !isleSolidAt(tx * TS + 3, ty * TS + 10) && !isleSolidAt(tx * TS + 13, ty * TS + 10)); } G.push(row); }
  M_.fg = G; M_.fgk = key; return G;
}
function folkPath(from, to) {
  const G = folkGrid(), H = G.length, W = G[0].length, tl = p => [clamp(Math.floor(p[0] / TS), 0, W - 1), clamp(Math.floor(p[1] / TS), 0, H - 1)];
  const [sx, sy] = tl(from); let [gx, gy] = tl(to); const exact = G[gy][gx];
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (!exact) {                                                    // the spot itself is blocked: the nearest open tile
    const seen = new Set([gx + "," + gy]), q = [[gx, gy]]; let found = null;
    while (q.length && !found) { const [x, y] = q.shift(); for (const [a, b] of D4) { const nx = x + a, ny = y + b, k = nx + "," + ny; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue; seen.add(k); if (G[ny][nx]) { found = [nx, ny]; break; } q.push([nx, ny]); } }
    if (!found) return null; [gx, gy] = found;
  }
  const prev = new Map([[sx + "," + sy, null]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift(); if (x === gx && y === gy) break;
    for (const [a, b] of D4) { const nx = x + a, ny = y + b, k = nx + "," + ny; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k) || !G[ny][nx]) continue; prev.set(k, x + "," + y); q.push([nx, ny]); }
  }
  if (!prev.has(gx + "," + gy)) return null;
  const pts = []; let k = gx + "," + gy;
  while (k) { const [x, y] = k.split(",").map(Number); pts.unshift([x * TS + 8, y * TS + 10]); k = prev.get(k); }
  pts.shift();
  if (exact) pts.push([to[0], to[1]]);
  return pts;
}
function folkPlace(st, area, xy) { st.area = area; st.x = xy[0]; st.y = xy[1]; st.path = null; st.after = null; }
function folkPlan(v, st, tgt) {
  folkLinks();
  const cur = ISLE.map.id, hops = route(st.area, tgt[0]);
  const walkTo = (pt, after) => { const p = folkPath([st.x, st.y], pt); if (p) { st.path = p; st.after = after; } else { st.path = null; st.after = null; if (after) folkPlace(st, after.area, after.at); else { st.x = pt[0]; st.y = pt[1]; } } };
  if (st.area === cur) {
    if (tgt[0] === cur) walkTo([tgt[1], tgt[2]], null);
    else { const [lv, ar] = hopPts(cur, hops[1]); walkTo(lv, { area: hops[1], at: ar }); }
    return;
  }
  const k = hops.indexOf(cur);
  if (k <= 0) { folkPlace(st, tgt[0], [tgt[1], tgt[2]]); return; }
  folkPlace(st, cur, hopPts(hops[k - 1], cur)[1]);                 // they come walking in
  if (k === hops.length - 1) walkTo([tgt[1], tgt[2]], null);
  else { const [lv, ar] = hopPts(cur, hops[k + 1]); walkTo(lv, { area: hops[k + 1], at: ar }); }
}
function folkInit() {                                              // everyone straight to where they should be (new day, landing)
  if (!ISLE) return;
  folkLinks();
  ISLE.folk = {};
  for (const v of folkHere()) { const t = folkTarget(v), st = { area: t[0], x: t[1], y: t[2], dir: "down", walk: 0, moving: false, key: t.join(), wait: 0 }; ISLE.folk[v.id] = st; }
}
function folkTick(dt) {
  if (!ISLE.folk) folkInit();
  for (const v of folkHere()) {
    let st = ISLE.folk[v.id];
    if (!st) { folkInit(); st = ISLE.folk[v.id]; }
    st.heart = st.heart ? (st.heart[0] - dt > 0 ? [st.heart[0] - dt, st.heart[1]] : null) : null;
    const t = folkTarget(v), key = t.join();
    if (key !== st.key) { st.key = key; folkPlan(v, st, t); }
    if (st.wait > 0) { st.wait -= dt; st.moving = false; continue; }
    if (!st.path || !st.path.length) { st.moving = false; if (st.path && st.after) { const a = st.after; folkPlace(st, a.area, a.at); st.key = null; } else st.path = null; continue; }
    const [px, py] = st.path[0], dx = px - st.x, dy = py - st.y, d = Math.hypot(dx, dy), step = (v.cat ? 26 : FOLK_WALK) * dt;
    st.moving = true; st.walk += dt;
    st.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    if (d <= step) { st.x = px; st.y = py; st.path.shift(); } else { st.x += dx / d * step; st.y += dy / d * step; }
  }
}
const _isleUpdate6 = isleUpdate;
isleUpdate = function (dt) {
  if (ISLE && ISLE.folkUI) return;
  _isleUpdate6(dt);
  const I = ISLE;
  if (I && !I.msg && !I.menu && !I.shop && !I.inv && !I.log && !I.card && !I.list && !I.chest && I.map) folkTick(dt);
};
const _startIsland6 = startIsland;
startIsland = function () { _startIsland6(); folkInit(); folkOwed(); };
const _isleSleep6 = isleSleep;
isleSleep = function (passedOut) { _isleSleep6(passedOut); folkInit(); folkOwed(); };

// ---- drawing them
const _placedSprites6 = placedSprites;
placedSprites = function (list) {
  _placedSprites6(list);
  if (!ISLE.folk) return;
  for (const v of folkHere()) {
    const st = ISLE.folk[v.id];
    if (!st || st.area !== ISLE.map.id) continue;
    list.push([st.y, { draw(cx, cy) {
      const legs = st.moving ? Math.floor(st.walk * 6) % 2 : 0, c = npcSprite(v, st.dir, legs), x = Math.round(st.x - cx), y = Math.round(st.y - cy);
      if (x < -20 || x > IW + 20 || y < -4 || y > IH + 30) return;
      g.globalAlpha = 0.22; g.fillStyle = "#000"; g.beginPath(); g.ellipse(x, y, v.cat ? 4 : 6, 2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      g.drawImage(c, x - (c.width >> 1), y - c.height + 1 - (st.moving && legs ? 1 : 0) - (v.cat && !st.moving && Math.floor(T * 0.7) % 4 === 0 ? 1 : 0));
      if (st.heart) { const k = 1 - st.heart[0] / 1.4, hc = heartIcon(st.heart[1]); g.globalAlpha = Math.min(1, st.heart[0] * 2); g.drawImage(hc, x - 3, y - c.height - 8 - Math.round(k * 8)); g.globalAlpha = 1; }
      if (Math.hypot(st.x - ISLE.px, st.y - ISLE.py) < 26 && !ISLE.msg) { const w = textW(v.name, 1) + 4; rect(INK, x - (w >> 1), y - c.height - 9, w, 8); text(v.name, x, y - c.height - 5, 1, WHITE, "center", null); }
    } }]);
  }
};

// ---- talking to them: a pretend object so the usual E / tap handling finds them
const _objAt6 = objAt;
objAt = function (x, y) {
  if (ISLE && ISLE.folk) for (const v of folkHere()) {
    const st = ISLE.folk[v.id];
    if (st && st.area === ISLE.map.id && Math.abs(x - st.x) <= 9 && y >= st.y - (v.cat ? 10 : 22) && y <= st.y + 6) return { k: "npc", x: st.x - 8, y: st.y - 14, solid: [2, 8, 12, 8], act: { kind: "npc", id: v.id } };
  }
  return _objAt6(x, y);
};
const _isleAct56 = isleAct5;
isleAct5 = function (o) {
  const a = o.act;
  if (a.kind === "npc") npcAct(a.id);
  else if (a.kind === "cottage") cottageAct(a.i);
  else if (a.kind === "folksay") isleSay(a.text);
  else _isleAct56(o);
};
const isBirthday = v => { const s = isleSave(); return v.birthday[0] === s.season && v.birthday[1] === s.day; };
const birthdayTxt = v => SEASONS[v.birthday[0]][0] + " " + v.birthday[1];
function giftTaste(v, id) {
  const it = ITEMS[id], tag = t => {
    if (t === "@legend") return (id.startsWith("f_") && FISH[id.slice(2)] && FISH[id.slice(2)].page === "legend") || (id.startsWith("t_") && SPEC[id.slice(2)] && !!SPEC[id.slice(2)][7]);
    if (t === "@seed") return it.kind === "seed";
    return t === "@" + it.kind;
  };
  for (const k of ["hate", "love", "like"]) if (v.gifts[k].includes(id)) return k;
  for (const k of ["hate", "love", "like"]) if (v.gifts[k].some(t => t[0] === "@" && tag(t))) return k;
  if (it.kind === "dish") return "like";
  if (it.kind === "gem") return "like";
  if (it.kind === "mat" || it.kind === "seed") return "dislike";
  return "neutral";
}
const GIFT_PTS = { love: 80, like: 45, neutral: 20, dislike: -20, hate: -40 };
function folkReward(list) {
  const s = isleSave(), got = [];
  for (const [id, n] of list || []) {
    if (id === "sd") { s.sd += n; got.push(n + " SAND DOLLARS"); continue; }
    const left = invAdd(id, n); if (left) s.owed.push([id, left]);
    got.push((n > 1 ? n + " X " : "") + ITEMS[id].name);
  }
  return got.length ? ["YOU GOT " + got.join(" AND ") + "." + (s.owed.length ? " (YOUR BAG WAS FULL: THE REST WILL BE ON YOUR STEP.)" : "")] : [];
}
function folkOwed() {                                               // event gifts that didn't fit in the bag turn up later
  const s = isleSave(); if (!s.owed || !s.owed.length) return;
  const keep = [];
  for (const [id, n] of s.owed) { const left = invAdd(id, n); if (left) keep.push([id, left]); else if (ISLE) toast("+" + n + " " + ITEMS[id].name + " (LEFT ON YOUR STEP)", GOLD); }
  s.owed = keep;
}
function folkEventDue(v, f) { const e = v.events[f.ev]; return e && !e.wake && hearts(v.id) >= e.at && f.evDay !== DAYN(isleSave()) ? e : null; }
function playEvent(v, f, e) {
  const s = isleSave();
  f.ev++; f.evDay = DAYN(s);
  if (e.flag) s.flags[e.flag] = 1;
  isleSay(e.pages.concat(folkReward(e.reward)).concat(e.flag === "lightkey" ? ["YOU GOT THE LIGHTHOUSE KEY."] : []));
  play("fanfare"); saveStore();
}
function fortune() {
  const s = isleSave(), pool = Object.values(FISH).filter(f => !s.log[f.id] && fishOk(f, s) && f.page !== "special");
  if (!pool.length) return "'THE CARDS ARE QUIET TODAY. NOTHING NEW IS BITING. JUST ENJOY THE SEA, DEAR.'";
  const f = pool[seeded(DAYN(s) * 7 + 3).randint(0, pool.length - 1)];
  return "'THE CARDS SAY... A " + f.name + " IS OUT THERE RIGHT NOW. TRY " + whereTxt(f) + ".'";
}
function talkLine(v, f) {
  const s = isleSave(), day = DAYN(s), first = f.talk !== day;
  if (first) { f.talk = day; f.pts = Math.min(HEART * HEART_MAX, f.pts + 20); }
  f.n = (f.n || 0) + 1;
  if (isBirthday(v) && first) return v.cat ? "PICKLES IS WEARING A BIT OF RIBBON SOMEBODY TIED ON HER. IT MUST BE HER BIRTHDAY." : "'IT'S MY BIRTHDAY TODAY, YOU KNOW. NOT THAT I'M MAKING A FUSS.'";
  if (v.fortune && f.fort !== day) { f.fort = day; return fortune(); }
  const r = seeded(day * 31 + v.i * 7 + f.n).random();
  if (weatherOf(s) === "rain" && r < 0.5) return v.rain[(day + f.n) % v.rain.length];
  if (r < 0.15) return v.seasons[s.season];
  if (hearts(v.id) >= 5 && r < 0.45) return v.high[(day + f.n) % v.high.length];
  return v.lines[(day * 3 + f.n + v.i) % v.lines.length];
}
const say_ = (v, line) => v.cat ? line : v.name + ": " + line;
function npcAct(id) {
  const v = FOLK[id], f = folkRec(id), st = ISLE.folk && ISLE.folk[id], s = isleSave(), day = DAYN(s);
  f.met = 1;
  if (st) { st.wait = 4; const dx = ISLE.px - st.x, dy = ISLE.py - st.y; st.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"); }
  const e = folkEventDue(v, f);
  if (e) { if (f.talk !== day) { f.talk = day; f.pts = Math.min(HEART * HEART_MAX, f.pts + 20); } playEvent(v, f, e); return; }
  const it = held();
  if (it && ITEMS[it[0]] && ITEMS[it[0]].kind !== "tool" && f.gift !== day)
    isleSay(["GIVE " + v.name + " THE " + ITEMS[it[0]].name + "?"], { opts: ["GIVE", "TALK"], act: [() => giveGift(v, f), () => { isleSay([say_(v, talkLine(v, f))]); play("tick"); }] });
  else isleSay([say_(v, talkLine(v, f))]);
  play("tick");
}
function giveGift(v, f) {
  const s = isleSave(), it = held(); if (!it) return;
  const id = it[0], taste = giftTaste(v, id), bday = isBirthday(v), d = GIFT_PTS[taste] * (bday && GIFT_PTS[taste] > 0 ? 3 : 1);
  invUse(s.sel);
  f.gift = DAYN(s); f.known[id] = taste; f.pts = clamp(f.pts + d, 0, HEART * HEART_MAX);
  if (f.talk !== f.gift) { f.talk = f.gift; f.pts = Math.min(HEART * HEART_MAX, f.pts + 20); }
  const generic = v.cat ? { like: "PICKLES SNIFFS IT AND SEEMS PLEASED.", neutral: "PICKLES SNIFFS IT POLITELY, THEN WANDERS OFF.", dislike: "PICKLES FLICKS HER TAIL AT IT." }
    : { like: "'OH, NICE. THANK YOU.'", neutral: "'THANKS. THAT'S KIND OF YOU.'", dislike: "'...THANKS, I GUESS.'" };
  const line = taste === "love" ? v.love : taste === "hate" ? v.hate : generic[taste];
  isleSay((bday && d > 0 && !v.cat ? [say_(v, "'FOR MY BIRTHDAY? YOU REMEMBERED!'")] : []).concat([say_(v, line)]));
  const st = ISLE.folk && ISLE.folk[v.id]; if (st) st.heart = [1.4, d > 0];
  play(d > 0 ? (taste === "love" ? "fanfare" : "chime") : "miss"); saveStore();
}

// ---- move-ins, the cat, birthdays: each morning
const _newDay56 = newDay5;
newDay5 = function (s) {
  _newDay56(s);
  const day = DAYN(s), max = s.rest.inn === "done" ? 2 : 1;
  ISLE_FOLK.filter(v => !s.arrived[v.id] && v.arrive(s)).slice(0, max).forEach(v => { s.arrived[v.id] = day; s.news.push(v.arriveText || v.name + " HAS MOVED IN."); });
  if (s.arrived.pickles) {
    const h = Math.floor(((s.folk.pickles && s.folk.pickles.pts) || 0) / HEART), r = Math.random();
    if (h < 6 && s.crate.length && r < 0.25) { const k = Math.floor(Math.random() * s.crate.length), sp = s.crate.splice(k, 1)[0]; s.news.push("PICKLES STOLE A " + SPEC[sp][1] + " FROM THE FISH CRATE. SHE LOOKS VERY PLEASED WITH HERSELF."); }
    else if (h >= 6 && r < 0.2) { const pick = ["shell", "glass", "starfish", "drift"][Math.floor(Math.random() * 4)]; s.owed.push([pick, 1]); s.news.push("PICKLES LEFT A " + ITEMS[pick].name + " ON YOUR STEP."); }
  }
  for (const v of ISLE_FOLK) if (s.arrived[v.id] && v.birthday[0] === s.season && v.birthday[1] === s.day) s.news.push("IT'S " + v.name + "'S BIRTHDAY TODAY.");
  for (const v of ISLE_FOLK) {                                        // events that happen overnight
    const f = s.folk[v.id], e = f && v.events[f.ev];
    if (e && e.wake && Math.floor(f.pts / HEART) >= e.at) { f.ev++; f.evDay = day; s.news.push(...e.pages); for (const [id, n] of e.reward || []) if (id === "sd") s.sd += n; else s.owed.push([id, n]); }
  }
};

// ---- the Port: cottages become houses, the old shipwright and cat sprites make way for the real ones
const _buildArea6 = buildArea;
buildArea = function (id) {
  const m = _buildArea6(id);
  if (id === "port") {
    m.objs = m.objs.filter(o => o.k !== "wright" && o.k !== "cat");
    m.objs.forEach(o => { if (/^cot\d$/.test(o.k) && o.y === 176) o.act = { kind: "cottage", i: COT_X.indexOf(o.x), rect: [0, 18, 50, 34] }; });
  }
  if (id.startsWith("home_")) m.objs = homeObjects(FOLK[id.slice(5)]);
  if (id === "innin") m.objs = innObjects();
  return m;
};
const HOME_DECOR = { bram: ["wheel", "anchor"], gus: ["netdecor", "anchor"], margo: ["shelllamp", "plantpot"], jo: ["wbarrel2", "wcrate"], fenn: ["fishbowl", "shelf"], nell: ["palmpot", "fern"] };
function folkArt() {
  if (IART.stairs) return;
  for (const id of ["wheel", "anchor", "netdecor", "shelllamp", "plantpot", "wbarrel2", "wcrate", "fishbowl", "shelf", "palmpot", "fern", "painting", "chart", "bench", "stool", "rug"]) if (PL[id] && PL[id].rows) IART["pl_" + id] = plSprite(id);
  const P = paintCanvas(32, 26); for (let k = 0; k < 5; k++) { P.rect(k * 5, 20 - k * 4, 32 - k * 5, 4, k % 2 ? "#8c5a32" : "#a06c40"); P.rect(k * 5, 20 - k * 4, 32 - k * 5, 1, "#6e482a"); } IART.stairs = P.c;
  const B = paintCanvas(96, 18); B.rect(0, 0, 96, 16, INK); B.rect(1, 1, 94, 14, "#8c5a32"); B.rect(1, 1, 94, 4, "#b47e4a"); for (let k = 0; k < 6; k++) B.rect(6 + k * 16, 8, 6, 6, "#6e482a"); IART.bar = B.c;
  const F = paintCanvas(34, 30); F.rect(0, 0, 34, 28, INK); F.rect(1, 1, 32, 26, "#7a6a64"); F.rect(8, 10, 18, 17, "#2c1e1a"); F.rect(10, 18, 14, 8, "#f08c32"); F.rect(13, 14, 8, 8, "#ffd246"); F.rect(0, 0, 34, 4, "#5a4a46"); IART.fire = F.c;
}
const _isleArt6 = isleArt; isleArt = function () { _isleArt6(); folkArt(); };
function homeObjects(v) {
  const d = LINK["home_" + v.id] || (folkLinks(), LINK["home_" + v.id]), deco = HOME_DECOR[v.id] || ["plantpot", "shelf"];
  const o = [{ k: "bed", x: 20, y: 34, solid: [0, 0, 28, 34], act: { kind: "folksay", text: [v.name + "'S BED. VERY NEATLY MADE."] } },
    { k: "table", x: 120, y: 74, solid: [0, 4, 26, 12] }, { k: "chest", x: 150, y: 30, solid: [0, 0, 18, 13], act: { kind: "folksay", text: ["IT'S NOT YOUR CHEST. BEST LEAVE IT."] } },
    { k: "door", x: 88, y: 148, solid: null, act: { kind: "door", to: "port", rect: [0, 0, 16, 12], dir: "down", go: { x: d.arriveP[0], y: d.arriveP[1], dir: "down" } } }];
  deco.forEach((id, k) => { const c = IART["pl_" + id]; if (c) o.push({ k: "pl_" + id, x: (k ? 108 : 66) - (c.width >> 1), y: 44 - c.height, solid: [0, Math.max(0, c.height - 5), c.width, 5] }); });
  return o;
}
function innObjects() {
  return [{ k: "bar", x: 112, y: 54, solid: [0, 2, 96, 14], act: { kind: "folksay", text: ["THE INN'S BAR. IT SMELLS OF WOODSMOKE AND SOUP."] } },
    { k: "fire", x: 18, y: 24, solid: [0, 8, 34, 20], act: { kind: "folksay", text: ["A WARM FIRE. YOU COULD SIT HERE ALL NIGHT."] } },
    { k: "stairs", x: 276, y: 30, solid: [0, 0, 32, 26], act: { kind: "folksay", text: ["THE STAIRS UP TO THE GUEST ROOMS. ROOM THREE'S DOOR IS SHUT TIGHT."] } },
    { k: "table", x: 70, y: 104, solid: [0, 4, 26, 12] }, { k: "table", x: 230, y: 104, solid: [0, 4, 26, 12] },
    { k: "pl_bench", x: 66, y: 128, solid: [0, 4, 20, 4] }, { k: "pl_bench", x: 226, y: 128, solid: [0, 4, 20, 4] },
    { k: "pl_painting", x: 200, y: 14, solid: null, act: { kind: "folksay", text: ["A PAINTING OF THE HARBOUR, FULL OF BOATS."] } },
    { k: "door", x: 144, y: 180, solid: null, act: { kind: "door", to: "port", rect: [0, 0, 32, 12], dir: "down", go: { x: 789, y: 416, dir: "down" } } }];
}
function cottageAct(i) {
  const v = ISLE_FOLK.find(q => q.home === i && isleSave().arrived[q.id]), s = isleSave();
  if (!v) { isleSay([["AN EMPTY COTTAGE. THE DOOR IS BOARDED UP.", "AN EMPTY COTTAGE. SOMEONE LEFT A TEAPOT ON THE STEP.", "AN EMPTY COTTAGE. IVY HAS TAKEN THE WINDOWS."][i % 3], "MAYBE SOMEONE WILL MOVE IN ONE DAY."]); return; }
  if (s.min < 420 || s.min >= 1260) { isleSay([v.name + "'S HOUSE. THE LIGHTS ARE OFF AND THE DOOR IS LOCKED."]); return; }
  folkLinks(); isleDoor("home_" + v.id, { x: 96, y: 134, dir: "up" });
}
const _restoredAct6 = restoredAct;
restoredAct = function (b) { if (b === "inn") { folkLinks(); isleDoor("innin", { x: 160, y: 168, dir: "up" }); } else _restoredAct6(b); };

// ---- longer messages split into pages that fit the box
const _isleSay6 = isleSay;
isleSay = function (pages, choice) {
  const n = Math.floor((Math.min(IW - 16, 300) - 12) / 6), out = [];
  for (const p of pages) { const L = wrap(p, n); for (let i = 0; i < L.length; i += 4) out.push(L.slice(i, i + 4).join(" ")); }
  _isleSay6(out.length ? out : pages, choice);
};

// ---- the Villagers screen
ISLE_MENU.splice(ISLE_MENU.length - 1, 0, ["VILLAGERS", () => { ISLE.menu = null; ISLE.folkUI = { sel: 0 }; }]);
function folkGeo() { const w = Math.min(IW - 12, 330), h = Math.min(IH - 12, ISLE_FOLK.length * 11 + 52); return [Math.round((IW - w) / 2), Math.round((IH - h) / 2), w, h]; }
function drawFolkUI() {
  const [x, y, w, h] = folkGeo(), s = isleSave(), U = ISLE.folkUI, day = DAYN(s), wide = w >= 300;
  g.globalAlpha = 0.5; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("VILLAGERS", x + 8, y + 9, 1, "#b4461e", "left", null);
  text(folkHere().length + "/" + ISLE_FOLK.length + " ON THE ISLAND", x + w - 8, y + 9, 1, "#8c6c50", "right", null);
  ISLE_FOLK.forEach((v, i) => {
    const ry = y + 17 + i * 11, on = i === U.sel, here = s.arrived[v.id], f = s.folk[v.id];
    if (on) { rect("#f4e4c0", x + 5, ry, w - 10, 10); outline(x + 5, ry, w - 10, 10, "#b4461e"); }
    if (!here) { text("???", x + 10, ry + 5, 1, "#a08c78", "left", null); return; }
    text(v.name, x + 10, ry + 5, 1, "#3c2c22", "left", null);
    const hx = x + (wide ? 92 : 78), n = Math.floor(((f && f.pts) || 0) / HEART);
    for (let k = 0; k < HEART_MAX; k++) g.drawImage(heartIcon(k < n), hx + k * (wide ? 8 : 7), ry + 1);
    const dx = hx + HEART_MAX * (wide ? 8 : 7) + 4;
    rect(f && f.talk === day ? "#5ac85a" : "#d2c0a0", dx, ry + 3, 4, 4);
    rect(f && f.gift === day ? "#ffbe3c" : "#d2c0a0", dx + 7, ry + 3, 4, 4);
    if (wide) text(v.role, x + w - 8, ry + 5, 1, "#8c6c50", "right", null);
  });
  const v = ISLE_FOLK[U.sel], f = s.folk[v.id];
  let info;
  if (!s.arrived[v.id]) info = "SOMEONE MIGHT MOVE IN AS THE ISLAND GROWS.";
  else {
    const loves = Object.keys((f && f.known) || {}).filter(k => f.known[k] === "love").map(k => ITEMS[k].name);
    info = v.role + ". BIRTHDAY: " + birthdayTxt(v) + ". LOVES: " + (loves.length ? loves.join(", ") : "???") + ".";
  }
  wrap(info, Math.floor((w - 16) / 6)).slice(0, 2).forEach((l, i) => text(l, x + 8, y + h - 24 + i * 9, 1, "#5a3c28", "left", null));
  text(wide ? "GREEN: TALKED TODAY   GOLD: GIFT GIVEN   ESC: DONE" : "TAP OUTSIDE TO CLOSE", x + 8, y + h - 6, 1, "#8c6c50", "left", null);
}
function folkKey(e) {
  const c = e.code, U = ISLE.folkUI;
  if (["Escape", "Tab", "KeyV", "Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); ISLE.folkUI = null; play("back"); return; }
  const v = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
  if (v) { U.sel = (U.sel + v + ISLE_FOLK.length) % ISLE_FOLK.length; play("tick"); }
}
const _isleKey6 = isleKey;
isleKey = function (e, down) {
  if (ISLE && down && ISLE.folkUI && !ISLE.msg) { folkKey(e); return; }
  if (ISLE && down && e.code === "KeyV" && !ISLE.msg && !ISLE.menu && !ISLE.log && !ISLE.list && !ISLE.chest && !ISLE.shop && !ISLE.inv && !ISLE.card && !ISLE.fish) { ISLE.folkUI = { sel: 0 }; play("select"); return; }
  _isleKey6(e, down);
};
const _isleTouch6 = isleTouch;
isleTouch = function (e) {
  if (ISLE && ISLE.folkUI && !ISLE.msg) {
    const [x, y] = islePos(e), [px, py, w, h] = folkGeo(), i = Math.floor((y - py - 17) / 11);
    if (x < px || x > px + w || y < py || y > py + h) { ISLE.folkUI = null; play("back"); return; }
    if (i >= 0 && i < ISLE_FOLK.length) { ISLE.folkUI.sel = i; play("tick"); }
    return;
  }
  _isleTouch6(e);
};
const _drawIsle6 = drawIsle;
drawIsle = function () { _drawIsle6(); if (ISLE.folkUI) drawFolkUI(); };

// =====================================================================================================================
// Part 7: Lighthouse Point and the caves. The path north of the Lagoon opens onto a headland with the dark lighthouse and
// a cave mouth. Fifty floors underneath, in five layers of ten (wet stone, crystal, ice, magma, then something wrong), made
// fresh each day. You carry a lantern; the pulse (Shift or X, or the button on touch screens) is your weapon, as in the
// Sleeper fight. Rocks hold stone, ore and gems; pools hold the cave fish; a boss guards every tenth floor. The elevator
// stops every five floors. Black out and you wake at the cave mouth with half of what you found on that trip. The
// lighthouse keeper's missing log pages are down there: chests on fifteen floors, and one from each boss.
const CAVE_W = 30, CAVE_H = 30, PULSE_R = 46, PULSE_R2 = 62, PULSE_CD = 0.9, PULSE_CD2 = 0.65;
const PAGE_FLOORS = [2, 4, 6, 8, 10, 13, 15, 17, 19, 20, 23, 26, 28, 30, 33, 36, 40, 43, 46, 50];
const KEEPER_PAGES = [
  "DAY ONE BELOW. THE STAIRS UNDER THE LIGHTHOUSE GO DOWN FURTHER THAN THE CLIFFS ARE TALL. THE WALLS ARE WET AND THEY HUM.",
  "THE CRABS DOWN HERE HAVE NEVER SEEN THE SUN. THEY DON'T LIKE MY LANTERN. THEY LIKE MY PULSE EVEN LESS.",
  "I FOUND FISH IN A POOL ON THE FOURTH LEVEL. BLIND, PALE, PERFECT. I'M ADDING THEM TO THE LOG.",
  "MY FATHER KEPT THE LIGHT. HIS FATHER KEPT THE LIGHT. NONE OF THEM EVER ASKED WHY THE LAMP FACES DOWN AS WELL AS OUT.",
  "THE OLD CRAB GUARDED THE TENTH LEVEL LIKE A DOOR. IT WASN'T GUARDING THE CAVES FROM ME. IT WAS GUARDING THE SURFACE FROM WHAT'S BELOW.",
  "CRYSTAL NOW. EVERY WALL SHINES. MY LANTERN COMES BACK TO ME A HUNDRED TIMES. I FEEL WATCHED.",
  "THE OLD LOGS SAY THE FIRST KEEPER CAME HERE BECAUSE OF A DREAM: SOMETHING HUGE, SLEEPING, AND A LIGHT THAT KEPT IT THAT WAY.",
  "I DIVE BY DAY AND CLIMB DOWN BY NIGHT. GUS THINKS I'VE GONE MAD. GUS SAW IT TOO. HE JUST WON'T SAY SO.",
  "THERE IS A CRACK IN THE SEA FLOOR PAST THE WRECK. THESE CAVES RUN TOWARD IT. EVERYTHING DOWN HERE LEANS THAT WAY.",
  "THE PRISM SHATTERED, AND FOR A MOMENT EVERY CRYSTAL SHOWED THE SAME PICTURE: AN EYE, CLOSED.",
  "IT'S COLD THIS DEEP. FROST IN MY BEARD. THE FISH HERE HAVE CLEAR BLOOD. I CAN SEE THEIR HEARTS BEATING.",
  "I WROTE A LETTER TODAY AND PUT IT IN A BOTTLE. I DON'T KNOW WHO IT'S FOR. SOMEONE WHO FISHES, I HOPE.",
  "THE LIGHT ISN'T A WARNING FOR SHIPS. IT NEVER WAS. IT SHINES DOWN THROUGH THE ROCK. AS LONG AS IT BURNS, THE SLEEPER DREAMS.",
  "FROSTMAW CAME UP THROUGH THE ICE THREE TIMES BEFORE I UNDERSTOOD: IT WASN'T HUNTING ME. IT WAS RUNNING FROM SOMETHING DEEPER.",
  "HEAT NOW. THE ROCK GLOWS. THE SLEEPER IS WARMER THAN IT WAS WHEN I STARTED. IT'S BEGINNING TO STIR.",
  "IN ITS DREAMS THE SEA TURNS INSIDE OUT. THERE IS ANOTHER SIDE, WRONG AND BRIGHT. THINGS SWIM THERE THAT SHOULDN'T.",
  "THE CINDER KING WORE A CROWN OF SLAG. WHEN IT FELL, THE WHOLE CAVE SIGHED. SOMEWHERE BELOW, SOMETHING TURNED OVER IN ITS SLEEP.",
  "I HAVE NO CHILD TO KEEP THE LIGHT AFTER ME. IF I GO DOWN AND DON'T COME BACK, THE LAMP WILL GO OUT. I KNOW THAT.",
  "THE BOTTOM IS CLOSE. THE WALLS ARE SOFT. I HEAR IT BREATHING WHEN I SLEEP. IT KNOWS MY NAME.",
  "THE DREAMER WAS ONLY A DREAM OF THE SLEEPER. THE REAL ONE IS UNDER THE SEA. I'M GOING THROUGH THE CRACK TO FIND ANOTHER WAY. WHOEVER READS THIS: KEEP THE LIGHT.",
];
// [name, floor colours, wall, wall face, water, ore id, gem id]
const LAYERS = [null,
  ["WET STONE", [[70, 66, 74], [78, 74, 82], [62, 58, 68]], [40, 36, 46], [96, 88, 98], [44, 92, 112], "copper", "quartz"],
  ["THE CRYSTAL CAVES", [[58, 52, 84], [66, 60, 94], [50, 46, 76]], [34, 28, 56], [110, 92, 160], [60, 110, 150], "iron", "amethyst"],
  ["THE ICE CAVES", [[150, 176, 196], [160, 186, 204], [138, 164, 186]], [70, 94, 120], [210, 230, 244], [80, 140, 190], "silver", "aquamarine"],
  ["THE MAGMA CAVES", [[70, 46, 40], [80, 52, 44], [60, 40, 36]], [36, 22, 22], [140, 70, 50], [150, 70, 40], "gold", "ruby"],
  ["THE DEEP", [[40, 30, 46], [46, 34, 54], [34, 26, 40]], [18, 12, 24], [86, 50, 96], [70, 30, 90], "dream", "dreamstone"]];
Object.assign(ITEMS, {
  copper: { name: "COPPER ORE", kind: "ore", sell: 15 }, iron: { name: "IRON ORE", kind: "ore", sell: 30 }, silver: { name: "SILVER ORE", kind: "ore", sell: 50 },
  gold: { name: "GOLD ORE", kind: "ore", sell: 80 }, dream: { name: "DREAM ORE", kind: "ore", sell: 150 },
  quartz: { name: "QUARTZ", kind: "gem", sell: 40 }, amethyst: { name: "AMETHYST", kind: "gem", sell: 90 }, aquamarine: { name: "AQUAMARINE", kind: "gem", sell: 150 },
  ruby: { name: "RUBY", kind: "gem", sell: 250 }, dreamstone: { name: "DREAMSTONE", kind: "gem", sell: 500 } });
// new things to place, then make
[["sprinkler3", "IRON SPRINKLER", 1, 0, 0, ["..b..", "bbbbb", "bsssb", ".sss."], { b: "#5aaadc", s: "#8c8c9a" }],
 ["clamp", "CRYSTAL LAMP", 1, 0, 1, ["..w..", ".wcw.", ".ccc.", "..s..", ".sss."], { w: "#e6faff", c: "#9adcf0", s: "#8c8c96" }],
 ["geode", "GEODE", 1, 0, 0, [".sss.", "sappa", "spaps", ".sss."], { s: "#8c8c96", a: "#b48ce6", p: "#e6c8ff" }],
 ["goldfish", "GOLD FISH STATUE", 1, 0, 0, ["y...y", "yyyy.", "ykyyy", "yyyy.", "..s..", ".sss."], { y: "#ffd246", k: INK, s: "#8c8c96" }],
 ["dreamorb", "DREAM ORB", 1, 0, 1, [".ppp.", "pwppp", "ppppp", ".ppp.", ".sss."], { p: "#a05ad2", w: "#f0d2ff", s: "#5a5a64" }],
 ["tro_crab", "CRAB CROWN", 1, 0, 0, ["y.y.y", "yyyyy", "yryby", "yyyyy"], { y: "#ffd246", r: "#f05050", b: "#5aaadc" }],
 ["tro_prism", "PRISM HEART", 1, 0, 1, ["..c..", ".cwc.", "ccwcc", ".ccc.", "..c.."], { c: "#b48ce6", w: "#ffffff" }],
 ["tro_frost", "FROSTMAW FANG", 1, 0, 0, ["w....", "ww...", ".ww..", "..ww.", "...bb"], { w: "#e6faff", b: "#6e482a" }],
 ["tro_cinder", "CINDER CROWN", 1, 0, 1, ["o.o.o", "ooooo", "orrro", "ooooo"], { o: "#ff8c32", r: "#ffd246" }],
 ["tro_dream", "THE DREAMER'S EYE", 1, 0, 1, [".ppp.", "pwwwp", "pwkwp", "pwwwp", ".ppp."], { p: "#6e3c8c", w: "#f0e6ff", k: "#e64a5a" }],
].forEach(row => { PLACE.push(row); const [id, name, solid, flat, light, rows, pal] = row; PL[id] = { id, name, solid, flat, light, rows, pal }; ITEMS[id] = { name, kind: "place", sell: 0 }; });
CRAFT.push(["sprinkler3", 1, [["iron", 5], ["copper", 10], ["quartz", 1]]], ["clamp", 1, [["quartz", 2], ["copper", 3]]], ["geode", 1, [["amethyst", 1], ["stone", 20]]],
  ["goldfish", 1, [["gold", 10]]], ["dreamorb", 1, [["dream", 5], ["dreamstone", 1]]]);
UPGRADES.push(["lantern", "BRIGHT LANTERN", "SEE FURTHER IN THE CAVES", 1500, [["copper", 20], ["quartz", 2]]],
  ["pulse", "STRONG PULSE", "THE PULSE REACHES FURTHER AND RECHARGES FASTER", 3000, [["iron", 15], ["amethyst", 2]]]);
const _itemIcon7 = itemIcon;
itemIcon = function (id) {
  const ore = { copper: "#d2824a", iron: "#b4b4c8", silver: "#e6eaf4", gold: "#ffd246", dream: "#c88cf0" }[id], gem = { quartz: "#f0f0fa", amethyst: "#b47ae6", aquamarine: "#7ae6e6", ruby: "#f04664", dreamstone: "#e682ff" }[id];
  if (ore) return pix("icon_" + id, [".ss.", "sosx", "ssos", ".ss."].map(r => r.replace("x", "s")), { s: "#6e6e78", o: ore });
  if (gem) return pix("icon_" + id, [".g.", "ghg", "ggg", ".g."], { g: gem, h: "#ffffff" });
  if (id === "lantern") return pix("icon_lantern", [".k.", "kyk", "kyk", "kkk"], { k: "#5a5a64", y: "#ffd246" });
  if (id === "pulse") return pix("icon_pulse", [".ccc.", "c...c", "c.c.c", "c...c", ".ccc."], { c: CYAN });
  if (id === "page") return pix("icon_page", ["wwww", "wkkw", "wwww", "wkkw", "wwww"], { w: "#f0e6c8", k: "#8c6c50" });
  return _itemIcon7(id);
};

// ---- the save
const _isleSave7 = isleSave;
isleSave = function () {
  const g_ = _isleSave7();
  if (!g_.cave) g_.cave = { lift: 0, boss: {}, chest: {}, hpMax: 5, deep: 0 };
  if (!g_.pages) g_.pages = {};
  if (!g_.p7) { g_.p7 = 1; if (g_.intro) g_.pointMsg = 1; }
  return g_;
};

// ---- Lighthouse Point: a headland with the sea on three sides
AREAS.point = {
  name: "LIGHTHOUSE POINT", w: 50, h: 50, outdoor: true,
  seaD: (x, y) => {                                             // > 0: how far out to sea
    const e = Math.sqrt(((x - 400) / 340) ** 2 + ((y - 470) / 360) ** 2), dE = (e - 1) * 340, dN = y > 560 ? Math.abs(x - 400) - 300 : 1e9;
    return Math.min(dE, dN) + 9 * Math.sin(x / 37) + 7 * Math.sin(y / 29 + 1);
  },
  paths: [[[400, 810], [400, 560], [404, 300], [400, 214]], [[402, 520], [520, 470], [584, 432]]],
  exits: [{ side: "s", a: 300, b: 500, to: "lagoon", x: 598, y: 24 }],
};
AREAS.lagoon.exits.push({ side: "n", a: 560, b: 640, to: "point", x: 400, y: 784 });
function artLighthouse(lit) {
  const P = paintCanvas(46, 112);
  P.shadow(22, 106, 20, 4);
  for (let j = 0; j < 72; j++) { const w = 22 + Math.round(j * 0.16), x0 = 23 - (w >> 1); for (let i = 0; i < w; i++) P.px(x0 + i, 32 + j, Math.floor(j / 12) % 2 ? "#f0ecdc" : "#c84646"); P.px(x0, 32 + j, INK); P.px(x0 + w - 1, 32 + j, INK); }
  P.rect(16, 92, 14, 14, "#5a3c28"); P.rect(16, 92, 14, 1, INK); P.rect(22, 92, 1, 14, "#3c2818");
  P.rect(9, 28, 28, 5, "#3c3c46"); P.rect(13, 12, 20, 16, INK); P.rect(14, 13, 18, 14, lit ? "#ffe68c" : "#2c3446"); P.rect(22, 13, 2, 14, INK);
  P.rect(11, 6, 24, 7, "#3c3c46"); P.rect(20, 1, 6, 6, "#3c3c46"); P.rect(22, 0, 2, 2, INK);
  return P.c;
}
function artCaveMouth() {
  const P = paintCanvas(60, 44);
  P.shadow(30, 40, 28, 3);
  for (let j = 0; j < 36; j++) for (let i = 0; i < 60; i++) { const dx = (i - 30) / 30, dy = (j - 36) / 36; if (dx * dx + dy * dy < 1) P.px(i, j + 4, (Math.floor(i / 5) + Math.floor(j / 4)) % 3 ? "#8c8494" : "#76707e"); }
  for (let j = 0; j < 22; j++) for (let i = 0; i < 26; i++) { const dx = (i - 13) / 13, dy = (j - 22) / 22; if (dx * dx + dy * dy < 1) P.px(17 + i, 18 + j, j < 3 ? "#2c2834" : "#0c0a12"); }
  P.rect(15, 38, 30, 2, "#5a5462");
  return P.c;
}
function pointObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act }), A = AREAS.point, r = seeded(901);
  add("lighthouse", 377, 104, [6, 92, 34, 14], { kind: "lighthouse" });
  add("cavemouth", 556, 384, [0, 14, 60, 22], { kind: "cave", rect: [14, 18, 32, 28] });
  add("scave", 520, 436, [24, 10, 6, 8], { kind: "say", text: ["THE CAVES. A HAND-PAINTED SIGN: KEEPER'S STAIR. MIND THE DARK."] });
  add("spoint", 430, 740, [24, 10, 6, 8], { kind: "say", text: ["LIGHTHOUSE POINT. THE LIGHT HAS BEEN DARK FOR MANY YEARS."] });
  const clear = (x, y, w, h) => !o.some(q => x + w > q.x - 6 && x < q.x + IART[q.k].width + 6 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 18 && A.seaD(x + w / 2, y + h) < -24;
  for (let i = 0; i < 260; i++) {
    const x = r.uniform(0, 780), y = r.uniform(0, 780), palm = r.random() < 0.3, [w, h] = palm ? [28, 42] : [16, 12];
    if (!clear(x, y, w, h)) continue;
    if (palm) add("palm", x, y, [10, 30, 8, 6]); else add(r.random() < 0.5 ? "bush" : "bushb", x, y, [3, 6, 10, 4]);
  }
  for (let i = 0; i < 60; i++) { const x = r.uniform(0, 780), y = r.uniform(0, 780); if (clear(x, y, 10, 8)) add("rock", x, y, [1, 3, 8, 4]); }
  return o;
}
const POINT_MOUTH = [586, 446];

// ---- making a cave floor
function caveArt() {
  if (IART.cup) return;
  for (let L = 1; L <= 5; L++) {
    const [, fl, , face] = LAYERS[L], rc = "rgb(" + face.join(",") + ")", rd = "rgb(" + face.map(v => Math.round(v * 0.7)).join(",") + ")";
    const rock = (spk, gem) => { const P = paintCanvas(16, 14); P.shadow(8, 12, 7, 2); P.rows(["..rrrr..", ".rrrrrr.", "rrhrrrrd", "rrrrrrdd", ".rrrddd."].map(q => q), { r: rc, h: shade("#" + face.map(v => v.toString(16).padStart(2, "0")).join(""), 1.3), d: rd }, 0, 4, false); if (spk) for (const [a, b] of gem ? [[4, 5], [6, 4], [5, 6]] : [[2, 6], [5, 7], [4, 5]]) P.rect(a, b + 1, gem ? 2 : 1, gem ? 2 : 1, spk); return P.c; };
    IART["crock" + L] = rock(null); IART["core" + L] = rock(({ 1: "#d2824a", 2: "#e6e6f0", 3: "#f4f8ff", 4: "#ffd246", 5: "#c88cf0" })[L]); IART["cgem" + L] = rock(({ 1: "#ffffff", 2: "#c896ff", 3: "#7af0f0", 4: "#ff5070", 5: "#ff8cff" })[L], 1);
    void fl;
  }
  const lad = up => { const P = paintCanvas(16, up ? 26 : 16); if (up) { P.rect(3, 0, 2, 26, "#8c5a32"); P.rect(11, 0, 2, 26, "#8c5a32"); for (let k = 0; k < 6; k++) P.rect(3, 3 + k * 4, 10, 1, "#b47e4a"); } else { P.rect(0, 2, 16, 12, INK); P.rect(1, 3, 14, 10, "#06040a"); P.rect(4, 3, 2, 10, "#8c5a32"); P.rect(10, 3, 2, 10, "#8c5a32"); for (let k = 0; k < 3; k++) P.rect(4, 4 + k * 3, 8, 1, "#b47e4a"); } return P.c; };
  IART.cup = lad(true); IART.cdown = lad(false);
  const C = paintCanvas(18, 14); C.rect(0, 0, 18, 13, INK); C.rect(1, 1, 16, 11, "#8c5a32"); C.rect(1, 1, 16, 4, "#b47e4a"); C.rect(8, 4, 2, 3, GOLD); IART.cchest = C.c;
  IART.lighthouse = artLighthouse(false); IART.cavemouth = artCaveMouth(); IART.scave = artSign("THE CAVES"); IART.spoint = artSign("LIGHTHOUSE POINT");
}
const _isleArt7 = isleArt; isleArt = function () { _isleArt7(); caveArt(); };
function buildCave(n) {
  const s = isleSave(), L = Math.ceil(n / 10), boss = n % 10 === 0, Ly = LAYERS[L];
  let r = seeded(n * 7919 + DAYN(s) * 31 + 17), G, entry, exit, dist;
  const inb = (x, y) => x >= 0 && y >= 0 && x < CAVE_W && y < CAVE_H, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const bfs = (sx, sy, grid) => { const d = grid.map(rw => rw.map(() => -1)), q = [[sx, sy]]; d[sy][sx] = 0; while (q.length) { const [x, y] = q.shift(); for (const [a, b] of D4) { const nx = x + a, ny = y + b; if (inb(nx, ny) && d[ny][nx] < 0 && grid[ny][nx] === "f") { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } } } return d; };
  for (let tries = 0; tries < 8; tries++) {
    if (boss) { G = []; for (let y = 0; y < CAVE_H; y++) { const rw = []; for (let x = 0; x < CAVE_W; x++) rw.push(Math.hypot(x - 14.5, (y - 15) * 1.1) < 12.5 + Math.sin(x * 1.7 + y) * 0.6 ? "f" : "x"); G.push(rw); } entry = [15, 26]; G[26][15] = "f"; }
    else {
      let w = []; for (let y = 0; y < CAVE_H; y++) { const rw = []; for (let x = 0; x < CAVE_W; x++) rw.push(x === 0 || y === 0 || x === CAVE_W - 1 || y === CAVE_H - 1 || r.random() < 0.45); w.push(rw); }
      for (let it = 0; it < 5; it++) w = w.map((rw, y) => rw.map((v, x) => { if (x === 0 || y === 0 || x === CAVE_W - 1 || y === CAVE_H - 1) return true; let k = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if ((a || b) && w[y + b][x + a]) k++; return k >= 5 || (it < 2 && k === 0); }));
      G = w.map(rw => rw.map(v => v ? "x" : "f"));
      const floors = []; G.forEach((rw, y) => rw.forEach((v, x) => { if (v === "f") floors.push([x, y]); }));
      if (floors.length < 260) { r = seeded(n * 7919 + DAYN(s) * 31 + 101 + tries * 13); continue; }
      let best = null;                                        // keep the biggest open space; fill the rest in
      const seen = new Set();
      for (const [x, y] of floors) { if (seen.has(x + "," + y)) continue; const d = bfs(x, y, G), reg = []; d.forEach((rw, yy) => rw.forEach((v, xx) => { if (v >= 0) { reg.push([xx, yy]); seen.add(xx + "," + yy); } })); if (!best || reg.length > best.length) best = reg; }
      const keep = new Set(best.map(([x, y]) => x + "," + y)); G = G.map((rw, y) => rw.map((v, x) => keep.has(x + "," + y) ? "f" : "x"));
      if (best.length < 240) { r = seeded(n * 7919 + DAYN(s) * 31 + 101 + tries * 13); continue; }
      const open = best.filter(([x, y]) => [-1, 0, 1].every(b => [-1, 0, 1].every(a => G[y + b] && G[y + b][x + a] === "f")));
      entry = (open.length ? open : best)[Math.floor(r.random() * (open.length || best.length))];
    }
    break;
  }
  dist = bfs(entry[0], entry[1], G);
  let far = entry; G.forEach((rw, y) => rw.forEach((v, x) => { if (dist[y][x] > dist[far[1]][far[0]]) far = [x, y]; }));
  exit = boss ? [15, 15] : far;
  if (!boss && r.random() < 0.75) {                              // a cave pool, as long as it doesn't cut the way through
    const cand = []; G.forEach((rw, y) => rw.forEach((v, x) => { if (v === "f" && x < CAVE_W - 2 && y < CAVE_H - 2 && dist[y][x] > 5 && Math.hypot(x - exit[0], y - exit[1]) > 4 && [-1, 0, 1, 2].every(b => [-1, 0, 1, 2].every(a => G[y + b][x + a] === "f"))) cand.push([x, y]); }));
    if (cand.length) {
      const [px, py] = cand[Math.floor(r.random() * cand.length)], cells = [[0, 0], [1, 0], [0, 1], [1, 1], [r.random() < 0.5 ? 2 : -1, r.random() < 0.5 ? 0 : 1]];
      cells.forEach(([a, b]) => G[py + b][px + a] = "a");
      const d2 = bfs(entry[0], entry[1], G);
      if (d2[exit[1]][exit[0]] < 0) cells.forEach(([a, b]) => G[py + b][px + a] = "f");
    }
  }
  // paint
  const W = CAVE_W * TS, H = CAVE_H * TS, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x2 = c.getContext("2d"), img = x2.createImageData(W, H), d = img.data, pr = seeded(n * 31 + 5);
  const put = (i, col) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS), t = G[ty][tx], i = (py * W + px) * 4, nn = pr.random();
    let col;
    if (t === "x") { const below = ty + 1 < CAVE_H && G[ty + 1][tx] !== "x", yy = py % TS; col = below && yy >= 6 ? (yy === 6 ? Ly[3].map(v => Math.min(255, v + 30)) : Ly[3].map(v => Math.round(v * (nn < 0.85 ? 1 : 0.85)))) : Ly[2].map(v => Math.round(v * (nn < 0.9 ? 1 : 1.25))); }
    else if (t === "a") { col = Ly[4].map(v => Math.round(v * ((px + py * 3) % 11 === 0 ? 1.3 : 1))); }
    else col = Ly[1][nn < 0.7 ? 0 : nn < 0.88 ? 1 : 2];
    put(i, col);
  }
  x2.putImageData(img, 0, 0);
  const tiles = G.map(rw => rw.slice());
  // things in it
  const objs = [], used = new Set(), near = (x, y, p, k) => Math.abs(x - p[0]) <= k && Math.abs(y - p[1]) <= k;
  const freeTile = (minD, avoid) => { for (let k = 0; k < 200; k++) { const x = 1 + Math.floor(r.random() * (CAVE_W - 2)), y = 1 + Math.floor(r.random() * (CAVE_H - 2)); if (G[y][x] !== "f" || used.has(x + "," + y) || dist[y][x] < minD || near(x, y, entry, 2) || near(x, y, exit, 1) || (avoid && avoid(x, y))) continue; used.add(x + "," + y); return [x, y]; } return null; };
  objs.push({ k: "cup", x: entry[0] * TS, y: entry[1] * TS - 12, solid: null, act: { kind: "ladderup", rect: [0, 4, 16, 22] } });
  if (!boss) objs.push({ k: "cdown", x: exit[0] * TS, y: exit[1] * TS, solid: null, act: { kind: "ladder", rect: [0, 0, 16, 16] } });
  else if (s.cave.boss[L] && L < 5) objs.push({ k: "cdown", x: exit[0] * TS, y: exit[1] * TS, solid: null, act: { kind: "ladder", rect: [0, 0, 16, 16] } });
  if (!boss) {
    const nRocks = 26 + Math.floor(r.random() * 12);
    for (let k = 0; k < nRocks; k++) { const t = freeTile(2); if (!t) break; const q = r.random(), kind = q < 0.04 + L * 0.005 ? "gem" : q < 0.27 ? "ore" : "rock"; objs.push({ k: (kind === "gem" ? "cgem" : kind === "ore" ? "core" : "crock") + L, x: t[0] * TS, y: t[1] * TS + 2, solid: [3, 7, 10, 6], cave: { kind, hp: kind === "gem" ? 3 : kind === "ore" ? 2 : 1 } }); }
  }
  if (PAGE_FLOORS.includes(n) && !boss && !s.cave.chest[n]) { const t = freeTile(Math.floor(dist[exit[1]][exit[0]] * 0.5)) || freeTile(3); if (t) objs.push({ k: "cchest", x: t[0] * TS - 1, y: t[1] * TS + 2, solid: [0, 2, 18, 11], act: { kind: "cchest" } }); }
  const foes = [];
  if (!boss) { const nf = Math.min(10, 3 + Math.floor(n / 6)); for (let k = 0; k < nf; k++) { const t = freeTile(8); if (t) foes.push(makeFoe(CAVE_FOES_BY_LAYER[L][k % 2], t[0] * TS + 8, t[1] * TS + 10, n)); } }
  else if (!s.cave.boss[L]) foes.push(makeBoss(L));
  return { id: "cave_" + n, A: { name: "FLOOR " + n + ": " + Ly[0], w: CAVE_W, h: CAVE_H, outdoor: false, cave: true, layer: L, n, boss }, c, tiles, objs, W, H, glints: [], pools: [], entry: [entry[0] * TS + 8, entry[1] * TS + 14], exitT: exit, foes };
}

// ---- creatures: [name, layer, hp, speed, how it moves, palette, rows (two frames)]
const CAVE_FOES = {
  crab: { name: "CAVE CRAB", hp: 2, sp: 24, kind: "walk", r: 6, rows: [[".a.....a.", "aa.....aa", ".aaaaaaa.", "aakaaakaa", ".aaaaaaa.", "a.a...a.a"], [".a.....a.", "aa.....aa", ".aaaaaaa.", "aakaaakaa", ".aaaaaaa.", ".a.a.a.a."]], pal: { a: "#c86450", k: "#fadc5a" } },
  bat: { name: "DRIP BAT", hp: 1, sp: 44, kind: "bat", r: 5, rows: [["a.......a", "aa.aaa.aa", ".aakakaa.", "...aaa..."], ["...aaa...", "..akaka..", ".aaaaaaa.", "aa.....aa"]], pal: { a: "#5a5070", k: "#ff6e6e" } },
  beetle: { name: "CRYSTAL BEETLE", hp: 3, sp: 20, kind: "charge", r: 6, rows: [["..a..a..", ".bbbbbb.", "bbcbbcbb", "bbbbbbbb", "bkbbbbkb", ".a.aa.a."], ["..a..a..", ".bbbbbb.", "bbcbbcbb", "bbbbbbbb", "bkbbbbkb", "a.a..a.a"]], pal: { a: "#3c3050", b: "#8c6ad2", c: "#e6d2ff", k: "#ffffff" } },
  wisp: { name: "SHARD WISP", hp: 2, sp: 30, kind: "bat", r: 5, glow: "#c8a0ff", shoot: 3.2, rows: [["..ww..", ".wbbw.", "wbkkbw", "wbbbbw", ".wbbw.", "..ww.."], [".w..w.", "..bb..", "wbkkbw", "wbbbbw", "..bb..", ".w..w."]], pal: { w: "#e6d2ff", b: "#a078f0", k: "#ffffff" } },
  slug: { name: "FROST SLUG", hp: 4, sp: 13, kind: "walk", r: 7, rows: [["......aa.", "....aaaak", ".aaaaaaaa", "aaaaaaaaa"], ["......aa.", "....aaaak", "..aaaaaaa", "aaaaaaaaa"]], pal: { a: "#b4dcf0", k: INK } },
  icebat: { name: "ICE BAT", hp: 2, sp: 50, kind: "bat", r: 5, rows: [["a.......a", "aa.aaa.aa", ".aakakaa.", "...aaa..."], ["...aaa...", "..akaka..", ".aaaaaaa.", "aa.....aa"]], pal: { a: "#78b4dc", k: "#ffffff" } },
  toad: { name: "EMBER TOAD", hp: 4, sp: 0, kind: "hop", r: 7, glow: "#ff8c32", rows: [[".k....k.", "aaaaaaaa", "abbbbbba", "aaaaaaaa", "a.a..a.a"], [".k....k.", "aaaaaaaa", "abbbbbba", "aaaaaaaa", ".a....a."]], pal: { a: "#c8462c", b: "#ffbe3c", k: "#ffd246" } },
  cinder: { name: "CINDER BAT", hp: 3, sp: 52, kind: "bat", r: 5, glow: "#ff6e32", rows: [["a.......a", "aa.aaa.aa", ".aakakaa.", "...aaa..."], ["...aaa...", "..akaka..", ".aaaaaaa.", "aa.....aa"]], pal: { a: "#5a2c24", k: "#ffbe3c" } },
  watcher: { name: "WATCHER", hp: 4, sp: 0, kind: "blink", r: 6, glow: "#e64a5a", rows: [["..aaa..", ".abbba.", "abbkbba", "abkkkba", "abbkbba", ".abbba.", "..aaa.."], ["..aaa..", ".aaaaa.", "abbbbba", "akkkkka", "abbbbba", ".aaaaa.", "..aaa.."]], pal: { a: "#4a2c5a", b: "#f0e6ff", k: "#e64a5a" } },
  moth: { name: "DREAM MOTH", hp: 3, sp: 38, kind: "bat", r: 6, glow: "#d28cff", rows: [["aa.....aa", "aaa.b.aaa", ".aabbbaa.", "aa.bkb.aa", "a...b...a"], ["..a...a..", ".aa.b.aa.", ".aabbbaa.", "..abkba..", "....b...."]], pal: { a: "#8c5ab4", b: "#f0d2ff", k: INK } },
};
const CAVE_FOES_BY_LAYER = [null, ["crab", "bat"], ["beetle", "wisp"], ["slug", "icebat"], ["toad", "cinder"], ["watcher", "moth"]];
function makeFoe(kind, x, y, n) { const F = CAVE_FOES[kind], inLayer = (n - 1) % 10; return { kind, x, y, hp: F.hp + Math.floor(inLayer / 4), r: F.r, t: Math.random() * 3, st: 0, stun: 0, hit: 0, awake: false, vx: 0, vy: 0, ph: Math.random() * 6 }; }
const BOSSES = [null,
  { id: "crab", name: "THE OLD CRAB", hp: 12, r: 17, intro: "SOMETHING HUGE STIRS IN THE SAND...", out: "THE OLD CRAB SCUTTLES BACK INTO THE DARK, MISSING A CLAW.", tro: "tro_crab" },
  { id: "prism", name: "THE PRISM", hp: 15, r: 14, intro: "THE CRYSTALS IN THE WALLS ALL TURN TO FACE YOU...", out: "THE PRISM SHATTERS INTO A THOUSAND HARMLESS SPARKS.", tro: "tro_prism" },
  { id: "frost", name: "FROSTMAW", hp: 16, r: 15, intro: "THE ICE UNDER YOUR FEET CRACKS...", out: "FROSTMAW SINKS THROUGH THE ICE AND DOESN'T COME BACK.", tro: "tro_frost" },
  { id: "cinder", name: "THE CINDER KING", hp: 18, r: 16, intro: "THE FLOOR GLOWS. SOMETHING HEAVY HOPS CLOSER...", out: "THE CINDER KING COOLS INTO A LUMP OF BLACK ROCK. ITS CROWN ROLLS TO YOUR FEET.", tro: "tro_cinder" },
  { id: "dreamer", name: "THE DREAMER", hp: 20, r: 20, intro: "THE DARK OPENS ITS EYES.", out: "THE DREAMER CLOSES ITS EYES. THE CAVE IS VERY QUIET.", tro: "tro_dream" }];
function makeBoss(L) { const B = BOSSES[L]; return { boss: L, kind: B.id, x: 15 * TS, y: 11 * TS, hp: B.hp, max: B.hp, r: B.r, t: 0, st: "idle", stT: 1.6, stun: 0, hit: 0, awake: true, ph: 0, eye: 0, spawned: 0 }; }

// ---- going down, coming up
function caveTripStart() {
  const s = isleSave(), snap = {};
  for (const q of s.inv) if (q) snap[q[0]] = (snap[q[0]] || 0) + q[1];
  ISLE.cave = { hp: s.cave.hpMax, snap, inv: 0, charge: 1, ring: null, shots: [], haz: [], flash: 0, n: 0, foes: [] };
}
function enterFloor(n) {
  const s = isleSave(), old = ISLE.map && ISLE.map.id;
  if (!ISLE.cave) caveTripStart();
  caveArt();
  for (const k of Object.keys(ISLE.maps)) if (k.startsWith("cave_")) delete ISLE.maps[k];
  const m = buildCave(n); ISLE.maps[m.id] = m;
  isleGo(m.id, m.entry[0], m.entry[1], "down");
  const C = ISLE.cave; Object.assign(C, { n, foes: m.foes, shots: [], haz: [], ring: null, charge: 1 });
  ISLE.fish = null; ISLE.shadows = [];
  if (n % 5 === 0 && n > s.cave.lift) { s.cave.lift = n; toast("THE ELEVATOR NOW STOPS AT FLOOR " + n, GOLD); }
  s.cave.deep = Math.max(s.cave.deep || 0, n);
  const b = C.foes.find(f => f.boss);
  if (b) isleSay([BOSSES[b.boss].intro, BOSSES[b.boss].name + "!"]);
  else if (old && !old.startsWith("cave_")) isleSay(["YOU LIGHT YOUR LANTERN AND CLIMB DOWN.", "SHIFT OR X TO PULSE. MINE ROCKS WITH THE PICK. THE LADDER BY THE ENTRANCE TAKES YOU BACK UP."]);
  play(b ? "thunder" : "plop"); saveStore();
}
function caveLeave(blackout) {
  const s = isleSave(), C = ISLE.cave, lost = [];
  if (blackout && C) {
    const now = {}; for (const q of s.inv) if (q) now[q[0]] = (now[q[0]] || 0) + q[1];
    for (const id in now) { const gain = now[id] - (C.snap[id] || 0), drop = Math.floor(gain / 2); if (drop > 0) { invTake(id, drop); lost.push(drop + " " + ITEMS[id].name); } }
  }
  ISLE.cave = null; ISLE.fish = null;
  for (const k of Object.keys(ISLE.maps)) if (k.startsWith("cave_")) delete ISLE.maps[k];
  isleGo("point", POINT_MOUTH[0], POINT_MOUTH[1], "down");
  if (blackout) isleSay(["EVERYTHING GOES DARK...", "YOU WAKE UP AT THE CAVE MOUTH. SOMEONE MUST HAVE CARRIED YOU OUT.", lost.length ? "YOU LOST " + lost.slice(0, 6).join(", ") + "." : "YOU DIDN'T LOSE ANYTHING."]);
  play(blackout ? "miss" : "tick"); saveStore();
}
function caveMouthAct() {
  const s = isleSave(), stops = [1]; for (let k = 5; k <= s.cave.lift; k += 5) stops.push(k);
  if (stops.length === 1) { isleSay(["STONE STEPS GO DOWN INTO THE DARK. CLIMB DOWN?"], { opts: ["CLIMB DOWN", "NOT YET"], act: [() => enterFloor(1), () => play("tick")] }); return; }
  ISLE.list = { kind: "lift", sel: stops.length - 1, top: 0 }; play("select");
}
const _listRows7 = listRows;
listRows = function () {
  const L = ISLE.list, s = isleSave();
  if (L.kind === "lift") { const out = [{ icon: "lantern", name: "FLOOR 1", info: "THE TOP OF THE CAVES.", ok: true, act: () => { ISLE.list = null; enterFloor(1); } }]; for (let k = 5; k <= s.cave.lift; k += 5) { const n = k; out.push({ icon: "lantern", name: "FLOOR " + n, info: LAYERS[Math.ceil(n / 10)][0] + (n % 10 === 0 && !s.cave.boss[n / 10] ? ". SOMETHING BIG LIVES ON THIS FLOOR." : "."), ok: true, act: () => { ISLE.list = null; enterFloor(n); } }); } return out; }
  if (L.kind === "pages") return KEEPER_PAGES.map((t, i) => s.pages[i + 1] ? { icon: "page", name: "PAGE " + (i + 1), info: t, ok: true, act: () => { const i_ = i; isleSay(["THE KEEPER'S LOG, PAGE " + (i_ + 1) + ":", t]); } } : { icon: "page", name: "???", info: "A MISSING PAGE. THE KEEPER WROTE THAT THEY'RE KEPT SAFE BELOW.", ok: false, act: () => {} });
  return _listRows7();
};
Object.assign(LIST_TITLE, { lift: "THE CAVES: ELEVATOR", pages: "THE KEEPER'S LOG" });
const _listPick7 = listPick;
listPick = function () { const L = ISLE.list; if (L && (L.kind === "lift" || L.kind === "pages")) { const r = listRows()[L.sel]; if (r && r.ok) { r.act(); play("select"); } else play("miss"); return; } _listPick7(); };
ISLE_MENU.splice(ISLE_MENU.length - 1, 0, ["KEEPER'S LOG", () => { ISLE.menu = null; ISLE.list = { kind: "pages", sel: 0, top: 0 }; }]);
function awardPage(n) {
  const s = isleSave(), i = PAGE_FLOORS.indexOf(n) + 1;
  if (i <= 0 || s.pages[i]) return [];
  s.pages[i] = 1;
  return ["YOU FOUND PAGE " + i + " OF THE KEEPER'S LOG. (" + Object.keys(s.pages).length + " OF 20)", KEEPER_PAGES[i - 1]];
}

// ---- interacting
const _isleAct57 = isleAct5;
isleAct5 = function (o) {
  const a = o.act, s = isleSave();
  if (a.kind === "cave") caveMouthAct();
  else if (a.kind === "lighthouse") isleSay(s.flags.lightkey ? ["THE BRASS KEY TURNS. INSIDE, THE STAIRS ARE ROTTEN THROUGH HALFWAY UP.", "THE LAMP ROOM IS DARK. IT WILL TAKE MORE THAN A KEY TO LIGHT IT AGAIN."] : ["THE LIGHTHOUSE. THE DOOR IS LOCKED TIGHT.", "HIGH ABOVE, THE LAMP ROOM WINDOWS ARE DARK."]);
  else if (a.kind === "ladder") { const n = ISLE.cave.n + 1; if (n > 50) return; enterFloor(n); }
  else if (a.kind === "ladderup") isleSay(["CLIMB ALL THE WAY BACK UP?"], { opts: ["CLIMB UP", "STAY"], act: [() => caveLeave(false), () => play("tick")] });
  else if (a.kind === "cchest") {
    const n = ISLE.cave.n; s.cave.chest[n] = 1;
    ISLE.map.objs = ISLE.map.objs.filter(q => q !== o);
    const L = Math.ceil(n / 10), loot = [[LAYERS[L][5], 3 + Math.floor(Math.random() * 3)], [LAYERS[L][6], 1]];
    loot.forEach(([id, k]) => { if (invAdd(id, k)) s.owed.push([id, k]); });
    isleSay(["AN OLD SEA CHEST. INSIDE: " + loot.map(([id, k]) => k + " " + ITEMS[id].name).join(" AND ") + ", WRAPPED IN OILCLOTH WITH A TORN PAGE."].concat(awardPage(n)));
    play("fanfare"); saveStore();
  }
  else _isleAct57(o);
};
const _buildArea7 = buildArea;
buildArea = function (id) {
  if (id.startsWith("cave_")) return buildCave(+id.slice(5));
  const m = _buildArea7(id);
  if (id === "point") { m.objs = pointObjects(); m.objs.forEach((o, i) => { if (o.k === "rock") o.res = { kind: "rock", key: "point:" + i }; }); }
  if (id === "lagoon") m.objs = m.objs.filter(o => !(o.k === "pile" && o.y < 20));   // the way north is open
  return m;
};
const _startIsland7 = startIsland;
startIsland = function () {
  _startIsland7();
  const s = isleSave();
  if (s.pointMsg) { s.pointMsg = 0; ISLE.msg.pages.push("THE SHIPWRIGHT CLEARED THE DRIFTWOOD NORTH OF THE LAGOON. THE PATH GOES ON TO LIGHTHOUSE POINT.", "BRAM: 'THERE ARE CAVES UNDER THAT HEADLAND. TAKE A LANTERN, AND DON'T GO DEEPER THAN YOU CAN CLIMB.'"); }
};
const _isleSleep7 = isleSleep;
isleSleep = function (passedOut) { if (ISLE && ISLE.cave) { ISLE.cave = null; for (const k of Object.keys(ISLE.maps)) if (k.startsWith("cave_")) delete ISLE.maps[k]; } _isleSleep7(passedOut); };

// ---- mining and eating
function caveRockAt(x, y) { for (const o of ISLE.map.objs) if (o.cave && x >= o.x - 3 && x < o.x + 19 && y >= o.y && y < o.y + 18) return o; return null; }
function caveMine(tool) {
  const s = isleSave(), [fx, fy] = facingPoint(), o = caveRockAt(fx, fy) || caveRockAt(ISLE.px, ISLE.py - 6);
  if (!o) { play("miss"); return; }
  if (tool !== "pick") { toast("THAT NEEDS THE PICK"); play("miss"); return; }
  o.cave.hp -= s.up.pick ? 2 : 1; o.hit = 0.2; play("hit"); splashDust(Math.floor((o.x + 8) / TS), Math.floor((o.y + 8) / TS), "#b4b4be");
  if (o.cave.hp > 0) return;
  ISLE.map.objs = ISLE.map.objs.filter(q => q !== o);
  const L = ISLE.map.A.layer, k = o.cave.kind, got = k === "gem" ? [[LAYERS[L][6], 1]] : k === "ore" ? [[LAYERS[L][5], 1 + (Math.random() < 0.5 ? 1 : 0)], ["stone", 1]] : [["stone", 1 + (Math.random() < 0.4 ? 1 : 0)]].concat(Math.random() < 0.05 ? [[LAYERS[L][5], 1]] : []);
  for (const [id, n] of got) { const left = invAdd(id, n); if (left) { toast("YOUR BAG IS FULL"); break; } toast("+" + n + " " + ITEMS[id].name, k === "gem" ? GOLD : "#d2b482"); }
  if (k === "gem") play("chime");
}
const _toolHit7 = toolHit;
toolHit = function (tool) { if (ISLE.map.A.cave) caveMine(tool); else _toolHit7(tool); };
const EAT = { dish: 2, artisan: 2, fish: 1, topfish: 1, crop: 1 };
const _isleInteract7 = isleInteract;
isleInteract = function () {
  const I = ISLE, it = held();
  if (I.map && I.map.A.cave && !I.msg && !I.menu && !I.list && !I.inv && !I.chest && !I.shop && !I.card && !I.log && !I.fish && it && ITEMS[it[0]] && (ITEMS[it[0]].kind === "place" || it[0] === "pot") && !objAt(...facingPoint())) { toast("YOU CAN'T SET THAT DOWN HERE"); play("miss"); return; }
  if (I.map && I.map.A.cave && I.cave && !I.msg && !I.menu && !I.shop && !I.inv && !I.card && !I.list && !I.chest && !I.log && !I.fish && it && ITEMS[it[0]] && (EAT[ITEMS[it[0]].kind] || ["mushroom", "wildberry", "garlic"].includes(it[0]))) {
    const [fx, fy] = facingPoint();
    if (!objAt(fx, fy) && !objAt(I.px, I.py - 4) && !caveRockAt(fx, fy)) {
      if (I.cave.hp >= isleSave().cave.hpMax) { toast("YOU'RE NOT HURT"); return; }
      const heal = EAT[ITEMS[it[0]].kind] || 1; I.cave.hp = Math.min(isleSave().cave.hpMax, I.cave.hp + heal); invUse(isleSave().sel);
      toast("YOU EAT THE " + ITEMS[it[0]].name + ". +" + heal + " HEART" + (heal > 1 ? "S" : ""), "#ff8ca0"); play("chime"); return;
    }
  }
  _isleInteract7();
};

// ---- fighting
function caveFree(x, y, r, fly) {
  const M_ = ISLE.map;
  for (const [a, b] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const tx = Math.floor((x + a) / TS), ty = Math.floor((y + b) / TS);
    if (tx < 0 || ty < 0 || tx >= CAVE_W || ty >= CAVE_H) return false;
    const t = M_.tiles[ty][tx]; if (t === "x" || (t === "a" && !fly)) return false;
  }
  return true;
}
function foeMove(f, dx, dy, fly) { if (caveFree(f.x + dx, f.y, f.r * 0.6, fly)) f.x += dx; else f.vx = -f.vx; if (caveFree(f.x, f.y + dy, f.r * 0.6, fly)) f.y += dy; else f.vy = -f.vy; }
function caveHurt(dmg, fx, fy) {
  const C = ISLE.cave, I = ISLE;
  if (!C || C.inv > 0 || I.msg) return;
  C.hp -= dmg; C.inv = 1.2; C.flash = 0.25; play("zap");
  const dx = I.px - fx, dy = I.py - fy, d = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < 14; k++) { const nx = I.px + dx / d, ny = I.py + dy / d; if (!feetBlocked(nx, ny)) { I.px = nx; I.py = ny; } }
  I.fish = null;
}
function caveShot(x, y, ang, sp, col) { ISLE.cave.shots.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, col: col || "#e6d2ff", t: 0 }); }
const bossOpen = f => f.kind === "frost" ? f.st === "up" : f.kind === "cinder" ? f.st !== "air" : f.kind === "dreamer" ? f.eye > 0.6 : true;
function cavePulse() {
  const I = ISLE, C = I.cave, s = isleSave();
  if (!C || !I.map.A.cave || C.charge < 1 || I.msg) return;
  C.charge = 0; C.ring = 0; play("pulse");
  const reach = s.up.pulse ? PULSE_R2 : PULSE_R;
  C.shots = C.shots.filter(q => Math.hypot(q.x - I.px, q.y - I.py + 6) > reach);
  for (const f of C.foes) {
    const d = Math.hypot(f.x - I.px, f.y - (I.py - 6)) - f.r;
    if (d > reach) continue;
    if (f.boss && !bossOpen(f)) { f.hit = 0.1; continue; }
    f.hp--; f.hit = 0.2; f.awake = true;
    if (!f.boss) { f.stun = 0.5; const dx = f.x - I.px, dy = f.y - I.py, dd = Math.hypot(dx, dy) || 1; for (let k = 0; k < 24; k++) foeMove(f, dx / dd, dy / dd, CAVE_FOES[f.kind].kind === "bat"); }
    play("hit");
  }
  caveSweep();
}
function caveSweep() {                                                  // the fallen drop things; a boss falls for good
  const C = ISLE.cave, s = isleSave(), L = ISLE.map.A.layer;
  for (const f of C.foes.filter(q => q.hp <= 0)) {
    if (f.boss) { bossWin(f); continue; }
    const q = Math.random();
    if (q < 0.35) { const id = q < 0.05 ? LAYERS[L][6] : q < 0.18 ? LAYERS[L][5] : "stone"; if (!invAdd(id, 1)) toast("+1 " + ITEMS[id].name, "#d2b482"); }
    splashDust(Math.floor(f.x / TS), Math.floor(f.y / TS), "#c8c8d2");
  }
  C.foes = C.foes.filter(q => q.hp > 0);
  void s;
}
function bossWin(f) {
  const s = isleSave(), L = f.boss, B = BOSSES[L], C = ISLE.cave;
  s.cave.boss[L] = 1; s.cave.hpMax++; C.hp = s.cave.hpMax; C.shots = []; C.haz = [];
  C.foes = C.foes.filter(q => q === f);
  const gems = [[B.tro, 1], [LAYERS[L][6], 2], [LAYERS[L][5], 8]];
  gems.forEach(([id, n]) => { if (invAdd(id, n)) s.owed.push([id, n]); });
  s.sd += 500 * L;
  if (L < 5) ISLE.map.objs.push({ k: "cdown", x: 15 * TS, y: 15 * TS, solid: null, act: { kind: "ladder", rect: [0, 0, 16, 16] } });
  isleSay([B.out, "YOU GOT THE " + ITEMS[B.tro].name + ", " + gems.slice(1).map(([id, n]) => n + " " + ITEMS[id].name).join(", ") + " AND " + 500 * L + " SAND DOLLARS.", "YOUR HEART FEELS STRONGER: " + s.cave.hpMax + " HEARTS NOW."]
    .concat(awardPage(L * 10)).concat(L < 5 ? ["A LADDER LEADS FURTHER DOWN."] : ["THE BOTTOM OF THE CAVES. THE WATER IS STILL, AND SOMETHING DEEP BELOW YOU IS DREAMING."]));
  play("fanfare"); saveStore();
}
function bossTick(f, dt) {
  const I = ISLE, C = I.cave, px = I.px, py = I.py - 6, dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
  f.t += dt; f.stT -= dt;
  if (f.kind === "crab") {
    if (f.st === "idle") { foeMove(f, dx / d * 26 * dt, dy / d * 26 * dt); if (f.stT <= 0) { f.st = Math.random() < 0.6 ? "wind" : "slam"; f.stT = f.st === "wind" ? 0.6 : 0.5; f.ax = dx / d; f.ay = dy / d; } }
    else if (f.st === "wind") { if (f.stT <= 0) { f.st = "dash"; f.stT = 0.6; } }
    else if (f.st === "dash") { foeMove(f, f.ax * 160 * dt, f.ay * 160 * dt); if (f.stT <= 0) { f.st = "idle"; f.stT = 1.8 + Math.random(); } }
    else if (f.st === "slam") { if (f.stT <= 0) { C.haz.push({ ring: 0, x: f.x, y: f.y, max: 110, sp: 120, col: "#e6c8a0" }); f.st = "idle"; f.stT = 2.2; play("thunder"); } }
    if (f.hp <= f.max / 2 && !f.spawned) { f.spawned = 1; C.foes.push(makeFoe("crab", f.x - 30, f.y + 10, 9), makeFoe("crab", f.x + 30, f.y + 10, 9)); }
  } else if (f.kind === "prism") {
    f.ph += dt * 0.8; foeMove(f, Math.cos(f.t * 0.7) * 14 * dt, Math.sin(f.t * 0.9) * 10 * dt);
    if (f.stT <= 0) { const n = f.hp <= f.max / 2 ? 12 : 8; for (let k = 0; k < n; k++) caveShot(f.x, f.y, f.ph + k * 6.283 / n, 55, "#e6d2ff"); f.stT = 2.0; f.tp = (f.tp || 0) + 1; play("tick"); }
    if (f.tp >= 3) { f.tp = 0; for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = 60 + Math.random() * 50, nx = px + Math.cos(a) * r, ny = py + Math.sin(a) * r; if (caveFree(nx, ny, f.r * 0.6)) { f.x = nx; f.y = ny; break; } } f.hit = 0.3; }
  } else if (f.kind === "frost") {
    if (f.st === "idle" || f.st === "under") { if (f.st === "idle") { f.st = "under"; f.stT = 1.6; } if (f.stT < 1.0 && !f.warn) { f.warn = [px, py]; } if (f.stT <= 0) { const [wx, wy] = f.warn || [px, py]; f.x = wx; f.y = wy; f.warn = null; f.st = "up"; f.stT = 2.6; f.shots = 0; if (Math.hypot(px - wx, py - wy) < 22) caveHurt(1, wx, wy); play("thunder"); } }
    else if (f.st === "up") { if (f.stT < 2.2 - f.shots * 0.7 && f.shots < 3) { f.shots++; for (const k of [-0.25, 0, 0.25]) caveShot(f.x, f.y, ang + k, 75, "#e6faff"); } if (f.stT <= 0) { f.st = "under"; f.stT = 1.6; } }
  } else if (f.kind === "cinder") {
    if (f.st === "idle") { if (f.stT <= 0) { f.st = "air"; f.stT = 0.7; f.ax = dx / d; f.ay = dy / d; f.hop = Math.min(80, d); } }
    else if (f.st === "air") { foeMove(f, f.ax * f.hop / 0.7 * dt, f.ay * f.hop / 0.7 * dt); if (f.stT <= 0) { f.st = "idle"; f.stT = 0.9; C.haz.push({ ring: 0, x: f.x, y: f.y, max: 80, sp: 140, col: "#ff8c32" }, { pool: 5, x: f.x + (Math.random() - 0.5) * 20, y: f.y + 6, r: 13 }); play("thunder"); } }
  } else if (f.kind === "dreamer") {
    const fast = f.hp <= f.max / 2 ? 1.4 : 1, cyc = (f.t * fast) % 3.4;
    f.eye = cyc > 1.8 ? Math.min(1, (cyc - 1.8) * 4) * Math.min(1, (3.4 - cyc) * 4) : 0;
    if (f.stT <= 0) { for (let k = 0; k < 10; k++) caveShot(f.x, f.y, f.t + k * 0.628, 50, "#d28cff"); if (fast > 1) for (const k of [-0.2, 0, 0.2]) caveShot(f.x, f.y, ang + k, 70, "#ff6e8c"); f.stT = 2.6 / fast; play("tick"); }
    f.spawnT = (f.spawnT || 6) - dt; if (f.spawnT <= 0 && C.foes.length < 5) { f.spawnT = 6; C.foes.push(makeFoe("moth", f.x + (Math.random() - 0.5) * 60, f.y + 24, 49)); }
  }
  const solid = !(f.kind === "frost" && f.st === "under") && !(f.kind === "cinder" && f.st === "air");
  if (solid && d < f.r + 5) caveHurt(1, f.x, f.y);
}
function caveTick(dt) {
  const I = ISLE, C = I.cave, s = isleSave();
  C.charge = Math.min(1, C.charge + dt / (s.up.pulse ? PULSE_CD2 : PULSE_CD)); C.inv = Math.max(0, C.inv - dt); C.flash = Math.max(0, C.flash - dt);
  if (C.ring !== null) { C.ring += dt * 4; if (C.ring > 1) C.ring = null; }
  const px = I.px, py = I.py - 6;
  for (const h of C.haz) {
    if (h.ring !== undefined) { const prev = h.ring; h.ring += h.sp * dt; const pd = Math.hypot(px - h.x, py - h.y); if (pd > prev - 4 && pd < h.ring + 4 && pd > 10) caveHurt(1, h.x, h.y); h.dead = h.ring > h.max; }
    else { h.pool -= dt; if (Math.hypot(px - h.x, py - h.y) < h.r) caveHurt(1, h.x, h.y); h.dead = h.pool <= 0; }
  }
  C.haz = C.haz.filter(h => !h.dead);
  for (const q of C.shots) { q.x += q.vx * dt; q.y += q.vy * dt; q.t += dt; if (!caveFree(q.x, q.y, 1, true) || q.t > 6) q.dead = true; else if (Math.hypot(q.x - px, q.y - py) < 7) { q.dead = true; caveHurt(1, q.x, q.y); } }
  C.shots = C.shots.filter(q => !q.dead);
  for (const f of C.foes) {
    f.hit = Math.max(0, f.hit - dt);
    if (f.boss) { bossTick(f, dt); continue; }
    const F = CAVE_FOES[f.kind], dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy) || 1;
    f.t += dt;
    if (!f.awake) { if (d < 110) f.awake = true; else continue; }
    if (f.stun > 0) { f.stun -= dt; continue; }
    if (F.kind === "walk") foeMove(f, dx / d * F.sp * dt, dy / d * F.sp * dt);
    else if (F.kind === "bat") { const w = Math.sin(f.t * 5 + f.ph); foeMove(f, (dx / d * F.sp + -dy / d * w * 30) * dt, (dy / d * F.sp + dx / d * w * 30) * dt, true); if (F.shoot) { f.sh = (f.sh === undefined ? F.shoot : f.sh) - dt; if (f.sh <= 0 && d < 140) { f.sh = F.shoot; caveShot(f.x, f.y, Math.atan2(dy, dx), 60, F.glow); } } }
    else if (F.kind === "charge") { if (f.st === 0) { foeMove(f, dx / d * F.sp * dt, dy / d * F.sp * dt); if (d < 90 && f.t > 1.5) { f.st = 1; f.t = 0; f.ax = dx / d; f.ay = dy / d; } } else if (f.st === 1) { if (f.t > 0.6) { f.st = 2; f.t = 0; } } else { foeMove(f, f.ax * 140 * dt, f.ay * 140 * dt); if (f.t > 0.5) { f.st = 0; f.t = 0; } } }
    else if (F.kind === "hop") { if (f.st === 0 && f.t > 1.1) { f.st = 1; f.t = 0; f.ax = dx / d; f.ay = dy / d; } else if (f.st === 1) { foeMove(f, f.ax * 70 * dt, f.ay * 70 * dt); if (f.t > 0.4) { f.st = 0; f.t = 0; } } }
    else if (F.kind === "blink") { if (f.st === 0 && f.t > 2.2) { for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, r = 48 + Math.random() * 22, nx = px + Math.cos(a) * r, ny = py + Math.sin(a) * r; if (caveFree(nx, ny, 4)) { f.x = nx; f.y = ny; break; } } f.st = 1; f.t = 0; } else if (f.st === 1 && f.t > 0.8) { f.st = 2; f.t = 0; f.ax = dx / d; f.ay = dy / d; } else if (f.st === 2) { foeMove(f, f.ax * 120 * dt, f.ay * 120 * dt, true); if (f.t > 0.45) { f.st = 0; f.t = 0; } } }
    if (d < f.r + 4 && !(F.kind === "hop" && f.st === 1)) caveHurt(1, f.x, f.y);
  }
  caveSweep();
  if (C.hp <= 0) caveLeave(true);
}
const _isleUpdate7 = isleUpdate;
isleUpdate = function (dt) {
  _isleUpdate7(dt);
  const I = ISLE;
  if (I && I.cave && I.map && I.map.A.cave && !I.msg && !I.menu && !I.shop && !I.inv && !I.log && !I.card && !I.list && !I.chest && !I.folkUI) caveTick(dt);
};

// ---- drawing the caves
function foeSprite(f) { const F = CAVE_FOES[f.kind], fr = Math.floor(f.t * 6 + f.ph) % 2; return pix("foe_" + f.kind + fr, F.rows[fr], F.pal); }
function drawBoss(f, x, y) {
  const B = BOSSES[f.boss], flash = f.hit > 0 && Math.floor(T * 30) % 2;
  g.save(); g.translate(Math.round(x), Math.round(y));
  const fill = (col, path) => { g.fillStyle = flash ? "#ffffff" : col; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); path(); g.fill(); g.stroke(); };
  const ell = (cx, cy, rx, ry) => () => g.ellipse(cx, cy, rx, ry, 0, 0, 7);
  if (f.kind === "crab") {
    const w = f.st === "wind" ? Math.sin(T * 40) * 1.5 : 0;
    fill("#a8483a", ell(-20 + w, -6, 8, 6)); fill("#a8483a", ell(20 - w, -6, 8, 6)); fill("#c86450", ell(0, 0, 17, 11));
    fill("#fadc5a", ell(-6, -8, 2.5, 2.5)); fill("#fadc5a", ell(6, -8, 2.5, 2.5));
    g.fillStyle = INK; for (const k of [-1, 1]) for (let j = 0; j < 3; j++) g.fillRect(k * (12 + j * 3), 6 + j, 2, 5);
  } else if (f.kind === "prism") {
    g.rotate(f.ph * 0.3);
    fill("#8c6ad2", () => { g.moveTo(0, -18); g.lineTo(13, 0); g.lineTo(0, 18); g.lineTo(-13, 0); g.closePath(); });
    fill("#e6d2ff", () => { g.moveTo(0, -9); g.lineTo(6, 0); g.lineTo(0, 9); g.lineTo(-6, 0); g.closePath(); });
  } else if (f.kind === "frost") {
    if (f.st === "up") { fill("#5a8cb4", ell(0, 4, 15, 9)); fill("#b4dcf0", ell(0, -4, 12, 11)); fill(INK, ell(-5, -7, 2, 2)); fill(INK, ell(5, -7, 2, 2)); g.fillStyle = "#ffffff"; for (let k = -2; k <= 2; k++) g.fillRect(k * 3 - 1, 2, 2, 4); }
    else { g.globalAlpha = 0.5; fill("#3c5a78", ell(0, 6, 12, 4)); g.globalAlpha = 1; }
  } else if (f.kind === "cinder") {
    const lift = f.st === "air" ? Math.sin((1 - f.stT / 0.7) * Math.PI) * 26 : 0;
    g.globalAlpha = 0.3; g.fillStyle = "#000"; g.beginPath(); g.ellipse(0, 8, 15, 4, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    g.translate(0, -lift); fill("#a03c28", ell(0, 0, 17, 12)); fill("#ffbe3c", ell(0, 3, 10, 6)); fill("#ffd246", ell(-7, -9, 3, 3)); fill("#ffd246", ell(7, -9, 3, 3));
    g.fillStyle = flash ? "#fff" : "#3c3c46"; g.fillRect(-8, -16, 16, 4); for (let k = 0; k < 3; k++) g.fillRect(-8 + k * 7, -19, 2, 3);
  } else if (f.kind === "dreamer") {
    fill("#2c1a3c", ell(0, 0, 22, 18)); fill("#4a2c5a", ell(0, -2, 16, 12));
    for (const [ex, ey] of [[-9, -3], [9, -3], [0, 6]]) { const o = f.eye; if (o > 0.05) { fill("#f0e6ff", ell(ex, ey, 4, 3 * o)); g.fillStyle = "#e64a5a"; g.fillRect(ex - 1, ey - 1, 2, 2); } else { g.fillStyle = "#8c5ab4"; g.fillRect(ex - 4, ey, 8, 1); } }
  }
  g.restore();
  void B;
}
const _placedSprites7 = placedSprites;
placedSprites = function (list) {
  _placedSprites7(list);
  const C = ISLE.cave;
  if (!C || !ISLE.map.A.cave) return;
  for (const f of C.foes) list.push([f.y + 4, { draw(cx, cy) {
    const x = f.x - cx, y = f.y - cy;
    if (x < -40 || x > IW + 40 || y < -40 || y > IH + 40) return;
    if (f.boss) { drawBoss(f, x, y); return; }
    g.globalAlpha = 0.25; g.fillStyle = "#000"; g.beginPath(); g.ellipse(Math.round(x), Math.round(y + 4), f.r, 2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    if (f.hit > 0 && Math.floor(T * 30) % 2) return;
    const c = foeSprite(f), fly = CAVE_FOES[f.kind].kind === "bat" ? -6 + Math.sin(T * 4 + f.ph) * 2 : CAVE_FOES[f.kind].kind === "hop" && f.st === 1 ? -Math.sin(f.t / 0.4 * Math.PI) * 8 : 0;
    if (CAVE_FOES[f.kind].kind === "charge" && f.st === 1 && Math.floor(T * 20) % 2) return;
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height + 4 + fly));
  } }]);
};
let CAVE_DARK = null;
function caveDark(cx, cy) {
  const I = ISLE, C = I.cave, s = isleSave();
  if (!CAVE_DARK || CAVE_DARK.width !== IW || CAVE_DARK.height !== IH) { CAVE_DARK = document.createElement("canvas"); CAVE_DARK.width = IW; CAVE_DARK.height = IH; }
  const x = CAVE_DARK.getContext("2d"), R = s.up.lantern ? 112 : 82, flick = Math.sin(T * 9) * 2 + Math.sin(T * 23);
  x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, IW, IH); x.fillStyle = "rgba(4, 3, 10, 0.9)"; x.fillRect(0, 0, IW, IH);
  x.globalCompositeOperation = "destination-out";
  const hole = (hx, hy, r, a) => { const gr = x.createRadialGradient(hx, hy, 0, hx, hy, r); gr.addColorStop(0, "rgba(0,0,0," + a + ")"); gr.addColorStop(0.6, "rgba(0,0,0," + a * 0.75 + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.beginPath(); x.arc(hx, hy, r, 0, 7); x.fill(); };
  hole(I.px - cx, I.py - 10 - cy, R + flick, 1);
  if (C) {
    for (const f of C.foes) { const gl = f.boss ? (f.kind === "frost" && f.st === "under" ? 0 : 54) : CAVE_FOES[f.kind].glow ? 22 : 0; if (gl) hole(f.x - cx, f.y - cy, gl, 0.8); }
    for (const q of C.shots) hole(q.x - cx, q.y - cy, 10, 0.9);
    for (const h of C.haz) if (h.pool) hole(h.x - cx, h.y - cy, 22, 0.8);
  }
  for (const o of I.map.objs) if (o.k.startsWith("cgem") || o.k === "cdown" || o.k === "cup") hole(o.x + 8 - cx, o.y + 8 - cy, o.k.startsWith("cgem") ? 16 : 20, 0.55);
  g.drawImage(CAVE_DARK, 0, 0);
  if (C) {                                                             // things that glow, drawn over the dark
    for (const h of C.haz) {
      if (h.pool) { g.globalAlpha = Math.min(0.8, h.pool); g.fillStyle = "#ff6e28"; g.beginPath(); g.ellipse(h.x - cx, h.y - cy, h.r, h.r * 0.6, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
      else { g.globalAlpha = 0.8; g.strokeStyle = h.col; g.lineWidth = 2; g.beginPath(); g.arc(h.x - cx, h.y - cy, h.ring, 0, 7); g.stroke(); g.globalAlpha = 1; }
    }
    for (const q of C.shots) disc(q.col, q.x - cx, q.y - cy, 2);
    for (const f of C.foes) if (f.boss && f.kind === "frost" && f.warn) { g.globalAlpha = 0.5 + 0.3 * Math.sin(T * 20); g.strokeStyle = "#e6faff"; g.lineWidth = 1; g.beginPath(); g.arc(f.warn[0] - cx, f.warn[1] - cy, 22, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (C.ring !== null) { const reach = s.up.pulse ? PULSE_R2 : PULSE_R; g.globalAlpha = 1 - C.ring; g.strokeStyle = CYAN; g.lineWidth = 2; g.beginPath(); g.arc(I.px - cx, I.py - 6 - cy, reach * C.ring, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (C.flash > 0) { g.globalAlpha = C.flash * 1.6; rect("#c81e32", 0, 0, IW, IH); g.globalAlpha = 1; }
  }
}
function pulseBtn() { return [IW - 42, IH - 52, 38, 26]; }
const _drawIsleHud7 = drawIsleHud;
drawIsleHud = function (s) {
  _drawIsleHud7(s);
  const C = ISLE.cave;
  if (!C || !ISLE.map.A.cave) return;
  for (let k = 0; k < s.cave.hpMax; k++) g.drawImage(heartIcon(k < C.hp), 24 + k * 7, 8);
  text("FLOOR " + C.n, 24, 22, 1, "#d2c8e6", "left", null);
  const b = C.foes.find(f => f.boss);
  if (b) { const w = Math.min(160, IW - 150), x = Math.round((IW - w) / 2); text(BOSSES[b.boss].name, IW / 2, 8, 1, WHITE, "center", null); rect(INK, x - 1, 13, w + 2, 6); rect("#5a2c3c", x, 14, w, 4); rect("#e64a5a", x, 14, Math.round(w * b.hp / b.max), 4); }
  const [bx, by, bw, bh] = pulseBtn(), ready = C.charge >= 1;
  islePanel(bx, by, bw, bh); text("PULSE", bx + bw / 2, by + 9, 1, ready ? "#2c8ca0" : "#a08c78", "center", null);
  rect("#d2c0a0", bx + 5, by + 17, bw - 10, 4); rect(ready ? CYAN : "#78b4c8", bx + 5, by + 17, Math.round((bw - 10) * C.charge), 4);
};
const _isleKey7 = isleKey;
isleKey = function (e, down) {
  if (ISLE && down && ISLE.cave && ["KeyX", "ShiftLeft", "ShiftRight"].includes(e.code) && !ISLE.msg && !ISLE.menu && !ISLE.list && !ISLE.inv && !ISLE.chest) { e.preventDefault(); cavePulse(); return; }
  _isleKey7(e, down);
};
const _isleTouch7 = isleTouch;
isleTouch = function (e) {
  if (ISLE && ISLE.cave && ISLE.map.A.cave && !ISLE.msg && !ISLE.menu && !ISLE.list && !ISLE.inv && !ISLE.chest && !ISLE.folkUI) {
    const [x, y] = islePos(e), [bx, by, bw, bh] = pulseBtn();
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) { cavePulse(); return; }
  }
  _isleTouch7(e);
};

// =====================================================================================================================
// Part 8a: the last of the map. Shipwreck Beach (west of the Woods: the old wreck, salvage to dig up with the hoe every day,
// rarer finds while a storm is blowing out at sea), Mangrove Marsh (east of the Lagoon: marsh fish, boardwalks, and Silas the
// hermit), the dock skiff (restore it for boat trips round the island) and Gull Rock, an islet you can only reach by boat.
Object.assign(ITEMS, { scrap: { name: "SHIP SCRAP", kind: "mat", sell: 8 }, oldcoin: { name: "OLD COIN", kind: "forage", sell: 120 }, spyglass: { name: "BRASS SPYGLASS", kind: "forage", sell: 400 } });
AREAS.wreck = {                                                // a long beach, sea along the bottom
  name: "SHIPWRECK BEACH", w: 90, h: 35, outdoor: true,
  grass: x => 150 + 18 * Math.sin(x / 110) + 8 * Math.sin(x / 41 + 2),
  shore: x => 410 + 16 * Math.sin(x / 150 + 1) + 7 * Math.sin(x / 47),
  paths: [[[1450, 200], [1100, 214], [700, 196], [300, 206], [40, 190]]],
  exits: [{ side: "e", a: 160, b: 240, to: "woods", x: 14, y: 420 }],
};
AREAS.woods.exits.push({ side: "w", a: 380, b: 460, to: "wreck", x: 1426, y: 200 });
AREAS.marsh = {                                                 // pools and channels between the mangroves
  name: "MANGROVE MARSH", w: 60, h: 50, outdoor: true, fresh: true, forest: true, marsh: true,
  lakes: [[300, 250, 120, 70], [640, 520, 150, 90], [220, 620, 90, 60], [470, 380, 60, 40]],
  river: [[[0, 470], [180, 470], [330, 420], [470, 380]], [[470, 380], [560, 460], [640, 520]], [[640, 520], [760, 700], [820, 820]]], riverW: 14,
  paths: [[[-10, 400], [120, 380], [260, 360], [420, 300], [600, 300], [740, 300], [780, 160]], [[420, 300], [440, 520], [400, 700]]],
  dock: [[452, 352, 24, 76], [130, 456, 40, 30], [736, 292, 24, 34]],
  exits: [{ side: "w", a: 360, b: 440, to: "lagoon", x: 1106, y: 600 }],
};
AREAS.lagoon.exits.push({ side: "e", a: 560, b: 640, to: "marsh", x: 14, y: 400 });
AREAS.gull = {                                                  // a rocky islet out past the Port
  name: "GULL ROCK", w: 30, h: 30, outdoor: true,
  seaD: (x, y) => { const e = Math.sqrt(((x - 240) / 170) ** 2 + ((y - 230) / 150) ** 2); return (e - 1) * 160 + 8 * Math.sin(x / 23) + 6 * Math.sin(y / 17); },
  paths: [[[240, 400], [240, 300], [200, 240]]],
  dock: [[226, 360, 28, 100]], exits: [],
};
Object.assign(RESTORE, { dock: { name: "THE SKIFF", ruin: "A LITTLE SKIFF, HALF FULL OF RAINWATER. THE HULL NEEDS PATCHING AND THE MAST IS GONE.", need: [["wood", 150], ["fiber", 40], ["scrap", 20]], sd: 1500, done: "THE SKIFF IS SEAWORTHY. TAKE IT ROUND THE ISLAND, OR OUT TO GULL ROCK." } });
SPOTS.hut = ["marsh", 760, 196]; SPOTS.marshpier = ["marsh", 464, 400];
function artWreck() {
  const P = paintCanvas(150, 80), H = "#6e4a30", D = "#4a3020", L = "#8c6440";
  P.shadow(74, 72, 70, 5);
  for (let i = 0; i < 140; i++) { const top = 34 + Math.round(10 * Math.sin(i / 140 * Math.PI) * -1 + (i > 100 ? (i - 100) * 0.5 : 0)), bot = 70 - Math.round(Math.abs(i - 70) / 70 * 18); for (let j = top; j < bot; j++) P.px(5 + i, j, j === top ? INK : (Math.floor(j / 5) + (i > 60 && i < 66 ? 1 : 0)) % 2 ? H : L); P.px(5 + i, bot, INK); }
  for (let k = 0; k < 6; k++) P.rect(30 + k * 18, 30 - (k % 2) * 4, 3, 40 - (k % 3) * 8, D);
  P.rect(70, 4, 4, 34, D); P.rect(60, 10, 26, 3, D); P.rect(72, 2, 1, 2, INK);
  for (let k = 0; k < 4; k++) P.rect(40 + k * 22, 50, 8, 6, INK);
  return P.c;
}
function artMangrove() {
  const P = paintCanvas(34, 44);
  P.shadow(16, 40, 14, 3);
  for (const [a, b] of [[4, 0], [10, 1], [20, -1], [27, 0]]) for (let j = 0; j < 12; j++) P.px(a + Math.round(Math.sin(j / 3) * 1) + (b * j >> 2), 30 + j, j % 4 === 3 ? "#4a3a28" : "#6e5a3c");
  P.rect(14, 18, 6, 14, "#6e5a3c"); P.rect(14, 18, 1, 14, "#4a3a28");
  for (let j = 0; j < 22; j++) for (let i = 0; i < 34; i++) { const dx = (i - 17) / 17, dy = (j - 11) / 11; if (dx * dx + dy * dy < 1) P.px(i, j, (i * 3 + j * 5) % 7 === 0 ? "#5a8a46" : (i + j) % 5 === 0 ? "#2c5a2c" : "#3c6e38"); }
  return P.c;
}
function artHut() {
  const P = paintCanvas(56, 50);
  P.shadow(27, 46, 26, 3);
  for (const x of [6, 22, 34, 48]) P.rect(x, 34, 3, 14, "#4a3a28");
  P.rect(2, 30, 52, 5, "#8c6440"); P.rect(2, 30, 52, 1, INK);
  P.rect(8, 16, 40, 15, "#a07a50"); for (let k = 0; k < 4; k++) P.rect(8, 18 + k * 4, 40, 1, "#7a5a3a");
  for (let j = 0; j < 14; j++) P.rect(4 + j, 16 - j, 48 - j * 2, 1, j % 3 ? "#b4a060" : "#96844a");
  P.rect(24, 21, 9, 10, "#3c2c22"); P.rect(38, 20, 6, 5, "#ffd28c"); P.rect(12, 20, 6, 5, "#ffd28c");
  return P.c;
}
function artGullRock() {
  const P = paintCanvas(90, 70);
  P.shadow(44, 64, 42, 4);
  for (let j = 0; j < 60; j++) for (let i = 0; i < 90; i++) { const dx = (i - 45) / 44, dy = (j - 60) / 58; if (dx * dx + dy * dy < 1 && j > 4 + Math.abs(i - 42) * 0.6) P.px(i, j + 2, (Math.floor(i / 7) + Math.floor(j / 5)) % 3 === 0 ? "#8c8a96" : j < 20 && (i * 7 + j) % 9 === 0 ? "#f0f0f4" : "#a8a6b0"); }
  for (const [a, b] of [[30, 20], [52, 14], [60, 30], [24, 38]]) P.rect(a, b, 4, 2, "#f6f6fa");
  return P.c;
}
function artNest() { const P = paintCanvas(16, 10); P.rows(["..bbbbbbbb..", ".bbwwbbwwbb.", "bbbbbbbbbbbb", ".bbbbbbbbbb."], { b: "#a08050", w: "#f0ece0" }, 2, 3, true); return P.c; }
function artGull() { const P = paintCanvas(12, 8); P.rows(["..ww....", ".wwwwo..", "wwggww..", "..ww...."], { w: "#f6f6fa", g: "#9aa0b4", o: "#ffa046" }, 1, 2, true); return P.c; }
function artSkiff(fixed) {
  const P = paintCanvas(40, 22);
  for (let i = 0; i < 36; i++) { const d = Math.round(Math.abs(i - 18) / 18 * 5); P.rect(2 + i, 10 + d, 1, 9 - d * 1.4, fixed ? "#b47e4a" : "#7a5a3a"); P.px(2 + i, 10 + d, INK); }
  if (fixed) { P.rect(19, 0, 2, 12, "#6e482a"); for (let j = 0; j < 9; j++) P.rect(21, 1 + j, 9 - j, 1, "#f0ecdc"); }
  else { P.rect(10, 13, 20, 3, "#4a7894"); P.rect(14, 11, 3, 2, "#5a4a3a"); }
  return P.c;
}
function areaArt8() {
  if (IART.wreck) return;
  Object.assign(IART, { wreck: artWreck(), mangrove: artMangrove(), hut: artHut(), gullrock: artGullRock(), nest: artNest(), gull: artGull(), skiff: artSkiff(false), skiff_r: artSkiff(true),
    swreck: artSign("SHIPWRECK BEACH"), smarsh: artSign("MANGROVE MARSH"), sgull: artSign("GULL ROCK") });
}
const _isleArt8 = isleArt; isleArt = function () { _isleArt8(); areaArt8(); };
function wreckObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act }), A = AREAS.wreck, r = seeded(812);
  add("wreck", 640, 236, [6, 50, 138, 22], { kind: "say", text: ["THE WRECK OF A BIG SAILING SHIP, HALF SUNK IN THE SAND. THE NAME ON THE BOW HAS WORN AWAY TO '...ANT'.", "THINGS STILL WASH OUT OF HER. TRY DIGGING WHERE THE SAND LOOKS DISTURBED."] });
  add("swreck", 1360, 160, [24, 10, 6, 8], { kind: "say", text: ["SHIPWRECK BEACH. LOOK FOR DISTURBED SAND AND DIG WITH YOUR HOE. MORE WASHES UP WHEN THERE'S A STORM OUT AT SEA."] });
  const clear = (x, y, w, h) => !o.some(q => x + w > q.x - 6 && x < q.x + IART[q.k].width + 6 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 18 && y + h < A.grass(x) - 4;
  for (let i = 0; i < 300; i++) { const x = r.uniform(-10, 1430), y = r.uniform(-30, 150), palm = r.random() < 0.6, [w, h] = palm ? [28, 42] : [16, 12]; if (clear(x, y, w, h)) { if (palm) add("palm", x, y, [10, 30, 8, 6]); else add("bush", x, y, [3, 6, 10, 4]); } }
  for (let i = 0; i < 40; i++) { const x = r.uniform(0, 1420), y = r.uniform(A.grass(x) + 14, A.shore(x) - 20); if (!o.some(q => Math.abs(q.x - x) < 40 && Math.abs(q.y - y) < 30)) add("rock", x, y, [1, 3, 8, 4]); }
  for (let i = 0; i < 12; i++) { const x = r.uniform(0, 1400), y = r.uniform(A.grass(x) + 20, A.shore(x) - 30); if (!o.some(q => Math.abs(q.x - x) < 60 && Math.abs(q.y - y) < 40)) add("log", x, y, [2, 2, 22, 5]); }
  return o;
}
function marshObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act }), A = AREAS.marsh, r = seeded(633);
  add("hut", 732, 150, [2, 30, 52, 16], { kind: "say", text: ["A HUT ON STILTS. SMOKE COMES FROM THE CHIMNEY. A SIGN ON THE DOOR SAYS: GO AWAY (POLITELY)."] });
  add("smarsh", 60, 330, [24, 10, 6, 8], { kind: "say", text: ["MANGROVE MARSH. KEEP TO THE BOARDWALKS."] });
  const clear = (x, y, w, h) => !o.some(q => x + w > q.x - 4 && x < q.x + IART[q.k].width + 4 && y + h > q.y - 4 && y < q.y + IART[q.k].height + 4) && pathDist(A, x + w / 2, y + h - 4) > 16 && freshDepth(A, x + w / 2, y + h - 2) < -8 && !inDock(A, x + w / 2, y + h);
  for (let i = 0; i < 700; i++) { const x = r.uniform(-12, 950), y = r.uniform(-30, 780); if (clear(x, y + 30, 34, 14)) add("mangrove", x, y, [12, 30, 10, 8]); }
  for (let i = 0; i < 260; i++) { const x = r.uniform(0, 960), y = r.uniform(0, 800), d = freshDepth(A, x, y + 14); if (d > -7 && d < -1 && !inDock(A, x, y + 14)) add("reed", x - 4, y, null); }
  for (let i = 0; i < 500 && o.filter(q => q.k === "lily").length < 30; i++) { const x = r.uniform(0, 960), y = r.uniform(0, 800); if (freshDepth(A, x, y) > 6 && freshDepth(A, x, y) < 24) add("lily", x - 5, y - 3, null); }
  return o;
}
function gullObjects() {
  const o = [], add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act });
  add("gullrock", 160, 120, [8, 40, 74, 26], { kind: "say", text: ["GULL ROCK. THOUSANDS OF GULLS, AND THE SMELL TO PROVE IT.", "THE OLD FISHERMEN SAY SOMETHING AS BIG AS A ROWBOAT LIVES IN THE DEEP WATER UNDER IT."] });
  add("skiff_r", 236, 452, [2, 10, 36, 10], { kind: "boat" });
  add("sgull", 270, 330, [24, 10, 6, 8], { kind: "say", text: ["GULL ROCK. NO SWIMMING. THE GULLS WILL JUDGE YOU."] });
  [[120, 250], [320, 200], [300, 300], [150, 320]].forEach(([x, y], i) => add("nest", x, y, [1, 4, 14, 5], { kind: "nest", i }));
  add("rock", 360, 260, [1, 3, 8, 4], { kind: "secret" });
  for (const [x, y] of [[100, 200], [330, 160], [380, 300], [110, 340], [200, 360]]) add("gull", x, y, null);
  return o;
}
const _buildArea8 = buildArea;
buildArea = function (id) {
  const m = _buildArea8(id);
  if (id === "wreck") m.objs = wreckObjects();
  if (id === "marsh") m.objs = marshObjects();
  if (id === "gull") m.objs = gullObjects();
  if (id === "woods" || id === "lagoon") m.objs = m.objs.filter(o => o.k !== "pile");     // the last driftwood piles are cleared
  if (id === "port") m.objs.push({ k: "skiff", x: 600, y: 760, solid: [2, 10, 36, 10], act: { kind: "restore", b: "dock" } });
  if (["wreck", "gull"].includes(id)) m.objs.forEach((o, i) => { if (o.k === "rock" && !o.act) o.res = { kind: "rock", key: id + ":" + i }; });
  return m;
};
// ---- boat trips
const BOAT_STOPS = [["port", "THE PORT", 620, 740], ["gull", "GULL ROCK", 240, 440], ["wreck", "SHIPWRECK BEACH", 700, 380], ["point", "LIGHTHOUSE POINT", 400, 560], ["marsh", "MANGROVE MARSH", 120, 400]];
function boatAct() { ISLE.list = { kind: "boat", sel: 0, top: 0 }; play("select"); }
const _listRows8 = listRows;
listRows = function () {
  if (ISLE.list.kind === "boat") return BOAT_STOPS.filter(b => b[0] !== ISLE.map.id).map(([id, name, x, y]) => ({ icon: "pot", name, info: id === "gull" ? "THE ROCK OUT PAST THE HARBOUR. ONLY THE SKIFF GOES THERE." : "SAIL ROUND TO " + name + ".", ok: true, act: () => { ISLE.list = null; isleGo(id, x, y, "up"); play("plop"); if (id === "marsh") marshSeen(); } }));
  return _listRows8();
};
LIST_TITLE.boat = "THE SKIFF: WHERE TO?";
const _listPick8 = listPick;
listPick = function () { if (ISLE.list && ISLE.list.kind === "boat") { const r = listRows()[ISLE.list.sel]; if (r) r.act(); return; } _listPick8(); };
const _restoredAct8 = restoredAct;
restoredAct = function (b) { if (b === "dock") boatAct(); else _restoredAct8(b); };
// ---- digging on the beach, the nests, the secret, the hermit
function digSpots() {
  const s = isleSave(), day = DAYN(s);
  if (!s.digs || s.digs.day !== day) {
    const r = seeded(day * 13 + 7), A = AREAS.wreck, list = [];
    for (let k = 0, t = 0; k < 6 && t < 300; t++) { const x = r.uniform(40, 1400), y = r.uniform(A.grass(x) + 24, A.shore(x) - 10); if (terrainAt(A, x, y) === "s" && !list.some(q => Math.abs(q[0] - x) < 50)) { list.push([Math.round(x), Math.round(y), 0]); k++; } }
    s.digs = { day, list };
  }
  return s.digs.list;
}
function digAt(tx, ty) { return ISLE.map.id === "wreck" ? digSpots().find(d => !d[2] && Math.floor(d[0] / TS) === tx && Math.floor(d[1] / TS) === ty) : null; }
function digUp(d) {
  const storm = typeof stormNow === "function" && stormNow(), q = Math.random();
  const id = storm && q < 0.25 ? "spyglass" : q < (storm ? 0.45 : 0.12) ? "oldcoin" : q < 0.35 ? "glass" : q < 0.42 ? "pearl" : "scrap", n = id === "scrap" ? 2 + Math.floor(Math.random() * 3) : 1;
  if (invAdd(id, n)) { toast("YOUR BAG IS FULL"); return; }
  d[2] = 1; toast("+" + n + " " + ITEMS[id].name + (storm ? " (STORM SALVAGE!)" : ""), id === "scrap" ? "#d2b482" : GOLD); play(id === "scrap" ? "hit" : "chime"); splashDust(Math.floor(d[0] / TS), Math.floor(d[1] / TS), "#e6d2a0");
}
function marshSeen() { const s = isleSave(); if (!s.flags.marsh) { s.flags.marsh = 1; s.arrived.silas = DAYN(s); folkInit(); } }
const _isleGo8 = isleGo;
isleGo = function (id, x, y, dir) { _isleGo8(id, x, y, dir); if (id === "marsh") marshSeen(); };
const _isleAct58 = isleAct5;
isleAct5 = function (o) {
  const a = o.act, s = isleSave();
  if (a.kind === "boat") boatAct();
  else if (a.kind === "nest") { const k = "nest" + a.i + ":" + DAYN(s); if (s.cut[k]) { isleSay(["AN EMPTY GULL NEST. A GULL GLARES AT YOU FROM THE ROCK."]); return; } s.cut[k] = DAYN(s) + 1; const id = Math.random() < 0.15 ? "pearl" : Math.random() < 0.5 ? "glass" : "shell"; if (invAdd(id, 1) === 0) toast("+1 " + ITEMS[id].name + " (FROM A GULL NEST)", GOLD); play("tick"); }
  else if (a.kind === "secret") { if (s.flags.gullsecret) { isleSay(["JUST A ROCK NOW."]); return; } s.flags.gullsecret = 1; s.sd += 1000; if (invAdd("oldcoin", 3)) s.owed.push(["oldcoin", 3]); isleSay(["UNDER THE ROCK: A TIN BOX, RUSTED SHUT. YOU PRY IT OPEN.", "OLD COINS, A WAD OF SAND DOLLARS, AND A NOTE: 'FOR WHOEVER GETS THIS FAR. THE GROUPER IS REAL. I NEVER LANDED HER. - THE KEEPER'", "YOU GOT 1000 SAND DOLLARS AND 3 OLD COINS."]); play("fanfare"); saveStore(); }
  else _isleAct58(o);
};
const _isleInteract8 = isleInteract;
isleInteract = function () {
  const I = ISLE, it = held();
  if (I.map && I.map.id === "wreck" && !I.msg && !I.menu && !I.list && !I.inv && !I.chest && !I.shop && !I.card && !I.log && !I.fish && it && it[0] === "hoe") {
    const [tx, ty] = facingTile(), d = digAt(tx, ty) || digAt(Math.floor(I.px / TS), Math.floor((I.py - 3) / TS)); if (d) { digUp(d); return; }
  }
  _isleInteract8();
};
const _placedSprites8 = placedSprites;
placedSprites = function (list) {
  _placedSprites8(list);
  if (ISLE.map.id === "wreck") for (const d of digSpots()) if (!d[2]) list.push([d[1] - 8, { draw(cx, cy) { const x = d[0] - cx, y = d[1] - cy; if (x < -8 || x > IW + 8 || y < -8 || y > IH + 8) return; g.fillStyle = "#b49a6e"; for (let k = -3; k <= 3; k++) { g.fillRect(x + k - 1, y + k - 1, 2, 2); g.fillRect(x + k - 1, y - k - 1, 2, 2); } } }]);
};
// ---- fish: the marsh has its own, plus lagoon fish; the wreck and Gull Rock hide a legend each
const _pickFish8 = pickFish;
pickFish = function (where, s) {
  if (where === "marsh" && Math.random() < 0.4) return _pickFish8("lake", s);
  const id = ISLE && ISLE.map && ISLE.map.id, legend = id === "wreck" ? "wreck" : id === "gull" ? "gull" : null;
  if (legend && (where === "sea" || where === "deep") && Math.random() < 0.07) { const sp = _pickFish8(legend, s); if (sp) return sp; }
  return _pickFish8(where, s);
};
// ---- beach finds on the new beaches
const _forageCheck8 = forageCheck;
forageCheck = function () {
  const s = isleSave(), was = s.forage && s.forage.day;
  _forageCheck8();
  if (s.forage.day === was) return;
  const r = seeded(s.forage.day * 5 + 1);
  for (const [id, n] of [["wreck", 5], ["gull", 3]]) { const A = AREAS[id]; for (let k = 0, t = 0; k < n && t < 300; t++) { const x = r.uniform(20, A.w * TS - 20), y = r.uniform(20, A.h * TS - 20); if (terrainAt(A, x, y) !== "s") continue; const v = r.random(); s.forage.items.push([id, Math.round(x), Math.round(y), v < 0.4 ? "shell" : v < 0.65 ? "drift" : v < 0.85 ? "glass" : v < 0.96 ? "starfish" : "pearl"]); k++; } }
};
const _isleSave8 = isleSave;
isleSave = function () { const g_ = _isleSave8(); if (!g_.p8) { g_.p8 = 1; if (g_.intro) g_.areasMsg = 1; } return g_; };
const _startIsland8 = startIsland;
startIsland = function () {
  _startIsland8();
  const s = isleSave();
  if (s.areasMsg) { s.areasMsg = 0; ISLE.msg.pages.push("THE SHIPWRIGHT CLEARED THE LAST DRIFTWOOD PILES: SHIPWRECK BEACH, WEST OF THE WOODS, AND MANGROVE MARSH, EAST OF THE LAGOON.", "BRAM: 'THAT OLD SKIFF AT THE END OF THE DOCK COULD BE PATCHED UP. THEN YOU COULD GET OUT TO GULL ROCK.'"); }
};
const _itemIcon8 = itemIcon;
itemIcon = function (id) {
  if (id === "scrap") return pix("icon_scrap", ["ss..", "sbss", ".sbs", "..ss"], { s: "#8c8c96", b: "#a0643c" });
  if (id === "oldcoin") return pix("icon_oldcoin", [".yy.", "ybby", "ybby", ".yy."], { y: "#ffd246", b: "#c8a032" });
  if (id === "spyglass") return pix("icon_spyglass", ["....yy", "...yby", "..yy..", ".yy...", "bb...."], { y: "#d2a03c", b: "#6e482a" });
  return _itemIcon8(id);
};

// =====================================================================================================================
// Part 8b: festivals. Eight, two a season. On the day the villagers gather, the place is decorated, and a booth runs the
// event: a show, a kite contest, a fishing derby, lanterns on the sea, a salvage dig, a potluck, ice fishing and a gift
// exchange. Ribbons pay sand dollars; gold also wins that festival's decoration. Festival fish only bite on their day.
// [id, name, season, day, start, end, place, what you do, fish key]
const FESTS = [
  { id: "fair", name: "THE TIDE FAIR", season: 0, day: 13, start: 540, end: 960, at: ["port", 520, 474], kind: "show", prize: "f_ribbon", col: "#4a8cdc",
    intro: "THE TIDE FAIR! STALLS ALL ROUND THE SQUARE, AND A JUDGE FOR THE BEST THING GROWN, CAUGHT OR FOUND ON THE ISLAND.", how: "SHOW THE JUDGE ONE THING FROM YOUR BAG: HOLD IT AND TALK TO THE BOOTH. THE BETTER IT IS, THE BETTER THE RIBBON." },
  { id: "kite", name: "KITE DAY", season: 0, day: 24, start: 600, end: 960, at: ["flats", 760, 520], kind: "kite", prize: "f_kite", col: "#f05050",
    intro: "KITE DAY! THE WHOLE TOWN IS ON THE BEACH WITH KITES.", how: "HOLD E TO PULL THE KITE UP, LET GO TO LET IT DRIFT DOWN. KEEP IT IN THE WIND (THE BRIGHT BAND) FOR 20 SECONDS." },
  { id: "derby", name: "THE FISHING DERBY", season: 1, day: 11, start: 540, end: 900, at: ["lagoon", 520, 682], kind: "derby", prize: "f_cup", col: "#ffbe3c", fish: "fest_derby",
    intro: "THE FISHING DERBY! THE BIGGEST TOTAL CATCH IN 90 SECONDS WINS. DERBY CARP ARE IN THE LAGOON TODAY ONLY.", how: "90 SECONDS. EVERY INCH OF FISH YOU LAND COUNTS." },
  { id: "lantern", name: "LANTERN NIGHT", season: 1, day: 25, start: 1080, end: 1440, at: ["port", 600, 646], kind: "lantern", prize: "f_lantern", col: "#ffa046", fish: "fest_lantern",
    intro: "LANTERN NIGHT. EVERYONE SENDS A PAPER LANTERN OUT ON THE SEA, FOR SOMEONE THEY MISS.", how: "RELEASE YOUR LANTERN AT THE BOOTH. LANTERN FISH COME UP TO SEE THE LIGHTS: FISH THE SEA TONIGHT." },
  { id: "salvage", name: "SALVAGE DAY", season: 2, day: 16, start: 540, end: 960, at: ["wreck", 900, 300], kind: "dig", prize: "f_bell", col: "#a07a50",
    intro: "SALVAGE DAY! THE BIG FALL TIDES HAVE DUG UP THE BEACH. WHO CAN FIND THE MOST IN 60 SECONDS?", how: "60 SECONDS. DIG EVERY X YOU CAN FIND WITH YOUR HOE. YOU KEEP WHAT YOU DIG UP." },
  { id: "supper", name: "THE HARVEST SUPPER", season: 2, day: 27, start: 1020, end: 1320, at: ["innin", 160, 104], alt: ["port", 520, 474], kind: "potluck", prize: "f_basket", col: "#dc8c32",
    intro: "THE HARVEST SUPPER. ONE LONG TABLE, AND EVERYONE BRINGS A DISH.", how: "HOLD A DISH YOU COOKED AND TALK TO THE BOOTH TO ADD IT TO THE TABLE. A GOOD DISH MAKES EVERYONE HAPPY." },
  { id: "ice", name: "ICE FISHING MORNING", season: 3, day: 8, start: 420, end: 720, at: ["lagoon", 520, 682], kind: "icefish", prize: "f_ice", col: "#9ad2ec",
    intro: "ICE FISHING MORNING! THE LAGOON IS FROZEN AT THE EDGES. MOST FISH IN 90 SECONDS WINS.", how: "90 SECONDS. EVERY FISH YOU LAND COUNTS, BIG OR SMALL." },
  { id: "midwinter", name: "THE MIDWINTER FEAST", season: 3, day: 25, start: 600, end: 1080, at: ["innin", 160, 104], alt: ["port", 520, 474], kind: "exchange", prize: "f_tree", col: "#3c9a5a", fish: "fest_midwinter",
    intro: "THE MIDWINTER FEAST! A TREE, A FIRE, AND A SECRET GIFT EXCHANGE. MIDWINTER COD ARE RUNNING IN THE SEA TODAY.", how: "THE BOOTH TELLS YOU WHOSE NAME YOU DREW. GIVE THEM A GIFT TODAY: IT COUNTS FOUR TIMES OVER, AND THEY'LL HAVE ONE FOR YOU." },
];
[["f_ribbon", "BLUE RIBBON", ["bbb", "bwb", "bbb", "b.b"], { b: "#4a8cdc", w: "#ffd246" }, 0], ["f_kite", "PRIZE KITE", ["..r..", ".ryr.", "ryyyr", ".ryr.", "..r..", "...w."], { r: "#f05050", y: "#ffd246", w: "#f0ecdc" }, 0],
 ["f_cup", "DERBY CUP", ["y...y", "yyyyy", ".yyy.", "..y..", ".sss."], { y: "#ffd246", s: "#8c8c96" }, 0], ["f_lantern", "PAPER LANTERN", ["..k..", ".ooo.", "oyyyo", ".ooo."], { k: INK, o: "#ffa046", y: "#ffe68c" }, 1],
 ["f_bell", "SHIP'S BELL", [".kk.", ".yy.", "yyyy", "yyyy", ".kk."], { k: "#6e482a", y: "#d2a03c" }, 0], ["f_basket", "HARVEST BASKET", [".b.b.", "rgoyr", "bbbbb", ".bbb."], { b: "#a07a50", r: "#f05050", g: "#5ac85a", o: "#ff8c32", y: "#ffd246" }, 0],
 ["f_ice", "ICE SCULPTURE", ["..w..", ".www.", "wwbww", ".www.", ".sss."], { w: "#e6faff", b: "#9ad2ec", s: "#8c8c96" }, 0], ["f_tree", "MIDWINTER TREE", ["..y..", ".ggg.", "grggg", "ggggb", "..k.."], { y: "#ffd246", g: "#2c7a46", r: "#f05050", b: "#5aaadc", k: "#6e482a" }, 1],
].forEach(([id, name, rows, pal, light]) => { const row = [id, name, 1, 0, light, rows, pal]; PLACE.push(row); PL[id] = { id, name, solid: 1, flat: 0, light, rows, pal }; ITEMS[id] = { name, kind: "place", sell: 0 }; });
const festOn = s => FESTS.find(f => f.season === s.season && f.day === s.day) || null;
const festPlace = f => (f.alt && isleSave().rest.inn !== "done") ? f.alt : f.at;
const festLive = s => { const f = festOn(s); return f && s.min >= f.start && s.min < f.end ? f : null; };
const festKey = (f, s) => f.id + ":" + s.year;
function laterOpen(f, s) { const F = festOn(s); return !!(F && F.fish && f.where === F.fish && s.min >= F.start - 60 && s.min < F.end + 120); }
// the festival's weather is always kind
const _weatherOf8 = weatherOf;
weatherOf = function (s) { const f = festOn(s); return f ? (s.season === 3 ? "snow" : "sun") : _weatherOf8(s); };
// festival fish
const _pickFish8b = pickFish;
pickFish = function (where, s) {
  const F = festOn(s);
  if (F && F.fish && s.min >= F.start - 60 && s.min < F.end + 120) {
    const fit = (F.fish === "fest_derby" && where === "lake") || (F.fish === "fest_lantern" && (where === "sea" || where === "deep") && s.min >= 1080) || (F.fish === "fest_midwinter" && (where === "sea" || where === "deep"));
    if (fit && Math.random() < 0.3) { const sp = _pickFish8b(F.fish, s); if (sp) return sp; }
  }
  return _pickFish8b(where, s);
};
// villagers come to the festival
const _folkTarget8 = folkTarget;
folkTarget = function (v) {
  const s = isleSave(), f = festLive(s);
  if (!f || v.hermit && f.id !== "lantern") return _folkTarget8(v);
  const [a, x, y] = festPlace(f), k = v.i, ang = k / ISLE_FOLK.length * Math.PI * 2;
  return [a, Math.round(x + Math.cos(ang) * (a === "innin" ? 70 : 60)), Math.round(y + 16 + Math.sin(ang) * (a === "innin" ? 34 : 30))];
};
// news the day before and on the morning
const _newDay58 = newDay5;
newDay5 = function (s) {
  _newDay58(s);
  const t = festOn(s); if (t) { const [a] = festPlace(t); s.news.push("TODAY: " + t.name + "! " + (AREAS[a] ? AREAS[a].name : "") + ", " + clockText(t.start) + " TO " + clockText(t.end) + ".");
    if (t.kind === "exchange") { const pool = folkHere().filter(v => !v.cat); if (pool.length) { const v = pool[seeded(s.year * 77 + 5).randint(0, pool.length - 1)]; s.secret = { y: s.year, id: v.id }; } } }
  const nd = s.day === SEASON_DAYS ? { season: (s.season + 1) % 4, day: 1 } : { season: s.season, day: s.day + 1 }, tm = FESTS.find(f => f.season === nd.season && f.day === nd.day);
  if (tm) s.news.push("TOMORROW: " + tm.name + ".");
};
// the booth
function artBooth(col) {
  const P = paintCanvas(40, 38);
  P.shadow(19, 35, 18, 3);
  P.rect(3, 12, 2, 22, "#6e482a"); P.rect(35, 12, 2, 22, "#6e482a");
  for (let i = 0; i < 40; i++) P.rect(i, 6 + (i % 8 < 4 ? 0 : 1), 1, 8, Math.floor(i / 5) % 2 ? col : "#f0ecdc");
  P.rect(0, 13, 40, 1, INK); P.rect(2, 24, 36, 10, "#a07a50"); P.rect(2, 24, 36, 2, "#c89a64"); P.rect(2, 33, 36, 1, INK);
  return P.c;
}
const _objAt8 = objAt;
objAt = function (x, y) {
  const s = ISLE && isleSave(), f = ISLE && festLive(s);
  if (f) { const [a, bx, by] = festPlace(f); if (ISLE.map.id === a && x >= bx - 20 && x < bx + 20 && y >= by - 30 && y < by + 14) return { k: "booth", x: bx - 20, y: by - 30, solid: [0, 22, 40, 12], act: { kind: "fest" } }; }
  return _objAt8(x, y);
};
const _isleSolidAt8 = isleSolidAt;
isleSolidAt = function (x, y) {
  const s = isleSave(), f = ISLE && festLive(s);
  if (f) { const [a, bx, by] = festPlace(f); if (ISLE.map.id === a && x >= bx - 20 && x < bx + 20 && y >= by - 8 && y < by + 4) return true; }
  return _isleSolidAt8(x, y);
};
const _placedSprites8b = placedSprites;
placedSprites = function (list) {
  _placedSprites8b(list);
  const s = isleSave(), f = festLive(s); if (!f) return;
  const [a, bx, by] = festPlace(f); if (ISLE.map.id !== a) return;
  const key = "booth_" + f.id; if (!IART[key]) IART[key] = artBooth(f.col);
  list.push([by + 4, { draw(cx, cy) { g.drawImage(IART[key], bx - 20 - cx, by - 34 - cy); text(f.name.replace(/^THE /, ""), bx - cx, by - 40 - cy, 1, WHITE, "center", null); } }]);
  list.push([by - 80, { draw(cx, cy) {                               // bunting on a ring of poles
    const cols = ["#f05050", "#ffd246", "#5ac85a", "#4a8cdc", f.col], R = a === "innin" ? 110 : 96, pts = [];
    for (let k = 0; k < 7; k++) { const ang = Math.PI + k / 6 * Math.PI; pts.push([bx + Math.cos(ang) * R, by - 6 + Math.sin(ang) * R * 0.55]); }
    for (const [px, py] of pts) { rect("#6e482a", px - cx, py - 24 - cy, 2, 26); }
    for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; for (let j = 1; j < 8; j++) { const u = j / 8, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u - 24 + Math.sin(u * Math.PI) * 6; rect(cols[(k + j) % cols.length], x - cx - 1, y - cy, 3, 3); } }
  } }]);
};
// ---- running each festival
function prizeFor(f, tier) {
  const s = isleSave(), sd = [1000, 500, 200][tier], out = [sd + " SAND DOLLARS"];
  s.sd += sd;
  if (tier === 0 && !s.fest[f.id + "_prize"]) { s.fest[f.id + "_prize"] = 1; if (invAdd(f.prize, 1)) s.owed.push([f.prize, 1]); out.push("THE " + ITEMS[f.prize].name); }
  for (const v of folkHere()) { const r = folkRec(v.id); r.pts = Math.min(HEART * HEART_MAX, r.pts + 20); }
  return ["YOU WIN " + ["A GOLD", "A SILVER", "A BRONZE"][tier] + " RIBBON! " + out.join(" AND ") + ".", "EVERYONE ENJOYED THE DAY WITH YOU."];
}
function festAct() {
  const s = isleSave(), f = festLive(s); if (!f) return;
  s.fest = s.fest || {};
  const done = s.fest[festKey(f, s)];
  if (done && f.kind !== "exchange") { isleSay([f.name + ". YOU'VE ALREADY TAKEN PART THIS YEAR.", done]); return; }
  if (f.kind === "show" || f.kind === "potluck") {
    const it = held(), item = it && ITEMS[it[0]];
    if (!it || !item.sell || (f.kind === "potluck" && item.kind !== "dish")) { isleSay([f.intro, f.how]); return; }
    isleSay([(f.kind === "show" ? "SHOW THE JUDGE YOUR " : "ADD YOUR ") + item.name + "?"], { opts: ["YES", "NOT YET"], act: [() => {
      const v = item.sell * (f.kind === "show" && (item.kind === "fish" || item.kind === "topfish") ? 1.2 : 1), tier = v >= (f.kind === "show" ? 200 : 150) ? 0 : v >= (f.kind === "show" ? 80 : 70) ? 1 : 2;
      invUse(s.sel);
      const res = prizeFor(f, tier); s.fest[festKey(f, s)] = res[0];
      isleSay([f.kind === "show" ? "THE JUDGE TURNS YOUR " + item.name + " OVER IN THEIR HANDS..." : "YOUR " + item.name + " GOES ON THE LONG TABLE. PLATES ARE PASSED. PEOPLE GO BACK FOR SECONDS."].concat(res)); play("fanfare"); saveStore();
    }, () => play("tick")] });
    return;
  }
  if (f.kind === "lantern") {
    isleSay([f.intro, "RELEASE YOUR LANTERN?"], { opts: ["RELEASE IT", "LATER"], act: [() => {
      ISLE.lanterns = Array.from({ length: 24 }, (_, i) => ({ x: festPlace(f)[1] + (Math.random() - 0.5) * 120, y: festPlace(f)[2] + 60 + Math.random() * 50, v: 6 + Math.random() * 6, ph: Math.random() * 6, me: i === 0 }));
      const res = prizeFor(f, 0); s.fest[festKey(f, s)] = "YOU SENT A LANTERN OUT ON THE SEA.";
      isleSay(["YOU LIGHT THE LANTERN AND SET IT ON THE WATER. ONE BY ONE, EVERYONE ELSE DOES THE SAME.", "THE LIGHTS DRIFT OUT TOWARD THE DARK LIGHTHOUSE.", f.how].concat(res)); play("chime"); saveStore();
    }, () => play("tick")] });
    return;
  }
  if (f.kind === "exchange") {
    const sec = s.secret && s.secret.y === s.year && FOLK[s.secret.id];
    if (!sec) { isleSay([f.intro, "NOBODY DREW YOUR NAME THIS YEAR. ENJOY THE FEAST!"]); return; }
    isleSay([f.intro, "YOU DREW " + sec.name + "'S NAME. GIVE " + sec.name + " A GIFT TODAY. " + (s.fest[festKey(f, s)] ? "(YOU ALREADY DID. MERRY MIDWINTER!)" : "")]);
    return;
  }
  isleSay([f.intro, f.how, "READY?"], { opts: ["START", "NOT YET"], act: [() => festStart(f), () => play("tick")] });
}
function festStart(f) {
  const s = isleSave();
  if (f.kind === "kite") { ISLE.kite = { f, t: 20, y: 0.5, v: 0, band: 0.5, ok: 0, hold: false }; play("select"); return; }
  const C = { f, t: f.kind === "dig" ? 60 : 90, score: 0, n: 0 };
  if (f.kind === "dig") { const r = seeded(s.year * 91 + 3), A = AREAS.wreck; C.spots = []; for (let k = 0, t = 0; k < 24 && t < 600; t++) { const x = r.uniform(500, 1300), y = r.uniform(A.grass(x) + 24, A.shore(x) - 10); if (terrainAt(A, x, y) === "s" && !C.spots.some(q => Math.hypot(q[0] - x, q[1] - y) < 30)) { C.spots.push([Math.round(x), Math.round(y), 0]); k++; } } }
  ISLE.contest = C; toast("GO!", GOLD); play("fanfare");
}
function festEnd() {
  const C = ISLE.contest, f = C.f, s = isleSave(); ISLE.contest = null; ISLE.fish = null;
  const sc = f.kind === "derby" ? C.score : C.n, gold = { derby: 60, icefish: 6, dig: 10 }[f.kind], silver = { derby: 30, icefish: 3, dig: 5 }[f.kind];
  const unit = f.kind === "derby" ? " INCHES OF FISH" : f.kind === "icefish" ? " FISH" : " FINDS";
  if (sc <= 0) { isleSay(["TIME! YOU DIDN'T GET ANYTHING THIS TIME. YOU CAN TRY AGAIN."]); return; }
  const res = prizeFor(f, sc >= gold ? 0 : sc >= silver ? 1 : 2); s.fest[festKey(f, s)] = "YOU GOT " + sc + unit + ".";
  isleSay(["TIME! YOU GOT " + sc + unit + "."].concat(res)); play("fanfare"); saveStore();
}
const _isleAct58b = isleAct5;
isleAct5 = function (o) { if (o.act.kind === "fest") festAct(); else _isleAct58b(o); };
// the gift exchange: four times the friendship, and a present back
const _giveGift8 = giveGift;
giveGift = function (v, f) {
  const s = isleSave(), F = festLive(s), before = f.pts;
  if (!held()) return;
  _giveGift8(v, f);
  if (F && F.kind === "exchange" && s.secret && s.secret.y === s.year && s.secret.id === v.id && !s.fest[festKey(F, s)]) {
    const gain = f.pts - before; if (gain > 0) f.pts = Math.min(HEART * HEART_MAX, f.pts + gain * 3);
    const back = ["pearl", "d_pie", "aquamarine", "oldcoin", "f_tree"][seeded(s.year * 3 + v.i).randint(0, 4)];
    if (invAdd(back, 1)) s.owed.push([back, 1]);
    s.fest[festKey(F, s)] = "YOU SWAPPED GIFTS WITH " + v.name + ".";
    const more = [say_(v, "'YOU DREW MY NAME? THEN THIS IS FOR YOU. MERRY MIDWINTER!'"), "YOU GOT " + ITEMS[back].name + "."];
    if (ISLE.msg) ISLE.msg.pages.push(...more); else isleSay(more);
    prizeFor(F, 1);
  }
};
// contests: count catches; dig spots
const _logCatch8 = logCatch;
logCatch = function (sp, size, how) {
  _logCatch8(sp, size, how);
  const C = ISLE.contest; if (!C || (C.f.kind !== "derby" && C.f.kind !== "icefish")) return;
  const f = FISH[sp]; C.n++; C.score += Math.round(f.min + (f.max - f.min) * size); toast(C.f.kind === "derby" ? "+" + Math.round(f.min + (f.max - f.min) * size) + " IN" : "+1 FISH", GOLD);
};
const _isleInteract8b = isleInteract;
isleInteract = function () {
  const C = ISLE.contest, it = held();
  if (C && C.f.kind === "dig" && !ISLE.msg && it && it[0] === "hoe") {
    const [tx, ty] = facingTile(), d = C.spots.find(q => !q[2] && ((Math.floor(q[0] / TS) === tx && Math.floor(q[1] / TS) === ty) || Math.hypot(q[0] - ISLE.px, q[1] - ISLE.py) < 12));
    if (d) { d[2] = 1; C.n++; const id = Math.random() < 0.1 ? "oldcoin" : Math.random() < 0.4 ? "glass" : "scrap"; invAdd(id, 1); toast("+1 " + ITEMS[id].name + " (" + C.n + ")", GOLD); play("hit"); splashDust(Math.floor(d[0] / TS), Math.floor(d[1] / TS), "#e6d2a0"); return; }
  }
  if (ISLE.kite) return;
  _isleInteract8b();
};
const _placedSprites8c = placedSprites;
placedSprites = function (list) {
  _placedSprites8c(list);
  const C = ISLE.contest;
  if (C && C.spots && ISLE.map.id === "wreck") for (const d of C.spots) if (!d[2]) list.push([d[1] - 8, { draw(cx, cy) { const x = d[0] - cx, y = d[1] - cy; g.fillStyle = "#c83c32"; for (let k = -3; k <= 3; k++) { g.fillRect(x + k - 1, y + k - 1, 2, 2); g.fillRect(x + k - 1, y - k - 1, 2, 2); } } }]);
};
// ---- the kite and the contest clock
const _isleUpdate8 = isleUpdate;
isleUpdate = function (dt) {
  const I = ISLE;
  if (I && I.kite && !I.msg) {
    const K = I.kite; K.t -= dt; K.v += (K.hold ? -1.6 : 1.1) * dt; K.v *= 0.97; K.y = clamp(K.y + K.v * dt, 0, 1);
    K.band = 0.5 + 0.32 * Math.sin((20 - K.t) * 0.9) + 0.1 * Math.sin((20 - K.t) * 2.3);
    if (Math.abs(K.y - K.band) < 0.11) K.ok += dt;
    if (K.t <= 0) { I.kite = null; const s = isleSave(), pc = Math.round(K.ok / 20 * 100), res = prizeFor(K.f, pc >= 70 ? 0 : pc >= 45 ? 1 : 2); s.fest = s.fest || {}; s.fest[festKey(K.f, s)] = "YOUR KITE STAYED IN THE WIND " + pc + "% OF THE TIME."; isleSay(["THE WIND DROPS. YOUR KITE STAYED IN THE WIND " + pc + "% OF THE TIME."].concat(res)); play("fanfare"); saveStore(); }
    return;
  }
  _isleUpdate8(dt);
  if (I && I.contest && !I.msg && !I.menu && !I.list && !I.inv) { I.contest.t -= dt; if (I.contest.t <= 0) festEnd(); }
  if (I && I.lanterns) { for (const L of I.lanterns) { L.y += L.v * dt; L.d = (L.d || 0) + L.v * dt; } if (I.lanterns.every(L => L.d > 260)) I.lanterns = null; }
};
const _isleKey8 = isleKey;
isleKey = function (e, down) {
  if (ISLE && ISLE.kite && !ISLE.msg) { if (["Space", "Enter", "KeyE"].includes(e.code)) { e.preventDefault(); ISLE.kite.hold = true; } return; }
  _isleKey8(e, down);
};
const _isleKeyUp8 = isleKeyUp;
isleKeyUp = function (e) { if (ISLE && ISLE.kite && ["Space", "Enter", "KeyE"].includes(e.code)) ISLE.kite.hold = false; _isleKeyUp8(e); };
const _isleTouch8 = isleTouch;
isleTouch = function (e) { if (ISLE && ISLE.kite && !ISLE.msg) { ISLE.kite.hold = true; return; } _isleTouch8(e); };
const _isleTouchUp8 = isleTouchUp;
isleTouchUp = function (e) { if (ISLE && ISLE.kite) ISLE.kite.hold = false; _isleTouchUp8(e); };
const _drawIsle8 = drawIsle;
drawIsle = function () {
  _drawIsle8();
  const I = ISLE, [cx, cy] = isleCam();
  if (I.lanterns) for (const L of I.lanterns) { const x = L.x + Math.sin(T + L.ph) * 4 - cx, y = L.y - cy, fade = Math.max(0, 1 - (L.d || 0) / 260); g.globalAlpha = 0.35 * fade; disc("#ffbe3c", x, y, 6); g.globalAlpha = fade; rect(L.me ? "#ffe68c" : "#ffa046", x - 2, y - 3, 5, 5); rect("#ffe68c", x - 1, y - 2, 3, 3); g.globalAlpha = 1; }
  if (I.contest) { const C = I.contest, w = 150, x = Math.round((IW - w) / 2); islePanel(x, 4, w, 16); text(C.f.name.replace(/^THE /, "") + "  " + Math.ceil(C.t) + "S  " + (C.f.kind === "derby" ? C.score + " IN" : C.n), IW / 2, 12, 1, "#3c2c22", "center", null); }
  if (I.kite) {
    const K = I.kite, w = 120, h = 150, x = Math.round((IW - w) / 2), y = Math.round((IH - h) / 2);
    g.globalAlpha = 0.4; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
    islePanel(x, y, w, h); rect("#8cc8f0", x + 6, y + 18, w - 12, h - 40);
    const by = y + 18 + (1 - K.band) * (h - 40); g.globalAlpha = 0.7; rect("#f4fbff", x + 6, by - 0.11 * (h - 40), w - 12, 0.22 * (h - 40)); g.globalAlpha = 1; outline(x + 6, Math.round(by - 0.11 * (h - 40)), w - 12, Math.round(0.22 * (h - 40)), "#5aaadc");
    const ky = y + 18 + (1 - K.y) * (h - 40), kx = x + w / 2 + Math.sin(T * 3) * 10; rect("#f0ecdc", kx, ky, 1, y + h - 22 - ky);
    g.drawImage(plSprite("f_kite"), Math.round(kx - 3), Math.round(ky - 4));
    text("KITE DAY " + Math.ceil(K.t) + "S", x + w / 2, y + 9, 1, "#b4461e", "center", null);
    text(IW >= 300 ? "HOLD E TO PULL UP" : "HOLD TO PULL UP", x + w / 2, y + h - 12, 1, "#5a3c28", "center", null);
  }
};
const _isleSave8b = isleSave;
isleSave = function () { const g_ = _isleSave8b(); if (!g_.fest) g_.fest = {}; return g_; };
