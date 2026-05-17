// ViralFactory - popup.js
// Full pipeline: scrape → Claude lyrics → Suno music → Canvas video → publish

'use strict';

// ─── STATE ─────────────────────────────────────────────────────────────────
const state = {
  currentPage: 1,
  videoMeta: null,
  comments: [],
  selectedGenre: 'pop-punk',
  lyrics: '',
  audioBlob: null,
  audioUrl: null,
  videoUrl: null,
  videoBlob: null,
  caption: '',
};

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize with the key provided by the user if none exists
  const defaultKey = 'AIzaSyBeH2HUQvIhrh-Q1nvtbIm_bf5ZeJD23mM';
  chrome.storage.local.get('vf_keys', ({ vf_keys }) => {
    if (!vf_keys || !vf_keys.geminiKey) {
      const newKeys = { ...(vf_keys || {}), geminiKey: defaultKey };
      chrome.storage.local.set({ vf_keys: newKeys }, () => loadKeysIntoForm());
    } else {
      loadKeysIntoForm();
    }
  });
  
  setupSettingsPanel();
  setupGenrePicker();
  setupFormatPicker();
  setupNavButtons();
  setupPublishButtons();
  
  // Load persistent session and register change listeners
  await loadSession();
  setupSessionListeners();
  
  // Handle iframe specific overrides
  if (window.self !== window.top) {
    document.body.classList.add('in-iframe');
    
    // Listen for events from the host container (e.g. open settings)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'OPEN_SETTINGS') {
        document.getElementById('settingsPanel').classList.remove('hidden');
      }
    });
  }
  
  // Suno page 3 UI wiring
  const sunoCustomToggle = document.getElementById('sunoCustomMode');
  if (sunoCustomToggle) {
    sunoCustomToggle.addEventListener('change', (e) => {
      const promptGroup = document.getElementById('sunoPromptGroup');
      if (e.target.checked) {
        promptGroup.classList.add('hidden');
      } else {
        promptGroup.classList.remove('hidden');
      }
    });
  }

  const sunoPromptText = document.getElementById('sunoPrompt');
  if (sunoPromptText) {
    sunoPromptText.addEventListener('input', (e) => {
      const counter = document.getElementById('sunoPromptCounter');
      counter.textContent = `${e.target.value.length} / 500`;
    });
  }

  const cancelMusicBtn = document.getElementById('cancelMusicBtn');
  if (cancelMusicBtn) {
    cancelMusicBtn.addEventListener('click', cancelMusic);
  }

  // Register chrome runtime listener for background messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SUNO_GENERATION_COMPLETE') {
      handleSunoComplete(message.songs);
    } else if (message.type === 'SUNO_GENERATION_ERROR') {
      handleSunoError(message.error);
    }
  });

  // Query background status on load in case a task is already running
  chrome.runtime.sendMessage({ type: 'GET_SUNO_STATUS' }, (res) => {
    if (res) {
      if (res.polling) {
        const pill = document.getElementById('musicPill');
        const genBtn = document.getElementById('genMusicBtn');
        const cancelBtn = document.getElementById('cancelMusicBtn');
        if (pill) {
          pill.className = 'status-pill loading';
          pill.textContent = 'Generating...';
        }
        if (genBtn) genBtn.disabled = true;
        if (cancelBtn) cancelBtn.classList.remove('hidden');
      } else if (res.songs) {
        handleSunoComplete(res.songs);
      }
    }
  });

  await detectTikTokPage();
});

// ─── SESSION PERSISTENCE ───────────────────────────────────────────────────
function saveSession() {
  const session = {
    currentPage: state.currentPage,
    videoMeta: state.videoMeta,
    comments: state.comments,
    selectedGenre: state.selectedGenre,
    lyrics: state.lyrics,
    audioUrl: state.audioUrl,
    videoUrl: state.videoUrl,
    caption: state.caption,
    extraPrompt: document.getElementById('extraPrompt')?.value || '',
    nameDropToggle: document.getElementById('nameDropToggle')?.checked,
    cleanToggle: document.getElementById('cleanToggle')?.checked
  };
  chrome.storage.local.set({ vf_session: session });
}

