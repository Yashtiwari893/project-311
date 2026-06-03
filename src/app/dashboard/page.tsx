'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import type { Campaign, AnalyticsDaily } from '@/types'

const COLORS = {
  brand:   '#4f72ff',
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  purple:  '#8b5cf6',
}

function StatCard({ label, value, icon, color, delta }: { label: string; value: string | number; icon: string; color: string; delta?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 11, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{label}</div>
        {delta && <div style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, marginTop: 2 }}>↑ {delta} this week</div>}
      </div>
    </div>
  )
}

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, background: i === data.length - 1 ? color : color + '55', borderRadius: 4, height: `${(v / max) * 100}%`, minHeight: 3, transition: 'height .5s ease' }} />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({ campaigns: 0, active: 0, leads: 0, connections: 0, accepted: 0 })
  const [recent, setRecent] = useState<Campaign[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsDaily[]>([])
  const [user, setUser]   = useState<{ name?: string; plan?: string } | null>(null)
  const [lang, setLang]   = useState<'en'|'hi'>('en')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/login'; return }

      const { data: profile } = await supabase.from('profiles').select('name,plan,language').eq('id', u.id).single()
      setUser({ name: profile?.name, plan: profile?.plan })
      setLang(profile?.language || 'en')

      const [campaigns, leads, analytics] = await Promise.all([
        supabase.from('campaigns').select('id,status').eq('user_id', u.id),
        supabase.from('leads').select('status').eq('user_id', u.id),
        supabase.from('analytics_daily').select('*').eq('user_id', u.id).order('date', { ascending: false }).limit(7),
      ])

      const cData = campaigns.data || []
      const lData = leads.data || []
      const aData = (analytics.data || []).reverse()

      setStats({
        campaigns:   cData.length,
        active:      cData.filter(c => c.status === 'active').length,
        leads:       lData.length,
        connections: lData.filter(l => l.status !== 'pending').length,
        accepted:    lData.filter(l => ['connected','replied','accepted'].includes(l.status)).length,
      })
      setAnalytics(aData)

      const { data: rc } = await supabase.from('campaigns').select('*').eq('user_id', u.id).order('updated_at', { ascending: false }).limit(5)
      setRecent(rc || [])
      setLoading(false)
    }
    load()
  }, [])

  const t = lang === 'hi' ? {
    welcome: 'वापस स्वागत है',
    stats: ['कुल कैंपेन','सक्रिय','कुल लीड्स','कनेक्शन भेजे','स्वीकृत'],
    chart_title: 'साप्ताहिक गतिविधि',
    recent: 'हाल के कैंपेन',
    quick: 'त्वरित कार्य',
    no_campaigns: 'कोई कैंपेन नहीं',
    view_all: 'सब देखें',
  } : {
    welcome: 'Welcome back',
    stats: ['Total Campaigns','Active','Total Leads','Connections Sent','Accepted'],
    chart_title: 'Weekly Activity',
    recent: 'Recent Campaigns',
    quick: 'Quick Actions',
    no_campaigns: 'No recent campaigns',
    view_all: 'View all',
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#4f72ff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )

  const weekConnections = analytics.map(a => a.connections_sent)
  const weekAccepted    = analytics.map(a => a.connections_accepted)

  const acceptanceRate = stats.connections > 0
    ? Math.round((stats.accepted / stats.connections) * 100)
    : 0

  const statusColor: Record<string, string> = {
    active:    '#22c55e',
    draft:     '#94a3b8',
    paused:    '#f59e0b',
    completed: '#4f72ff',
    failed:    '#ef4444',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {t.welcome}, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
            {lang === 'hi' ? 'आपका LinkedIn ऑटोमेशन डैशबोर्ड' : 'Your LinkedIn automation overview'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')} style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
          </button>
          <Link href="/campaigns/new" style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            + {lang === 'hi' ? 'कैंपेन बनाएं' : 'Create Campaign'}
          </Link>
        </div>
      </div>

      {/* Plan banner if free */}
      {user?.plan === 'free' && (
        <div style={{ background: 'linear-gradient(135deg,#4f72ff,#8b5cf6)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontWeight: 700 }}>{lang === 'hi' ? '🚀 प्लान अपग्रेड करें!' : '🚀 Upgrade your plan!'}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>
              {lang === 'hi' ? 'LinkedIn campaigns चलाने के लिए Starter plan लें — सिर्फ ₹2,999/माह' : 'Start campaigns from ₹2,999/month — no credit card needed'}
            </div>
          </div>
          <Link href="/billing" style={{ background: '#fff', color: '#4f72ff', padding: '8px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}>
            {lang === 'hi' ? 'देखें' : 'View Plans'}
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label={t.stats[0]}  value={stats.campaigns}   icon="⚡" color={COLORS.brand}   delta={String(stats.active)} />
        <StatCard label={t.stats[1]}  value={stats.active}      icon="🔄" color={COLORS.success}  />
        <StatCard label={t.stats[2]}  value={stats.leads}       icon="👥" color={COLORS.warning}  />
        <StatCard label={t.stats[3]}  value={stats.connections} icon="🔗" color={COLORS.purple}   />
        <StatCard label={t.stats[4]}  value={`${acceptanceRate}%`} icon="✅" color={COLORS.success} />
      </div>

      {/* Charts + Recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Connections chart */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.chart_title}</h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{lang === 'hi' ? 'पिछले 7 दिन' : 'Last 7 days'}</span>
          </div>
          <MiniBarChart data={weekConnections.length ? weekConnections : [0,0,0,0,0,0,0]} color={COLORS.brand} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{lang === 'hi' ? 'कनेक्शन भेजे' : 'Connections sent'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand }}>{weekConnections.reduce((a,b) => a+b, 0)}</span>
          </div>
        </div>

        {/* Accepted chart */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{lang === 'hi' ? 'स्वीकृति' : 'Acceptance'}</h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{lang === 'hi' ? 'पिछले 7 दिन' : 'Last 7 days'}</span>
          </div>
          <MiniBarChart data={weekAccepted.length ? weekAccepted : [0,0,0,0,0,0,0]} color={COLORS.success} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{lang === 'hi' ? 'स्वीकृत' : 'Accepted'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.success }}>{weekAccepted.reduce((a,b) => a+b, 0)}</span>
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.recent}</h3>
          <Link href="/campaigns" style={{ fontSize: 12, color: '#4f72ff', fontWeight: 600, textDecoration: 'none' }}>{t.view_all} →</Link>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            {t.no_campaigns} · <Link href="/campaigns/new" style={{ color: '#4f72ff' }}>Create one →</Link>
          </div>
        ) : recent.map(c => (
          <div key={c.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.type.replace(/_/g,' ')} · {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[c.status] || '#94a3b8', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: statusColor[c.status], fontWeight: 600 }}>{c.status}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{c.success_count}/{c.targets_count}</div>
              <div style={{ color: '#94a3b8' }}>{lang === 'hi' ? 'सफल' : 'success'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
