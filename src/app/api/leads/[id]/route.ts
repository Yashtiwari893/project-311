import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase.server'
import { z } from 'zod'

const UpdateLeadSchema = z.object({
  status: z.enum(['pending','connected','message_sent','replied','accepted','ignored','failed']).optional(),
  notes:  z.string().max(1000).optional(),
  tags:   z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = UpdateLeadSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('leads')
      .update(parsed.data)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
