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

No roadmap/analytics or personal-memory phases yet — those are later. The AI coaching layer
(below) is now built.

### AI coaching layer

`extension/src/lib/ai/` — an `AIProvider` abstraction per the PRD (kept provider-agnostic; only the
`generateHint` slice, called `HintProvider`, is actually implemented right now via
`GeminiProvider`), a conservative event-based `shouldIntervene()` intervention engine (own
self-check: `npm run check:intervention`, no API key needed), and 4 progressive hint levels
(Socratic → Direction → Pattern → Concept), with a full solution only ever given on explicit
request behind a warning.

- Set a free Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) in
  the dashboard's Coach panel to enable it — nothing AI-related runs without one.
- Proactive nudges: after every heartbeat/submission, the background script checks
  `shouldIntervene()` (stuck 10+ min with no attempts, 2+ repeated failures, 3+ total failures, a
  5-minute cooldown between nudges) and fires a native `chrome.notifications` alert if it decides
  to help — quiet by default, per the PRD's "prefer no intervention over an unnecessary
  interruption."
- Manual hints and the hint history live in the dashboard's Coach panel, not a new nav page (no
  router exists yet — it's a section on the one dashboard view).
- Deliberately not in this pass: the in-page floating "Noryx Coach" overlay (PRD §15) — the surface
  today is the dashboard + notifications, not an overlay injected into the coding-platform page.
  Also not sent to the model: your actual code (only problem metadata + submission-status history)
  — levels 1-3 are about approach, not code review, so this holds up without it; code-aware hints
  are a natural next step once `EditorState` gains a `code` field.

### Platform coverage

Detection runs through a `UniversalDetector` (`extension/src/lib/adapters/universal-detector.ts`)
that tries adapters in order and uses the first one that matches the page:

- **`LeetCodeAdapter`** — precise, LeetCode-specific selectors.
- **`GenericCodingAdapter`** — a cross-site fallback (code editor + Run/Submit button + verdict-text
  scanning) that's what makes the other 8 sites work at all without a bespoke adapter for each:
  Codeforces, CodeChef, HackerRank, AtCoder, GeeksforGeeks, HackerEarth, Kattis, CSES.

### Verified per-platform status

Fetched each site's real (logged-out) HTML from this environment to check what's actually there,
rather than guess. Findings, honestly:

| Platform | Reachable? | Editor on the problem page? | Notes |
|---|---|---|---|
| **LeetCode** | `curl`/`WebFetch` blocked by Cloudflare — but a real, AppleScript-driven Safari session passes the same challenge normal browsing does | **Confirmed** — `.monaco-editor` present | Hardened against the live DOM: difficulty via `[class*="text-difficulty-"]`, Run/Submit buttons and the verdict panel via LeetCode's own `data-e2e-locator` test-ids (`console-run-button` / `console-submit-button` / `console-result`), runtime via a confirmed `Runtime: N ms` sibling text. This also caught a real bug — Run and Submit render into the *same* result element, so without tracking which button was clicked, every debug Run during iteration would've been miscounted as a submission attempt; fixed via click-tracking in `LeetCodeSubmissionWatcher`. |
| Codeforces | No — Cloudflare challenge (didn't retry with real Safari here; same technique should work) | — | Falls through to the generic adapter, unverified. |
| **HackerRank** | Yes | **Confirmed** — `.monaco-editor` present | Difficulty confirmed as isolated leaf text ("Easy" inside a `.difficulty-easy` badge) — the generic adapter's heuristics should work here as built. |
| AtCoder | Yes | Not on the problem/task page — the submit form lives on a separate URL (classic multi-page site, not a SPA) | Should work once the user is actually on the submit page (manifest matches the whole domain); untested. |
| CodeChef | Yes | Not found in the static HTML | Editor likely loads via a separate mechanism not visible logged-out. Unverified. |
| Kattis | Yes | None on the anonymous problem page — no editor, no file-upload form | Difficulty extraction confirmed to work (isolated "Easy" text), but submission itself is probably behind login. Won't be detected as-is. |
| CSES | Yes | None found logged-out | Same story as Kattis — likely needs an authenticated session to see the real submission UI. |
| GeeksforGeeks | Yes | Not found in the static HTML (likely client-rendered after hydration) | Difficulty exists as embedded JSON (`"difficulty":"Basic"` — GFG has a 4th tier below Easy, now supported by widening `ProblemMetadata.difficulty` to a plain string) but isn't confirmed as visible leaf text. |
| HackerEarth | Not probed | — | No confidently-known problem URL to test against. |

Net: the generic adapter's shape (in-page editor + Run/Submit control) matches how LeetCode and
HackerRank actually work. Several others don't fit that shape at all when logged out — that's a
real gap, not a guess dressed up as one. Closing it needs real DOM from a logged-in session on each
platform — the same technique that hardened LeetCode (driving a real, already-authenticated Safari
session) should work for the Cloudflare-blocked ones too; the rest just need a look at their
authenticated submission flow specifically, since that's the part that doesn't show up logged out.

One SPA-navigation bug this investigation did surface and fix: several of these are React
frontends that can switch problems via client-side routing (no full page reload), which would have
left the content script's detection stale. `content-scripts/universal.ts` now watches for URL
changes (patches `history.pushState`, listens for `popstate`, polls as a fallback) and re-runs
detection on every navigation, tearing down the previous adapter's observer first.

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
      types.ts                Problem/Session/Submission/Hint types, storage.ts, messages.ts, settings.ts
      adapters/
        types.ts               CodingPlatformAdapter interface (per the PRD, verbatim)
        dom-heuristics.ts       Shared leaf-text scanning + verdict watcher, used by both adapters
        leetcode.ts             Precise LeetCode adapter
        generic.ts              Cross-site fallback adapter (the other 8 platforms)
        universal-detector.ts   Picks the first matching adapter for the current page
      ai/
        types.ts                AIProvider (PRD-verbatim) + HintProvider (what's actually implemented)
        gemini-provider.ts       GeminiProvider — REST calls to Gemini, per-level prompts
        intervention.ts          shouldIntervene() — pure, self-checked via check:intervention
    background/               Persists events from the content script into storage; runs
                               shouldIntervene() after each heartbeat/submission, fires notifications
    content-scripts/universal.ts   Runs whichever adapter matches, drives session/heartbeat/submission
    dashboard/                 React app, opened as an extension page from the toolbar icon
      components/CoachPanel.tsx   API key prompt, hint feed, "Ask for a hint" / "Show full solution"
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
