// THE DERBY, reworked (Nov 18, 2026). Loaded after game.js; uses its globals (TAV, tav, store, RNG, EDGE, SPEC, play...).
// - A stable of 20 named racers who come back race after race, each with fixed stats and a trait. Their form (last five
//   finishes) and this week's points come from the races you watch (saved in tav.stable).
// - Course conditions (calm, current, kelp, jellyfish, storm) that suit some traits and not others.
// - Bet types: WIN, PLACE (top 2), SHOW (top 3), EXACTA (1st and 2nd in order), TRIFECTA (top 3 in order). Every price
//   comes from simulating the race 2,000 times with the real stats and conditions, so the house keeps about 5% whatever
//   you read into the form.
// - A scrolling course with scenery, an announcer, slow motion and a photo finish when it's close, and cheering (for
//   show: it changes nothing).
// - Your own racer no longer runs here (a trained one won every time and the x1.1 minimum made it free chips); it's
//   for FIN PRIX.
"use strict";
// [key, name, species, speed, stamina, burst, trait]. Append only: saves keep form and points by key.
const STABLE = [
  ["bigtuna", "BIG TUNA", "tuna", 1.03, 0.80, 0.45, "steady"], ["koiboy", "KOI BOY", "koi", 1.00, 0.72, 0.55, "closer"],
  ["clownshoes", "CLOWNSHOES", "clown", 0.97, 0.66, 0.75, "moody"], ["bassdrop", "BASS DROP", "bass", 1.01, 0.70, 0.60, "sprinter"],
  ["parrotjr", "PARROT JR", "parrot", 0.99, 0.78, 0.50, "kelp"], ["hotsauce", "HOT SAUCE", "ember", 1.04, 0.62, 0.65, "storm"],
  ["troutabout", "TROUT ABOUT", "trout", 0.98, 0.82, 0.35, "steady"], ["perchy", "PERCHY", "perch", 0.96, 0.75, 0.70, "current"],
  ["swordsam", "SWORDFISH SAM", "sword", 1.05, 0.64, 0.40, "sprinter"], ["marlinator", "MARLINATOR", "marlin", 1.02, 0.70, 0.55, "closer"],
  ["puffball", "PUFFBALL", "puffer", 0.95, 0.85, 0.45, "dodger"], ["slipperypete", "SLIPPERY PETE", "eel", 1.00, 0.68, 0.70, "current"],
  ["pancake", "PANCAKE", "ray", 0.99, 0.76, 0.52, "kelp"], ["oldgrouper", "OLD GROUPER", "grouper", 0.96, 0.88, 0.30, "steady"],
  ["halo", "HALO", "angel", 0.98, 0.70, 0.62, "storm"], ["inky", "INKY", "octo", 0.97, 0.74, 0.68, "dodger"],
  ["shelldon", "SHELLDON", "turtle", 0.94, 0.90, 0.40, "closer"], ["chompers", "CHOMPERS", "blacktip", 1.04, 0.66, 0.50, "sprinter"],
  ["glowworm", "GLOWWORM", "lantern", 0.97, 0.72, 0.66, "dodger"], ["tinytim", "TINY TIM", "minnow", 0.95, 0.70, 0.85, "moody"],
];
const TRAITS = { steady: "STEADY", closer: "STRONG FINISH", moody: "MOODY", sprinter: "FAST STARTER", kelp: "LOVES KELP", storm: "STORM CHASER", current: "RIDES CURRENTS", dodger: "DODGES JELLIES" };
const CONDS = [["calm", "CALM WATER"], ["current", "STRONG CURRENT"], ["kelp", "KELP BEDS"], ["jelly", "JELLYFISH"], ["storm", "STORM SURGE"]];
const BET_TYPES = [["WIN", 1, 100], ["PLACE", 1, 50], ["SHOW", 1, 25], ["EXACTA", 2, 1000], ["TRIFECTA", 3, 5000]];   // [name, picks, top multiplier]
const derbyMaxWin = (d, st) => Math.max(d.vip ? 10000 : 5000, (st || 0) * (d.vip ? 50 : 5000 / BASE_STAKE));   // big bets keep the room a max bet had (x66, VIP x50)             // the house pays at most this on one bet (so one wild trifecta can't buy the whole shop; VIP was 20,000 until Nov 18, 2026)
const DERBY_SIMS = 2000, PTS = [10, 6, 4, 3, 2, 1];
const ORDN = n => n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH");

