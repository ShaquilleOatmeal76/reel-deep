"""Driftwood Isle, part 7: Lighthouse Point and the caves (island.js). The headland, the cave mouth and elevator, 50
generated floors, the lantern, pulse combat, creatures, mining, eating, blacking out, the five bosses, the keeper's
log pages, cave fishing and the new crafting and upgrades.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_caves.py
Writes to the live database are blocked."""
import asyncio, os, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_caves"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def fresh(p, w, h, save=None):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    await ctx.route("**/*firebase*/**", lambda r: r.abort())
    if save: await ctx.add_init_script("localStorage.setItem('reeldeep', JSON.stringify(%s))" % save)
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
    await page.evaluate("""(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 80;
      Object.assign(REEL.store.isle, { planks: 60, rope: 1, sail: 1, compass: 1, built: 1 }); })()""")
    await page.wait_for_timeout(200)
    return b, page, errs

TICK = "(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })"
SEL = "(id => { const s = isleSave(); let i = s.inv.findIndex(q => q && q[0] === id); if (i < 0) { invAdd(id, 1); i = s.inv.findIndex(q => q && q[0] === id); } if (i > 8) { const t = s.inv[8]; s.inv[8] = s.inv[i]; s.inv[i] = t; i = 8; } s.sel = i; })"
MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
CLEAR = "(() => { ISLE.msg = null; ISLE.list = null; })()"
# put the player just below a thing and facing it
FACE_OBJ = "(o => { ISLE.px = o.x + 8; ISLE.py = o.y + 26; ISLE.dir = 'up'; ISLE.msg = null; })"


