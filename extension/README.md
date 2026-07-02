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
   - **GitHub token** — fine-grained PAT with `Issues: write` + `Contents: write` on your
     target repos (classic PAT with `repo` also works). Stored in `chrome.storage.local`,
     never leaves your browser except to `api.github.com`.
   - **Repos** — one `owner/repo` per line; you pick per report.
   - **Screenshot storage — Cloudflare R2 (required for screenshots)**: annotated PNGs
     upload to your R2 bucket via Cloudflare's REST API (no S3 signing) and the issue
     embeds the public link — nothing is ever committed to git. **Screenshot capture
     stays disabled until R2 is connected** (account id, bucket, API token, public base
     URL — the options page has a 3-minute setup guide); text-only reports work without
     it. R2's free tier (10 GB, zero egress) is far more than screenshot traffic needs.
     Privacy note: anything under the bucket's public URL is reachable by link.

## History

Every report filed from this browser is logged locally and shown on the **history** page
with live state from GitHub (open/closed, labels, comment count). Nothing extra to
configure.

## Repo chat (the connected agent)

The **chat** page is a repo-aware agent: BYO model key (Anthropic, or any
Anthropic-compatible endpoint like DeepSeek — set base URL + model in options). The agent
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
click icon → captureVisibleTab → annotate.html (canvas, red pen/box/arrow, undo)
  → title + note + bug|feature + repo
  → PNG → R2 (public link) → POST issue {labels: nanobots:inbox, nanobots:ext, bug|enhancement}
  → link to the filed issue; the outer loop triages it next cycle
```

No build step, no dependencies, MV3, vanilla JS. Permissions: `activeTab` (capture only
when you click), `storage` (your settings), host access to `api.github.com` and
`api.cloudflare.com` (R2 mode only).

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