// ---- the stable's record: form and weekly points, in the save
function stableRec() {
  const q = tav();
  if (!q.stable || typeof q.stable !== "object") q.stable = { form: {}, pts: {}, week: "", champ: "", lastChamp: "" };
  const st = q.stable, wk = weekString();
  if (st.week !== wk) {                                      // a new week: crown last week's champion, reset the points
    const best = Object.entries(st.pts || {}).sort((a, b) => b[1] - a[1])[0];
    if (st.week && best) st.lastChamp = best[0];
    st.pts = {}; st.week = wk;
  }
  if (!st.seeded) {                                          // first visit: a few races already run, so the form isn't empty
    st.seeded = true; const rng = RNG((Math.random() * 4294967296) >>> 0);
    for (let n = 0; n < 14; n++) { const f = derbyField(rng, false), c = rng.choice(CONDS)[0]; stableResult(f, simRace(f.map(r => Object.assign({}, r)), c, rng, 1.0, 99), false); }
    st.pts = {};                                             // the seeded races count for form, not this week's points
  }
  return st;
}
function stableResult(field, order, points) {                // order: field indexes, first to last
  const st = tav().stable;
  order.forEach((i, place) => {
    const k = field[i].key;
    st.form[k] = [place + 1].concat(st.form[k] || []).slice(0, 5);
    if (points) st.pts[k] = (st.pts[k] || 0) + (PTS[place] || 0);
  });
}
const stableBy = k => STABLE.find(s => s[0] === k);
function derbyField(rng, vip) {                              // six racers (seven of the week's best in the back room)
  let keys = STABLE.map(s => s[0]);
  if (vip) { const pts = (tav().stable && tav().stable.pts) || {}; keys = keys.slice().sort((a, b) => (pts[b] || 0) - (pts[a] || 0) || rng.random() - 0.5).slice(0, 7); }
  else { for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rng.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; } keys = keys.slice(0, 6); }
  return keys.map(k => { const s = stableBy(k); return { key: k, name: s[1], id: SPEC[s[2]] ? s[2] : "minnow", spd: s[3], sta: s[4], bur: s[5], trait: s[6] }; });
}

