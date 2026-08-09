// Getting told, rather than remembering to look.
//
// Two channels, deliberately different in where they send you:
//   • Chrome notification → the extension dashboard, where you can open the chat about it.
//   • ntfy (optional)     → the GitHub issue, because that link has to work on a phone.
// A chrome-extension:// URL is meaningless anywhere but this browser profile, so pushing one
// to a phone would be a dead tap.

const NTFY_DEFAULT = 'https://ntfy.sh';

export const dashboardUrl = (item) =>
  chrome.runtime.getURL(`history.html#focus=${encodeURIComponent(`${item.nwo}#${item.number}`)}`);

// Stable identity for "this thing, in this state". The hash is part of it so a REVISED plan
// notifies again — a new plan is a new decision, and silently treating it as already-seen
// would hide the thing most worth seeing.
export const itemKey = (i) => `${i.nwo}#${i.number}:${i.why}:${i.hash || ''}`;

export async function notifyChrome(item) {
  const title = item.why === 'summon-human'
    ? `Needs you — ${item.nwo}#${item.number}`
    : `Plan awaiting approval — ${item.nwo}#${item.number}`;
  const id = `nanobots:${itemKey(item)}`;
  try {
    await chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message: item.title || '',
      contextMessage: item.why === 'summon-human'
        ? 'The loop stopped and asked for a person.'
        : 'Nothing will be built until this is approved.',
      priority: 2,
    });
    // The click target can't ride along on the notification, so park it against the id.
    const { notifyTargets = {} } = await chrome.storage.local.get('notifyTargets');
    notifyTargets[id] = { dashboard: dashboardUrl(item), issue: item.url };
    await chrome.storage.local.set({ notifyTargets });
  } catch { /* notifications can be disabled at the OS level; never let that break a poll */ }
}

export async function notifyNtfy(cfg, item) {
  const topic = cfg.ntfy?.topic?.trim();
  if (!topic) return;
  const server = (cfg.ntfy?.server || NTFY_DEFAULT).replace(/\/+$/, '');
  const headers = {
    Title: item.why === 'summon-human'
      ? `nanobots: needs you — ${item.nwo}#${item.number}`
      : `nanobots: approve to build — ${item.nwo}#${item.number}`,
    Priority: item.why === 'summon-human' ? 'high' : 'default',
    Tags: item.why === 'summon-human' ? 'rotating_light' : 'hourglass',
    // Goes to GitHub, not the extension: this may well be opened on a phone.
    Click: item.url,
  };
  if (cfg.ntfy?.token) headers.Authorization = `Bearer ${cfg.ntfy.token}`;
  try {
    await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body: item.title || '(no title)',
    });
  } catch { /* a push channel being down must never fail the scan */ }
}
