# 🎵 ViralFactory — Chrome Extension

> Turn any TikTok comment section into an AI-generated song, then post it everywhere.

## How it works

1. **Open a TikTok video** in Chrome
2. **Click the ViralFactory extension** icon
3. Hit **Scrape Comments** — reads the live TikTok DOM via content script
4. **Choose a genre** (pop-punk, hip-hop, country, opera, death metal…)
5. **Gemini writes the lyrics** using the funniest comments
6. **Suno generates the music** (AI vocals + instruments)
7. **Canvas renders a video** with scrolling comment bubbles + waveform
8. **Post to TikTok, YouTube, and Facebook** in one click

## Install in Chrome (Developer Mode)

1. Clone or download this folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `viralfactory-extension` folder
6. The 🎵 icon appears in your toolbar

## API Keys Setup

Click the ⚙️ gear icon in the extension popup:

| Key | Where to get it | Required? |
|-----|----------------|-----------|
| **Gemini API Key** | [aistudio.google.com](https://aistudio.google.com) | ✅ Yes |
| **Suno API Key** | [suno.ai](https://suno.ai) developer access | Optional (demo lyrics only) |
| **Facebook Access Token** | [developers.facebook.com](https://developers.facebook.com) → Graph API Explorer | Optional |
| **YouTube OAuth Token** | [console.cloud.google.com](https://console.cloud.google.com) → YouTube Data API v3 | Optional |
| **TikTok Session Cookie** | TikTok DevTools → Application → Cookies → `sessionid` | Optional |

All keys are stored in `chrome.storage.local` (never sent anywhere except the respective APIs).

## Architecture (client-side only)

```
popup.html / popup.js     ← Main UI (360px popup)
  │
  ├── content.js           ← Injected into TikTok tab
  │     └── Reads comment DOM, scrapes avatars & text
  │
  ├── background.js        ← Service worker
  │     └── Proxies API calls to bypass CORS
  │
  └── APIs called:
        ├── generativelanguage.googleapis.com → Gemini (lyrics)
        ├── api.suno.ai        → Suno (music)
        ├── graph.facebook.com → FB publish
        ├── googleapis.com     → YouTube publish
        └── tiktokapis.com     → TikTok publish
```

## Files

```
viralfactory-extension/
├── manifest.json     ← Chrome Extension Manifest v3
├── popup.html        ← Extension popup UI
├── popup.css         ← Dark neon styling
├── popup.js          ← Full pipeline logic
├── content.js        ← TikTok DOM scraper
├── background.js     ← Service worker / API proxy
└── icons/            ← Extension icons (add your own PNGs)
```

## Known Limitations

- **TikTok scraping**: TikTok's DOM changes frequently. If scraping fails, the extension falls back to demo mode.
- **Suno API**: Suno's API is in limited access. Sign up at suno.ai for API keys.
- **TikTok Publishing**: Requires TikTok Developer Program approval for the Content Posting API.
- **Video rendering**: Currently uses HTML Canvas for preview. For production MP4 export, integrate FFmpeg.wasm.
- **CORS**: All API calls route through the background service worker to bypass CORS restrictions.

## Adding Real Icons

Generate PNG icons and place in `/icons/`:
- `icon16.png` (16×16)
- `icon48.png` (48×48)  
- `icon128.png` (128×128)

Or use any emoji-to-PNG converter online.

## License

MIT — build on top of this, ship it, make money, give us credit 🙏

## Recent Enhancements & Modifications

We recently completed a comprehensive overhaul of both the Chrome extension (to resolve core bugs and security warnings) and the landing page UI (for a premium, high-converting aesthetic).

### 🛠️ Chrome Extension Fixes
* **CORS & Audio Fetching:** Rewrote asset loading to proxy audio fetches through the background service worker (`background.js`), bypassing security context blocks.
* **TikTok Scraping:** Patched the content script DOM parsing logic (`content.js`) to target updated TikTok layout nodes, recovering video metadata, user comments, and creator avatars dynamically.
* **Video Recording stability:** Resolved canvas recording buffer crashes in `popup.js` by transitioning to a unified blob stream pipeline using `MediaRecorder` with fixed standard encoding profiles.

### 🎨 Premium Landing Page UI Overhaul
* **The Effortless Loop (Process Timeline):**
  * Consolidated the 4 process steps into a unified glassmorphic container panel.
  * Designed sequential staggered entries utilizing Framer Motion: steps glide up sequentially from the bottom at 2-second intervals when scrolled into view.
  * Replaced grid layouts with wide horizontal rows (numbered badge + copy left, interactive animated SVG right).
* **WebGL Image Hover Warp Shaders:**
  * Implemented a custom high-performance React component (`WarpingImage.jsx`) running raw vanilla WebGL shaders.
  * When hovered, images undergo a coordinate-warping liquid ripple and center-grid pinch distortion, accompanied by chromatic aberration.
* **Glassmorphic frosted-glass Title Overlays:**
  * Embedded descriptive titles on top of the images.
  * Labels react dynamically to hovering with scale swelling (`scale(1.06)`) and glowing purple backlight shifts.
