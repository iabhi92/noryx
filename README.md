# Noryx

Your AI coding coach: a Safari Web Extension that watches you solve problems on coding platforms
(LeetCode first) and coaches you — hints, questions, pattern recognition — without writing the
solution for you. See the full product vision in the original PRD (not checked in here).

This repo currently implements the **First Milestone** only:

```
Open a LeetCode problem
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

No AI layer, no other platform adapters, and no roadmap/analytics yet — those are later phases.

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
    lib/                     Shared types, storage helpers, adapter interface
    background/               Persists events from the content script into storage
    content-scripts/leetcode.ts   Detects problem/session/submission on leetcode.com
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
4. Open a `leetcode.com/problems/...` page. A session should start automatically. Submit a
   solution, then click the Noryx toolbar icon to see it show up in the dashboard.

## Known limitations (by design, for this milestone)

- LeetCode only. Other adapters (Codeforces, CodeChef, ...) are a later phase.
- Submission detection uses DOM text-matching heuristics (LeetCode exposes no stable
  `data-testid` for this) — see the `ponytail:` comment in
  `extension/src/lib/adapters/leetcode.ts` if it needs patching after a LeetCode redesign.
- Active/idle time is tracked via tab visibility + focus, not keystroke-level activity.
