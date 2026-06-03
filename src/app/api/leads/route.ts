import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { z } from 'zod'

const UpdateLeadSchema = z.object({
  status: z.enum(['pending','connected','message_sent','replied','accepted','ignored','failed']).optional(),
  notes:  z.string().max(1000).optional(),
  tags:   z.array(z.string()).optional(),
})

// GET /api/leads — get leads with filters
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const campaign_id = searchParams.get('campaign_id')
    const status      = searchParams.get('status')
    const search      = searchParams.get('search')
    const page        = parseInt(searchParams.get('page') || '1')
    const limit       = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (campaign_id) query = query.eq('campaign_id', campaign_id)
    if (status)      query = query.eq('status', status)
    if (search)      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,title.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Pipeline stats
    let stats: unknown = null
    try {
      const result = await supabase.rpc('get_lead_stats', { p_user_id: user.id }).single()
      stats = result.data
    } catch {
      stats = null
    }

    return NextResponse.json({ data, total: count, page, limit, stats })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH /api/leads/:id — update lead status/notes
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...body } = await req.json()
    const parsed = UpdateLeadSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('leads')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/leads/bulk-import — import leads from CSV/URLs
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { campaign_id, leads } = await req.json()
    if (!campaign_id || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'campaign_id and leads array required' }, { status: 400 })
    }

    // Deduplicate by linkedin_url
    const unique = leads.filter((l: { linkedin_url: string }, i: number, arr: { linkedin_url: string }[]) =>
      arr.findIndex(x => x.linkedin_url === l.linkedin_url) === i
    )

    const toInsert = unique.map((l: Record<string, string>) => ({
      ...l,
      campaign_id,
      user_id: user.id,
      status:  'pending',
    }))

    const { data, error } = await supabase
      .from('leads')
      .upsert(toInsert, { onConflict: 'campaign_id,linkedin_url' })
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imported: data?.length, total: unique.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
