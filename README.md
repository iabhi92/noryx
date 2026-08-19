# Noryx

Your AI coding coach: a Safari Web Extension that watches you solve problems on coding platforms
and coaches you — hints, questions, pattern recognition — without writing the solution for you.
See the full product vision in the original PRD (not checked in here).

This repo currently implements the **First Milestone** only:

```
Open a problem on a supported coding site
        ↓
Extension detects the problem
        ↓
Session timer starts
        ↓
You code normally
        ↓
You submit
        ↓
Extension detects the result
        ↓
Problem saved locally (chrome.storage.local — nothing leaves your machine)
        ↓
Dashboard (click the toolbar icon) shows:
Problem, platform, active time, attempts, language, result
```

No AI layer and no roadmap/analytics yet — those are later phases.

### Platform coverage

Detection runs through a `UniversalDetector` (`extension/src/lib/adapters/universal-detector.ts`)
that tries adapters in order and uses the first one that matches the page:

- **`LeetCodeAdapter`** — precise, LeetCode-specific selectors.
- **`GenericCodingAdapter`** — a cross-site fallback (code editor + Run/Submit button + verdict-text
  scanning) that's what makes the other 8 sites work at all without a bespoke adapter for each:
  Codeforces, CodeChef, HackerRank, AtCoder, GeeksforGeeks, HackerEarth, Kattis, CSES.

The generic adapter's verdict matching is confident on ACM-style judges (Codeforces, AtCoder,
Kattis, CSES — same "Wrong Answer"/"Time Limit Exceeded" vocabulary as LeetCode) and weaker on
platforms with more custom result UIs (HackerRank, GeeksforGeeks, HackerEarth, CodeChef) — none of
these were reachable to inspect live from this environment (LeetCode itself is behind a Cloudflare
challenge that blocked both `curl` and automated fetching here). If one of those needs real
precision, give it its own adapter — same shape as `leetcode.ts` — once you've inspected its actual
DOM in a browser.

## Design

Visual design (Electric Sapphire: deep sapphire base, electric blue + soft violet glow,
glassmorphism) comes from `stitch_codesense_coach/electric_sapphire/DESIGN.md`. The dashboard
reuses its Tailwind tokens and card/sidebar patterns; the fake team/company mockup content was
replaced with real tracked data.

## Project layout

```
extension/
  manifest.json              Safari Web Extension manifest (MV3)
  src/
    lib/
      types.ts                Problem/Session/Submission types, storage.ts, messages.ts
      adapters/
        types.ts               CodingPlatformAdapter interface (per the PRD, verbatim)
        dom-heuristics.ts       Shared leaf-text scanning + verdict watcher, used by both adapters
        leetcode.ts             Precise LeetCode adapter
        generic.ts              Cross-site fallback adapter (the other 8 platforms)
        universal-detector.ts   Picks the first matching adapter for the current page
    background/               Persists events from the content script into storage
    content-scripts/universal.ts   Runs whichever adapter matches, drives session/heartbeat/submission
    dashboard/                 React app, opened as an extension page from the toolbar icon
```

## Build

```bash
cd extension
npm install
npm run icons     # generates placeholder toolbar icons (only needed once)
npm run build      # -> extension/dist/
npm run typecheck
```

## Load into Safari (manual — requires full Xcode, not just Command Line Tools)

1. `xcrun safari-web-extension-converter extension/dist` — generates an Xcode project wrapping the
   built extension.
2. Open the generated Xcode project, select the extension's app target, and Run. This installs the
   containing app; Safari will then list the extension under
   Safari → Settings → Extensions.
3. Enable the extension there. If it's unsigned, also enable
   Safari → Settings → Advanced → "Show features for web developers", then
   Develop → "Allow Unsigned Extensions".
4. Open a problem page on any supported site (e.g. `leetcode.com/problems/...`). A session should
   start automatically. Submit a solution, then click the Noryx toolbar icon to see it show up in
   the dashboard.

## Known limitations (by design, for this milestone)

- Submission/difficulty/language detection uses DOM heuristics, not verified platform APIs — see
  the `ponytail:` comments in `extension/src/lib/adapters/leetcode.ts` and `generic.ts` for what's
  precise vs. best-effort, and patch there if a site's markup changes underneath it.
- Active/idle time is tracked via tab visibility + focus, not keystroke-level activity.
- `GenericCodingAdapter`'s editor/action-button detection can in principle false-positive on a
  non-coding page that happens to have a `<textarea>` and a button labeled "Submit" — narrow the
  heuristic in `generic.ts` if that turns out to matter in practice.
