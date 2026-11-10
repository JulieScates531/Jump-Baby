# Jump Baby – Chores & Training Tracker ⭐

A kid-friendly daily to-do app for chores and sports training, with points and rewards.
It runs in any phone, tablet or computer browser. It has no accounts and no server, and works offline.

## What it does

- **Today:** a daily checklist of chores, plus training goals for each sport that's in season.
  - Tap a chore to check it off.
  - Track practice time with a **start/stop timer**, quick **+5 / +15** buttons, or a custom number of minutes.
  - Off-season sports can still be logged as "extra practice".
  - Use the arrows to look at earlier days. Today and yesterday can be edited, so a forgotten check-off can be fixed. Older days are locked unless a parent unlocks the Parent tab.
- **Points and rewards:**
  - **+10** for finishing **100%** of the day's chores.
  - **+10** for meeting **every** training goal that day.
  - **+5 Perfect Day bonus** for doing both.
  - Streaks are counted for chores and for training, with a celebration when he hits 100%.
  - The Reward shop lets him spend points. If a PIN is set, a parent has to approve.
- **History:** this week's points and minutes per sport, plus a 30-day log.
- **Parent tab** (can be protected with a PIN):
  - Edit chores and the days they appear.
  - Plan each week: team practice days, home training days, minutes and drills per sport.
- Set which months each sport is in season.
  - Edit rewards and their prices, and set the point values.
  - Give or take away bonus points.
  - Back up or restore the data.

### Weekly training plan (Parent tab)

Each week, every sport has:
- **Team practice days**, outside the house. On those days, checking "I went to practice" meets that sport's goal, so there's no home training for it.
- **Home training days** and a **home goal** in minutes.
- **Home drills**: what to work on. He sees this on his Today screen.

A plan carries forward to later weeks until a week that has its own plan. Use ‹ › to move to a future week and change it ahead of time.

Starting setup (karate is not tracked):

| Sport | Season | Team practice | Home goal |
|---|---|---|---|
| ⚽ Soccer | Year-round | Mon/Wed/Sat; **Mon/Tue from week of Dec 7** | 20 min |
| ⚾ Baseball | Year-round | (set in Parent tab) | 20 min |
| 🏀 Basketball | Dec–Feb | (set in Parent tab) | 20 min |

Example: on a soccer practice day, his home goals are baseball (and basketball in winter).

## Using it

It's a static site: open `index.html`, or host the folder anywhere. The easiest free option is **GitHub Pages**:
Repo **Settings → Pages → Deploy from a branch** → choose the branch and `/ (root)`.
Then open the URL on your son's device and choose **Add to Home Screen** so it works like an app.

> Data is stored on the device it's used on (browser storage). Use **Parent → Download backup**
> now and then, and **Restore backup** to move the data to a new device.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `manifest.webmanifest`, `sw.js`, `icons/`: home-screen install and offline support
