import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const range       = searchParams.get('range') || '7'  // days
    const campaign_id = searchParams.get('campaign_id')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(range))
    const startStr = startDate.toISOString().split('T')[0]

    // Daily analytics
    let dailyQuery = supabase
      .from('analytics_daily')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .order('date', { ascending: true })
    if (campaign_id) dailyQuery = dailyQuery.eq('campaign_id', campaign_id)
    const { data: daily } = await dailyQuery

    // Lead funnel counts
    const { data: funnel } = await supabase
      .from('leads')
      .select('status')
      .eq('user_id', user.id)
      .then(res => ({
        data: {
          total:         res.data?.length || 0,
          pending:       res.data?.filter(l => l.status === 'pending').length || 0,
          connected:     res.data?.filter(l => l.status === 'connected').length || 0,
          message_sent:  res.data?.filter(l => l.status === 'message_sent').length || 0,
          replied:       res.data?.filter(l => l.status === 'replied').length || 0,
          accepted:      res.data?.filter(l => l.status === 'accepted').length || 0,
          ignored:       res.data?.filter(l => l.status === 'ignored').length || 0,
          failed:        res.data?.filter(l => l.status === 'failed').length || 0,
        }
      }))

    // Campaign performance
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('name, status, targets_count, success_count, failed_count')
      .eq('user_id', user.id)
      .order('success_count', { ascending: false })
      .limit(5)

    // Totals from daily
    const totals = (daily || []).reduce((acc, row) => ({
      connections_sent:     acc.connections_sent     + (row.connections_sent     || 0),
      connections_accepted: acc.connections_accepted + (row.connections_accepted || 0),
      messages_sent:        acc.messages_sent        + (row.messages_sent        || 0),
      replies_received:     acc.replies_received     + (row.replies_received     || 0),
    }), { connections_sent: 0, connections_accepted: 0, messages_sent: 0, replies_received: 0 })

    const acceptance_rate = totals.connections_sent > 0
      ? Math.round((totals.connections_accepted / totals.connections_sent) * 100)
      : 0

    const reply_rate = totals.messages_sent > 0
      ? Math.round((totals.replies_received / totals.messages_sent) * 100)
      : 0

    return NextResponse.json({
      daily,
      funnel,
      campaigns,
      totals,
      acceptance_rate,
      reply_rate,
      range: parseInt(range),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
