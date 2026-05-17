// ViralFactory - Content Script
// Runs on TikTok pages to scrape comments from the live DOM

(function () {
  'use strict';

  // Listen for scrape requests from the popup
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

    // Scroll down 3 times to load more comments
    for (let i = 0; i < 3; i++) {
      panel.scrollTop += 800;
      await sleep(600);
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

})();