// ---- the race itself (the same steps for the real race and the 2,000 practice races that set the prices)
function racerMods(r, cond) {                                // how today's water suits this racer -> [speed, stamina, burst, stall]
  let sp = 1, sa = 1, bu = 1, stl = 1;
  if (cond === "current") { if (r.trait === "current") sp = 1.06; else sa = 0.95; }
  if (cond === "kelp") { if (r.trait !== "kelp") sp = 0.95; }
  if (cond === "jelly") { if (r.trait !== "dodger") stl = 1.7; }
  if (cond === "storm") { bu = r.trait === "storm" ? 1.7 : 1.2; }
  if (r.trait === "steady") { stl *= 0.4; bu *= 0.6; }
  if (r.trait === "moody") { stl *= 1.5; bu *= 1.5; }
  return [sp, sa, bu, stl];
}
function raceStep(r, dt, rng) {                              // move one racer along; -> an event for the commentator, or null
  let ev = null;
  const m = r.m || [1, 1, 1, 1], sta = Math.min(0.97, r.sta * m[1]);
  if (r.burst > 0) r.burst -= dt; else if (r.stall > 0) r.stall -= dt;
  else if (rng.random() < r.bur * m[2] * 0.45 * dt) { r.burst = 0.8; ev = "burst"; }
  else if (rng.random() < (1 - sta) * m[3] * 0.35 * dt) { r.stall = 0.6; ev = "stall"; }
  let phase = 1;
  if (r.trait === "sprinter") phase = r.pos < 0.3 ? 1.08 : 0.98;
  if (r.trait === "closer") phase = r.pos > 0.7 ? 1.09 : 0.985;
  const tired = 1 - r.pos * (1 - sta) * 0.55;
  r.pos += dt / (8.5 * (r.len || 1)) * r.spd * m[0] * phase * tired * (r.burst > 0 ? 1.7 : r.stall > 0 ? 0.25 : 1);
  return ev;
}
function simRace(rs, cond, rng, len, keep) {                 // -> finishing order (indexes); stops once `keep` have finished
  rs.forEach(r => { r.pos = 0; r.burst = 0; r.stall = 0; r.len = len; r.m = racerMods(r, cond); });
  const done = [];
  for (let guard = 0; done.length < Math.min(keep, rs.length) && guard < 4000; guard++)
    for (let i = 0; i < rs.length; i++) if (!done.includes(i)) { raceStep(rs[i], 0.05, rng); if (rs[i].pos >= 1) done.push(i); }
  return done.concat(rs.map((r, i) => i).filter(i => !done.includes(i)).sort((a, b) => rs[b].pos - rs[a].pos));
}
const derbyPay = (p, cap) => { const x = EDGE / p; return Math.min(cap, Math.max(1.1, x >= 10 ? Math.round(x) : Math.round(x * 10) / 10)); };   // rounded to the nearest, not down
function derbyNew(_, vip) {                                  // (the first argument used to be "race your own fish")
  stableRec();
  const rng = RNG((Math.random() * 4294967296) >>> 0), racers = derbyField(rng, vip), len = vip ? 1.5 : 1, cond = rng.choice(CONDS)[0];
  const sim = RNG(rng.randint(1, 1e9)), n = racers.length, win = Array(n).fill(0), top2 = Array(n).fill(0), top3 = Array(n).fill(0), ex = {}, tri = {};
  for (let k = 0; k < DERBY_SIMS; k++) {                     // the practice races that set every price
    const o = simRace(racers.map(r => ({ spd: r.spd, sta: r.sta, bur: r.bur, trait: r.trait })), cond, sim, len, 3);
    win[o[0]]++; top2[o[0]]++; top2[o[1]]++; top3[o[0]]++; top3[o[1]]++; top3[o[2]]++;
    ex[o[0] + "-" + o[1]] = (ex[o[0] + "-" + o[1]] || 0) + 1; const t = o[0] + "-" + o[1] + "-" + o[2]; tri[t] = (tri[t] || 0) + 1;
  }
  racers.forEach(r => { r.pos = 0; r.burst = 0; r.stall = 0; r.len = len; r.m = racerMods(r, cond); });
  const max = MAX_STAKE, old = TAV.derby;
  TAV.derby = { vip: !!vip, max, phase: "pick", racers, cond, counts: { win, top2, top3, ex, tri }, type: old && !!old.vip === !!vip ? old.type : 0, picks: [], focus: 0,
    bet: stakeStep(old && !!old.vip === !!vip ? old.bet : vip ? 50 : 10, 0, max), call: CONDS.find(c => c[0] === cond)[1] + " TODAY. PLACE YOUR BET", t: 0, lead: -1, rng, cheer: 0, cam: 0, slow: 0 };
}
function derbyPays(d, type, picks, stake) {                  // the price of a bet: type, picked fish (field indexes), stake
  const c = d.counts, [, need, typeCap] = BET_TYPES[type], N = DERBY_SIMS, n = d.racers.length;
  if (picks.length < need) return 0;
  const cap = Math.max(1.1, Math.min(typeCap, Math.floor(derbyMaxWin(d, stake || d.bet) / Math.max(5, stake || d.bet || 5))));
  if (type < 3) { const h = [c.win, c.top2, c.top3][type][picks[0]]; return derbyPay((h + 0.5) / (N + 1), cap); }
  // exotics: 2,000 practice races can't see the rare combinations clearly, so blend the count with the standard
  // Harville estimate built from each fish's chance to win (p(a then b) = pa * pb / (1 - pa), and so on)
  const pw = i => (c.win[i] + 0.5) / (N + n * 0.5), [a, b, e] = picks;
  const ph = type === 3 ? pw(a) * pw(b) / (1 - pw(a)) : pw(a) * pw(b) / (1 - pw(a)) * pw(e) / Math.max(0.01, 1 - pw(a) - pw(b));
  const h = type === 3 ? c.ex[a + "-" + b] || 0 : c.tri[a + "-" + b + "-" + e] || 0, K = type === 3 ? 400 : 800;
  return derbyPay((h + K * ph) / (N + K) / (type === 3 ? 0.98 : 0.94), cap);   // Harville runs a little kind to long shots; measured with DERBY.exact
}
function derbyPick(d, i) {                                   // tap a fish: pick it (exotics: in finishing order); tap again to unpick
  d.focus = i;
  const need = BET_TYPES[d.type][1], at = d.picks.indexOf(i);
  if (at >= 0) d.picks.splice(at, 1);
  else if (need === 1) d.picks = [i];
  else if (d.picks.length < need) d.picks.push(i);
  else d.picks = d.picks.slice(1).concat([i]);
  play("tick");
}
function derbySetType(d, t) { d.type = (t + BET_TYPES.length) % BET_TYPES.length; d.picks = d.picks.slice(0, BET_TYPES[d.type][1]); play("tick"); }
function derbyGo() {
  const d = TAV.derby, need = BET_TYPES[d.type][1];
  if (d.picks.length < need) { play("miss"); d.call = "PICK " + need + " FISH FIRST"; return; }
  if (tav().chips < d.bet || d.bet < 1) { play("miss"); d.call = "NOT ENOUGH CHIPS"; return; }
  addChips(-d.bet); d.pays = derbyPays(d, d.type, d.picks, d.bet); d.phase = "race"; d.t = 0; d.call = "AND THEY'RE OFF!"; d.first = d.racers.map(() => 0); play("select");
}
function derbyCheer() { const d = TAV.derby; d.cheer = Math.min(1, d.cheer + 0.12); if (d.cheer >= 1 && !d.wild) { d.wild = 1.5; d.call = "THE CROWD GOES WILD!"; d.lastSay = d.t; play("fanfare"); } else play("tick"); }
function derbyTick(dt) {
  const d = TAV.derby;
  if (!d) return;
  d.cheer = Math.max(0, d.cheer - dt * 0.25); d.wild = Math.max(0, (d.wild || 0) - dt); d.flash = Math.max(0, (d.flash || 0) - dt);
  if (d.phase === "photo") { d.photoT -= dt; if (d.photoT <= 0) derbyFinish(d); return; }
  if (d.phase !== "race") return;
  const order = () => d.racers.map((r, i) => i).sort((a, b) => d.racers[b].pos - d.racers[a].pos);
  let o = order();
  const close = d.racers[o[0]].pos > 0.9 && d.racers[o[0]].pos - d.racers[o[1]].pos < 0.025;
  d.slow = close ? Math.min(1, d.slow + dt * 3) : Math.max(0, d.slow - dt * 3);
  dt *= 1 - d.slow * 0.65;                                   // slow motion when it's neck and neck at the end
  d.t += dt;
  const say = (txt, force) => { if (!d.lastSay || d.t - d.lastSay > 1.2 || force) { d.call = txt; d.lastSay = d.t; } };
  for (const r of d.racers) {
    if (r.done) continue;
    const ev = raceStep(r, dt, d.rng);
    if (ev === "burst") say(r.name + (d.cond === "storm" && r.trait === "storm" ? " RIDES THE STORM!" : " TURNS ON THE JETS!"));
    else if (ev === "stall") say(r.name + (d.cond === "jelly" ? " GETS STUNG!" : d.cond === "kelp" ? " IS TANGLED IN KELP!" : " STOPS TO LOOK AT A ROCK"));
  }
  o = order();
  if (d.t < 1.5 && d.t + dt >= 1.5 && d.cond !== "calm") say(CONDS.find(c => c[0] === d.cond)[1] + " OUT THERE TODAY!");
  if (o[0] !== d.lead && d.t > 0.8) {
    const was = d.lead; d.lead = o[0];
    const r = d.racers[o[0]];
    say(d.first[o[0]] === 0 && d.t > 3 && was >= 0 && d.racers.length - 1 === d.worst ? r.name + " FROM THE BACK!" : r.name + " TAKES THE LEAD!");
    d.first[o[0]]++;
  }
  d.worst = o[o.length - 1];
  if (d.racers[o[0]].pos > 0.8 && !d.stretch) { d.stretch = true; say("HERE COMES THE FINISH!", true); }
  if (d.racers[o[0]].pos < 1) return;
  d.order = o; d.closeFinish = d.racers[o[1]].pos > 0.975;
  if (d.closeFinish) { d.phase = "photo"; d.photoT = 0.9; d.flash = 0.25; d.call = "PHOTO FINISH!"; play("zap"); }
  else derbyFinish(d);
}
function derbyFinish(d) {
  const o = d.order, w = d.racers[o[0]], c = d.closeFinish;
  d.phase = "done"; d.winner = o[0];
  d.call = w.name + " WINS" + (c ? " BY A FIN!" : "!");
  const need = BET_TYPES[d.type][1], p = d.picks;
  const won = d.type === 0 ? o[0] === p[0] : d.type === 1 ? o.slice(0, 2).includes(p[0]) : d.type === 2 ? o.slice(0, 3).includes(p[0])
    : o.slice(0, need).every((x, k) => x === p[k]);
  if (won) {
    const pay = Math.round(d.bet * d.pays); addChips(pay, "win"); tav().stats.derbies++;
    if (d.pays >= 8) tavAward("longshot");
    if (d.type === 4) tavAward("calledit");
    if (c) tavAward("photo");                                // won on a photo finish
    tavTitles(); d.won = pay; play("fanfare");
  } else { d.won = 0; play("miss"); }
  stableResult(d.racers, o, true);
  saveStore(); tavPost();
}

