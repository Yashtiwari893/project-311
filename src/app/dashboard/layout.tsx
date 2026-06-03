'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV_EN = [
  { key: 'dashboard',  label: 'Home',       icon: '🏠', href: '/dashboard' },
  { key: 'campaigns',  label: 'Campaigns',  icon: '⚡', href: '/campaigns' },
  { key: 'leads',      label: 'Leads',      icon: '👥', href: '/leads' },
  { key: 'inbox',      label: 'Inbox',      icon: '📨', href: '/inbox' },
  { key: 'templates',  label: 'Templates',  icon: '📋', href: '/templates' },
  { key: 'accounts',   label: 'Accounts',   icon: '🔗', href: '/accounts' },
]

const NAV_HI = [
  { key: 'dashboard',  label: 'होम',       icon: '🏠', href: '/dashboard' },
  { key: 'campaigns',  label: 'कैंपेन',    icon: '⚡', href: '/campaigns' },
  { key: 'leads',      label: 'लीड्स',      icon: '👥', href: '/leads' },
  { key: 'inbox',      label: 'इनबॉक्स',    icon: '📨', href: '/inbox' },
  { key: 'templates',  label: 'टेम्पलेट',  icon: '📋', href: '/templates' },
  { key: 'accounts',   label: 'अकाउंट',     icon: '🔗', href: '/accounts' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname()
  const supabase   = createClient()
  const [user, setUser]     = useState<{ name?: string; email?: string; plan?: string } | null>(null)
  const [lang, setLang]     = useState<'en'|'hi'>('en')
  const [notifs, setNotifs] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('profiles').select('name,email,plan,language').eq('id', u.id).single()
      setUser({ name: profile?.name, email: profile?.email, plan: profile?.plan })
      setLang(profile?.language || 'en')
      // Unread notifications
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('read', false)
      setNotifs(count || 0)

      // Realtime notifications
      supabase.channel('notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => setNotifs(n => n + 1)).subscribe()
    }
    load()
  }, [])

  const toggleLang = async () => {
    const newLang = lang === 'en' ? 'hi' : 'en'
    setLang(newLang)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) await supabase.from('profiles').update({ language: newLang }).eq('id', u.id)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const nav = lang === 'hi' ? NAV_HI : NAV_EN
  const initials = user?.name?.split(' ').slice(0,2).map(w => w[0]).join('') || 'U'
  const planColors: Record<string, string> = { free: '#94a3b8', starter: '#4f72ff', pro: '#8b5cf6', agency: '#f59e0b' }
  const planColor = planColors[user?.plan || 'free']

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ width: 224, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '18px 10px', gap: 2, flexShrink: 0, position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, background: '#4f72ff', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>L</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', lineHeight: 1 }}>LinkedFlow</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>India</div>
          </div>
        </div>

        {/* Workspace */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f1f5f9', borderRadius: 10, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, background: '#ef4444', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 10 }}>W</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', flex: 1 }}>My Workspace</span>
          <span style={{ fontSize: 10 }}>›</span>
        </div>

        {/* Nav links */}
        {nav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.key} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: active ? '#eef1ff' : 'transparent', color: active ? '#4f72ff' : '#64748b', fontWeight: active ? 700 : 500, fontSize: 13, textDecoration: 'none', transition: 'background .15s' }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.key === 'inbox' && notifs > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 9999, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{notifs}</span>
              )}
            </Link>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Plan badge */}
        <Link href="/billing" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: planColor + '12', textDecoration: 'none', marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>💎</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: planColor, textTransform: 'capitalize' }}>{user?.plan || 'free'} plan</div>
            {user?.plan === 'free' && <div style={{ fontSize: 10, color: '#94a3b8' }}>{lang === 'hi' ? 'अपग्रेड करें' : 'Upgrade'} →</div>}
          </div>
        </Link>

        {/* Lang toggle */}
        <button onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 500, marginBottom: 4, textAlign: 'left', width: '100%' }}>
          <span style={{ fontSize: 14 }}>{lang === 'en' ? '🇮🇳' : '🇬🇧'}</span>
          {lang === 'en' ? 'हिंदी में देखें' : 'View in English'}
        </button>

        {/* User */}
        <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 8, border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#4f72ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </button>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: 224, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
