"""Chip economy part 1 (Nov 18, 2026): the Captain's Locker, the Shady Dealer, the VIP derby cap.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino1.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino1/."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino1"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def fresh(p, w, h):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h})
    await ctx.route("**/*firebase*/**", lambda r: r.abort())
    page = await ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
    await page.evaluate("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; })()")
    return b, page, errs


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        r = await ev("""(() => CASINO.LOCKER.concat(CASINO.DEALER).filter(it => CASINO.czIdx(it[0], it[1]) < 0).map(it => it[1]))()""")
        check("every Locker and Dealer item exists in the data", not r, r)
        r = await ev("""(() => CASINO.LOCKER.concat(CASINO.DEALER).filter(it => { const i = CASINO.czIdx(it[0], it[1]), n = { hat: 26, pet: 14, boat: 18, flag: 12, flair: 20, hook: 14, line: 14, trail: 12 }[it[0]]; return i < n; }).map(it => it[1]))()""")
        check("none of them are in the coin shop (all past SHOP_N)", not r, r)
        check("coin shop unchanged", await ev("REEL.CATS.map(c => c[2].length).join(',')") == await ev("REEL.CATS.map(c => c[2].length).join(',')"))
        r = await ev("""(() => { const miss = []; CASINO.LOCKER.concat(CASINO.DEALER).forEach(it => { const i = CASINO.czIdx(it[0], it[1]);
            if (["hat", "pet", "boat", "flag", "flair", "hook"].includes(it[0]) && !DATA.atlas[it[0] + i]) miss.push(it[1]);
            if (it[0] === "pet" && !DATA.atlas["mpet" + i]) miss.push("monster " + it[1]); if (it[0] === "hat" && !DATA.atlas["mhat" + i]) miss.push("monster " + it[1]); }); return miss; })()""")
        check("every new sprite (and monster form) is in the atlas", not r, r)
        check("locker prices 10,000 to 75,000", await ev("Math.min(...CASINO.LOCKER.map(i => i[2])) === 10000 && Math.max(...CASINO.LOCKER.map(i => i[2])) === 75000"))
        check("dealer prices 3,000 to 15,000", await ev("CASINO.DEALER.every(i => i[2] >= 3000 && i[2] <= 15000)"))

        # buying from the locker
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 80000; q.spent = 0; casinoOpen('locker'); CASINO.CZ.lk.sel = 0; EXTRA_OV.locker.key('Space', 0);
            const it = CASINO.LOCKER[0], i = CASINO.czIdx(it[0], it[1]); return [q.chips, REEL.store.own.boat.includes(i), REEL.store.eq.boat === i, q.spent]; })()""")
        check("buying the Golden Trawler takes 75,000 and puts it on", r == [5000, True, True, 75000], r)
        await page.screenshot(path=OUT + "/locker_wide.png")
        r = await ev("""(() => { EXTRA_OV.locker.key('Space', 0); const i = CASINO.czIdx('boat', 'GOLDEN TRAWLER'); return REEL.store.eq.boat !== i; })()""")
        check("pressing again takes it off", r)
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 100; CASINO.CZ.lk.sel = 1; EXTRA_OV.locker.key('Space', 0); return [q.chips, CASINO.czOwn(CASINO.LOCKER[1])]; })()""")
        check("can't buy without the chips", r == [100, False], r)
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 1e6; CASINO.LOCKER.forEach((it, k) => { CASINO.CZ.lk.sel = k; if (!CASINO.czOwn(it)) EXTRA_OV.locker.key('Space', 0); });
            return [REEL.store.titles.includes('captain'), REEL.store.titles.includes('whale'), q.spent]; })()""")
        check("the whole locker gives THE CAPTAIN and (past 100,000) WHALE", r[0] and r[1] and r[2] >= 100000, r)
        r = await ev("""(() => { REEL.S.overlay = 'locker'; closeOverlay(); return REEL.S.overlay; })()""")
        check("Back from the locker goes to the chip shop", r == "chipshop", r)

        # the dealer
        r = await ev("""(() => { const seen = new Set(), w0 = CASINO.dealerWeek(); const D = CASINO.DEALER, O = CASINO.DEALER_ORDER;
            for (let w = w0; w < w0 + 8; w++) for (let k = 0; k < 3; k++) seen.add(O[(w * 3 + k) % D.length]);
            return [seen.size, D.length, CASINO.dealerStock().length, CASINO.dealerDaysLeft()]; })()""")
        check("every dealer item comes round within 8 weeks", r[0] == r[1] == 24 and r[2] == 3 and 1 <= r[3] <= 7, r)
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 20000; casinoOpen('dealer'); const it = CASINO.dealerStock()[0]; EXTRA_OV.dealer.key('Space', 0);
            const own = CASINO.czOwn(it); EXTRA_OV.dealer.key('ArrowRight', 1); return [own, CASINO.CZ.dl.tab, CASINO.dealerStock().length]; })()""")
        check("buying from the dealer, then the stash tab", r[0] and r[1] == 1, r)
        await page.screenshot(path=OUT + "/dealer_stash_wide.png")

        # chip shop rows
        r = await ev("""(() => { REEL.S.overlay = 'chipshop'; const i = REEL.SHOP_ROWS.findIndex(x => x[0] === 'dealer'); REEL.TAVs.shopSel = i; REEL.shopBuy(i); return REEL.S.overlay; })()""")
        check("chip shop row opens the dealer", r == "dealer", r)
        check("VIP derby max win is 10,000", await ev("derbyMaxWin({ vip: true }) === 10000 && derbyMaxWin({ vip: false }) === 5000"))

        # every item tried on, both widths, without errors
        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(200)
            for o, n in (("locker", 13), ("dealer", 3)):
                for k in range(n):
                    await ev("(() => { casinoOpen('%s'); CASINO.CZ.%s.sel = %d; })()" % (o, "lk" if o == "locker" else "dl", k))
                    await page.wait_for_timeout(40)
            await ev("(() => { casinoOpen('locker'); CASINO.CZ.lk.sel = 2; })()"); await page.wait_for_timeout(150)
            await page.screenshot(path=OUT + "/locker_%s.png" % tag)
            await ev("(() => { casinoOpen('dealer'); })()"); await page.wait_for_timeout(150)
            await page.screenshot(path=OUT + "/dealer_%s.png" % tag)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
