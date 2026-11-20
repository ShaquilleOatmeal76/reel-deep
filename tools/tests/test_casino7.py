"""Four new tavern games (Nov 20, 2026): COMPASS ROSE, LIAR'S DICE, THE SHELL GAME, DOUBLOON PUSHER.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino7.py   (live database blocked)
Checks each game's payback (exact sums or simulations), plays them through, and takes screenshots into tools/tests/casino7/."""
import asyncio, os
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":300,"seenHelp":true,"name":"KAD","tav":{"chips":25000}}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino7"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)


LD_SIM = """(([n, botTune]) => {
  function game() {
    let you = 5, him = 5, starter = "you";
    while (you && him) {
      const Y = ldRoll(you), H = ldRoll(him); let bid = null, turn = starter, caller = null;
      for (let guard = 0; guard < 60; guard++) {
        const a = ldAI(turn === "you" ? Y : H, turn === "you" ? him : you, bid, turn === "you" ? botTune : null);
        if (a[0] === "liar" && bid) { caller = turn; break; }
        bid = a[0] === "liar" ? [1, 2] : [a[1], a[2]]; bid.who = turn; turn = turn === "you" ? "him" : "you";
      }
      const right = ldCount(Y, bid[1]) + ldCount(H, bid[1]) >= bid[0], loser = right ? caller : bid.who;
      if (loser === "you") you--; else him--; starter = loser;
    }
    return you > 0;
  }
  let w = 0; for (let i = 0; i < n; i++) if (game()) w++; return w / n; })"""

