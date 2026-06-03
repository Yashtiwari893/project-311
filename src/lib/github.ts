const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const GITHUB_OWNER = process.env.GITHUB_OWNER!
const GITHUB_REPO  = process.env.GITHUB_REPO!

interface JobPayload {
  job_id: string
  action_type: 'connect' | 'send_message' | 'inmail' | 'scrape_leads'
  li_at_cookie: string
  target_url?: string
  message?: string
  campaign_id: string
  lead_id?: string
  webhook_url: string
  webhook_secret: string
}

export async function triggerLinkedInJob(payload: JobPayload) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'linkedin-job',
        client_payload: payload,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub dispatch failed: ${res.status} ${text}`)
  }
  return true
}
