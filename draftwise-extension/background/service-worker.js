// DraftWise background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'DRAFTWISE_INJECT_MAIN_WORLD') {
    if (!sender.tab || !sender.tab.id) {
      sendResponse({ error: 'No sender tab ID found' });
      return true;
    }
    
    chrome.scripting.executeScript({
      target: { 
        tabId: sender.tab.id,
        frameIds: [sender.frameId || 0]
      },
      world: 'MAIN',
      files: ['content/main-world-converter.js']
    }).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      console.error('ExecuteScript MAIN world inject failed:', err);
      sendResponse({ error: err.message });
    });
    
    return true; // Keep message channel open for async response
  }
});
