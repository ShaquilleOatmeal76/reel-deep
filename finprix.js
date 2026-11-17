// FIN PRIX: a Mario Kart 64 style race for your derby fish (prototype, Nov 17, 2026).
// Loaded after game.js and uses its globals (g, rect, text, LW, LH, T, S, store, tav, SPEC, play, RNG, clamp, lerp...).
// Pseudo-3D road (the SNES / arcade trick): the track is a list of short segments, each with a curve and a height; every
// frame they're projected from a camera behind your fish and drawn back to front as trapezoids, then the racers, item
// boxes and scenery are drawn as scaled sprites. Everything is drawn in code: no new art files.
// Prototype: one track (KELP CIRCUIT), 3 laps, you + 7 AI fish, drift mini-turbos, item boxes, results.
// Reached only by the test link ?finprix for now. Nothing is saved.
"use strict";
const FP = {
  SEG: 200, ROAD: 1300, CAM_H: 900, DEPTH: 0.84, DRAW: 160, LAPS: 3, RACERS: 8,
  MAX: 12000, ACCEL: 5200, BRAKE: -14000, DECEL: -2600, OFF_DECEL: -9000, OFF_MAX: 0.45,
  CENTRIFUGAL: 0.32, STEER: 2.6, DRIFT_STEER: 3.4,
};
const FP_COL = { water: [12, 40, 86], fogNear: [26, 70, 120], sand: ["#c8b480", "#bca874"], off: ["#1e5a50", "#1a5048"], rumble: ["#f05050", "#fafaff"], lane: "#e6dcb4" };
const TEST_FP = (() => { try { return new URLSearchParams(location.search).has("finprix"); } catch (e) { return false; } })();
let KART = null;
const FP_TUNE = { skill: 0.97, spread: 0.07, lead: 0.035 };   // AI difficulty; tuned with tools/tests/test_finprix.py

// ---- the track: pieces of [ease in, hold, ease out, curve, height change in segments]
function fpTrack() {
  const segs = [], add = (enter, hold, leave, curve, hill) => {
    enter = Math.round(enter * 2.5); hold = Math.round(hold * 2.5); leave = Math.round(leave * 2.5);   // a lap of about 30 seconds
    const y0 = segs.length ? segs[segs.length - 1].p2.y : 0, y1 = y0 + (hill || 0) * FP.SEG, n = enter + hold + leave;
    for (let i = 0; i < n; i++) {
      const c = i < enter ? curve * ease(i / enter) : i < enter + hold ? curve : curve * (1 - ease((i - enter - hold) / leave));
      const ya = lerp(y0, y1, easeIO(i / n)), yb = lerp(y0, y1, easeIO((i + 1) / n)), k = segs.length;
      segs.push({ i: k, curve: c, p1: { y: ya, z: k * FP.SEG }, p2: { y: yb, z: (k + 1) * FP.SEG }, deco: [], boxes: [] });
    }
  };
  const ease = u => u * u, easeIO = u => -Math.cos(u * Math.PI) / 2 + 0.5;
  add(10, 40, 10, 0, 0);                // the start straight
  add(20, 40, 20, -3, 10);              // a long left, climbing
  add(10, 20, 10, 0, -10);
  add(15, 25, 15, 5, 0);                // a hard right
  add(10, 10, 10, -4, 15);              // the kelp esses
  add(10, 10, 10, 4, -15);
  add(10, 10, 10, -4, 0);
  add(10, 60, 10, 0, 20);               // the long straight over the ridge (item boxes)
  add(20, 30, 20, 6, -20);              // the big sweeper
  add(10, 20, 10, -2, 0);
  add(15, 30, 15, 4, 5);
  add(10, 40, 10, 0, -5);               // back to the line
  const total = segs[segs.length - 1].p2.y;    // (pieces below are scaled x2.5 in add())    // close the loop: ease the last height back to zero
  if (Math.abs(total) > 1) segs.forEach((s, k) => { const u = k / segs.length; s.p1.y -= total * u; s.p2.y -= total * (k + 1) / segs.length; });
  const rng = RNG(77);
  segs.forEach((s, k) => {                // scenery: kelp, rocks and coral beside the road
    if (k % 5 === 0) s.deco.push(["kelp", rng.choice([-1, 1]) * rng.uniform(1.3, 2.4)]);
    if (k % 11 === 3) s.deco.push(["rock", rng.choice([-1, 1]) * rng.uniform(1.25, 2)]);
    if (k % 17 === 8) s.deco.push(["coral", rng.choice([-1, 1]) * rng.uniform(1.2, 1.8)]);
  });
  [300, 760, 1180].forEach(k => [-0.6, -0.2, 0.2, 0.6].forEach(x => segs[k].boxes.push({ x, gone: 0 })));   // item box rows
  return segs;
}

