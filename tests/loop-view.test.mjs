// The extension's read-only view of loop state.
//
// The load-bearing part is approvalState(): it decides whether the badge says "this is blocked
// on you". It re-implements, in the browser, the decision daytona-worker.mjs makes on the
// runner. If the two ever disagree the dashboard lies in one of two directions — nagging about
// work already approved, or staying silent while the loop sits blocked forever. So this
// asserts the behaviour AND that the two regexes are literally the same as the worker's.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'extension');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

globalThis.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
const { approvalState, stageOf, ageLabel, PLAN_MARKER, APPROVAL_LINE } =
  await import(pathToFileURL(join(EXT, 'loop.js')).href);

const plan = (h) => ({ body: `Plan ready\n\nscope…\n\n<!-- nanobots:plan issue=7 hash=${h} -->` });
const approve = (h, extra = '') => ({ body: `${extra}${extra ? '\n' : ''}/nanobots start ${h}` });

// ── the basics ───────────────────────────────────────────────────────────────
ok(approvalState([]).awaiting === false, 'no comments at all is not "awaiting approval"');
ok(approvalState([{ body: 'just chatting' }]).planned === false, 'an unplanned issue is not awaiting');
ok(approvalState([plan('a1b2c3d4e5f6')].concat()).awaiting === true, 'a plan with no approval IS awaiting');
ok(approvalState([plan('a1b2c3d4e5f6'), approve('a1b2c3d4e5f6')]).awaiting === false, 'a matching approval clears it');

// ── THE bug this protocol exists to prevent ──────────────────────────────────
// The loop's own plan comment tells the human to approve with `/nanobots start <hash>`. Read
// unanchored, that sentence approves the item the loop just planned — which turned the human
// gate into decoration until the worker anchored the match to a whole line.
const chatty = { body: 'To approve this, reply with `/nanobots start a1b2c3d4e5f6` in a comment.' };
ok(approvalState([plan('a1b2c3d4e5f6'), chatty]).awaiting === true,
  'the command mentioned INSIDE a sentence does not approve anything');
ok(approvalState([plan('a1b2c3d4e5f6'), approve('a1b2c3d4e5f6', 'looks good to me')]).awaiting === false,
  'a human may add commentary on other lines and still approve');

// ── staleness: a revised plan needs a fresh approval ─────────────────────────
ok(approvalState([plan('aaaaaaaaaaaa'), approve('aaaaaaaaaaaa'), plan('bbbbbbbbbbbb')]).awaiting === true,
  'a NEW plan after an approval is awaiting again (the approval was for the old hash)');
ok(approvalState([plan('aaaaaaaaaaaa'), approve('aaaaaaaaaaaa'), plan('bbbbbbbbbbbb')]).hash === 'bbbbbbbbbbbb',
  'the LAST plan hash is the one reported');
ok(approvalState([plan('bbbbbbbbbbbb'), approve('aaaaaaaaaaaa')]).awaiting === true,
  'an approval carrying a stale hash does not count');
ok(approvalState([approve('a1b2c3d4e5f6'), plan('a1b2c3d4e5f6')]).awaiting === true,
  'an approval BEFORE the plan does not count');

// ── the regexes must be the worker's, character for character ────────────────
const worker = readFileSync(join(ROOT, 'templates', 'nanobots', 'daytona-worker.mjs'), 'utf8');
const wPlan = worker.match(/const m = cmt\.body\?\.match\((\/.*?\/)\);/);
const wAppr = worker.match(/const m = comments\[i\]\.body\?\.match\((\/.*?\/m)\);/);
ok(wPlan && wPlan[1] === PLAN_MARKER.toString(),
  `plan marker matches the worker's (worker: ${wPlan?.[1]} / view: ${PLAN_MARKER})`);
ok(wAppr && wAppr[1] === APPROVAL_LINE.toString(),
  `approval regex matches the worker's (worker: ${wAppr?.[1]} / view: ${APPROVAL_LINE})`);
ok(APPROVAL_LINE.toString().startsWith('/^'), 'the approval regex is anchored to a line start');