// ---- drawing: a scrolling course
const derbyLane = d => d.racers.length > 6 ? 14 : 15;
const DERBY_COND_COL = { calm: [[40, 120, 200], [20, 70, 150]], current: [[40, 130, 210], [16, 80, 160]], kelp: [[40, 120, 150], [20, 70, 100]], jelly: [[60, 100, 190], [30, 50, 130]], storm: [[30, 60, 100], [12, 26, 54]] };
function derbyLanes(d) {                                     // the course, the racers and the progress bar -> y below the lanes
  const t = T, n = d.racers.length, LH_ = derbyLane(d), y0 = 22, y1 = y0 + n * LH_, by = y1 + 4, W = LW * (d.vip ? 3.5 : 2.5), fin = W - 14;
  const lead = Math.max(...d.racers.map(r => r.pos)), camT = d.phase === "pick" ? 0 : clamp(16 + lead * (fin - 16) - LW * 0.62, 0, W - LW);
  d.cam = d.phase === "pick" ? 0 : lerp(d.cam || 0, camT, 0.15);
  const cx = Math.round(d.cam), [ca, cb] = DERBY_COND_COL[d.cond];
  for (let i = 0; i < 14; i++) rect(lerpCol(ca, cb, i / 13), 0, i * 15, LW, 15);
  if (d.cond === "storm" && Math.floor(t * 3) % 7 === 0 && Math.random() < 0.3) { g.globalAlpha = 0.25; rect(WHITE, 0, 0, LW, LH); g.globalAlpha = 1; }   // lightning
  for (let k = 0; k < 12; k++) {                              // scenery behind the lanes, scrolling slower (parallax)
    const wx = k * 70 + 20, x = Math.round(wx - cx * 0.5) % (W) ; if (x < -20 || x > LW + 20) continue;
    if (d.cond === "kelp" || k % 3 === 0) for (let q = 0; q < 6; q++) rect(q % 2 ? "#2e8a50" : "#22703e", x + Math.sin(t * 1.5 + q * 0.7 + k) * 2, y0 - 4 - q * 3, 3, 3);
    else rect("#2a4e78", x, y0 - 8, 14, 8);
  }
  for (let i = 0; i <= n; i++) for (let x = -(cx % 6); x < LW; x += 6) rect("#8cc8f0", x, y0 + i * LH_, 3, 1);
  if (d.cond === "current") for (let k = 0; k < 18; k++) { const x = ((k * 37 + t * 90) % (LW + 30)) - 15, y = y0 + 3 + (k * 13) % (n * LH_ - 4); rect("#c8ecff", x, y, 8, 1); }
  if (d.cond === "kelp") for (let k = 0; k < 10; k++) { const x = Math.round(k * 120 + 60 - cx) ; if (x < -6 || x > LW + 6) continue; const y = y0 + ((k * 3) % n) * LH_; rect("#2e8a50", x, y + 2, 2, LH_ - 3); rect("#3cae64", x + 2, y + 4, 2, 2); }
  if (d.cond === "jelly") for (let k = 0; k < 8; k++) { const x = Math.round(k * 150 + 90 - cx), y = y0 + ((k * 5 + 2) % n) * LH_ + 3 + Math.round(Math.sin(t * 2 + k) * 2); if (x > -10 && x < LW + 10 && DATA.atlas.jelly) spr("jelly", x, y, false); }
  const fx = Math.round(fin - cx);                            // the start gate and the finish line
  if (16 - cx > -4) rect("#c8ecff", 13 - cx, y0, 1, n * LH_);
  if (fx < LW + 6) { for (let y = y0; y < y1; y += 3) { const o = Math.floor(y / 3) % 2; rect(o ? WHITE : INK, fx, y, 3, 3); rect(o ? INK : WHITE, fx + 3, y, 3, 3); } rect("#ff4646", fx - 2, y0 - 8, 10, 6); text("END", fx + 3, y0 - 5, 1, WHITE, "center", null); }
  const need = BET_TYPES[d.type][1];
  d.racers.forEach((r, i) => {
    const y = y0 + (LH_ >> 1) + i * LH_, [w, h] = sprSize(r.id), moving = d.phase === "race" || d.phase === "photo", pk = d.picks.indexOf(i);
    const x = Math.floor(14 + Math.min(1, r.pos) * (fin - 14 - w) - cx) + (d.phase === "race" ? Math.round(Math.sin(t * 8 + i)) : 0);
    if (pk >= 0 || (d.phase === "pick" && i === d.focus)) rect(pk >= 0 ? "#2a5a9a" : "#1e4a7a", 0, y - (LH_ >> 1) + 1, LW, LH_ - 1);
    if (d.phase === "pick") fitDraw(atlas, r.id, 22, y, 18, 10, 1);   // before the race: a small icon beside the name
    else if (x + w < 0) { text("<" + (i + 1), 2, y, 1, pk >= 0 ? GOLD : WHITE, "left", null); }   // off the left edge
    else {
      spr(r.id, x, y - (h >> 1) + (moving ? Math.round(Math.sin(t * 6 + i * 2)) : 0), false);
      if (moving) for (let k = 1; k < 4; k++) rect(r.burst > 0 ? WHITE : "#c8ecff", x - k * (r.burst > 0 ? 6 : 4), y + ((k + i) % 2), r.burst > 0 ? 2 : 1, 1);
      if (r.stall > 0 && moving) text("?", x + w / 2, y - h / 2 - 3, 1, WHITE, "center", null);
    }
    if (d.phase === "pick") {
      text(String(i + 1), 6, y, 1, pk >= 0 ? GOLD : WHITE, "center", null);
      text(r.name.slice(0, LW >= 300 ? 13 : 8), 36, y, 1, pk >= 0 ? GOLD : "#c8ecff", "left", null);
      const lab = need > 1 ? (pk >= 0 ? ORDN(pk + 1) : "") : "X" + derbyPays(d, d.type, [i]);
      text(lab, LW - 6, y, 1, pk >= 0 ? GOLD : need > 1 ? WHITE : GOLD, "right", null);
      if (LW >= 300) { const f = (tav().stable.form[r.key] || []).slice(0, 5); text(f.length ? f.join("-") : "NEW", LW - 50, y, 1, "#8cc8f0", "right", null); }
    }
    if (d.phase === "done") { const pl = d.order.indexOf(i) + 1; text(ORDN(pl), Math.min(LW - 6, Math.max(x + w + 18, 30)), y, 1, pl === 1 ? GOLD : pl <= 3 ? WHITE : GREY, "right", null); }
  });
  if (d.phase !== "pick") {                                   // the whole race at a glance
    rect("#0a2a4a", 16, 14, LW - 32, 3);
    d.racers.forEach((r, i) => rect(d.picks.includes(i) ? GOLD : "#c8ecff", 16 + Math.round(Math.min(1, r.pos) * (LW - 34)), 13, 2, 5));
  }
  const condName = CONDS.find(c => c[0] === d.cond)[1], condCol = d.cond === "calm" ? "#c8ecff" : ORANGE;
  if (LW >= 200) { text(d.vip ? "VIP DERBY" : "THE DERBY", d.phase === "pick" ? LW / 2 : 4, 7, 1, GOLD, d.phase === "pick" ? "center" : "left", null); text(condName, LW - 4, 7, 1, condCol, "right", null); }
  else text(condName, LW / 2, 7, 1, condCol, "center", null);           // a phone: just today's water
  if (d.wild > 0 || d.cheer > 0.05) for (let k = 0; k < Math.round(d.cheer * 14 + (d.wild > 0 ? 10 : 0)); k++) rect([GOLD, "#ff8cd2", "#5ae6ff", LIME][k % 4], (k * 53 + Math.floor(t * 30) * 7) % LW, 2 + (k * 7 + Math.floor(t * 20)) % 10, 2, 2);
  if (d.flash > 0) { g.globalAlpha = d.flash * 3; rect(WHITE, 0, 0, LW, LH); g.globalAlpha = 1; }
  if (d.phase === "photo") { outline(4, y0 - 2, LW - 8, n * LH_ + 4, WHITE); text("PHOTO FINISH", LW / 2, y0 + n * LH_ / 2, 2, WHITE, "center"); }
  return by;
}
function derbyBetLine(d) {                                   // what you've picked and what it pays
  const [name, need] = BET_TYPES[d.type];
  if (d.picks.length < need) return need > 1 ? "PICK " + ORDN(d.picks.length + 1) + " PLACE" : "PICK A FISH";
  const p = d.phase === "pick" ? derbyPays(d, d.type, d.picks, d.bet) : d.pays;
  return (LW >= 200 ? name + " " : "") + d.picks.map(i => i + 1).join("-") + " PAYS X" + p;
}
function drawDerby() {
  const d = TAV.derby, by = derbyLanes(d);
  g.save(); g.translate(OX, 0);
  if (d.phase === "pick") {
    box(2, by, 16, 11, CHIP); text("<", 10, by + 5, 1, CHIP, "center", null); box(102, by, 16, 11, CHIP); text(">", 110, by + 5, 1, CHIP, "center", null);
    text(BET_TYPES[d.type][0], 60, by + 5, 1, GOLD, "center", null);
    text(derbyBetLine(d), 60, by + 18, 1, WHITE, "center", null);
    stakeRow(by + 27, d.bet, "RACE");
    box(30, 170, 60, 11, "#5a8cb4"); text("STANDINGS", 60, 175, 1, "#8cc8f0", "center", null);
  } else {
    box(2, by, 116, 24, WHITE);
    wrap(d.call, 18).slice(0, 2).forEach((l, i) => text(l, 60, by + 6 + i * 10, 1, WHITE, "center", null));
    text(derbyBetLine(d), 60, by + 32, 1, GOLD, "center", null);
    if (d.phase === "done") text(d.won ? "YOU WIN " + fmtChips(d.won, 1e6) + " CHIPS!" : "NOT THIS TIME", 60, by + 43, 1, CHIP, "center", null);
    else text("TAP TO CHEER", 60, by + 43, 1, "#8cc8f0", "center", null);
  }
  text(d.phase === "race" || d.phase === "photo" ? "" : d.phase === "done" ? "TAP FOR ANOTHER RACE" : "TAP HERE TO LEAVE", 60, 194, 1, WHITE, "center", null);
  g.restore();
}
function derbyTap(lx, ly) {                                  // the phone layout's taps (lx in the 120 column)
  const d = TAV.derby;
  if (d.phase === "race") { derbyCheer(); return true; }
  if (d.phase === "photo") return true;
  if (d.phase === "done") { derbyNew(0, d.vip); return true; }
  const L_ = derbyLane(d), n = d.racers.length, by = 22 + n * L_ + 4;
  if (ly >= 22 && ly < 22 + n * L_) derbyPick(d, clamp(Math.floor((ly - 22) / L_), 0, n - 1));
  else if (ly >= by && ly < by + 12) derbySetType(d, d.type + (lx > 60 ? 1 : -1));
  else if (ly >= by + 25 && ly < by + 44) stakeTap(lx, d, "bet", derbyGo);
  else if (ly >= 168 && ly < 183 && lx >= 30 && lx < 90) { TAV.tableSel = 0; openOverlay("derbytable"); }
  else if (ly > 189) closeOverlay();
  return true;
}
// the wide (PC) layout: the bet panel on the left, the picked fish's card on the right
function derbyWideHits() {
  const x0 = WX(), d = TAV.derby, by = 22 + d.racers.length * derbyLane(d) + 4, h = [];
  if (d.phase !== "pick") return h;
  let tx = x0; BET_TYPES.forEach((b, i) => { const w = b[0].length * 6 + 6; h.push(["type", tx, by, w, 12, i]); tx += w + 4; });
  h.push(["minus", x0 + 216, by + 46, 20, 18, -1], ["plus", x0 + 276, by + 46, 20, 18, 1], ["max", x0 + 176, by + 46, 36, 18, STAKE_MAX], ["stakebox", x0 + 237, by + 46, 38, 18, STAKE_TYPE], ["race", x0 + 300, by + 46, 48, 18, 0], ["table", x0, by + 50, 70, 14, 0]);
  return h;
}
function drawDerbyWide() {
  const d = TAV.derby, by = derbyLanes(d), x0 = WX();
  chipsAt(x0 + 348, LH - 9, "right");
  if (d.phase === "pick") {
    for (const [id, x, y, w, h, v] of derbyWideHits()) {
      if (id === "type") { const on = v === d.type; rect(on ? "#1e4a7a" : "#0c2a4a", x, y, w, h); outline(x, y, w, h, on ? GOLD : "#3c6a9a"); text(BET_TYPES[v][0], x + w / 2, y + 6, 1, on ? GOLD : "#8cc8f0", "center", null); }
      else if (id === "minus" || id === "plus") btn(x, y, w, h, id === "minus" ? "-" : "+", CHIP);
      else if (id === "max") btn(x, y, w, h, "MAX", CHIP);
      else if (id === "stakebox") outline(x, y, w, h, "#1e4a6a");
      else if (id === "race") btn(x, y, w, h, "RACE", d.picks.length >= BET_TYPES[d.type][1] ? GOLD : GREY);
      else btn(x, y, w, h, "STANDINGS", "#8cc8f0");
    }
    text(fmtChips(d.bet, 1e6), x0 + 256, by + 55, 1, WHITE, "center", null);
    text(["ONE FISH TO WIN", "ONE FISH IN THE TOP 2", "ONE FISH IN THE TOP 3", "1ST AND 2ND, IN ORDER", "1ST, 2ND AND 3RD, IN ORDER"][d.type], x0 + 104, by + 20, 1, "#8cc8f0", "center", null);
    text(derbyBetLine(d), x0 + 104, by + 32, 1, GOLD, "center", null);
    const r = d.racers[d.focus], st = tav().stable, f = st.form[r.key] || [];
    rect("#0c2a4a", x0 + 216, by, 132, 42); outline(x0 + 216, by, 132, 42, "#3c6a9a");
    fitDraw(atlas, r.id, x0 + 232, by + 12, 26, 16, 1);
    text(r.name, x0 + 250, by + 7, 1, WHITE, "left", null);
    text(TRAITS[r.trait], x0 + 250, by + 17, 1, ORANGE, "left", null);
    text("FORM " + (f.length ? f.join("-") : "NEW"), x0 + 222, by + 28, 1, "#8cc8f0", "left", null);
    text("PTS " + (st.pts[r.key] || 0), x0 + 344, by + 28, 1, GOLD, "right", null);
  } else {
    box(x0, by, 208, 26, WHITE);
    wrap(d.call, 32).slice(0, 2).forEach((l, i, a) => text(l, x0 + 104, by + 13 - (a.length - 1) * 5 + i * 10, 1, WHITE, "center", null));
    text(derbyBetLine(d), x0 + 104, by + 34, 1, GOLD, "center", null);
    if (d.phase === "done") text(d.won ? "YOU WIN " + fmtChips(d.won, 1e6) + " CHIPS!" : "NOT THIS TIME", x0 + 104, by + 45, 1, CHIP, "center", null);
    else {                                                    // the crowd meter
      text(KEYS ? "SPACE OR TAP TO CHEER" : "TAP TO CHEER", x0 + 280, by + 6, 1, "#8cc8f0", "center", null);
      rect("#0c2a4a", x0 + 220, by + 14, 120, 6); rect(d.wild > 0 ? GOLD : "#ff8cd2", x0 + 220, by + 14, Math.round(120 * d.cheer), 6);
    }
    if (d.phase === "done") d.order.slice(0, 3).forEach((i, k) => { const r = d.racers[i]; text(ORDN(k + 1) + " " + r.name, x0 + 220, by + 4 + k * 10, 1, k === 0 ? GOLD : WHITE, "left", null); });
  }
  if (d.phase === "pick" || d.phase === "done") closeLine(d.phase === "done" ? "TAP FOR ANOTHER RACE" : "TAP HERE TO LEAVE");
}
function derbyTapWide(rx, ly) {
  const d = TAV.derby, L_ = derbyLane(d), n = d.racers.length;
  if (d.phase === "race") { derbyCheer(); return; }
  if (d.phase === "photo") return;
  if (d.phase === "done") { derbyNew(0, d.vip); return; }
  const h = hitAt(derbyWideHits(), rx, ly);
  if (h) {
    if (h[0] === "type") derbySetType(d, h[5]);
    else if (h[0] === "race") derbyGo();
    else if (h[0] === "table") { TAV.tableSel = 0; openOverlay("derbytable"); }
    else { d.bet = stakeStep(d.bet, h[5], d.max); play("tick"); }
  } else if (ly >= 22 && ly < 22 + n * L_) derbyPick(d, clamp(Math.floor((ly - 22) / L_), 0, n - 1));
  else if (ly > 186) closeOverlay();
}
// the standings: this week's points, everyone's form and trait
function derbyTableRows() { const st = stableRec(); return STABLE.map(s => s[0]).sort((a, b) => (st.pts[b] || 0) - (st.pts[a] || 0) || a.localeCompare(b)); }
function drawDerbyTable() {
  rect("#0a2440", 0, 0, LW, LH);
  const st = stableRec(), rows = derbyTableRows(), wide = wideMenus(), x0 = wide ? WX() : OX, w = wide ? 348 : 120;
  text("THE STANDINGS", x0, 8, 1, GOLD, "left", null);
  if (wide) { text("THIS WEEK'S POINTS", x0 + w, 8, 1, "#8cc8f0", "right", null); [0, 1].forEach(c => text("FORM", x0 + c * 178 + 96, 17, 1, "#3c6a9a", "left", null)); }
  const per = wide ? 20 : 13, cols = wide ? 2 : 1, cw = wide ? 170 : 120;
  rows.slice(0, per).forEach((k, i) => {
    const s = stableBy(k), c = Math.floor(i / 10) % cols, rr = wide ? i % 10 : i, x = x0 + c * (cw + 8), y = 26 + rr * (wide ? 14 : 12), f = (st.form[k] || []).slice(0, 5);
    text(i + 1, x + 10, y, 1, i < 3 ? GOLD : GREY, "right", null);
    text(s[1].slice(0, wide ? 13 : 10), x + 14, y, 1, k === st.lastChamp ? GOLD : WHITE, "left", null);
    if (wide) text(f.length ? f.join("-") : "-", x + 96, y, 1, "#5a8cb4", "left", null);
    text(st.pts[k] || 0, x + cw - 2, y, 1, GOLD, "right", null);
  });
  if (st.lastChamp) text("LAST WEEK'S CHAMP: " + stableBy(st.lastChamp)[1], LW / 2, 180, 1, GOLD, "center", null);
  closeLine("TAP HERE TO GO BACK");
}
WIDE.derby = { draw: drawDerbyWide, tap: derbyTapWide, key: dd => { const d = TAV.derby; if (d.phase === "pick") { d.focus = (d.focus + dd + d.racers.length) % d.racers.length; play("tick"); } else if (d.phase === "race") derbyCheer(); } };
WIDE.derbytable = { draw: drawDerbyTable, tap: (rx, ly) => { if (ly > 186) { S.overlay = "derby"; play("back"); } }, key: () => {} };
window.DERBY = { STABLE, CONDS, BET_TYPES, derbyNew, derbyPays, derbyPick, derbySetType, derbyGo, derbyTick, simRace, stableRec, racerMods,
  exact(races, sims) {                                     // tests: price a race, then run it `sims` more times -> true payback per bet type
    const tot = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
    for (let k = 0; k < races; k++) {
      derbyNew(0, false); const d = TAV.derby, n = d.racers.length; d.bet = 5;
      const rng = RNG((Math.random() * 4294967296) >>> 0), W = Array(n).fill(0), T2 = Array(n).fill(0), T3 = Array(n).fill(0), EX = {}, TR = {};
      for (let m = 0; m < sims; m++) {
        const o = simRace(d.racers.map(r => ({ spd: r.spd, sta: r.sta, bur: r.bur, trait: r.trait })), d.cond, rng, 1, 3);
        W[o[0]]++; T2[o[0]]++; T2[o[1]]++; T3[o[0]]++; T3[o[1]]++; T3[o[2]]++; EX[o[0] + "-" + o[1]] = (EX[o[0] + "-" + o[1]] || 0) + 1; TR[o.slice(0, 3).join("-")] = (TR[o.slice(0, 3).join("-")] || 0) + 1;
      }
      for (let a = 0; a < n; a++) {
        [W, T2, T3].forEach((arr, t) => { tot[t] += arr[a] / sims * derbyPays(d, t, [a], 5); cnt[t]++; });
        for (let b = 0; b < n; b++) if (b !== a) {
          tot[3] += (EX[a + "-" + b] || 0) / sims * derbyPays(d, 3, [a, b], 5); cnt[3]++;
          for (let c = 0; c < n; c++) if (c !== a && c !== b) { tot[4] += (TR[a + "-" + b + "-" + c] || 0) / sims * derbyPays(d, 4, [a, b, c], 5); cnt[4]++; }
        }
      }
    }
    return tot.map((v, i) => +(v / cnt[i]).toFixed(3));
  },
  payback(type, races) {                                   // (at the minimum stake, so the 5,000 limit doesn't bite)                                     // tests: bet at random on `races` fresh races of a type -> chips back per chip
    let staked = 0, back = 0; const keep = tav().chips;
    for (let k = 0; k < races; k++) {
      derbyNew(0, false); const d = TAV.derby, need = BET_TYPES[type][1], n = d.racers.length, picks = [];
      while (picks.length < need) { const i = Math.floor(Math.random() * n); if (!picks.includes(i)) picks.push(i); }
      d.type = type; d.picks = picks; d.bet = 5; const pays = derbyPays(d, type, picks, 5);
      const o = simRace(d.racers.map(r => ({ spd: r.spd, sta: r.sta, bur: r.bur, trait: r.trait })), d.cond, RNG((Math.random() * 4294967296) >>> 0), 1, 3);
      const won = type === 0 ? o[0] === picks[0] : type === 1 ? o.slice(0, 2).includes(picks[0]) : type === 2 ? o.slice(0, 3).includes(picks[0]) : o.slice(0, need).every((x, j) => x === picks[j]);
      staked += 1; if (won) back += pays;
    }
    tav().chips = keep; return back / staked;
  } };
