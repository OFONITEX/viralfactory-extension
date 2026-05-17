// ViralFactory - Background Service Worker
// Handles API calls that need CORS bypass and cross-origin requests

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_API') {
    handleFetch(message.payload).then(sendResponse).catch(err => 
      sendResponse({ error: err.message })
    );
    return true; // Keep channel open for async response
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
  }
});

async function handleFetch({ url, method = 'GET', headers = {}, body }) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { error: err.message };
  }
}

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('ViralFactory installed! 🎵');
});

// In-Page Floating Panel Trigger
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.includes('tiktok.com')) {
    alert("Please navigate to TikTok to use ViralFactory!");
    return;
  }
  
  // Inject content script if not already injected
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).catch(() => {});
  
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_WIDGET' });
});
