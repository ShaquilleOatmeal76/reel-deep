"""The Reel Deal pay-line fix (Nov 19, 2026): the payout must read the row under the red pay line (the middle row).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_reelfix.py
Writes to the live database are blocked. Screenshots go to tools/tests/reelfix/."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "reelfix"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


# Find reel stops whose middle row matches `want` (a function of the 3 symbols), force the spin onto them, return
# [middle-row symbols, top-row symbols, chips won, stake, message]. Math.random after the stops returns 0.99 (no jackpot).
SPIN = """(want) => { const S = CASINO.RD_STRIPS, f = new Function('t', 'return ' + want); let st = null;
  for (let a = 0; a < 24 && !st; a++) for (let b = 0; b < 24 && !st; b++) for (let c = 0; c < 24 && !st; c++) {
    const t = [S[0][(a + 1) % 24], S[1][(b + 1) % 24], S[2][(c + 1) % 24]]; if (f(t)) st = [a, b, c]; }
  const q = REEL.tav(); q.chips = 1000; const c = CASINO.rd; c.bet = 10; c.phase = 'idle';
  const keep = Math.random, seq = st.map(s => (s + 0.5) / 24); Math.random = () => seq.length ? seq.shift() : 0.99;
  CASINO.rdSpin(); for (let k = 0; k < 60 && c.phase === 'spin'; k++) CASINO.rdTick(0.05); Math.random = keep;
  return [CASINO.rdLine(st).join(''), st.map((s, k) => S[k][s]).join(''), q.chips - 990, c.staked, c.msg]; }"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.store.name = 'KDB'; CASINO.GAME_OPEN.reel(); })()")

        r = await ev("""(() => { let e = 0; for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) for (let c = 0; c < 24; c++) e += CASINO.rdPays(CASINO.rdLine([a, b, c])); return e / 13824; })()""")
        check("payback over every pay-line result is still 93.97%", abs(r - 0.9397) < 0.0005, r)

        cases = [
            ("tuna pair pays x3", "t.filter(x => x === 'T').length === 2 && !t.includes('C')", 30),
            ("minnow pair pays x2", "t.filter(x => x === 'M').length === 2 && !t.includes('C')", 20),
            ("shark pair pays x4", "t.filter(x => x === 'S').length === 2 && !t.includes('C')", 40),
            ("three minnows pay x8", "t.every(x => x === 'M')", 80),
            ("three clowns pay x12", "t.every(x => x === 'K')", 120),
            ("three boots pay x3", "t.every(x => x === 'B')", 30),
            ("one bait gives the stake back", "t.filter(x => x === 'C').length === 1 && !(t[0] === t[1] && t[1] === t[2])", 10),
            ("three different, no bait, pays nothing", "t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2] && !t.includes('C')", 0),
        ]
        for name, want, pay in cases:
            r = await ev(SPIN, want)
            check(f"{name} (line {r[0]}, top row {r[1]})", r[2] == pay, r)

        # The bug case: a pair sitting on the line while the top row is junk must still pay.
        r = await ev(SPIN, "t.filter(x => x === 'T').length === 2 && !t.includes('C')")
        await ev("(() => { REEL.S.overlay = 'reel'; })()")
        await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, "pair_on_line_wide.png"))
        await page.set_viewport_size({"width": 390, "height": 700}); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, "pair_on_line_phone.png"))
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
    sys.exit(1 if fails else 0)

asyncio.run(main())
