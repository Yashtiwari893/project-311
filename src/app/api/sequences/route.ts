import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import Groq from 'groq-sdk'
import { z } from 'zod'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SequenceSchema = z.object({
  campaign_id: z.string().uuid(),
  steps: z.array(z.object({
    type:       z.enum(['connection_request', 'follow_up', 'inmail']),
    message:    z.string().min(1).max(300),
    delay_days: z.number().int().min(0).max(30),
  })).min(1).max(7),
})

// GET /api/sequences/:campaign_id — get sequence for a campaign
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaignId = new URL(req.url).searchParams.get('campaign_id')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const { data } = await supabase
      .from('campaigns')
      .select('sequence')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ sequence: data?.sequence || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/sequences — save sequence
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = SequenceSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('campaigns')
      .update({ sequence: parsed.data.steps })
      .eq('id', parsed.data.campaign_id)
      .eq('user_id', user.id)
      .select('id, sequence')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/sequences/ai-generate — AI generates message sequence
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { industry, goal, tone, steps_count = 3 } = await req.json()

    const prompt = `Generate a LinkedIn outreach message sequence for an Indian B2B professional.

Context:
- Industry/target: ${industry}
- Goal: ${goal}
- Tone: ${tone}
- Number of steps: ${steps_count}

Rules:
- Step 1 is always a connection request (max 300 chars)
- Subsequent steps are follow-up messages
- Delay between steps: Step 1 = 0 days, Step 2 = 3 days, Step 3 = 7 days, etc.
- Messages must feel human and personal, NOT salesy
- Reference Indian context where relevant (mention Indian companies, cities, situations)
- Include {{first_name}} and {{company}} variables

Return ONLY a JSON array:
[
  {"type": "connection_request", "message": "...", "delay_days": 0},
  {"type": "follow_up", "message": "...", "delay_days": 3},
  {"type": "follow_up", "message": "...", "delay_days": 7}
]`

    const completion = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 1500,
    })

    const raw = completion.choices[0]?.message?.content || '[]'
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    const steps = match ? JSON.parse(match[0]) : []

    return NextResponse.json({ steps })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
