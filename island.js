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
  return q.g;
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
  add("well", 478, 404, [1, 10, 20, 10], say("AN OLD WELL. THE WATER IS FRESH."));
  add("board", 300, 400, [2, 22, 18, 6], say("WELCOME TO DRIFTWOOD ISLE. POP: 1", "SOMEONE HAS SCRATCHED UNDERNEATH: 'THE LIGHT WILL SHOW THE WAY.'"));
  add("crate", 530, 560, [1, 8, 15, 8], say("THE FISH CRATE. EMPTY FOR NOW."));
  add("cat", 551, 562, null, say("A SCRUFFY CAT. IT IS STARING AT THE CRATE."));
  add("wright", 566, 604, [2, 10, 10, 6], { kind: "talk" });
  add("raft", 652, 726, [2, 10, 40, 22], { kind: "raft" });
  add("pile", 2, 434, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE WAY. A SIGN ON TOP SAYS: DRIFTWOOD WOODS."));
  add("pile", 1082, 432, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE WAY. A SIGN ON TOP SAYS: TIDE FLATS."));
  add("pile", 584, 4, [0, 4, 36, 16], say("A PILE OF DRIFTWOOD BLOCKS THE PATH NORTH. A SIGN ON TOP SAYS: LIGHTHOUSE POINT."));
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
function terrainAt(A, x, y) {                               // -> tile kind at pixel x, y (outdoor areas)
  if (inDock(A, x, y)) return "k";
  const sh = A.shore(x);
  if (y >= sh + TIDE_BAND + 60) return "d";
  if (y >= sh + TIDE_BAND) return "a";
  if (y >= sh) return "t";
  if (pathDist(A, x, y) < 9) return "p";
  if (y < A.grass(x)) return "g";
  return y > sh - 12 ? "w" : "s";
}
const TCOL = { g: [[96, 164, 80], [110, 178, 88], [84, 148, 72], [128, 192, 98]], s: [[236, 212, 158], [226, 200, 144], [244, 226, 180], [214, 186, 130]],
  p: [[204, 168, 116], [192, 156, 104], [214, 180, 128], [204, 168, 116]] };
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
      else if (t === "k") { const yy = py - 596; col = yy % 4 === 0 ? [120, 80, 46] : [164, 114, 70]; if ((px - 560) % 32 === 0 || (px - 591) % 32 === 0) col = INKC; }
      else if (t === "s" || t === "w" || t === "t") { col = TCOL.s[n < .75 ? 0 : n < .9 ? 1 : n < .97 ? 2 : 3]; if (t !== "s") col = col.map(v => Math.round(v * (t === "t" ? 0.8 : 0.88))); }
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
  const objs = (id === "port" ? portObjects() : shackObjects());
  return { id, A, c, tiles, objs, W, H };
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
  if (first) { s.intro = 1; isleSay(["THE RAFT BUMPS AGAINST AN OLD DOCK.", "DRIFTWOOD ISLE. NOBODY HAS LIVED HERE IN YEARS.", "THE SHIPWRIGHT TIES THE RAFT UP. \"THAT SHACK UP THE HILL STILL HAS A ROOF. IT'S YOURS IF YOU WANT IT.\""]); }
  else isleSay(["DRIFTWOOD ISLE. " + SEASONS[s.season][0] + " " + s.day + ", YEAR " + s.year + "."]);
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
const WRIGHT_LINES = ["\"THE RAFT'S TIED UP AT THE END OF THE DOCK WHENEVER YOU WANT TO GO BACK.\"", "\"THIS WHOLE PORT WAS BUSY ONCE. BOATS EVERYWHERE.\"",
  "\"THOSE DRIFTWOOD PILES? I'LL CLEAR THEM WHEN THERE'S A REASON TO GO OUT THERE.\"", "\"THE MAN WHO LIVED IN YOUR SHACK WROTE A LOT OF LETTERS. PUT THEM IN BOTTLES, I HEARD.\""];
function isleAct(o) {
  const a = o.act, s = isleSave();
  if (a.kind === "say") isleSay(a.text);
  else if (a.kind === "talk") { isleSay([WRIGHT_LINES[(s.day + Math.floor(s.min / 120)) % WRIGHT_LINES.length]]); }
  else if (a.kind === "raft") isleSay(["SAIL BACK TO YOUR BOAT?"], { opts: ["YES", "NOT YET"], act: [isleLeave, () => play("tick")] });
  else if (a.kind === "bed") isleSay(["GO TO BED FOR THE NIGHT?"], { opts: ["SLEEP", "NOT YET"], act: [() => isleSleep(false), () => play("tick")] });
  else if (a.kind === "door") isleDoor(a.to);
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
  const w = weatherOf(s), wt = w === "rain" ? "IT'S RAINING." : w === "snow" ? "IT'S SNOWING." : "IT'S A CLEAR DAY.";
  isleSay((passedOut ? ["YOU FELL ASLEEP WHERE YOU STOOD AND WOKE UP IN BED. NO HARM DONE."] : []).concat([SEASONS[s.season][0] + " " + s.day + ". " + wt]));
  saveStore(); play("select");
}

function isleUpdate(dt) {
  if (!ISLE) return;
  const I = ISLE, s = isleSave();
  I.fade = Math.max(0, I.fade - dt * 3); I.wake = Math.max(0, I.wake - dt);
  if (I.msg) { I.msg.t += dt; return; }
  if (I.menu) return;
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
  I.moving = !!(mx || my);
  if (I.moving) {
    I.dir = Math.abs(mx) > Math.abs(my) || (mx && !my) ? (mx < 0 ? "left" : "right") : (my < 0 ? "up" : "down");
    const k = (mx && my ? 0.7071 : 1) * WALK * dt;
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
  const [fx, fy] = facingPoint(), o = objAt(fx, fy) || objAt(ISLE.px, ISLE.py - 4);
  if (o) isleAct(o);
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
  if (A.outdoor) {                                          // the tide over the flats, foam, and glints on the water
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
  const list = M_.objs.map(o => [o.y + (o.solid ? o.solid[1] + o.solid[3] : IART[o.k].height - 2), o]);
  list.push([I.py, null]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, o] of list) {
    if (o) {
      if (o.k === "raft") { g.drawImage(IART.raft, o.x - cx, o.y - cy + Math.round(Math.sin(t * 2) * 1)); continue; }
      if (o.k === "cat") { g.drawImage(IART.cat, o.x - cx, o.y - cy - (Math.floor(t * 0.7) % 4 === 0 ? 1 : 0)); continue; }
      if (o.k === "wright") { g.drawImage(IART.wright, o.x - cx, o.y - cy + (Math.floor(t * 1.4) % 2)); continue; }
      if (o.k === "door") continue;
      g.drawImage(IART[o.k], o.x - cx, o.y - cy);
      if (o.k === "shack") for (let k = 0; k < 3; k++) { const u = (t * 0.45 + k / 3) % 1; g.globalAlpha = 0.7 * (1 - u); rect("#e6e6ec", o.x - cx + 58 + Math.round(Math.sin(u * 6 + k) * 2 + u * 4), o.y - cy + 12 - Math.round(u * 16), 2 + Math.round(u * 2), 2); g.globalAlpha = 1; }
    } else drawIslePlayer(I.px - cx, I.py - cy, t);
  }
  const [fx, fy] = facingPoint(), near = !I.msg && !I.menu && (objAt(fx, fy) || objAt(I.px, I.py - 4));
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
  if (I.msg) drawIsleMsg(I.msg);
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
const ISLE_MENU = [["RESUME", () => { ISLE.menu = null; }], ["GO BACK TO YOUR BOAT", () => { ISLE.menu = null; isleLeave(); }]];
function drawIsleMenu() {
  g.globalAlpha = 0.5; rect("#000", 0, 0, IW, IH); g.globalAlpha = 1;
  const w = 150, h = 22 + ISLE_MENU.length * 16 + 26, x = Math.round((IW - w) / 2), y = Math.round((IH - h) / 2), s = isleSave();
  islePanel(x, y, w, h);
  text("DRIFTWOOD ISLE", x + w / 2, y + 10, 1, "#b4461e", "center", null);
  ISLE_MENU.forEach(([lab], i) => { const by = y + 20 + i * 16; rect(ISLE.menu.sel === i ? "#f4e4c0" : "#e8d4aa", x + 8, by, w - 16, 13); if (ISLE.menu.sel === i) outline(x + 8, by, w - 16, 13, "#b4461e"); text(lab, x + w / 2, by + 7, 1, "#3c2c22", "center", null); });
  const by = y + 24 + ISLE_MENU.length * 16;
  text(SEASONS[s.season][0] + " " + s.day + ", YEAR " + s.year, x + w / 2, by + 4, 1, "#8c6c50", "center", null);
  text("WASD MOVE   E USE", x + w / 2, by + 14, 1, "#8c6c50", "center", null);
}
function isleMenuPick() { ISLE_MENU[ISLE.menu.sel][1](); play("select"); }

// ---- input (from game.js while S.state === "isle")
function isleKey(e, down) {
  if (!ISLE || !down) return;
  const c = e.code, I = ISLE;
  if (["Space", "Enter", "KeyE"].includes(c)) { e.preventDefault(); isleInteract(); return; }
  if (c === "Escape" || c === "Tab") { e.preventDefault(); if (I.msg) { I.msg = null; return; } I.menu = I.menu ? null : { sel: 0 }; play("tick"); return; }
  const v = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
  if (v && I.menu) { I.menu.sel = (I.menu.sel + v + ISLE_MENU.length) % ISLE_MENU.length; play("tick"); }
  else if (v && I.msg && I.msg.choice && I.msg.i === I.msg.pages.length - 1) { I.msg.sel = (I.msg.sel + v + I.msg.choice.opts.length) % I.msg.choice.opts.length; play("tick"); }
}
function islePos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * IW, (e.clientY - r.top) / r.height * IH]; }
function isleTouch(e) {
  if (!ISLE) return;
  const [x, y] = islePos(e), I = ISLE;
  if (I.menu) {
    const w = 150, h = 22 + ISLE_MENU.length * 16 + 26, mx = Math.round((IW - w) / 2), my = Math.round((IH - h) / 2), i = Math.floor((y - my - 20) / 16);
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
  if (x < 22 && y < 20) { I.menu = { sel: 0 }; play("tick"); return; }
  const [cx, cy] = isleCam(), wx = x + cx, wy = y + cy, o = objAt(wx, wy);
  if (o && Math.hypot(wx - I.px, wy - I.py) < 36) { isleAct(o); return; }
  I.target = [wx, wy + 6, o];
}
