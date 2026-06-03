'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const supabase = createClient()
  const [tab, setTab]       = useState<'login'|'signup'>('login')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [lang, setLang]     = useState<'en'|'hi'>('en')

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (tab === 'signup') {
        const { error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } },
        })
        if (e) throw e
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password })
        if (e) throw e
      }
      window.location.href = '/dashboard'
    } catch (e: unknown) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } })
  }

  const t = {
    title:    lang === 'hi' ? 'LinkedFlow India में लॉगिन करें' : 'Login to LinkedFlow India',
    subtitle: lang === 'hi' ? 'India का #1 LinkedIn automation platform' : "India's smartest LinkedIn automation platform",
    login:    lang === 'hi' ? 'लॉगिन' : 'Login',
    signup:   lang === 'hi' ? 'साइनअप' : 'Sign up',
    email:    lang === 'hi' ? 'ईमेल पता' : 'Email address',
    password: lang === 'hi' ? 'पासवर्ड' : 'Password',
    name:     lang === 'hi' ? 'पूरा नाम' : 'Full name',
    google:   lang === 'hi' ? 'Google से जारी रखें' : 'Continue with Google',
    submit:   tab === 'login' ? (lang === 'hi' ? 'लॉगिन करें' : 'Log in') : (lang === 'hi' ? 'अकाउंट बनाएं' : 'Create account'),
    no_account: lang === 'hi' ? 'अकाउंट नहीं है?' : "Don't have an account?",
    have_account: lang === 'hi' ? 'पहले से अकाउंट है?' : 'Already have an account?',
    loading:  lang === 'hi' ? 'लोड हो रहा है...' : 'Loading...',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    fontSize: 14, color: '#0f172a', fontFamily: 'inherit', outline: 'none', marginTop: 6, boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Lang toggle */}
      <button onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')} style={{ position: 'fixed', top: 16, right: 16, padding: '7px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, background: 'rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
      </button>

      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: '#4f72ff', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 24 }}>L</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>LinkedFlow India</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '28px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 22 }}>
            {(['login','signup'] as const).map(tabKey => (
              <button key={tabKey} onClick={() => { setTab(tabKey); setError('') }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: tab === tabKey ? '#fff' : 'transparent', color: tab === tabKey ? '#0f172a' : '#64748b', fontWeight: tab === tabKey ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all .2s', boxShadow: tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {tabKey === 'login' ? t.login : t.signup}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} style={{ width: '100%', padding: '11px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#0f172a', cursor: 'pointer', marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t.google}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{lang === 'hi' ? 'या' : 'or'}</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Form */}
          {tab === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{t.name}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'hi' ? 'राहुल शर्मा' : 'Rahul Sharma'} style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{t.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="rahul@example.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{t.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading || !email || !password} style={{ width: '100%', padding: '12px', background: !email || !password ? '#e2e8f0' : '#0f172a', color: !email || !password ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {loading ? t.loading : t.submit}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>
            {tab === 'login' ? t.no_account : t.have_account}{' '}
            <button onClick={() => setTab(tab === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 'none', color: '#4f72ff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
              {tab === 'login' ? t.signup : t.login}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
