"""Dive bets revamp (Nov 20, 2026): fish families, 22 new bets, WANTED, parlays and the explained bet screen.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_bets2.py   (live database blocked)
Screenshots go to tools/tests/bets2/."""
import asyncio, os
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":300,"seenHelp":true,"name":"KAD","tav":{"chips":2000},"sec":{"sleeper":true}}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bets2"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)


async def click(page, x, y):
    r = await page.evaluate("(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left, c.top, c.width, c.height, LW, LH]; })()")
    await page.mouse.click(r[0] + x * r[2] / r[4], r[1] + y * r[3] / r[5])


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, tag in [(1440, 810, "pc"), (390, 700, "ph")]:
            page = await b.new_page(viewport={"width": w, "height": h})
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.route("**firebaseio**", lambda r: r.abort())
            await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r})")
            await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(300)
            ev = page.evaluate
            if tag == "pc":
                # data checks (once)
                r = await ev("""(() => { const bad = [];
                  BETS.forEach(b => { if (b[1].replace(/\\{.*?\\}/, '999').length > 13 || b[2].replace(/\\{.*?\\}/, '999').length > 19) bad.push('len ' + b[0]); if (!BET_HELP[b[0]]) bad.push('help ' + b[0]); });
                  if (new Set(BETS.map(b => b[0])).size !== BETS.length) bad.push('dup ids');
                  if (BETS.length > MASK_CH.length || MASK_CH.includes('|') || new Set(MASK_CH).size !== MASK_CH.length) bad.push('mask');
                  if (MASK_CH.slice(0, 64) !== '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_') bad.push('old mask chars moved');
                  Object.entries(FAMS).forEach(([f, ids]) => ids.forEach(id => { if (!SPEC[id] || !DATA.atlas[id]) bad.push('fam ' + f + ' ' + id); }));
                  Object.values(BET_HELP).forEach(h => { if (/[^A-Z0-9 .,:'!?\\-+\\/{}()X#%&=<>@^_~$*]/.test(h[0].replace(/\\{[A-Z0-9.]+\\}/g, ''))) bad.push('glyph ' + h[0].slice(0, 20)); });
                  Object.keys(WANTED_P).forEach(id => { if (!SPEC[id] || SPEC[id][7] || SPEC[id][6] !== null) bad.push('wanted ' + id); });
                  return bad; })()""")
                check("every bet has short labels, help text, a mask character; families and WANTED fish exist", r == [], r)
                check("70+ bets in the pool", await ev("BETS.length") >= 71)
                r = await ev("""(() => { let seen = new Set(), wanted = 0, n = 0; for (let d = 0; d < 400; d++) { REEL.store.dives = d; const o = betOdds(); n++;
                    o.forEach(x => seen.add(x[0])); if (o.some(x => x[0] === 'wanted')) wanted++; if (o.length !== 5) return 'size ' + o.length; }
                  return [seen.has('newsp') || seen.has('newtr'), wanted / n, seen.size]; })()""")
                check("NEW SPECIES / NEW+TROPHY never dealt; WANTED on every board; many bets rotate", r[0] is False and r[1] == 1 and r[2] >= 45, r)
                r = await ev("""(() => { const o = []; for (const d of [0, 1, 2, 3, 77]) { REEL.store.dives = d; o.push(wantedFish()); } return o; })()""")
                check("the WANTED fish changes with the dive", len(set(r)) >= 3, r)
                # pricing: parlays
                r = await ev("""(() => { const I = BET_I; return [parlayDead([I.stairs, I.downhill]), parlayDead([I.d600, I.d900]), parlayPays(parlayChance([I.d600, I.d900])), parlayPays(0.0001)]; })()""")
                check("STAIRCASE + DOWNHILL can't be parlayed; 600 M + 900 M priced together, not multiplied; past x100 can't be placed", r[0] and not r[1] and r[2] < 5 and r[3] == 0, r)
            await ev("(() => { REEL.store.dives = 300; REEL.store.tav.chips = 2000; REEL.store.tav.bet = null; openBet(); })()")
            await page.wait_for_timeout(150)
            for i in range(5):
                await ev(f"TAV.bet.sel = {i}; TAV.bet.card = false"); await page.wait_for_timeout(60)
                await page.screenshot(path=os.path.join(OUT, f"{tag}_row{i}.png"))
            # every bet's explanation fits: draw each one selected
            r = await ev("""(() => { const bad = []; const o0 = TAV.bet.opts;
              BETS.forEach((bt, i) => { TAV.bet.opts = [[bt[0], bt[0] === 'wanted' ? SPEC[TAV.bet.w][1] : betText(bt[1], betLine()), 3, '', i, 'MEDIUM']].concat(o0.slice(1)); TAV.bet.sel = 0;
                const n = wideMenus() ? 27 : 19, lines = wrap(betText((BET_HELP[bt[0]] || [''])[0], betLine(), TAV.bet.w), n).length;
                if (lines > (wideMenus() ? 7 : 11)) bad.push(bt[0] + ' ' + lines); });
              TAV.bet.opts = o0; return bad; })()""")
            check(f"{tag}: every explanation fits its panel", r == [], r)
            for k in ["fshark", "surfturf", "under", "wanted"]:
                await ev(f"""(() => {{ const i = BET_I['{k}'], o = TAV.bet.opts; o[1] = ['{k}', '{k}' === 'wanted' ? SPEC[TAV.bet.w][1] : betText(BETS[i][1], betLine()), betPays(betChance(i, TAV.bet.w)), '', i, betTier(i, betChance(i, TAV.bet.w))]; TAV.bet.sel = 1; TAV.bet.card = {'true' if tag == 'ph' else 'false'}; }})()""")
                await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_help_{k}.png"))
            await ev("(() => { REEL.store.tav.bet = null; openBet(); })()")
            # ticking two boxes makes a parlay
            if tag == "pc":
                hits = await ev("betWideHits()")
                t = [x for x in hits if x[0] == "tick"]
                await click(page, t[0][1] + 6, t[0][2] + 10); await click(page, t[2][1] + 6, t[2][2] + 10)
            else:
                await click(page, (await ev("OX")) + 10, 29 + 7); await click(page, (await ev("OX")) + 10, 29 + 34 + 7)
            await page.wait_for_timeout(100)
            s = await ev("betSlip()")
            check(f"{tag}: two ticks = a 2-bet parlay", s["parlay"] and len(s["legs"]) == 2, s)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_parlay.png"))
            if tag == "ph":
                await ev("TAV.bet.sel = 2"); await click(page, (await ev("OX")) + 60, 29 + 34 + 7); await page.wait_for_timeout(80)
                check("ph: tapping the selected bet opens its card", await ev("TAV.bet.card"))
                await page.screenshot(path=os.path.join(OUT, "ph_card.png"))
                await click(page, (await ev("OX")) + 60, 165); await page.wait_for_timeout(80)
                check("ph: BACK TO BETS closes the card", not await ev("TAV.bet.card"))
            pays = s["pays"]
            await ev("TAV.bet.stake = 20; placeBet()")
            bet = await ev("REEL.store.tav.bet")
            check(f"{tag}: parlay placed with its legs", bet and bet["k"] == "parlay" and len(bet["legs"]) == 2 and bet["pays"] == pays, bet)
            # settle: a fake dive that wins every leg, one that loses one, one that voids
            r = await ev("""(() => { const q = REEL.store.tav, b = q.bet, out = [];
              const fake = won => { const d = { total: 300, mult: 1, base: 300, catch: [], reached: 1158, bottom: true, sets: [], bounty: 'x', newN: 0, recN: 0, stung: false, bitten: 0, pulsed: false, riseN: 0, last: 1, lastLow: false, best: 1e9, board: null };
                return d; };
              const save = BETS.map(x => x[4]);
              b.legs.forEach(k => { BETS[BET_I[k]][4] = () => true; }); q.bet = Object.assign({}, b); let c0 = q.chips; out.push(settleBet(fake())[0], q.chips - c0);
              BETS[BET_I[b.legs[1]]][4] = () => false; q.bet = Object.assign({}, b); c0 = q.chips; out.push(settleBet(fake())[0], q.chips - c0);
              BETS[BET_I[b.legs[1]]][4] = () => null; q.bet = Object.assign({}, b); c0 = q.chips; out.push(settleBet(fake())[0], q.chips - c0);
              save.forEach((f, i) => { BETS[i][4] = f; }); return out; })()""")
            check(f"{tag}: parlay wins pays stake x pays, a lost leg loses, a void leg refunds", r[0].startswith("PARLAY WON") and r[1] == round(20 * pays) and r[2].startswith("PARLAY LOST") and r[3] == 0 and r[4].startswith("PARLAY VOID") and r[5] == 20, r)
            r = await ev("Object.keys(REEL.store.tav.btake).length")
            check(f"{tag}: settled legs go on your taken record", r >= 2, r)
            check(f"{tag}: no page errors", not errs, errs[:3])
            await page.close()
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