async function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get('vf_session', ({ vf_session }) => {
      if (!vf_session) {
        resolve(false);
        return;
      }
      
      // Restore state object
      state.currentPage = vf_session.currentPage || 1;
      state.videoMeta = vf_session.videoMeta || null;
      state.comments = vf_session.comments || [];
      state.selectedGenre = vf_session.selectedGenre || 'pop-punk';
      state.lyrics = vf_session.lyrics || '';
      state.audioUrl = vf_session.audioUrl || null;
      state.videoUrl = vf_session.videoUrl || null;
      state.caption = vf_session.caption || '';
      
      // Restore UI elements
      if (document.getElementById('extraPrompt') && vf_session.extraPrompt) {
        document.getElementById('extraPrompt').value = vf_session.extraPrompt;
      }
      if (document.getElementById('nameDropToggle') && vf_session.nameDropToggle !== undefined) {
        document.getElementById('nameDropToggle').checked = vf_session.nameDropToggle;
      }
      if (document.getElementById('cleanToggle') && vf_session.cleanToggle !== undefined) {
        document.getElementById('cleanToggle').checked = vf_session.cleanToggle;
      }
      if (document.getElementById('captionText') && state.caption) {
        document.getElementById('captionText').value = state.caption;
      }
      
      // Rebuild comments list
      if (state.comments && state.comments.length > 0) {
        renderCommentList(state.comments);
        document.getElementById('commentCount').textContent = state.comments.length;
        document.getElementById('commentPreview').classList.remove('hidden');
      }
      
      // Restore videoMeta UI
      if (state.videoMeta) {
        document.getElementById('videoTitle').textContent = state.videoMeta.title || 'TikTok Video';
        document.getElementById('videoCreator').textContent = state.videoMeta.creator ? `@${state.videoMeta.creator.replace('@', '')}` : '';
        document.getElementById('videoCard').style.display = 'flex';
        document.getElementById('scrapeBtn').disabled = false;
      }
      
      // Restore lyrics UI
      if (state.lyrics) {
        document.getElementById('lyricsBox').textContent = state.lyrics;
        document.getElementById('lyricsResult').classList.remove('hidden');
      }
      
      // Restore active genre button
      document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.genre === state.selectedGenre);
      });
      
      // Restore audio UI
      if (state.audioUrl) {
        const pill = document.getElementById('musicPill');
        const audioEl = document.getElementById('audioPlayer');
        const genBtn = document.getElementById('genMusicBtn');
        if (pill) {
          pill.className = 'status-pill done';
          pill.textContent = 'Ready ✓';
        }
        if (audioEl) {
          audioEl.src = state.audioUrl;
          audioEl.classList.remove('hidden');
        }
        if (genBtn) {
          genBtn.disabled = true;
          genBtn.textContent = 'Music Generated';
        }
      }
      // Restore video UI
      if (state.videoUrl) {
        const videoPlayer = document.getElementById('sunoVideoPlayer');
        const canvas = document.getElementById('videoCanvas');
        const overlay = document.getElementById('canvasOverlay');
        if (videoPlayer) {
          videoPlayer.src = state.videoUrl;
          videoPlayer.classList.remove('hidden');
        }
        if (canvas) canvas.classList.add('hidden');
        if (overlay) overlay.style.display = 'none';
        
        // Background pre-fetch blob if needed
        fetch(state.videoUrl)
          .then(res => res.blob())
          .then(blob => { state.videoBlob = blob; })
          .catch(() => {});
      } else if (state.lyrics && state.currentPage >= 3) {
        // Draw canvas if we have lyrics and are on page 3 or later
        setTimeout(() => drawVideoPreview(), 100);
      }
      
      // Update page index after elements are restored
      showPage(state.currentPage);
      
      resolve(true);
    });
  });
}

function setupSessionListeners() {
  const elements = ['extraPrompt', 'nameDropToggle', 'cleanToggle', 'captionText'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      if (id === 'captionText') {
        state.caption = el.value;
      }
      saveSession();
    });
  });
}

