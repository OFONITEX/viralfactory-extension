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
  videoDownloaded: false,
  user: null,
  signupCallback: null,
};

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Leaked default key was removed. Users must provide their own key via Settings.
  const leakedKey = 'AIzaSyBeH2HUQvIhrh-Q1nvtbIm_bf5ZeJD23mM';
  chrome.storage.local.get('vf_keys', ({ vf_keys }) => {
    let keys = vf_keys || {};
    let keysChanged = false;

    // Automatically clear the leaked key from local storage if it is still saved
    if (keys.geminiKey === leakedKey || !keys.geminiKey) {
      keys.geminiKey = '';
      keysChanged = true;
    }

    if (keysChanged) {
      chrome.storage.local.set({ vf_keys: keys }, () => loadKeysIntoForm());
    } else {
      loadKeysIntoForm();
    }
  });
  
  setupSettingsPanel();
  setupGenrePicker();
  setupFormatPicker();
  setupNavButtons();
  setupPublishButtons();
  setupVideoDownloader();
  setupAuth();
  
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
    comments: state.comments.map(c => ({
      username: c.username,
      text: c.text,
      likes: c.likes,
      avatar: c.avatar
    })),
    selectedGenre: state.selectedGenre,
    lyrics: state.lyrics,
    audioUrl: state.audioUrl,
    videoUrl: state.videoUrl,
    caption: state.caption,
    videoDownloaded: state.videoDownloaded,
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
      state.comments = (vf_session.comments || []).map(c => ({
        username: c.username,
        text: c.text,
        likes: c.likes,
        avatar: c.avatar,
        avatarImg: null
      }));
      state.selectedGenre = vf_session.selectedGenre || 'pop-punk';
      state.lyrics = vf_session.lyrics || '';
      state.audioUrl = vf_session.audioUrl || null;
      state.videoUrl = vf_session.videoUrl || null;
      state.caption = vf_session.caption || '';
      state.videoDownloaded = vf_session.videoDownloaded || false;
      
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
        preloadAvatars(state.comments);
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
        document.getElementById('lyricsBox').value = state.lyrics;
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
        
        // Restore download button UI state
        const downloadBtn = document.getElementById('downloadVideoBtn');
        if (downloadBtn) {
          downloadBtn.style.display = 'block';
          if (state.videoDownloaded) {
            downloadBtn.innerHTML = '✓ Video Downloaded Successfully';
            downloadBtn.style.background = 'linear-gradient(135deg, #00E676 0%, #00C853 100%)';
            downloadBtn.disabled = false;
            
            const goToPublish = document.getElementById('goToPublish');
            if (goToPublish) {
              goToPublish.disabled = false;
              goToPublish.style.opacity = '1';
              goToPublish.style.cursor = 'pointer';
            }
          } else {
            downloadBtn.innerHTML = '📥 Download Rendered Video';
            downloadBtn.style.background = 'linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%)';
            downloadBtn.disabled = false;
            
            const goToPublish = document.getElementById('goToPublish');
            if (goToPublish) {
              goToPublish.disabled = true;
              goToPublish.style.opacity = '0.5';
              goToPublish.style.cursor = 'not-allowed';
            }
          }
        }
      }
      // Restore video UI
      if (state.videoUrl) {
        const videoPlayer = document.getElementById('sunoVideoPlayer');
        if (videoPlayer) {
          videoPlayer.src = state.videoUrl;
          videoPlayer.muted = true;
          videoPlayer.loop = true;
          videoPlayer.classList.add('hidden');
        }
        const canvas = document.getElementById('videoCanvas');
        if (canvas) canvas.classList.remove('hidden');
        
        setTimeout(() => drawVideoPreview(), 100);
      } else if (state.videoMeta?.videoSrc) {
        prepareTikTokBackgroundVideo();
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
    document.getElementById('lyricsBox').value = '';
    
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

// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://pescssnflhgodwrdacja.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UD46OHsij9Q-O4nbnGqEOg_rCkM-Yak';

async function supabaseSignUp(name, email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password, data: { full_name: name } })
  });
  return res.json();
}

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function supabaseSignOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` }
  }).catch(() => {});
}

// --- AUTHENTICATION GATING & SIGN-UP ---
function setupAuth() {
  const modal = document.getElementById('signupModal');
  const closeBtn = document.getElementById('closeSignup');
  const submitSignUpBtn = document.getElementById('submitSignup');
  const submitSignInBtn = document.getElementById('submitSignIn');
  const openSignupBtn = document.getElementById('openSignupBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const switchToSignIn = document.getElementById('switchToSignIn');
  const switchToSignUp = document.getElementById('switchToSignUp');

  chrome.storage.local.get('vf_session', ({ vf_session }) => {
    if (vf_session && vf_session.access_token) { state.user = vf_session; updateAuthUI(true); }
    else { state.user = null; updateAuthUI(false); }
  });

  if (switchToSignIn) switchToSignIn.onclick = (e) => {
    e.preventDefault();
    document.getElementById('authSignUpFields').classList.add('hidden');
    document.getElementById('authSignInFields').classList.remove('hidden');
    document.getElementById('authModalTitle').textContent = 'Welcome Back';
    document.getElementById('authError').classList.add('hidden');
  };
  if (switchToSignUp) switchToSignUp.onclick = (e) => {
    e.preventDefault();
    document.getElementById('authSignInFields').classList.add('hidden');
    document.getElementById('authSignUpFields').classList.remove('hidden');
    document.getElementById('authModalTitle').textContent = 'Unlock ViralFactory';
    document.getElementById('authError').classList.add('hidden');
  };

  if (closeBtn) closeBtn.onclick = () => { modal.classList.add('hidden'); state.signupCallback = null; };
  if (openSignupBtn) openSignupBtn.onclick = () => { document.getElementById('settingsPanel').classList.add('hidden'); modal.classList.remove('hidden'); };

  if (signOutBtn) signOutBtn.onclick = async () => {
    if (state.user && state.user.access_token) await supabaseSignOut(state.user.access_token);
    chrome.storage.local.remove('vf_session', () => { state.user = null; updateAuthUI(false); saveSession(); });
  };

  if (submitSignUpBtn) submitSignUpBtn.onclick = async () => {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    if (!email || !password) { showAuthError('Please fill in all fields.'); return; }
    if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
    submitSignUpBtn.textContent = 'Creating account...'; submitSignUpBtn.disabled = true;
    try {
      const data = await supabaseSignUp(name, email, password);
      if (data.error) { showAuthError(data.error.message || data.error); return; }
      const session = data.session || {}; const user = data.user || {};
      const stored = { access_token: session.access_token, refresh_token: session.refresh_token, email: user.email, id: user.id, plan: 'free' };
      chrome.storage.local.set({ vf_session: stored }, () => {
        state.user = stored; updateAuthUI(true); modal.classList.add('hidden');
        if (state.signupCallback) { const cb = state.signupCallback; state.signupCallback = null; cb(); }
      });
    } catch(e) { showAuthError('Network error. Please try again.'); }
    submitSignUpBtn.textContent = 'Create Account & Unlock'; submitSignUpBtn.disabled = false;
  };

  if (submitSignInBtn) submitSignInBtn.onclick = async () => {
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
    submitSignInBtn.textContent = 'Signing in...'; submitSignInBtn.disabled = true;
    try {
      const data = await supabaseSignIn(email, password);
      if (data.error || !data.access_token) { showAuthError(data.error_description || 'Invalid email or password.'); submitSignInBtn.textContent = 'Sign In'; submitSignInBtn.disabled = false; return; }
      const stored = { access_token: data.access_token, refresh_token: data.refresh_token, email: data.user.email, id: data.user.id, plan: data.user.user_metadata?.plan || 'free' };
      chrome.storage.local.set({ vf_session: stored }, () => {
        state.user = stored; updateAuthUI(true); modal.classList.add('hidden');
        if (state.signupCallback) { const cb = state.signupCallback; state.signupCallback = null; cb(); }
      });
    } catch(e) { showAuthError('Network error. Please try again.'); }
    submitSignInBtn.textContent = 'Sign In'; submitSignInBtn.disabled = false;
  };

  const autoOpenPref = document.getElementById('autoOpenPref');
  if (autoOpenPref) {
    chrome.storage.local.get('vf_auto_open_disabled', (data) => { autoOpenPref.checked = !data.vf_auto_open_disabled; });
    autoOpenPref.onchange = () => { chrome.storage.local.set({ vf_auto_open_disabled: !autoOpenPref.checked }); };
  }
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function updateAuthUI(isAuthenticated) {
  const infoSection = document.getElementById('accountInfoSection');
  const promptSection = document.getElementById('accountRegisterPrompt');
  const emailText = document.getElementById('userEmailText');
  if (isAuthenticated && state.user) {
    if (infoSection) infoSection.classList.remove('hidden');
    if (promptSection) promptSection.classList.add('hidden');
    if (emailText) emailText.textContent = `Signed in as: ${state.user.email}`;
  } else {
    if (infoSection) infoSection.classList.add('hidden');
    if (promptSection) promptSection.classList.remove('hidden');
  }
}

function checkAuth(callback) {
  if (state.user) { callback(); }
  else {
    const modal = document.getElementById('signupModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('authSignInFields')?.classList.add('hidden');
      document.getElementById('authSignUpFields')?.classList.remove('hidden');
      state.signupCallback = callback;
    }
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
  if(document.getElementById('saveSettings')) document.getElementById('saveSettings').onclick = saveKeys;
  if(document.getElementById('resetSessionBtn')) document.getElementById('resetSessionBtn').onclick = resetSession;
}

function saveKeys() {
  const keys = {
    fbToken: document.getElementById('fbToken')?.value.trim() || '',
    ytToken: document.getElementById('ytToken')?.value.trim() || '',
    ttSession: document.getElementById('ttSession')?.value.trim() || ''
  };
  chrome.storage.local.get('vf_keys', (data) => {
    const existing = data.vf_keys || {};
    const merged = { ...existing, ...keys };
    chrome.storage.local.set({ vf_keys: merged }, () => {
      const confirm = document.getElementById('saveConfirm');
      if(confirm) {
        confirm.classList.remove('hidden');
        setTimeout(() => confirm.classList.add('hidden'), 2000);
      }
    });
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

async function getKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vf_keys', 'vf_remote_config'], (data) => {
      const localKeys = data.vf_keys || {};
      const remoteConfig = data.vf_remote_config || {};
      const remoteKeys = remoteConfig.apiKeys || {};
      
      resolve({
        ...localKeys,
        geminiKey: remoteKeys.gemini || '',
        sunoKey: remoteKeys.suno || '',
        groqKey: remoteKeys.groq || '',
        sunoCallbackUrl: remoteKeys.sunoCallbackUrl || ''
      });
    });
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
  document.getElementById('lyricsBox').value = '';
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
      preloadAvatars(state.comments);
      prepareTikTokBackgroundVideo();

      document.getElementById('commentCount').textContent = state.comments.length;
      preview.classList.remove('hidden');
      saveSession();
    });
  } catch (e) {
    // Fall back to mock data
    const mock = getMockComments();
    state.comments = mock.comments;
    renderCommentList(state.comments);
    preloadAvatars(state.comments);
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

  const nameDrop = false; // Always false, only comment text is used for lyrics generation
  const clean = document.getElementById('cleanToggle').checked;
  const extra = document.getElementById('extraPrompt').value.trim();

  // Only the comment text is used for the lyrics generation, no names or likes
  const topComments = state.comments.slice(0, 20).map((c, i) =>
    `Comment ${i + 1}: "${c.text}"`
  ).join('\n');

  const videoContext = state.videoMeta
    ? `Video: "${state.videoMeta.title}" by ${state.videoMeta.creator}`
    : 'TikTok video';

  const systemPrompt = `You are a comedy songwriter. You write funny, catchy songs based on TikTok comments. 
