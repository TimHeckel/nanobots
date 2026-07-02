# nanobots browser extension

Click the icon on any page → the visible tab is captured → annotate it (pen / box /
arrow) → one click files it as a GitHub issue labeled `nanobots:inbox`, which your
board's auto-add workflow pulls into the Inbox column for the outer loop to triage.
Issues are the canonical record; the kanban board picks them up automatically —
the extension never talks to the Projects API.

## Install (unpacked, Chrome/Brave/Edge)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this
   `extension/` directory.
2. Open the extension's **Options**:
   - **GitHub token** — fine-grained PAT with `Issues: write` + `Contents: write` on your
     target repos (classic PAT with `repo` also works). Stored in `chrome.storage.local`,
     never leaves your browser except to `api.github.com`.
   - **Repos** — one `owner/repo` per line; you pick per report.
   - **Screenshot storage**:
     - `repo` (default) — the annotated PNG is committed to
       `.nanobots/inbox/shots/` and embedded in the issue. Zero extra config, and on
       private repos the image is only visible to people with repo access. The loop may
       prune old shots.
     - `r2` — PUT to a Cloudflare R2 bucket via Cloudflare's REST API (account id,
       bucket, API token with R2 edit, public base URL). Keeps binaries out of git;
       note the public-URL privacy tradeoff.

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
  → [storage adapter uploads PNG] → POST issue {labels: nanobots:inbox, bug|enhancement}
  → link to the filed issue; the outer loop triages it next cycle
```

No build step, no dependencies, MV3, vanilla JS. Permissions: `activeTab` (capture only
when you click), `storage` (your settings), host access to `api.github.com` and
`api.cloudflare.com` (R2 mode only).
