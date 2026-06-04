'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const PLANS = [
  {
    key:     'free' as const,
    name_en: 'Free',
    name_hi: 'फ्री',
    price:   '₹0',
    period:  '/month',
    color:   '#94a3b8',
    features_en: ['No LinkedIn accounts', 'No campaigns', 'Dashboard access'],
    features_hi: ['कोई LinkedIn अकाउंट नहीं', 'कोई कैंपेन नहीं', 'डैशबोर्ड एक्सेस'],
  },
  {
    key:     'starter' as const,
    name_en: 'Starter',
    name_hi: 'स्टार्टर',
    price:   '₹2,999',
    period:  '/month',
    color:   '#4f72ff',
    features_en: ['1 LinkedIn account', '5 campaigns', '500 targets/month', 'AI message drafting', 'Email support'],
    features_hi: ['1 LinkedIn अकाउंट', '5 कैंपेन', '500 टार्गेट/माह', 'AI मैसेज ड्राफ्टिंग', 'ईमेल सपोर्ट'],
  },
  {
    key:     'pro' as const,
    name_en: 'Pro',
    name_hi: 'प्रो',
    price:   '₹6,999',
    period:  '/month',
    color:   '#8b5cf6',
    popular: true,
    features_en: ['3 LinkedIn accounts', 'Unlimited campaigns', '2,000 targets/month', 'Analytics dashboard', 'Priority support', 'AI drafting'],
    features_hi: ['3 LinkedIn अकाउंट', 'असीमित कैंपेन', '2,000 टार्गेट/माह', 'एनालिटिक्स', 'प्रायोरिटी सपोर्ट', 'AI ड्राफ्टिंग'],
  },
  {
    key:     'agency' as const,
    name_en: 'Agency',
    name_hi: 'एजेंसी',
    price:   '₹14,999',
    period:  '/month',
    color:   '#f59e0b',
    features_en: ['10 LinkedIn accounts', 'Unlimited campaigns', '10,000 targets/month', 'White-label', 'API access', 'Dedicated manager'],
    features_hi: ['10 LinkedIn अकाउंट', 'असीमित कैंपेन', '10,000 टार्गेट/माह', 'व्हाइट-लेबल', 'API एक्सेस', 'डेडिकेटेड मैनेजर'],
  },
]

