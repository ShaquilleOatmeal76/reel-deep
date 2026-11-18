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
    g_.inv = Array(INV_N).fill(null); g_.inv[0] = ["hoe", 1]; g_.inv[1] = ["can", 1]; g_.inv[2] = ["s_lettuce", 15]; g_.inv[3] = ["rod", 1]; g_.inv[4] = ["net", 1]; g_.fish0 = 1;
    g_.sel = 0; g_.water = WATER_MAX; g_.sd = (g_.sd || 0) + 100; g_.farm = {}; g_.bin = []; g_.forage = null; g_.earned = 0; g_.kit = 0;
  }
  if (!g_.fish0) {                                            // part 4: a fishing rod and a net for saves from before it
    g_.fish0 = 1; g_.rodMsg = 1;
    for (const id of ["rod", "net"]) { const i = g_.inv.indexOf(null); if (i >= 0) g_.inv[i] = [id, 1]; else g_.rodLater = 1; }
  }
  if (!g_.log) { g_.log = {}; g_.pots = []; g_.pools = null; }
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
    exits: [{ side: "e", a: 410, b: 490, to: "flats", x: 14, y: 300 }, { side: "n", a: 560, b: 640, to: "lagoon", x: 560, y: 862 }],
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
  shack: { name: "YOUR SHACK", w: 12, h: 10, outdoor: false },
};
function portObjects() {                                   // everything standing in the Port: [art key, x, y (top-left), solid rect (relative), act]
  const o = [];
  const add = (k, x, y, solid, act) => o.push({ k, x, y, solid, act });
  const say = (...text) => ({ kind: "say", text });
  add("shack", 112, 334, [6, 50, 66, 24], { kind: "door", to: "shack", rect: [30, 74, 18, 6] });
  add("store", 370, 356, [4, 32, 56, 22], say("THE OLD GENERAL STORE. THE ROOF CAVED IN YEARS AGO.", "IT COULD BE FIXED UP ONE DAY."));
  add("aquarium", 562, 340, [4, 32, 68, 28], say("AN AQUARIUM, OF ALL THINGS. THE GLASS DOME IS CRACKED AND THE TANKS ARE EMPTY.", "IT WOULD TAKE A LOT OF FISH TO FILL IT."));
  add("inn", 760, 352, [4, 32, 56, 22], say("THE INN. THE SIGN STILL SWINGS. NOBODY HAS SLEPT HERE IN A LONG TIME."));
  add("smoke", 940, 350, [4, 32, 56, 22], say("A SMOKEHOUSE. IT STILL SMELLS FAINTLY OF FISH."));
  [[150, "#8a5246"], [300, "#52788a"], [440, "#6a6a4a"], [700, "#7a5a8a"], [850, "#52788a"], [990, "#8a5246"]].forEach(([x, rc], i) =>
    add("cot" + (i % 3), x, 176, [3, 26, 42, 16], say(["AN EMPTY COTTAGE. THE DOOR IS BOARDED UP.", "AN EMPTY COTTAGE. SOMEONE LEFT A TEAPOT ON THE STEP.", "AN EMPTY COTTAGE. IVY HAS TAKEN THE WINDOWS."][i % 3], "MAYBE SOMEONE WILL MOVE IN ONE DAY.")));
  add("yard", 870, 480, [4, 32, 56, 22], say("THE SHIPYARD. HALF A HULL IS STILL ON THE SLIPWAY."));
  add("well", 478, 404, [1, 10, 20, 10], { kind: "water" });
  add("board", 300, 400, [2, 22, 18, 6], say("WELCOME TO DRIFTWOOD ISLE. POP: 1", "SOMEONE HAS SCRATCHED UNDERNEATH: 'THE LIGHT WILL SHOW THE WAY.'"));
  add("crate", 530, 560, [1, 8, 15, 8], say("THE FISH CRATE. EMPTY FOR NOW."));
  add("cat", 551, 562, null, say("A SCRUFFY CAT. IT IS STARING AT THE CRATE."));
  add("wright", 566, 604, [2, 10, 10, 6], { kind: "talk" });
  add("raft", 652, 726, [2, 10, 40, 22], { kind: "raft" });
  add("pile", 2, 434, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE WAY. A SIGN ON TOP SAYS: DRIFTWOOD WOODS."));
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
    { k: "stove", x: 150, y: 28, solid: [0, 4, 18, 18], act: { kind: "say", text: ["AN OLD IRON STOVE. IT STILL WORKS. COOKING COMES LATER."] } },
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
  p: [[204, 168, 116], [192, 156, 104], [214, 180, 128], [204, 168, 116]], m: [[150, 116, 82], [138, 106, 74], [162, 128, 92], [126, 96, 66]] };
function buildArea(id) {                                    // paint the ground once into a canvas; classify tiles
  const A = AREAS[id], W = A.w * TS, H = A.h * TS, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d"), img = x.createImageData(W, H), d = img.data, r = seeded(id.length * 991 + 7), tiles = [];
  const put = (i, col) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  if (A.outdoor) {
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4, n = r.random(), t = terrainAt(A, px, py);
      let col;
      if (t === "g") col = TCOL.g[n < .7 ? 0 : n < .85 ? 1 : n < .97 ? 2 : 3];
      else if (t === "p") col = TCOL.p[n < .7 ? 0 : n < .85 ? 1 : 2];
      else if (t === "m") col = TCOL.m[n < .7 ? 0 : n < .85 ? 1 : n < .97 ? 2 : 3];
      else if (t === "k") { const yy = py - 596; col = yy % 4 === 0 ? [120, 80, 46] : [164, 114, 70]; if ((px - 560) % 32 === 0 || (px - 591) % 32 === 0) col = INKC; }
      else if (t === "s" || t === "w" || t === "t") { col = TCOL.s[n < .75 ? 0 : n < .9 ? 1 : n < .97 ? 2 : 3]; if (t !== "s") col = col.map(v => Math.round(v * (t === "t" ? 0.8 : 0.88))); }
      else if (A.fresh) { const dep = freshDepth(A, px, py); col = dep < 8 ? [104, 178, 168] : dep < 26 ? [72, 148, 156] : [52, 116, 140]; if (dep >= 26 && dep < 29 && (px + py) % 2) col = [72, 148, 156]; }
      else { const dep = py - A.shore(px) - TIDE_BAND; col = dep < 14 ? [118, 204, 214] : dep < 50 ? [78, 172, 204] : [52, 140, 190]; if (((dep >= 14 && dep < 17) || (dep >= 50 && dep < 53)) && (px + py) % 2) col = dep < 30 ? [118, 204, 214] : [78, 172, 204]; }
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
      const wall = ty < 2 || tx === 0 || tx === A.w - 1 || (ty === A.h - 1 && tx !== 5 && tx !== 6);
      let col = wall ? (py % 8 === 0 ? [70, 46, 30] : [96, 64, 40]) : ((py % 8 === 0 || (px + (Math.floor(py / 8) % 2) * 12) % 24 === 0) ? [120, 82, 50] : [150, 104, 64]);
      if (wall && ty === 1 && py % 16 > 12) col = [60, 40, 26];
      put(i, col);
    }
  }
  x.putImageData(img, 0, 0);
  if (!A.outdoor) {                                          // a window and a rug
    x.fillStyle = INK; x.fillRect(88, 6, 24, 16); x.fillStyle = "#9ad2ec"; x.fillRect(89, 7, 22, 14); x.fillStyle = "#6e482a"; x.fillRect(99, 7, 2, 14); x.fillRect(89, 13, 22, 2);
    x.fillStyle = "#a03c32"; x.fillRect(64, 92, 64, 36); x.fillStyle = "#c85a46"; x.fillRect(68, 96, 56, 28); x.fillStyle = "#e6c45a"; x.fillRect(72, 108, 48, 2);
  }
  for (let ty = 0; ty < A.h; ty++) { const row = []; for (let tx = 0; tx < A.w; tx++) {
    if (A.outdoor) row.push(terrainAt(A, tx * TS + 8, ty * TS + 8));
    else row.push(ty < 2 || tx === 0 || tx === A.w - 1 || (ty === A.h - 1 && tx !== 5 && tx !== 6) ? "x" : "f");
  } tiles.push(row); }
  const objs = id === "port" ? portObjects() : id === "flats" ? flatsObjects() : id === "lagoon" ? lagoonObjects() : shackObjects();
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
  const kit = ["HE HANDS YOU A HOE, A WATERING CAN, SEEDS, AN OLD ROD AND A NET. 'THERE'S AN OLD GARDEN ON THE TIDE FLATS, EAST OF HERE. I CLEARED THE WAY.'",
    "'SELL WHAT YOU GROW IN THE BIN BY YOUR SHACK. MORE SEEDS AT THE STAND BY THE STORE.'"];
  if (first) { s.intro = 1; s.kit = 1; isleSay(["THE RAFT BUMPS AGAINST AN OLD DOCK.", "DRIFTWOOD ISLE. NOBODY HAS LIVED HERE IN YEARS.", "THE SHIPWRIGHT TIES THE RAFT UP. 'THAT SHACK UP THE HILL STILL HAS A ROOF. IT'S YOURS IF YOU WANT IT.'"].concat(kit)); }
  else if (!s.kit) { s.kit = 1; isleSay(["THE SHIPWRIGHT IS WAITING ON THE DOCK."].concat(kit)); }
  else isleSay(["DRIFTWOOD ISLE. " + SEASONS[s.season][0] + " " + s.day + ", YEAR " + s.year + "."]);
  forageCheck();
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
  for (const o of M_.objs) if (o.solid) { const [a, b, w, h] = o.solid; if (x >= o.x + a && x < o.x + a + w && y >= o.y + b && y < o.y + b + h) return true; }
  return false;
}
const feetBlocked = (x, y) => isleSolidAt(x - 4, y) || isleSolidAt(x + 4, y) || isleSolidAt(x - 4, y - 3) || isleSolidAt(x + 4, y - 3);
function facingPoint() { const d = { up: [0, -10], down: [0, 8], left: [-11, -2], right: [11, -2] }[ISLE.dir]; return [ISLE.px + d[0], ISLE.py + d[1]]; }
function objAt(x, y) {
  for (const o of ISLE.map.objs) {
    if (!o.act) continue;
    const r = o.act.rect || (o.solid ? [o.solid[0] - 6, o.solid[1] - 6, o.solid[2] + 12, o.solid[3] + 16] : [0, 0, IART[o.k].width, IART[o.k].height]);
    if (x >= o.x + r[0] && x < o.x + r[0] + r[2] && y >= o.y + r[1] && y < o.y + r[1] + r[3]) return o;
  }
  return null;
}
const WRIGHT_LINES = ["'THE OLD GARDEN'S ON THE TIDE FLATS. WATER WHAT YOU PLANT EVERY DAY, UNLESS IT RAINS.'",
  "'THINGS WASH UP ON THE BEACHES EVERY MORNING. SHELLS AND SUCH. THEY SELL.'", "'THE RAFT'S TIED UP AT THE END OF THE DOCK WHENEVER YOU WANT TO GO BACK.'", "'THIS WHOLE PORT WAS BUSY ONCE. BOATS EVERYWHERE.'",
  "'THOSE DRIFTWOOD PILES? I'LL CLEAR THEM WHEN THERE'S A REASON TO GO OUT THERE.'", "'THE MAN WHO LIVED IN YOUR SHACK WROTE A LOT OF LETTERS. PUT THEM IN BOTTLES, I HEARD.'"];
