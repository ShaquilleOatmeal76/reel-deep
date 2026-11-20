// A bot that plays ordinary dives, for pricing the dive bets (Nov 20, 2026). Injected into the page by
// tools/tests/test_bets2.py. BOT.run(n, opt) plays n dives back to back with REEL.simTick and returns one record per dive.
// opt: { deep: metres to start catching (default random 0-1100), hunt: [fish ids] to go after (then only those, until
// 1000 m), skill: 0-1 (how cleanly it fights and dodges) }. It dodges jellyfish and the front of every shark, pulses when
// it's boxed in, and taps fights when the marker is in the green.
window.BOT = (() => {
  const DT = 1 / 60;
  let opt = {}, deep = 0, lapse = 0, pulser = true;
  const seen = f => f.bot || (f.bot = { look: Math.random() < 0.5 + 0.45 * (opt.skill || 0.8), chase: Math.random() < 0.15 });   // decided once per fish
  const danger = f => (f.id === "jelly" || (SHARKS.includes(f.id) && !(opt.hunt && opt.hunt.includes(f.id)))) && seen(f).look;
  function predict(f, dy, vs) { const t = Math.max(0, dy) / vs, [w] = fishSize(f); let x = f.x + (f.fl ? f.fl[0] * 150 : f.v) * Math.min(t, 1.2); return x + w / 2; }
  function steerBot() {
    const down = S.state === "down", vs = down ? Math.max(40, (56 + Math.min(70, S.hy / M * 0.09)) * S.sink) : 78, dir = down ? 1 : -1;
    const m = S.hy / M, room = S.catch.length < C.CAPACITY;
    const hunting = !!opt.hunt && m < 1000;
    const want = f => room && f.id !== "jelly" && !danger(f) && !f.gh && !(SPEC[f.id][7] && S.catch.some(c => SPEC[c[0]][7])) &&
      (hunting ? opt.hunt.includes(f.id) : m >= deep || ((f.tr || SPEC[f.id][7]) && seen(f).chase));   // most people go for a trophy
    let goal = S.hx, best = 1e9;
    const fish = visible().map(([, f]) => f);
    for (const f of fish) {                                 // the nearest fish worth having, ahead of the hook
      const dy = (f.y - S.hy) * dir;
      if (dy < -2 || dy > 70 || !want(f)) continue;
      let gx = predict(f, dy, vs);
      if (SHARKS.includes(f.id)) { const [w] = fishSize(f), right = (f.v >= 0) !== !!EV.fools; gx += right ? -w * 0.3 : w * 0.3; }   // come in from behind
      const c = dy + Math.abs(gx - S.hx) * 0.6 - (f.tr || SPEC[f.id][7] ? 80 : 0);
      if (c < best) { best = c; goal = gx; }
    }
    // try steering to each spot and play the next 0.7 s forward: where would the hook touch something it shouldn't?
    const sp = 118 * S.steerK, near = fish.filter(f => { const dy = (f.y - S.hy) * dir; return dy > -12 && dy < vs * 0.75 + 14; })
      .map(f => { const r = fishRect(f), bad = danger(f) ? 1500 : !want(f) && room ? 400 : C.JUNK.includes(f.id) ? 300 : 0; return [f, r, bad]; }).filter(q => q[2]);
    let bx = S.hx, bc = 1e9;
    for (let x = 4; x <= LW - 4; x += 6) {
      let c = Math.abs(x - goal) * 0.08;
      for (let t = 0.05; t <= 0.7 && c < bc; t += 0.07) {
        const hx = S.hx + clamp(x - S.hx, -sp * t, sp * t), hy = S.hy + dir * vs * t;
        for (const [f, r, bad] of near) {
          const fx = r[0] + (f.fl ? f.fl[0] * 150 : f.v) * t;
          if (hx + 5 > fx && hx - 5 < fx + r[2] && hy + 6 > r[1] && hy - 6 < r[1] + r[3]) c += bad / (1 + t * 6);
        }
      }
      if (c < bc) { bc = c; bx = x; }
    }
    if (bc > 60 && S.pulses > 0 && Math.random() < (pulser ? 0.6 : 0.1) && LURES[S.lure][0] !== "angler") {
      const close = near.some(([f, r, bad]) => bad >= 1500 && Math.abs(f.y - S.hy) < 26 && Math.abs(r[0] + r[2] / 2 - S.hx) < 20);
      if (close) pulse();
    }
    if (lapse > 0) lapse -= 1 / 60;                                     // a lapse: the hook keeps going where it was going
    else if (Math.random() < (1 - (opt.skill || 0.8)) * 0.06) lapse = 0.45;
    else S.touchX = bx;
  }
  function fightBot() {
    const fg = S.fight, sk = opt.skill || 0.8;
    if (Math.abs(fg.pos - fg.win[0]) <= fg.win[1] * 0.8 && Math.random() < 0.35 * sk) fightTap();
    else if (Math.random() < 0.004 * (1 - sk)) fightTap();          // a nervous tap
  }
  function one() {
    newDive(); S.lure = opt.lure || 0; const u = Math.random(); deep = opt.deep !== undefined ? opt.deep : u < (opt.floorP || 0.4) ? 1150 : u < 0.75 ? 300 + Math.random() * 800 : Math.random() * 300;   // floor runners, deep divers, shallow
    pulser = Math.random() < 0.7; const line = betLine(), w = wantedFish();
    cast(); S.overlay = null;
    let t = 0;
    while (S.state !== "haul" && t < 400) {
      if (["boss", "flip"].includes(S.state) || S.toFlip) return null;
      if (S.state === "down" || S.state === "rise") steerBot();
      else if (S.state === "fight") fightBot();
      REEL.simTick(DT); t += DT;
    }
    if (S.state !== "haul") return null;
    const d = S.lastDive;
    return { mask: betMask(d, line), line, total: d.total, junk: d.total < JUNK_K * line ? 1 : 0, ids: d.catch.map(c => c[0]),
      zones: d.catch.map(c => SPEC[c[0]][2]), dep: d.catch.map(c => c[3]), lbs: d.catch.map(c => c[1]), reached: Math.round(d.reached), bottom: d.bottom ? 1 : 0, stung: d.stung ? 1 : 0, bit: d.bitten, wanted: w, deep: Math.round(deep) };
  }
  return {
    run(n, o) { opt = o || {}; const out = []; for (let i = 0; i < n; i++) { const r = one(); if (r) out.push(r); } return out; },
  };
})();
