# Reel Deep

A pixel-art fishing dive that runs in any browser. The ocean fills the whole window: tall on a phone, wide on a computer. Pick a lure, drop the hook,
dodge what you don't want and bring up your best three fish.

## How to play

- **Pick a lure**, then tap **CAST**.
- **Drag** left and right to steer the hook on the way down. On a keyboard use **A / D** or the **arrow keys**.
- Every fish you touch goes on the hook, and it only holds **three**.
- **PULSE** (bottom left, or **Shift**) scatters everything near the hook. The lure decides how many you get.
- On a computer, **Space** casts and taps, the arrows pick a lure on the title screen, and **F** switches full screen on and off.
- Big sparkling **trophies** and gold **legendaries** fight back: tap when the marker is on green.
- A jellyfish, a full hook or the sea floor ends the dive.

Score is total pounds, times the best set bonus:

| Haul | Bonus |
|---|---|
| Three trophies, or three of a kind | x3 |
| All three from the Abyss or the Floor | x2 |
| Three different zones | x2 |
| A pair | x1.5 |

Today's bounty fish (shown on the title screen) counts triple, and touching the sea floor adds 40 lb.

## Put it on GitHub Pages

1. Create a new public repository on GitHub, for example `reel-deep`.
2. Upload everything in this folder to it (`index.html` must be at the top level).
3. In the repository go to **Settings > Pages**, set **Source** to "Deploy from a branch", pick the `main` branch and `/ (root)`, and save.
4. After a minute the game is live at `https://YOUR-USERNAME.github.io/reel-deep/`.

## Turn on the shared leaderboard (about 10 minutes, free)

GitHub Pages only serves files, so the scores live in a free Firebase Realtime Database.

1. Go to <https://console.firebase.google.com>, sign in with a Google account and create a project (Analytics can be off).
2. In the left menu open **Build > Realtime Database** and click **Create Database**. Pick any location and start in **locked mode**.
3. Open the **Rules** tab, replace what is there with the contents of `database.rules.json` from this folder, and click **Publish**.
4. Back on the **Data** tab, copy the database address at the top. It looks like `https://your-project-default-rtdb.firebaseio.com`.
5. Paste it between the quotes in `config.js`, commit, and the SCORES button starts showing everyone's results.

What the rules allow: anyone can read the boards and add a score between 1 and 5000 lb under 1 to 3 initials; an
all-time best can only go up; nothing can be edited or deleted from the game. There is no login, so someone who
finds the address could post a made-up score. For a game between friends that is usually fine, and you can delete
entries by hand on the Data tab.

## Files

- `index.html`, `game.js` - the game
- `data.js`, `assets/` - fish, zones and sprites, generated from the arcade version
- `config.js` - the leaderboard address
- `database.rules.json` - the database rules to paste into Firebase