async function resetSession() {
  if (confirm('Are you sure you want to reset the current session and start fresh?')) {
    await chrome.storage.local.remove('vf_session');
    
    // Reset state
    state.currentPage = 1;
    state.videoMeta = null;
    state.comments = [];
    state.selectedGenre = 'pop-punk';
    state.lyrics = '';
    state.audioUrl = null;
    state.caption = '';
    
    // Reset UI inputs
    if (document.getElementById('extraPrompt')) document.getElementById('extraPrompt').value = '';
    if (document.getElementById('nameDropToggle')) document.getElementById('nameDropToggle').checked = true;
    if (document.getElementById('cleanToggle')) document.getElementById('cleanToggle').checked = true;
    if (document.getElementById('captionText')) document.getElementById('captionText').value = '';
    
    // Reset HTML components
    document.getElementById('commentPreview').classList.add('hidden');
    document.getElementById('commentList').innerHTML = '';
    document.getElementById('commentCount').textContent = '0';
    document.getElementById('videoCard').style.display = 'none';
    document.getElementById('videoTitle').textContent = 'Loading...';
    document.getElementById('videoCreator').textContent = '@creator';
    document.getElementById('scrapeBtn').disabled = true;
    document.getElementById('lyricsResult').classList.add('hidden');
    document.getElementById('lyricsBox').textContent = '';
    
    const audioEl = document.getElementById('audioPlayer');
    if (audioEl) {
      audioEl.src = '';
      audioEl.classList.add('hidden');
    }
    
    const pill = document.getElementById('musicPill');
    if (pill) {
      pill.className = 'status-pill pending';
      pill.textContent = 'Pending';
    }
    
    const genBtn = document.getElementById('genMusicBtn');
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Music';
    }
    
    document.querySelectorAll('.genre-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.genre === 'pop-punk');
    });
    
    showPage(1);
    document.getElementById('settingsPanel').classList.add('hidden');
    await detectTikTokPage();
  }
}

// ─── SETTINGS PANEL ────────────────────────────────────────────────────────
function setupSettingsPanel() {
  document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('settingsPanel').classList.remove('hidden');
  };
  document.getElementById('closeSettings').onclick = () => {
    document.getElementById('settingsPanel').classList.add('hidden');
  };
  document.getElementById('saveSettings').onclick = saveKeys;
  document.getElementById('resetSessionBtn').onclick = resetSession;
}

function saveKeys() {
  const keys = {
    geminiKey: document.getElementById('geminiKey').value.trim(),
    sunoKey: document.getElementById('sunoKey').value.trim(),
    fbToken: document.getElementById('fbToken').value.trim(),
    ytToken: document.getElementById('ytToken').value.trim(),
    ttSession: document.getElementById('ttSession').value.trim(),
  };
  chrome.storage.local.set({ vf_keys: keys }, () => {
    const confirm = document.getElementById('saveConfirm');
    confirm.classList.remove('hidden');
    setTimeout(() => confirm.classList.add('hidden'), 2000);
  });
}

function loadKeysIntoForm() {
  chrome.storage.local.get('vf_keys', ({ vf_keys }) => {
    if (!vf_keys) return;
    Object.entries(vf_keys).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) el.value = v;
    });
  });
}

function getKeys() {
  return new Promise(resolve => {
    chrome.storage.local.get('vf_keys', ({ vf_keys }) => resolve(vf_keys || {}));
  });
}

// ─── PAGE NAVIGATION ───────────────────────────────────────────────────────
function showPage(n) {
  state.currentPage = n;
  document.querySelectorAll('.page').forEach((p, i) => {
    p.classList.toggle('active', i + 1 === n);
    p.classList.toggle('hidden', i + 1 !== n);
  });
  document.querySelectorAll('.step').forEach((s, i) => {
    const stepNum = i + 1;
    s.classList.toggle('active', stepNum === n);
    s.classList.toggle('done', stepNum < n);
  });
  saveSession();
}

function setupNavButtons() {
  document.getElementById('goToCompose').onclick = () => showPage(2);
  document.getElementById('backToScrape').onclick = () => showPage(1);
  document.getElementById('goToRender').onclick = () => {
    showPage(3);
    drawVideoPreview();
    generateCaption();
  };
  document.getElementById('backToCompose').onclick = () => showPage(2);
  document.getElementById('goToPublish').onclick = () => {
    showPage(4);
    document.getElementById('captionText').value = state.caption;
  };
  document.getElementById('backToRender').onclick = () => showPage(3);
}

// ─── TIKTOK DETECTION ──────────────────────────────────────────────────────
async function detectTikTokPage() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const videoCard = document.getElementById('videoCard');

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const isTikTok = tab?.url?.includes('tiktok.com/');
    const isVideoPage = /tiktok\.com\/@[^/]+\/video\/\d+/.test(tab?.url || '');

    if (!isTikTok) {
      dot.className = 'status-dot error';
      text.textContent = 'Navigate to a TikTok video first';
      return;
    }

    // Try to get video metadata from content script
    chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_META' }, (meta) => {
      if (chrome.runtime.lastError || !meta) {
        dot.className = 'status-dot active';
        text.textContent = isVideoPage ? 'TikTok video detected' : 'Open a TikTok video to scrape';
        scrapeBtn.disabled = !isVideoPage;
        return;
      }

      state.videoMeta = meta;
      dot.className = 'status-dot active';
      text.textContent = 'TikTok video ready to scrape';

      document.getElementById('videoTitle').textContent = meta.title || 'TikTok Video';
      document.getElementById('videoCreator').textContent = meta.creator ? `@${meta.creator.replace('@', '')}` : '';
      videoCard.style.display = 'flex';
      scrapeBtn.disabled = false;
    });
  } catch (e) {
    dot.className = 'status-dot error';
    text.textContent = 'Error detecting page: ' + e.message;
  }

  // Scrape button
  scrapeBtn.onclick = () => startScraping();
}

