'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type SequenceStep = {
  type: 'connection_request' | 'follow_up' | 'inmail'
  message: string
  delay_days: number
}

type CampaignData = {
  id: string
  name: string
}

const TYPE_LABELS: Record<SequenceStep['type'], string> = {
  connection_request: 'Connection Request',
  follow_up: 'Follow-up Message',
  inmail: 'InMail',
}

const TYPE_LIMITS: Record<SequenceStep['type'], number> = {
  connection_request: 300,
  follow_up: 1000,
  inmail: 1000,
}

const VARIABLES = ['{{first_name}}', '{{company}}', '{{title}}']

export default function SequenceBuilderPage() {
  const params = useParams() as { id?: string }
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiIndustry, setAiIndustry] = useState('')
  const [aiGoal, setAiGoal] = useState('Build relationships and book meetings')
  const [aiTone, setAiTone] = useState('Professional')
  const [aiGenerating, setAiGenerating] = useState(false)

  const selectedStep = useMemo(() => steps[selectedIndex] ?? null, [steps, selectedIndex])

  useEffect(() => {
    if (!params.id) return

    async function load() {
      setLoading(true)
      try {
        const [campaignRes, sequenceRes] = await Promise.all([
          fetch(`/api/campaigns/${params.id}`),
          fetch(`/api/sequences?campaign_id=${params.id}`),
        ])

        if (!campaignRes.ok) throw new Error('Failed to load campaign')
        if (!sequenceRes.ok) throw new Error('Failed to load sequence')

        const campaignJson = await campaignRes.json()
        const sequenceJson = await sequenceRes.json()
        setCampaign({ id: params.id, name: campaignJson.data?.name || 'Campaign' })

        const existingSteps = Array.isArray(sequenceJson.sequence) && sequenceJson.sequence.length > 0
          ? sequenceJson.sequence
          : [{ type: 'connection_request', message: '', delay_days: 0 }]

        setSteps(existingSteps)
        setSelectedIndex(0)
      } catch (error) {
        setToast({ type: 'error', message: (error as Error).message || 'Unable to load sequence' })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const validateSteps = (currentSteps: SequenceStep[]) => {
    if (!currentSteps.length) return 'At least one step is required.'
    if (currentSteps.filter(step => step.type === 'connection_request').length > 1) {
      return 'Only one connection request step is allowed.'
    }
    for (const step of currentSteps) {
      if (step.delay_days < 0) return 'Delays must be 0 or greater.'
      const maxLength = TYPE_LIMITS[step.type]
      if (step.message.trim().length === 0) return 'Every step needs a message.'
      if (step.message.length > maxLength) {
        return `${TYPE_LABELS[step.type]} must be at most ${maxLength} characters.`
      }
    }
    return null
  }

  const updateStep = (index: number, updates: Partial<SequenceStep>) => {
    setSteps(prev => prev.map((step, idx) => idx === index ? { ...step, ...updates } : step))
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps(prev => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[nextIndex]
      next[nextIndex] = temp
      return next
    })
    setSelectedIndex(prev => {
      const nextIndex = prev + direction
      if (nextIndex < 0 || nextIndex >= steps.length) return prev
      return nextIndex
    })
  }

  const addStep = () => {
    setSteps(prev => {
      const hasConnectionRequest = prev.some(step => step.type === 'connection_request')
      const nextStep: SequenceStep = {
        type: hasConnectionRequest ? 'follow_up' : 'connection_request',
        message: '',
        delay_days: prev.length === 0 ? 0 : 3,
      }
      return [...prev, nextStep]
    })
    setSelectedIndex(steps.length)
  }

  const removeStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps(prev => prev.filter((_, idx) => idx !== index))
    setSelectedIndex(prev => Math.max(0, Math.min(prev, steps.length - 2)))
  }

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const current = selectedStep?.message || ''
    const next = current.slice(0, start) + variable + current.slice(end)
    updateStep(selectedIndex, { message: next })
    window.requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + variable.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const saveSequence = async () => {
    const error = validateSteps(steps)
    if (error) {
      setToast({ type: 'error', message: error })
      return
    }

    if (!params.id) return
    setSaving(true)

    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: params.id, steps }),
      })

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload?.error?.message || payload?.error || 'Save failed')
      }

      setToast({ type: 'success', message: 'Sequence saved successfully.' })
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const generateAISequence = async () => {
    setAiGenerating(true)

    try {
      const res = await fetch('/api/sequences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: aiIndustry, goal: aiGoal, tone: aiTone, steps_count: steps.length || 3 }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'AI generation failed')
      if (!Array.isArray(payload.steps)) throw new Error('Invalid AI response')

      setSteps(payload.steps)
      setSelectedIndex(0)
      setToast({ type: 'success', message: 'AI generated a draft sequence.' })
      setShowAIPanel(false)
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message })
    } finally {
      setAiGenerating(false)
    }
  }

  const panelHeader = campaign ? `${campaign.name} · Sequence Builder` : 'Sequence Builder'

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', color: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button onClick={() => router.back()} style={{ marginBottom: 8, background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{panelHeader}</h1>
        </div>
        <button onClick={saveSequence} disabled={saving} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Sequence'}
        </button>
      </div>

      {loading ? (
        <div>Loading sequence...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
          <section style={{ background: '#fff', borderRadius: 20, padding: 20, minHeight: 520, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
            <h2 style={{ marginTop: 0, fontSize: 20, marginBottom: 16 }}>Steps</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((step, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    width: '100%',
                    padding: 16,
                    borderRadius: 16,
                    border: index === selectedIndex ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: index === selectedIndex ? '#eff6ff' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 28, color: '#64748b' }}>
                    <span style={{ fontSize: 18 }}>⇅</span>
                    <span style={{ fontSize: 12, marginTop: 4 }}>#{index + 1}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#e0f2fe', color: '#0c4a6e', fontSize: 12 }}>{TYPE_LABELS[step.type]}</span>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#ede9fe', color: '#5b21b6', fontSize: 12 }}>{step.delay_days} days</span>
                    </div>
                    <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{step.message || 'No message yet. Select this step to edit.'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveStep(index, -1) }} disabled={index === 0} style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, width: 32, height: 32, cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveStep(index, 1) }} disabled={index === steps.length - 1} style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, width: 32, height: 32, cursor: index === steps.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" onClick={addStep} disabled={steps.length >= 7} style={{ width: '100%', marginTop: 20, padding: '14px 16px', borderRadius: 14, border: '1px dashed #cbd5e1', background: '#fff', color: '#0f172a', cursor: steps.length >= 7 ? 'not-allowed' : 'pointer' }}>
              + Add Step
            </button>
          </section>

          <section style={{ background: '#fff', borderRadius: 20, padding: 24, minHeight: 520, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Step Editor</h2>
            {!selectedStep ? (
              <p>Select a step to edit.</p>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Step Type</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {(['connection_request', 'follow_up', 'inmail'] as SequenceStep['type'][]).map((type) => (
                        <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="stepType"
                            value={type}
                            checked={selectedStep.type === type}
                            onChange={() => updateStep(selectedIndex, { type, delay_days: selectedIndex === 0 ? 0 : selectedStep.delay_days })}
                          />
                          <span>{TYPE_LABELS[type]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Delay</label>
                    <input
                      type="number"
                      min={0}
                      value={selectedStep.delay_days}
                      disabled={selectedIndex === 0}
                      onChange={(e) => updateStep(selectedIndex, { delay_days: Number(e.target.value) })}
                      style={{ width: 120, borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px' }}
                    />
                    <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>days after previous step</p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontWeight: 600 }}>Message</label>
                      <span style={{ color: '#64748b', fontSize: 13 }}>{selectedStep.message.length}/{TYPE_LIMITS[selectedStep.type]}</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={selectedStep.message}
                      onChange={(e) => updateStep(selectedIndex, { message: e.target.value })}
                      maxLength={TYPE_LIMITS[selectedStep.type]}
                      rows={9}
                      style={{ width: '100%', borderRadius: 16, border: '1px solid #cbd5e1', padding: 16, resize: 'vertical', minHeight: 180, fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {VARIABLES.map(variable => (
                      <button key={variable} type="button" onClick={() => insertVariable(variable)} style={{ border: '1px solid #cbd5e1', borderRadius: 999, padding: '8px 12px', background: '#f8fafc', cursor: 'pointer' }}>
                        {variable}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button type="button" onClick={() => setShowAIPanel(prev => !prev)} style={{ border: 'none', borderRadius: 14, background: '#4f46e5', color: '#fff', padding: '12px 18px', cursor: 'pointer' }}>
                      {showAIPanel ? 'Close AI Generator' : 'AI Generate Sequence'}
                    </button>
                    <button type="button" onClick={() => removeStep(selectedIndex)} disabled={steps.length <= 1} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', color: '#0f172a', padding: '12px 18px', cursor: steps.length <= 1 ? 'not-allowed' : 'pointer' }}>
                      Remove Step
                    </button>
                  </div>

                  {showAIPanel && (
                    <div style={{ borderRadius: 20, border: '1px solid #e2e8f0', padding: 18, background: '#f8fafc' }}>
                      <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 16 }}>AI Sequence Generator</h3>
                      <div style={{ display: 'grid', gap: 14 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          Industry / target
                          <input value={aiIndustry} onChange={(e) => setAiIndustry(e.target.value)} placeholder="e.g. SaaS founders" style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px' }} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          Goal
                          <input value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} placeholder="e.g. secure intro calls" style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px' }} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          Tone
                          <input value={aiTone} onChange={(e) => setAiTone(e.target.value)} placeholder="e.g. Professional" style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px' }} />
                        </label>
                        <button type="button" onClick={generateAISequence} disabled={aiGenerating} style={{ border: 'none', borderRadius: 14, background: '#2563eb', color: '#fff', padding: '12px 18px', cursor: aiGenerating ? 'not-allowed' : 'pointer' }}>
                          {aiGenerating ? 'Generating...' : 'Generate with AI'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '16px 20px', borderRadius: 16, background: toast.type === 'success' ? '#ecfdf5' : '#fee2e2', color: toast.type === 'success' ? '#166534' : '#991b1b', boxShadow: '0 10px 30px rgba(15,23,42,0.1)' }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