Your songs are witty, relatable, and designed to go viral. Always write in the requested genre.
${clean ? 'Keep lyrics clean and safe for work.' : 'Light profanity is fine if funny.'}
Return ONLY the song lyrics, no explanations. You MUST write at least 2 verses and a chorus. Include [Verse 1], [Chorus], [Verse 2], and optionally [Bridge] or [Outro] labels.`;

  const userPrompt = `Write a ${state.selectedGenre} song based on these TikTok comments.

Context: ${videoContext}

Top comments:
${topComments}

Weave the context, themes, and hilarious observations from all of these comments into the lyrics. Do NOT include, mention, or write any commenter usernames (like @username) or likes in the lyrics themselves. Only use the text content and ideas of the comments.
${extra ? `Extra notes: ${extra}` : ''}

You MUST write a complete, full-length song structure containing at least:
1. [Verse 1] (Incorporating early comments)
2. [Chorus] (Memorable, catchy, viral hooks)
3. [Verse 2] (Weaving remaining comments)
4. [Chorus]
5. [Outro] (A funny closing line based on the comments)

Make sure to generate the complete lyrics without truncation or placeholders. Make it funny, punchy, and perfect for a 60-second video. Give it a memorable chorus.`;

  let lyricsText = '';
  let geminiSuccess = false;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'FETCH_API',
      payload: {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          contents: [{
            role: 'user',
            parts: [{ text: userPrompt }]
          }],
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ],
          generationConfig: {
            temperature: 0.8
          }
        }
      }
    });

    if (res && res.ok && res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      lyricsText = res.data.candidates[0].content.parts[0].text;
      geminiSuccess = true;
    } else {
      console.warn('Gemini request failed, trying Groq fallback...', res?.error || res?.data?.error?.message);
    }
  } catch (e) {
    console.warn('Gemini request errored out, trying Groq fallback...', e);
  }

  if (!geminiSuccess) {
    if (keys.groqKey) {
      console.log('Falling back to Groq AI (llama-3.3-70b-versatile)...');
      const loadingTextEl = document.querySelector('#composeLoading .loading-text');
      const originalLoadingText = loadingTextEl ? loadingTextEl.textContent : 'Gemini is feeling inspired...';
      if (loadingTextEl) loadingTextEl.textContent = 'Gemini was busy. Falling back to Groq...';

      try {
        const groqRes = await chrome.runtime.sendMessage({
          type: 'FETCH_API',
          payload: {
            url: 'https://api.groq.com/openai/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${keys.groqKey}`
            },
            body: {
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.8
            }
          }
        });

        if (loadingTextEl) loadingTextEl.textContent = originalLoadingText;

        if (groqRes && groqRes.ok && groqRes.data?.choices?.[0]?.message?.content) {
          lyricsText = groqRes.data.choices[0].message.content;
        } else {
          const errorMsg = groqRes?.data?.error?.message || groqRes?.error || 'Unknown Groq error';
          alert('Failed to generate lyrics. Gemini is busy, and Groq fallback failed: ' + errorMsg);
          loading.classList.add('hidden');
          composeBtn.disabled = false;
          return;
        }
      } catch (groqErr) {
        if (loadingTextEl) loadingTextEl.textContent = originalLoadingText;
        alert('Failed to generate lyrics. Gemini is busy, and Groq fallback request failed: ' + groqErr.message);
        loading.classList.add('hidden');
        composeBtn.disabled = false;
        return;
      }
    } else {
      alert('Gemini is currently busy or experiencing high demand. Please add your Groq API key in Settings as a fallback!');
      loading.classList.add('hidden');
      composeBtn.disabled = false;
      return;
    }
  }

  loading.classList.add('hidden');
  composeBtn.disabled = false;

  state.lyrics = lyricsText;
  document.getElementById('lyricsBox').value = state.lyrics;
  result.classList.remove('hidden');
  saveSession();
}

