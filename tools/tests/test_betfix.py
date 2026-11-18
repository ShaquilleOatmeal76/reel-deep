"""Dive bets can't be gamed by throwing dives (Nov 18, 2026).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_betfix.py
Writes to the live database are blocked."""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


# Builds history rows the way beginHaul does. honest(i) -> a row from a normal dive; junk() -> a thrown dive.
HELPERS = """
window.T_rows = {
  honest(rng) {          // a normal dive: every bet won at its starting odds, total around 220
    let won = "";
    REEL.BETS.forEach((b, i) => { if (rng() < b[3]) won += MASK[i]; });
    return [Math.round(150 + rng() * 140), 0, 0, 0, won + "|", 0];
  },
  junk() { return [6, 0, 0, 0, "|", 1]; },
};
window.MASK = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
window.T_rng = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(42);
"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; })()")
        await ev(HELPERS)

        check("dive-bet cap is x25", await ev("REEL.betPays(0.001)") == 25 and await ev("REEL.BET_CAP") == 25)

        # 1. a new player who throws 20 dives straight away: nothing is priced better than its starting odds
        r = await ev("""(() => { const q = REEL.tav(); q.hist = []; q.bhw = { d: "", line: 0 }; q.blife = [];
          for (let k = 0; k < 20; k++) { q.hist.push(T_rows.junk()); REEL.betRecord(q.hist[q.hist.length - 1]); }
          return REEL.BETS.map((b, i) => [b[0], REEL.betChance(i) >= 0.9 * b[3] - 1e-9, REEL.betPays(REEL.betChance(i)) <= Math.min(25, Math.max(1.1, 0.95 / (0.9 * b[3]))) + 1e-9]); })()""")
        bad = [x[0] for x in r if not (x[1] and x[2])]
        check("tanking from scratch: nothing priced past 90% of its starting odds", not bad, bad)
        check("line after 20 thrown dives isn't dragged below the default", await ev("REEL.betLine()") >= 120, await ev("REEL.betLine()"))

        # 2. an honest player, then 20 thrown dives: prices and the line stay where honest play put them
        r = await ev("""(() => { const q = REEL.tav(); q.hist = []; q.bhw = { d: "", line: 0 }; q.blife = [];
          for (let k = 0; k < 40; k++) { q.hist.push(T_rows.honest(T_rng)); if (q.hist.length > 20) q.hist.shift(); REEL.betRecord(q.hist[q.hist.length - 1]); }
          const before = REEL.BETS.map((b, i) => REEL.betChance(i)), lineB = REEL.betLine();
          for (let k = 0; k < 20; k++) { q.hist.push(T_rows.junk()); if (q.hist.length > 20) q.hist.shift(); REEL.betRecord(q.hist[q.hist.length - 1]); }
          const after = REEL.BETS.map((b, i) => REEL.betChance(i)), lineA = REEL.betLine();
          return { worse: REEL.BETS.filter((b, i) => after[i] < before[i] - 1e-9).map(b => b[0]), lineB, lineA }; })()""")
        check("honest then tanked: no bet pays more afterwards", not r["worse"], r["worse"])
        check("honest then tanked: line holds at 80%+ of before", r["lineA"] >= 0.8 * r["lineB"] - 10, r)

        # 3. a tanker bot vs an honest bot over many cycles: what each gets back per chip staked on the best-looking bet.
        # True chance of every bet = its starting odds. The tanker throws 19 dives, then bets the bet with the highest
        # pays x true chance; the honest bot bets the safest bet every dive.
        r = await ev("""(() => { const q = REEL.tav(), R = REEL, rng = T_rng;
          function run(tank, cycles) {
            q.hist = []; q.bhw = { d: "", line: 0 }; q.blife = []; let staked = 0, back = 0;
            for (let k = 0; k < 20; k++) { q.hist.push(T_rows.honest(rng)); if (q.hist.length > 20) q.hist.shift(); R.betRecord(q.hist[q.hist.length - 1]); }
            for (let c = 0; c < cycles; c++) {
              if (tank) for (let k = 0; k < 19; k++) { q.hist.push(T_rows.junk()); if (q.hist.length > 20) q.hist.shift(); R.betRecord(q.hist[q.hist.length - 1]); }
              let best = 0, bi = 0;
              if (tank) R.BETS.forEach((b, i) => { if (b[0] === "beatlast" || b[0] === "top10" || b[0] === "beat1") return; const v = b[3] * R.betPays(R.betChance(i)); if (v > best) { best = v; bi = i; } });
              else { const bd = R.betBoard().filter(i => !["beatlast", "top10", "beat1"].includes(R.BETS[i][0])); bi = bd[Math.floor(rng() * bd.length)]; }
              const pays = R.betPays(R.betChance(bi)), row = T_rows.honest(rng), won = row[4].split("|")[0].includes(MASK[bi]);
              staked += 75; if (won) back += Math.floor(75 * pays);
              q.hist.push(row); if (q.hist.length > 20) q.hist.shift(); R.betRecord(row);
            }
            return back / staked;
          }
          return { tanker: run(true, 400), honest: run(false, 2000) }; })()""")
        # Even a player who knew every bet's true odds and only ever took the most underpriced one is held to 0.95 / 0.9
        # = 1.055 by the floor. Throwing dives adds nothing on top (junk dives are ignored).
        check("tanker that also knows the true odds is held near break-even", r["tanker"] <= 1.06, r)
        check("honest player betting off the board gets back 85-97%", 0.85 <= r["honest"] <= 0.97, r)
        print("  payback per chip: tanker %.3f, honest %.3f" % (r["tanker"], r["honest"]))

        # 4. the line's high-water mark fades by real days, not by dives
        r = await ev("""(() => { const q = REEL.tav(), h = REEL.betHW(); h.line = 400;
          const d = new Date(); d.setDate(d.getDate() - 10); h.d = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          q.hist = []; for (let k = 0; k < 20; k++) q.hist.push(T_rows.junk());
          return { line: REEL.betLine() }; })()""")
        check("line after 10 days: 80% of a faded 400", abs(r["line"] - round(0.8 * 400 * 0.98 ** 10 / 10) * 10) <= 10, r)

        # 4b. a lifetime record of 200 honest dives isn't undone by 20 thrown ones
        r = await ev("""(() => { const q = REEL.tav(), R = REEL; q.hist = []; q.bhw = { d: "", line: 0 }; q.blife = []; const i = R.BETS.findIndex(b => b[0] === "legend");
          for (let k = 0; k < 200; k++) { const row = [200, 0, 0, 0, (k % 3 === 0 ? MASK[i] : "") + "|", 0]; q.hist.push(row); if (q.hist.length > 20) q.hist.shift(); R.betRecord(row); }
          const before = R.betChance(i);
          for (let k = 0; k < 20; k++) { const row = [150, 0, 0, 0, "|", 0]; q.hist.push(row); if (q.hist.length > 20) q.hist.shift(); R.betRecord(row); }   // 20 real dives that dodge it
          return [before, R.betChance(i)]; })()""")
        check("lifetime record holds after 20 dodged dives", r[1] >= 0.9 * r[0], r)

        # 4c. a bet riding on a thrown dive is void
        r = await ev("""(() => { const q = REEL.tav(), R = REEL; q.bet = { k: "onezone", stake: 50, pays: 7, line: 200, cast: true }; const c0 = q.chips;
          const msg = R.settleBet({ total: 12, catch: [['tuna', 4, false, 10], ['tuna', 4, false, 11], ['tuna', 4, false, 12]], sets: [], reached: 12 });
          return [msg[0], q.chips - c0]; })()""")
        check("a thrown dive voids the bet", r[0].startswith("BET VOID") and r[1] == 50, r)

        # 5. BEAT LAST is void after a thrown dive
        r = await ev("""(() => { const R = REEL, i = R.BETS.findIndex(b => b[0] === "beatlast");
          return [R.BETS[i][4]({ last: 5, lastLow: true, total: 300 }), R.BETS[i][4]({ last: 200, lastLow: false, total: 300 })]; })()""")
        check("BEAT LAST void after a thrown dive, normal otherwise", r == [None, True], r)

        # 6. old saves: rows with 5 fields and no bhw still work
        r = await ev("""(() => { const q = REEL.tav(); delete q.bhw; q.hist = [[200, 1, 0, 0, "0|"], [180, 0, 1, 0], [220, 0, 0, 0, "|"], [190, 0, 0, 0, "|"], [210, 0, 0, 0, "|"]];
          return [REEL.betLine(), REEL.betOdds().length]; })()""")
        check("old history rows and a save without bhw still price", r[0] == 200 and r[1] == 5, r)

        # 7. a real dive through the haul records the junk flag and raises the marks
        await ev("""(() => { const R = REEL; R.tav().hist = []; R.tav().bhw = { d: "", line: 0 }; R.tav().blife = [];
          R.newDive(); R.cast(); R.S.overlay = null; R.S.catch = [['tuna', 3, false, 20]]; R.beginHaul(); })()""")
        r = await ev("(() => { const q = REEL.tav(); return [q.hist.length, q.hist[0].length, q.hist[0][5], REEL.betHW().d.length]; })()")
        check("a real haul writes a 6-field row and updates the marks", r[0] == 1 and r[1] == 6 and r[3] == 10, r)
        check("no page errors", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