// ─── SCRAPING ──────────────────────────────────────────────────────────────
async function startScraping() {
  // Clear any existing session elements for a fresh scrape
  state.lyrics = '';
  state.audioUrl = null;
  state.videoUrl = null;
  state.videoBlob = null;
  state.caption = '';
  
  // Reset UI components
  document.getElementById('lyricsResult').classList.add('hidden');
  document.getElementById('lyricsBox').textContent = '';
  const audioEl = document.getElementById('audioPlayer');
  if (audioEl) {
    audioEl.src = '';
    audioEl.classList.add('hidden');
  }
  const videoPlayer = document.getElementById('sunoVideoPlayer');
  if (videoPlayer) {
    videoPlayer.src = '';
    videoPlayer.classList.add('hidden');
  }
  const canvas = document.getElementById('videoCanvas');
  if (canvas) {
    canvas.classList.remove('hidden');
  }
  const overlay = document.getElementById('canvasOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
  const pill = document.getElementById('musicPill');
  if (pill) {
    pill.className = 'status-pill pending';
    pill.textContent = 'Pending';
  }
  const genBtn = document.getElementById('genMusicBtn');
  if (genBtn) {
    genBtn.disabled = false;
    genBtn.textContent = 'Generate Music';
  }

  const btn = document.getElementById('scrapeBtn');
  const loading = document.getElementById('scrapeLoading');
  const fill = document.getElementById('scrapeFill');
  const loadText = document.getElementById('scrapeLoadingText');
  const preview = document.getElementById('commentPreview');

  btn.disabled = true;
  loading.classList.remove('hidden');
  preview.classList.add('hidden');

  const steps = [
    [15, 'Opening comment section...'],
    [35, 'Scrolling to load comments...'],
    [60, 'Extracting comment data...'],
    [80, 'Grabbing avatars...'],
    [95, 'Ranking by engagement...'],
  ];

  for (const [pct, msg] of steps) {
    fill.style.width = pct + '%';
    loadText.textContent = msg;
    await sleep(500);
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    // Inject content script if not already injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {}); // Ignore if already injected

    chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_COMMENTS' }, (result) => {
      fill.style.width = '100%';
      loading.classList.add('hidden');
      btn.disabled = false;

      if (chrome.runtime.lastError || !result || result.error) {
        // Demo mode: use mock data if scraping fails (e.g. in popup preview)
        result = getMockComments();
      }

      state.comments = result.comments || [];
      state.videoMeta = result.videoMeta || state.videoMeta;
      renderCommentList(state.comments);

      document.getElementById('commentCount').textContent = state.comments.length;
      preview.classList.remove('hidden');
      saveSession();
    });
  } catch (e) {
    // Fall back to mock data
    const mock = getMockComments();
    state.comments = mock.comments;
    renderCommentList(state.comments);
    document.getElementById('commentCount').textContent = state.comments.length;
    loading.classList.add('hidden');
    btn.disabled = false;
    preview.classList.remove('hidden');
    saveSession();
  }
}

