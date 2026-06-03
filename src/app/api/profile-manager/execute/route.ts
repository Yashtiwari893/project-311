import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { triggerLinkedInJob } from '@/lib/github'
import { sendCampaignDoneEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { generated, profile } = await req.json()

    // Get LinkedIn account cookie
    const { data: account } = await supabase
      .from('linkedin_accounts')
      .select('li_at_cookie, id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!account) {
      return NextResponse.json({
        error: 'No active LinkedIn account. Please add your LinkedIn account in Accounts section first.'
      }, { status: 400 })
    }

    // Create job record
    const { data: job } = await supabase.from('jobs').insert({
      user_id:     user.id,
      campaign_id: '00000000-0000-0000-0000-000000000000', // placeholder for profile update
      action_type: 'profile_update',
      payload: {
        headline: generated.headline,
        about:    generated.about,
        skills:   generated.skills,
        posts:    [generated.post1, generated.post2, generated.post3, generated.post4, generated.post5].filter(Boolean),
        profile_url: profile.linkedin_url,
      },
      status: 'queued',
    }).select().single()

    // Trigger GitHub Actions
    await triggerLinkedInJob({
      job_id:         job?.id || crypto.randomUUID(),
      action_type:    'profile_update' as 'connect', // extended type
      li_at_cookie:   account.li_at_cookie,
      campaign_id:    'profile-manager',
      webhook_url:    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`,
      webhook_secret: process.env.WEBHOOK_SECRET!,
      message:        JSON.stringify({
        headline: generated.headline,
        about:    generated.about,
        skills:   generated.skills?.split(',').map((s: string) => s.trim()),
        posts:    [generated.post1, generated.post2, generated.post3, generated.post4, generated.post5].filter(Boolean),
      }),
    })

    // Notify user
    const { data: profile_data } = await supabase.from('profiles').select('email,name').eq('id', user.id).single()
    if (profile_data) {
      await sendCampaignDoneEmail(
        profile_data.email,
        profile_data.name || 'User',
        'LinkedIn Profile Update',
        { sent: 1, accepted: 1, rate: '100%' }
      )
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type:    'profile_update',
      title:   'LinkedIn Profile Update Started',
      message: 'Your profile is being updated by AI. You\'ll be notified when done.',
      data:    { job_id: job?.id },
    })

    return NextResponse.json({ success: true, job_id: job?.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