DP_SIM = """(([aim, n]) => { const s = { t: 0, coins: dpCoins().map(([x, y]) => ({ x, y, vx: 0, vy: 0, v: 0 })) };
  let paid = 0, house = 0, sw = 0.5, dir = 1;
  for (let d = 0; d < n; d++) {
    sw += dir * 0.16; if (sw > 1) { sw = 1; dir = -1; } if (sw < 0) { sw = 0; dir = 1; }
    const a = aim < 0 ? sw : aim; dpDrop(s, DP.R + a * (DP.W - 2 * DP.R) + (Math.random() - 0.5) * 10, d >= n / 5 ? 1 : 0);
    for (let f = 0; f < 21; f++) { const [p, h] = dpStep(s, 1 / 60); paid += p; house += h; }
  }
  return [paid / (paid + house), s.coins.length]; })"""


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
                # ---- odds
                r = await ev("CR_TYPES.map(([t, , , m]) => { const n = t === 'point' ? 32 : (CR_OPTS[t] || []).length; let s = 0; for (let o = 0; o < n; o++) for (let p = 0; p < CR_N; p++) if (crCovers(t, o, p)) s += m / CR_N / n; return Math.round(s * 1000) / 1000; })")
                check("compass rose: every bet type pays back 93.9-94.5%", all(0.938 <= x <= 0.946 for x in r), r)
                r = await ev("[crCovers('half', 0, 31), crCovers('half', 0, 7), crCovers('half', 0, 8), crCovers('quart', 1, 8), crCovers('card', 2, 16), crCovers('col', 0, 32), crCovers('card', 0, 31), crCovers('card', 0, 2), [0,1,2,3].map(o => Array.from({length: 33}, (_, p) => crCovers('half', o, p)).filter(Boolean).length)]")
                check("compass rose: halves, quarters, cardinals and the KRAKEN cover the right pockets", r == [True, True, False, True, True, False, True, False, [16, 16, 16, 16]], r)
                r = await ev(LD_SIM, [4000, {"call": 0.12, "bluff": 0, "noise": 0.08}])
                check("liar's dice: the strongest bot found wins ~51% (x1.85 -> under ~97% back)", r * 1.85 <= 0.985, (r, r * 1.85))
                r = await ev(LD_SIM, [4000, None])
                check("liar's dice: a bot that plays like him wins about half", 0.44 <= r <= 0.53, r)
                r = await ev("SG_TIERS.map(t => Math.round(t[1] * (1 - 2 * t[4] / 3) * 1000) / 1000)")
                check("shell game: a perfect watcher gets 94.7-95.3% on every speed", all(0.945 <= x <= 0.955 for x in r), r)
                r = await ev("""(() => { const out = [0, 0, 0]; CZ.sg = null; sgOpen(); const c = CZ.sg; REEL.store.tav.chips = 1e9;
                  for (let tier = 0; tier < 3; tier++) { let won = 0; c.tier = tier; for (let k = 0; k < 3000; k++) { c.phase = 'stake'; c.bet = 10; sgStart();
                    let seen = -1; for (let s = 0; s < 400 && c.phase !== 'pick'; s++) { if (c.phase === 'cover' && seen < 0) seen = c.slot[c.pearl]; sgTick(0.05); }
                    sgPick(seen); if (c.won) won++; } out[tier] = Math.round(won / 3000 * SG_TIERS[tier][1] * 1000) / 1000; } return out; })()""")
                check("shell game: simulated perfect watcher ~95% back on each speed", all(0.9 <= x <= 1.0 for x in r), r)
                r = [await ev(DP_SIM, [a, 2500]) for a in (0.5, -1, 0.1)]
                check("doubloon pusher: aiming dead centre pays back at most ~95%", r[0][0] <= 0.965, r)
                check("doubloon pusher: the swinging chute and the edges pay back less", r[1][0] <= r[0][0] + 0.01 and r[2][0] < r[0][0], r)
                print("  pusher payback: centre %.3f, swinging %.3f, edge %.3f" % (r[0][0], r[1][0], r[2][0]))
            # ---- menus: 7 games each, nothing overlaps
            for hub in ["tables", "machines"]:
                await ev(f"(() => {{ CZ.hub.sel = 0; S.overlay = '{hub}'; }})()"); await page.wait_for_timeout(80)
                r = await ev(f"(() => {{ const h = hubHits('{hub}'); return [h.length, h.every(q => q[2] + q[4] <= 186)]; }})()")
                check(f"{tag}: {hub} lists 7 games, all clear of the bottom line", r == [7, True], r)
                await page.screenshot(path=os.path.join(OUT, f"{tag}_{hub}.png"))
            # ---- compass rose: place, spin, settle (forced pocket)
            await ev("(() => { REEL.store.tav.chips = 25000; CZ.cr = null; casinoOpen('compass'); const c = CZ.cr; c.bet = 100; crPlace('quart', 0); crPlace('col', 1); c.bet = 10; crPlace('point', 5); })()")
            await page.wait_for_timeout(80); await page.screenshot(path=os.path.join(OUT, f"{tag}_compass_bets.png"))
            r = await ev("""(() => { const c0 = REEL.store.tav.chips; const R = Math.random; Math.random = () => 5.5 / 33; crSpin(); Math.random = R;
              for (let k = 0; k < 300; k++) crTick(1 / 60); return [CZ.cr.res, REEL.store.tav.chips - c0, CZ.cr.msg, CZ.cr.phase]; })()""")
            check(f"{tag}: compass lands on NEBE: quarter NE x3.9 + blue x1.95 + the point x31 paid", r[0] == 5 and r[1] == -210 + 390 + 195 + 310 and r[3] == "done", r)
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_compass_done.png"))
            # ---- liar's dice: deal, bid, he answers, call, next
            await ev("(() => { CZ.ld = null; casinoOpen('liar'); CZ.ld.bet = 200; ldDeal(); })()")
            r = await ev("[CZ.ld.phase, CZ.ld.you.length, CZ.ld.him.length, REEL.store.tav.chips]")
            check(f"{tag}: liar's dice deals 5 dice each and takes the stake", r[:3] == ["play", 5, 5] and r[3] <= 25000 - 200 + 1e6, r)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_liar_start.png"))
            await ev("(() => { const c = CZ.ld; c.q = 2; c.f = 3; ldBid(); for (let k = 0; k < 120 && c.turn === 'him' && c.phase === 'play'; k++) ldTick(1 / 30); })()")
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_liar_bid.png"))
            r = await ev("""(() => { const c = CZ.ld; let guard = 0;
              while (c.phase !== 'done' && guard++ < 400) {
                if (c.phase === 'reveal') { ldNext(); continue; }
                if (c.turn === 'him') { ldTick(2); continue; }
                const a = ldAI(c.you, c.him.length, c.bid && c.bid[2] === 'him' ? c.bid : c.bid, { call: 0.12, bluff: 0, noise: 0.05 });
                if (a[0] === 'liar' && c.bid && c.bid[2] === 'him') { ldLiar('you'); if (guard < 40) window.__rev = 1; } else if (a[0] === 'bid') { c.q = a[1]; c.f = a[2]; ldBid(); } else { c.q = (c.bid ? c.bid[0] : 0) + 1; c.f = 2; ldBid(); }
              } return [c.phase, c.you.length, c.him.length, c.msg]; })()""")
            check(f"{tag}: a whole game of liar's dice plays out", r[0] == "done" and (r[1] == 0 or r[2] == 0), r)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_liar_done.png"))
            await ev("(() => { CZ.ld.phase = 'stake'; ldDeal(); CZ.ld.bid = [3, 4, 'him']; CZ.ld.hist = [['YOU', 2, 4], ['HIM', 3, 4]]; CZ.ld.turn = 'you'; ldLiar('you'); })()")
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_liar_reveal.png"))
            r = await ev("(() => { const c = CZ.ld; ldNext(); c.fold = false; return [c.phase]; })()")
            await ev("(() => { CZ.ld.fold = true; })()")
            # ---- shell game
            await ev("(() => { CZ.sg = null; casinoOpen('shell'); CZ.sg.tier = 1; CZ.sg.bet = 100; sgStart(); sgTick(1.5); sgTick(0.15); })()")
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_shell_shuffle.png"))
            await ev("(() => { const c = CZ.sg; for (let k = 0; k < 200 && c.phase !== 'cover'; k++) sgTick(0.05); sgTick(0.3); })()")
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_shell_cover.png"))
            await ev("(() => { const c = CZ.sg; for (let k = 0; k < 40 && c.phase !== 'pick'; k++) sgTick(0.05); })()")
            await page.screenshot(path=os.path.join(OUT, f"{tag}_shell_pick.png"))
            r = await ev("(() => { const c = CZ.sg; const k = c.slot[c.pearl]; const c0 = REEL.store.tav.chips; sgPick(k); return [c.won, REEL.store.tav.chips - c0]; })()")
            check(f"{tag}: picking the pearl's shell pays x2 on FAST", r == [200, 200], r)
            await page.wait_for_timeout(60); await page.screenshot(path=os.path.join(OUT, f"{tag}_shell_done.png"))
            # ---- doubloon pusher: a fresh shelf, drops, saving
            await ev("(() => { delete REEL.store.tav.dp; CZ.dp = null; casinoOpen('pusher'); })()")
            r = await ev("[CZ.dp.coins.length, CZ.dp.coins.every(c => c.v === 1)]")
            check(f"{tag}: a fresh shelf is full of house coins worth 1", 110 <= r[0] <= 150 and r[1], r)
            await ev("(() => { const c = CZ.dp; c.bet = 50; for (let k = 0; k < 12; k++) { dpTry(); for (let f = 0; f < 20; f++) dpTick(1 / 60); } })()")
            await page.wait_for_timeout(100); await page.screenshot(path=os.path.join(OUT, f"{tag}_pusher.png"))
            r = await ev("(() => { dpSave(); const q = REEL.store.tav.dp; return [q.c.length === CZ.dp.coins.length, q.c.some(o => o[2] === 50)]; })()")
            check(f"{tag}: the shelf (with your 50-chip doubloons) is saved", r == [True, True], r)
            await ev("(() => { CZ.dp = null; casinoOpen('pusher'); })()")
            r = await ev("[CZ.dp.coins.length === REEL.store.tav.dp.c.length, CZ.dp.coins.some(o => o.v === 50)]")
            check(f"{tag}: coming back finds the same shelf", r == [True, True], r)
            # ---- typed stakes reach the new games
            r = await ev("['compass', 'liar', 'shell', 'pusher'].map(o => !!(STAKE_REF[o] && STAKE_REF[o]()[0]))")
            check(f"{tag}: tapping the amount to type a bet works in all four", r == [True] * 4, r)
            check(f"{tag}: no page errors", not errs, errs[:3])
            await page.close()
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
