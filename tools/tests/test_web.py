import asyncio, json, sys
from playwright.async_api import async_playwright
OUT = "/tmp/claude-0/-home-claude/6ab12b29-cf8d-5ae6-a8f6-bf31b1fa9346/scratchpad/" + __import__("os").environ.get("OUTD", "wshots")
import os; os.makedirs(OUT, exist_ok=True)
BOT = """
(async () => {
  const R = window.REEL; const out = {shots: []};
  window.__play = (lure, take, frames) => {
    let S = R.S; S.lure = lure; S.stT = 1; R.tapAction();
    const log = [];
    for (let n = 0; n < frames; n++) {
      S = R.S;
      if (S.state === 'down' || S.state === 'rise') {
        const m = S.hy / 6, want = m > take || S.state === 'rise'; let danger = [], lx = null;
        for (const [, f] of R.visible()) { if (f.fl) continue; const r = R.fishRect(f);
          if (S.state === 'rise' ? (S.hy + 6 > f.y - r[3] / 2 && f.y + r[3] / 2 > S.hy - 50) : (S.hy - 6 < f.y + r[3] / 2 && f.y - r[3] / 2 < S.hy + 50)) { const good = f.id !== 'jelly' && want; if (good && lx === null) lx = r[0] + r[2] / 2; if (!good) danger.push([r[0] - 8 + Math.min(0, f.v * .25), r[0] + r[2] + 8 + Math.max(0, f.v * .25)]); } }
        let bx = S.hx, best = -1;
        if (lx !== null) bx = lx; else { for (let x = 6; x < R.width - 5; x += 3) { if (danger.some(d => d[0] <= x && x <= d[1])) continue; const sc = 200 - Math.abs(x - S.hx); if (sc > best) { best = sc; bx = x; } } if (best < 0 && S.pulses > 0) R.pulse(); }
        S.hx += Math.max(-1.9, Math.min(1.9, bx - S.hx));
      } else if (S.state === 'fight') { const fg = S.fight; if (S.stT > .4 && Math.abs(fg.pos - fg.win[0]) < fg.win[1] * .7) R.tapAction(); }
      else if (S.state === 'haul') { if (S.haul.shown >= S.haul.n && S.stT > S.haul.end + .7) { log.push('haul'); return {total: S.haul.total, catch: S.catch, extra: S.haul.extra.map(e => e[0]), reached: Math.round(S.reached), bottom: S.bottom, n}; } }
      const key = S.state + (S.state === 'down' ? Math.floor(S.hy / 6 / 100) : '');
      if (window.__want && window.__want(S)) return {pause: key, n};
      R.step(1 / 60);
    }
    return {timeout: true, state: R.S.state};
  };
})()
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": int(os.environ.get("VW", 390)), "height": int(os.environ.get("VH", 700))}, device_scale_factor=float(os.environ.get("DSF", 2)))
        page = await ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        posted = []
        db = {"daily": {"a": {"n": "JEN", "s": 212}, "b": {"n": "TOM", "s": 96}, "c": {"n": "JEN", "s": 40}}, "best": {"JEN": {"s": 431}, "TOM": {"s": 300}}}
        db["all"] = {"q": {"n": "JEN", "s": 431, "h": "tuna:14,tuna:12,sword:66:T|1.5|0", "ti": "KELP KEEPER"}, "r": {"n": "TOM", "s": 300}}
        async def handle(route):
            req = route.request; u = req.url.split("?")[0]; key = "all" if u.endswith("/all.json") else "daily"
            if req.method == "POST":
                body = json.loads(req.post_data); posted.append((key, body)); db[key]["x%d" % len(posted)] = body
                await route.fulfill(json={"name": "x"})
            else: await route.fulfill(json=db[key])
        await page.route("https://lb.example.com/**", handle)
        await page.add_init_script("Object.defineProperty(window, 'LEADERBOARD_URL_TEST', {value: 'https://lb.example.com'});")
        await page.route("**/config.js", lambda r: r.fulfill(body="const LEADERBOARD_URL = 'https://lb.example.com/';", content_type="text/javascript"))
        await page.goto("file:///home/claude/reel-deep-web/index.html")
        await page.wait_for_function("window.REEL && window.REEL.S")
        print("first-run overlay:", await page.evaluate("REEL.S.overlay"))
        await page.evaluate("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; })()")
        await page.evaluate(BOT)
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/title.png")
        res = []
        for i, (lure, take) in enumerate(((0, 30), (3, 9999), (2, 200), (1, 400), (3, 9999), (0, 9999), (3, 500), (3, 9999))):
            r = await page.evaluate("window.__play(%d, %d, 30000)" % (lure, take)); res.append(r)
            await page.wait_for_timeout(120)
            await page.screenshot(path=OUT + "/haul%d.png" % i)
            if i == 0:
                await page.evaluate("REEL.tapAction()"); await page.wait_for_timeout(200)
                await page.screenshot(path=OUT + "/name.png")
                await page.fill("#nameInput", "kdb"); await page.click("#nameOk"); await page.wait_for_timeout(300)
            else:
                await page.evaluate("REEL.tapAction()"); await page.wait_for_timeout(150)
            print(i, r, flush=True)
        # mid-dive pictures
        for name, cond in (("caves", "S => S.state === 'down' && S.hy / 6 > 640"), ("vents", "S => S.state === 'down' && S.hy / 6 > 770"), ("bones", "S => S.state === 'down' && S.hy / 6 > 900"), ("trench", "S => S.state === 'down' && S.hy / 6 > 1040"), ("floor", "S => S.state === 'turn' && S.bottom"), ("rise", "S => S.state === 'rise' && S.stT > 1.5"), ("fight", "S => S.state === 'fight' && S.stT > .6")):
            for attempt in range(6):
                await page.evaluate("(() => { window.__want = %s; })()" % cond)
                r = await page.evaluate("window.__play(3, 9999, 30000)")
                if "pause" in r: break
                await page.evaluate("(() => { window.__want = null; REEL.tapAction(); })()")
            await page.evaluate("(() => { window.__want = null; })()")
            await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/%s.png" % name)
            await page.evaluate("(() => { const S = REEL.S; S.hy = 1; })()")
            r = await page.evaluate("window.__play(3, 9999, 30000)"); await page.evaluate("if (REEL.S.state === 'haul') REEL.tapAction()")
        box = await page.locator("#game").bounding_box()
        W_ = await page.evaluate('REEL.width'); OX_ = (W_ - 120) // 2
        async def tap(lx, ly): await page.mouse.click(box["x"] + (lx + OX_) / W_ * box["width"], box["y"] + ly / 200 * box["height"])
        await page.wait_for_timeout(400)
        st = await page.evaluate("REEL.S.state"); print("state before menus:", st)
        await tap(20, 158); await page.wait_for_timeout(500); await page.screenshot(path=OUT + "/scores_today.png")
        await tap(90, 25); await page.wait_for_timeout(200); await tap(60, 42); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/scores_all.png")
        await tap(60, 194); await tap(60, 158); await page.wait_for_timeout(200); await tap(108, 8); await tap(108, 8); await tap(108, 8); await tap(108, 8); await tap(108, 8); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/log.png")
        await tap(60, 194); await page.evaluate("(() => { REEL.store.coins += 900; })()")
        await tap(100, 158); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shop_char.png")
        await tap(46, 38); await tap(46, 38); await tap(108, 8); await tap(74, 38); await tap(74, 38); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shop_hat.png")
        for cat, x in ((2, 46), (3, 74), (4, 102), (5, 102), (6, 46)):
            await tap(108, 8); await tap(x, 38); await tap(x, 38)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shop_flair.png")
        await tap(108, 8); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shop_title.png")
        await tap(60, 194); await tap(20, 174); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/tasks.png")
        await tap(60, 194); await tap(60, 174); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/help.png")
        await tap(60, 100); await tap(60, 100); await tap(60, 100); await tap(60, 100); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/help5.png"); await tap(60, 100)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/title2.png")
        print("equipped:", await page.evaluate("JSON.stringify([REEL.store.eq, REEL.store.own, REEL.store.coins])"))
        print("posted:", len(posted), posted[-1]); print("coins/titles:", await page.evaluate("JSON.stringify([REEL.store.coins, REEL.store.titles, REEL.store.tasks.d.map(t => [t.k, t.p, t.n, t.done])])")); print("store:", await page.evaluate("JSON.stringify({best: REEL.store.best, name: REEL.store.name, n: Object.keys(REEL.store.log).length})"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