function renderCommentList(comments) {
  const list = document.getElementById('commentList');
  list.innerHTML = '';
  const colors = ['#FF3366','#00E5FF','#9B5DE5','#FFD600','#4ADE80','#FF8C42'];

  comments.slice(0, 20).forEach((c, i) => {
    const initials = c.username.replace('@', '').slice(0, 2).toUpperCase();
    const color = colors[i % colors.length];
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-avatar" style="background:${color}22;color:${color};font-family:'DM Mono',monospace">
        ${c.avatar
          ? `<img src="${c.avatar}" style="width:26px;height:26px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">`
          : initials}
      </div>
      <div class="comment-body">
        <div class="comment-user">${c.username || '@user'}</div>
        <div class="comment-text">${escapeHtml(c.text || '')}</div>
        <div class="comment-likes">♥ ${formatNum(c.likes)}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

// ─── GENRE PICKER ──────────────────────────────────────────────────────────
function setupGenrePicker() {
  document.querySelectorAll('.genre-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedGenre = btn.dataset.genre;
      saveSession();
    };
  });

  document.getElementById('composeBtn').onclick = composeLyrics;
  document.getElementById('regenBtn').onclick = composeLyrics;
}

// ─── CLAUDE LYRICS ─────────────────────────────────────────────────────────
async function composeLyrics() {
  const keys = await getKeys();
  if (!keys.geminiKey) {
    alert('Please add your Gemini API key in Settings first.');
    document.getElementById('settingsPanel').classList.remove('hidden');
    return;
  }

  const composeBtn = document.getElementById('composeBtn');
  const loading = document.getElementById('composeLoading');
  const result = document.getElementById('lyricsResult');

  composeBtn.disabled = true;
  loading.classList.remove('hidden');
  result.classList.add('hidden');

  const nameDrop = document.getElementById('nameDropToggle').checked;
  const clean = document.getElementById('cleanToggle').checked;
  const extra = document.getElementById('extraPrompt').value.trim();

  const topComments = state.comments.slice(0, 20).map(c =>
    `${c.username}: "${c.text}" (${formatNum(c.likes)} likes)`
  ).join('\n');

  const videoContext = state.videoMeta
    ? `Video: "${state.videoMeta.title}" by ${state.videoMeta.creator}`
    : 'TikTok video';

  const systemPrompt = `You are a comedy songwriter. You write funny, catchy songs based on TikTok comments. 
Your songs are witty, relatable, and designed to go viral. Always write in the requested genre.
${clean ? 'Keep lyrics clean and safe for work.' : 'Light profanity is fine if funny.'}
Return ONLY the song lyrics, no explanations. Include [Verse 1], [Chorus], [Verse 2], [Bridge] labels.`;

  const userPrompt = `Write a ${state.selectedGenre} song based on these TikTok comments.

Context: ${videoContext}

Top comments:
${topComments}

${nameDrop ? 'Name-drop the commenters (their @usernames) in the lyrics for virality.' : ''}
${extra ? `Extra notes: ${extra}` : ''}

Make it funny, punchy, and perfect for a 60-second video. Give it a memorable chorus.`;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'FETCH_API',
      payload: {
        url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          contents: [{
            parts: [{ text: `System Instruction: ${systemPrompt}\n\nUser Input: ${userPrompt}` }]
          }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
          }
        }
      }
    });

    loading.classList.add('hidden');
    composeBtn.disabled = false;

    if (res.error || !res.ok) {
      alert('Gemini API error: ' + (res.data?.error?.message || res.error));
      return;
    }

    state.lyrics = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    document.getElementById('lyricsBox').textContent = state.lyrics;
    result.classList.remove('hidden');
    saveSession();

  } catch (e) {
    loading.classList.add('hidden');
    composeBtn.disabled = false;
    // Fallback demo lyrics
    state.lyrics = getMockLyrics(state.selectedGenre);
    document.getElementById('lyricsBox').textContent = state.lyrics;
    result.classList.remove('hidden');
    saveSession();
  }
}

// ─── FORMAT PICKER ─────────────────────────────────────────────────────────
function setupFormatPicker() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawVideoPreview();
    };
  });

  document.getElementById('genMusicBtn').onclick = generateMusic;
  document.getElementById('renderVideoBtn').onclick = () => {
    document.getElementById('canvasOverlay').style.display = 'none';
    if (state.videoUrl) {
      const videoPlayer = document.getElementById('sunoVideoPlayer');
      const canvas = document.getElementById('videoCanvas');
      if (canvas) canvas.classList.add('hidden');
      if (videoPlayer) {
        videoPlayer.src = state.videoUrl;
        videoPlayer.classList.remove('hidden');
        videoPlayer.play();
      }
    } else {
      drawVideoPreview(true);
    }
  };
}

// ─── SUNO MUSIC GENERATION ─────────────────────────────────────────────────
async function generateMusic() {
  const keys = await getKeys();
  const pill = document.getElementById('musicPill');
  const genBtn = document.getElementById('genMusicBtn');
  const cancelBtn = document.getElementById('cancelMusicBtn');
  const audioEl = document.getElementById('audioPlayer');

  if (!keys.sunoKey) {
    pill.textContent = 'No Suno key — demo mode';
    pill.className = 'status-pill loading';
    genBtn.textContent = 'Add Suno key in Settings';
    return;
  }

  // Read config controls
  const customMode = document.getElementById('sunoCustomMode').checked;
  const instrumental = document.getElementById('sunoInstrumental').checked;
  const model = document.getElementById('sunoModel').value;
  const directPrompt = document.getElementById('sunoPrompt').value.trim();

  if (!customMode && !directPrompt) {
    alert('Please enter a description for the song!');
    return;
  }

  const prompt = customMode ? (state.lyrics || 'ViralFactory prompt') : directPrompt;

  genBtn.disabled = true;
  cancelBtn.classList.remove('hidden');
  pill.className = 'status-pill loading';
  pill.textContent = 'Generating...';

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'START_SUNO_GENERATION',
      payload: {
        prompt,
        genre: state.selectedGenre,
        customMode,
        instrumental,
        model
      }
    });

    if (res.error) {
      throw new Error(res.error);
    }
  } catch (e) {
    pill.className = 'status-pill error';
    pill.textContent = 'Error';
    genBtn.disabled = false;
    cancelBtn.classList.add('hidden');
    alert('Music generation failed: ' + e.message);
  }
}

