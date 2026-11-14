# Reel Deep build tools

These scripts generate the game's data and art. The game itself does not need them to run;
they are here so the fish, cosmetics and ocean can be changed later.

## What makes what

| File | Purpose |
| --- | --- |
| `web_export.py` | Writes `../data.js`, `../assets/atlas.png` (every sprite) and `../assets/water.png` (the ocean background). Holds the cosmetics (characters, hats, boats, hooks, flair, pets, flags), the deep-zone scenery, prices that live in data, darkness levels and balance numbers. |
| `fishing_web.py` | The fish: zones, water colours, every species (name, zone, weight, speed, rarity) and how each sprite is drawn. |
| `hopper.py` | The base critters (fox, frog, penguin) that the characters are built from. |
| `arcade_core.py` | Shared helpers: the pixel font and drawing utilities. |
| `tests/` | Browser tests (Playwright) that play the game with a bot and take screenshots. |

Shop prices, tasks, scoring and everything else about how the game plays live in `../game.js`.

## Regenerating

Needs Python 3 with `pygame` and `numpy`:

```
pip install pygame numpy
python3 web_export.py
```

Running it from this folder rewrites `../data.js` and the two images in `../assets/`. Output is the same
every time for the same inputs.

The tests also need `pip install playwright` and `playwright install chromium`. They expect the game at a fixed
path near the top of each file; change that path before running them.

## How hard is the Sleeper?

`tests/test_sleeper.py` fights the Sleeper hundreds of times with two bots and prints their win rates, on phone and
widescreen. The careful bot reads every warning and reacts in 0.12 s; the hugger plays carefully but parks against
its head between attacks; the sloppy one reacts in 0.4 s and ignores the warnings and the gaps in the shockwaves. Serve the game folder first (`python3 -m http.server 8765 --bind 127.0.0.1`),
then run `python3 tests/test_sleeper.py 100`. The fight's numbers live in `SL_TUNE` in `game.js`; you can try others
without editing anything by passing them as JSON, for example `python3 tests/test_sleeper.py 100 '{"ring": 3.2}'`.
As shipped: the careful bot reaches phase 3 in 80-90% of fights and wins 25-35%; the hugger does worse; the sloppy bot
gets past phase 1 about three times in four and wins 1-2%.

