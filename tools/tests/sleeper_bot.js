// returns [won, phaseReached, hitsLanded, seconds]
(function runFight(skill) {
  const R = REEL; R.newDive(); R.S.overlay = null; R.startBoss(false);
  const dt = 1 / 60, react = skill === "good" ? 0.12 : 0.4;
  let since = 9, plan = null, t = 0;
  const b0 = R.BOSS;
  while (R.BOSS && t < 240) {
    const b = R.BOSS;
    since += dt;
    if (since >= react && b.mode === "fight") {
      since = 0;
      const W = R.width, cx = W / 2, floorAt = x => R.slY(b, x) - 5;
      // where to be: just above the open (or next) eye, within reach
      const open = b.eyes.filter(e => e.open > 0.5 || e.want > 0.5);
      const e = open[0] || b.eyes[Math.max(0, b.eyeIdx)] || b.eyes[0];
      let tx = cx + e.x, ty = e.y - (skill === "good" ? 36 : 30);
      const danger = [];
      if (skill === "good") b.warn.forEach(w => danger.push(w.y));
      b.tentacles.forEach(tn => { const tipX = tn.x + tn.dir * 126; const look = skill === "good" ? 170 : 50, reach = tn.dir > 0 ? tipX > b.hx - look : tipX < b.hx + look; const passed = tn.dir > 0 ? tn.x > b.hx + 12 : tn.x < b.hx - 12; if (reach && !passed) danger.push(tn.y); });
      const safe = y => danger.every(d => Math.abs(y - d) > 26);
      if (!safe(ty) || !safe(b.hy)) { let best = null; for (let y = 34; y < floorAt(tx); y += 3) if (safe(y) && (best === null || Math.abs(y - ty) < Math.abs(best - ty))) best = y; if (best !== null) ty = best; }
      if (b.lungeT >= 0 && (skill === "good" || b.lungeT > 0.9)) ty = Math.min(ty, b.base - 95);       // get above a lunge
      if (skill === "good" && b.rings.length) {                // slip through a shockwave's gap
        const ry = b.bodyY + 10;
        for (const r of b.rings) { const d = Math.hypot(b.hx - cx, b.hy - ry); if (r.r < d + 4 && r.r > d - 40) { tx = cx + Math.cos(r.gap) * (r.r + 6); ty = ry + Math.sin(r.gap) * (r.r + 6); } }
      }
      plan = [Math.max(6, Math.min(W - 6, tx)), Math.max(34, ty)];
      // fire when an open eye is in reach
      if (b.charge >= 1 && b.eyes.some(q => q.open > 0.6 && Math.hypot(b.hx - (cx + q.x), b.hy - q.y) <= 46 + q.r - (skill === "good" ? 3 : 0))) R.bossPulse();
      else if (skill === "bad" && b.charge >= 1 && Math.random() < 0.3) R.bossPulse();          // a sloppy player wastes pulses
    }
    if (plan) { b.keys.clear(); const dx = plan[0] - b.hx, dy = plan[1] - b.hy; if (dx < -2) b.keys.add("L"); if (dx > 2) b.keys.add("R"); if (dy < -2) b.keys.add("U"); if (dy > 2) b.keys.add("D"); }
    const lv = b.lives, ph = b.phase;
    R.simTick(dt); t += dt;
    if (R.BOSS && R.BOSS.lives < lv) { const c = b.lift > 2 ? "lunge" : b.rings.some(r => Math.abs(Math.hypot(b.hx - R.width / 2, b.hy - b.bodyY - 10) - r.r) < 5) ? "ring" : "tentacle"; window.CAUSES = window.CAUSES || {}; const k = "p" + ph + " " + c; CAUSES[k] = (CAUSES[k] || 0) + 1; }
  }
  return [R.S.bossWon ? 1 : 0, b0.phase, b0.hits, Math.round(t)];
})
