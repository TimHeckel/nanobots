// Module service worker: owns capture + all network (MV3 content scripts are
// subject to the page's CORS, so GitHub/R2 calls must happen here).
import { getConfig, createIssue, logFiledIssue, tokenFor } from './gh.js';
import { uploadToR2, r2Configured } from './storage.js';

chrome.action.onClicked.addListener(async (tab) => {
  let shot = null;
  try {
    // Capture BEFORE injecting anything so the overlay is never in the shot.
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch { /* chrome:// pages etc. */ }

  const cfg = await getConfig();
  const payload = {
    kind: 'nanobots-open',
    shot,
    url: tab.url ?? '',
    title: tab.title ?? '',
    repos: cfg.repos,
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
  return { ok: true, url: issue.html_url, number: issue.number };
}
