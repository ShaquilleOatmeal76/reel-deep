"""Junk-dive voids (Nov 19, 2026): a dive hauling under a quarter of the line voids only bets a thrown dive could win.
Deep / trophy / zone bets you actually hit on a dive cut short (jellyfish, shark) now pay.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_junkvoid.py   (live database blocked)"""
import asyncio, sys
from playwright.async_api import async_playwright
fails = []
def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)
# dive: 950 m, one 12 lb trophy from the Abyss, total 20 (line 400 -> junk under 100)
DIVE = """([k, extra]) => { const q = REEL.store.tav; q.chips = 1000; q.bet = { k, stake: 10, pays: 3, line: 400, cast: true };
  const abyss = REEL.SPECIES.find(s => s[2] === 4 && !s[7])[0], shallow = REEL.SPECIES.find(s => s[2] === 0 && !s[7])[0];
  const d = Object.assign({ total: 20, mult: 1, base: 20, catch: [[abyss, 12, true, 480]], reached: 950, bottom: false, sets: [], bounty: 'x',
    newN: 0, recN: 0, stung: true, pulsed: true, riseN: 0, last: 100, lastLow: false, best: 9999, board: null }, extra || {});
  if (d.shallow3) d.catch = [[shallow, 3, false, 20], [shallow, 3, false, 25], [shallow, 3, false, 30]];
  const r = settleBet(d); return [r && r[0], q.chips]; }"""
CASES = [  # bet, extra, expected message start, chips after
  ["d900", None, "BET WON", 1030], ["d600", None, "BET WON", 1030], ["trophy", None, "BET WON", 1030], ["z4", None, "BET WON", 1030],
  ["d900", {"reached": 500}, "BET LOST", 1000], ["over", None, "BET LOST", 1000],
  ["odd", {"total": 21}, "BET VOID", 1010], ["clean", {"shallow3": 1, "stung": False}, "BET VOID", 1010], ["pair", {"shallow3": 1}, "BET VOID", 1010],
  ["pair", {"shallow3": 1, "total": 150}, "BET WON", 1030],      # not junk: counts as before
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**firebaseio**", lambda r: r.abort())
        await pg.goto("http://127.0.0.1:8765/index.html"); await pg.wait_for_function("window.REEL && window.REEL.S")
        await pg.evaluate("(() => { if (!REEL.SPECIES) REEL.SPECIES = SPECIES; })()")
        for k, extra, msg, chips in CASES:
            r = await pg.evaluate(DIVE, [k, extra])
            check(f"{k} {extra or ''} -> {msg}", r[0].startswith(msg) and r[1] == chips, r)
        r = await pg.evaluate("(() => { const n = betLife().map(e => e ? e[0] : 0).reduce((a, x) => a + x, 0); betRecord([10, 0, 0, 0, '|', 1]); return n === betLife().map(e => e ? e[0] : 0).reduce((a, x) => a + x, 0); })()")
        check("a junk dive still doesn't count toward any bet's price", r)
        check("no errors", not errs, errs); await b.close()
    print("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