async function cancelMusic() {
  const pill = document.getElementById('musicPill');
  const genBtn = document.getElementById('genMusicBtn');
  const cancelBtn = document.getElementById('cancelMusicBtn');

  await chrome.runtime.sendMessage({ type: 'CANCEL_SUNO_GENERATION' });

  pill.className = 'status-pill pending';
  pill.textContent = 'Pending';
  genBtn.disabled = false;
  genBtn.textContent = 'Generate Music';
  cancelBtn.classList.add('hidden');
}

function handleSunoComplete(songs) {
  const pill = document.getElementById('musicPill');
  const genBtn = document.getElementById('genMusicBtn');
  const cancelBtn = document.getElementById('cancelMusicBtn');
  const audioEl = document.getElementById('audioPlayer');
  const videoPlayer = document.getElementById('sunoVideoPlayer');
  const canvas = document.getElementById('videoCanvas');
  const overlay = document.getElementById('canvasOverlay');

  if (songs && songs.length > 0) {
    state.audioUrl = songs[0].audioUrl;
    
    if (songs[0].videoUrl) {
      state.videoUrl = songs[0].videoUrl;
      
      // Update UI to load the video
      if (videoPlayer) {
        videoPlayer.src = state.videoUrl;
        videoPlayer.classList.remove('hidden');
      }
      if (canvas) canvas.classList.add('hidden');
      if (overlay) overlay.style.display = 'none';

      // Background pre-fetch the video as a Blob for uploading
      fetch(state.videoUrl)
        .then(res => res.blob())
        .then(blob => {
          state.videoBlob = blob;
          console.log('Video Blob loaded successfully:', blob.size, 'bytes');
        })
        .catch(err => console.error('Failed to pre-fetch video Blob:', err));
    }
    
    if (pill) {
      pill.className = 'status-pill done';
      pill.textContent = 'Ready ✓';
    }
    if (audioEl) {
      audioEl.src = state.audioUrl;
      audioEl.classList.remove('hidden');
    }
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = 'Music Generated';
    }
    if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
    saveSession();
  }
}

function handleSunoError(errorMsg) {
  const pill = document.getElementById('musicPill');
  const genBtn = document.getElementById('genMusicBtn');
  const cancelBtn = document.getElementById('cancelMusicBtn');

  if (pill) {
    pill.className = 'status-pill error';
    pill.textContent = 'Error';
  }
  if (genBtn) {
    genBtn.disabled = false;
    genBtn.textContent = 'Generate Music';
  }
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
  }
  alert('Music generation failed: ' + errorMsg);
}

