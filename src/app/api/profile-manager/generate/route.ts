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

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { profile, lang } = await req.json()

    const tone = TONE_MAP[profile.tone] || TONE_MAP['1']
    const goal = GOAL_MAP[profile.goal] || GOAL_MAP['1']
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

Name: ${profile.name}
Current Role: ${profile.current_role}
Experience: ${profile.experience}
Skills mentioned: ${profile.skills}
Achievements: ${profile.achievements}
Goal on LinkedIn: ${goal}
Preferred tone: ${tone}
Post topics interest: ${profile.post_topics}

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

    const completion = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4096,
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    
    // Clean JSON (remove markdown if any)
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    let content: Record<string, string>
    try {
      content = JSON.parse(cleaned)
    } catch {
      // Attempt to extract JSON from response
      const match = cleaned.match(/\{[\s\S]*\}/)
      content = match ? JSON.parse(match[0]) : { headline: 'Error generating content', about: raw }
    }

    // Save generated content to Supabase
    await supabase.from('profile_generations').insert({
      user_id:  user.id,
      profile_data: profile,
      generated_content: content,
      lang,
    }).then(() => {}) // ignore if table doesn't exist yet

    return NextResponse.json({ content })
  } catch (e: unknown) {
    console.error('Generation error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
