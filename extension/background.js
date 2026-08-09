// Module service worker: owns capture + all network (MV3 content scripts are
// subject to the page's CORS, so GitHub/R2 calls must happen here).
import { getConfig, createIssue, logFiledIssue, tokenFor, repoHasLoop } from './gh.js';
import { uploadToR2, r2Configured } from './storage.js';
import { scanRepo } from './loop.js';
import { notifyChrome, notifyNtfy, itemKey } from './notify.js';

// ── watching in-flight work ──────────────────────────────────────────────────
// A badge is the one thing this can do that a Projects board cannot: tell you something is
// blocked without being looked at. Only the two hard stops count — an escalation, and a plan
// nobody has approved. Both mean the loop has stopped and is waiting on a person.

const POLL_ALARM = 'nanobots-poll';
const POLL_MINUTES = 10;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES, delayInMinutes: 0.2 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES, delayInMinutes: 0.2 });
});
chrome.alarms.onAlarm.addListener((a) => {
  // .catch: an unhandled rejection in a service worker kills the whole poll silently.
  if (a.name === POLL_ALARM) poll().catch((e) => console.warn('[nanobots] poll failed:', e?.message));
});

// Two things start a poll — the alarm, and the dashboard asking for a refresh — and they read
// `notified` at the start and write it at the end. Overlapping runs therefore lose each
// other's writes and re-notify about the same blocked item. One in-flight run at a time; a
// concurrent caller joins the run already going rather than starting a second.
let inFlight = null;
function poll() {
  if (!inFlight) inFlight = runPoll().finally(() => { inFlight = null; });
  return inFlight;
}

async function runPoll() {
  const cfg = await getConfig();
  if (!cfg.repos?.length) return setBadge(0);

  // Only repos that actually run a loop. Scanning the other ~90 a token can reach would burn
  // rate limit to learn nothing — repoHasLoop is cached, so this is close to free.
  const withLoop = [];
  for (const nwo of cfg.repos) {
    if ((await repoHasLoop(tokenFor(cfg, nwo), nwo).catch(() => null)) === true) withLoop.push(nwo);
  }

  const results = [];
  for (const nwo of withLoop) {
    try { results.push(await scanRepo(cfg, nwo)); } catch { /* one bad repo must not sink the poll */ }
  }

  const needsYou = results.flatMap((r) => r.needsYou);
  setBadge(needsYou.length);

  await chrome.storage.local.set({
    loopState: { at: Date.now(), repos: results, needsYou },
  });

  // Notify only on things not already announced, so a 10-minute poll doesn't re-alert every
  // 10 minutes about the same blocked item.
  const { notified = {} } = await chrome.storage.local.get('notified');
  const fresh = needsYou.filter((i) => !notified[itemKey(i)]);
  for (const item of fresh) {
    await notifyChrome(item);
    await notifyNtfy(cfg, item);
    notified[itemKey(item)] = Date.now();
  }
  // Forget items that are no longer blocked, so the same issue blocking AGAIN later re-alerts.
  const live = new Set(needsYou.map(itemKey));
  for (const k of Object.keys(notified)) if (!live.has(k)) delete notified[k];
  await chrome.storage.local.set({ notified });
}

function setBadge(n) {
  chrome.action.setBadgeText({ text: n ? String(n) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#f87171' });
  chrome.action.setTitle({ title: n ? `nanobots — ${n} item${n === 1 ? '' : 's'} need you` : 'nanobots' });
}

chrome.notifications.onClicked.addListener(async (id) => {
  const { notifyTargets = {} } = await chrome.storage.local.get('notifyTargets');
  const t = notifyTargets[id];
  if (t) chrome.tabs.create({ url: t.dashboard });
  chrome.notifications.clear(id);
});

chrome.action.onClicked.addListener(async (tab) => {
  let shot = null;
  try {
    // Capture BEFORE injecting anything so the overlay is never in the shot.
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch { /* chrome:// pages etc. */ }

  const cfg = await getConfig();
  const { lastRepo = '' } = await chrome.storage.local.get('lastRepo');
  const payload = {
    kind: 'nanobots-open',
    shot,
    url: tab.url ?? '',
    title: tab.title ?? '',
    repos: cfg.repos,
    lastRepo,
    r2on: r2Configured(cfg.r2),
    configured: Boolean((cfg.pat || Object.keys(cfg.patByOwner ?? {}).length) && cfg.repos.length),
  };

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch (e) {
    // Content scripts can't run here (chrome://, web store, pdf viewer…) —
    // fall back to the annotate tab. Keep the reason visible for debugging.
    console.warn('[nanobots] overlay unavailable, falling back to tab:', e?.message, tab.url);
    await chrome.storage.session.set({
      pending: {
        shot, url: tab.url ?? '', title: tab.title ?? '',
        capturedAt: new Date().toISOString(),
        fallbackReason: e?.message ?? 'unknown',
      },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL('annotate.html') });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.kind === 'nanobots-file') {
    fileReport(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // async response
  }
  if (msg.kind === 'nanobots-open-page') {
    chrome.tabs.create({ url: chrome.runtime.getURL(msg.page) });
  }
  if (msg.kind === 'nanobots-open-options') {
    chrome.runtime.openOptionsPage();
  }
  // The dashboard's refresh button, and the options page after a config change.
  if (msg.kind === 'nanobots-poll-now') {
    poll().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

async function fileReport({ nwo, title, note, type, image, page, pageTitle }) {
  const cfg = await getConfig();
  const pat = tokenFor(cfg, nwo);
  if (!pat || !nwo) throw new Error('Missing token or repo — open options first.');

  let imageMd = '';
  if (image && r2Configured(cfg.r2)) {
    imageMd = `\n\n![annotated screenshot](${await uploadToR2(cfg.r2, image)})`;
  }

  const body = [
    note.trim() || '_(no description — see screenshot)_',
    imageMd,
    '\n\n---',
    '| | |',
    '|---|---|',
    `| page | ${page} |`,
    `| page title | ${pageTitle} |`,
    `| captured | ${new Date().toISOString()} |`,
    '| via | nanobots browser extension |',
  ].join('\n');

  const issue = await createIssue(pat, nwo, {
    title: `[${type === 'bug' ? 'bug' : 'feat'}] ${title.trim()}`,
    body,
    labels: ['nanobots:inbox', 'nanobots:ext', type === 'bug' ? 'bug' : 'enhancement'],
  });
  await logFiledIssue({
    nwo, number: issue.number, title: issue.title, url: issue.html_url,
    type, page, filedAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ lastRepo: nwo });

  // Checked AFTER filing, deliberately. The issue is worth having either way, so this must
  // never block or fail the report — it only changes what we tell the user happens next.
  const loop = await repoHasLoop(pat, nwo).catch(() => null);
  return { ok: true, url: issue.html_url, number: issue.number, loop };
}
