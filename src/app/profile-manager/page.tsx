'use client'
import { memo, useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import { createClient } from '@/lib/supabase'

// ── Conversation flow definition ─────────────────────────────
const FLOW_STEPS = [
  {
    id: 'greeting',
    message: (lang: string, _data: Record<string, string> = {}) => lang === 'hi'
      ? '🙏 नमस्ते! मैं आपका LinkedIn AI Manager हूं।\n\nमैं आपकी पूरी LinkedIn profile को professional और attractive बनाऊंगा — headline, about, posts, projects सब कुछ।\n\nशुरू करते हैं? अपना नाम बताइए।'
      : '👋 Hi! I\'m your LinkedIn AI Manager.\n\nI\'ll transform your entire LinkedIn profile — headline, about, posts, projects, everything — into a professional powerhouse.\n\nLet\'s start! What\'s your name?',
    field: 'name',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? 'आपका नाम...' : 'Your full name...',
  },
  {
    id: 'current_role',
    message: (lang: string, data: Record<string, string>) => lang === 'hi'
      ? `अच्छा ${data.name}! 😊\n\nआप अभी किस field में काम करते हैं? (जैसे: Software Engineer at TCS, MBA Student, Freelance Designer, etc.)`
      : `Nice to meet you, ${data.name}! 😊\n\nWhat's your current role/field? (e.g. Software Engineer at Infosys, MBA student, Freelance Designer)`,
    field: 'current_role',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? 'जैसे: Marketing Manager at Reliance' : 'e.g. Product Manager at Zomato',
  },
  {
    id: 'experience',
    message: (lang: string) => lang === 'hi'
      ? '💼 आपका total experience कितना है? और कौन-कौन सी companies में काम किया है?\n\n(जितना याद हो, उतना बताइए — AI बाकी professional तरीके से लिख देगा)'
      : '💼 How many years of experience do you have, and which companies/roles have you worked at?\n\n(Share as much as you remember — AI will craft the rest professionally)',
    field: 'experience',
    inputType: 'textarea',
    placeholder: (lang: string) => lang === 'hi'
      ? 'जैसे: 5 साल का experience, पहले Wipro में था, फिर startup में 2 साल...'
      : 'e.g. 5 years experience, previously at Wipro for 3 years, then a startup...',
  },
  {
    id: 'skills',
    message: (lang: string) => lang === 'hi'
      ? '🛠️ आपकी top skills क्या हैं? (technical और soft skills दोनों)\n\nजैसे: React, Python, Project Management, Team Leadership, etc.'
      : '🛠️ What are your top skills? (technical + soft skills both)\n\ne.g. React, Python, Project Management, Public Speaking, etc.',
    field: 'skills',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? 'Skills की list...' : 'Comma-separated skills...',
  },
  {
    id: 'achievements',
    message: (lang: string) => lang === 'hi'
      ? '🏆 आपकी कोई बड़ी achievement या project है जो LinkedIn पर दिखनी चाहिए?\n\n(awards, certifications, projects, college achievements — कुछ भी)'
      : '🏆 Any big achievements, projects, or certifications you want highlighted on LinkedIn?\n\n(awards, side projects, college achievements — anything goes!)',
    field: 'achievements',
    inputType: 'textarea',
    placeholder: (lang: string) => lang === 'hi'
      ? 'जैसे: IIT से B.Tech, AWS certified, 10 लाख का project deliver किया...'
      : 'e.g. B.Tech from NIT, AWS certified, delivered ₹10L project...',
  },
  {
    id: 'goal',
    message: (lang: string) => lang === 'hi'
      ? '🎯 LinkedIn पर आपका main goal क्या है?\n\n1️⃣ Job change करना\n2️⃣ Clients / freelance work लाना\n3️⃣ Personal branding / thought leadership\n4️⃣ Business networking\n5️⃣ कुछ और'
      : '🎯 What\'s your main goal on LinkedIn?\n\n1️⃣ Find a new job\n2️⃣ Get clients / freelance work\n3️⃣ Personal branding / thought leadership\n4️⃣ Business networking\n5️⃣ Something else',
    field: 'goal',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? '1, 2, 3, 4, 5 या describe करें...' : 'Type 1-5 or describe...',
  },
  {
    id: 'tone',
    message: (lang: string) => lang === 'hi'
      ? '✍️ आपका LinkedIn tone कैसा हो?\n\n1️⃣ Professional & formal (corporate jobs)\n2️⃣ Friendly & approachable (startup/freelance)\n3️⃣ Bold & confident (leadership/sales)\n4️⃣ Technical & precise (engineering/IT)\n5️⃣ Creative & storytelling (marketing/design)'
      : '✍️ What tone should your LinkedIn profile have?\n\n1️⃣ Professional & formal (corporate)\n2️⃣ Friendly & approachable (startup/freelance)\n3️⃣ Bold & confident (leadership/sales)\n4️⃣ Technical & precise (engineering/IT)\n5️⃣ Creative & storytelling (marketing/design)',
    field: 'tone',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? '1-5 चुनें...' : 'Choose 1-5...',
  },
  {
    id: 'post_topics',
    message: (lang: string) => lang === 'hi'
      ? '📝 LinkedIn पर posts के लिए कौन से topics अच्छे लगते हैं आपको?\n\n(जैसे: industry trends, career advice, project updates, motivational, technical tips)\n\nया मैं आपके field के हिसाब से suggest करूं? (हां/no लिखें)'
      : '📝 What topics would you like for your LinkedIn posts?\n\n(e.g. industry trends, career tips, project updates, motivational, technical how-tos)\n\nOr should I suggest based on your profile? (type yes/no)',
    field: 'post_topics',
    inputType: 'text',
    placeholder: (lang: string) => lang === 'hi' ? 'Topics या हां/no...' : 'Topics or yes/no...',
  },
  {
    id: 'linkedin_url',
    message: (lang: string) => lang === 'hi'
      ? '🔗 आपकी LinkedIn profile का URL क्या है?\n\n(linkedin.com/in/yourname)\n\nनहीं पता? अभी बाद में add कर सकते हैं — "skip" लिखें'
      : '🔗 What\'s your LinkedIn profile URL?\n\n(linkedin.com/in/yourname)\n\nDon\'t know it? Type "skip" — you can add it later',
    field: 'linkedin_url',
    inputType: 'text',
    placeholder: 'linkedin.com/in/...',
  },
]

type MessageType = { role: 'ai' | 'user'; text: string; timestamp: Date }
type ProfileData = Record<string, string>

type MessageInputProps = {
  placeholder: string
  disabled: boolean
  sending: boolean
  onSend: (value: string) => void
}

const MessageInput = memo(function MessageInput({
  placeholder,
  disabled,
  sending,
  onSend,
}: MessageInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleLocalChange = useCallback((value: string) => {
    setInput(value)
  }, [])

  const handleLocalSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
    inputRef.current?.focus()
  }, [input, disabled, onSend])

  return (
    <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '16px 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#f8fafc', borderRadius: 14, padding: '10px 12px', border: '1.5px solid #e2e8f0' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => handleLocalChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLocalSend() } }}
          placeholder={placeholder}
          rows={1}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#0f172a', fontSize: 13, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', maxHeight: 100 }}
        />
        <button onClick={handleLocalSend} disabled={disabled || !input.trim()} style={{ width: 36, height: 36, borderRadius: 9, background: input.trim() ? '#4f72ff' : '#e2e8f0', border: 'none', color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          ↑
        </button>
      </div>
    </div>
  )
})
MessageInput.displayName = 'MessageInput'

