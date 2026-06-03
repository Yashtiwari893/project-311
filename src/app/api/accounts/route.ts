import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { z } from 'zod'

const AddAccountSchema = z.object({
  name:           z.string().min(1),
  email:          z.string().email().optional(),
  profile_url:    z.string().url().optional(),
  li_at_cookie:   z.string().min(10),
  daily_limit:    z.number().int().min(1).max(50).default(25),
})

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('linkedin_accounts')
      .select('id,name,email,profile_url,status,daily_limit,weekly_sent,last_active_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check plan account limit
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const limits: Record<string, number> = { free: 0, starter: 1, pro: 3, agency: 10 }
    const maxAccounts = limits[profile?.plan || 'free']

    const { count } = await supabase.from('linkedin_accounts').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count || 0) >= maxAccounts) {
      return NextResponse.json({ error: `Your ${profile?.plan} plan allows max ${maxAccounts} accounts. Upgrade to add more!` }, { status: 403 })
    }

    const body = await req.json()
    const parsed = AddAccountSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('linkedin_accounts')
      .insert({ ...parsed.data, user_id: user.id })
      .select('id,name,email,profile_url,status,daily_limit')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