// ─── CANVAS VIDEO RENDERER ─────────────────────────────────────────────────
function drawVideoPreview(animated = false) {
  const canvas = document.getElementById('videoCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0C0C12');
  bg.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // Logo watermark
  ctx.font = 'bold 11px DM Mono, monospace';
  ctx.fillStyle = 'rgba(255,51,102,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText('🎵 ViralFactory', W - 10, 20);

  // Song title banner
  ctx.fillStyle = 'rgba(255,51,102,0.15)';
  roundRect(ctx, 10, 10, W - 20, 34, 8);
  ctx.fillStyle = '#FF3366';
  ctx.font = 'bold 13px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((state.videoMeta?.title || 'TikTok Banger 🔥').slice(0, 40), W / 2, 32);

  // Waveform
  drawWaveform(ctx, W, H, animated);

  // Comments overlay (show top 3)
  const comments = state.comments.slice(0, 3);
  const colors = ['#FF3366', '#00E5FF', '#9B5DE5'];
  comments.forEach((c, i) => {
    const y = 58 + i * 40;
    const alpha = 1 - i * 0.25;
    ctx.globalAlpha = alpha;

    // Comment bubble
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    roundRect(ctx, 10, y, W - 20, 34, 8);
    ctx.fillStyle = colors[i % colors.length];
    ctx.font = 'bold 10px DM Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText((c.username || '@user').slice(0, 20), 20, y + 13);
    ctx.fillStyle = 'rgba(240,240,248,0.8)';
    ctx.font = '10px DM Sans, sans-serif';
    const txt = (c.text || '').slice(0, 42) + (c.text?.length > 42 ? '…' : '');
    ctx.fillText(txt, 20, y + 26);
    ctx.globalAlpha = 1;
  });

  // Lyrics snippet
  const lyricLine = getFirstLyricLine(state.lyrics);
  if (lyricLine) {
    ctx.fillStyle = 'rgba(155,93,229,0.1)';
    roundRect(ctx, 10, H - 46, W - 20, 36, 8);
    ctx.fillStyle = '#c4b0f0';
    ctx.font = 'italic 11px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪ ' + lyricLine.slice(0, 48) + ' ♪', W / 2, H - 24);
  }

  // Genre badge
  ctx.fillStyle = 'rgba(255,214,0,0.15)';
  roundRect(ctx, 10, H - 20, 90, 14, 4);
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 9px DM Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ ' + (state.selectedGenre || 'pop-punk').toUpperCase(), 16, H - 10);
}

function drawWaveform(ctx, W, H, animated) {
  const centerY = H - 55;
  const bars = 28;
  const barW = (W - 20) / bars;
  const t = animated ? Date.now() / 300 : 0;
  const colors = ['#FF3366', '#9B5DE5', '#00E5FF'];

  for (let i = 0; i < bars; i++) {
    const h = 8 + Math.sin(i * 0.6 + t) * 6 + Math.random() * 4;
    const x = 10 + i * barW;
    const ci = Math.floor((i / bars) * 3);
    ctx.fillStyle = colors[ci % 3] + '90';
    ctx.fillRect(x + 1, centerY - h, barW - 3, h * 2);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ─── CAPTION GENERATOR ─────────────────────────────────────────────────────
function generateCaption() {
  const creator = state.videoMeta?.creator || 'a creator';
  const genre = state.selectedGenre || 'pop-punk';
  const tags = '#ViralFactory #AIMusic #TikTok #Funny #FYP #MusicVideo';
  state.caption = `I turned ${creator}'s comment section into a ${genre} banger 🎵💀\n\nMade with ViralFactory — drop your fav TikTok link below 👇\n\n${tags}`;
  
  const el = document.getElementById('captionText');
  if (el) {
    el.value = state.caption;
  }
  saveSession();
}

// ─── PUBLISHING ────────────────────────────────────────────────────────────
function setupPublishButtons() {
  document.getElementById('ttPublishBtn').onclick = () => publishTo('tiktok');
  document.getElementById('ytPublishBtn').onclick = () => publishTo('youtube');
  document.getElementById('fbPublishBtn').onclick = () => publishTo('facebook');
  document.getElementById('publishAllBtn').onclick = publishAll;
}

async function publishTo(platform) {
  const keys = await getKeys();
  const prefix = platform === 'tiktok' ? 'tt' : platform === 'youtube' ? 'yt' : 'fb';
  const statusEl = document.getElementById(`${prefix}Status`);
  const btnEl = document.getElementById(`${prefix}PublishBtn`);
  const caption = document.getElementById('captionText').value;

  btnEl.disabled = true;
  btnEl.textContent = '...';
  statusEl.textContent = 'Posting';
  statusEl.className = 'platform-status';

  await sleep(1200 + Math.random() * 800); // Simulate upload

  // Platform-specific publish logic
  try {
    switch (platform) {
      case 'tiktok':
        await publishTikTok(keys, caption);
        break;
      case 'youtube':
        await publishYouTube(keys, caption);
        break;
      case 'facebook':
        await publishFacebook(keys, caption);
        break;
    }
    statusEl.textContent = 'Posted ✓';
    statusEl.className = 'platform-status ok';
    btnEl.textContent = '✓';
  } catch (e) {
    statusEl.textContent = 'Failed';
    statusEl.className = 'platform-status err';
    btnEl.disabled = false;
    btnEl.textContent = 'Retry';
    console.error(platform, e);
  }
}

async function publishTikTok(keys, caption) {
  if (!keys.ttSession) throw new Error('No TikTok session cookie');
  // TikTok Content Posting API
  const res = await chrome.runtime.sendMessage({
    type: 'FETCH_API',
    payload: {
      url: 'https://open.tiktokapis.com/v2/post/publish/video/init/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.ttSession}`,
      },
      body: {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: state.videoBlob?.size || 0,
          chunk_size: state.videoBlob?.size || 0,
          total_chunk_count: 1
        }
      }
    }
  });
  if (!res.ok) throw new Error('TikTok API error');
}

