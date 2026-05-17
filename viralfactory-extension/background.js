// ViralFactory - Background Service Worker
// Handles API calls that need CORS bypass and cross-origin requests

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_API') {
    handleFetch(message.payload).then(sendResponse).catch(err => 
      sendResponse({ error: err.message })
    );
    return true; // Keep channel open for async response
  }

  if (message.type === 'START_SUNO_GENERATION') {
    startSunoGeneration(message.payload).then(sendResponse).catch(err =>
      sendResponse({ error: err.message })
    );
    return true;
  }

  if (message.type === 'CANCEL_SUNO_GENERATION') {
    chrome.alarms.clear('pollSuno');
    chrome.storage.local.remove(['vf_suno_poll_state', 'vf_suno_songs']);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_SUNO_STATUS') {
    chrome.storage.local.get(['vf_suno_poll_state', 'vf_suno_songs'], (data) => {
      sendResponse({
        polling: !!data.vf_suno_poll_state,
        songs: data.vf_suno_songs || null
      });
    });
    return true;
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

// Alarm listener for Suno Polling
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollSuno') {
    await handleSunoPoll();
  }
});

async function startSunoGeneration({ prompt, genre, customMode, instrumental, model }) {
  // 1. Retrieve the Suno key from storage
  const keysObj = await chrome.storage.local.get('vf_keys');
  const sunoKey = keysObj.vf_keys?.sunoKey;
  if (!sunoKey) {
    throw new Error('Suno API key not found in Settings.');
  }

  // 2. Build the Suno API request body
  const bodyObj = {
    customMode: !!customMode,
    instrumental: !!instrumental,
    model: model || 'V4_5',
    callBackUrl: ''
  };

  if (bodyObj.customMode) {
    bodyObj.prompt = prompt; // exact lyrics
    bodyObj.style = genre || 'pop-punk';
    bodyObj.title = 'ViralFactory Song';
  } else {
    bodyObj.prompt = prompt.slice(0, 500); // prompt description, max 500 chars
  }

  // 3. Fire the request to sunoapi.org
  const res = await fetch('https://api.sunoapi.org/api/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sunoKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyObj)
  });

  if (!res.ok) {
    // Error mapping
    if (res.status === 401) {
      throw new Error('401: Invalid Suno API Key. Please update it in Settings.');
    }
    if (res.status === 429) {
      throw new Error('429: No credits left on Suno account. Please top up at sunoapi.org.');
    }
    if (res.status === 430) {
      throw new Error('430: Rate limit hit. Suno is busy, please wait a moment.');
    }
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText || 'Connection failed'}`);
  }

  const data = await res.json();
  if (data.code !== 200) {
    // Handle inline prompt validation issues
    if (data.code === 400 || data.code === 413) {
      throw new Error(`Prompt Issue (${data.code}): ${data.msg}`);
    }
    throw new Error(data.msg || 'Suno API rejected the task');
  }

  const taskId = data.data.taskId;
  if (!taskId) {
    throw new Error('Response did not contain a valid taskId');
  }

  // 4. Save state & start alarm
  const pollState = {
    taskId,
    attempts: 0,
    key: sunoKey
  };
  await chrome.storage.local.set({ vf_suno_poll_state: pollState });
  await chrome.storage.local.remove('vf_suno_songs'); // Clear previous song cache

  // Start 30 second alarm
  chrome.alarms.create('pollSuno', { periodInMinutes: 0.5 });

  return { ok: true, taskId };
}

async function handleSunoPoll() {
  const stateObj = await chrome.storage.local.get('vf_suno_poll_state');
  const pollState = stateObj.vf_suno_poll_state;
  if (!pollState) {
    chrome.alarms.clear('pollSuno');
    return;
  }

  // Check attempt limit (max 20 polls = 10 minutes)
  if (pollState.attempts >= 20) {
    chrome.alarms.clear('pollSuno');
    await chrome.storage.local.remove('vf_suno_poll_state');
    
    // Notify all active frames/popups about the timeout
    chrome.runtime.sendMessage({
      type: 'SUNO_GENERATION_ERROR',
      error: 'Music generation timed out after 10 minutes.'
    });
    
    showNotification('Music Generation Timed Out', 'Your soundtrack took too long to generate. Please try again.');
    return;
  }

  // Increment attempts and save
  pollState.attempts += 1;
  await chrome.storage.local.set({ vf_suno_poll_state: pollState });

  try {
    const res = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${pollState.taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pollState.key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Unauthorized: Suno API key is invalid.');
      }
      return;
    }

    const data = await res.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Suno API error');
    }

    const status = data.data.status;
    const records = data.data.sunoData;

    if (status === 'SUCCESS' || status === 'FIRST_SUCCESS') {
      // Generation succeeded!
      chrome.alarms.clear('pollSuno');
      await chrome.storage.local.remove('vf_suno_poll_state');

      // Save tracks to storage
      await chrome.storage.local.set({ vf_suno_songs: records });

      // Notify popup
      chrome.runtime.sendMessage({
        type: 'SUNO_GENERATION_COMPLETE',
        songs: records
      });

      showNotification('Soundtrack Ready! 🎵', `AI generated: "${records[0]?.title || 'ViralFactory Song'}" is ready!`);
    } else if (status === 'GENERATE_AUDIO_FAILED' || status === 'SENSITIVE_WORD_ERROR') {
      // Generation failed
      chrome.alarms.clear('pollSuno');
      await chrome.storage.local.remove('vf_suno_poll_state');

      let errMsg = 'Suno generation failed.';
      if (status === 'SENSITIVE_WORD_ERROR') {
        errMsg = 'Suno blocked the prompt due to sensitive words.';
      }
      
      chrome.runtime.sendMessage({
        type: 'SUNO_GENERATION_ERROR',
        error: errMsg
      });

      showNotification('Music Generation Failed', errMsg);
    }
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      chrome.alarms.clear('pollSuno');
      await chrome.storage.local.remove('vf_suno_poll_state');
      chrome.runtime.sendMessage({
        type: 'SUNO_GENERATION_ERROR',
        error: err.message
      });
      showNotification('Suno Key Invalid', 'Please check your Suno API Key in the Settings.');
    }
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 2
  });
}
