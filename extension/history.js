import { getConfig, getFiledIssues, hydrateIssueState } from './gh.js';
import { ageLabel } from './loop.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── in-flight view ───────────────────────────────────────────────────────────
// Renders whatever the background poll last stored. It never fetches on its own: the poll is
// the single place that talks to GitHub, so opening this page ten times costs nothing and the
// badge and the page can never disagree.

// A loop whose last cycle was hours ago is not "quiet", it is probably not running. Actions
// crons are ~hourly, so half a day of silence is the point where it is worth saying so.
const STALE_HOURS = 12;

function renderLive(state) {
  if (!state) {
    $('beats').innerHTML = '<div class="beat">No scan yet — the first one runs a few seconds after install.</div>';
    return;
  }

  $('beats').innerHTML = (state.repos || []).map((r) => {
    if (!r.heartbeat) {
      return `<div class="beat">${esc(r.nwo)} — <b>no status issue found</b> (is the loop installed?)</div>`;
    }
    const hrs = (Date.now() - new Date(r.heartbeat.updatedAt).getTime()) / 3600000;
    const stale = hrs > STALE_HOURS;
    return `<div class="beat${stale ? ' stale' : ''}">${esc(r.nwo)} — last cycle
      <a href="${esc(r.heartbeat.url)}" target="_blank"><b>${esc(ageLabel(r.heartbeat.updatedAt))}</b></a>${
      stale ? ' · nothing for a while, check the crons are enabled' : ''}</div>`;
  }).join('') || '<div class="beat">No repos with a loop installed yet.</div>';

  const needs = state.needsYou || [];
  $('needs').innerHTML = needs.length
    ? needs.map((i) => `
      <div class="card blocked" id="i-${esc(i.nwo)}-${i.number}">
        <div class="why">${esc(i.why)}</div>
        <div class="t"><a href="${esc(i.url)}" target="_blank">${esc(i.nwo)}#${i.number}</a> — ${esc(i.title)}</div>
        <div class="acts">
          <a href="${esc(i.url)}" target="_blank">open issue ↗</a>
          <a href="chat.html?issue=${encodeURIComponent(`${i.nwo}#${i.number}`)}">chat about it</a>
          ${i.hash ? `<span class="pill">approve: /nanobots start ${esc(i.hash)}</span>` : ''}
        </div>
      </div>`).join('')
    : '<div class="allclear">✓ nothing is waiting on you</div>';

  const moving = state.repos?.flatMap((r) => r.moving || []) ?? [];
  $('moving').innerHTML = moving.length
    ? moving.map((i) => `<div style="margin-bottom:6px">
        <span class="pill">${esc(i.stage)}</span>
        <a href="${esc(i.url)}" target="_blank">${esc(i.nwo)}#${i.number}</a> — ${esc(i.title)}</div>`).join('')
    : '<div>Nothing in flight.</div>';

  // Arriving from a notification: scroll to and highlight the item it was about. ONCE —
  // renderLive re-runs on every poll, and yanking the viewport back every 10 minutes on a page
  // someone deliberately left open would be maddening.
  const focus = new URLSearchParams(location.hash.slice(1)).get('focus');
  if (focus && !focusDone) {
    const el = document.getElementById(`i-${focus.replace('#', '-')}`);
    if (el) { el.classList.add('row-focus'); el.scrollIntoView({ block: 'center' }); focusDone = true; }
  }
}
let focusDone = false;

(async function live() {
  let loopState;
  try {
    ({ loopState } = await chrome.storage.local.get('loopState'));
  } catch {
    // Extension context invalidated — reloaded or updated while this page was open.
    document.getElementById('beats').innerHTML =
      '<div class="beat">Extension was reloaded — refresh this page.</div>';
    return;
  }
  renderLive(loopState);
  // Repaint when the next poll lands, so a page left open stays truthful.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.loopState) renderLive(changes.loopState.newValue);
  });
  // Ask for a refresh, but only if the stored scan is actually stale. Without this, opening
  // the dashboard N times asks for N scans — which contradicted the comment above claiming
  // this page is free to open. The background side also de-dupes concurrent runs.
  const STALE_MS = 2 * 60 * 1000;
  if (!loopState || Date.now() - (loopState.at || 0) > STALE_MS) {
    chrome.runtime.sendMessage({ kind: 'nanobots-poll-now' }).catch(() => {});
  }
})();

// ── what you filed from this browser ─────────────────────────────────────────

(async function boot() {
  const filed = await getFiledIssues();
  if (filed.length === 0) {
    $('empty').hidden = false;
    return;
  }
  $('table').hidden = false;
  $('count').textContent = `${filed.length} report${filed.length === 1 ? '' : 's'} filed from this browser — refreshing live state…`;

  const render = (entries) => {
    $('rows').innerHTML = entries.map((e) => `
      <tr>
        <td><a href="${esc(e.url)}" target="_blank">${esc(e.nwo)}#${e.number}</a><br>${esc(e.title)}</td>
        <td>${e.type === 'bug' ? '🐛 bug' : '💡 feature'}</td>
        <td class="state-${e.state ?? 'open'}">${e.state ?? '…'}${e.comments ? ` · ${e.comments}💬` : ''}
          ${e.labels?.length ? `<div class="labels">${e.labels.map(esc).join(', ')}</div>` : ''}</td>
        <td>${e.page === '(chat)' ? '<span class="dim">via chat</span>' : `<a href="${esc(e.page)}" target="_blank">${esc(new URL(e.page).pathname)}</a>`}</td>
        <td class="dim">${e.filedAt.slice(0, 10)}</td>
      </tr>`).join('');
  };
  render(filed);

  const cfg = await getConfig();
  if (cfg.pat || Object.keys(cfg.patByOwner ?? {}).length) {
    const live = await hydrateIssueState(cfg, filed);
    render(live);
    $('count').textContent = `${filed.length} report${filed.length === 1 ? '' : 's'} filed from this browser · ${live.filter((e) => e.state === 'open').length} still open`;
  }
})();
