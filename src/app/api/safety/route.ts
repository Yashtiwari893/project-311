import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase.server'

const SAFETY_LIMITS = {
  free:    { daily_connections: 0,  daily_messages: 0,  weekly_connections: 0 },
  starter: { daily_connections: 20, daily_messages: 30,  weekly_connections: 100 },
  pro:     { daily_connections: 40, daily_messages: 80,  weekly_connections: 200 },
  agency:  { daily_connections: 80, daily_messages: 150, weekly_connections: 400 },
} as const

// GET /api/safety/check — check if action is allowed
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = new URL(req.url).searchParams.get('account_id')
    const action    = new URL(req.url).searchParams.get('action') as 'connect' | 'message'

    // Get user plan
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const plan = (profile?.plan || 'free') as keyof typeof SAFETY_LIMITS
    const limits = SAFETY_LIMITS[plan]

    // Count today's actions from jobs table
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action_type', action === 'connect' ? 'connect' : 'send_message')
      .eq('status', 'done')
      .gte('completed_at', `${today}T00:00:00`)

    const dailyLimit  = action === 'connect' ? limits.daily_connections : limits.daily_messages
    const used        = todayCount || 0
    const remaining   = Math.max(0, dailyLimit - used)
    const allowed     = remaining > 0

    // Check weekly for connections
    let weeklyRemaining: number = limits.weekly_connections
    if (action === 'connect') {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const { count: weekCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action_type', 'connect')
        .eq('status', 'done')
        .gte('completed_at', weekStart.toISOString())
      weeklyRemaining = Math.max(0, limits.weekly_connections - (weekCount || 0))
    }

    return NextResponse.json({
      allowed: allowed && weeklyRemaining > 0,
      daily_used:       used,
      daily_limit:      dailyLimit,
      daily_remaining:  remaining,
      weekly_remaining: weeklyRemaining,
      plan,
      reset_at:         `${today}T23:59:59`,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/safety/report — report a LinkedIn warning/restriction
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { account_id, restriction_type, message } = await req.json()

    // Mark account as limited
    await supabase
      .from('linkedin_accounts')
      .update({ status: 'limited' })
      .eq('id', account_id)
      .eq('user_id', user.id)

    // Pause all active campaigns for this account
    await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('account_id', account_id)
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Create urgent notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type:    'safety_alert',
      title:   '⚠️ LinkedIn Safety Alert',
      message: `Your account may be restricted. All campaigns paused automatically. ${message || ''}`,
      data:    { account_id, restriction_type },
    })

    return NextResponse.json({ success: true, action: 'account_paused_all_campaigns_paused' })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
