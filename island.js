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