export default function BillingPage() {
  const supabase = createClient()
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading]         = useState<string | null>(null)
  const [lang, setLang]               = useState<'en'|'hi'>('en')
  const [payments, setPayments]       = useState<Array<{ razorpay_payment_id: string; amount: number; created_at: string; status: string }>>([])
  const [user, setUser]               = useState<{ email?: string; name?: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/login'; return }
      const [{ data: profile }, billingRes] = await Promise.all([
        supabase.from('profiles').select('plan,name,email,language').eq('id', u.id).single(),
        fetch('/api/billing'),
      ])
      setCurrentPlan(profile?.plan || 'free')
      setLang(profile?.language || 'en')
      setUser({ email: profile?.email, name: profile?.name })
      if (billingRes.ok) {
        const { payments: p } = await billingRes.json()
        setPayments(p || [])
      }
    }
    load()
  }, [])

  const subscribe = async (plan: 'starter'|'pro'|'agency') => {
    setLoading(plan)
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }

      const rzp = new window.Razorpay({
        key:             data.razorpay_key,
        subscription_id: data.subscription_id,
        name:            'LinkedFlow India',
        description:     `${data.name} Plan`,
        image:           '/logo.png',
        theme:           { color: '#4f72ff' },
        prefill: {
          email: data.prefill.email,
          name:  data.prefill.name,
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          // Webhook handles plan activation, just show success
          alert(lang === 'hi' ? `✅ भुगतान सफल! ID: ${response.razorpay_payment_id}` : `✅ Payment successful! ID: ${response.razorpay_payment_id}`)
          window.location.reload()
        },
        modal: { ondismiss: () => setLoading(null) },
      })
      rzp.open()
    } catch (e) {
      console.error(e)
      alert('Payment failed. Please try again.')
    }
    setLoading(null)
  }

  const t = {
    title:       lang === 'hi' ? 'बिलिंग और प्लान'  : 'Billing & Plans',
    current:     lang === 'hi' ? 'वर्तमान प्लान'      : 'Current Plan',
    popular:     lang === 'hi' ? 'सबसे लोकप्रिय'     : 'Most Popular',
    upgrade:     lang === 'hi' ? 'अपग्रेड करें'       : 'Upgrade',
    downgrade:   lang === 'hi' ? 'डाउनग्रेड'          : 'Downgrade',
    current_tag: lang === 'hi' ? 'वर्तमान'            : 'Current',
    history:     lang === 'hi' ? 'भुगतान इतिहास'     : 'Payment History',
    no_payments: lang === 'hi' ? 'कोई भुगतान नहीं'   : 'No payments yet',
    gst_note:    lang === 'hi' ? '* GST अलग से लागू  · UPI, Cards, NetBanking, Wallets स्वीकार' : '* GST applicable · UPI, Cards, NetBanking & Wallets accepted',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{t.title}</h1>
        <button onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')} style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
        </button>
      </div>

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {PLANS.map(plan => {
          const isCurrent  = currentPlan === plan.key
          const isUpgrade  = ['free','starter','pro','agency'].indexOf(plan.key) > ['free','starter','pro','agency'].indexOf(currentPlan as typeof plan.key)
          const features   = lang === 'hi' ? plan.features_hi : plan.features_en
          const planName   = lang === 'hi' ? plan.name_hi : plan.name_en

          return (
            <div key={plan.key} style={{ background: isCurrent ? '#0f172a' : '#fff', border: `1.5px solid ${isCurrent ? '#0f172a' : plan.popular ? plan.color : '#e2e8f0'}`, borderRadius: 16, padding: '20px', position: 'relative', transition: 'transform .2s', cursor: 'default' }}>
              {plan.popular && !isCurrent && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {t.popular}
                </div>
              )}
              {isCurrent && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ✓ {t.current_tag}
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: 16, color: isCurrent ? '#fff' : '#0f172a', marginBottom: 4 }}>{planName}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: isCurrent ? plan.color : plan.color, lineHeight: 1.1 }}>{plan.price}</div>
              <div style={{ fontSize: 12, color: isCurrent ? '#94a3b8' : '#64748b', marginBottom: 16 }}>{lang === 'hi' ? '/माह' : '/month'}</div>

              <div style={{ marginBottom: 20 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: isCurrent ? '#94a3b8' : '#64748b', marginBottom: 8 }}>
                    <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                  </div>
                ))}
              </div>

              {plan.key !== 'free' && (
                <button
                  onClick={() => !isCurrent && subscribe(plan.key as 'starter'|'pro'|'agency')}
                  disabled={isCurrent || loading === plan.key}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: isCurrent ? '#1e293b' : plan.color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: isCurrent ? 'default' : 'pointer', transition: 'opacity .2s', opacity: loading === plan.key ? 0.7 : 1 }}>
                  {loading === plan.key ? (lang === 'hi' ? 'लोड हो रहा...' : 'Loading...') : isCurrent ? (lang === 'hi' ? 'वर्तमान प्लान' : 'Current Plan') : isUpgrade ? t.upgrade : t.downgrade}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 28, textAlign: 'center' }}>{t.gst_note}</p>

      {/* Payment History */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.history}</h3>
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{t.no_payments}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Payment ID', lang === 'hi' ? 'राशि' : 'Amount', lang === 'hi' ? 'तारीख' : 'Date', lang === 'hi' ? 'स्थिति' : 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.razorpay_payment_id}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{p.razorpay_payment_id}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>₹{(p.amount / 100).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: p.status === 'captured' ? '#16a34a' : '#ef4444', background: p.status === 'captured' ? '#dcfce7' : '#fee2e2', borderRadius: 20, padding: '3px 10px' }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
