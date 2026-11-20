"""WRECKONING (Nov 20, 2026): the Doom-style arena shooter. Run from the repo root:
python3 -m http.server 8765 --bind 127.0.0.1 &  then  python3 tools/tests/test_wreck.py
Checks the arenas, the flow field, the guns, Scuttle, pickups, waves (with an aim bot), dying and leaving, and takes
screenshots at PC and phone sizes. Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "wreck"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if not ok else ""))
    if not ok: fails.append(name)


async def page_at(p, url, w=1440, h=810):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    await ctx.route("**/*firebase*/**", lambda r: r.abort())
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(url); await pg.wait_for_function("window.REEL && window.REEL.S")
    await pg.wait_for_timeout(600)
    return b, pg, errs

# an aim bot: face the nearest enemy it can see, aim at its middle, fire; wander toward pickups between waves
BOT = """window.wkBot = (secs, opts) => { opts = opts || {}; const Q = WRECK, dt = 1 / 60;
  const toward = (tx, ty) => { const K = Q.WK, P = K.P, m = K.map, sx = P.x, sy = P.y; P.x = tx; P.y = ty; const d = Q.buildField(false); P.x = sx; P.y = sy;
    const x = P.x | 0, y = P.y | 0; let best = null, bd = d[y * m.w + x]; if (bd < 0) return [tx, ty]; if (bd <= 1) return [tx, ty];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = d[(y + dy) * m.w + x + dx]; if (v >= 0 && v < bd) { bd = v; best = [x + dx + 0.5, y + dy + 0.5]; } } return best || [tx, ty]; };
  const go = (tx, ty) => { const K = Q.WK, P = K.P, [gx, gy] = toward(tx, ty); P.a = Math.atan2(gy - P.y, gx - P.x); P.pitch = 0; K.keys.add('KeyW');
    if (Q.floorAt(gx, gy) - P.feet > 0.3 && P.vz <= 0) Q.jump(); };
  for (let i = 0; i < secs * 60 && Q.WK && !Q.WK.result; i++) { const K = Q.WK, P = K.P;
    let best = null, bd = 1e9, near = null, nd = 1e9;
    for (const f of K.foes) { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < nd) { nd = d; near = f; }
      if (d < bd && Q.sightLine(P.x, P.y, P.feet + 0.55, f.x, f.y, f.z + Q.FOES[f.t].h * 0.5)) { bd = d; best = f; } }
    K.keys.clear(); K.fireHeld = false;
    if (best) { P.a = Math.atan2(best.y - P.y, best.x - P.x); const dz = best.z + Q.FOES[best.t].h * 0.5 - (P.feet + 0.55);
      P.pitch = Math.max(-85, Math.min(85, dz / bd * 119 / 0.85));
      const G = Q.GUNS[P.gun]; if (G.ammo && P.ammo[G.ammo] <= 0) Q.cycle(1);
      if (best.stag > 0 && bd < 2.3) Q.scuttle(); else K.fireHeld = true;
      if (bd < 2.2) K.keys.add('KeyS'); if (opts.strafe !== false) K.keys.add(Math.floor(i / 90) % 2 ? 'KeyA' : 'KeyD');
      if (P.dashN === 2 && bd < 1.2) Q.dash(); }
    else if (K.picks.some(p => p.k === 'blunpick' && !p.got)) { const p = K.picks.find(p => p.k === 'blunpick'); go(p.x, p.y); }
    else if (near) go(near.x, near.y);
    else { const p = K.picks.find(p => !p.got && (p.k !== 'shot' || P.guns[2]) && (p.k !== 'tin' || P.hp < 100) && (p.k !== 'helmet' || P.ar < 100)); if (p && opts.pick !== false) go(p.x, p.y); }
    if (opts.god) P.hp = 100;
    Q.sim(dt); if (i % 6 === 0) Q.render(); }
  return Q.WK ? { wave: Q.WK.wave, kills: Q.WK.kills, score: Q.WK.score, hp: Q.WK.P.hp, dead: !!Q.WK.result, guns: Q.WK.P.guns.slice() } : null; };"""


async def main():
    async with async_playwright() as p:
        b, pg, errs = await page_at(p, URL + "?wreck")
        ev = pg.evaluate
        await pg.add_script_tag(content=BOT)
        check("test link opens WRECKONING", await ev("REEL.S.state === 'wreck' && WRECK.WK && WRECK.WK.test"))
        check("480x270 screen", await ev("[canvas.width, canvas.height]") == [480, 270])
        # arenas: rectangular grids, known characters, walls all round, start/spawns/pickups on open floor
        bad = await ev("""(() => { const out = []; for (const id in WRECK.ARENAS) { const A = WRECK.ARENAS[id], w = A.rows[0].length;
            A.rows.forEach((r, y) => { if (r.length !== w) out.push(id + ' row ' + y + ' is ' + r.length); for (const ch of r) if (!WRECK.LEGEND[ch]) out.push(id + ' char ' + ch);
              if (y === 0 || y === A.rows.length - 1) { if ([...r].some(ch => !WRECK.LEGEND[ch].solid)) out.push(id + ' open edge row ' + y); }
              else if (!WRECK.LEGEND[r[0]].solid || !WRECK.LEGEND[r[w - 1]].solid) out.push(id + ' open side ' + y); });
            const open = (x, y) => !WRECK.LEGEND[A.rows[y | 0][x | 0]].solid;
            if (!open(A.start[0], A.start[1])) out.push(id + ' start');
            A.spawns.forEach(([x, y], i) => { if (!open(x, y)) out.push(id + ' spawn ' + i); });
            A.picks.forEach(([k, x, y], i) => { if (!open(x, y)) out.push(id + ' pick ' + i); });
            if (!open(A.gun[0], A.gun[1])) out.push(id + ' gun'); } return out; })()""")
        check("arena grids are sound", bad == [], bad)
        # flow field: every spawn can walk to you, wherever you stand (floor, gallery, crates you can reach)
        r = await ev("""(() => { const Q = WRECK, K = Q.WK, out = [];
            for (const [px, py] of [[11.5, 15.5], [12, 2.5], [18.5, 5.5], [3.5, 12.5]]) { K.P.x = px; K.P.y = py; K.P.feet = Q.floorAt(px, py);
              const d = Q.buildField(false); K.map.A.spawns.forEach(([x, y], i) => { if (d[y * K.map.w + x] < 0) out.push([px, py, i]); }); } return out; })()""")
        check("every spawn can reach you (walkers)", r == [], r)
        # enemies climb the stairs to the gallery, wherever you stand up there
        r = await ev("""(() => { const Q = WRECK, out = []; for (const s of [[5.5, 2.5], [12, 2.5], [20.5, 1.5], [2, 3.5]]) {
            Q.startWreck('hold', {test: true}); const K = Q.WK, P = K.P; K.phase = 'break'; K.phaseT = 999; P.x = s[0]; P.y = s[1]; P.feet = 1.15;
            const fs = [Q.addFoe('deck', 3.5, 15.5), Q.addFoe('crab', 20.5, 15.5), Q.addFoe('deck', 12.5, 12.5), Q.addFoe('deck', 4.5, 9.5)];
            for (let i = 0; i < 60 * 40; i++) { P.hp = 100; Q.sim(1 / 60); }
            fs.forEach((f, i) => { if (f.z < 1.1) out.push([s, i, +f.x.toFixed(1), +f.y.toFixed(1), f.z]); }); } return out; })()""")
        check("enemies climb the stairs to the gallery", r == [], r)
        # a real double jump gets you onto the tall crates
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true}); const K = Q.WK, P = K.P; K.phase = 'break'; K.phaseT = 999;
            P.x = 4.5; P.y = 9.6; P.feet = 0; P.a = -Math.PI / 2; K.keys.add('KeyW'); Q.jump();
            for (let i = 0; i < 90; i++) { if (i === 16) Q.jump(); if (i === 36) K.keys.clear(); Q.sim(1 / 60); } K.keys.clear(); for (let i = 0; i < 30; i++) Q.sim(1 / 60); return P.feet; })()""")
        check("a double jump reaches the tall crates", r > 0.95, r)
        # the tutorial, done for real step by step
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true, tut: true}); const K = Q.WK, P = K.P, log = [];
            const run = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); Q.sim(1 / 60); if (i % 4 === 0) Q.render(); } };
            const aim = f => { P.a = Math.atan2(f.y - P.y, f.x - P.x); const d = Math.hypot(f.y - P.y, f.x - P.x); P.pitch = Math.max(-85, Math.min(85, (f.z + Q.FOES[f.t].h * 0.5 - P.feet - 0.55) / d * 140)); };
            const step = () => K.tut.i, waitNext = (i) => run(120);
            run(90); log.push(step());
            run(60, i => { P.a += 0.06; P.pitch = 50 * Math.sin(i / 10); }); waitNext(); log.push(step());
            P.a = -Math.PI / 2; K.keys.add('KeyW'); run(150); K.keys.clear(); waitNext(); log.push(step());
            P.x = 4.5; P.y = 7.5; P.feet = 1; run(10); waitNext(); log.push(step());
            Q.dash(); run(30); Q.dash(); run(30); waitNext(); log.push(step());
            const [gx, gy] = K.map.A.gun; P.x = gx; P.y = gy; P.feet = 1.15; run(10); waitNext(); log.push(step());
            P.x = 12; P.y = 5.5; P.feet = Q.floorAt(12, 5.5);
            for (let n = 0; n < 40 && K.tut.i === 5; n++) { const f = K.foes.find(f => f.dummy); if (!f) break; aim(f); Q.render(); P.fireT = 0; Q.fire(); run(5); }
            waitNext(); log.push(step());
            for (let n = 0; n < 40 && K.tut.i === 6; n++) { const f = K.foes.find(f => f.dummy); if (!f) { run(5); continue; } P.adsOn = true; run(20); aim(f); Q.render(); P.fireT = 0; Q.fire(); run(5); }
            P.adsOn = false; run(20); waitNext(); log.push(step());
            for (let n = 0; n < 60 && K.tut.i === 7; n++) { const f = K.foes.find(f => f.dummy); if (!f) { run(5); continue; }
              if (f.stag > 0) { P.x = f.x - 1; P.y = f.y; Q.scuttle(); run(30); continue; } aim(f); Q.render(); P.fireT = 0; P.gun = 1; Q.fire(); run(10); }
            waitNext(); log.push(step());
            Q.swapTo(0); run(30);
            for (let n = 0; n < 20 && K.tut.i === 8; n++) { const f = K.foes.find(f => f.dummy); if (!f) { run(5); continue; } P.x = f.x - 1; P.y = f.y; P.feet = Q.floorAt(P.x, P.y); aim(f); P.fireT = 0; Q.fire(); run(20); }
            waitNext(); log.push(step());
            Q.swapTo(2); run(30);
            for (let n = 0; n < 40 && K.tut.i === 9; n++) { const f = K.foes.find(f => f.dummy); if (!f) { run(5); continue; } aim(f); Q.render(); P.fireT = 0; P.adsOn = true; run(15); aim(f); Q.render(); Q.fire(); run(10); }
            P.adsOn = false; waitNext(); log.push(step());
            for (const p of K.picks.filter(p => !p.got)) { P.x = p.x; P.y = p.y; P.feet = Q.floorAt(p.x, p.y); run(3); }
            waitNext(); log.push(step());
            run(300); return { log, done: Q.WK !== K && !Q.WK.tut && ['intro', 'fight'].includes(Q.WK.phase), hp: P.hp }; })()""")
        check("the tutorial goes through every step", r["log"] == list(range(0, 12)) and r["done"], r)
        await ev("WRECK.startWreck('hold', {test: true, tut: true}); WRECK.tutGo(7)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(OUT, "pc_tutorial.png"))
        # pistol, blunderbuss, stagger and Scuttle
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true}); const K = Q.WK, P = K.P; K.phase = 'break'; K.phaseT = 99;
            P.x = 11.5; P.y = 15.5; P.a = -Math.PI / 2; P.pitch = 0; const f = Q.addFoe('deck', 11.5, 12.5); f.born = 0; Q.render();
            const hp0 = f.hp; Q.fire(); const out = { pistol: f.hp === hp0 - 3, harp: P.ammo.harp === 29 };
            P.guns[2] = true; P.ammo.shot = 10; P.fireT = 0; Q.swapTo(2); for (let i = 0; i < 30; i++) Q.sim(1 / 60); Q.render();
            out.swapped = P.gun === 2; const before = K.kills; Q.fire(); out.blunKill = K.kills === before + 1 || f.stag > 0;
            const g = Q.addFoe('deck', 11.5, 14); g.born = 0; g.hp = 2; g.max = 8; Q.hurtFoe(g, 0); g.hp = 2; Q.hurtFoe(g, 0.5); out.stag = g.stag > 0;
            P.hp = 50; const k0 = K.kills; Q.scuttle(); for (let i = 0; i < 30; i++) Q.sim(1 / 60); out.scut = K.kills === k0 + 1 && P.hp >= 65; return out; })()""")
        check("harpoon pistol hits for 3 and uses a harpoon", r["pistol"] and r["harp"], r)
        check("switching to the blunderbuss", r["swapped"], r); check("blunderbuss up close kills or staggers a deckhand", r["blunKill"], r)
        check("a hurt enemy staggers", r["stag"], r); check("Scuttle kills and heals", r["scut"], r)
        # walls stop shots: an enemy behind the mast can't be hit
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true}); const K = Q.WK, P = K.P; K.phase = 'break'; K.phaseT = 99;
            P.x = 8.5; P.y = 13.5; P.a = -Math.PI / 2; const f = Q.addFoe('deck', 8.5, 9.5); f.born = 0; Q.render(); const hp0 = f.hp; Q.fire(); return f.hp === hp0; })()""")
        check("the mast blocks shots", r)
        # pickups
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true}); const K = Q.WK, P = K.P; K.phase = 'break'; K.phaseT = 99; K.wave = 1;
            P.hp = 50; const t = K.map.A.picks.find(p => p[0] === 'tin'); P.x = t[1]; P.y = t[2]; P.feet = Q.floorAt(P.x, P.y); Q.sim(1 / 60); const healed = P.hp === 75;
            K.picks.push({k: 'blunpick', x: 12, y: 2.4}); P.x = 12; P.y = 2.4; P.feet = 1.15; Q.sim(1 / 60); return { healed, blun: P.guns[2] && P.ammo.shot >= 16 }; })()""")
        check("a tin of fish heals 25", r["healed"], r); check("the blunderbuss pickup", r["blun"], r)
        # waves with the aim bot (invulnerable): several waves clear, enemies come in
        await ev("WRECK.startWreck('hold', {test: true})")
        r = await ev("wkBot(400, {god: true})")
        check("the bot clears waves", r and r["wave"] >= 4 and r["kills"] >= 20, r)
        check("the blunderbuss turns up after wave 1", r and r["guns"][2], r)
        await pg.screenshot(path=os.path.join(OUT, "pc_fight.png"))
        # the bot for real: it should get a few waves in before going down
        res = []
        for i in range(3):
            await ev("WRECK.startWreck('hold', {test: true})")
            res.append(await ev("wkBot(400)"))
        print("   bot runs (wave, kills, dead):", [(x["wave"], x["kills"], x["dead"]) for x in res])
        check("an aim bot survives a few waves", all(x["wave"] >= 3 for x in res), res)
        # dying, the result screen, again and leave
        r = await ev("""(() => { const Q = WRECK; Q.startWreck('hold', {test: true}); const K = Q.WK; K.P.hp = 5; for (let i = 0; i < 3; i++) Q.sim(1/60);
            const f = Q.addFoe('crab', K.P.x, K.P.y - 0.6); f.born = 0; for (let i = 0; i < 120 && !K.result; i++) Q.sim(1 / 60); return !!K.result; })()""")
        check("going down shows the result", r)
        await ev("WRECK.WK.result.t = 2; REEL.simTick(0.016)")
        await pg.screenshot(path=os.path.join(OUT, "pc_sunk.png"))
        await pg.keyboard.press("Space"); await pg.wait_for_timeout(100)
        check("Space starts again", await ev("WRECK.WK && !WRECK.WK.result && WRECK.WK.wave === 0"))
        await ev("WRECK.WK.P.hp = 1; WRECK.WK.P.hp = 0; WRECK.WK.P.dead = true; WRECK.WK.result = {wave: 0, kills: 0, score: 0, t: 2}")
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200)
        check("Enter leaves to the boat", await ev("REEL.S.state === 'title' && !WRECK.WK"))
        check("the ocean is back to normal size", await ev("canvas.height === 200"))
        # looks: hip, aimed, looking up and down, each gun, a stagger
        await ev("WRECK.startWreck('hold', {test: true})"); await pg.wait_for_timeout(300)
        await ev("(() => { const K = WRECK.WK; K.P.pitch = 50; })()"); await pg.wait_for_timeout(100); await pg.screenshot(path=os.path.join(OUT, "pc_up.png"))
        await ev("(() => { const K = WRECK.WK; K.P.pitch = -40; K.P.gun = 0; })()"); await pg.wait_for_timeout(100); await pg.screenshot(path=os.path.join(OUT, "pc_hook.png"))
        await ev("(() => { const K = WRECK.WK; K.P.pitch = 0; K.P.gun = 1; K.P.adsOn = true; })()"); await pg.wait_for_timeout(400); await pg.screenshot(path=os.path.join(OUT, "pc_ads_pistol.png"))
        await ev("(() => { const K = WRECK.WK; K.P.guns[2] = true; K.P.gun = 2; K.P.want = 2; })()"); await pg.wait_for_timeout(200); await pg.screenshot(path=os.path.join(OUT, "pc_ads_blun.png"))
        await ev("(() => { const K = WRECK.WK; K.P.adsOn = false; K.paused = true; })()"); await pg.wait_for_timeout(200); await pg.screenshot(path=os.path.join(OUT, "pc_pause.png"))
        check("no script errors (PC)", errs == [], errs[:3])
        await b.close()
        # phone
        b, pg, errs = await page_at(p, URL + "?wreck", 390, 700)
        await pg.wait_for_timeout(300)
        await pg.evaluate("WRECK.WK.touch.on = true")
        await pg.wait_for_timeout(200); await pg.screenshot(path=os.path.join(OUT, "phone.png"))
        check("no script errors (phone)", errs == [], errs[:3])
        await b.close()
        # the normal game still runs
        b, pg, errs = await page_at(p, URL)
        check("the ocean still opens normally", await pg.evaluate("REEL.S.state === 'title' && canvas.height === 200"))
        await pg.evaluate("REEL.cast(); REEL.S.overlay = null; for (let i = 0; i < 120; i++) REEL.simTick(1/60)")
        check("a dive still runs", await pg.evaluate("['down','rise','up','turn','haul','fight'].includes(REEL.S.state)"))
        check("no script errors (ocean)", errs == [], errs[:3])
        await b.close()
    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
