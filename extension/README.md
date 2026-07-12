# nanobots browser extension

Click the icon on any page → the visible tab is captured → annotate it (pen / box /
arrow) → one click files it as a GitHub issue labeled `nanobots:inbox`, which your
board's auto-add workflow pulls into the Inbox column for the outer loop to triage.
Issues are the canonical record; the kanban board picks them up automatically —
the extension never talks to the Projects API.

## Install

**Via npx** (materializes the folder anywhere):

```bash
npx nanobots-sh extension     # copies to ./nanobots-extension + prints load steps
```

**Or unpacked from a clone** (Chrome/Brave/Edge):

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this
   `extension/` directory.
2. Open the extension's **Options**:
   - **GitHub token** — three ways, easiest first:
     1. **connect with github** — OAuth device-flow sign-in (enter a code on
        github.com, the token fills itself). Shown only when the extension is built
        with an OAuth App client id (see "Enabling GitHub sign-in" below).
     2. **create a pre-filled token ↗** — deep link that opens GitHub's token page
        with the right scope pre-selected; Generate → copy → paste.
     3. Paste any existing PAT (fine-grained with `Issues: write` + `Contents: write`,
        or classic `repo`).
     Stored in `chrome.storage.local`, never leaves your browser except to GitHub.
   - **Repos** — one `owner/repo` per line, or click **load my repos** and add your
     recent repos as clickable chips.
   - **Screenshot storage — Cloudflare R2 (required for screenshots)**: annotated PNGs
     upload to your R2 bucket via Cloudflare's REST API (no S3 signing) and the issue
     embeds the public link — nothing is ever committed to git. **Screenshot capture
     stays disabled until R2 is connected**; text-only reports work without it.
     Easiest path: paste one Cloudflare API token and click **set up R2 for me** — the
     extension resolves your account, creates the bucket, enables the public `r2.dev`
     domain, and fills all four fields itself (manual fields remain as fallback; the
     options page has a 3-minute guide). R2's free tier (10 GB, zero egress) is far more
     than screenshot traffic needs. Privacy note: anything under the bucket's public URL
     is reachable by link.

## History

Every report filed from this browser is logged locally and shown on the **history** page
with live state from GitHub (open/closed, labels, comment count). Nothing extra to
configure.

## Repo chat (the connected agent)

The **chat** page is a repo-aware agent: BYO model key against **any OpenAI-compatible
endpoint** (Anthropic's compat layer is the default; OpenAI, Gemini, OpenRouter, local
Ollama all work — set base URL + model in options). Pick a **multimodal** model — vision
is what lets the agent actually read your screenshots while filing; text-only models
still chat, search, and file, with screenshots attaching via R2 regardless. The agent
has client-side tools against your repo — `search_code`, `read_file`, `search_issues`,
`list_files`, and `file_report` — so it answers with real lookups and can file reports
for you, dedupe-checking first. Paste or drop screenshots into the chat; the agent sees
them (vision) and attaches them to anything it files.

**The agent's brain is loop-owned.** Its system prompt is fetched live from
`.nanobots/EXTENSION-PROMPT.md` in the target repo. Reports filed here carry the
`nanobots:ext` label, and the repo's outer loop reviews how those reports fared in triage
(duplicate? vague? instantly actionable?) and refines the prompt's filing guidance during
its distill pass — so the extension gets better at capturing good signal the more the
loop sees of its output. Continual improvement, no extension update required.

## Flow

```
click icon → captureVisibleTab (before any UI, so the shot is clean)
  → in-page overlay on the SAME tab: frozen shot fills the viewport
  → drag to crop the region (F = full view, esc = cancel)
  → annotate the crop in place (red pen/box/arrow, undo, recrop)
  → title + note + bug|feature + repo
  → background worker: PNG → R2 (public link) → POST issue
      {labels: nanobots:inbox, nanobots:ext, bug|enhancement}
  → issue link shown in place; the outer loop triages it next cycle
```

The overlay is a shadow-DOM content script injected on demand (`activeTab` +
`scripting`); all network runs in the background service worker (MV3 content scripts
are subject to the page's CORS). Pages where content scripts can't run (chrome://,
web store) fall back to the old annotate tab.

No build step, no dependencies, MV3, vanilla JS. Permissions: `activeTab` (capture only
when you click), `storage` (your settings), host access to `api.github.com` and
`api.cloudflare.com` (R2 mode only).

## Enabling GitHub sign-in (maintainers)

The **connect with github** button uses the OAuth device flow — the only OAuth flow that
needs no client secret, so it runs fully serverless. To enable it:

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
   (name `nanobots`, homepage `https://nanobots.sh`; the callback URL is unused by
   device flow — put the homepage).
2. On the app's settings page, check **Enable Device Flow**.
3. Put the app's **Client ID** (public by design) in `GITHUB_OAUTH_CLIENT_ID` in
   `gh.js`. The button appears automatically.

Notes: device-flow tokens carry the classic `repo` scope (repo-granular selection is a
PAT-only feature — offer the pre-filled-PAT link for users who want tighter scoping).
There is deliberately no "auto-create a PAT" — GitHub has no API for that.

## Publishing to the Chrome Web Store (maintainers)

1. One-time: register at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
   ($5 one-time fee, any Google account).
2. Build the upload zip: `scripts/pack-extension.sh` → `dist/nanobots-extension-<version>.zip`.
3. Dashboard → **New item** → upload the zip. Listing needs: description, at least one
   1280×800 screenshot (annotate page + chat page are the money shots), category
   (Developer Tools), and privacy disclosures.
4. Privacy justifications (all true, state them plainly): no remote code (MV3, all JS
   bundled); `activeTab` — screenshot only on explicit click; `storage` — user settings
   only; host permissions — direct calls to GitHub/Cloudflare/model APIs with the user's
   own keys; no analytics, no data collection, keys never leave the browser.
5. Review typically takes a few business days. Bump `manifest.json` version for every
   re-upload.