let renderLoopId = null;

function startRenderLoop() {
  if (renderLoopId) cancelAnimationFrame(renderLoopId);

  function loop() {
    const audioEl = document.getElementById('audioPlayer');
    const videoEl = document.getElementById('sunoVideoPlayer');

    if (audioEl && videoEl && !audioEl.paused) {
      if (Math.abs(videoEl.currentTime - audioEl.currentTime) > 0.15) {
        videoEl.currentTime = audioEl.currentTime;
      }
    }

    const isAudioPlaying = audioEl && !audioEl.paused;
    const isVideoPlaying = videoEl && !videoEl.paused;

    drawVideoPreview(isAudioPlaying);

    if (isAudioPlaying || isVideoPlaying) {
      renderLoopId = requestAnimationFrame(loop);
    } else {
      renderLoopId = null;
    }
  }

  loop();
}

function getActiveLyricLine(lyrics, progress = 0) {
  if (!lyrics) return null;
  const lines = lyrics.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('['));
  if (lines.length === 0) return null;
  
  const index = Math.min(Math.floor(progress * lines.length), lines.length - 1);
  return lines[index] || null;
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
    const overlay = document.getElementById('canvasOverlay');
    if (overlay) overlay.style.display = 'none';

    const audioEl = document.getElementById('audioPlayer');
    const videoPlayer = document.getElementById('sunoVideoPlayer');

    if (audioEl && state.audioUrl) {
      audioEl.src = state.audioUrl;
      audioEl.classList.remove('hidden');

      if (videoPlayer && state.videoUrl) {
        videoPlayer.src = state.videoUrl;
        videoPlayer.muted = true;
        videoPlayer.loop = true;
        videoPlayer.classList.add('hidden');
        videoPlayer.load();

        audioEl.onplay = () => {
          videoPlayer.play();
          startRenderLoop();
        };
        audioEl.onpause = () => {
          videoPlayer.pause();
        };
        audioEl.onseeking = () => {
          videoPlayer.currentTime = audioEl.currentTime;
        };
        audioEl.onseeked = () => {
          videoPlayer.currentTime = audioEl.currentTime;
        };
      }

      audioEl.play().catch(e => console.log('Audio playback deferred:', e));
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

  if (customMode) {
    const edited = document.getElementById('lyricsBox')?.value;
    if (edited) {
      state.lyrics = edited;
      saveSession();
    }
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
    
    // Explicitly preserve our downloaded TikTok video in state.videoUrl and keep canvas active!
    if (videoPlayer) {
      if (state.videoUrl) {
        videoPlayer.src = state.videoUrl;
        videoPlayer.muted = true;
        videoPlayer.loop = true;
        videoPlayer.load();
      }
      videoPlayer.classList.add('hidden');
    }
    if (canvas) canvas.classList.remove('hidden');
    if (overlay) overlay.style.display = 'flex';
    
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
    
    // Show download button on Suno success
    const downloadBtn = document.getElementById('downloadVideoBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'block';
      downloadBtn.innerHTML = '📥 Download Rendered Video';
      downloadBtn.style.background = 'linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%)';
      downloadBtn.disabled = false;
    }
    const goToPublish = document.getElementById('goToPublish');
    if (goToPublish) {
      goToPublish.disabled = true;
      goToPublish.style.opacity = '0.5';
      goToPublish.style.cursor = 'not-allowed';
    }
    
    saveSession();
    
    setTimeout(() => drawVideoPreview(), 100);
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

  // 1. Draw TikTok Background Video Frame if ready
  if (state.thumbnailImg) {
    // Draw the thumbnail image covering the canvas (object-fit: cover behavior)
    const imgRatio = state.thumbnailImg.width / state.thumbnailImg.height;
    const canvasRatio = W / H;
    let drawW = W, drawH = H, offsetX = 0, offsetY = 0;
    
    if (imgRatio > canvasRatio) {
      drawW = H * imgRatio;
      offsetX = (W - drawW) / 2;
    } else {
      drawH = W / imgRatio;
      offsetY = (H - drawH) / 2;
    }
    
    ctx.drawImage(state.thumbnailImg, offsetX, offsetY, drawW, drawH);
    
    // Low opacity tint for premium styling & high-contrast text readability
    ctx.fillStyle = 'rgba(12, 12, 18, 0.45)';
    ctx.fillRect(0, 0, W, H);
  } else {
    // Elegant fallback gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0C0C12');
    bg.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Logo watermark
  ctx.font = 'bold 11px DM Mono, monospace';
  ctx.fillStyle = 'rgba(255,51,102,0.8)';
  ctx.textAlign = 'right';
  ctx.fillText('🎵 ViralFactory', W - 10, 20);

  // Song title banner
  ctx.fillStyle = 'rgba(255,51,102,0.15)';
  roundRect(ctx, 10, 10, W - 20, 34, 8);
  ctx.fillStyle = '#FF3366';
  ctx.font = 'bold 13px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((state.videoMeta?.title || 'TikTok Banger 🔥').slice(0, 40), W / 2, 32);

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

    // Draw avatar circle (diameter 20px, left aligned)
    const avatarX = 26;
    const avatarY = y + 17;
    const avatarR = 10;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    if (c.avatarImg) {
      ctx.drawImage(c.avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      ctx.fillStyle = colors[i % colors.length] + '33';
      ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.font = 'bold 8px DM Mono, monospace';
      ctx.textAlign = 'center';
      const initials = (c.username || 'U').replace('@', '').slice(0, 2).toUpperCase();
      ctx.fillText(initials, avatarX, avatarY + 3);
    }
    ctx.restore();

    // Commenter name and text shifted to accommodate the avatar
    ctx.fillStyle = colors[i % colors.length];
    ctx.font = 'bold 9px DM Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText((c.username || '@user').slice(0, 20), 44, y + 13);
    ctx.fillStyle = 'rgba(240,240,248,0.8)';
    ctx.font = '9px DM Sans, sans-serif';
    const txt = (c.text || '').slice(0, 38) + (c.text?.length > 38 ? '…' : '');
    ctx.fillText(txt, 44, y + 25);
    ctx.globalAlpha = 1;
  });

  // Dynamic Lyrics Scrolling Highlights
  const audioEl = document.getElementById('audioPlayer');
  let progress = 0;
  if (audioEl && audioEl.duration) {
    progress = audioEl.currentTime / audioEl.duration;
  }
  const lyricLine = getActiveLyricLine(state.lyrics, progress);
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
  const creator = state.videoMeta?.creator || '@creator';
  const title = state.videoMeta?.title ? `"${state.videoMeta.title}"` : '';
  const genre = state.selectedGenre || 'pop-punk';
  const tags = '#ViralFactory #AIMusic #TikTok #Funny #FYP #MusicVideo';
  state.caption = `I turned ${creator}'s comment section into a ${genre} banger 🎵💀\n\nOriginal video by ${creator}: ${title}\n\nMade with ViralFactory — drop your fav TikTok link below 👇\n\n${tags}`;
  
  const el = document.getElementById('captionText');
  if (el) {
    el.value = state.caption;
  }
  saveSession();
}

// ─── PUBLISHING ────────────────────────────────────────────────────────────
function setupPublishButtons() {
  document.getElementById('ttPublishBtn').onclick = () => checkAuth(() => publishTo('tiktok'));
  document.getElementById('ytPublishBtn').onclick = () => checkAuth(() => publishTo('youtube'));
  document.getElementById('fbPublishBtn').onclick = () => checkAuth(() => publishTo('facebook'));
  document.getElementById('publishAllBtn').onclick = () => checkAuth(publishAll);
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
function preloadAvatars(comments) {
  if (!comments) return;
  comments.forEach(c => {
    if (c.avatar && !c.avatarImg) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = c.avatar;
      img.onload = () => {
        c.avatarImg = img;
        drawVideoPreview();
      };
      img.onerror = () => {
        c.avatarImg = null;
      };
    }
  });
}

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
      { username: '@pixel_pioneer', text: 'my last two remaining brain cells trying to process this masterpiece 🧠', likes: 6500, avatar: null },
      { username: '@dank_wizard', text: 'this is going straight into my absolute favorites playlist no questions asked', likes: 5900, avatar: null },
      { username: '@keyboard_warrior_99', text: 'i did not expect to get hit with this level of emotional damage today 😭', likes: 5200, avatar: null },
      { username: '@meme_archivist', text: 'this belongs in a history museum under modern classics', likes: 4900, avatar: null },
      { username: '@caffeine_addict_pete', text: 'i spit my iced coffee all over my keyboard and i am not even mad', likes: 4600, avatar: null },
      { username: '@shadow_lurker', text: 'bro is playing 4D chess while the rest of us are playing checkers ♟️', likes: 4100, avatar: null },
      { username: '@disco_duck', text: 'this has no right to be as incredibly catchy as it is', likes: 3800, avatar: null },
      { username: '@gaming_gandalf', text: 'i have watched this on repeat for the past two hours send help', likes: 3400, avatar: null },
      { username: '@recipe_ruiner', text: 'my cooking got burnt because I was too distracted laughing at this', likes: 2900, avatar: null },
      { username: '@unemployed_philosopher', text: 'if you think about it, this is a beautiful commentary on human nature', likes: 2500, avatar: null },
      { username: '@lost_tourist', text: 'i don’t know how i ended up on this side of tiktok but i’m staying', likes: 2100, avatar: null },
      { username: '@pajama_guru', text: 'this vibe is completely immaculate and unmatched 💫', likes: 1800, avatar: null }
    ],
    total: 312,
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