async def main():
    async with async_playwright() as p:
        # an island from part 6: the path north opens, with a message
        old = json.dumps({"isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 0, "day": 6, "min": 600, "sd": 900, "intro": 1, "kit": 1, "fish0": 1, "p5": 1, "inv": [["hoe", 1], ["can", 1], None, ["rod", 1], ["net", 1], ["axe", 1], ["pick", 1]] + [None] * 11, "sel": 0, "water": 30, "farm": {}, "bin": [], "log": {}, "pots": [], "folk": {}, "arrived": {"bram": 1, "pickles": 1}}}, "dives": 90, "seenHelp": True})
        b, page, errs = await fresh(p, 1440, 810, old)
        ev = page.evaluate
        await ev("startIsland()")
        r = await ev(MSG)
        check("old save: told the way north is open", "LIGHTHOUSE POINT" in r, r[-200:])
        await ev(CLEAR)
        await ev("isleGo('lagoon', 600, 30, 'up')")
        check("the driftwood pile north of the Lagoon is gone", await ev("!ISLE.map.objs.some(o => o.k === 'pile' && o.y < 20)"))
        await page.keyboard.down("ArrowUp"); await ev(TICK + "(30)"); await page.keyboard.up("ArrowUp")
        r = await ev("[ISLE.map.id, Math.round(ISLE.px), Math.round(ISLE.py)]")
        check("north of the Lagoon: Lighthouse Point", r[0] == "point", r)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/point_arrive.png")
        r = await ev("""(() => { const A = AREAS.point; let land = 0, sea = 0; for (let y = 8; y < 800; y += 16) for (let x = 8; x < 800; x += 16) { const t = terrainAt(A, x, y); if (t === 'a' || t === 'd') sea++; else land++; } return [land, sea, terrainAt(A, 400, 790), terrainAt(A, 20, 20)]; })()""")
        check("a headland: land in the middle, sea round the edges, a way back south", r[0] > 1000 and r[1] > 600 and r[2] in ("p", "g") and r[3] in ("a", "d"), r)
        await ev("(() => { ISLE.px = 420; ISLE.py = 260; isleSave().min = 700; })()"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/lighthouse.png")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'lighthouse'); isleAct(o); return " + MSG + "; })()")
        check("the lighthouse is locked", "LOCKED" in r, r)
        r = await ev("[waterKind(20, 20), pickFish(waterKind(20, 20), isleSave()) !== null]")
        check("sea fishing off the point", r == ["deep", True] or r == ["sea", True], r)
        await page.keyboard.down("ArrowDown"); await ev("(() => { ISLE.msg = null; ISLE.px = 400; ISLE.py = 780; })()"); await ev(TICK + "(30)"); await page.keyboard.up("ArrowDown")
        check("south off the point back to the Lagoon", await ev("ISLE.map.id") == "lagoon")
        await b.close()

        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        await ev("startIsland()"); await ev(CLEAR); await ev("isleSave().min = 600")

        # every floor generates, and you can always walk from the ladder in to the ladder down
        r = await ev("""(() => { const bad = [], t0 = performance.now();
          for (let n = 1; n <= 50; n++) { const m = buildCave(n), G = m.tiles, [ex, ey] = m.exitT, sx = Math.floor(m.entry[0] / 16), sy = Math.floor((m.entry[1] - 4) / 16);
            const seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
            while (q.length) { const [x, y] = q.shift(); for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + a, ny = y + b, k = nx + ',' + ny; if (!seen.has(k) && G[ny] && G[ny][nx] === 'f') { seen.add(k); q.push([nx, ny]); } } }
            if (!seen.has(ex + ',' + ey)) bad.push(n);
            if (G[sy][sx] !== 'f') bad.push(n + ' entry');
            const nf = m.foes.length; if (n % 10 === 0 ? nf !== 1 : nf < 3) bad.push(n + ' foes ' + nf);
          }
          return [bad, Math.round(performance.now() - t0)]; })()""")
        check("all 50 floors: ladder down reachable, foes or a boss", not r[0], r)
        check("floors build quickly", r[1] < 6000, r[1])

        # the cave mouth: no elevator yet, so straight down
        await ev("isleGo('point', 586, 446, 'up')")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'cavemouth'); isleAct(o); return [" + MSG + ", ISLE.msg && ISLE.msg.choice && ISLE.msg.choice.opts]; })()")
        check("the cave mouth offers to climb down", "CLIMB DOWN" in r[0], r)
        await ev("ISLE.msg.t = 9"); await page.keyboard.press("KeyE")
        r = await ev("[ISLE.map.id, ISLE.map.A.cave, ISLE.cave && ISLE.cave.hp, isleSave().cave.hpMax, ISLE.cave.foes.length, isleSolidAt(ISLE.px, ISLE.py)]")
        check("floor 1: a cave, five hearts, creatures, standing somewhere open", r[0] == "cave_1" and r[1] and r[2] == 5 and r[3] == 5 and r[4] >= 3 and r[5] is False, r)
        r = await ev(MSG)
        check("first time down: how to fight and get out", "PULSE" in r, r)
        await ev(CLEAR); await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/floor1.png")

        # the pulse: hits what's close, then has to recharge
        await ev("(() => { const C = ISLE.cave; C.foes = [makeFoe('crab', ISLE.px + 20, ISLE.py - 6, 1)]; C.foes[0].hp = 3; })()")
        await page.keyboard.press("KeyX")
        r = await ev("[ISLE.cave.foes[0].hp, ISLE.cave.charge, ISLE.cave.ring !== null]")
        check("X pulses: the crab is hit and the pulse needs recharging", r[0] == 2 and r[1] == 0 and r[2], r)
        await page.keyboard.press("KeyX")
        check("no second pulse straight away", await ev("ISLE.cave.foes[0].hp") == 2)
        await ev(TICK + "(60)"); await ev("(() => { const f = ISLE.cave.foes[0]; f.x = ISLE.px + 18; f.y = ISLE.py - 6; f.stun = 0; })()")
        await page.keyboard.press("ShiftLeft"); await ev(TICK + "(60)"); await ev("(() => { const f = ISLE.cave.foes[0]; if (f) { f.x = ISLE.px + 18; f.y = ISLE.py - 6; } })()"); await page.keyboard.press("KeyX")
        r = await ev("[ISLE.cave.foes.length]")
        check("Shift pulses too; three hits and it's gone", r[0] == 0, r)

        # creatures hurt; you get knocked back and a moment's grace
        await ev("(() => { const C = ISLE.cave; C.inv = 0; C.hp = 5; C.foes = [makeFoe('crab', ISLE.px + 4, ISLE.py - 6, 1)]; })()")
        await ev(TICK + "(3)")
        r = await ev("[ISLE.cave.hp, ISLE.cave.inv > 0]")
        check("touching a creature costs a heart", r == [4, True], r)
        await ev("ISLE.cave.foes = []")
        # every creature moves without errors
        r = await ev("""(() => { const C = ISLE.cave; C.inv = 999; C.foes = Object.keys(CAVE_FOES).map((k, i) => { const f = makeFoe(k, ISLE.px + Math.cos(i) * 60, ISLE.py + Math.sin(i) * 60, 25); f.awake = true; return f; });
          for (let i = 0; i < 600; i++) REEL.simTick(1 / 60); return C.foes.length; })()""")
        check("all ten creatures move about", r == 10, r)
        await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/creatures.png")
        await ev("(() => { ISLE.cave.foes = []; ISLE.cave.shots = []; ISLE.cave.inv = 0; })()")

        # mining: a rock gives stone, an ore rock gives ore
        await ev(SEL + "('pick')")
        r = await ev("""(() => { const o = ISLE.map.objs.find(q => q.cave && q.cave.kind === 'rock'); ISLE.px = o.x + 8; ISLE.py = o.y + 24; ISLE.dir = 'up'; ISLE.msg = null; window._r = o; return invCount('stone'); })()""")
        await page.keyboard.press("KeyE")
        r2 = await ev("[invCount('stone'), ISLE.map.objs.includes(_r)]")
        check("one hit breaks a rock: stone", r2[0] > r and not r2[1], [r, r2])
        r = await ev("""(() => { ISLE.map.objs.push({ k: 'core1', x: ISLE.px - 8, y: ISLE.py - 40, solid: [3, 7, 10, 6], cave: { kind: 'ore', hp: 2 } }); ISLE.py -= 0; return invCount('copper'); })()""")
        await ev("(() => { const o = ISLE.map.objs[ISLE.map.objs.length - 1]; ISLE.px = o.x + 8; ISLE.py = o.y + 24; ISLE.dir = 'up'; })()")
        await page.keyboard.press("KeyE"); await page.keyboard.press("KeyE")
        check("an ore rock takes two hits: copper", await ev("invCount('copper')") > r)

        # eating: a dish heals two hearts
        await ev("(() => { ISLE.cave.hp = 2; ISLE.px = ISLE.map.entry[0]; ISLE.py = ISLE.map.entry[1] + 30; ISLE.dir = 'down'; })()")
        await ev(SEL + "('d_stew')"); await ev("(() => { if (isleSolidAt(ISLE.px, ISLE.py)) { ISLE.px = ISLE.map.entry[0]; ISLE.py = ISLE.map.entry[1]; } ISLE.dir = 'right'; })()")
        await page.keyboard.press("KeyE")
        check("eat a dish in the caves: +2 hearts", await ev("ISLE.cave.hp") == 4)
        await ev(SEL + "('chest')"); await page.keyboard.press("KeyE")
        check("can't put things down in the caves", await ev("!isleSave().placed.some(p => p.a.startsWith('cave'))"))

        # down the ladder; floor 2 has a chest with the keeper's first page
        await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'cdown'); isleAct(o); })()")
        r = await ev("[ISLE.map.id, ISLE.cave.n, ISLE.map.objs.some(o => o.k === 'cchest')]")
        check("the ladder goes down to floor 2, which has a chest", r == ["cave_2", 2, True], r)
        await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'cchest'); isleAct(o); })()")
        r = await ev("[isleSave().pages[1], " + MSG + ", isleSave().cave.chest[2]]")
        check("the chest: loot and page 1 of the keeper's log", r[0] == 1 and "PAGE 1 OF THE KEEPER'S LOG" in r[1] and r[2] == 1, r)
        await ev(CLEAR)
        check("the chest stays opened", await ev("!buildCave(2).objs.some(o => o.k === 'cchest')"))

        # floor 5 sets the elevator; the cave mouth then offers a list
        await ev("enterFloor(5)"); await ev(CLEAR)
        check("reaching floor 5 starts the elevator", await ev("isleSave().cave.lift") == 5)
        await ev("caveLeave(false)")
        r = await ev("[ISLE.map.id, ISLE.cave]")
        check("the ladder up takes you back to the point", r == ["point", None], r)
        await ev("(() => { ISLE.msg = null; const o = ISLE.map.objs.find(q => q.k === 'cavemouth'); isleAct(o); })()")
        r = await ev("[ISLE.list && ISLE.list.kind, listRows().map(q => q.name)]")
        check("the elevator: floor 1 and floor 5", r == ["lift", ["FLOOR 1", "FLOOR 5"]], r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/elevator.png")
        await page.keyboard.press("KeyE")
        check("taking the elevator to floor 5", await ev("ISLE.map.id") == "cave_5")
        await ev(CLEAR)

        # blacking out: back at the point, half of this trip's finds gone
        await ev("(() => { invAdd('iron', 10); ISLE.cave.hp = 1; ISLE.cave.inv = 0; ISLE.cave.foes = [makeFoe('crab', ISLE.px + 3, ISLE.py - 6, 5)]; })()")
        before = await ev("invCount('iron')")
        await ev(TICK + "(3)")
        r = await ev("[ISLE.map.id, invCount('iron'), " + MSG + "]")
        check("black out: wake at the cave mouth", r[0] == "point" and "WAKE UP AT THE CAVE MOUTH" in r[2], r)
        check("...having lost half of what you found on the trip", before - r[1] == 5, [before, r[1]])
        await ev(CLEAR)

        # cave fishing: a pool on some floor; the cave fish bite there
        r = await ev("""(() => { for (let n = 1; n <= 9; n++) { enterFloor(n); ISLE.msg = null; const M_ = ISLE.map; for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (M_.tiles[y][x] === 'a') return [n, waterKind(x * 16 + 8, y * 16 + 8), pickFish('cave1', isleSave())]; } return null; })()""")
        check("cave pools hold cave fish", r is not None and r[1] == "cave1" and r[2] is not None, r)
        check("cave fish are in the log now (not 'later'): 25 plus The Lantern", await ev("Object.values(FISH).filter(f => f.where.startsWith('cave') && !LATER.test(f.where)).length") == 26)

        # the bosses: each moves and attacks without errors; beating one gives a page, a heart, a trophy and a ladder
        for L in range(1, 6):
            await ev("(() => { ISLE.msg = null; ISLE.cave = null; enterFloor(%d); ISLE.msg = null; ISLE.cave.inv = 999; })()" % (L * 10))
            r = await ev("[ISLE.cave.foes.length, ISLE.cave.foes[0].boss, ISLE.cave.foes[0].kind]")
            check("floor %d: the boss is waiting" % (L * 10), r[0] == 1 and r[1] == L, r)
            await ev("(() => { for (let i = 0; i < 480; i++) { REEL.simTick(1 / 60); ISLE.cave.inv = 999; } })()")
            await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/boss%d.png" % L)
            r = await ev("""(() => { const C = ISLE.cave, f = C.foes.find(q => q.boss); if (!f) return 'gone';
              f.hp = 1; if (f.kind === 'frost') { f.st = 'up'; f.stT = 2; } if (f.kind === 'cinder') { f.st = 'idle'; f.stT = 5; } if (f.kind === 'dreamer') { f.t = 2.6; f.eye = 1; }
              C.foes = [f]; C.inv = 0; ISLE.px = f.x; ISLE.py = f.y + f.r + 16; C.charge = 1; ISLE.msg = null;
              const t = f.t; if (f.kind === 'dreamer') { const _b = bossTick; } cavePulse(); return [isleSave().cave.boss[%d], isleSave().cave.hpMax, invCount(BOSSES[%d].tro) + isleSave().owed.filter(o => o[0] === BOSSES[%d].tro).length, isleSave().pages[PAGE_FLOORS.indexOf(%d) + 1], ISLE.map.objs.some(o => o.k === 'cdown')]; })()""" % (L, L, L, L * 10))
            check("beat boss %d: recorded, +1 heart, trophy, page%s" % (L, ", ladder down" if L < 5 else ""), r != "gone" and r[0] == 1 and r[1] == 5 + L and r[2] == 1 and r[3] == 1 and r[4] == (L < 5), r)
            await ev(CLEAR)
        r = await ev("""(() => { const f = makeBoss(3); f.st = 'under'; const f2 = makeBoss(4); f2.st = 'air'; const f3 = makeBoss(5); f3.eye = 0; return [bossOpen(f), bossOpen(f2), bossOpen(f3)]; })()""")
        check("Frostmaw under the ice, the Cinder King in the air and the Dreamer with its eyes shut can't be hit", r == [False, False, False], r)
        check("a beaten boss stays beaten", await ev("buildCave(10).foes.length") == 0)

        # the keeper's log, the new upgrades and crafting
        await ev("(() => { caveLeave(false); ISLE.msg = null; ISLE.menu = { sel: ISLE_MENU.findIndex(m => m[0] === \"KEEPER'S LOG\") }; isleMenuPick(); })()")
        r = await ev("[ISLE.list && ISLE.list.kind, listRows().filter(q => q.ok).length, listRows().length]")
        check("the Keeper's Log lists the pages found", r == ["pages", 6, 20], r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/pages.png")
        await page.keyboard.press("KeyE")
        check("reading a page", "KEEPER'S LOG, PAGE 1" in await ev(MSG))
        await ev(CLEAR)
        r = await ev("[UPGRADES.map(u => u[0]).slice(-2), CRAFT.map(c => c[0]).slice(-5), ['tro_crab', 'sprinkler3', 'copper', 'ruby', 'lantern', 'pulse', 'page'].map(id => itemIcon(id).width > 0)]")
        check("bright lantern and strong pulse at the shipyard; five new recipes; icons", r[0] == ["lantern", "pulse"] and len(r[1]) == 5 and all(r[2]), r)
        r = await ev("""(() => { const s = isleSave(); s.placed.push({ a: 'flats', x: 30, y: 30, id: 'sprinkler3' }); s.farm['flats:32,32'] = { c: 'lettuce', d: 0, w: 0 }; s.farm['flats:33,32'] = { c: 'lettuce', d: 0, w: 0 }; sprinklersWater(s); return [s.farm['flats:32,32'].w, s.farm['flats:33,32'].w]; })()""")
        check("the iron sprinkler waters 5 x 5", r == [1, 0], r)
        r = await ev("[giftTaste(FOLK.margo, 'ruby'), giftTaste(FOLK.margo, 'copper')]")
        check("villagers like gems", r == ["like", "neutral"], r)
        check("no page errors", not errs, errs)
        await b.close()

        # phone: the pulse button works by touch
        b, page, errs = await fresh(p, 390, 700)
        ev = page.evaluate
        await ev("startIsland()"); await ev(CLEAR); await ev("(() => { isleSave().min = 600; enterFloor(3); ISLE.msg = null; ISLE.cave.foes = []; })()")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/phone.png")
        r = await ev("(() => { const [x, y, w, h] = pulseBtn(), c = canvas.getBoundingClientRect(); return [c.left + (x + w / 2) / IW * c.width, c.top + (y + h / 2) / IH * c.height]; })()")
        await page.mouse.click(r[0], r[1])
        check("phone: tapping PULSE pulses", await ev("ISLE.cave.charge < 0.2"))
        check("no page errors (phone)", not errs, errs)
        await b.close()

    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