// ── stage rendering ──────────────────────────────────────────────────────────
const iss = (labels, state = 'open') => ({ state, labels: labels.map((name) => ({ name })) });
ok(stageOf(iss([], 'closed')) === 'done', 'a closed issue is done');
ok(stageOf(iss(['nanobots:inbox'])) === 'inbox', 'inbox label → inbox');
ok(stageOf(iss(['nanobots:built'])) === 'in review', 'built label → in review');
ok(stageOf(iss(['needs-info'])) === 'needs info', 'needs-info label → needs info');
ok(stageOf(iss([])) === 'triaged', 'an open issue with no nanobots label is triaged');
ok(stageOf({ state: 'open', labels: ['nanobots:built'] }) === 'in review',
  'labels as plain strings work too (search and issues APIs differ)');

// ── age labels ───────────────────────────────────────────────────────────────
ok(ageLabel(null) === 'unknown', 'a missing timestamp is "unknown", never "0m ago"');
ok(/^\d+m ago$/.test(ageLabel(new Date(Date.now() - 5 * 60000).toISOString())), 'minutes under an hour');
ok(/^\d+h ago$/.test(ageLabel(new Date(Date.now() - 5 * 3600000).toISOString())), 'hours under two days');
ok(/^\d+d ago$/.test(ageLabel(new Date(Date.now() - 5 * 86400000).toISOString())), 'days beyond that');

// ── notification routing: the link has to work where it lands ────────────────
const notify = readFileSync(join(EXT, 'notify.js'), 'utf8');
ok(/Click: item\.url/.test(notify),
  'ntfy links to the GitHub issue — a chrome-extension:// URL is a dead tap on a phone');
ok(/dashboardUrl = \(item\) =>\s*\n?\s*chrome\.runtime\.getURL/.test(notify),
  'the Chrome notification links to the extension dashboard, where the chat lives');
ok(/\$\{i\.hash \|\| ''\}/.test(notify) || /i\.hash/.test(notify),
  'the dedupe key includes the plan hash, so a REVISED plan re-notifies');

// ── the poll must not scan every repo a token can reach ──────────────────────
const bg = readFileSync(join(EXT, 'background.js'), 'utf8');
const pollFn = bg.slice(bg.indexOf('async function runPoll()'), bg.indexOf('function setBadge'));
ok(/repoHasLoop/.test(pollFn) && /withLoop\.push\(nwo\)/.test(pollFn) && /for \(const nwo of withLoop\)/.test(pollFn),
  'only repos that actually run a loop are scanned (a 94-repo token must not be swept)');
ok(pollFn.indexOf('repoHasLoop') < pollFn.indexOf('scanRepo'),
  'the has-a-loop filter runs BEFORE any scan, not after');
ok(/setBadge\(needsYou\.length\)/.test(bg), 'the badge counts exactly the blocked items');
ok(/if \(!live\.has\(k\)\) delete notified\[k\]/.test(bg),
  'a resolved item is forgotten, so the same issue blocking again re-notifies');
// Two triggers (alarm + dashboard) both read `notified` then write it; overlapping runs lose
// writes and re-notify. Flagged by OCR on PR #17.
ok(/let inFlight = null/.test(bg) && /inFlight = runPoll\(\)\.finally/.test(bg),
  'concurrent polls join the run already in flight instead of racing');
