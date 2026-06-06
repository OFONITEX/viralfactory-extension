import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Play, TrendingUp, Zap, DollarSign, Globe, Sparkles, CheckCircle, Star } from 'lucide-react'
import './index.css'

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
          <button id="nav-cta-btn" className="nav-cta">Add to Chrome</button>
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
            <button id="hero-primary-btn" className="primary-btn">
              <Globe size={20} /> Start Earning While Scrolling
            </button>
            <button id="hero-secondary-btn" className="secondary-btn">
              <Play size={16} /> See Demo
            </button>
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

          <div className="steps-grid">
            {[
              { n:'01', emoji:'🍿', title:'Install & Chill', desc:'Add ViralFactory to Chrome. Open TikTok. That\'s the hardest step — we promise.' },
              { n:'02', emoji:'🤖', title:'AI Background Magic', desc:'As you scroll, Gemini reads the viral comments. It writes lyrics, Suno AI generates a full song, and our engine renders the video.' },
              { n:'03', emoji:'📤', title:'Auto-Published', desc:'Your brand-new piece of content is posted across TikTok, YouTube Shorts, and Instagram Reels. Completely automatically.' },
              { n:'04', emoji:'💸', title:'Brand & Revenue Grow', desc:'Platform algorithms push your content. You gain followers, views, and creator revenue — for zero extra effort.' },
            ].map(s => (
              <motion.div
                key={s.n} className="step-card"
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <div className="step-emoji">{s.emoji}</div>
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </motion.div>
            ))}
          </div>
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
              { icon:<Play />,        title:'Zero Extra Work',        desc:'Never write a script or edit a video again. Content is conceptualized, created, and posted while you consume.' },
              { icon:<TrendingUp />,  title:'Autopilot Branding',     desc:'Grow across TikTok, YouTube, and Instagram Reels simultaneously without lifting a finger.' },
              { icon:<DollarSign />,  title:'Monetize Your Time',     desc:'Your doom-scrolling hours are now a lucrative asset. Watch views convert directly into creator revenue.' },
              { icon:<Sparkles />,   title:'Gemini + Suno AI',       desc:'The world\'s best LLM writes the lyrics. Suno generates an actual full-length song. Real quality, not a gimmick.' },
              { icon:<Zap />,        title:'Multiple Genres',         desc:'Hip-hop, Pop Punk, Country, Opera, Death Metal — the AI picks the funniest genre for each comment thread.' },
              { icon:<CheckCircle />,title:'100% Client-Side',        desc:'No sketchy servers. Your API keys and data stay in your browser. Privacy first, always.' },
            ].map(f => (
              <motion.div key={f.title} className="feature-card" variants={fadeUp}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
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
              <motion.div key={t.name} className="testimonial-card" variants={fadeUp}>
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
              <button id="starter-plan-btn" className="plan-btn secondary">Get Started Free</button>
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
              <button id="creator-plan-btn" className="plan-btn primary">Start 7-Day Free Trial</button>
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
