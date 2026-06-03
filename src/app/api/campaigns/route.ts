import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { z } from 'zod'

const CreateSchema = z.object({
  name:          z.string().min(1).max(50),
  type:          z.enum(['linkedin_search','post_engagers','event_attendees','group_members','custom_list','sales_navigator']),
  mode:          z.enum(['outbound','inbound']).default('outbound'),
  outreach_type: z.enum(['connect','inmail','message']).default('connect'),
  account_id:    z.string().uuid().optional(),
  max_targets:   z.number().int().min(10).max(10000).default(250),
  sequence:      z.array(z.object({
    type:       z.enum(['connection_request','follow_up','inmail']),
    message:    z.string(),
    delay_days: z.number().int().min(0),
  })).default([]),
  filters: z.record(z.unknown()).default({}),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status   = searchParams.get('status')
    const account  = searchParams.get('account_id')
    const search   = searchParams.get('search')
    const page     = parseInt(searchParams.get('page') || '1')
    const limit    = parseInt(searchParams.get('limit') || '10')

    let query = supabase
      .from('campaigns')
      .select('*, linkedin_accounts(id,name,profile_url)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status)  query = query.eq('status', status)
    if (account) query = query.eq('account_id', account)
    if (search)  query = query.ilike('name', `%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count, page, limit })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check plan limits
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const plan = profile?.plan || 'free'
    if (plan === 'free') {
      return NextResponse.json({ error: 'Please upgrade your plan to create campaigns' }, { status: 403 })
    }
    if (plan === 'starter') {
      const { count } = await supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      if ((count || 0) >= 5) {
        return NextResponse.json({ error: 'Starter plan allows max 5 campaigns. Upgrade to Pro!' }, { status: 403 })
      }
    }

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('campaigns')
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
