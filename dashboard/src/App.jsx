import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Overview from './pages/Overview';
import UsersPage from './pages/Users';
import ConfigEditor from './pages/ConfigEditor';
import Login from './pages/Login';
import {
  LayoutDashboard, Users, Settings, LogOut, Zap
} from 'lucide-react';
import './App.css';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/config', icon: Settings, label: 'Config Editor' },
];

function Sidebar({ onSignOut }) {
  return (
    <aside style={{
      width: 220, background: 'rgba(255,255,255,0.03)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0, minHeight: '100vh'
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px', marginBottom: 36 }}>
        <div style={{ fontSize: 26 }}>🎵</div>
        <div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>ViralFactory</div>
          <div style={{ color: '#666', fontSize: 11 }}>Business Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 24px',
            color: isActive ? '#fff' : '#777', textDecoration: 'none', fontSize: 14, fontWeight: 600,
            background: isActive ? 'rgba(155,93,229,0.15)' : 'transparent',
            borderRight: isActive ? '3px solid #9B5DE5' : '3px solid transparent',
            transition: 'all 0.15s'
          })}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Upgrade badge */}
      <div style={{ margin: '0 16px 20px', background: 'linear-gradient(135deg,rgba(255,51,102,0.15),rgba(155,93,229,0.15))', border: '1px solid rgba(155,93,229,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
        <Zap size={16} style={{ color: '#FFD166', marginBottom: 4 }} />
        <div style={{ color: '#c4b0f0', fontSize: 11, fontWeight: 700 }}>Stripe Dashboard</div>
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9B5DE5', fontSize: 11, textDecoration: 'none' }}>Open →</a>
      </div>

      {/* Sign out */}
      <button onClick={onSignOut} style={{
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 16px',
        background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.2)',
        borderRadius: 10, color: '#FF6688', fontSize: 13, fontWeight: 600, padding: '10px 14px', cursor: 'pointer'
      }}>
        <LogOut size={15} /> Sign Out
      </button>
    </aside>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!session) return <Login onLogin={s => setSession(s)} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a12', fontFamily: "'Inter', sans-serif", color: '#ccc' }}>
      <Sidebar onSignOut={signOut} />
      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/config" element={<ConfigEditor />} />
        </Routes>
      </main>
    </div>
  );
}
