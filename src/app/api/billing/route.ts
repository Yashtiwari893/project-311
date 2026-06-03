import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { razorpay, createSubscription, PLAN_CONFIG } from '@/lib/razorpay'
import { z } from 'zod'
import type { Plan } from '@/types'

const SubscribeSchema = z.object({
  plan: z.enum(['starter', 'pro', 'agency']),
})

// POST /api/billing — create Razorpay subscription
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = SubscribeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const { plan } = parsed.data
    const { data: profile } = await supabase.from('profiles').select('email,name').eq('id', user.id).single()

    // Cancel existing subscription if any
    const { data: existing } = await supabase.from('subscriptions').select('razorpay_sub_id').eq('user_id', user.id).eq('status', 'active').single()
    if (existing?.razorpay_sub_id) {
      try { await razorpay.subscriptions.cancel(existing.razorpay_sub_id, false) } catch {}
    }

    // Create new subscription
    const sub = await createSubscription(plan, user.id)

    // Save to DB
    await supabase.from('subscriptions').insert({
      user_id:          user.id,
      razorpay_sub_id:  sub.id,
      razorpay_plan_id: PLAN_CONFIG[plan].plan_id,
      plan,
      status:           'created',
      amount:           PLAN_CONFIG[plan].amount,
      currency:         'INR',
    })

    return NextResponse.json({
      subscription_id: sub.id,
      razorpay_key:    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      plan,
      amount:          PLAN_CONFIG[plan].amount,
      name:            PLAN_CONFIG[plan].name,
      prefill: {
        email: profile?.email,
        name:  profile?.name,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/billing — get current subscription + payment history
export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: sub }, { data: payments }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])

    return NextResponse.json({ subscription: sub, payments: payments || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
