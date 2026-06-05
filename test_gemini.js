const https = require('https');

// Put your key here to test
const YOUR_GEMINI_API_KEY = process.argv[2] || ''; 

if (!YOUR_GEMINI_API_KEY) {
  console.error("\n❌ Error: Please provide your Gemini API key as an argument:\n   node test_gemini.js YOUR_API_KEY_HERE");
  process.exit(1);
}

console.log("🚀 Testing Gemini 2.5 Flash API with safety-relaxed settings and structured system instructions...");

const systemPrompt = `You are a comedy songwriter. You write funny, catchy songs based on TikTok comments. 
Return ONLY the song lyrics, no explanations. You MUST write at least 2 verses and a chorus.`;

const userPrompt = `Write a pop-punk song based on these TikTok comments.
Context: TikTok video by @viral_creator
Top comments:
Comment 1: "Imagine laughing at your own comedy 😭😂😂"
Comment 2: "He didn’t save her because una no bring afang soup"
Comment 3: "TikTok sweet pass Netflix 😂🤣"
Comment 4: "[Sticker] The patients husband after seeing the cutlass😂😂😂"
Comment 5: "He never talk I don Dey laugh 😭😩😂😂"
Comment 6: "armed and dangerous"
Comment 7: "[Sticker] We conduct all that we can conduct 😂"
Comment 8: "[Sticker] he should have come close so he can go and meet his wife 😂😂"
Comment 9: "Bring me back even if na insult I dey on top man 😹"
Comment 10: "This guy reading this go be multi millionaire this year."
Comment 11: "Him laughing at himself always makes it funnier 😂"
Comment 12: "why u dey always laugh for your skit"
Comment 13: "Sorry to disturb your Scrolling May GOD heal you from everything unseen pains that you're suffering from All Alone.🤲🙏"
Comment 14: "akwaman I love your contents but I don’t get time to watch because of school so I have decided to stop schooling in order to get more time for your contents😭❤️"
Comment 15: "I was thinking… what if we create a group just for active users? Each member can share one post a day in the group, and everyone has to engage with it. Imagine 500 members once you post, within 5–10 minutes you’re already sitting on 500 likes and 500 comments! Who’s in?😌😌"
Comment 16: "Took me 4hours pls like😭😂"
Comment 17: "Be patient before you become a patient too 😅"
Comment 18: "E no funny"
Comment 19: "[Sticker] Funnest content creator on Tiktok"
Comment 20: "why are you smiling 🤣"`;

const payload = JSON.stringify({
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
});

const req = https.request({
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${YOUR_GEMINI_API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (res.statusCode !== 200) {
        console.error(`\n❌ Gemini API Error (HTTP ${res.statusCode}):`, data.error?.message || data);
      } else {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("\n✅ Success! Candidate Details:\n");
        console.log(JSON.stringify(data?.candidates?.[0], null, 2));
        console.log("----------------------------------------------------------------------");
      }
    } catch (e) {
      console.error("\n❌ Failed to parse response JSON. Response body:\n", body);
    }
  });
});

req.on('error', (e) => {
  console.error("\n❌ Network Error:", e.message);
});

req.write(payload);
req.end();