function isleAct(o) {
  const a = o.act, s = isleSave();
  if (a.kind === "say") isleSay(a.text);
  else if (a.kind === "talk") { isleSay([WRIGHT_LINES[(s.day + Math.floor(s.min / 120)) % WRIGHT_LINES.length]]); }
  else if (a.kind === "raft") isleSay(["SAIL BACK TO YOUR BOAT?"], { opts: ["YES", "NOT YET"], act: [isleLeave, () => play("tick")] });
  else if (a.kind === "bed") isleSay(["GO TO BED FOR THE NIGHT?"], { opts: ["SLEEP", "NOT YET"], act: [() => isleSleep(false), () => play("tick")] });
  else if (a.kind === "door") isleDoor(a.to);
  else if (a.kind === "bin") binAct();
  else if (a.kind === "shop") { ISLE.shop = { sel: 0 }; play("select"); }
  else if (a.kind === "water") canFill();
}
function isleDoor(to) {
  play("tick");
  if (to === "shack") isleGo("shack", 96, 140, "up"); else isleGo("port", 151, 416, "down");
}
function isleSleep(passedOut) {                              // a new day: in bed, 6 am
  const s = isleSave();
  s.min = DAY_START; s.day++;
  if (s.day > SEASON_DAYS) { s.day = 1; s.season = (s.season + 1) % 4; if (s.season === 0) s.year++; }
  isleGo("shack", 34, 86, "down");
  ISLE.wake = 2.4;
  const paid = farmNewDay(s);
  const w = weatherOf(s), wt = w === "rain" ? "IT'S RAINING. THE GARDEN GETS WATERED." : w === "snow" ? "IT'S SNOWING." : "IT'S A CLEAR DAY.";
  isleSay((passedOut ? ["YOU FELL ASLEEP WHERE YOU STOOD AND WOKE UP IN BED. NO HARM DONE."] : []).concat(paid ? ["THE BIN PAID " + paid + " SAND DOLLARS OVERNIGHT."] : []).concat([SEASONS[s.season][0] + " " + s.day + ". " + wt]));
  saveStore(); play("select");
}

