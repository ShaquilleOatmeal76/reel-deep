// A simple Siege bot for tests (injected with page.evaluate): builds the tower that covers the most current from the
// best free pad, upgrades what it has, calls waves when ready. skill 0..1: how good its choices are.
window.siegeBot = function (id, skill, maxT, opts) {
  opts = opts || {};
  const Q = window.SIEGE; Q.startSiege(id, { test: true, kit: opts.kit || 0, xp: opts.xp || 0 });
  const G = () => Q.SG;
  const cover = (x, y, r) => { let n = 0; for (const pl of G().R.routes) for (let s = 0; s < pl.total; s += 6) { const [px, py] = Q.atS(pl, s); if (Q.inRange(x, y - 4, px, py, r)) n++; } return n; };
  const order = opts.order || [0, 1, 0, 3, 2, 0, 6, 1, 3];
  let t = 0, step = 0;
  if (G().hero && opts.hero !== false) { const pl = G().R.routes[0], [hx, hy] = Q.atS(pl, pl.total * 0.62); G().hero.tx = hx; G().hero.ty = hy + 6; }
  while (t < (maxT || 900) && !G().result) {
    if (step % 30 === 0) {
      const g = G();
      if (g.wave < 0 || (!g.spawn.length && g.nextT > 0 && g.en.length === 0)) Q.callWave();
      // build or upgrade
      const free = g.M.pads.map((p, i) => i).filter(i => !g.towers[i]);
      const built = g.towers.filter(Boolean).length;
      const want = order[built % order.length];
      const tw = Q.TW[want];
      if (free.length && g.shells >= tw.cost && (built < 4 || Math.random() < 0.6)) {
        const r = tw.L[0].r || 50;
        free.sort((a, b) => cover(...g.M.pads[b], r) - cover(...g.M.pads[a], r));
        const pick = Math.random() < skill ? free[0] : free[Math.floor(Math.random() * free.length)];
        g.ring = pick; const b = Q.ringFor(pick).find(b => b[2] === "build" && b[7] === want); if (b) Q.ringAct(b); else g.ring = null;
      } else {
        const ups = g.towers.map((tt, i) => [tt, i]).filter(([tt]) => tt);
        for (const [tt, i] of ups) {
          g.ring = i; const btns = Q.ringFor(i).filter(b => (b[2] === "up" || b[2] === "spec") && b[6]);
          if (btns.length) { Q.ringAct(btns[Math.floor(Math.random() * btns.length)]); break; } else g.ring = null;
        }
      }
    }
    if (step % 15 === 0 && G().hero && opts.hero !== false) { const H = G().hero, n = G().en.filter(e => Q.inRange(H.x, H.y, e.x, e.y, 60)).length; if (n >= 2) { Q.heroAbility("q"); Q.heroAbility("e"); } }
    Q.siegeStep(1 / 30); t += 1 / 30; step++;
  }
  const g = G();
  return { id, won: g.result ? g.result.won : null, stars: g.result ? g.result.stars : 0, hull: g.hull, wave: g.wave + 1, of: g.waves.length, heroDead: g.hero ? g.hero.dead > 0 : null, towers: g.towers.filter(Boolean).map(t => Q.TW[t.k].id + t.lv + (t.spec >= 0 ? "AB"[t.spec] : "")).join(" "), shells: g.shells, t: Math.round(t) };
};
