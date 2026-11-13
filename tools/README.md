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
