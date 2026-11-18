# FIN PRIX gym: robot players run each training drill at levels 0/3/6/9 and print pass rates (good / casual).
# Nov 18, 2026: drills are easy early and hard late (casual fails dodge/swim around lv6-9, sprint lv9). Port 8000.
import asyncio
from playwright.async_api import async_playwright
JS = r"""([kind, lv, skill, n]) => {
  const f = REEL.store.tav.fish; let pass = 0, scores = [];
  for (let i = 0; i < n; i++) {
    f.lv = [lv, lv, lv]; FPX.startGym(kind); const K = FPX.KART;
    if (kind === 'speed') { const hz = skill === 'good' ? 0.55 : 0.35, every = skill === 'good' ? 0.05 : 0.2; K.bot = k => {   // dodge: pick the safest spot nearby
      k.botT = (k.botT || 0) - 1 / 60; if (k.botT <= 0) { k.botT = every; let best = k.x, bc = 1e9;
        for (let x = -0.95; x <= 0.95; x += 0.05) { let c = Math.abs(x - k.x) * 0.3; for (const r of k.rocks) if (r.y < 0.9 && r.y > 0.82 - hz) { const d = Math.abs(x - r.x), need = r.r + 0.1; if (d < need) c += 10 * (1 + (r.y - (0.82 - hz))); const lo = Math.min(x, k.x), hi = Math.max(x, k.x); if (r.y > 0.6 && r.x > lo - need && r.x < hi + need) c += 3; } if (c < bc) { bc = c; best = x; } }
        k.botX = best; }
      return Math.abs(k.botX - k.x) < 0.03 ? 0 : Math.sign(k.botX - k.x); }; }
    if (kind === 'stamina') { const p = skill === 'good' ? 0.165 : 0.23; K.bot = (k, dt) => { k.botT = (k.botT || 0) + dt; if (k.botT >= p * (0.9 + Math.random() * 0.2)) { k.botT = 0; FPX.gymStroke(k.last === 1 ? -1 : 1); } }; }
    if (kind === 'burst') { const rt0 = skill === 'good' ? 0.24 : 0.33; K.bot = (k, dt) => { if (k.state === 'go') { if (!k.botAt) k.botAt = k.goT + rt0 + (Math.random() - 0.5) * 0.08; if (k.t >= k.botAt) { k.botAt = 0; FPX.gymGo(); } } }; }
    let m = 0; while (K.phase !== 'done' && m < 60 * 120) { FPX.kartUpdate(1 / 60); m++; }
    if (K.pass) pass++; scores.push(+K.score.toFixed(2));
  }
  f.lv = [8, 8, 8]; return [pass / n, scores]; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await (await b.new_context(viewport={"width": 1440, "height": 810})).new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.route("**/*firebase*/**", lambda r: r.abort())
        await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.FPX && window.REEL && REEL.S")
        await page.evaluate("REEL.store.tav.fish = { name: 'SPEEDY', id: 'koi', lv: [0, 0, 0], races: 0, wins: 0 }")
        for kind in (__import__("sys").argv[1].split(",") if len(__import__("sys").argv) > 1 else ("speed", "stamina", "burst")):
            for lv in (0, 3, 6, 9):
                for sk in ("good", "casual"):
                    r = await page.evaluate(JS, [kind, lv, sk, 6])
                    print(f"{kind:8s} lv{lv} {sk:6s} pass {r[0]:.0%}  {r[1]}", flush=True)
        print("errors", errs[:3]); await b.close()
asyncio.run(main())