ok(/poll\(\)\.catch\(/.test(bg),
  'the alarm-triggered poll catches, so a rejection cannot silently kill the whole cycle');

// ── declared permissions ─────────────────────────────────────────────────────
const mf = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
ok(mf.permissions.includes('alarms'), 'alarms permission declared (the poll needs it)');
ok(mf.permissions.includes('notifications'), 'notifications permission declared');
ok(mf.host_permissions.includes('https://ntfy.sh/*'), 'ntfy.sh declared as a fixed host');
ok(!mf.host_permissions.some((h) => h === '<all_urls>' || h === '*://*/*'),
  'still a fixed host list, never a wildcard');

// ── repo-side push: the loop notifies the moment it blocks ──────────────────
// The extension polls every 10 minutes from a browser that has to be open. The workflow fires
// on GitHub's own events, needs no browser, and cannot be forgotten by an agent.
{
  const wf = readFileSync(join(ROOT, 'templates', 'github', 'workflows', 'nanobots-notify.yml'), 'utf8');
  ok(/vars\.NTFY_TOPIC != ''/.test(wf),
    'the whole workflow is inert until NTFY_TOPIC is set — installing it costs an unconfigured repo nothing');
  ok(/types: \[labeled\]/.test(wf) && /types: \[created\]/.test(wf),
    'triggers on the label landing and on a comment, not on a timer');
  ok(/github\.event\.label\.name == '\{\{HUMAN_LABEL\}\}'/.test(wf),
    'uses the repo/s OWN human-gate label, which is configurable at install time');
  // The loop's prose explains the approval command constantly; notifying on that would cry
  // wolf until the alerts get muted, which is worse than no alerts.
  ok(/grep -oE '<!--\[\[:space:\]\]\*nanobots:plan/.test(wf),
    'a plan push requires a REAL marker, not prose that mentions the protocol');
  ok(/Click: \$\{ISSUE_URL\}/.test(wf), 'the push links to the GitHub issue (opened on a phone)');
  ok(/--fail-with-body/.test(wf), 'a rejected push fails loudly instead of silently pretending to cover you');
  ok(/\$\{NTFY_ACCESS_TOKEN:\+/.test(wf), 'the auth header is omitted entirely for a public topic');
  ok(!/secrets\.NTFY_ACCESS_TOKEN[^}]*\}\}"?\s*$/m.test(wf.split('run:')[1] || ''),
    'the token is passed via env, never interpolated into the run script');
}

// ── onboarding walks the user through it ─────────────────────────────────────
{
  const cli = readFileSync(join(ROOT, 'src', 'cli.mjs'), 'utf8');
  ok(/F2\. OPTIONAL PHONE PUSH/.test(cli), 'init has a dedicated ntfy step');
  ok(/set_variable NTFY_TOPIC/.test(cli), 'the step sets NTFY_TOPIC, which is the on switch');
  ok(/ONLY thing keeping strangers out/.test(cli),
    'the step is honest that a public topic name is the only access control');
  ok(/OFFER TO GENERATE ONE/.test(cli), 'it offers to generate an unguessable topic rather than let someone type "nanobots"');
  ok(/subscribe to it in the app BEFORE continuing/.test(cli),
    'it has them subscribe before the test, or the test push lands nowhere');
  ok(cli.indexOf('F2. OPTIONAL PHONE PUSH') < cli.indexOf('G. CRONS'),
    'it runs before the crons step, while setup context is still fresh');
}

// ── the workflow's shell grep must accept exactly what the JS regex accepts ──
// A shell script cannot import the JS regex, so the marker pattern exists three times: the
// worker, loop.js, and this workflow. OCR flagged the duplication; the mitigation is to make
// divergence fail here rather than silently stop notifying.
{
  const wf = readFileSync(join(ROOT, 'templates', 'github', 'workflows', 'nanobots-notify.yml'), 'utf8');
  const grepPat = wf.match(/grep -oE '(<!--\[\[:space:\]\]\*nanobots:plan[^']*)'/)?.[1];
  ok(Boolean(grepPat), 'the workflow greps for the plan marker');
  if (grepPat) {
    // POSIX ERE → JS: [[:space:]] is the only class used, and it maps to \s.
    const asJs = new RegExp(grepPat.replace(/\[\[:space:\]\]/g, '\\s'));
    const cases = [
      ['<!-- nanobots:plan issue=7 hash=a1b2c3d4e5f6 -->', true, 'the canonical marker'],
      ['<!--nanobots:plan issue=7 hash=a1b2c3d4e5f6-->', true, 'no surrounding spaces'],
      ['<!--  nanobots:plan   issue=42   hash=0123456789ab  -->', true, 'extra whitespace'],
      ['<!-- nanobots:plan issue=7 hash=SHORT -->', false, 'a non-hex hash'],
      ['<!-- nanobots:plan issue=7 hash=a1b2c3d4e5f -->', false, 'an 11-char hash'],
      ['reply with /nanobots start a1b2c3d4e5f6 to approve', false, 'prose, not a marker'],
      ['see the nanobots:plan docs', false, 'a bare mention of the protocol'],
    ];
    for (const [input, want, label] of cases) {
      const shellSays = asJs.test(input);
      const jsSays = PLAN_MARKER.test(input);
      ok(shellSays === want, `workflow grep: ${label} → ${want ? 'match' : 'no match'}`);
      ok(shellSays === jsSays, `workflow grep AGREES with the JS regex on: ${label}`);
    }
  }
}