// ---- racers
const FP_NAMES = ["FINN", "BUBBLES", "GILL", "SHELLY", "CORAL", "RIPTIDE", "NEMO JR", "SCALES", "DORY 2", "BARNACLE"];
function fpFishColors(id) {                  // the two main colours of a fish sprite, for its rear view
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
function startKart(test, bot) {             // bot (tests only): a robot drives your fish: { noise, lag, lv }
  const segs = fpTrack(), len = segs.length * FP.SEG, f = tav().fish, rng = RNG((Math.random() * 4294967296) >>> 0);
  const me = { name: f ? f.name : "YOU", id: f ? f.id : "clown", me: true, lv: bot ? bot.lv : f ? f.lv : [5, 5, 5], bot };
  const pool = C21_POOL.filter(id => id !== me.id), racers = [me];
  while (racers.length < FP.RACERS) { const id = rng.choice(pool); if (!racers.some(r => r.id === id)) racers.push({ id, name: FP_NAMES[racers.length - 1], skill: FP_TUNE.skill + rng.random() * FP_TUNE.spread }); }
  racers.forEach((r, i) => {
    Object.assign(r, { z: (FP.RACERS - 1 - i) * -FP.SEG * 2.2 + len, x: (i % 2 ? 0.45 : -0.45), speed: 0, lap: 0, done: false, place: i + 1, item: null, roll: 0,
      spin: 0, boost: 0, drift: 0, dcharge: 0, dir: 0, hop: 0, ink: 0, cols: fpFishColors(r.id), finishT: 0, aiItemT: 2 + Math.random() * 4, aim: 0 });
    if (r.me) r.z = len - FP.SEG * 2.2 * 7.5;            // you start at the back, MK style
  });
  racers.forEach(r => { r.z = ((r.z % len) + len) % len; r.lap = r.z > len / 2 ? -1 : 0; });
  KART = { test: !!test, segs, len, racers, me, t: 0, phase: "count", ct: 3.6, keys: new Set(), shots: [], mines: [], flash: 0, shake: 0, msg: "", msgT: 0, touch: null, ink: 0 };
  S.state = "kart"; S.overlay = null;
}
const fpSeg = z => KART.segs[Math.floor(((z % KART.len) + KART.len) % KART.len / FP.SEG)];
const fpDist = r => r.lap * KART.len + r.z;                         // how far round the race a racer is

// ---- items: weighted by place, like the real thing (the back of the pack gets the good stuff)
const FP_ITEMS = { shrimp: ["TURBO SHRIMP", "#ff8c64"], puffer: ["PUFFERFISH", "#e6c850"], ink: ["INK CLOUD", "#3c3c5a"], urchin: ["URCHIN", "#b45adc"] };
function fpRollItem(place) {
  const w = place <= 2 ? { puffer: 5, urchin: 3, shrimp: 1, ink: 1 } : place <= 5 ? { puffer: 2, urchin: 3, shrimp: 3, ink: 2 } : { shrimp: 5, ink: 3, urchin: 2, puffer: 1 };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k;
  return "shrimp";
}
function fpUseItem(r) {
  const it = r.item; if (!it || r.roll > 0) return;
  r.item = null;
  if (it === "shrimp") { r.boost = Math.max(r.boost, 1.4); if (r.me) play("pulse"); }
  else if (it === "puffer") KART.mines.push({ z: r.z - FP.SEG * 1.5, x: r.x, t: 0 });
  else if (it === "urchin") KART.shots.push({ z: r.z + FP.SEG, x: r.x, owner: r, life: 4 });
  else if (it === "ink") { KART.racers.forEach(o => { if (fpDist(o) > fpDist(r)) { o.ink = 3.5; } }); if (KART.me.ink > 0 && !r.me) { KART.msg = "INKED!"; KART.msgT = 1.5; } play("zap"); }
}
function fpSpin(r, why) { if (r.spin > 0 || r.boost > 1.2) return; r.spin = 1.1; r.drift = 0; r.dcharge = 0; if (r.me) { KART.shake = 0.4; KART.msg = why; KART.msgT = 1.2; play("miss"); } }

// ---- each frame
function kartKey(e, down) {
  const c = e.code;
  if (down) KART.keys.add(c); else KART.keys.delete(c);
  if (!down) return;
  if (c === "Escape" && KART.test) { KART = null; newDive(); return; }
  if (KART.phase === "done" && ["Space", "Enter"].includes(c)) { startKart(KART.test); return; }
  if ((c === "Space" || c === "KeyE" || c === "Enter") && KART.phase === "race") fpUseItem(KART.me);
}
function kartTouch(rx, ly, down) {           // touch: hold the left / right side to steer; buttons for items and drift
  if (!KART) return;
  if (KART.phase === "done") { if (down) startKart(KART.test); return; }
  if (down && ly > 160 && rx > LW - 44) { fpUseItem(KART.me); return; }
  KART.touch = down ? [rx, ly] : null;
}
function kartUpdate(dt) {
  const K = KART;
  K.t += dt; K.flash = Math.max(0, K.flash - dt); K.shake = Math.max(0, K.shake - dt); K.msgT -= dt;
  if (K.phase === "count") { const was = Math.ceil(K.ct); K.ct -= dt; if (Math.ceil(K.ct) !== was && K.ct > 0) play(K.ct < 1 ? "chime" : "tick"); if (K.ct <= 0) { K.phase = "race"; play("select"); } }
  const key = c => K.keys.has(c);
  const me = K.me, lead = K.racers.slice().sort((a, b) => fpDist(b) - fpDist(a));
  lead.forEach((r, i) => { if (!r.done) r.place = i + 1; });
  for (const r of K.racers) {
    if (K.phase === "count") continue;
    const seg = fpSeg(r.z), max = FP.MAX * (r.me ? 0.94 + r.lv[0] * 0.008 : r.skill * fpRubber(r, me)), spdPct = r.speed / FP.MAX;
    let steer = 0, gas = true, brake = false, driftKey = false;
    if (r.me && r.bot && !r.done) { [steer, driftKey] = fpAI(r, seg, dt); }
    else if (r.me && !r.done) {
      steer = heldDir("L", "R"); brake = key("ArrowDown") || key("KeyS"); driftKey = key("ShiftLeft") || key("ShiftRight");
      if (K.touch) steer = K.touch[0] < LW / 2 ? -1 : 1;
    } else { [steer, driftKey] = fpAI(r, seg, dt); }
    r.dir = lerp(r.dir, steer, Math.min(1, dt * 10));
    if (r.spin > 0) { r.spin -= dt; r.speed = Math.max(0, r.speed + FP.BRAKE * 0.35 * dt); continue_(r, seg, dt); continue; }
    // drifting: hold drift while turning to slide and charge a mini-turbo; let go to fire it
    if (driftKey && Math.abs(steer) > 0.3 && spdPct > 0.45 && !r.drift) { r.drift = Math.sign(steer); r.hop = 0.18; r.dcharge = 0; }
    if (r.drift) {
      if (!driftKey || spdPct < 0.3) { const b = r.dcharge > 1.5 ? 0.9 : r.dcharge > 0.8 ? 0.5 : 0; if (b) { r.boost = Math.max(r.boost, b * (0.8 + (r.me ? r.lv[2] : 6) * 0.04)); if (r.me) play("pulse"); } r.drift = 0; r.dcharge = 0; }
      else { r.dcharge += dt * (Math.sign(steer) === r.drift ? 1.25 : 0.6); }
    }
    const turn = r.drift ? (r.drift * 0.45 + steer * 0.75) * FP.DRIFT_STEER : steer * FP.STEER;   // in a drift: hold in to tighten, out to widen
    r.x += turn * dt * spdPct;
    r.x -= dt * spdPct * spdPct * seg.curve * FP.CENTRIFUGAL;   // curves push you outward
    const off = Math.abs(r.x) > 1, top = (off ? max * FP.OFF_MAX : max) * (r.boost > 0 ? 1.35 : 1) * (r.ink > 0 && !r.me ? 0.88 : 1);
    if (brake) r.speed += FP.BRAKE * dt;
    else if (r.speed > top) r.speed += (off ? FP.OFF_DECEL : FP.DECEL * 1.5) * dt;
    else if (gas) r.speed += FP.ACCEL * (0.8 + (r.me ? r.lv[1] : 6) * 0.04) * dt * (1 - r.speed / (top * 1.05));
    if (r.boost > 0) { r.boost -= dt; r.speed = Math.max(r.speed, top * 0.98); }
    r.speed = clamp(r.speed, 0, FP.MAX * 1.5); r.x = clamp(r.x, -2.2, 2.2);
    continue_(r, seg, dt);
  }
  if (K.phase !== "count") fpObjects(dt);
  if (K.phase === "race" && me.done) { K.phase = "done"; K.doneT = K.t; play(me.place === 1 ? "fanfare" : "chime"); }
}
function continue_(r, seg, dt) {             // move along, count laps, item boxes, bumps
  const K = KART, z0 = r.z;
  r.z += r.speed * dt; r.hop = Math.max(0, r.hop - dt); r.ink = Math.max(0, r.ink - dt);
  if (r.roll > 0) { r.roll -= dt; if (r.roll <= 0) r.item = r.rolling; }
  if (r.z >= K.len) { r.z -= K.len; r.lap++; if (r.lap >= FP.LAPS && !r.done) { r.done = true; r.finishT = K.t; if (r.me) { K.msg = "FINISH!"; K.msgT = 3; } } else if (r.me && r.lap === FP.LAPS - 1) { K.msg = "FINAL LAP!"; K.msgT = 2; play("chime"); } }
  const s = fpSeg(r.z);
  if (s !== fpSeg(z0) || true) for (const b of s.boxes) if (!b.gone && Math.abs(b.x - r.x) < 0.22 && !r.item && !(r.roll > 0)) {
    b.gone = 3; r.roll = r.me ? 1.2 : 0.4; r.rolling = fpRollItem(r.place); if (r.me) play("chime");
  }
  for (const o of K.racers) if (o !== r && Math.abs(fpDist(o) - fpDist(r)) < FP.SEG * 0.6 && Math.abs(o.x - r.x) < 0.28) {   // bump
    const push = (r.x < o.x ? -1 : 1) * 0.6 * dt * 8; r.x += push * 0.5; o.x -= push * 0.5;
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
function fpAI(r, seg, dt) {                  // -> [steer, drift]: follow the inside line, dodge mines, use items
  const K = KART, ahead = fpSeg(r.z + FP.SEG * 12);
  const noise = r.bot ? r.bot.noise : 0.12;
  let target = clamp(ahead.curve * 0.12, -0.6, 0.6) + Math.sin(K.t * 0.7 + (r.skill || 1) * 40) * noise;   // the inside of the coming bend
  for (const m of K.mines) { const dz = m.z - r.z; if (dz > 0 && dz < FP.SEG * 8 && Math.abs(m.x - target) < 0.35) target += m.x > target ? -0.45 : 0.45; }
  for (const s of fpSeg(r.z + FP.SEG * 6).boxes) if (!s.gone && !r.item && Math.abs(s.x - target) < 0.4) target = lerp(target, s.x, 0.5);
  const ff = seg.curve * FP.CENTRIFUGAL * (r.speed / FP.MAX) / FP.STEER;      // lean into the curve
  let steer = clamp((target - r.x) * 6 + ff, -1, 1);
  if (r.bot && r.bot.lag) { r.lagSteer = lerp(r.lagSteer || 0, steer, Math.min(1, dt / r.bot.lag)); steer = r.lagSteer; }
  r.aiItemT -= dt;
  if (r.item && r.aiItemT <= 0) {
    const close = K.racers.some(o => o !== r && fpDist(o) > fpDist(r) && fpDist(o) - fpDist(r) < FP.SEG * 15 && Math.abs(o.x - r.x) < 0.4);
    const behind = K.racers.some(o => o !== r && fpDist(r) - fpDist(o) > 0 && fpDist(r) - fpDist(o) < FP.SEG * 10);
    if (r.item === "shrimp" || r.item === "ink" || (r.item === "urchin" && close) || (r.item === "puffer" && behind)) { fpUseItem(r); r.aiItemT = 1.5 + Math.random() * 3; }
  }
  const wantDrift = Math.abs(ahead.curve) > 3 && Math.sign(ahead.curve) === Math.sign(seg.curve || ahead.curve) && Math.abs(r.x - target) < 0.35 && r.speed > FP.MAX * 0.6;
  return [steer, (r.drift ? Math.abs(seg.curve) > 1.5 || Math.abs(ahead.curve) > 2 : wantDrift) && !(r.bot && r.bot.noDrift)];
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
  const camZ = (((me.z - FP.CAM_H * FP.DEPTH * 1.6) % len) + len) % len, base = fpSeg(camZ), bp = (((camZ % FP.SEG) + FP.SEG) % FP.SEG) / FP.SEG;
  const camY = lerp(base.p1.y, base.p2.y, bp) + FP.CAM_H, camX = me.x * FP.ROAD;
  const sh = K.shake > 0 ? Math.round(Math.sin(t * 60) * 2) : 0;
  g.save(); g.translate(sh, 0);
  // the water: a gradient to the surface, light rays, distant rocks moving with the curves
  for (let i = 0; i < 12; i++) rect(fpMix([60, 140, 200], FP_COL.water, i / 11), -4, i * 8, LW + 8, 8);
  rect(fpMix([60, 140, 200], FP_COL.water, 1), -4, 96, LW + 8, LH);
  K.sky = (K.sky || 0) + base.curve * me.speed / FP.MAX * 0.004;
  g.globalAlpha = 0.12; for (let k = 0; k < 6; k++) { const x = ((k * 70 - K.sky * 120 + t * 4) % (LW + 80) + LW + 80) % (LW + 80) - 40; fpQuad("#c8f0ff", x, 0, 6, x - 30, 84, 22); } g.globalAlpha = 1;
  for (let k = 0; k < 14; k++) { const x = ((k * 41 - K.sky * 60) % (LW + 60) + LW + 60) % (LW + 60) - 30, h = 10 + (k * 37) % 18; rect("#163c5e", x, 84 - h, 30, h + 4); rect("#1c4870", x + 4, 84 - h - 4, 18, 6); }
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
    g.fillStyle = fpMix(fpHex(FP_COL.off[alt]), FP_COL.fogNear, fog); g.fillRect(-4, b.y, LW + 8, ya - b.y + 1);
    fpQuad(fpMix(fpHex(FP_COL.rumble[alt]), FP_COL.fogNear, fog), a.x, ya, a.w * 1.12, b.x, b.y, b.w * 1.12);
    fpQuad(fpMix(fpHex(FP_COL.sand[alt]), FP_COL.fogNear, fog), a.x, ya, a.w, b.x, b.y, b.w);
    if (alt) for (const l of [-0.33, 0.33]) fpQuad(fpMix(fpHex(FP_COL.lane), FP_COL.fogNear, fog), a.x + a.w * l, ya, Math.max(0.5, a.w * 0.015), b.x + b.w * l, b.y, Math.max(0.5, b.w * 0.015));
    if (s.i < 2 || (s.i >= 2 && s.i < 4)) fpQuad(Math.floor(s.i) % 2 ? "#fafaff" : "#1a1628", a.x, ya, a.w, b.x, b.y, b.w);   // the start line
    maxY = b.y; drawn.push(s);
  }
  // sprites, far to near: scenery, item boxes, mines, urchins, racers
  for (let n = drawn.length - 1; n >= 0; n--) {
    const s = drawn[n], a = s.a; if (!a || a.z <= FP.DEPTH * 1.2) continue;
    const fog = Math.min(1, n / FP.DRAW * 1.4), at = (ox, w, h) => [a.x + a.w * ox, a.y, w * a.w / 400, h * a.w / 400];
    g.save(); g.beginPath(); g.rect(-4, 0, LW + 8, s.clip); g.clip();
    for (const [k, ox] of s.deco) {
      const [px, py, w, h] = at(ox, k === "kelp" ? 70 : k === "rock" ? 170 : 120, k === "kelp" ? 600 : k === "rock" ? 120 : 150);
      if (w < 0.6) continue;
      if (k === "kelp") { for (let q = 0; q < 10; q++) { const ww = w * (1 - q * 0.06); rect(fpMix(q % 2 ? [46, 150, 76] : [34, 118, 62], FP_COL.fogNear, fog), px - ww / 2 + Math.sin(t * 1.6 + q * 0.6 + s.i) * w * 0.5 * q / 10, py - h * (q + 1) / 10, ww, h / 10 + 1); if (q % 3 === 1 && w > 3) rect(fpMix([60, 170, 90], FP_COL.fogNear, fog), px + ww / 2 + Math.sin(t * 1.6 + q * 0.6 + s.i) * w * 0.5 * q / 10, py - h * (q + 0.5) / 10, w * 0.6, Math.max(1, h / 30)); } }
      else if (k === "rock") { rect(fpMix([70, 80, 96], FP_COL.fogNear, fog), px - w / 2, py - h, w, h); rect(fpMix([96, 108, 124], FP_COL.fogNear, fog), px - w / 3, py - h * 1.2, w * 0.6, h * 0.3); }
      else { rect(fpMix([240, 110, 140], FP_COL.fogNear, fog), px - w / 2, py - h * 0.6, w * 0.2, h * 0.6); rect(fpMix([240, 110, 140], FP_COL.fogNear, fog), px - w * 0.1, py - h, w * 0.2, h); rect(fpMix([240, 110, 140], FP_COL.fogNear, fog), px + w * 0.3, py - h * 0.7, w * 0.2, h * 0.7); }
    }
    for (const bx of s.boxes) if (!bx.gone) {
      const [px, py, w] = at(bx.x, 70, 70), bob = Math.sin(t * 4 + bx.x * 5) * w * 0.1;
      g.globalAlpha = 0.85; rect(fpMix([120, 220, 255], FP_COL.fogNear, fog * 0.5), px - w / 2, py - w * 1.3 + bob, w, w); g.globalAlpha = 1;
      if (w > 4) { rect("#fafaff", px - w / 2, py - w * 1.3 + bob, w, Math.max(1, w * 0.12)); text("?", px, py - w * 0.8 + bob, Math.max(1, Math.round(w / 9)), "#fafaff", "center", null); }
    }
    for (const m of K.mines) if (fpSeg(m.z) === s) { const [px, py, w] = at(m.x, 55, 55); disc("#e6c850", px, py - w * 0.6, Math.max(1, w / 2)); if (w > 6) { rect(INK, px - w * 0.2, py - w * 0.7, 2, 2); rect(INK, px + w * 0.1, py - w * 0.7, 2, 2); } }
    for (const u of K.shots) if (fpSeg(u.z) === s) { const [px, py, w] = at(u.x, 45, 45); disc("#b45adc", px, py - w * 0.6, Math.max(1, w / 2)); for (let q = 0; q < 6; q++) rect("#e6b4ff", px + Math.cos(q + t * 9) * w * 0.7, py - w * 0.6 + Math.sin(q + t * 9) * w * 0.7, 1, 1); }
    for (const r of K.racers) if (!r.me && fpSeg(r.z) === s && fpDist(r) > fpDist(me) - FP.SEG * 0.5) { const [px, py, w0] = at(r.x, 90, 90), w = Math.min(w0, 40); if (w > 1) fpFish(r, px, py, w, fog); }   // (racers behind you aren't drawn: they'd be between you and the camera)
    g.restore();
  }
  // you, big at the bottom
  const pw = 34 + (me.boost > 0 ? 2 : 0), py = LH - 22 - me.hop * 40 + Math.sin(t * 8) * 1;
  fpFish(me, LW / 2 + me.dir * 4, py, pw, 0);
  if (me.drift && me.dcharge > 0.8) for (let q = 0; q < 6; q++) { const sx = LW / 2 + (q % 2 ? -1 : 1) * (pw * 0.45 + Math.random() * 6), sy = LH - 12 - Math.random() * 6; rect(me.dcharge > 1.5 ? ORANGE : "#5ae6ff", sx, sy, 2, 2); }
  if (me.boost > 0) for (let q = 0; q < 8; q++) rect(q % 2 ? "#fafaff" : "#c8f0ff", LW / 2 - 6 + Math.random() * 12, py + 6 + Math.random() * 14, 1, 2);
  // ink on your screen
  if (me.ink > 0) { g.globalAlpha = Math.min(0.85, me.ink / 2); for (let q = 0; q < 7; q++) disc("#14121e", (q * 53 + 30) % LW, 40 + (q * 37) % 110, 18 + (q % 3) * 8); g.globalAlpha = 1; }
  g.restore();
  fpHud();
}
function fpFish(r, x, y, w, fog) {           // a fish seen from behind: body, fins, tail, a flash when boosting
  const [c1, c2] = r.cols, h = w * 0.55, tilt = r.spin > 0 ? Math.sin(r.spin * 20) * 0.9 : r.dir * 0.25 + (r.drift || 0) * 0.3;
  g.save(); g.translate(x, y - h / 2); g.rotate(tilt);
  if (fog > 0.05) g.globalAlpha = 1 - fog * 0.5;
  g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(0, h * 0.62, w * 0.42, h * 0.16, 0, 0, 7); g.fill();     // shadow on the sand
  g.fillStyle = c1; g.beginPath(); g.ellipse(0, 0, w * 0.32, h * 0.5, 0, 0, 7); g.fill();                             // body
  g.fillStyle = c2; g.beginPath(); g.ellipse(0, h * 0.12, w * 0.2, h * 0.28, 0, 0, 7); g.fill();                        // belly
  g.fillStyle = c1; g.beginPath(); g.moveTo(-w * 0.5, h * 0.05); g.lineTo(-w * 0.28, -h * 0.05); g.lineTo(-w * 0.28, h * 0.18); g.fill();   // side fins
  g.beginPath(); g.moveTo(w * 0.5, h * 0.05); g.lineTo(w * 0.28, -h * 0.05); g.lineTo(w * 0.28, h * 0.18); g.fill();
  g.beginPath(); g.moveTo(0, -h * 0.9); g.lineTo(-w * 0.06, -h * 0.4); g.lineTo(w * 0.06, -h * 0.4); g.fill();          // dorsal fin
  const sw = Math.sin(KART.t * 14 + w) * w * 0.08;
  g.fillStyle = c2; g.beginPath(); g.moveTo(sw, h * 0.35); g.lineTo(-w * 0.2 + sw, h * 0.75); g.lineTo(w * 0.2 + sw, h * 0.75); g.fill();   // the tail, wagging
  if (w > 14) { rect(INK, -w * 0.18, -h * 0.18, Math.max(1, w * 0.06), Math.max(1, w * 0.06)); rect(INK, w * 0.12, -h * 0.18, Math.max(1, w * 0.06), Math.max(1, w * 0.06)); }
  g.restore(); g.globalAlpha = 1;
  if (r.boost > 0 && w > 6) { g.globalAlpha = 0.5; rect("#ffe08c", x - w * 0.1, y, w * 0.2, w * 0.3); g.globalAlpha = 1; }
}
const ORD = n => n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH");
function fpTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return m + ":" + (r < 10 ? "0" : "") + r.toFixed(2); }
function fpHud() {
  const K = KART, me = K.me, raceT = Math.max(0, K.t - 3.6);
  text("LAP " + Math.min(FP.LAPS, Math.max(1, me.lap + 1)) + "/" + FP.LAPS, 4, 8, 1, WHITE, "left");
  text(fpTime(me.done ? me.finishT - 3.6 : raceT), LW - 4, 8, 1, WHITE, "right");
  const ic = me.roll > 0 ? Object.keys(FP_ITEMS)[Math.floor(K.t * 12) % 4] : me.item;   // the item box, top middle
  box(LW / 2 - 13, 2, 26, 22, me.item ? GOLD : "#5a6496");
  if (ic) { fpItemIcon(ic, LW / 2, 13); if (me.item) text(KEYS ? "SPACE" : "TAP", LW / 2, 29, 1, GOLD, "center", null); }
  const pl = me.place, col = pl === 1 ? GOLD : pl <= 3 ? "#c8d2f0" : ORANGE;
  text(pl, 14, LH - 20, 3, col, "center"); text(ORD(pl).slice(-2), 26, LH - 22, 1, col, "left");
  if (me.speed > 0) { const sp = Math.round(me.speed / FP.MAX * 100); text(sp + " KN", LW - 4, LH - 8, 1, me.boost > 0 ? ORANGE : "#c8f0ff", "right", null); }
  K.racers.slice().sort((a, b) => a.place - b.place).forEach((r, i) => {                 // the running order, down the right
    if (LW < 200) return;
    const y = 20 + i * 9; rect(r.me ? "#1e285a" : "rgba(0,0,0,0.3)", LW - 62, y - 4, 58, 8);
    text(i + 1, LW - 58, y, 1, r.me ? GOLD : GREY, "left", null); text(r.name.slice(0, 7), LW - 50, y, 1, r.me ? GOLD : WHITE, "left", null);
  });
  if (K.phase === "count") { const n = Math.ceil(K.ct - 0.6); text(n > 0 ? String(n) : "GO!", LW / 2, 80, 4, n > 0 ? WHITE : LIME, "center"); }
  else if (K.msgT > 0 && K.phase === "race") text(K.msg, LW / 2, 70, 2, GOLD, "center");
  if (K.test && K.phase !== "done") text(KEYS ? "TEST  ESC: QUIT" : "TEST", 4, 18, 1, GREY, "left", null);
  if (K.phase === "race" && K.t < 8) (KEYS ? ["A D: STEER   S: BRAKE", "HOLD SHIFT IN A TURN: DRIFT", "SPACE: USE ITEM"] : ["HOLD A SIDE TO STEER"]).forEach((l, i) => text(l, LW / 2, 104 + i * 10, 1, WHITE, "center", null));
  if (K.phase === "done") fpResults();
}
function fpItemIcon(k, x, y) {
  if (k === "shrimp") { rect("#ff8c64", x - 6, y - 2, 10, 5); rect("#ffb48c", x + 3, y - 4, 4, 4); rect(INK, x + 5, y - 3, 1, 1); for (let q = 0; q < 3; q++) rect("#ff8c64", x - 8 - q, y + 3 - q, 2, 1); }
  else if (k === "puffer") { disc("#e6c850", x, y, 6); for (let q = 0; q < 8; q++) rect("#b49628", x + Math.cos(q * 0.8) * 7, y + Math.sin(q * 0.8) * 7, 1, 1); rect(INK, x - 3, y - 2, 2, 2); rect(INK, x + 1, y - 2, 2, 2); }
  else if (k === "ink") { disc("#3c3c5a", x, y + 1, 6); disc("#3c3c5a", x - 4, y - 3, 3); disc("#3c3c5a", x + 4, y - 3, 3); }
  else { disc("#b45adc", x, y, 5); for (let q = 0; q < 8; q++) rect("#e6b4ff", x + Math.cos(q * 0.8) * 7, y + Math.sin(q * 0.8) * 7, 1, 1); }
}
function fpResults() {
  const K = KART, order = K.racers.slice().sort((a, b) => (a.done && b.done ? a.finishT - b.finishT : b.done - a.done || fpDist(b) - fpDist(a))), w = 150, x = LW / 2 - w / 2;
  g.globalAlpha = 0.88; rect(INK, x, 30, w, 140); g.globalAlpha = 1; outline(x, 30, w, 140, GOLD);
  text(K.me.place === 1 ? "YOU WIN!" : ORD(K.me.place) + " PLACE", LW / 2, 40, 2, K.me.place === 1 ? GOLD : WHITE, "center");
  order.forEach((r, i) => { const y = 58 + i * 12; text(ORD(i + 1), x + 8, y, 1, i < 3 ? GOLD : GREY, "left", null); fitDraw(atlas, r.id, x + 44, y, 18, 9, 1); text(r.name.slice(0, 9), x + 56, y, 1, r.me ? GOLD : WHITE, "left", null); if (r.done) text(fpTime(r.finishT - 3.6), x + w - 6, y, 1, "#c8d2f0", "right", null); });
  if (Math.floor(K.t * 2) % 2) text(KEYS ? "SPACE: RACE AGAIN" + (K.test ? "  ESC: QUIT" : "") : "TAP TO RACE AGAIN", LW / 2, 162, 1, WHITE, "center", null);
}

window.FPX = { FP_TUNE, get K() { return KART; }, startKart, FP, fpDist, fpTrack, kartUpdate,
  race(bot) {                               // simulate one whole race with a robot driving: -> stats
    startKart(true, bot); const K = KART; let off = 0, n = 0;
    while (!K.me.done && K.t < 400) { kartUpdate(1 / 60); K.racers.forEach(r => { if (!r.me) { n++; if (Math.abs(r.x) > 1) off++; } }); }
    const order = K.racers.slice().sort((a, b) => (a.done && b.done ? a.finishT - b.finishT : b.done - a.done || fpDist(b) - fpDist(a)));
    return { place: order.indexOf(K.me) + 1, time: K.me.finishT - 3.6, aiOff: off / n, first: order[0].done ? order[0].finishT - 3.6 : 0 };
  } };   // handy in the console and the tests
if (TEST_FP) { const w = setInterval(() => { if (S && atlas) { clearInterval(w); startKart(true); } }, 50); }   // the test link: ?finprix (once the game is up)