export default function ProfileManagerPage() {
  const supabase = createClient()
  const [lang, setLang]           = useState<'en'|'hi'>('en')
  const [messages, setMessages]   = useState<MessageType[]>([])
  const [step, setStep]           = useState(0)
  const [data, setData]           = useState<ProfileData>({})
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState<Record<string, string> | null>(null)
  const [sending, setSending]       = useState(false)
  const [done, setDone]             = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue]   = useState('')
  const [showResume, setShowResume] = useState(false)
  const [resumeDraft, setResumeDraft] = useState<ProfileData | null>(null)
  const bottomRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single()

      const userLang = profile?.language === 'hi' ? 'hi' : 'en'
      setLang(userLang)

      // Check for saved draft
      const savedDraft = localStorage.getItem('profile_draft')
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft)
          setResumeDraft(parsed)
          setShowResume(true)
        } catch {
          // Invalid draft, ignore
        }
      }

      // First AI message
      const first = FLOW_STEPS[0].message(userLang, {})
      setMessages([{ role: 'ai', text: first, timestamp: new Date() }])
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, generating])

  useEffect(() => {
    if (Object.keys(data).length > 0) {
      localStorage.setItem('profile_draft', JSON.stringify(data))
    }
  }, [data])

  const addMsg = useCallback((role: 'ai'|'user', text: string) => {
    setMessages(prev => [...prev, { role, text, timestamp: new Date() }])
  }, [])

  const handleSend = useCallback(async (val: string) => {
    if (!val || sending) return
    setSending(true)
    setInput('')
    addMsg('user', val)

    const currentStep = FLOW_STEPS[step]
    const newData = { ...data, [currentStep.field]: val }
    setData(newData)

    const nextStep = step + 1
    setStep(nextStep)

    await new Promise(r => setTimeout(r, 600))

    if (nextStep < FLOW_STEPS.length) {
      const nextMsg = FLOW_STEPS[nextStep].message(lang, newData)
      addMsg('ai', nextMsg)
    } else {
      // All data collected — generate content
      addMsg('ai', lang === 'hi'
        ? '✨ सभी जानकारी मिल गई! अब AI आपके लिए LinkedIn content generate कर रहा है...\n\n⏳ 30-60 seconds लगेंगे — please wait!'
        : '✨ Got all the info! AI is now generating your personalized LinkedIn content...\n\n⏳ This takes 30-60 seconds — please wait!')
      setGenerating(true)
      await generateContent(newData)
    }
    setSending(false)
    inputRef.current?.focus()
  }, [input, sending, step, data, lang, generateContent, addMsg])

  const startEdit = useCallback((field: string) => {
    setEditingField(field)
    setEditValue(generated?.[field] || '')
  }, [generated])

  const saveEdit = useCallback(() => {
    if (editingField && generated) {
      setGenerated({ ...generated, [editingField]: editValue })
      setEditingField(null)
      setEditValue('')
    }
  }, [editingField, editValue, generated])

  const cancelEdit = useCallback(() => {
    setEditingField(null)
    setEditValue('')
  }, [])

  const handleResume = useCallback(() => {
    if (resumeDraft) {
      setData(resumeDraft)
      setStep(Object.keys(resumeDraft).length)
      setShowResume(false)
      setResumeDraft(null)
    }
  }, [resumeDraft])

  const handleDiscard = useCallback(() => {
    setShowResume(false)
    setResumeDraft(null)
    localStorage.removeItem('profile_draft')
  }, [])

  const generateContent = useCallback(async (profileData: ProfileData) => {
    try {
      const res = await fetch('/api/profile-manager/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileData, lang }),
      })
      
      if (!res.body) throw new Error('No response body')
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let streamingAbout = ''
      let completeContent: Record<string, string> | null = null
      let showedStreamingMessage = false
      
      // Read streamed response line by line
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            
            if (msg.type === 'start' && !showedStreamingMessage) {
              // Show loading message once
              addMsg('ai', lang === 'hi'
                ? '⏳ Generating your about section... (streaming tokens token-by-token)'
                : '⏳ Generating your about section... (streaming tokens token-by-token)')
              showedStreamingMessage = true
            } else if (msg.type === 'token') {
              // Accumulate streamed tokens into about section
              streamingAbout += msg.content
              // You could update UI here in real-time with partial content
            } else if (msg.type === 'complete') {
              // Got full response
              completeContent = msg.content
            }
          } catch (e) {
            // JSON parse error, skip line
            console.error('Failed to parse stream line:', line, e)
          }
        }
      }
      
      // Final buffer processing
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer)
          if (msg.type === 'complete') {
            completeContent = msg.content
          }
        } catch (e) {
          console.error('Failed to parse final buffer:', buffer, e)
        }
      }
      
      setGenerating(false)
      if (completeContent) {
        setGenerated(completeContent)
        addMsg('ai', lang === 'hi'
          ? `🎉 आपका LinkedIn content तैयार है!\n\nनीचे देखें — headline, about, 5 posts, और skills सब AI ने लिख दिया है। Review करें और approve करें!`
          : `🎉 Your LinkedIn content is ready!\n\nScroll down to review your headline, about section, 5 post drafts, and skills — all crafted by AI just for you. Review and approve!`)
      }
    } catch (e) {
      console.error('Generation error:', e)
      setGenerating(false)
      addMsg('ai', lang === 'hi' ? '❌ कुछ error आई। Please refresh करें।' : '❌ Something went wrong. Please refresh.')
    }
  }, [lang, addMsg])

  const handleApproveAndUpdate = async () => {
    if (!generated || !data.linkedin_url || data.linkedin_url === 'skip') {
      addMsg('ai', lang === 'hi'
        ? '⚠️ LinkedIn profile URL नहीं है। Dashboard → Accounts में जाकर पहले account connect करें।'
        : '⚠️ No LinkedIn URL provided. Go to Dashboard → Accounts to connect your account first.')
      return
    }
    setSending(true)
    try {
      await fetch('/api/profile-manager/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, generated, profile: data }),
      })
      setDone(true)
      localStorage.removeItem('profile_draft')
      addMsg('ai', lang === 'hi'
        ? '🚀 LinkedIn update शुरू हो गया! GitHub Actions Playwright से आपकी profile update कर रहा है।\n\nआपको email आएगा जब सब हो जाए। Dashboard पर status देख सकते हैं।'
        : '🚀 LinkedIn update is running! GitHub Actions + Playwright is updating your profile right now.\n\nYou\'ll get an email when it\'s done. Check Dashboard for live status.')
    } catch {
      addMsg('ai', lang === 'hi' ? '❌ Error। Please retry।' : '❌ Error. Please retry.')
    }
    setSending(false)
  }

  const currentStepDef = step < FLOW_STEPS.length ? FLOW_STEPS[step] : null
  const inputPlaceholder = typeof currentStepDef?.placeholder === 'function'
    ? currentStepDef.placeholder(lang)
    : currentStepDef?.placeholder || ''
  const progress = Math.min(100, Math.round((step / FLOW_STEPS.length) * 100))

  const toneLabels: Record<string, string> = { '1': 'Professional and formal', '2': 'Friendly & approachable', '3': 'Bold & confident', '4': 'Technical & precise', '5': 'Creative & storytelling' }
  const goalLabels: Record<string, string> = { '1': 'Job change', '2': 'Clients / freelance', '3': 'Personal branding', '4': 'Business networking' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#4f72ff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16 }}>🤖</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
            {lang === 'hi' ? 'LinkedIn AI Profile Manager' : 'LinkedIn AI Profile Manager'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {lang === 'hi' ? 'आपकी पूरी profile AI से बनाएं' : 'Complete LinkedIn makeover powered by AI'}
          </div>
        </div>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, height: 5, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#4f72ff,#8b5cf6)', borderRadius: 9999, transition: 'width .4s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{progress}%</span>
        </div>
        <button onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
        </button>
      </div>

      {/* Resume Draft Banner */}
      {showResume && resumeDraft && (
        <div style={{ background: '#fef3c7', borderBottom: '2px solid #fbbf24', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>⏸️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
              {lang === 'hi' ? 'अपना draft resume करें?' : 'Resume your draft?'}
            </div>
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
              {lang === 'hi' 
                ? `आपने ${Object.keys(resumeDraft).length} fields भर दिए थे — वहीं से शुरू करें?`
                : `You've already filled ${Object.keys(resumeDraft).length} fields — continue from there?`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleResume} style={{ padding: '8px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              {lang === 'hi' ? 'Resume करें' : 'Resume'}
            </button>
            <button onClick={handleDiscard} style={{ padding: '8px 16px', background: '#fff', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              {lang === 'hi' ? 'नया शुरू करें' : 'Start Fresh'}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {msg.role === 'ai' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f72ff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 4 }}>🤖</div>
            )}
            <div style={{
              maxWidth: '75%',
              background: msg.role === 'user' ? '#4f72ff' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#0f172a',
              border: msg.role === 'ai' ? '1px solid #e2e8f0' : 'none',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 16px',
              fontSize: 13,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {(generating || (sending && step <= FLOW_STEPS.length)) && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f72ff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '14px 18px', display: 'flex', gap: 5 }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1.2s ease infinite', animationDelay: `${j * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Generated Content Preview */}
        {generated && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, animation: 'slideUp .4s ease' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 16 }}>
              🎯 {lang === 'hi' ? 'आपका LinkedIn Content' : 'Your LinkedIn Content'}
            </div>

            {/* Headline */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4f72ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Headline</div>
              {editingField === 'headline' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #4f72ff', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', minHeight: 60 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={saveEdit} style={{ padding: '8px 16px', background: '#4f72ff', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={cancelEdit} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEdit('headline')} style={{ background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 13, color: '#0f172a', lineHeight: 1.6, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
                  {generated?.headline}
                  <div style={{ position: 'absolute', top: 8, right: 8, opacity: 0, background: '#4f72ff', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, transition: 'opacity 0.2s' }} className="edit-hint">✏️ Click to edit</div>
                </div>
              )}
            </div>

            {/* About */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>About Section</div>
              {editingField === 'about' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #8b5cf6', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', minHeight: 150 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={saveEdit} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={cancelEdit} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEdit('about')} style={{ background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 12, color: '#0f172a', lineHeight: 1.7, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', cursor: 'pointer' }}>
                  {generated?.about}
                </div>
              )}
            </div>

            {/* Skills */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Skills (top 10)</div>
              {editingField === 'skills' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="Comma-separated skills"
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #10b981', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', minHeight: 80 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={saveEdit} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={cancelEdit} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => startEdit('skills')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, cursor: 'pointer' }}>
                  {(generated?.skills || '').split(',').map((s, i) => (
                    <span key={i} style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{s.trim()}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Posts */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>LinkedIn Posts (5 drafts)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['post1','post2','post3','post4','post5'].map((key, i) => generated?.[key] ? (
                  <div key={key}>
                    {editingField === key ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #f59e0b', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', minHeight: 100 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button onClick={saveEdit} style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                          <button onClick={cancelEdit} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => startEdit(key)} style={{ background: '#fef9c3', borderRadius: 8, padding: 12, fontSize: 12, color: '#0f172a', lineHeight: 1.6, border: '1px solid #fde68a', cursor: 'pointer' }}>
                        <span style={{ fontSize: 10, color: '#92400e', fontWeight: 700 }}>Post {i+1}</span>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{generated[key]}</div>
                      </div>
                    )}
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Action buttons */}
            {!done && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={handleApproveAndUpdate} disabled={sending} style={{ flex: 2, padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {sending ? '⏳ Updating...' : (lang === 'hi' ? '🚀 LinkedIn पर Update करें' : '🚀 Update on LinkedIn')}
                </button>
                <button onClick={() => addMsg('ai', lang === 'hi' ? 'कौन सा section change करना है? बताइए!' : 'Which section would you like to change? Let me know!')} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  ✏️ {lang === 'hi' ? 'Edit करें' : 'Request changes'}
                </button>
              </div>
            )}
            {done && (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', color: '#15803d', fontWeight: 600, fontSize: 13 }}>
                ✅ {lang === 'hi' ? 'LinkedIn update चल रहा है! Dashboard पर status देखें।' : 'LinkedIn update in progress! Check Dashboard for live status.'}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {step < FLOW_STEPS.length && !generating && (
        <MessageInput
          input={input}
          placeholder={inputPlaceholder}
          disabled={sending}
          sending={sending}
          onChange={handleInputChange}
          onSend={handleSend}
          inputRef={inputRef}
        />
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        div:hover .edit-hint { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