async function prepareTikTokBackgroundVideo() {
  if (!state.videoMeta || !state.videoMeta.poster) {
    console.warn('No TikTok poster found in metadata.');
    drawVideoPreview();
    return;
  }

  console.log('Loading TikTok video thumbnail for background...');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    state.thumbnailImg = img;
    drawVideoPreview();
    console.log('Thumbnail loaded successfully!');
  };
  img.onerror = () => {
    console.warn('Failed to load video thumbnail poster.');
    drawVideoPreview();
  };
  img.src = state.videoMeta.poster;
}

// ─── VIDEO DOWNLOADER & RECORDER ───────────────────────────────────────────
let mediaRecorder = null;
let recordedChunks = [];
let audioCtx = null;
let sourceNode = null;
let destNode = null;

function getAudioStream(audioEl) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    destNode = audioCtx.createMediaStreamDestination();
    sourceNode.connect(destNode);
    sourceNode.connect(audioCtx.destination);
  }
  return destNode.stream;
}

function setupVideoDownloader() {
  const downloadBtn = document.getElementById('downloadVideoBtn');
  const goToPublish = document.getElementById('goToPublish');
  const audioEl = document.getElementById('audioPlayer');
  const canvas = document.getElementById('videoCanvas');
  const videoPlayer = document.getElementById('sunoVideoPlayer');

  if (!downloadBtn) return;

  downloadBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('Recording stopped manually by user.');
      mediaRecorder.stop();
      return;
    }

    checkAuth(async () => {
      if (!state.audioUrl) {
        alert('Please generate the music first!');
        return;
      }

      console.log('Fetching audio via CORS proxy for capture...');
      recordedChunks = [];

      // Proxy audio through background worker to bypass CORS restrictions
      // This ensures MediaElementAudioSource captures real audio (not zeroes)
      let localAudioUrl = state.audioUrl;
      try {
        const proxyResult = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'FETCH_AUDIO_BLOB', url: state.audioUrl }, resolve);
        });
        if (proxyResult && proxyResult.ok && proxyResult.base64) {
          const byteChars = atob(proxyResult.base64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: proxyResult.mimeType });
          localAudioUrl = URL.createObjectURL(blob);
          console.log('Audio proxied successfully — CORS bypass active ✅');
        }
      } catch (e) {
        console.warn('Audio proxy failed, using original URL (audio may be silent):', e);
      }

      console.log('Starting high-quality Canvas + Audio rendering and capture stream...');

      // Load audio from local blob URL (no CORS restrictions)
      audioEl.crossOrigin = null; // not needed for blob URLs
      audioEl.src = localAudioUrl;
      audioEl.load();

      if (videoPlayer && state.videoUrl) {
        videoPlayer.src = state.videoUrl;
        videoPlayer.load();
      }

      // Capture Canvas stream at 30 FPS
      const canvasStream = canvas.captureStream(30);
      
      // Capture Audio stream
      let combinedStream = canvasStream;
      try {
        const audioStream = getAudioStream(audioEl);
        const tracks = [...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()];
        combinedStream = new MediaStream(tracks);
      } catch (err) {
        console.warn('Web Audio capture failed (fallback to canvas-only stream):', err);
      }

      // Initialize MediaRecorder
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }

      try {
        mediaRecorder = new MediaRecorder(combinedStream, options);
      } catch (e) {
        console.error('MediaRecorder initialization failed:', e);
        alert('Recording is not supported in this browser environment.');
        return;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Restore audio/video state
        audioEl.pause();
        if (videoPlayer) videoPlayer.pause();

        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(blob);

        // Create download element
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${state.videoMeta?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'ViralFactory_Video'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        // Mark as downloaded and unlock navigation
        state.videoDownloaded = true;
        saveSession();
        
        downloadBtn.innerHTML = '✓ Video Downloaded Successfully';
        downloadBtn.style.background = 'linear-gradient(135deg, #00E676 0%, #00C853 100%)';
        downloadBtn.disabled = false;

        goToPublish.disabled = false;
        goToPublish.style.opacity = '1';
        goToPublish.style.cursor = 'pointer';

        console.log('Video recording completed and downloaded!');
      };

      // Start recording
      mediaRecorder.start();
      
      let animationFrameId;
      const renderLoop = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          drawVideoPreview(true);
          animationFrameId = requestAnimationFrame(renderLoop);
        }
      };
      
      // Play audio/video sync
      audioEl.play().catch(e => console.log('Audio playback deferred:', e));
      if (videoPlayer) {
        videoPlayer.muted = true;
        videoPlayer.play().catch(e => console.log('Video playback deferred:', e));
      }
      
      renderLoop(); // Start the loop

      // Update button text to allow stopping
      downloadBtn.innerHTML = '⏹️ Recording Video (Click to Stop & Save)';
      downloadBtn.style.background = 'linear-gradient(135deg, #FF1744 0%, #D50000 100%)';

      // Auto-stop when audio track ends
      audioEl.onended = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          console.log('Recording finished automatically (audio ended).');
          cancelAnimationFrame(animationFrameId);
          mediaRecorder.stop();
        }
      };
    });
  };
}
