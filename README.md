# Reel Deep

A pixel-art fishing dive that runs in any browser. The ocean fills the whole window: tall on a phone, wide on a computer.
Ten zones, 1,160 metres down, 123 species to log.

## How to play

- **Pick a lure**, then **CAST** (Space on a keyboard).
- **Steer** by dragging, or with **A / D** or the **arrow keys**.
- Every fish you touch goes on the hook, and it only holds **three**.
- **PULSE** (bottom left, or **Shift**) scatters everything near the hook. The lure decides how many you get.
- Sparkling **trophies** and gold **legendaries** fight back: tap (or press **Space**) when the marker is on green,
  before the clock runs out. Fast fish, heavy fish, deep fish and slippery fish each fight differently.
- Only one legendary fits on a hook.
- A jellyfish or a full hook ends the dive. If you reach the **sea floor** with room left, the hook rises slowly
  and you keep fishing until it is full.
- **F** switches full screen on and off.

The title screen has SCORES, LOG and SHOP along the bottom. **MORE** holds tasks, secrets, help, your initials and save codes.
HELP has all of the above in a few short pages.

## Secrets

There are secrets in the sea, and a few on the title screen. Nobody will tell you how many. Messages in bottles drift
by now and then and hint at them. Once you find your first, a **Secrets** page appears under MORE, listing what you
have found and holding the rewards that come with them. Secret rewards are never sold in the shop.

Some things also happen on their own, going by your device's clock: certain hours, certain nights and certain days of the year.

## Save codes

Progress lives in your browser. **MORE > SAVE CODE** makes a short code (like `K7QX-M2PD`) that loads your coins, log,
looks and secrets on another device, or brings them back after clearing your browser. A code loads your progress as it
was when the code was made. Anyone with your code can load it, so keep it to yourself. Without the shared database,
the game gives you one long code that holds the whole save instead.

## Scoring

Score is total pounds times your set bonuses, which add together (up to x5):

| Haul | Bonus |
|---|---|
| A pair | +0.5 |
| Three different zones | +1 |
| Three trophies (legendaries count) | +1 |
| All three from the Bone Yard or deeper | +1 |
| Three of a kind | +2 |

Today's bounty fish (shown on the title screen) weighs triple, and touching the sea floor adds 40 lb.

## Coins, tasks and the shop

Every haul pays a few coins, and three daily tasks and two weekly tasks pay more. Coins buy looks only: characters,
hats, boats, pets, flags, hooks, line colours, bubble trails and things for your fish to wear (175 items in all).
The best of it is priced to take weeks of regular play. Titles are earned, not bought, by
filling pages of the log and a few other feats. Nothing in the shop changes your score.

Coins, purchases and the fish log are saved in each player's own browser.

## Put it on GitHub Pages

1. Create a new public repository on GitHub, for example `reel-deep`.
2. Upload everything in this folder to it (`index.html` must be at the top level).
3. In the repository go to **Settings > Pages**, set **Source** to "Deploy from a branch", pick the `main` branch and `/ (root)`, and save.
4. After a minute the game is live at `https://YOUR-USERNAME.github.io/reel-deep/`.

## The shared leaderboard (free)

GitHub Pages only serves files, so the scores live in a free Firebase Realtime Database.

1. Go to <https://console.firebase.google.com>, sign in with a Google account and create a project (Analytics can be off).
2. In the left menu open **Databases & Storage > Realtime Database** and click **Create database**. Pick the United States location and **locked mode**.
3. Open the **Rules** tab, replace what is there with the contents of `database.rules.json` from this folder, and click **Publish**.
4. On the **Data** tab, copy the database address at the top. It looks like `https://your-project-default-rtdb.firebaseio.com`.
5. Paste it between the quotes in `config.js` and commit.

**Updating from an earlier version:** the rules file has changed. Repeat step 3 with the new `database.rules.json`.
The latest change adds a `saves` list for save codes. Until the new rules are published, the game hands out long codes instead of short ones.

The boards show the top ten scores for today and of all time. Tap a score to see what was on the hook.

What the rules allow: anyone can read the boards and add a score between 1 and 20,000 lb under 1 to 3 initials;
nothing can be edited or deleted from the game. Save codes can each be written once, are capped at 20 KB, and can only
be read by asking for the exact code, so nobody can list them. There is no login, so someone who finds the address could post a
made-up score. For a game between friends that is usually fine, and you can delete entries by hand on the Data tab.

## Files

- `index.html`, `game.js` - the game
- `data.js`, `assets/` - fish, zones and sprites
- `config.js` - the leaderboard address
- `database.rules.json` - the database rules to paste into Firebase
