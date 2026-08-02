#!/usr/bin/env node
// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
//
// Runs on the Actions runner. Never installs/executes PR-controlled dependencies, gates,
// or commands — that all happens inside the disposable Daytona sandbox this script
// provisions and always deletes. This script's own job: decide eligibility, hand a bounded
// input to the sandbox, and turn its structured result into GitHub state (thread replies,
// resolutions, the sticky autofix summary, and the next OCR round dispatch).
//
// Usage: ocr-autofix-controller.mjs <ocr-report.json>
// Env (see .nanobots/RUNTIMES.md "Autofix credential placement"):
//   GH_TOKEN                 same-repo scoped Actions token — read/write GitHub, AND the
//                             push credential injected into the sandbox's clone URL for
//                             this one run (never DAYTONA_API_KEY, never OCR_LLM_TOKEN)
//   DAYTONA_API_KEY           controller-only; never enters the sandbox
//   GH_REPOSITORY, GH_PR_NUMBER, GH_PR_IS_FORK, GH_PR_DRAFT, GH_PR_BASE_REF, GH_PR_HEAD_REF
//   OCR_AUTOFIX_ENABLED, OCR_AUTOFIX_MODEL/_URL/_EXTRA_BODY/_TOKEN (fixer, independent of
//     the OCR_LLM_* reviewer settings), OCR_AUTOFIX_MAX_ROUNDS/_MAX_FINDINGS/_MAX_FILES/
//     _MAX_CHANGED_LINES/_CONTEXT_LINES/_MAX_EXCERPT_CHARS/_INITIAL_CONCURRENCY/
//     _MAX_CONCURRENCY/_ADVISOR_CHECKPOINT_SIZE, OCR_AUTOFIX_VALIDATION_COMMAND

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  resolveAutofixModelConfig, validateModelConfig, parseBoundedInt, isProtectedPath, DEFAULT_PROTECTED_PATHS,
} from './ocr-autofix-lib.mjs';
import { createSandbox, execInSandbox, deleteSandbox, redact } from './daytona-client.mjs';

function sh(cmd, opts = {}) { return execSync(cmd, { encoding: 'utf8', ...opts }).trim(); }
function shTry(cmd, opts = {}) { try { return sh(cmd, opts); } catch { return null; } }
function shStdin(cmd, input) { return execSync(cmd, { encoding: 'utf8', input }).trim(); }
function shStdinTry(cmd, input) { try { return shStdin(cmd, input); } catch { return null; } }

const STATE_MARKER = '<!-- nanobots:ocr-responder-state:';
const NWO = process.env.GH_REPOSITORY;
const PR = process.env.GH_PR_NUMBER;

function log(msg) { console.log(`[ocr-autofix] ${msg}`); }

// ── round-state marker (idempotency + round cap) ────────────────────────────

function readRoundState() {
  const comments = shTry(`gh pr view ${PR} --repo ${NWO} --json comments --jq '.comments'`);
  if (!comments) return null;
  const list = JSON.parse(comments);
  const marker = [...list].reverse().find((c) => (c.body ?? '').startsWith(STATE_MARKER));
  if (!marker) return null;
  const b64 = marker.body.slice(STATE_MARKER.length).split('-->')[0].trim();
  try {
    return { commentId: marker.id, state: JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) };
  } catch {
    return null;
  }
}

function writeRoundState(existing, state) {
  const b64 = Buffer.from(JSON.stringify(state)).toString('base64url');
  const body = `${STATE_MARKER}${b64} -->\n### 🔧 OCR autofix — round ${state.round}/${state.maxRounds} — ${state.status}\n\n`
    + `- source head: \`${state.sourceSha}\`\n`
    + (state.resultSha ? `- repair commit: \`${state.resultSha}\`\n` : '')
    + `- model: ${state.model}\n`
    + `- dispositions: fixed ${state.totals.fixed}, false_positive ${state.totals.false_positive}, needs_human ${state.totals.needs_human}\n`
    + (state.validationSummary ? `- validation: ${state.validationSummary}\n` : '')
    + (state.sandboxId ? `- sandbox: \`${state.sandboxId}\` (deleted)\n` : '');
  if (existing?.commentId) {
    shStdin(`gh api repos/${NWO}/issues/comments/${existing.commentId} -X PATCH --input -`, JSON.stringify({ body }));
  } else {
    shStdin(`gh api repos/${NWO}/issues/${PR}/comments -X POST --input -`, JSON.stringify({ body }));
  }
}

