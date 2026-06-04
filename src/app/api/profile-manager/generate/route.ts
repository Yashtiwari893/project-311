import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const TONE_MAP: Record<string, string> = {
  '1': 'Professional and formal, like a corporate executive',
  '2': 'Friendly, warm, and approachable, like a startup founder',
  '3': 'Bold, confident, and authoritative, like a thought leader',
  '4': 'Technical and precise, like a senior engineer',
  '5': 'Creative and storytelling-driven, like a marketer or designer',
}

const GOAL_MAP: Record<string, string> = {
  '1': 'Get noticed by recruiters and land a new job',
  '2': 'Attract clients and freelance work',
  '3': 'Build personal brand and establish thought leadership',
  '4': 'Expand professional network for business growth',
}

function sanitize(str: string): string {
  return str.replace(/[<>{}]/g, '').substring(0, 500)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { profile, lang } = await req.json()

    const { data: lastGen } = await supabase
      .from('profile_generations')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastGen?.created_at) {
      const minutesSince = (Date.now() - new Date(lastGen.created_at).getTime()) / 60000
      if (minutesSince < 5) {
        return NextResponse.json(
          { error: 'Please wait 5 minutes between profile generations' },
          { status: 429 }
        )
      }
    }

    const safeProfile = {
      name: sanitize(profile.name || ''),
      current_role: sanitize(profile.current_role || ''),
      experience: sanitize(profile.experience || ''),
      skills: sanitize(profile.skills || ''),
      achievements: sanitize(profile.achievements || ''),
      goal: sanitize(profile.goal || ''),
      tone: sanitize(profile.tone || ''),
      post_topics: sanitize(profile.post_topics || ''),
      linkedin_url: sanitize(profile.linkedin_url || ''),
    }

    const tone = TONE_MAP[safeProfile.tone] || TONE_MAP['1']
    const goal = GOAL_MAP[safeProfile.goal] || GOAL_MAP['1']
    const isHindi = lang === 'hi'

    const systemPrompt = `You are an expert LinkedIn profile writer specializing in Indian professionals.
You write compelling, authentic LinkedIn content that gets results.
Tone: ${tone}
Goal: ${goal}
Language: ${isHindi ? 'Write primarily in English but you may include occasional Hindi phrases naturally. The content will be used on LinkedIn which is an English platform.' : 'English only'}

CRITICAL: Return ONLY valid JSON with these exact keys. No markdown, no explanation, just JSON:
{
  "headline": "...",
  "about": "...",
  "skills": "skill1, skill2, skill3, ...",
  "post1": "...",
  "post2": "...",
  "post3": "...",
  "post4": "...",
  "post5": "..."
}`

    const userPrompt = `Create a complete LinkedIn profile makeover for this professional:

Name: ${safeProfile.name}
Current Role: ${safeProfile.current_role}
Experience: ${safeProfile.experience}
Skills mentioned: ${safeProfile.skills}
Achievements: ${safeProfile.achievements}
Goal on LinkedIn: ${goal}
Preferred tone: ${tone}
Post topics interest: ${safeProfile.post_topics}

Generate:
1. HEADLINE (max 220 chars): Punchy, keyword-rich, captures value proposition
2. ABOUT section (400-500 words): Tell their story, achievements, what they bring, end with CTA
3. SKILLS: Top 10 most relevant skills (comma separated)
4. 5 LinkedIn POSTS: Each 150-250 words, mix of formats:
   - Post 1: Personal story/lesson learned
   - Post 2: Industry insight or trend
   - Post 3: Achievement or milestone (humble brag done right)
   - Post 4: Tips or how-to (value-giving post)
   - Post 5: Engaging question or poll idea written as a post

Make it sound authentic and human — NOT generic AI content. Include specific details from their background.
For Indian context: mention relevant Indian companies, IIT/NIT/MBA mentions if applicable, Indian market insights in posts.`

    // Use streaming to get real-time feedback
    const stream = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4096,
      stream: true,
    })

    // Stream response back to client with real-time token feedback
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let raw = ''
          let isStreaming = true
          
          // Send initial start message
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'start', section: 'about' }) + '\n'))
          
          // Stream tokens from Groq in real-time
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || ''
            raw += token
            
            if (token) {
              // Send each token for visual streaming effect
              controller.enqueue(encoder.encode(JSON.stringify({ 
                type: 'token',
                content: token 
              }) + '\n'))
            }
          }
          
          // Parse complete response to extract all fields
          const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
          let content: Record<string, string>
          try {
            content = JSON.parse(cleaned)
          } catch {
            const match = cleaned.match(/\{[\s\S]*\}/)
            content = match ? JSON.parse(match[0]) : { headline: 'Error generating content', about: raw }
          }
          
          // Save generated content to Supabase
          await supabase.from('profile_generations').insert({
            user_id:  user.id,
            profile_data: safeProfile,
            generated_content: content,
            lang,
          }).then(() => {}) // ignore if table doesn't exist yet
          
          // Send complete message with all content
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'complete',
            content 
          }) + '\n'))
          
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      }
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: unknown) {
    console.error('Generation error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
