// ViralFactory - Content Script
// Runs on TikTok pages to scrape comments from the live DOM

(function () {
  'use strict';

  let floatingContainer = null;
  let floatingPanel = null;

  // Listen for scrape requests and panel toggles from the background/popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_COMMENTS') {
      scrapeComments().then(sendResponse).catch(err =>
        sendResponse({ error: err.message })
      );
      return true;
    }

    if (message.type === 'GET_VIDEO_META') {
      sendResponse(getVideoMeta());
    }

    if (message.type === 'TOGGLE_WIDGET') {
      toggleFloatingWidget();
    }
  });

  // ─── Scrape comments from TikTok DOM ───────────────────────────────────────

  async function scrapeComments() {
    // Scroll comment panel to load more
    await scrollCommentPanel();

    const comments = [];
    const seen = new Set();

    // TikTok comment selectors (updated for current DOM structure)
    const commentSelectors = [
      '[data-e2e="comment-list"] [data-e2e="comment-item"]',
      '.DivCommentItemWrapper',
      '[class*="CommentItem"]',
      '[class*="comment-item"]',
    ];

    let commentNodes = [];
    for (const sel of commentSelectors) {
      commentNodes = document.querySelectorAll(sel);
      if (commentNodes.length > 0) break;
    }

    // Fallback: grab any element containing comment-like structure
    if (commentNodes.length === 0) {
      commentNodes = document.querySelectorAll('[data-e2e*="comment"]');
    }

    commentNodes.forEach((node, i) => {
      try {
        // Username
        const userEl = node.querySelector(
          '[data-e2e="comment-username-1"], [class*="author"], [class*="Username"], [href*="/@"]'
        );
        const username = userEl?.textContent?.trim() || userEl?.getAttribute('href')?.replace('/@', '@') || `user_${i}`;

        // Comment text
        const textSelectors = [
          '[data-e2e="comment-display"]',
          '[data-e2e="comment-level-1"]',
          '[class*="CommentText"]',
          '[class*="comment-text"]',
          '[class*="CommentDisplay"]',
          '[class*="CommentContent"]',
          'p',
          'span'
        ];
        
        let text = "";
        for (const sel of textSelectors) {
          const el = node.querySelector(sel);
          if (el) {
            // Avoid picking up the username if it's nested
            if (el.querySelector('[data-e2e="comment-username-1"], [class*="author"]')) {
              // If it's a container, try to find a sub-element that is just the text
              const sub = el.querySelector('span:not([class*="author"]), p');
              if (sub) {
                text = sub.textContent?.trim();
                if (text) break;
              }
            } else {
              text = el.textContent?.trim();
              if (text) break;
            }
          }
        }
        if (!text || seen.has(text)) return;
        seen.add(text);

        // Avatar
        const avatarEl = node.querySelector('img[src*="tiktok"], img[src*="muscdn"], img[class*="avatar"], img[class*="Avatar"]');
        const avatar = avatarEl?.src || null;

        // Likes
        const likeEl = node.querySelector('[data-e2e="comment-like-count"], [class*="like"], [class*="Like"]');
        const likes = parseLikeCount(likeEl?.textContent?.trim() || '0');

        if (text && username) {
          comments.push({ username, text, avatar, likes, index: i });
        }
      } catch (e) {
        // Skip malformed comment nodes
      }
    });

    // Sort by likes, take top 30
    const sorted = comments.sort((a, b) => b.likes - a.likes).slice(0, 30);

    return {
      comments: sorted,
      total: commentNodes.length,
      videoMeta: getVideoMeta()
    };
  }

  function getVideoMeta() {
    // Try to extract video title and creator from page
    const titleEl = document.querySelector(
      '[data-e2e="browse-video-desc"], [class*="DivVideoDesc"], [class*="video-desc"], h1[class*="Title"], .video-meta-title'
    );
    const creatorEl = document.querySelector(
      '[data-e2e="browse-username"], [data-e2e="video-author"], [class*="AuthorTitle"], [class*="author-uniqueid"], [class*="SpanUniqueId"]'
    );
    const videoEl = document.querySelector('video');

    return {
      title: titleEl?.textContent?.trim() || document.title.split(' | ')[0] || 'TikTok Video',
      creator: creatorEl?.textContent?.trim() || 'Unknown Creator',
      url: window.location.href,
      videoSrc: videoEl?.src || null,
    };
  }

  async function scrollCommentPanel() {
    // Find the scrollable comment container
    const scrollSelectors = [
      '[data-e2e="comment-list"]',
      '[class*="DivCommentList"]',
      '[class*="comment-list"]',
    ];

    let panel = null;
    for (const sel of scrollSelectors) {
      panel = document.querySelector(sel);
      if (panel) break;
    }

    if (!panel) return;

    // Scroll down 6 times to load way more comments dynamically
    for (let i = 0; i < 6; i++) {
      panel.scrollTop += 1200;
      await sleep(500);
    }
    panel.scrollTop = 0;
  }

  function parseLikeCount(str) {
    if (!str) return 0;
    str = str.replace(/,/g, '').trim().toLowerCase();
    if (str.includes('k')) return parseFloat(str) * 1000;
    if (str.includes('m')) return parseFloat(str) * 1000000;
    return parseInt(str) || 0;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function toggleFloatingWidget() {
    if (floatingContainer) {
      if (floatingContainer.style.display === 'none') {
        floatingContainer.style.display = 'block';
      } else {
        floatingContainer.style.display = 'none';
      }
      return;
    }

    // Create the host container in document.body
    floatingContainer = document.createElement('div');
    floatingContainer.id = 'vf-floating-container';
    
    // Style the host container (fixed position, z-index)
    Object.assign(floatingContainer.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      width: '380px',
      height: '640px',
      zIndex: '2147483647',
      pointerEvents: 'auto'
    });

    // Attach closed shadow root to isolate from TikTok scripts
    const shadowRoot = floatingContainer.attachShadow({ mode: 'closed' });

    // Create the actual panel div inside the shadow root
    floatingPanel = document.createElement('div');
    floatingPanel.id = 'vf-floating-panel';
    
    // Style the container beautifully (sleek glassmorphic dark theme)
    Object.assign(floatingPanel.style, {
      width: '100%',
      height: '100%',
      backgroundColor: '#121319', // Sleek rich dark
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '16px',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });

    // Create the header handle bar for dragging
    const header = document.createElement('div');
    header.id = 'vf-floating-header';
    Object.assign(header.style, {
      padding: '12px 16px',
      backgroundColor: '#0c0d12',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      cursor: 'move',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      userSelect: 'none'
    });

    // Title and icon in header
    const title = document.createElement('div');
    title.innerHTML = '🎵 <span style="font-weight:700;background:linear-gradient(90deg, #FF3366, #00E5FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">ViralFactory</span>';
    title.style.fontSize = '14px';
    header.appendChild(title);

    // Right buttons group
    const rightGroup = document.createElement('div');
    Object.assign(rightGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️';
    Object.assign(settingsBtn.style, {
      background: 'none',
      border: 'none',
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: '14px',
      cursor: 'pointer',
      padding: '4px',
      transition: 'color 0.2s, transform 0.2s',
      outline: 'none'
    });
    settingsBtn.onmouseover = () => {
      settingsBtn.style.color = '#00E5FF';
      settingsBtn.style.transform = 'rotate(45deg)';
    };
    settingsBtn.onmouseout = () => {
      settingsBtn.style.color = 'rgba(255, 255, 255, 0.6)';
      settingsBtn.style.transform = 'rotate(0deg)';
    };
    settingsBtn.onclick = () => {
      iframe.contentWindow.postMessage({ type: 'OPEN_SETTINGS' }, '*');
    };
    rightGroup.appendChild(settingsBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: '16px',
      cursor: 'pointer',
      padding: '4px 8px',
      transition: 'color 0.2s',
      outline: 'none'
    });
    closeBtn.onmouseover = () => closeBtn.style.color = '#FF3366';
    closeBtn.onmouseout = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    closeBtn.onclick = () => {
      floatingContainer.style.display = 'none';
    };
    rightGroup.appendChild(closeBtn);

    header.appendChild(rightGroup);
    floatingPanel.appendChild(header);

    // Create the iframe
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    Object.assign(iframe.style, {
      border: 'none',
      width: '100%',
      height: '100%',
      backgroundColor: 'transparent'
    });
    floatingPanel.appendChild(iframe);

    shadowRoot.appendChild(floatingPanel);
    document.body.appendChild(floatingContainer);

    // Position persistence
    chrome.storage.local.get('vf_panel_pos', ({ vf_panel_pos }) => {
      if (vf_panel_pos) {
        floatingContainer.style.top = vf_panel_pos.top;
        floatingContainer.style.left = vf_panel_pos.left;
        floatingContainer.style.right = 'auto';
        floatingContainer.style.bottom = 'auto';
      }
    });

    // Drag-and-drop implementation
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      iframe.style.pointerEvents = 'none';
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = floatingContainer.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      
      floatingContainer.style.right = 'auto';
      floatingContainer.style.bottom = 'auto';
      floatingContainer.style.left = `${initialLeft}px`;
      floatingContainer.style.top = `${initialTop}px`;
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;
      
      newLeft = Math.max(0, Math.min(window.innerWidth - 380, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 640, newTop));
      
      floatingContainer.style.left = `${newLeft}px`;
      floatingContainer.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      iframe.style.pointerEvents = 'auto';
      isDragging = false;
      
      chrome.storage.local.set({
        vf_panel_pos: {
          top: floatingContainer.style.top,
          left: floatingContainer.style.left,
          right: 'auto',
          bottom: 'auto'
        }
      });
    });
  }

})();
