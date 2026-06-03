import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'noreply@linkedflow.in'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://linkedflow.in'

// ── Welcome Email ─────────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '🚀 LinkedFlow में आपका स्वागत है! Welcome to LinkedFlow!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:40px;border-radius:16px">
        <div style="text-align:center;margin-bottom:32px">
          <div style="width:50px;height:50px;background:#4f72ff;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
            <span style="color:#fff;font-size:22px;font-weight:900">L</span>
          </div>
          <h1 style="color:#fff;margin:0;font-size:24px">LinkedFlow India</h1>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:28px;color:#fff">
          <h2 style="margin:0 0 12px;font-size:20px">नमस्ते ${name}! 👋</h2>
          <p style="color:#94a3b8;line-height:1.7;margin:0 0 20px">
            LinkedFlow में आपका स्वागत है — India का #1 LinkedIn automation platform.<br><br>
            Welcome to LinkedFlow — India's smartest LinkedIn outreach platform.
          </p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#4f72ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">
            Dashboard खोलें → Open Dashboard
          </a>
        </div>
        <div style="text-align:center;margin-top:24px">
          <p style="color:#475569;font-size:12px">
            LinkedFlow India · support@linkedflow.in<br>
            <a href="${APP_URL}/unsubscribe" style="color:#475569">Unsubscribe</a>
          </p>
        </div>
      </div>
    `,
  })
}

// ── Campaign Done Email ───────────────────────────────────────
export async function sendCampaignDoneEmail(
  email: string,
  name: string,
  campaignName: string,
  stats: { sent: number; accepted: number; rate: string }
) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `✅ कैंपेन पूरा हुआ: ${campaignName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:40px;border-radius:16px">
        <h2 style="color:#22c55e;margin:0 0 8px">✅ Campaign Complete!</h2>
        <h3 style="color:#fff;margin:0 0 24px;font-weight:400">${campaignName}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
          ${[
            { label: 'Sent / भेजे', val: stats.sent, color: '#4f72ff' },
            { label: 'Accepted / स्वीकृत', val: stats.accepted, color: '#22c55e' },
            { label: 'Rate / दर', val: stats.rate, color: '#f59e0b' },
          ].map(s => `
            <div style="background:#1e293b;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${s.color}">${s.val}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:4px">${s.label}</div>
            </div>
          `).join('')}
        </div>
        <a href="${APP_URL}/campaigns" style="display:inline-block;background:#4f72ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">
          View Leads → लीड्स देखें
        </a>
      </div>
    `,
  })
}

// ── Payment Success Email ─────────────────────────────────────
export async function sendPaymentSuccessEmail(
  email: string,
  name: string,
  plan: string,
  amount: string,
  paymentId: string
) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `💳 Payment Successful — ${plan} Plan`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:40px;border-radius:16px">
        <h2 style="color:#22c55e">💳 Payment Successful!</h2>
        <p style="color:#94a3b8">नमस्ते ${name}, आपका भुगतान सफल रहा।<br>Hello ${name}, your payment was successful.</p>
        <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155;color:#fff">
            <span style="color:#94a3b8">Plan</span><strong>${plan}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155;color:#fff">
            <span style="color:#94a3b8">Amount / राशि</span><strong style="color:#22c55e">${amount}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;color:#fff">
            <span style="color:#94a3b8">Payment ID</span><code style="font-size:12px;color:#94a3b8">${paymentId}</code>
          </div>
        </div>
        <a href="${APP_URL}/billing" style="display:inline-block;background:#4f72ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">
          View Billing → बिलिंग देखें
        </a>
      </div>
    `,
  })
}
