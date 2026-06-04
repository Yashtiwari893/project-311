import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { triggerLinkedInJob } from '@/lib/github'
import { decrypt } from '@/lib/crypto'
import { z } from 'zod'

const UpdateSchema = z.object({
  name:          z.string().min(1).max(50).optional(),
  status:        z.enum(['draft','active','paused','completed','failed']).optional(),
  outreach_type: z.enum(['connect','inmail','message']).optional(),
  max_targets:   z.number().int().min(10).optional(),
  sequence:      z.array(z.object({
    type:       z.enum(['connection_request','follow_up','inmail']),
    message:    z.string(),
    delay_days: z.number().int().min(0),
  })).optional(),
  filters: z.record(z.unknown()).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('campaigns')
      .select('*, linkedin_accounts(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Fetch current campaign
    const { data: existing } = await supabase.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).single()
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // If activating, trigger jobs
    if (parsed.data.status === 'active' && existing.status !== 'active') {
      const { data: account } = await supabase.from('linkedin_accounts').select('li_at_cookie').eq('id', existing.account_id).single()
      if (account) {
        await triggerLinkedInJob({
          job_id:         crypto.randomUUID(),
          action_type:    'scrape_leads',
          li_at_cookie:   decrypt(account.li_at_cookie),
          campaign_id:    params.id,
          webhook_url:    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`,
          webhook_secret: process.env.WEBHOOK_SECRET!,
        })
      }
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update(parsed.data)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('campaigns').delete().eq('id', params.id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