// ── the HIGH finding from OCR on PR #17 ──────────────────────────────────────
// `curl -d` reads a body starting with @ as a FILENAME and POSTs its contents. BODY is the
// issue title, which anyone able to open an issue controls, so an issue titled `@/etc/passwd`
// exfiltrated that file to the ntfy topic the moment it was labelled.
{
  const wf = readFileSync(join(ROOT, 'templates', 'github', 'workflows', 'nanobots-notify.yml'), 'utf8');
  ok(/--data-raw "\$\{BODY\}"/.test(wf), 'the body is sent with --data-raw');
  ok(!/[^-]-d "\$\{BODY\}"/.test(wf), 'never plain -d, which would read @filename off the runner');
  ok(/permissions: \{\}/.test(wf), 'the job requests no token — it never calls the GitHub API');
}

// ── second OCR round on PR #17 ───────────────────────────────────────────────
{
  const wf = readFileSync(join(ROOT, 'templates', 'github', 'workflows', 'nanobots-notify.yml'), 'utf8');
  // A plan marker is just text. On a public repo anyone could comment a forged one and push
  // whatever they liked to the owner's phone.
  ok(/author_association/.test(wf) && /OWNER","MEMBER","COLLABORATOR/.test(wf),
    'only people who could actually approve work can trigger the approval alert');
  // The topic IS the access control on the public server, and workflow logs are readable.
  ok(!/echo "pushed to \$\{SERVER\}\/\$\{NTFY_TOPIC\}"/.test(wf),
    'the topic is never printed to the workflow log');
  // A blanket `|| true` swallowed real failures as well as grep's expected no-match.
  ok(!/\|\| true\)/.test(wf), 'no blanket `|| true` masking real pipeline failures');

  const bgSrc = readFileSync(join(EXT, 'background.js'), 'utf8');
  ok(/FIRST_POLL_MINUTES = 0\.5/.test(bgSrc),
    'the first-poll delay is >= Chrome/s 30s alarm floor, so the code does not claim a delay it cannot get');
  ok(/notified: \{\}/.test(bgSrc),
    'clearing the repo list clears derived state too, so re-adding one cannot suppress its first alert');

  // The warning has to come AFTER resetForRepo, which wipes the log.
  const chatSrc = readFileSync(join(EXT, 'chat.js'), 'utf8');
  ok(chatSrc.indexOf('await resetForRepo()') < chatSrc.indexOf("isn't in your configured repos"),
    'the unconfigured-repo warning survives resetForRepo clearing the log');
}

// ── third OCR round ──────────────────────────────────────────────────────────
{
  const wf = readFileSync(join(ROOT, 'templates', 'github', 'workflows', 'nanobots-notify.yml'), 'utf8');
  // A marker copied from another issue would produce an alert naming THIS issue while quoting
  // an approval hash belonging to a different one — a command that cannot work.
  ok(/MARKER_ISSUE/.test(wf) && /"\$MARKER_ISSUE" != "\$ISSUE_NUM"/.test(wf),
    'a plan marker whose issue=N does not match the issue it was posted on is rejected');

  const bgSrc = readFileSync(join(EXT, 'background.js'), 'utf8');
  // repoHasLoop returns null for "couldn't tell" (401/403/rate limit/offline). Treating that
  // as "no loop" cleared the badge and reported all-clear during an outage — silence in the
  // one situation where silence is harmful.
  ok(/inconclusive\+\+/.test(bgSrc), 'an undeterminable repo is counted, not silently dropped');
  ok(/withLoop\.length === 0 && inconclusive > 0/.test(bgSrc),
    'a wholly inconclusive round leaves the previous badge alone instead of claiming all-clear');

  const chatSrc = readFileSync(join(EXT, 'chat.js'), 'utf8');
  ok(/toLowerCase\(\) === parsed\[1\]\.toLowerCase\(\)/.test(chatSrc),
    'owner/repo is matched case-insensitively, as GitHub treats it');
}

if (fails.length) {
  console.error(`\n${fails.length} FAILED:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} loop-view tests passed`);
