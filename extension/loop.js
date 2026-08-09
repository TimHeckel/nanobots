// A read-only VIEW of loop state. GitHub stays the only state store — nothing here writes,
// caches authoritatively, or infers anything GitHub doesn't already say. If this file and the
// board ever disagree, the board is right.
//
// The two "needs you" conditions are hard stops: the loop does no further work on that item
// until a person acts. Everything else is just progress you can watch.

import { tokenFor } from './gh.js';

// ── the plan-hash protocol, mirrored from templates/nanobots/daytona-worker.mjs ────────────
// These MUST stay byte-identical in meaning to checkApproval() there. A dashboard that
// disagrees with the worker is worse than no dashboard: it would either nag about work
// already approved, or stay silent while the loop sits blocked.
export const PLAN_MARKER = /<!--\s*nanobots:plan\s+issue=\d+\s+hash=([0-9a-f]{12})\s*-->/;
// Anchored to a whole line, exactly as the worker does. Unanchored, this matches the loop's
// own plan comment explaining how to approve — which once made the loop self-approve
// everything it planned.
export const APPROVAL_LINE = /^[ \t]*\/nanobots start ([0-9a-f]{12})[ \t]*$/m;

async function api(pat, path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// Same decision the worker makes, from the same evidence: the LAST plan marker wins, and only
// a whole-line approval carrying THAT hash counts. Collaborator permission is deliberately not
// checked here — it costs a request per commenter and the worker enforces it anyway. The cost
// of being wrong is a badge that clears a little early, not an unapproved build.
export function approvalState(comments) {
  let planHash = null;
  let planIndex = -1;
  comments.forEach((c, i) => {
    const m = (c.body || '').match(PLAN_MARKER);
    if (m) { planHash = m[1]; planIndex = i; }
  });
  if (!planHash) return { planned: false, awaiting: false };
  for (let i = comments.length - 1; i > planIndex; i--) {
    const m = (comments[i].body || '').match(APPROVAL_LINE);
    if (m && m[1] === planHash) return { planned: true, awaiting: false, hash: planHash };
  }
  return { planned: true, awaiting: true, hash: planHash };
}

// Where an item sits, read off labels and PR linkage. Coarse on purpose — the Projects board
// owns the real Status field, and duplicating it here would just be a second thing to drift.
export function stageOf(issue) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (issue.state === 'closed') return 'done';
  if (labels.includes('needs-info')) return 'needs info';
  if (labels.includes('nanobots:built')) return 'in review';
  if (labels.includes('nanobots:inbox')) return 'inbox';
  return 'triaged';
}

async function search(pat, q) {
  const r = await api(pat, `/search/issues?q=${encodeURIComponent(q)}&per_page=30`);
  return r.items || [];
}

// The repo's own config names the human-gate label; it is configurable at install time, so
// assuming "summon-human" would silently miss escalations on any repo that renamed it.
async function humanLabelFor(pat, nwo) {
  try {
    const f = await api(pat, `/repos/${nwo}/contents/.nanobots/config.json`);
    const json = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob((f.content || '').replace(/\n/g, '')), (c) => c.charCodeAt(0)),
    ));
    return json.humanLabel || 'summon-human';
  } catch {
    return 'summon-human';
  }
}

// One repo's worth of "what needs me, and what is moving".
export async function scanRepo(cfg, nwo) {
  const pat = tokenFor(cfg, nwo);
  if (!pat) return { nwo, error: 'no token', needsYou: [], moving: [], heartbeat: null };

  const humanLabel = await humanLabelFor(pat, nwo);
  const needsYou = [];

  // 1. Escalations — the loop asked for a person by name.
  for (const i of await search(pat, `repo:${nwo} is:issue is:open label:"${humanLabel}"`)) {
    needsYou.push({ nwo, number: i.number, title: i.title, url: i.html_url, why: 'summon-human' });
  }

  // 2. Plans waiting on approval. Searching comment bodies finds the planned issues without
  //    pulling every open issue's comments — usually a handful, often none.
  const planned = await search(pat, `repo:${nwo} is:issue is:open in:comments "nanobots:plan"`);
  for (const i of planned) {
    if (needsYou.some((n) => n.number === i.number)) continue;
    try {
      const comments = await api(pat, `/repos/${nwo}/issues/${i.number}/comments?per_page=100`);
      const a = approvalState(comments);
      if (a.awaiting) {
        needsYou.push({ nwo, number: i.number, title: i.title, url: i.html_url, why: 'plan awaiting approval', hash: a.hash });
      }
    } catch { /* one unreadable issue must not sink the whole scan */ }
  }

  // 3. In flight — visible progress, nothing required of you.
  const moving = (await search(pat, `repo:${nwo} is:issue is:open label:"nanobots:built","nanobots:inbox"`))
    .map((i) => ({ nwo, number: i.number, title: i.title, url: i.html_url, stage: stageOf(i) }));

  return { nwo, needsYou, moving, heartbeat: await heartbeat(pat, nwo) };
}

// "Nothing is moving" and "the loop is dead" look identical from the outside. The pinned
// status issue is the loop's own heartbeat, so its last update is the honest signal.
export async function heartbeat(pat, nwo) {
  try {
    const [pinned] = await search(pat, `repo:${nwo} is:issue is:open in:title "Nanobots Status"`);
    if (!pinned) return null;
    return { url: pinned.html_url, number: pinned.number, updatedAt: pinned.updated_at };
  } catch {
    return null;
  }
}

export function ageLabel(iso) {
  if (!iso) return 'unknown';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
