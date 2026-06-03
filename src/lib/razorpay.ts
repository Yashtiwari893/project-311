import Razorpay from 'razorpay'
import crypto from 'crypto'
import type { Plan } from '@/types'

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export const PLAN_CONFIG: Record<Exclude<Plan, 'free'>, { plan_id: string; amount: number; name: string }> = {
  starter: {
    plan_id: process.env.RAZORPAY_PLAN_STARTER!,
    amount: 299900,   // ₹2,999 in paise
    name: 'LinkedFlow Starter',
  },
  pro: {
    plan_id: process.env.RAZORPAY_PLAN_PRO!,
    amount: 699900,   // ₹6,999 in paise
    name: 'LinkedFlow Pro',
  },
  agency: {
    plan_id: process.env.RAZORPAY_PLAN_AGENCY!,
    amount: 1499900,  // ₹14,999 in paise
    name: 'LinkedFlow Agency',
  },
}

export async function createSubscription(plan: Exclude<Plan, 'free'>, userId: string) {
  const config = PLAN_CONFIG[plan]
  const sub = await razorpay.subscriptions.create({
    plan_id: config.plan_id,
    total_count: 12,       // 12 months
    quantity: 1,
    customer_notify: 1,
    notes: { user_id: userId, plan },
  })
  return sub
}

export async function cancelSubscription(subscriptionId: string) {
  return razorpay.subscriptions.cancel(subscriptionId, false)
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  )
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === signature
}

export function paiseToRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}
