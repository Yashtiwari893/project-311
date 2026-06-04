import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase.server'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { sendPaymentSuccessEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const razorpaySignature = req.headers.get('x-razorpay-signature')
    const githubSignature = req.headers.get('x-hub-signature-256')
    const signature = razorpaySignature || githubSignature || ''

    const event = JSON.parse(body)

    if (event.event === 'job.completed') {
      const secret = process.env.WEBHOOK_SECRET
      if (!secret) {
        return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 })
      }
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
      if (sig !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      if (!verifyWebhookSignature(body, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()

    switch (event.event) {
      case 'subscription.activated': {
        const sub = event.payload.subscription.entity
        const { data: dbSub } = await supabase.from('subscriptions').select('user_id,plan').eq('razorpay_sub_id', sub.id).single()
        if (dbSub) {
          // Update subscription status
          await supabase.from('subscriptions').update({
            status:        'active',
            current_start: new Date(sub.current_start * 1000).toISOString(),
            current_end:   new Date(sub.current_end   * 1000).toISOString(),
          }).eq('razorpay_sub_id', sub.id)

          // Update user plan
          await supabase.from('profiles').update({
            plan:            dbSub.plan,
            plan_expires_at: new Date(sub.current_end * 1000).toISOString(),
          }).eq('id', dbSub.user_id)
        }
        break
      }

      case 'payment.captured': {
        const payment = event.payload.payment.entity
        const subId   = payment.subscription_id

        const { data: dbSub } = await supabase.from('subscriptions').select('id,user_id,plan,amount').eq('razorpay_sub_id', subId).single()
        if (dbSub) {
          // Record payment
          await supabase.from('payments').insert({
            user_id:             dbSub.user_id,
            subscription_id:     dbSub.id,
            razorpay_payment_id: payment.id,
            razorpay_order_id:   payment.order_id,
            amount:              payment.amount,
            currency:            payment.currency,
            status:              'captured',
            method:              payment.method,
          })

          // Send email
          const { data: profile } = await supabase.from('profiles').select('email,name').eq('id', dbSub.user_id).single()
          if (profile) {
            await sendPaymentSuccessEmail(
              profile.email,
              profile.name || 'User',
              dbSub.plan.charAt(0).toUpperCase() + dbSub.plan.slice(1),
              `₹${(dbSub.amount / 100).toLocaleString('en-IN')}`,
              payment.id
            )
          }
        }
        break
      }

      case 'subscription.halted':
      case 'subscription.cancelled':
      case 'subscription.expired': {
        const sub = event.payload.subscription.entity
        const status = event.event.split('.')[1]
        await supabase.from('subscriptions').update({ status }).eq('razorpay_sub_id', sub.id)

        const { data: dbSub } = await supabase.from('subscriptions').select('user_id').eq('razorpay_sub_id', sub.id).single()
        if (dbSub) {
          await supabase.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('id', dbSub.user_id)
        }
        break
      }

      // GitHub Actions webhook (job done callback)
      case 'job.completed': {
        const { job_id, status, result, error: jobError } = event.payload
        await supabase.from('jobs').update({
          status,
          result,
          error:        jobError,
          completed_at: new Date().toISOString(),
        }).eq('id', job_id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (e: unknown) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
