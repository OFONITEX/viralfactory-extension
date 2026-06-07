import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CONFIG_ID = '00000000-0000-0000-0000-000000000000';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '24px 28px',
  marginBottom: 20,
};

const field = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 13,
  padding: '9px 12px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function ConfigEditor() {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [jsonErr, setJsonErr] = useState('');

  async function fetchConfig() {
    setLoading(true);
    setMsg('');
    setErr('');
    try {
      const { data, error } = await supabase
        .from('remote_config')
        .select('config')
        .eq('id', CONFIG_ID)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const configData = data?.config || {
        apiKeys: { gemini: '', suno: '', groq: '', sunoCallbackUrl: '' },
        features: { musicGeneration: true, multiPlatformPublish: false, analytics: true },
      };
      setRaw(JSON.stringify(configData, null, 2));
    } catch (e) {
      setErr('Could not fetch config from Supabase: ' + e.message);
    }
    setLoading(false);
  }

  useEffect(() => { fetchConfig(); }, []);

  function handleRawChange(val) {
    setRaw(val);
    setJsonErr('');
    try { JSON.parse(val); } catch { setJsonErr('Invalid JSON — fix before saving.'); }
  }

  function updateKey(path, value) {
    try {
      const clone = JSON.parse(raw);
      const keys = path.split('.');
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      setRaw(JSON.stringify(clone, null, 2));
      setJsonErr('');
    } catch { setJsonErr('JSON parse error.'); }
  }

  function getKey(path) {
    try {
      const clone = JSON.parse(raw);
      return path.split('.').reduce((o, k) => o?.[k], clone) ?? '';
    } catch { return ''; }
  }

  async function handleSave() {
    if (jsonErr) return;
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const parsed = JSON.parse(raw);
      const { error } = await supabase
        .from('remote_config')
        .upsert({ id: CONFIG_ID, config: parsed, updated_at: new Date().toISOString() });

      if (error) throw error;
      setMsg('Config saved to Supabase! Extension will pick it up on next sync.');
    } catch (e) {
      setErr('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Config Editor</h2>
        <button onClick={fetchConfig} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, color: '#aaa', fontSize: 12, padding: '8px 14px', cursor: 'pointer',
        }}>
          <RefreshCw size={13} /> Refresh from Supabase
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#555', textAlign: 'center', padding: 60 }}>Loading config from Supabase...</div>
      ) : (
        <>
          {/* Quick-edit API keys */}
          <div style={card}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Quick Edit — API Keys
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                ['Gemini API Key', 'apiKeys.gemini'],
                ['Groq API Key', 'apiKeys.groq'],
                ['Suno API Key', 'apiKeys.suno'],
                ['Suno Callback URL', 'apiKeys.sunoCallbackUrl'],
              ].map(([label, path]) => (
                <div key={path}>
                  <label style={{ color: '#888', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    type="password"
                    value={getKey(path)}
                    onChange={e => updateKey(path, e.target.value)}
                    style={field}
                    placeholder="Not set"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Feature Flags */}
          <div style={card}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Feature Flags
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
              {[
                ['Music Generation', 'features.musicGeneration'],
                ['Multi-platform Publish', 'features.multiPlatformPublish'],
                ['Analytics', 'features.analytics'],
              ].map(([label, path]) => (
                <label key={path} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#ccc', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!getKey(path)}
                    onChange={e => updateKey(path, e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#9B5DE5' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Raw JSON Editor */}
          <div style={card}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Raw JSON
            </div>
            <textarea
              value={raw}
              onChange={e => handleRawChange(e.target.value)}
              rows={20}
              style={{ ...field, fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: 12, resize: 'vertical', lineHeight: 1.6 }}
            />
            {jsonErr && <div style={{ color: '#FF6688', fontSize: 12, marginTop: 8 }}>Warning: {jsonErr}</div>}
          </div>

          {msg && (
            <div style={{ background: 'rgba(0,201,255,0.1)', border: '1px solid rgba(0,201,255,0.3)', borderRadius: 10, padding: '12px 16px', color: '#00C9FF', fontSize: 12, marginBottom: 16 }}>
              {msg}
            </div>
          )}
          {err && (
            <div style={{ background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 10, padding: '12px 16px', color: '#FF6688', fontSize: 12, marginBottom: 16 }}>
              {err}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !!jsonErr}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: jsonErr ? '#333' : 'linear-gradient(135deg,#FF3366,#9B5DE5)',
              border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
              padding: '12px 28px', cursor: jsonErr ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={16} /> {saving ? 'Saving to Supabase...' : 'Save to Supabase'}
          </button>
        </>
      )}
    </div>
  );
}
