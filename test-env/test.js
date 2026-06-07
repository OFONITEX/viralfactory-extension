const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('../popup.html', 'utf8');
const js = fs.readFileSync('../popup.js', 'utf8');

const dom = new JSDOM(html, { runScripts: 'dangerously' });
const window = dom.window;

// Mock chrome API
window.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        if (typeof keys === 'string') keys = [keys];
        const res = {};
        keys.forEach(k => res[k] = {});
        cb(res);
      },
      set: (obj, cb) => { if(cb) cb(); }
    }
  },
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: () => {}
  },
  tabs: {
    query: async () => [{ id: 1, url: 'https://www.tiktok.com/@user/video/123' }],
    sendMessage: (id, msg, cb) => {
      if (msg.type === 'GET_VIDEO_META') cb({ title: 'Test', creator: 'test', likes: '1k' });
    }
  }
};

try {
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = js;
  window.document.body.appendChild(scriptEl);

  // Trigger DOMContentLoaded manually
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  setTimeout(() => {
    const errorDot = window.document.getElementById('statusDot').className;
    const errorText = window.document.getElementById('statusText').textContent;
    const title = window.document.getElementById('videoTitle').textContent;
    
    console.log('Status:', errorDot);
    console.log('Text:', errorText);
    console.log('Title:', title);
    
    if (errorDot.includes('error')) {
      console.error('Initialization failed!');
      process.exit(1);
    } else {
      console.log('Initialization successful!');
      process.exit(0);
    }
  }, 100);
} catch (e) {
  console.error('Crash during script execution:', e);
  process.exit(1);
}
