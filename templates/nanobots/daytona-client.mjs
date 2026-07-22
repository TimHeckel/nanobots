#!/usr/bin/env node
// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
//
// Shared Daytona lifecycle helpers — sandbox create/exec/delete and log redaction.
// Imported by daytona-worker.mjs (build sandbox) and ocr-autofix-controller.mjs
// (remediation sandbox). Only ever import DAYTONA_API_KEY-holding code from here on the
// controller side; nothing in this file is meant to run inside a sandbox.
//
// ASSUMPTIONS ON THE DAYTONA REST API: calls the endpoints documented at
// https://www.daytona.io/docs/en/typescript-sdk/ as of this template's authoring. Run
// `npx nanobots-sh verify daytona` before relying on this in production — if a request
// shape has drifted, the fix belongs in this file only.

const DAYTONA_API = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';

export async function daytonaApi(apiKey, method, path, body) {
  const res = await fetch(`${DAYTONA_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Daytona API ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function createSandbox(apiKey, { labels, snapshot, target, autoStopInterval = 15, autoDeleteInterval = 60 } = {}) {
  const body = {
    snapshot: snapshot || undefined,
    target: target || 'us',
    labels,
    autoStopInterval,
    autoDeleteInterval,
  };
  const sandbox = await daytonaApi(apiKey, 'POST', '/sandbox', body);
  return sandbox.id;
}

export async function execInSandbox(apiKey, sandboxId, command, { cwd, timeout = 900, env } = {}) {
  const result = await daytonaApi(apiKey, 'POST', `/sandbox/${sandboxId}/toolbox/process/execute`, {
    command, cwd, timeout, env,
  });
  return result; // { exitCode, result: <stdout+stderr> }
}

// Returns true on confirmed deletion, false if there was nothing to delete or deletion
// failed (provider auto-delete is a backstop, not a substitute for checking this).
export async function deleteSandbox(apiKey, sandboxId, { onWarn } = {}) {
  if (!sandboxId) return false;
  try {
    await daytonaApi(apiKey, 'DELETE', `/sandbox/${sandboxId}`);
    return true;
  } catch (err) {
    (onWarn ?? (() => {}))(`sandbox ${sandboxId} delete failed: ${err.message} — check the Daytona dashboard, provider auto-delete is a backstop only.`);
    return false;
  }
}

// Redact anything that looks like a credential before it ever reaches a GitHub comment
// or log. Applied to every piece of sandbox output before it's surfaced anywhere.
export function redact(text, { limit = 4000 } = {}) {
  return (text ?? '')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '[redacted-github-token]')
    .replace(/(authorization|bearer|cookie|x-api-key)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .replace(/https?:\/\/[^\s"']*[?&](?:sig|signature|token|key)=[^\s"'&]*/gi, (m) => m.split(/[?&](?:sig|signature|token|key)=/i)[0] + '[redacted-signed-url]')
    .slice(0, limit);
}
