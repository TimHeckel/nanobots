// Click the icon → capture the visible tab → open the annotate page.
chrome.action.onClicked.addListener(async (tab) => {
  let shot = null;
  try {
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (e) {
    // chrome:// pages etc. — still allow filing a report without a screenshot
  }
  await chrome.storage.session.set({
    pending: {
      shot,
      url: tab.url ?? '',
      title: tab.title ?? '',
      capturedAt: new Date().toISOString(),
    },
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL('annotate.html') });
});