// ── eligibility ──────────────────────────────────────────────────────────────

function checkEligibility(cfg, existingState, headSha) {
  if (process.env.GH_PR_IS_FORK === 'true') return { eligible: false, reason: 'fork PR — review only, never write' };
  if (process.env.GH_PR_DRAFT === 'true') return { eligible: false, reason: 'draft PR — waits until ready_for_review' };
  const labels = JSON.parse(shTry(`gh pr view ${PR} --repo ${NWO} --json labels --jq '.labels'`) || '[]').map((l) => l.name);
  if (!labels.includes('nanobots:built')) return { eligible: false, reason: 'not labeled nanobots:built' };
  // Guard the ref the responder actually WRITES — the PR head. It clones and pushes there
  // and never touches the base. Gating on the base made autofix dead code on every normal
  // repo: protectedBranches defaults to [main] and practically every PR targets main, so
  // the responder declined every PR it was ever offered while the docs described it working.
  const protectedBranches = cfg.mergePolicy?.protectedBranches ?? [main];
  const headRef = process.env.GH_PR_HEAD_REF;
  if (protectedBranches.includes(headRef)) {
    return { eligible: false, reason: `head ${headRef} is a protected branch — the responder would have to push to it` };
  }
  if (headRef && headRef === process.env.GH_PR_BASE_REF) {
    return { eligible: false, reason: 'head and base are the same ref' };
  }
  if (process.env.OCR_AUTOFIX_ENABLED !== 'true') return { eligible: false, reason: 'OCR_AUTOFIX_ENABLED is not true' };

  if (existingState?.state?.sourceSha === headSha && ['fixed', 'evaluated', 'validation_failed', 'blocked'].includes(existingState.state.status)) {
    return { eligible: false, reason: `this exact head (${headSha}) was already processed (idempotent skip)` };
  }
  // Precedence: explicit dispatch input handled by the workflow env already -> GH variable
  // -> repo-owned config.json policy -> safe rendered default.
  const maxRounds = parseBoundedInt(process.env.OCR_AUTOFIX_MAX_ROUNDS, { min: 1, max: 5, fallback: cfg.ocr?.maxRounds ?? 3 });
  const roundsSoFar = existingState?.state?.round ?? 0;
  if (roundsSoFar >= maxRounds) return { eligible: false, reason: `round cap reached (${roundsSoFar}/${maxRounds})` };

  return { eligible: true, maxRounds, round: roundsSoFar + 1 };
}

// ── GitHub thread reply/resolve ──────────────────────────────────────────────

function findReviewThreads() {
  const query = `query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{databaseId body}}}}}}}`;
  const out = shTry(`gh api graphql -f query='${query}' -f owner=${NWO.split('/')[0]} -f repo=${NWO.split('/')[1]} -F pr=${PR}`);
  if (!out) return [];
  try {
    return JSON.parse(out).data.repository.pullRequest.reviewThreads.nodes;
  } catch {
    return [];
  }
}

function replyAndResolveThreads(dispositions, resultSha) {
  const threads = findReviewThreads();
  for (const disp of dispositions) {
    if (!['fixed', 'false_positive'].includes(disp.disposition)) continue; // needs_human stays open
    const thread = threads.find((t) => (t.comments?.nodes?.[0]?.body ?? '').includes(disp.fingerprint));
    if (!thread || thread.isResolved) continue;
    const commentId = thread.comments.nodes[0].databaseId;
    const evidence = disp.disposition === 'fixed'
      ? `✅ Fixed in \`${resultSha?.slice(0, 12) ?? 'this round'}\`.${disp.reason ? ` ${disp.reason}` : ''}`
      : `ℹ️ False positive: ${disp.reason || 'no reason given'}`;
    shStdinTry(`gh api repos/${NWO}/pulls/${PR}/comments/${commentId}/replies -X POST --input -`, JSON.stringify({ body: evidence }));
    const resolveMutation = `mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}`;
    shTry(`gh api graphql -f query='${resolveMutation}' -f threadId=${thread.id}`);
  }
}

