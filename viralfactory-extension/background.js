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

// Standalone Draggable Window Management
chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL("popup.html");
  
  chrome.tabs.query({ url: popupUrl }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      createWindow();
    }
  });
});

function createWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 380,
    height: 640,
    focused: true
  });
}
