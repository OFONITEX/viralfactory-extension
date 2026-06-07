import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Play, TrendingUp, Zap, DollarSign, Globe, Sparkles, CheckCircle, Star } from 'lucide-react'
import './index.css'
import WarpingImage from './WarpingImage'

// Animated counter hook
function useCounter(target, duration = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])
  return [count, ref]
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } }
}

function StatCard({ value, label, prefix = '', suffix = '' }) {
  const [count, ref] = useCounter(value)
  return (
    <div className="stat-card" ref={ref}>
      <div className="stat-value">{prefix}{count.toLocaleString()}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function App() {
  return (
    <div className="app">
      <div className="landing-container">

        {/* ── Navbar ─────────────────────────────────────────────── */}
        <nav className="navbar">
          <div className="logo">
            <Sparkles className="logo-icon" size={20} /> ViralFactory
          </div>
          <div className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <a id="nav-cta-btn" className="nav-cta" href="https://chrome.google.com/webstore/detail/viralfactory-extension/d3b03b09-16c8-454b-9c51-30de52481293" target="_blank" rel="noopener noreferrer">Add to Chrome</a>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="hero">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }} className="hero-badge"
          >
            <Zap size={13} /> World's First Passive Content Engine
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Scroll TikTok.<br />Build Your Brand.<br />
            <span className="highlight">Make Money.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Just watch your favourite videos. Our AI reads the viral comments in the background, writes a song, generates the music, and auto-posts it to grow your personal brand across TikTok, YouTube & Instagram — while you do absolutely nothing.
          </motion.p>

          <motion.div
            className="cta-group"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <a id="hero-primary-btn" className="primary-btn" href="https://chrome.google.com/webstore/detail/viralfactory-extension/d3b03b09-16c8-454b-9c51-30de52481293" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Globe size={20} /> Add to Chrome
            </a>
            <a id="hero-secondary-btn" className="secondary-btn" href="#how-it-works" style={{ textDecoration: 'none' }}>
              <Play size={16} /> See Demo
            </a>
          </motion.div>

          {/* Dashboard Mockup */}
          <motion.div
            className="dashboard-mockup"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="mockup-header">
              <div className="mac-btn close" /><div className="mac-btn min" /><div className="mac-btn max" />
              <div className="mockup-url-bar">viralfactory.app / dashboard</div>
            </div>
            <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="sidebar-logo"><Sparkles size={14} /> ViralFactory</div>
              <div className="sidebar-item"><TrendingUp size={14} /> Overview</div>
              <div className="sidebar-item active"><Play size={14} /> Auto-Posts</div>
              <div className="sidebar-item"><DollarSign size={14} /> Revenue</div>
              <div className="sidebar-item" style={{marginTop:'auto'}}><Zap size={14} /> Settings</div>
            </div>
            <div className="mockup-main">
              <div className="mockup-page-title">Live Dashboard <span className="live-dot">● LIVE</span></div>
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-label">Views This Week</div>
                  <div className="metric-value">2.4M <span className="metric-change up">↑ 34%</span></div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">New Followers</div>
                  <div className="metric-value">+18.2K <span className="metric-change up">↑ 12%</span></div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Creator Revenue</div>
                  <div className="metric-value green">$842 <span className="metric-change up">↑ 68%</span></div>
                </div>
              </div>
              <div className="content-feed">
                <div className="feed-header">Recent AI-Generated Posts</div>
                <FeedItem color="purple" title={`"I can't believe he said that" (Pop Punk Mix)`} platforms="TikTok, YouTube" views="142k views" time="2 mins ago" />
                <FeedItem color="green"  title={`"Bro really thought he cooked" (Trap Remix)`}   platforms="Reels, TikTok" views="89k views" time="18 mins ago" />
                <FeedItem color="blue"   title={`"She said what?? 💀" (Country Ballad)`}          platforms="YouTube Shorts" views="54k views" time="41 mins ago" />
              </div>
            </div>
            </div>
          </motion.div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <motion.section
          className="stats-section"
          variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
        >
          <motion.div variants={fadeUp}><StatCard value={2400000} label="Views Generated for Users" suffix="+" /></motion.div>
          <motion.div variants={fadeUp}><StatCard value={840}     label="Average Monthly Revenue" prefix="$" /></motion.div>
          <motion.div variants={fadeUp}><StatCard value={12000}   label="Creators on Autopilot" suffix="+" /></motion.div>
          <motion.div variants={fadeUp}><StatCard value={99}      label="% Zero Manual Work" suffix="%" /></motion.div>
        </motion.section>

        {/* ── How It Works ───────────────────────────────────────── */}
        <section id="how-it-works" className="steps-section">
          <motion.div
            className="section-header"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.p className="section-eyebrow" variants={fadeUp}>THE PROCESS</motion.p>
            <motion.h2 variants={fadeUp}>The Effortless Loop</motion.h2>
            <motion.p className="section-sub" variants={fadeUp}>Go from doom-scrolling to building a lucrative brand asset.</motion.p>
          </motion.div>

          {/* Single unified box containing all 4 steps */}
          <motion.div
            className="steps-box"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {[
              { 
                n: '01', 
                title: 'Install & Chill', 
                desc: 'Add ViralFactory to Chrome. Open TikTok. That\'s the hardest step — we promise.',
                color: 'var(--purple)',
                illustration: (
                  <svg viewBox="0 0 120 120" width="100%" height="100%">
                    <rect x="15" y="25" width="90" height="70" rx="6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <line x1="15" y1="42" x2="105" y2="42" className="browser-bar" strokeWidth="1.5" />
                    <circle cx="23" cy="33" r="2.5" fill="rgba(255,255,255,0.15)" />
                    <circle cx="31" cy="33" r="2.5" fill="rgba(255,255,255,0.15)" />
                    <circle cx="39" cy="33" r="2.5" fill="rgba(255,255,255,0.15)" />
                    <path d="M 64.5 49 C 64.5 46.5 62.5 44.5 60 44.5 C 57.5 44.5 55.5 46.5 55.5 49 L 52 49 L 52 52.5 C 54.5 52.5 56.5 54.5 56.5 57 C 56.5 59.5 54.5 61.5 52 61.5 L 52 65 L 55.5 65 L 55.5 64.5 C 55.5 62 57.5 60 60 60 C 62.5 60 64.5 62 64.5 64.5 L 64.5 65 L 68 65 L 68 61.5 L 67.5 61.5 C 65 61.5 63 59.5 63 57 C 63 54.5 65 52.5 67.5 52.5 L 68 52.5 L 68 49 Z" fill="rgba(255,255,255,0.2)" className="puzzle-icon-glowing" />
                    <g className="click-cursor">
                      <path d="M 75 75 L 62 67 L 66 65 L 69 69 L 71 68 L 68 64 L 70 63 L 75 75 Z" fill="#fff" stroke="#060608" strokeWidth="1.5" />
                    </g>
                  </svg>
                )
              },
              { 
                n: '02', 
                title: 'AI Background Magic', 
                desc: 'As you scroll, Gemini reads the viral comments. It writes lyrics, Suno AI generates a full song, and our engine renders the video.',
                color: '#00E5FF',
                illustration: (
                  <svg viewBox="0 0 120 120" width="100%" height="100%">
                    <g className="comment-bubble-line comment-bubble-line-1">
                      <rect x="20" y="25" width="60" height="18" rx="5" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" />
                      <circle cx="28" cy="34" r="4" fill="var(--purple)" opacity="0.4" />
                      <line x1="36" y1="31" x2="72" y2="31" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="36" y1="37" x2="60" y2="37" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
                    </g>
                    <g className="comment-bubble-line comment-bubble-line-2">
                      <rect x="40" y="50" width="60" height="18" rx="5" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" />
                      <circle cx="48" cy="59" r="4" fill="var(--green)" opacity="0.4" />
                      <line x1="56" y1="56" x2="92" y2="56" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="56" y1="62" x2="80" y2="62" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
                    </g>
                    <line x1="10" y1="45" x2="110" y2="45" stroke="var(--purple)" strokeWidth="2" className="scanning-line" style={{ filter: 'drop-shadow(0 0 4px var(--purple))' }} />
                    <path d="M 35 30 A 2 2 0 0 1 37 32 L 37 38 A 3 3 0 1 1 34 41 L 34 32 Z" fill="var(--purple)" className="music-note-sparkle music-note-sparkle-1" />
                    <path d="M 85 45 A 2 2 0 0 1 87 47 L 87 53 A 3 3 0 1 1 84 56 L 84 47 Z" fill="var(--green)" className="music-note-sparkle music-note-sparkle-2" />
                  </svg>
                )
              },
              { 
                n: '03', 
                title: 'Auto-Published', 
                desc: 'Your brand-new piece of content is posted across TikTok, YouTube Shorts, and Instagram Reels. Completely automatically.',
                color: '#FF3366',
                illustration: (
                  <svg viewBox="0 0 120 120" width="100%" height="100%">
                    <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" className="orbit-ring" />
                    <g className="paper-plane">
                      <path d="M 45 68 L 75 52 L 64 61 L 58 72 Z" fill="rgba(255,255,255,0.15)" stroke="var(--purple)" strokeWidth="1.5" />
                      <path d="M 64 61 L 45 68 L 52 59 Z" fill="rgba(255,255,255,0.25)" stroke="var(--purple)" strokeWidth="1" />
                    </g>
                    <g className="orbit-icon-circle orbit-icon-circle-tt">
                      <circle cx="60" cy="60" r="8" fill="#060608" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <path d="M 59 57 L 61 57 L 61 61" stroke="#00E5FF" strokeWidth="1.5" fill="none" />
                      <circle cx="59" cy="61" r="1" fill="#00E5FF" />
                    </g>
                    <g className="orbit-icon-circle orbit-icon-circle-yt">
                      <circle cx="60" cy="60" r="8" fill="#060608" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <polygon points="58,57 63,60 58,63" fill="#FF3366" />
                    </g>
                    <g className="orbit-icon-circle orbit-icon-circle-ig">
                      <circle cx="60" cy="60" r="8" fill="#060608" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <rect x="57" y="57" width="6" height="6" rx="1.5" fill="none" stroke="var(--purple)" strokeWidth="1.5" />
                    </g>
                  </svg>
                )
              },
              { 
                n: '04', 
                title: 'Brand & Revenue Grow', 
                desc: 'Platform algorithms push your content. You gain followers, views, and creator revenue — for zero extra effort.',
                color: 'var(--green)',
                illustration: (
                  <svg viewBox="0 0 120 120" width="100%" height="100%">
                    <line x1="20" y1="20" x2="20" y2="100" className="grid-line" />
                    <line x1="50" y1="20" x2="50" y2="100" className="grid-line" />
                    <line x1="80" y1="20" x2="80" y2="100" className="grid-line" />
                    <line x1="20" y1="80" x2="100" y2="80" className="grid-line" />
                    <line x1="20" y1="50" x2="100" y2="50" className="grid-line" />
                    <path d="M 20 85 Q 40 75 55 50 T 90 25" fill="none" stroke="url(#chart-grad)" strokeWidth="3" strokeLinecap="round" className="chart-path" />
                    <defs>
                      <linearGradient id="chart-grad" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--purple)" />
                        <stop offset="100%" stopColor="var(--green)" />
                      </linearGradient>
                    </defs>
                    <circle cx="90" cy="25" r="4.5" fill="var(--green)" className="chart-dot" />
                    <text x="35" y="45" fill="var(--green)" fontSize="14" fontWeight="bold" className="floating-money floating-money-1">$</text>
                    <text x="75" y="35" fill="var(--green)" fontSize="14" fontWeight="bold" className="floating-money floating-money-2">$</text>
                  </svg>
                )
              }
            ].map((s, i) => (
              <motion.div
                key={s.n}
                className="step-card"
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 2, ease: [0.25, 0.8, 0.25, 1] }}
              >
                {/* Left: number + content */}
                <div className="step-content">
                  <div className="step-header">
                    <span className="step-num-badge" style={{ color: s.color, borderColor: `${s.color}44`, background: `${s.color}14` }}>{s.n}</span>
                    <h3>{s.title}</h3>
                  </div>
                  <p>{s.desc}</p>
                </div>
                {/* Right: SVG */}
                <div className="step-illustration" style={{ width: 150, height: 100, flexShrink: 0 }}>
                  {s.illustration}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section id="features" className="features-section">
          <motion.div
            className="section-header"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.p className="section-eyebrow" variants={fadeUp}>WHY CREATORS LOVE IT</motion.p>
            <motion.h2 variants={fadeUp}>Everything on Autopilot</motion.h2>
          </motion.div>

          <motion.div
            className="features-grid"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            {[
              { icon:<Play />,        title:'Zero Extra Work',        img: '/zero-extra-work.jpg',        desc:'Never write a script or edit a video again. Content is conceptualized, created, and posted while you consume.' },
              { icon:<TrendingUp />,  title:'Autopilot Branding',     img: '/autopilot-branding.jpg',     desc:'Grow across TikTok, YouTube, and Instagram Reels simultaneously without lifting a finger.' },
              { icon:<DollarSign />,  title:'Monetize Your Time',     img: '/monetize-time.jpg',          desc:'Your doom-scrolling hours are now a lucrative asset. Watch views convert directly into creator revenue.' },
              { icon:<Sparkles />,   title:'Gemini + Suno AI',       img: '/gemini-suno.jpg',            desc:'The world\'s best LLM writes the lyrics. Suno generates an actual full-length song. Real quality, not a gimmick.' },
              { icon:<Zap />,        title:'Multiple Genres',         img: '/multiple-genres.jpg',        desc:'Hip-hop, Pop Punk, Country, Opera, Death Metal — the AI picks the funniest genre for each comment thread.' },
              { icon:<CheckCircle />,title:'100% Client-Side',        img: '/client-side.jpg',            desc:'No sketchy servers. Your API keys and data stay in your browser. Privacy first, always.' },
            ].map(f => (
              <motion.div 
                key={f.title} 
                className="feature-card" 
                variants={fadeUp}
                whileHover={{ y: -8, scale: 1.03, borderColor: 'rgba(181, 56, 255, 0.4)', boxShadow: '0 20px 40px rgba(181, 56, 255, 0.12)' }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  e.currentTarget.style.setProperty('--x', `${x}px`);
                  e.currentTarget.style.setProperty('--y', `${y}px`);
                }}
              >
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                
                {f.img && (
                  <div className="feature-image-wrapper">
                    <WarpingImage 
                      src={f.img} 
                      alt={f.title} 
                      className="feature-card-image"
                    />
                    <div className="feature-image-overlay-text">{f.title}</div>
                  </div>
                )}

                <p>{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────── */}
        <section className="testimonials-section">
          <motion.div
            className="section-header"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.p className="section-eyebrow" variants={fadeUp}>SOCIAL PROOF</motion.p>
            <motion.h2 variants={fadeUp}>Real Creators, Real Results</motion.h2>
          </motion.div>
          <motion.div
            className="testimonials-grid"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            {[
              { name:'@maya_creates', handle:'142K TikTok', quote:'"I went from 800 to 142,000 followers in 3 months. I did literally nothing different except install this extension."', stars:5 },
              { name:'@dankvibes99',  handle:'89K YouTube', quote:'"My YouTube Shorts channel went from dead to $400/month in passive revenue. I just watch TikTok. This is insane."', stars:5 },
              { name:'@lena.reels',   handle:'54K Reels',   quote:'"The AI actually makes hilarious songs. My audience thinks I spend hours editing. I spend zero hours."', stars:5 },
            ].map(t => (
              <motion.div 
                key={t.name} 
                className="testimonial-card" 
                variants={fadeUp}
                whileHover={{ y: -6, scale: 1.02, borderColor: 'rgba(0, 255, 136, 0.4)', boxShadow: '0 20px 40px rgba(0, 255, 136, 0.08)' }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="stars">{Array(t.stars).fill(0).map((_, i) => <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />)}</div>
                <p className="quote">"{t.quote}"</p>
                <div className="reviewer">
                  <div className="reviewer-avatar">{t.name[1].toUpperCase()}</div>
                  <div>
                    <div className="reviewer-name">{t.name}</div>
                    <div className="reviewer-handle">{t.handle} followers</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section id="pricing" className="pricing-section">
          <motion.div
            className="section-header"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.p className="section-eyebrow" variants={fadeUp}>PRICING</motion.p>
            <motion.h2 variants={fadeUp}>It Pays for Itself</motion.h2>
            <motion.p className="section-sub" variants={fadeUp}>Start free. Upgrade when your brand explodes.</motion.p>
          </motion.div>
          <motion.div
            className="pricing-grid"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <motion.div className="pricing-card" variants={fadeUp}>
              <div className="plan-name">Starter</div>
              <div className="plan-price">Free <span>/ forever</span></div>
              <ul className="plan-features">
                <li><CheckCircle size={14} /> 5 auto-posts per week</li>
                <li><CheckCircle size={14} /> TikTok posting</li>
                <li><CheckCircle size={14} /> 3 music genres</li>
                <li><CheckCircle size={14} /> Gemini lyrics generation</li>
              </ul>
              <a href="https://chrome.google.com/webstore/detail/viralfactory-extension/d3b03b09-16c8-454b-9c51-30de52481293" target="_blank" rel="noopener noreferrer" id="starter-plan-btn" className="plan-btn secondary" style={{ textDecoration: 'none', display: 'block' }}>Add to Chrome</a>
            </motion.div>
            <motion.div className="pricing-card featured" variants={fadeUp}>
              <div className="popular-badge">Most Popular</div>
              <div className="plan-name">Creator</div>
              <div className="plan-price">$19 <span>/ month</span></div>
              <ul className="plan-features">
                <li><CheckCircle size={14} /> Unlimited auto-posts</li>
                <li><CheckCircle size={14} /> TikTok, YouTube & Reels</li>
                <li><CheckCircle size={14} /> All genres including custom</li>
                <li><CheckCircle size={14} /> Suno AI music generation</li>
                <li><CheckCircle size={14} /> Analytics dashboard</li>
                <li><CheckCircle size={14} /> Priority AI queue</li>
              </ul>
              <a href="https://buy.stripe.com/test_aFa3cx0xHaC9co42L3cEw00" target="_blank" rel="noreferrer" id="creator-plan-btn" className="plan-btn primary" style={{ textDecoration: 'none', display: 'block' }}>Upgrade with Stripe</a>
            </motion.div>
            <motion.div className="pricing-card" variants={fadeUp}>
              <div className="plan-name">Agency</div>
              <div className="plan-price">$79 <span>/ month</span></div>
              <ul className="plan-features">
                <li><CheckCircle size={14} /> Everything in Creator</li>
                <li><CheckCircle size={14} /> Up to 10 accounts</li>
                <li><CheckCircle size={14} /> White-label branding</li>
                <li><CheckCircle size={14} /> Dedicated support</li>
                <li><CheckCircle size={14} /> Custom AI training</li>
              </ul>
              <button id="agency-plan-btn" className="plan-btn secondary">Contact Sales</button>
            </motion.div>
          </motion.div>
        </section>

        {/* ── CTA Banner ─────────────────────────────────────────── */}
        <motion.section
          className="cta-banner"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }} viewport={{ once: true }}
        >
          <h2>Stop Scrolling for Free.<br /><span className="highlight">Start Scrolling for Profit.</span></h2>
          <p>Join 12,000+ creators who've turned their TikTok habit into a revenue stream.</p>
          <button id="cta-banner-btn" className="primary-btn" style={{fontSize:'1.125rem', padding:'18px 40px'}}>
            <Globe size={22} /> Add ViralFactory to Chrome — It's Free
          </button>
        </motion.section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-logo"><Sparkles size={16} className="logo-icon" /> ViralFactory</div>
              <p>The world's first passive content engine for creators.</p>
            </div>
            <div className="footer-links-col">
              <div className="footer-col-title">Product</div>
              <a href="#">Features</a><a href="#">Pricing</a><a href="#">Changelog</a>
            </div>
            <div className="footer-links-col">
              <div className="footer-col-title">Legal</div>
              <a href="#">Privacy Policy</a><a href="#">Terms of Service</a>
            </div>
            <div className="footer-links-col">
              <div className="footer-col-title">Connect</div>
              <a href="#">Twitter / X</a><a href="#">Discord</a><a href="#">GitHub</a>
            </div>
          </div>
          <div className="footer-bottom">© 2026 ViralFactory. All rights reserved.</div>
        </footer>

      </div>
    </div>
  )
}

function FeedItem({ color, title, platforms, views, time }) {
  const colors = { purple: 'rgba(181,56,255,0.2)', green: 'rgba(0,255,136,0.15)', blue: 'rgba(56,182,255,0.2)' }
  return (
    <div className="feed-item">
      <div className="feed-thumb" style={{ background: colors[color] }} />
      <div className="feed-details">
        <div className="feed-title">{title}</div>
        <div className="feed-meta"><span>{platforms}</span><span>· {views}</span><span>· {time}</span></div>
      </div>
      <div className="status-badge">Auto-Posted</div>
    </div>
  )
}

export default App
