// A Siege bot for tests (injected with page.evaluate). Plays like a sensible player: builds damage towers on the pads
// that cover the most current (a lantern or two first in the dark), keeps building until the pads near the action are
// used, upgrades damage towers (never lanterns or clams past level 1), parks the hero where routes meet, uses abilities
// on crowds, calls waves when the field is clear. skill 0..1: how often it picks the best pad.
window.siegeBot = function (id, skill, maxT, opts) {
  opts = opts || {};
  const Q = window.SIEGE;
  const xp0 = opts.xp !== undefined ? opts.xp : Q.heroXpFor(Math.min(20, 1 + 2 * Number(id.split(".")[0])));
  if (opts.research) {                                   // a late-game player: everything researched, every zone open (writes a throwaway save)
    const res = {}; for (const r of Q.RES) res[r.id] = r.nodes.length;
    window.REEL.store.siege = { v: 1, stars: {}, badges: {}, xp: xp0, kit: opts.kit || 0, res, seen: Object.keys(Q.ETYPES), done: 11 };
    Q.startSiege(id, { kit: opts.kit || 0, mode: opts.mode });
  } else Q.startSiege(id, { test: true, kit: opts.kit || 0, xp: xp0, mode: opts.mode });
  const G = () => Q.SG, rng = (() => { let a = 12345; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const cover = (x, y, r) => { let n = 0; for (const pl of G().R.routes) for (let s = 0; s < pl.total; s += 6) { const [px, py] = Q.atS(pl, s); if (Q.inRange(x, y - 4, px, py, r)) n++; } return n; };
  const z = G().M.zone, darkZ = z >= 5 || z === 3, hiddenZ = Q.Z_ROSTER[z].includes("hidden");
  const dmgOrder = [0, 1, 3, 0, 2, 1, 6, 0, 3, 1];
  let t = 0, step = 0, lanterns = 0;
  if (G().hero && opts.hero !== false) { const pl = G().R.routes[0], [hx, hy] = Q.atS(pl, pl.total * 0.62); G().hero.tx = hx; G().hero.ty = hy + 6; }
  while (t < (maxT || 900) && !G().result) {
    const g = G();
    if (step % 30 === 0) {
      if (g.wave < 0 || (!g.spawn.length && g.nextT > 0 && g.en.length === 0)) Q.callWave();
      const free = g.M.pads.map((p, i) => i).filter(i => !g.towers[i]);
      const built = g.towers.filter(Boolean);
      const next = g.waves[Math.min(g.waves.length - 1, g.wave + 1)] || [], has = k => next.some(x => x[0] === k);
      const needLight = (darkZ || hiddenZ || has("hidden")) && lanterns < (darkZ ? 3 : 2) && built.length >= lanterns * 3;
      const zaps = built.filter(x => x.k === 3).length;
      let want = needLight ? 5 : dmgOrder[built.filter(x => x.k !== 5).length % dmgOrder.length];
      if (!needLight && (has("armour") || has("brute") || has("float")) && zaps < 2 + Math.floor(built.length / 5)) want = 3;
      const cost = Q.TW[want].cost;
      let did = false;
      if (free.length && g.shells >= cost && (built.length < 9 || rng() < 0.5)) {
        const r = Q.TW[want].L[0].r || 54;
        free.sort((a, b) => cover(...g.M.pads[b], r) - cover(...g.M.pads[a], r));
        const pick = rng() < skill ? free[0] : free[Math.floor(rng() * free.length)];
        if (cover(...g.M.pads[pick], r) > 3) { g.ring = pick; const b = Q.ringFor(pick).find(b => b[2] === "build" && b[7] === want); if (b) { Q.ringAct(b); did = true; if (want === 5) lanterns++; } else g.ring = null; }
      }
      if (!did) {
        const ups = g.towers.map((tt, i) => [tt, i]).filter(([tt]) => tt && tt.k !== 5 && tt.k !== 4).sort((a, b) => a[0].lv - b[0].lv);
        for (const [tt, i] of ups) {
          g.ring = i; const btns = Q.ringFor(i).filter(b => (b[2] === "up" || b[2] === "spec") && b[6]);
          if (btns.length) { Q.ringAct(btns[Math.floor(rng() * btns.length)]); break; } else g.ring = null;
        }
      }
    }
    if (step % 15 === 0 && g.hero && opts.hero !== false) { const H = g.hero, n = g.en.filter(e => Q.inRange(H.x, H.y, e.x, e.y, 60)).length; if (n >= 3) { Q.heroAbility("q"); Q.heroAbility("e"); } }
    Q.siegeStep(1 / 30); t += 1 / 30; step++;
  }
  const g = G();
  return { id, won: g.result ? g.result.won : null, stars: g.result ? g.result.stars : 0, hull: g.hull, wave: g.wave + 1, of: g.waves.length, heroDead: g.hero ? g.hero.dead > 0 : null, towers: g.towers.filter(Boolean).map(t => Q.TW[t.k].id + t.lv + (t.spec >= 0 ? "AB"[t.spec] : "")).join(" "), shells: g.shells, t: Math.round(t) };
};
