# GitHub Projects v2 Automation — CLI / GraphQL / Actions Reference (verified July 2026)

Verified against local `gh` v2.89.0 `--help` output and current GitHub docs. My local token already carries the `project` scope, so the CLI flag names below are the exact live ones.

## 1. `gh project` CLI

**Auth:** every `gh project` subcommand requires the classic OAuth **`project`** scope (read+write; the CLI's stated minimum is `project`, there is no CLI read-only mode). Check with `gh auth status`; add with:
```bash
gh auth refresh -s project        # adds project scope to the current gh login
```
Common flags: `--owner <login>` (`@me` for current user; an **org** login for org projects), `--format json`, `-q/--jq`, `-t/--template`. Most commands identify the project by its **number** (positional), not node ID.

### create
```bash
gh project create --owner <login> --title "Roadmap" [--format json]
```
Only `--owner` + `--title`. JSON returns number + node id.

### field-create
```bash
gh project field-create <number> --owner <login> \
  --name "Priority" --data-type SINGLE_SELECT \
  --single-select-options "P0,P1,P2"
```
`--data-type` ∈ `{TEXT | SINGLE_SELECT | DATE | NUMBER}`. `--single-select-options` = comma-separated string. CLI **cannot** create ITERATION fields.

### item-add
```bash
gh project item-add <number> --owner <login> \
  --url https://github.com/OWNER/REPO/issues/23
```
Adds an existing issue/PR by URL. (`item-create` makes a draft issue instead.)

### item-edit  ← the syntax you asked to confirm
```bash
gh project item-edit \
  --id <ITEM_ID> \
  --field-id <FIELD_ID> \
  --project-id <PROJECT_ID> \
  --single-select-option-id <OPTION_ID>
```
Confirmed flags: `--id` (the **project item** node ID, NOT the issue ID), `--field-id`, `--project-id` — all **node IDs, not numbers**. One value flag per call: `--text`, `--number <float>`, `--date YYYY-MM-DD`, `--single-select-option-id`, `--iteration-id`, or `--clear`. Quirks: for non-draft items `--project-id` is required, and **only one field value can be updated per invocation**. `item-edit` is the outlier that takes node IDs rather than `--owner`/number.

### item-list
```bash
gh project item-list <number> --owner <login> -L 100 --format json \
  --query "label:bug -status:Done"
```
`-L/--limit` defaults to **30** — raise it or you silently truncate. `--query` uses Projects filter syntax (`assignee:@me is:issue is:open`, `-status:Done`) on github.com and GHES ≥3.20. Easiest way to filter by status.

### view
```bash
gh project view <number> --owner <login> [--format json] [-w|--web]
```

**Getting IDs via CLI (instead of GraphQL):**
```bash
gh project view       <number> --owner <login> --format json  # project node id
gh project field-list <number> --owner <login> --format json  # field ids + single-select option ids
gh project item-list  <number> --owner <login> --format json  # item ids
```

## 2. GraphQL for Projects v2

Run via `gh api graphql -f query='…'` or POST to `https://api.github.com/graphql`.

**Project node ID:**
```graphql
query { organization(login:"ORG") { projectV2(number: N) { id } } }   # org
query { user(login:"USER")        { projectV2(number: N) { id } } }   # user
```

**Field IDs + single-select option IDs + iteration IDs:**
```graphql
query {
  node(id: "PROJECT_ID") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field { id name }
          ... on ProjectV2SingleSelectField { id name options { id name } }
          ... on ProjectV2IterationField {
            id name
            configuration { iterations { id startDate } }
          }
        }
      }
    }
  }
}
```

**Add issue/PR to project** (`contentId` = issue/PR node id):
```graphql
mutation {
  addProjectV2ItemById(input: { projectId: "PROJECT_ID", contentId: "CONTENT_ID" }) {
    item { id }
  }
}
```

**Set a field value** — `updateProjectV2ItemFieldValue`; `value` is a union, use exactly one key:
```graphql
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_ID"
    itemId:    "ITEM_ID"
    fieldId:   "FIELD_ID"
    value: { singleSelectOptionId: "OPTION_ID" }   # single-select (e.g. Status)
    # value: { text: "..." }         # value: { number: 3 }
    # value: { date: "2026-07-01" }  # value: { iterationId: "ITERATION_ID" }
  }) { projectV2Item { id } }
}
```
Cannot set Assignees/Labels/Milestone/Repository this way — those live on the underlying issue. Custom fields + built-in **Status** single-select DO work here.

**Filter items by status:** no server-side status filter in GraphQL. Either read each item's status with `fieldValueByName` and filter client-side:
```graphql
query {
  node(id:"PROJECT_ID") { ... on ProjectV2 {
    items(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        content { ... on Issue { number title url } ... on PullRequest { number url } }
        fieldValueByName(name: "Status") {
          ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
        }
      }
    }
  }}
}
```
…or just use `gh project item-list --query "status:\"In Progress\""` (CLI applies the filter for you — simpler).

## 3. GitHub Actions & default `GITHUB_TOKEN` — CANNOT touch org Projects v2

- `${{ secrets.GITHUB_TOKEN }}` is **repository-scoped** and has **no access to organization Projects v2**. Calls fail with `Resource not accessible by integration` / scope error. By design — org projects live above the repo boundary.
- `gh` in Actions needs `GH_TOKEN` set explicitly; it does not implicitly read `GITHUB_TOKEN` for `project`. And even `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` fails for org projects — the *token type*, not the env var, is the blocker.

**What works from Actions:**
1. **Fine-grained PAT** — organization **"Projects"** permission = **Read and write** (+ repo **Issues: read** to resolve issue node IDs). Store as secret, set `GH_TOKEN`.
2. **Classic PAT** — scope **`project`** (RW) or **`read:project`** (RO). Works for user + org projects.
3. **GitHub App** installed on the org — grant the org **"Projects"** permission (RW); mint an installation token (`actions/create-github-app-token`) and use it as `GH_TOKEN`. Recommended production path. The permission is named **"Projects"** at org level — there's no separately-named `organization_projects` toggle in the fine-grained/App UI, it's just the org **Projects** permission.

```yaml
permissions:
  contents: read
steps:
  - env:
      GH_TOKEN: ${{ secrets.PROJECTS_PAT }}   # fine-grained PAT, org Projects: RW
    run: |
      gh project item-add 5 --owner my-org --url "${{ github.event.issue.html_url }}"
```

## 4. Built-in Projects v2 workflows (no code)

Project → ⋯ → **Workflows**. Triggers→actions:
- **Item added** → set field (e.g. Status = Todo) *(default off)*
- **Item reopened** → set Status
- **Issue closed** → Status = Done *(default ON)*
- **Pull request closed** → Status = Done *(default ON)*
- **Pull request merged** → Status = Done *(default off)*
- **Code review approved / changes requested** → set Status
- **Auto-add to project** — pull repo items matching a filter (e.g. `is:issue is:open label:bug`) *(default off)*
- **Auto-archive items** — archive items matching a filter

Free, server-side, no PAT/App. Limitation: single trigger→single field-set, no branching. Anything richer needs the API path.

## 5. Webhooks / events — the key Actions gotcha

- Relevant events: **`projects_v2`** (project created/edited/deleted), **`projects_v2_item`** (item created/edited/archived/reordered/deleted, incl. **field-value changes with old+new values**), `projects_v2_status_update`.
- These are **organization-level** and **only deliverable to GitHub Apps (org "Projects" read) or org/enterprise webhooks — NOT available as `on:` triggers in repo Actions workflows.** A repo workflow cannot be triggered directly by a kanban status change. Subscribing to `projects_v2_item` needs an App with ≥read on the org **Projects** permission.
- **Practical patterns to react to board changes:**
  - **Scheduled poll** (simplest, no App): `on: schedule` cron runs `gh project item-list --query "status:..."` with a PAT/App token and acts on the delta. Latency = cron interval; watch rate limits.
  - **Org webhook / GitHub App → `repository_dispatch`:** App receives `projects_v2_item`, then `POST /repos/{o}/{r}/dispatches` to kick a repo workflow. The real-time path.

## 6. Limits, rate limits, pagination

- **Item cap: 1,200 non-archived items per project.** Archived items don't count (effectively unbounded — no documented fixed "50k archived" cap). "Increased project item limits" has been rolling out in public preview with orgs opted in, so some orgs exceed 1,200 — verify per-org before assuming; documented hard number is still 1,200.
- **Rate limits:** Projects mutations go through the **GraphQL API** = **point/cost-based, not request-count**. **5,000 points/hour** for PATs (higher for Apps/Enterprise). Bulk queries with large `first:` are expensive — keep `first:` ≤50–100 and paginate. Secondary limits also apply to rapid mutation bursts.
- **Pagination:** cursor-based; every connection exposes `pageInfo { hasNextPage endCursor }`, loop with `after:$endCursor`. CLI hides this but defaults to `-L 30` — always pass explicit `--limit`.

---

## Sources
- Local `gh` v2.89.0 `--help` + `gh auth status`
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
- https://docs.github.com/en/webhooks/webhook-events-and-payloads (`projects_v2_item`)
- https://github.com/orgs/community/discussions/17405 (projects_v2 webhooks are App/org-only, not repo Actions triggers)
- https://github.com/orgs/community/discussions/9678 (1,200-item limit) + https://github.com/orgs/community/discussions/139936 (increased-limits preview)
- https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api (point-based limits)
- https://docs.github.com/en/actions/security-guides/automatic-token-authentication (GITHUB_TOKEN repo-scoped)
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens (fine-grained "Projects" permission)

**Caveat:** read-only mandate + no target org given, so I did not run `gh` against a live org project — the ID-bearing examples use placeholders. Flag names and mutation shapes are verified; exact node-ID round-trips were not executed live.
