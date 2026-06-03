-- ============================================================
-- LinkedFlow India — Schema Additions (run after schema.sql)
-- ============================================================

-- ── Profile Generations (AI Profile Manager) ─────────────────
CREATE TABLE IF NOT EXISTS public.profile_generations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_data      JSONB NOT NULL DEFAULT '{}',
  generated_content JSONB NOT NULL DEFAULT '{}',
  lang              TEXT DEFAULT 'en',
  status            TEXT DEFAULT 'generated' CHECK (status IN ('generated','approved','executed','failed')),
  executed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profile_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_generations" ON public.profile_generations FOR ALL USING (auth.uid() = user_id);

-- ── Job action_type extension ────────────────────────────────
-- Adds profile_update to allowed job action types
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_action_type_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_action_type_check
  CHECK (action_type IN ('connect','send_message','inmail','scrape_leads','profile_update'));

-- ── Supabase function for lead stats ─────────────────────────
CREATE OR REPLACE FUNCTION get_lead_stats(p_user_id UUID)
RETURNS TABLE (
  total         BIGINT,
  pending       BIGINT,
  connected     BIGINT,
  message_sent  BIGINT,
  replied       BIGINT,
  accepted      BIGINT,
  ignored       BIGINT,
  failed        BIGINT
) AS $$
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending')      as pending,
    COUNT(*) FILTER (WHERE status = 'connected')    as connected,
    COUNT(*) FILTER (WHERE status = 'message_sent') as message_sent,
    COUNT(*) FILTER (WHERE status = 'replied')      as replied,
    COUNT(*) FILTER (WHERE status = 'accepted')     as accepted,
    COUNT(*) FILTER (WHERE status = 'ignored')      as ignored,
    COUNT(*) FILTER (WHERE status = 'failed')       as failed
  FROM public.leads
  WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Nav item: Add profile_manager link awareness ─────────────
-- (No DB change needed — handled in frontend layout)

-- Enable realtime on new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_generations;

-- Index
CREATE INDEX IF NOT EXISTS idx_profile_generations_user ON public.profile_generations(user_id);