function dispatchNextRound() {
  // A GITHUB_TOKEN-authored push does not recursively trigger ordinary Actions workflows,
  // so the next round has to be dispatched explicitly. Idempotent: the eligibility check's
  // sourceSha/status comparison means a duplicate dispatch for the same head is a no-op.
  shTry(`gh workflow run nanobots-ocr.yml --repo ${NWO} -f pr_number=${PR} -f autofix=true`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [, , reportPath] = process.argv;
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const cfg = JSON.parse(readFileSync('.nanobots/config.json', 'utf8'));

  if (report.clean) { log('OCR is clean on this head — nothing for autofix to do.'); return; }

  const existingState = readRoundState();
  const elig = checkEligibility(cfg, existingState, report.headSha);
  if (!elig.eligible) { log(`not running autofix: ${elig.reason}`); return; }

  const modelCfg = resolveAutofixModelConfig(process.env);
  const validation = validateModelConfig(modelCfg);
  if (!validation.ok) {
    log(`autofix model config invalid: ${validation.errors.join('; ')}`);
    writeRoundState(existingState, {
      schemaVersion: 1, prNumber: Number(PR), sourceSha: report.headSha, round: elig.round, maxRounds: elig.maxRounds,
      status: 'blocked', totals: { fixed: 0, false_positive: 0, needs_human: 0 }, model: modelCfg.model,
      validationSummary: `config invalid: ${validation.errors.join('; ')}`,
    });
    return;
  }

  const gates = (process.env.OCR_AUTOFIX_VALIDATION_COMMAND || '').trim()
    ? [process.env.OCR_AUTOFIX_VALIDATION_COMMAND.trim()]
    : (cfg.gates ?? []);
  const protectedPaths = [...DEFAULT_PROTECTED_PATHS, ...(cfg.ocr?.autofix?.protectedPaths ?? [])];
  const caps = {
    maxFindings: parseBoundedInt(process.env.OCR_AUTOFIX_MAX_FINDINGS, { min: 1, max: 500, fallback: 80 }),
    maxFiles: parseBoundedInt(process.env.OCR_AUTOFIX_MAX_FILES, { min: 1, max: 200, fallback: 20 }),
    maxChangedLines: parseBoundedInt(process.env.OCR_AUTOFIX_MAX_CHANGED_LINES, { min: 1, max: 5000, fallback: 250 }),
    contextLines: parseBoundedInt(process.env.OCR_AUTOFIX_CONTEXT_LINES, { min: 1, max: 1000, fallback: 80 }),
    maxExcerptChars: parseBoundedInt(process.env.OCR_AUTOFIX_MAX_EXCERPT_CHARS, { min: 500, max: 200000, fallback: 24000 }),
  };
  const concurrency = {
    initial: parseBoundedInt(process.env.OCR_AUTOFIX_INITIAL_CONCURRENCY, { min: 1, max: 32, fallback: 3 }),
    max: parseBoundedInt(process.env.OCR_AUTOFIX_MAX_CONCURRENCY, { min: 1, max: 32, fallback: 8 }),
    checkpointSize: parseBoundedInt(process.env.OCR_AUTOFIX_ADVISOR_CHECKPOINT_SIZE, { min: 1, max: 50, fallback: 2 }),
  };

  const input = {
    headSha: report.headSha,
    headRef: process.env.GH_PR_HEAD_REF,
    defaultBranch: cfg.defaultBranch,
    findings: report.findings.filter((f) => !isProtectedPath(f.file, protectedPaths)),
    protectedPaths,
    gates,
    caps,
    model: { url: modelCfg.url, model: modelCfg.model, extraBodyRaw: modelCfg.extraBodyRaw },
    concurrency,
  };

  const daytonaKey = process.env.DAYTONA_API_KEY;
  if (!daytonaKey) { log('DAYTONA_API_KEY not set — cannot run autofix.'); return; }
  const daytona = cfg.daytona ?? {};

  let sandboxId;
  let result;
  try {
    log(`provisioning remediation sandbox for PR #${PR} round ${elig.round}...`);
    sandboxId = await createSandbox(daytonaKey, {
      labels: { owner: cfg.owner, repo: cfg.repo, pr: String(PR), purpose: 'ocr-autofix', round: String(elig.round) },
      snapshot: daytona.snapshot, target: daytona.target, autoDeleteInterval: 30,
    });

    // Authenticate via a credential helper reading the token from the ENVIRONMENT, never from
    // the clone URL. An embedded credential is written straight into .git/config as
    // remote.origin.url, where the repair run's own gate commands can read it. The helper
    // script holds only an env var NAME, so it carries no secret itself.
    const helper = `git config --global credential.helper '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'`;
    const helperRes = await execInSandbox(daytonaKey, sandboxId, helper, { timeout: 60 });
    if (helperRes.exitCode !== 0) throw new Error('failed to configure the git credential helper');

    const cloneCmd = `git clone --branch ${input.headRef} https://github.com/${NWO}.git repo`;
    const clone = await execInSandbox(daytonaKey, sandboxId, cloneCmd, { timeout: 300, env: { GH_TOKEN: process.env.GH_TOKEN } });
    if (clone.exitCode !== 0) throw new Error('clone into remediation sandbox failed');

    // Same assertion the worker makes: verify the credential did not survive the clone.
    const gitCfg = await execInSandbox(daytonaKey, sandboxId, 'git config --local --list', { cwd: 'repo', timeout: 60 });
    if ((gitCfg.result ?? '').includes(process.env.GH_TOKEN)) {
      throw new Error('SECURITY: the push token was persisted into .git/config inside the remediation sandbox — refusing to continue');
    }

    const writeInput = await execInSandbox(daytonaKey, sandboxId, `cat > repo/.nanobots/autofix-input.json <<'NANOBOTS_INPUT_EOF'\n${JSON.stringify(input)}\nNANOBOTS_INPUT_EOF`, { timeout: 60 });
    if (writeInput.exitCode !== 0) throw new Error('failed to write bounded input into the sandbox');

    const run = await execInSandbox(daytonaKey, sandboxId, 'node .nanobots/ocr-autofix-worker.mjs .nanobots/autofix-input.json', {
      cwd: 'repo',
      timeout: 60 * 30,
      env: { OCR_AUTOFIX_TOKEN_RESOLVED: modelCfg.token },
    });
    const lastLine = (run.result ?? '').trim().split('\n').filter(Boolean).pop();
    try { result = JSON.parse(lastLine); } catch { result = { status: 'blocked', reason: `unparseable worker output: ${redact(run.result ?? '')}` }; }
  } catch (err) {
    result = { status: 'blocked', reason: redact(err.message) };
  } finally {
    if (sandboxId) await deleteSandbox(daytonaKey, sandboxId, { onWarn: log });
  }

  const dispositions = result.dispositions ?? [];
  const totals = {
    fixed: dispositions.filter((d) => d.disposition === 'fixed').length,
    false_positive: dispositions.filter((d) => d.disposition === 'false_positive').length,
    needs_human: dispositions.filter((d) => d.disposition === 'needs_human').length,
  };

  const state = {
    schemaVersion: 1, prNumber: Number(PR), sourceSha: report.headSha, resultSha: result.commitSha ?? null,
    round: elig.round, maxRounds: elig.maxRounds, status: result.status, totals, model: modelCfg.model,
    validationSummary: result.gateResults?.find((g) => !g.ok)
      ? `failed: ${result.gateResults.find((g) => !g.ok).gate}`
      : (result.reason ? redact(result.reason, { limit: 300 }) : (result.gateResults?.length ? 'gates passed' : undefined)),
    sandboxId,
  };

  if (result.status === 'fixed') {
    log(`re-verifying pushed head before declaring success...`);
    const currentHead = shTry(`gh api repos/${NWO}/pulls/${PR} --jq .head.sha`);
    if (currentHead !== result.commitSha) {
      log(`WARNING: PR head is ${currentHead}, expected the pushed commit ${result.commitSha} — not resolving threads yet, next OCR run will re-evaluate the actual current head.`);
    } else {
      replyAndResolveThreads(dispositions, result.commitSha);
      dispatchNextRound();
    }
  }

  writeRoundState(existingState, state);
  log(`round ${elig.round}/${elig.maxRounds} complete: ${result.status} (fixed ${totals.fixed}, false_positive ${totals.false_positive}, needs_human ${totals.needs_human})`);
}

await main();
