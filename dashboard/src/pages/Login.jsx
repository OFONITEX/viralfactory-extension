import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onLogin(data.session);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a12', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '48px 40px', width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎵</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>ViralFactory</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>Business Dashboard</p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="admin@viralfactory.com"
            style={{
              width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff',
              fontSize: 14, marginBottom: 16, boxSizing: 'border-box', outline: 'none'
            }}
          />
          <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>PASSWORD</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="••••••••"
            style={{
              width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff',
              fontSize: 14, marginBottom: 20, boxSizing: 'border-box', outline: 'none'
            }}
          />
          {error && (
            <div style={{ background: 'rgba(255,51,102,0.15)', border: '1px solid rgba(255,51,102,0.4)', borderRadius: 8, padding: '8px 12px', color: '#ff6688', fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', background: 'linear-gradient(135deg,#FF3366,#9B5DE5)',
            border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Signing in...' : 'Sign In to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}
