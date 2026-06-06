import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: '24px 28px'
};

const PLANS = ['all', 'free', 'creator', 'agency'];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  async function loadUsers() {
    setLoading(true);
    let q = supabase.from('profiles').select('id, email, plan, posts_this_month, created_at, stripe_customer_id').order(sortField, { ascending: sortAsc });
    if (planFilter !== 'all') q = q.eq('plan', planFilter);
    if (search) q = q.ilike('email', `%${search}%`);
    const { data } = await q.limit(100);
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, [planFilter, sortField, sortAsc, search]);

  async function changePlan(userId, newPlan) {
    setUpdating(userId);
    await supabase.from('profiles').update({ plan: newPlan }).eq('id', userId);
    setUpdating(null);
    loadUsers();
  }

  function sort(field) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  const SortIcon = ({ field }) => sortField === field
    ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : null;

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 24px' }}>Users</h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none'
            }}
          />
        </div>
        {PLANS.map(p => (
          <button key={p} onClick={() => setPlanFilter(p)} style={{
            padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)',
            background: planFilter === p ? 'linear-gradient(135deg,#FF3366,#9B5DE5)' : 'rgba(255,255,255,0.05)',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize'
          }}>{p}</button>
        ))}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 40 }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#666', textAlign: 'left' }}>
                {[['email','Email'],['plan','Plan'],['posts_this_month','Posts/mo'],['created_at','Joined']].map(([f, label]) => (
                  <th key={f} onClick={() => sort(f)} style={{ paddingBottom: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} <SortIcon field={f} /></span>
                  </th>
                ))}
                <th style={{ paddingBottom: 12, fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#ccc' }}>
                  <td style={{ padding: '10px 0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</td>
                  <td style={{ padding: '10px 0' }}>
                    <span style={{
                      background: u.plan === 'creator' ? 'rgba(255,51,102,0.2)' : u.plan === 'agency' ? 'rgba(155,93,229,0.2)' : 'rgba(255,255,255,0.08)',
                      color: u.plan === 'creator' ? '#FF6688' : u.plan === 'agency' ? '#c4b0f0' : '#888',
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700
                    }}>{u.plan || 'free'}</span>
                  </td>
                  <td style={{ padding: '10px 0' }}>{u.posts_this_month || 0}</td>
                  <td style={{ padding: '10px 0', color: '#666' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 0' }}>
                    <select
                      disabled={updating === u.id}
                      defaultValue={u.plan || 'free'}
                      onChange={e => changePlan(u.id, e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8, color: '#fff', fontSize: 12, padding: '4px 8px', cursor: 'pointer'
                      }}
                    >
                      <option value="free">free</option>
                      <option value="creator">creator</option>
                      <option value="agency">agency</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
