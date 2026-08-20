# Noryx — AI Coding Coach (VS Code)

Tracks active coding time in this VS Code window (a status bar item, local only by
default) and, if you connect it, syncs that time into the same public profile as the
[Noryx Safari extension](../extension) — so a link you share for a resume shows both
platform-solving time and local practice time under one identity.

## What it tracks

Wall-clock time while the window has focus, polled every 15 seconds — nothing else.
No file contents, no keystrokes, no workspace paths are ever read. This is the same
tier of tracking the Safari extension already does by default for tab-switches and
active/idle time (see `CodingSession` in `extension/src/lib/types.ts`): ambient
session metadata, not content.

## Connecting to your public profile (optional)

1. In the Noryx dashboard (Safari extension) → Settings → Public profile, enable the
   public profile if you haven't, then copy the **sync code** shown there.
2. In VS Code, run **Noryx: Set Sync Code** from the Command Palette and paste it in.
   It's stored in VS Code's encrypted secret storage, not plain settings.
3. Every 5 minutes, accumulated active time since the last sync is sent as a single
   millisecond delta to the same Supabase row your public profile already lives in —
   nothing else about this window is ever sent.

Run **Noryx: Clear Sync Code** to stop syncing; time tracking keeps working locally.

The public-profile side of this requires `supabase/vscode_sync_migration.sql` to have
been run once against the project (adds one column + one function, safe to run
against the live table).

## Build

```
npm install
npm run build      # esbuild bundle -> dist/extension.js
npm run typecheck
```

Then run via VS Code's Extension Development Host (`F5` from this folder) — this
package wasn't packaged/published through the Marketplace as part of this build; that's
a separate step (`vsce package`) if you want a `.vsix` to install directly.