function isleUpdate(dt) {
  if (!ISLE) return;
  const I = ISLE, s = isleSave();
  I.fade = Math.max(0, I.fade - dt * 3); I.wake = Math.max(0, I.wake - dt);
  I.toasts = (I.toasts || []).filter(q => (q[1] -= dt) > 0);
  if (I.msg) { I.msg.t += dt; return; }
  if (I.menu || I.shop || I.inv || I.log || I.card) return;
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
    if (inside && ((o.act.to === "shack" && I.dir === "up") || (o.act.to === "port" && I.dir === "down")) && I.moving) { isleDoor(o.act.to); break; }
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
  if (ISLE.log) { ISLE.log = null; return; }
  if (ISLE.fish) { fishPress(); return; }
  const [fx, fy] = facingPoint(), f = forageAt(fx, fy) || forageAt(ISLE.px, ISLE.py - 4);
  if (f) { forageTake(f); return; }
  const o = objAt(fx, fy) || objAt(ISLE.px, ISLE.py - 4);
  if (o) { isleAct(o); return; }
  if (potInteract()) return;
  const it = held();
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
  const list = M_.objs.map(o => [o.y + (o.solid ? o.solid[1] + o.solid[3] : IART[o.k].height - 2), o]);
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
      g.drawImage(IART[o.k], o.x - cx, o.y - cy);
      if (o.k === "shack") for (let k = 0; k < 3; k++) { const u = (t * 0.45 + k / 3) % 1; g.globalAlpha = 0.7 * (1 - u); rect("#e6e6ec", o.x - cx + 58 + Math.round(Math.sin(u * 6 + k) * 2 + u * 4), o.y - cy + 12 - Math.round(u * 16), 2 + Math.round(u * 2), 2); g.globalAlpha = 1; }
    } else if (o === null) drawIslePlayer(I.px - cx, I.py - cy, t);
  }
  const [fx, fy] = facingPoint(), near = !I.msg && !I.menu && !I.shop && !I.inv && !I.fish && (forageAt(fx, fy) || forageAt(I.px, I.py - 4) || objAt(fx, fy) || objAt(I.px, I.py - 4));
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
      for (const o of M_.objs) if (o.k === "shack") { disc("#ffb450", o.x - cx + 19, o.y - cy + 58, 10); disc("#ffb450", o.x - cx + 57, o.y - cy + 58, 10); disc("#ff9640", o.x - cx + 72, o.y - cy + 68, 8); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
  } else { const dk = darkness(s.min) * 0.5; if (dk > 0) { g.globalAlpha = dk; rect("#141a40", 0, 0, IW, IH); g.globalAlpha = 1; } }
  drawIsleHud(s);
  drawFishing(cx, cy);
  drawToolbar(s); drawToasts();
  if (I.msg) drawIsleMsg(I.msg);
  if (I.shop) drawShopIsle();
  if (I.inv) drawInvIsle();
  if (I.log) drawLogIsle();
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
const ISLE_MENU = [["RESUME", () => { ISLE.menu = null; }], ["ISLAND LOG", () => { ISLE.menu = null; ISLE.log = { page: 0, sel: 0 }; }], ["GO BACK TO YOUR BOAT", () => { ISLE.menu = null; isleLeave(); }]];
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
  if (I.shop) { shopTouch(x, y); return; }
  if (I.inv) { invTouch(x, y); return; }
  if (x < 22 && y < 20) { I.menu = { sel: 0 }; play("tick"); return; }
  if (toolbarTouch(x, y)) return;
  if (I.fish) { fishPress(); return; }
  { const it = held(), [cx0, cy0] = isleCam(), wx0 = x + cx0, wy0 = y + cy0;     // holding the rod: a tap on water casts toward it
    if (it && it[0] === "rod" && I.map.A.outdoor && isWaterAt(wx0, wy0)) { const dx = wx0 - I.px, dy = wy0 - I.py; I.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"); fishPress(); I.touchFish = true; return; } }
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
  for (let i = 0; i < INV_N && n > 0; i++) if (inv[i] && inv[i][0] === id && ITEMS[id].kind !== "tool") { inv[i][1] += n; n = 0; }
  for (let i = 0; i < INV_N && n > 0; i++) if (!inv[i]) { inv[i] = [id, n]; n = 0; }
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
function facingTile() { const [fx, fy] = facingPoint(); return [Math.floor(fx / TS), Math.floor(fy / TS)]; }
const farmKey = (tx, ty) => ISLE.map.id + ":" + tx + "," + ty;
function tileAt(tx, ty) { const M_ = ISLE.map; return ty >= 0 && ty < M_.A.h && tx >= 0 && tx < M_.A.w ? M_.tiles[ty][tx] : "x"; }
function isWaterTile(tx, ty) { const t = tileAt(tx, ty); if (t === "a" || t === "d") return true; if (t === "t") { const A = ISLE.map.A; return ty * TS + 8 > tideEdge(A, tx * TS + 8, isleSave()); } return false; }
function canFill() { const s = isleSave(); if (!s.inv.some(q => q && q[0] === "can")) { isleSay(["FRESH WATER. YOU'D NEED A WATERING CAN."]); return; } s.water = WATER_MAX; toast("THE CAN IS FULL", "#78c8f0"); play("plop"); }
function isleUse(tx, ty) {
  if (tx === undefined) [tx, ty] = facingTile();
  const s = isleSave(), it = held(), key = farmKey(tx, ty), e = s.farm[key], id = it && it[0];
  if (e && e.c && !e.dead && e.d >= CROP[e.c].days) { harvest(key, e); return; }    // anything ripe in front of you comes first
  if (id === "hoe") {
    if (tileAt(tx, ty) !== "m") { play("miss"); toast("THE HOE ONLY WORKS IN THE GARDEN"); return; }
    if (e && e.dead) { delete s.farm[key]; s.farm[key] = { c: null, d: 0, w: 0 }; play("hit"); return; }
    if (e) { play("miss"); return; }
    s.farm[key] = { c: null, d: 0, w: weatherOf(s) === "rain" ? 1 : 0 }; play("hit"); splashDust(tx, ty, "#8c6a46");
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
    e.w = rain ? 1 : 0;
  }
  const paid = s.bin.reduce((a, [id, n]) => a + (sellable(id) || 0) * n, 0);
  s.sd += paid; s.earned = (s.earned || 0) + paid; s.bin = [];
  forageCheck(); potsNewDay(s);
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
  if (it[0] === "can") { rect("#3c2c22", x + 2, y + TB_SLOT - 5, TB_SLOT - 5, 2); rect("#5aaadc", x + 2, y + TB_SLOT - 5, Math.round((TB_SLOT - 5) * s.water / WATER_MAX), 2); }
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
function invGeo() { const w = 9 * TB_SLOT + 16, h = 2 * TB_SLOT + 52; return [Math.round((IW - w) / 2), Math.round((IH - h) / 2), w, h]; }
function drawInvIsle() {
  const [x, y, w, h] = invGeo(), s = isleSave(), I = ISLE.inv;
  g.globalAlpha = 0.45; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  islePanel(x, y, w, h);
  text("YOUR BAG", x + 8, y + 9, 1, "#b4461e", "left", null); rect("#f0ecdc", x + w - 46, y + 6, 5, 5); text(s.sd, x + w - 38, y + 9, 1, "#5a3c28", "left", null);
  for (let i = 0; i < INV_N; i++) { const sx = x + 8 + (i % 9) * TB_SLOT, sy = y + 18 + Math.floor(i / 9) * (TB_SLOT + 2); drawSlot(sx, sy, I.held === i ? null : s.inv[i], i === I.sel, s); if (i === s.sel) rect("#b4461e", sx + 6, sy - 2, 5, 1); }
  const it = s.inv[I.held >= 0 ? I.held : I.sel], ly = y + 18 + 2 * (TB_SLOT + 2) + 4;
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
  if (d) { I.sel = (I.sel + d + INV_N) % INV_N; play("tick"); return; }
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); invPick(); }
}
function invTouch(x, y) {
  const [px, py, w, h] = invGeo(), I = ISLE.inv;
  if (x < px || x > px + w || y < py || y > py + h) { ISLE.inv = null; play("back"); return; }
  const col = Math.floor((x - px - 8) / TB_SLOT), row = Math.floor((y - py - 18) / (TB_SLOT + 2));
  if (col >= 0 && col < 9 && row >= 0 && row < 2) { I.sel = row * 9 + col; invPick(); if (I.held < 0 && I.sel < 9) isleSave().sel = I.sel; }
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
const LATER = /^(cave|marsh|wreck|gull|fest_|light)/;          // places and days still to come
function fishOk(f, s) {
  if (LATER.test(f.where) || !f.seasons.includes(String(s.season))) return false;
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
  if (!M_.A.outdoor) { I.shadows = []; return; }
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
  if (!F) { if (!I.map.A.outdoor) { toast("NO WATER IN HERE"); play("miss"); return; } I.fish = { phase: "charge", p: 0, d: 1 }; return; }
  if (F.phase === "wait") { if (F.bite > 0) startReel(); else { I.fish = null; if (F.sh) F.sh.hook = false; play("back"); } return; }
  if (F.phase === "reel") F.hold = true;
}
function fishRelease() { const F = ISLE.fish; if (!F) return; if (F.phase === "charge") castLine(); else if (F.phase === "reel") F.hold = false; }
function isleKeyUp(e) { if (ISLE && ["Space", "Enter", "KeyE"].includes(e.code)) fishRelease(); }
function isleTouchUp(e) { if (ISLE) { fishRelease(); ISLE.touchFish = false; } }
function rodTip() { const I = ISLE, d = { up: [3, -22], down: [6, -6], left: [-10, -14], right: [10, -14] }[I.dir]; return [I.px + d[0], I.py + d[1]]; }
function castLine() {
  const I = ISLE, F = I.fish, d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[I.dir], dist = 20 + F.p * 76;
  const tx = clamp(I.px + d[0] * dist, 4, I.map.W - 4), ty = clamp(I.py - 4 + d[1] * dist, 4, I.map.H - 4);
  I.fish = { phase: "fly", t: 0, sx: rodTip()[0], sy: rodTip()[1], x: tx, y: ty, wet: isWaterAt(tx, ty) };
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
      Object.assign(F, { phase: "wait", t: 0, sh: null, nib: 0, nibT: 0, bite: 0, look: 0, dip: 0 }); play("plop");
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
        if (near && Math.random() < 0.6) { F.sh = near; near.hook = true; F.nib = 1 + Math.floor(Math.random() * 3); F.nibT = 1 + Math.random(); }
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
    if (F.hold) { F.prog += dt * (0.34 - str * 0.06); F.ten += dt * (0.32 + str * 0.22 + F.surge * 0.45); }
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
