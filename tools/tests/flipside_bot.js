// One endgame Flipside run played by a bot. Returns [won, metres reached, cause, caught, seconds].
// skill "good": sees what a careful player sees (the light, glowing jellies, hunters' eyes), reacts in ~0.15 s, dodges and pulses well.
// skill "ok": slower to react, looks less far ahead, and fumbles more fights.
(function run(skill, lure) {
  const R = REEL; R.newDive(); R.S.overlay = null; R.S.lure = lure || 0; R.startFlip(1, true);
  const F0 = R.FLIP, dt = 1 / 60, good = skill === "good", react = good ? 0.15 : 0.28, look = good ? 1.3 : 0.8, HY = 140;
  const wound = new Set(); let since = 9, t = 0, target = R.width / 2, cause = "", fightWait = 0;
  while (R.FLIP && t < 400) {
    const F = R.FLIP, S = R.S, W = R.width;
    if (F.mode === "fail" && !cause) cause = (S.popups.find(p => /GRABBED|JELLY/.test(p[0])) || ["?"])[0].startsWith("GRABBED") ? "grabbed" : "jelly";
    if (F.fight) {                                   // tap on green, mostly
      const fg = F.fight; fightWait -= dt;
      if (fightWait <= 0 && fg.time - fg.left > 0.4 && Math.abs(fg.pos - fg.win[0]) <= fg.win[1] * (good ? 0.75 : 0.6)) { if (Math.random() < (good ? 0.9 : 0.75)) R.flipFightTap(); fightWait = 0.25; }
      else if (fightWait <= 0 && Math.random() < (good ? 0.002 : 0.006)) { R.flipFightTap(); fightWait = 0.25; }   // a fumble
    } else if (F.mode === "climb") {
      since += dt;
      if (since >= react) {
        since = 0;
        const light = (R.S.lure === 2 ? R.FL_TUNE.glowLight : R.FL_TUNE.light) * F.flick, rise = 62 * S.sink, vis = R.flipVisible(), full = F.catch.length >= 3;
        const score = x => {
          let p = Math.abs(x - S.hx) * 0.02;
          for (const j of R.flipJellies()) {            // jellies glow: always seen
            const jy = R.flipSY(j.y), jx = j.x + 6;
            if (jy > HY - rise * look - 10 && jy < HY + 12 && Math.abs(x - jx) < 13) p += 100;
          }
          for (const c of vis) {
            const [cx0, cy0, w, h] = R.flipRect(c), cx = cx0 + w / 2, cy = cy0 + h / 2, d = Math.hypot(cx - S.hx, cy - HY);
            if (c.hunter && c.h && c.h.m === "go") {      // where its lunge crosses your height
              if (c.h.vs > 1 || c.h.vs < -1) { const tt = (HY - cy) / c.h.vs; if (tt > -0.1 && tt < 1.5) { const xs = cx + c.h.vx * tt; if (Math.abs(x - xs) < 14) p += 80; } }
              else if (Math.abs(cy - HY) < 14 && Math.abs(x - cx) < 30) p += 80;
            } else if (c.hunter && c.h && c.h.m === "wind") { if (Math.abs(x - S.hx) < 16) p += 40; }   // it's about to come at where you are: move
            else if (c.hunter && !(c.h && c.h.m === "stun")) { if (cy < HY + 6 && cy > HY - 90 && Math.abs(x - cx) < 20) p += good ? 12 : 4; }   // give eyes in the dark some room
            else if (!full && d < light + 6 && cy < HY + 4 && cy > HY - 60 && !c.fl && Math.abs(x - cx) < 8) p -= 6;   // something to catch, in the light
          }
          return p;
        };
        if (F.f >= F.L - 36 - 4) { const mx = W / 2 + Math.sin(R.T * 0.9) * Math.min(40, W * 0.3); target = mx; }
        else { let best = target, bs = 1e9; for (let x = 6; x <= W - 6; x += 3) { const s = score(x); if (s < bs) { bs = s; best = x; } } target = best; }
        // pulse a lunge that's about to land
        if (F.pulses > 0) for (const c of vis) {
          if (!c.hunter || !c.h) continue;
          const [cx0, cy0, w, h] = R.flipRect(c), d = Math.hypot(cx0 + w / 2 - S.hx, cy0 + h / 2 - HY);
          if ((c.h.m === "go" && d < (good ? 40 : 28)) || (good && c.h.m === "wind" && d < 30 && F.pulses > 1)) { R.flipPulse(); break; }
        }
      }
      S.touchX = target;
    }
    if (R.FLIP) R.flipVisible().forEach(c => { if (c.h && c.h.m === "wind") wound.add(c); });
    R.simTick(dt); t += dt;
  }
  return [F0.won ? 1 : 0, Math.round(F0.f / 6), F0.won ? "won" : cause || "time", F0.catch.length, Math.round(t), wound.size];
})
