"""Chip economy part 2 (Nov 18, 2026): the TABLES / MACHINES menus, Line Snap and Bigger Fish.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino2.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino2/."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino2"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


FAST = "(() => { window._addChips = window._addChips || addChips; window.addChips = (n, why) => { const q = REEL.tav(); q.chips = Math.max(0, q.chips + n); if (why === 'win' && n > q.stats.win) q.stats.win = n; return n; }; })()"
SLOW = "(() => { window.addChips = window._addChips; })()"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.tav().chips = 5000; })()")

        # ---- menus
        r = await ev("(() => tavRows().map(r => r[2]))()")
        check("tavern rows: tables and machines replace catch 21 and plinko", r[:3] == ["tables", "machines", "derby"] and "c21" not in r and "plinko" not in r, r)
        r = await ev("""(() => { const out = []; REEL.S.overlay = 'tavern'; casinoOpen('tables'); out.push(REEL.S.overlay);
            CASINO.GAME_OPEN.c21(); out.push(REEL.S.overlay); closeOverlay(); out.push(REEL.S.overlay);
            casinoOpen('machines'); CASINO.GAME_OPEN.plinko(); closeOverlay(); out.push(REEL.S.overlay);
            CASINO.GAME_OPEN.snap(); closeOverlay(); out.push(REEL.S.overlay); closeOverlay(); out.push(REEL.S.overlay); return out; })()""")
        check("Back: catch 21 -> tables, plinko -> machines, line snap -> machines, menu -> tavern", r == ["tables", "c21", "tables", "machines", "machines", "tavern"], r)
        r = await ev("""(() => { REEL.S.overlay = 'tables'; const h = CASINO.HUBS.tables.games.map(gm => gm[0]); return h; })()""")
        check("tables menu lists catch 21 and bigger fish", r[:2] == ["c21", "bigger"], r)
        await ev("(() => { REEL.S.overlay = 'machines'; })()"); await page.wait_for_timeout(150)
        await page.screenshot(path=OUT + "/machines_wide.png")

        # ---- Line Snap: the snap point really has P(M >= m) = 0.95 / m
        r = await ev("""(() => { const n = 400000, M = []; for (let i = 0; i < n; i++) M.push(CASINO.snapCrash());
            return [1.0001, 1.5, 2, 5, 10, 50].map(m => [m, M.filter(x => x >= m).length / n * m]); })()""")
        bad = [x for x in r if abs(x[1] - 0.95) > 0.02 + 0.004 * x[0] ** 0.5]
        check("line snap: P(reach m) x m ~ 0.95 at every m", not bad, r)
        await ev(FAST)
        r = await ev("""(() => { const out = {}; CASINO.GAME_OPEN.snap(); const c = CASINO.snap; c.bet = 50;
            for (const a of [1.5, 2, 3, 10]) { c.auto = a; let st = 0, back = 0; REEL.tav().chips = 1e9;
              for (let i = 0; i < 12000; i++) { const c0 = REEL.tav().chips; CASINO.snapGo(); let k = 0; while (c.phase === 'reel' && k++ < 5000) CASINO.snapTick(0.05); st += 50; back += REEL.tav().chips - c0 + 50; }
              out[a] = back / st; } c.auto = 0; return out; })()""")
        print("  line snap payback by auto cash-out:", {k: round(v, 3) for k, v in r.items()})
        check("line snap pays back ~95% at x1.5, x2, x3", all(abs(r[k] - 0.95) < 0.03 for k in ("1.5", "2", "3")), r)
        check("line snap pays back ~95% at x10 (noisier)", abs(r["10"] - 0.95) < 0.12, r)
        r = await ev("""(() => { const c = CASINO.snap; c.bet = 75; c.auto = 0; REEL.tav().chips = 1e9; const c0 = REEL.tav().chips;
            const keep = Math.random; Math.random = () => 0.99999; CASINO.snapGo(); Math.random = keep;   // a snap point near x1000
            let k = 0; while (c.phase === 'reel' && k++ < 100000) CASINO.snapTick(0.05); return [c.phase, REEL.tav().chips - c0 + 75]; })()""")
        check("line snap never pays more than 5,000", r[0] == "cashed" and r[1] <= 5000, r)
        r = await ev("""(() => { const c = CASINO.snap; c.auto = 0; REEL.tav().chips = 100; const keep = Math.random; Math.random = () => 0.5; CASINO.snapGo(); Math.random = keep;
            REEL.S.overlay = 'snap'; closeOverlay(); const stay = REEL.S.overlay; CASINO.snapTick(0.5); CASINO.snapGo(); return [stay, c.phase, c.win]; })()""")
        check("Escape mid-reel keeps you at the table; cash out pays stake x m", r[0] == "snap" and r[1] == "cashed" and r[2] >= 50, r)

        # ---- Bigger Fish: whatever you do, about 95% back
        r = await ev("""(() => { const out = {}; CASINO.GAME_OPEN.bigger(); const c = CASINO.big; c.bet = 50;
            for (const k of [1, 2, 4, 8]) { let st = 0, back = 0; REEL.tav().chips = 1e9;
              for (let i = 0; i < 20000; i++) { const c0 = REEL.tav().chips; CASINO.bigDeal(); while (c.phase === 'play' && c.n < k) CASINO.bigCall(c.cur.w <= 50 ? 1 : -1); if (c.phase === 'play') CASINO.bigCash(); st += 50; back += REEL.tav().chips - c0 + 50; }
              out[k] = back / st; } return out; })()""")
        print("  bigger fish payback by calls before cashing:", {k: round(v, 3) for k, v in r.items()})
        check("bigger fish pays back ~95% for 1, 2 and 4 calls", all(abs(r[k] - 0.95) < 0.03 for k in ("1", "2", "4")), r)
        check("bigger fish pays back ~95% for 8 calls (noisier)", abs(r["8"] - 0.95) < 0.08, r)
        r = await ev("""(() => { const c = CASINO.big; REEL.tav().chips = 1000; CASINO.bigDeal(); const before = REEL.tav().chips; CASINO.bigCash(); return [c.phase, REEL.tav().chips === before]; })()""")
        check("bigger fish: no cashing out before a right call", r == ["play", True], r)
        r = await ev("""(() => { const c = CASINO.big; c.cur = { id: 'tuna', w: 50, leg: false }; const keep = Math.random; let k = 0; Math.random = () => [0.5, 0.495][k++ % 2]; CASINO.bigCall(1); Math.random = keep; return [c.phase, c.msg]; })()""")
        check("bigger fish: a tie loses", r[0] == "done" and "TIE" in r[1], r)
        await ev(SLOW)

        # ---- both widths draw without errors
        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(150)
            for o in ("tables", "machines"):
                await ev("(() => { REEL.S.overlay = '%s'; })()" % o); await page.wait_for_timeout(80)
                await page.screenshot(path=OUT + "/%s_%s.png" % (o, tag))
            await ev("(() => { REEL.tav().chips = 5000; CASINO.GAME_OPEN.snap(); const c = CASINO.snap; c.auto = 0; c.phase = 'stake'; const keep = Math.random; Math.random = () => 0.9; CASINO.snapGo(); Math.random = keep; for (let i = 0; i < 40; i++) CASINO.snapTick(0.1); })()")
            await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/snap_%s.png" % tag)
            await ev("(() => { CASINO.snapGo(); CASINO.GAME_OPEN.bigger(); CASINO.big.phase = 'stake'; CASINO.bigDeal(); })()")
            await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/bigger_%s.png" % tag)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
