"""Siege of the Deep (Nov 19, 2026): the tower defense DLC. Run from the repo root:
python3 -m http.server 8765 --bind 127.0.0.1 &  then  python3 tools/tests/test_siege.py
Plays the maps with a bot (tools/tests/siege_bot.js), checks building, upgrading, selling, waves, winning, losing, the
save, and that every map's pads are clear of the currents. Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "siege"); os.makedirs(OUT, exist_ok=True)
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
    await pg.wait_for_timeout(500)
    await pg.add_script_tag(path=os.path.join(HERE, "siege_bot.js"))
    return b, pg, errs


async def main():
    async with async_playwright() as p:
        b, pg, errs = await page_at(p, URL + "?siege")
        ev = pg.evaluate
        check("test link opens the siege", await ev("REEL.S.state === 'siege' && SIEGE.SG && SIEGE.SG.test"))
        check("480x270 screen", await ev("[canvas.width, canvas.height]") == [480, 270])
        check("art loaded", await ev("SART.complete && SART.naturalWidth > 0 && Object.keys(SIEGE_ART).length === 49"))
        # every map: pads clear of currents and pools, close enough to matter
        bad = await ev("""(() => { const Q = SIEGE, out = []; for (const id in Q.SMAPS) { const M = Q.SMAPS[id], R = Q.mapRoutes(M);
            M.pads.forEach(([x, y], i) => { let near = 1e9; for (const k in R.seg) for (const p of R.seg[k]) near = Math.min(near, Math.hypot(p[0] - x, p[1] - y));
              if (near < 17 || near > 52 || Q.inPool(M, x, y, 6)) out.push(id + ':' + i); }); } return out; })()""")
        check("pads clear of currents and pools", bad == [], bad)
        check("routes end at the buoy", await ev("""Object.values(SIEGE.SMAPS).every(M => { const R = SIEGE.mapRoutes(M); return R.routes.every(pl => Math.hypot(pl.pts[pl.pts.length - 1][0] - M.buoy[0], pl.pts[pl.pts.length - 1][1] - M.buoy[1]) < 8); })"""))
        # building, upgrading, specialising, selling
        r = await ev("""(() => { const Q = SIEGE; Q.startSiege('0.0', {test: true}); const g = Q.SG, out = {};
            g.ring = 0; let b = Q.ringFor(0).find(b => b[2] === 'build' && b[7] === 0); Q.ringAct(b); out.built = !!g.towers[0] && g.shells === 260 - 70;
            g.shells = 1000; g.ring = 0; Q.ringAct(Q.ringFor(0).find(b => b[2] === 'up')); g.ring = 0; Q.ringAct(Q.ringFor(0).find(b => b[2] === 'up')); out.lv3 = g.towers[0].lv === 3;
            g.ring = 0; const specs = Q.ringFor(0).filter(b => b[2] === 'spec'); out.specs = specs.map(b => b[3]); Q.ringAct(specs[0]); out.sniper = g.towers[0].spec === 0 && Q.towerStats(g.towers[0]).pierce === 1;
            const before = g.shells; g.ring = 0; const sell = Q.ringFor(0).find(b => b[2] === 'sell'); Q.ringAct(sell); out.sold = !g.towers[0] && g.shells === before + Math.floor((70 + 90 + 120 + 220) * 0.6);
            g.shells = 5; g.ring = 1; Q.ringAct(Q.ringFor(1).find(b => b[2] === 'build')); out.broke = !g.towers[1];
            return out; })()""")
        check("build costs shells", r["built"]); check("upgrade to level 3", r["lv3"])
        check("two specialisations at level 3", r["specs"] == ["SNIPER CORAL", "BRAIN CORAL"], r["specs"]); check("sniper pierces", r["sniper"])
        check("sell refunds 60%", r["sold"]); check("can't build without shells", r["broke"])
        # waves: called early pays a bonus; enemies walk the route and cost hull at the buoy
        r = await ev("""(() => { const Q = SIEGE; Q.startSiege('0.1', {test: true}); const g = Q.SG; Q.callWave(); const n0 = g.spawn.length;
            for (let i = 0; i < 60 * 200 && g.hull === 20; i++) Q.siegeStep(1 / 60);
            return { n0, hull: g.hull, wave: g.wave }; })()""")
        check("a wave queues enemies", r["n0"] > 0, r); check("leaks cost hull", r["hull"] < 20, r)
        r = await ev("""(() => { const Q = SIEGE; Q.startSiege('0.1', {test: true}); const g = Q.SG; Q.callWave(); for (let i = 0; i < 60 * 60 && g.spawn.length; i++) Q.siegeStep(1 / 60);
            for (let i = 0; i < 30; i++) Q.siegeStep(1 / 60); const s0 = g.shells, t = g.nextT; Q.callWave(); return { bonus: g.shells - s0, t }; })()""")
        check("calling a wave early pays", r["bonus"] > 0, r)
        r = await ev("""(() => { const Q = SIEGE; Q.startSiege('0.0', {test: true}); const g = Q.SG; for (let w = 0; w < 8; w++) { Q.callWave(); for (let i = 0; i < 60 * 120; i++) { Q.siegeStep(1/60); if (g.result) break; } if (g.result) break; } return g.result; })()""")
        check("undefended: the buoy falls", r and r["won"] is False, r)
        # the hero (part 2)
        r = await ev("""(() => { const Q = SIEGE; Q.startSiege('0.0', {test: true, kit: 0}); const g = Q.SG, H = g.hero, out = {};
            out.atBuoy = Math.hypot(H.x - g.M.buoy[0], H.y - g.M.buoy[1] - 20) < 1;
            Q.siegeClick(300, 230); for (let i = 0; i < 400; i++) Q.siegeStep(1 / 60); out.walked = Math.hypot(H.x - 300, H.y - 230) < 2;
            // a crawler walking into the hero stops
            const pl = g.R.routes[2]; let best = 0, bd = 1e9; for (let s = 0; s < pl.total; s += 2) { const [x, y] = Q.atS(pl, s); const d = Math.hypot(x - H.x, y - H.y); if (d < bd) { bd = d; best = s; } }
            const [ex, ey] = Q.atS(pl, best); H.x = ex; H.y = ey; H.tx = null;
            g.en.push({k: 'crawler', ri: 2, s: best - 10, hp: 9999, max: 9999, spd: 22, arm: 0, slime: 0, hull: 1, bounty: 5, fl: '', slow: 0, slowT: 0, held: 0, poison: 0, poisonT: 0, x: 0, y: 0, right: true, hitT: 0, grabT: 0, id: 1});
            const e = g.en[0]; for (let i = 0; i < 120; i++) Q.siegeStep(1 / 60); const s1 = e.s; for (let i = 0; i < 120; i++) Q.siegeStep(1 / 60);
            out.blocked = e.block === H && Math.abs(e.s - s1) < 0.5 && e.hp < 9999;
            out.hurtHero = H.hp < H.max;
            H.hp = 1; for (let i = 0; i < 60; i++) Q.siegeStep(1 / 60); out.ko = H.dead > 0 && !e.block;
            for (let i = 0; i < 60 * 16; i++) Q.siegeStep(1 / 60); out.back = H.dead === 0 && H.hp === H.max;
            return out; })()""")
        for k, v in r.items(): check("hero: " + k, v, r)
        r = await ev("""(() => { const Q = SIEGE, out = {};
            for (const kit of [0, 1, 2]) { Q.startSiege('0.0', {test: true, kit}); const g = Q.SG, H = g.hero; H.x = 300; H.y = 180;
              for (let i = 0; i < 4; i++) g.en.push({k: 'crawler', ri: 0, s: 50 + i * 4, hp: 500, max: 500, spd: 0, arm: 0, slime: 0, hull: 1, bounty: 5, fl: '', slow: 0, slowT: 0, held: 0, poison: 0, poisonT: 0, x: 300 + i * 8, y: 190, right: true, hitT: 0, grabT: 0, id: i});
              const hp0 = g.en.map(e => e.hp + e.s); Q.heroAbility('q'); Q.heroAbility('e');
              out[kit] = { cd: H.cdQ > 0 && H.cdE > 0, did: g.en.some((e, i) => e.hp + e.s !== hp0[i] || e.slow > 0 || e.held > 0) || H.flareT > 0 }; }
            return out; })()""")
        check("abilities work and go on cooldown", all(v["cd"] and v["did"] for v in r.values()), r)
        check("hero levels", await ev("[1, 2, 5, 20].map(L => SIEGE.heroLevel(SIEGE.heroXpFor(L)))") == [1, 2, 5, 20])
        check("lamplighter lights the dark", await ev("(() => { const Q = SIEGE; Q.startSiege('0.0', {test: true, kit: 2}); const g = Q.SG, H = g.hero; H.x = 100; H.y = 100; return lit(110, 105) && !lit(300, 200); })()"))
        r = await ev("""(() => { const Q = SIEGE; REEL.store.siege = undefined; Q.startSiege('0.0', {}); const g = Q.SG; g.earned = 100; g.wave = g.waves.length - 1; g.spawn = []; g.en = []; Q.siegeStep(1/60);
            const q = REEL.store.siege; const out = { stars: q.stars['0.0'], xp: q.xp }; REEL.store.siege = undefined; return out; })()""")
        check("a real win saves stars and xp", r["stars"] == 3 and r["xp"] == 50 + 60, r)
        # the campaign (part 3)
        r = await ev("""(() => { const Q = SIEGE, st = REEL.store, out = {}; st.siege = undefined; Q.openCampaign();
            out.camp = !!Q.SG.camp && REEL.S.state === 'siege'; out.firstOpen = Q.mapOpen('0.0') && !Q.mapOpen('0.1') && !Q.mapOpen('1.0');
            st.siege.stars['0.0'] = 2; out.next = Q.mapOpen('0.1') && !Q.mapOpen('0.2');
            st.siege.stars['0.1'] = 3; st.siege.stars['0.2'] = 1; out.zone = Q.zonesDone() === 1; out.stars = Q.starsTotal() === 6;
            // research: in order, costs stars, resets
            Q.SG.camp.tab = 'research'; const node = (i, j) => [104 + j * 75 + 5, 42 + i * 22 - 4];
            Q.campClick(...node(0, 1)); out.order = !(st.siege.res.t0);
            Q.campClick(...node(0, 0)); Q.campClick(...node(0, 1)); Q.campClick(...node(0, 2)); out.bought = st.siege.res.t0 === 3 && Q.starsSpent() === 6;
            Q.campClick(...node(1, 0)); out.broke = !st.siege.res.t1;
            // research shows up in a map: cheaper coral, more range; no specs without research
            Q.startSiege('0.0', {}); const g = Q.SG; out.cost = Q.ringFor(0).find(b => b[7] === 0 && b[2] === 'build')[5] === 63;
            g.towers[0] = {k: 0, lv: 3, spec: -1, x: 0, y: 0, cd: 0}; out.range = Math.abs(Q.towerStats(g.towers[0]).r - 72 * 1.08) < 0.01 && Math.abs(Q.towerStats(g.towers[0]).d - 13 * 1.12) < 0.01;
            g.ring = 0; out.noSpec = !Q.ringFor(0).some(b => b[2] === 'spec') && Q.ringFor(0).some(b => b[2] === 'none');
            g.result = {won: true, stars: 3}; Q.siegeClick(240 + 100 - 92 + 4, 135 + 48 - 24 + 4); out.back = !!(Q.SG && Q.SG.camp);
            Q.SG.camp.tab = 'research'; Q.campClick(480 - 70 + 4, 238 + 4); out.reset = Object.keys(st.siege.res).length === 0;
            st.siege = undefined; return out; })()""")
        for k, v in r.items(): check("campaign: " + k, v, r)
        await ev("(() => { REEL.store.siege = {stars: {'0.0': 3, '0.1': 2, '0.2': 3}, xp: 2600, kit: 0, res: {t0: 3, hero: 1}, seen: []}; SIEGE.openCampaign(); })()")
        await pg.wait_for_timeout(150); await pg.screenshot(path=os.path.join(OUT, "campaign.png"))
        await ev("SIEGE.SG.camp.tab = 'research'"); await pg.wait_for_timeout(150); await pg.screenshot(path=os.path.join(OUT, "research.png"))
        await ev("SIEGE.SG.camp.tab = 'hero'"); await pg.wait_for_timeout(150); await pg.screenshot(path=os.path.join(OUT, "hero.png"))
        await ev("REEL.store.siege = undefined")
        # all 33 maps (parts 4-6): pads clear, buoys off the HUD, routes end at the buoy
        r = await ev("""(() => { const Q = SIEGE, out = []; const ids = Object.keys(Q.SMAPS); for (const id of ids) { const M = Q.SMAPS[id], R = Q.mapRoutes(M);
            if (M.pads.length < 11) out.push(id + ' pads ' + M.pads.length);
            const [bx, by] = M.buoy; if (Q.HUD_KEEP.some(([a, b, w, h]) => bx > a - 10 && bx < a + w + 10 && by - 40 > b - 4 && by - 40 < b + h)) out.push(id + ' buoy under HUD');
            if (M.crack && M.pads.some(([x, y]) => Math.hypot(x - M.crack[0], y - M.crack[1]) < 30)) out.push(id + ' pad on the crack'); }
            return [ids.length, out]; })()""")
        check("33 maps", r[0] == 33, r[0]); check("maps laid out cleanly", r[1] == [], r[1])
        check("every third map has its guardian", await ev("Object.keys(SIEGE.SMAPS).every(id => { const w = SIEGE.buildWaves(id, SIEGE.SMAPS[id]); const has = w[w.length - 1].some(g => g[0] === 'GUARD'); return id.endsWith('.2') ? has : !has; })"))
        # every guardian spawns, uses its trick and can be beaten, with no errors
        r = await ev("""(() => { const Q = SIEGE, out = {};
            for (let z = 0; z < 11; z++) { const id = z + '.2'; Q.startSiege(id, {test: true}); const g = Q.SG; g.shells = 9999;
              g.M.pads.forEach((p, i) => { g.towers[i] = {k: i % 2 ? 6 : 0, lv: 3, spec: 0, x: p[0], y: p[1], cd: 0}; });
              g.wave = g.waves.length - 1; const e = Q.addGuardian(0); const hp0 = e.hp;
              let acted = false; for (let i = 0; i < 60 * 40 && !g.result; i++) { Q.siegeStep(1 / 60); if (g.towers.some(t => t && (t.gone || t.off)) || g.dim > 0 || g.overgrown || g.eaten || e.heat > 0 || g.en.length > 1 || e.lives < 2) acted = true; }
              out[z] = { hurt: e.hp < hp0 || e.hp <= 0, acted, end: !!g.result }; }
            return out; })()""")
        check("guardians fight and break rules", all(v["hurt"] and v["acted"] for v in r.values()), r)
        # the twists
        r = await ev("""(() => { const Q = SIEGE, out = {}, mk = (k, ri, s) => { const g = Q.SG; g.en.push({k, ri, s, hp: 999, max: 999, spd: 20, arm: 0, slime: 0, hull: 1, bounty: 1, fl: '', slow: 0, slowT: 0, held: 0, poison: 0, poisonT: 0, x: 0, y: 0, right: true, hitT: 0, grabT: 0, id: Math.random()}); const e = g.en[g.en.length - 1]; const p = Q.atS(g.R.routes[ri], s); e.x = p[0]; e.y = p[1]; return e; };
            Q.startSiege('1.0', {test: true}); let g = Q.SG; const [kx, ky] = g.M.kelp[0]; const e1 = mk('crawler', 0, 0); e1.x = kx; e1.y = ky; out.kelpHides = Q.inKelp(e1);
            Q.startSiege('2.0', {test: true}); g = Q.SG; const [rx, ry] = g.M.rush[0]; const e2 = mk('crawler', 0, 0); e2.x = rx; e2.y = ry; out.rush = zoneSpeed(e2) > 1.5;
            Q.startSiege('3.0', {test: true}); g = Q.SG; const d0 = Q.zoneDark(); g.wave = 8; out.twilight = Q.zoneDark() > 0.5 && d0 < 0.5;
            Q.startSiege('4.0', {test: true}); g = Q.SG; for (let i = 0; i < 60; i++) Q.siegeStep(1/60); const dA = g.door; for (let i = 0; i < 60 * 21; i++) Q.siegeStep(1/60); out.doors = g.door !== dA && Q.doorOpen(0) !== Q.doorOpen(1);
            Q.startSiege('7.0', {test: true}); g = Q.SG; const e3 = mk('crawler', 0, g.R.routes[0].total * 0.25); e3.spd = 0; e3.hp = e3.max = 999; for (let i = 0; i < 60 * 7; i++) Q.siegeStep(1/60); out.vents = e3.hp < 999;
            Q.startSiege('8.0', {test: true}); g = Q.SG; g.hero.x = 5; g.hero.y = 260; const e4 = mk('crawler', 0, 40); e4.spd = 0; hurt(e4, 9999, 'phys'); for (let i = 0; i < 60 * 4; i++) Q.siegeStep(1/60); out.bonesRise = g.en.some(e => e.risen);
            Q.startSiege('5.0', {test: true}); g = Q.SG; g.towers[0] = {k: 0, lv: 1, spec: -1, x: g.M.pads[0][0], y: g.M.pads[0][1], cd: 0}; out.darkShort = darkK(g.towers[0]) < 1; g.towers[1] = {k: 5, lv: 3, spec: -1, x: g.M.pads[0][0] + 10, y: g.M.pads[0][1], cd: 0}; out.litFull = darkK(g.towers[0]) === 1;
            return out; })()""")
        for k, v in r.items(): check("twist: " + k, v, r)
        r = await ev("(() => { const Q = SIEGE; Q.startSiege('10.2', {test: true}); const g = Q.SG; g.wave = g.waves.length - 1; g.spawn = []; g.en = []; Q.siegeStep(1/60); return g.result; })()")
        check("beating the Sleeper seals the crack", r and r.get("ending") == 1, r)
        # bot play: a good bot wins the first two Shallows maps
        rs = [await ev("siegeBot('0.0', 1.0, 1200)") for _ in range(3)]
        check("good bot wins Sandbar Crossing", all(x["won"] for x in rs), rs)
        rs = [await ev("siegeBot('0.1', 1.0, 1200)") for _ in range(3)]
        check("good bot wins Tide Pool Tangle", sum(1 for x in rs if x["won"]) >= 2, rs)
        # the test link saves nothing
        check("test link saves nothing", await ev("!REEL.store.siege || Object.keys(REEL.store.siege.stars || {}).length === 0"))
        # screenshots: the map and a fight
        await ev("""(() => { const Q = SIEGE; Q.startSiege('0.0', {test: true}); const g = Q.SG; g.shells = 2000;
          const put = (i, k, lv, sp) => { g.towers[i] = {k, lv, spec: sp === undefined ? -1 : sp, x: g.M.pads[i][0], y: g.M.pads[i][1], cd: 0}; };
          put(0, 0, 2); put(1, 1, 2); put(3, 3, 2); put(5, 0, 3, 0); put(6, 2, 3); put(8, 1, 3, 1); put(9, 4, 1); put(12, 3, 3, 0); put(4, 5, 2); put(13, 6, 1);
          Q.callWave(); Q.callWave(); Q.callWave(); for (let i = 0; i < 600; i++) Q.siegeStep(1/60); g.ring = 7; })()""")
        await pg.wait_for_timeout(200); await pg.screenshot(path=os.path.join(OUT, "fight.png"))
        for mid in ["0.0", "0.1", "0.2"]:
            await ev(f"SIEGE.startSiege('{mid}', {{test: true}})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=os.path.join(OUT, "map_" + mid + ".png"))
        # clicking: a pad opens the ring, a ring button builds, Escape opens the menu, leaving goes back to the boat
        await ev("SIEGE.startSiege('0.0', {test: true})")
        box = await pg.evaluate("(() => { const r = canvas.getBoundingClientRect(); return [r.left, r.top, r.width / 480]; })()")
        L, T, k = box
        px, py = await ev("SIEGE.SG.M.pads[2]")
        await pg.mouse.click(L + px * k, T + py * k); await pg.wait_for_timeout(100)
        check("click a pad opens the ring", await ev("SIEGE.SG.ring === 2"))
        bx, by = await ev("SIEGE.ringFor(2)[0].slice(0, 2)")
        await pg.mouse.click(L + bx * k, T + by * k); await pg.wait_for_timeout(100)
        check("click a ring button builds", await ev("!!SIEGE.SG.towers[2]"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100)
        check("Escape opens the menu", await ev("SIEGE.SG.menu && SIEGE.SG.paused"))
        await pg.mouse.click(L + 240 * k, T + (135 - 41 + 22 + 2 * 19 + 7) * k); await pg.wait_for_timeout(200)
        check("leave goes back to the boat", await ev("REEL.S.state === 'title' && !SIEGE.SG && canvas.height === 200"))
        check("no page errors", not errs, errs[:3])
        await b.close()
        # phone width still works
        b, pg, errs = await page_at(p, URL + "?siege", 390, 700)
        await pg.wait_for_timeout(300); await pg.screenshot(path=os.path.join(OUT, "phone.png"))
        check("phone: no errors", not errs, errs[:3])
        await b.close()
    print("\n" + ("ALL PASS" if not fails else "FAILED: " + ", ".join(fails)))


asyncio.run(main())
