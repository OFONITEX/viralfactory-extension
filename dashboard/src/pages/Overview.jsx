import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const card = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: '24px 28px'
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ background: `${color}22`, borderRadius: 12, padding: 12, flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

export default function Overview() {
  const [stats, setStats] = useState({ total: 0, paid: 0, thisWeek: 0, mrr: 0 });
  const [chartData, setChartData] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      // Total users
      const { count: total } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      // Paid users
      const { count: paid } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'creator');
      // This week
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: thisWeek } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo);
      // Recent users
      const { data: recentUsers } = await supabase.from('profiles').select('email, plan, created_at, posts_this_month').order('created_at', { ascending: false }).limit(5);

      setStats({ total: total || 0, paid: paid || 0, thisWeek: thisWeek || 0, mrr: (paid || 0) * 19 });
      setRecent(recentUsers || []);

      // Build last-7-days chart
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        return { label: d.toLocaleDateString('en', { weekday: 'short' }), date: d.toISOString().split('T')[0] };
      });
      const chartRows = await Promise.all(days.map(async ({ label, date }) => {
        const from = date + 'T00:00:00Z', to = date + 'T23:59:59Z';
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', from).lte('created_at', to);
        return { day: label, signups: count || 0 };
      }));
      setChartData(chartRows);
    }
    load();
  }, []);

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 24px' }}>Overview</h2>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={Users} label="Total Users" value={stats.total} sub="All time" color="#9B5DE5" />
        <StatCard icon={TrendingUp} label="New This Week" value={stats.thisWeek} sub="Last 7 days" color="#00C9FF" />
        <StatCard icon={DollarSign} label="Paid (Creator)" value={stats.paid} sub="Active subscribers" color="#FF3366" />
        <StatCard icon={Activity} label="MRR" value={`$${stats.mrr}`} sub="@ $19/mo per creator" color="#FFD166" />
      </div>

      {/* Signups chart */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ color: '#aaa', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Signups — Last 7 Days</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9B5DE5" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#9B5DE5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" stroke="#555" tick={{ fill: '#777', fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="#555" tick={{ fill: '#777', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
            <Area type="monotone" dataKey="signups" stroke="#9B5DE5" strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent users */}
      <div style={card}>
        <div style={{ color: '#aaa', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Recent Sign-Ups</div>
        {recent.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13 }}>No users yet — share the extension link!</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#666', textAlign: 'left' }}>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Email</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Plan</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Posts</th>
                <th style={{ paddingBottom: 10, fontWeight: 600 }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((u, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#ccc' }}>
                  <td style={{ padding: '10px 0' }}>{u.email}</td>
                  <td style={{ padding: '10px 0' }}>
                    <span style={{
                      background: u.plan === 'creator' ? 'rgba(255,51,102,0.2)' : 'rgba(255,255,255,0.08)',
                      color: u.plan === 'creator' ? '#FF6688' : '#888',
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700
                    }}>{u.plan || 'free'}</span>
                  </td>
                  <td style={{ padding: '10px 0' }}>{u.posts_this_month || 0}</td>
                  <td style={{ padding: '10px 0', color: '#666' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