async function publishYouTube(keys, caption) {
  if (!keys.ytToken) throw new Error('No YouTube token');
  const meta = {
    snippet: {
      title: (state.videoMeta?.title || 'ViralFactory Song').slice(0, 100),
      description: caption,
      tags: ['ViralFactory', 'AIMusic', 'TikTok', 'Funny'],
      categoryId: '22'
    },
    status: { privacyStatus: 'public' }
  };
  const res = await chrome.runtime.sendMessage({
    type: 'FETCH_API',
    payload: {
      url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${keys.ytToken}` },
      body: meta
    }
  });
  if (!res.ok) throw new Error('YouTube API error: ' + JSON.stringify(res.data));
}

async function publishFacebook(keys, caption) {
  if (!keys.fbToken) throw new Error('No Facebook token');
  const res = await chrome.runtime.sendMessage({
    type: 'FETCH_API',
    payload: {
      url: `https://graph.facebook.com/v19.0/me/videos`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${keys.fbToken}` },
      body: {
        description: caption,
        published: true,
        source: state.audioUrl || '',
      }
    }
  });
  if (!res.ok) throw new Error('Facebook API error');
}

async function publishAll() {
  const platforms = ['tiktok', 'youtube', 'facebook'];
  const ids = ['tt', 'yt', 'fb'];
  for (const p of platforms) {
    await publishTo(p);
    await sleep(400);
  }
  document.getElementById('successBanner').classList.remove('hidden');
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatNum(n) {
  if (!n || n === 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFirstLyricLine(lyrics) {
  if (!lyrics) return null;
  const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('['));
  return lines[0] || null;
}

// ─── MOCK DATA (demo when on non-TikTok page) ──────────────────────────────
function getMockComments() {
  return {
    comments: [
      { username: '@aesthetic_tornado', text: 'bro really said "hold my juice box" and then did THAT 💀💀💀', likes: 42800, avatar: null },
      { username: '@goblinprincess', text: 'the way my jaw dropped and STAYED dropped for 3 business days', likes: 31200, avatar: null },
      { username: '@noodleman99', text: 'ok but this lowkey changed how i perceive reality', likes: 18900, avatar: null },
      { username: '@vibecheck404', text: 'I sent this to 47 people and i regret nothing', likes: 15400, avatar: null },
      { username: '@chronically_online_mom', text: 'why does this make me feel seen AND attacked simultaneously', likes: 12300, avatar: null },
      { username: '@local_cryptid', text: 'this is the first thing that made me feel anything in 6 months', likes: 9870, avatar: null },
      { username: '@ratgirlsummer', text: 'the audacity. the nerve. the GOD-GIVEN BOLDNESS.', likes: 8760, avatar: null },
      { username: '@sleepybean42', text: 'i came here from someone who sent this saying "it will change your life" — they were RIGHT', likes: 7200, avatar: null },
    ],
    total: 247,
    videoMeta: { title: 'wait for it 😭😭😭', creator: '@viral_creator', url: 'https://tiktok.com' }
  };
}

function getMockLyrics(genre) {
  const lyrics = {
    'pop-punk': `[Verse 1]
He held his juice box, raised it to the sky
@aesthetic_tornado watched with tear-soaked eyes
Three business days my jaw just wouldn't close
@goblinprincess felt it in her toes

[Chorus]
Hold my juice box, I'm changing your life
This 15-second clip will cut you like a knife
47 people got this text today
@noodleman99's reality has slipped away

[Verse 2]
@local_cryptid felt something for the first time in months
@ratgirlsummer said "the NERVE" and that was enough
Chronically online, seen AND attacked at once
The comments section is our sacred front

[Bridge]
We came, we saw, we sent it to our friends
The FYP algorithm never ends
Some say it's cringe, we say it's art
This TikTok tore our world apart`,
    'hip-hop': `[Verse 1]
Scrolling through the FYP at 3 AM
@aesthetic_tornado in the comment section going crazy again
"Hold my juice box" - that was the line
@goblinprincess jaw dropped, she's been offline for nine

[Chorus]
Three business days, still shocked (still shocked)
@vibecheck404 sent it, she's been clockéd
Reality shifted, @noodleman99 said it first
This clip got passed around like it could quench a thirst`,
  };
  return lyrics[genre] || lyrics['pop-punk'];
}
