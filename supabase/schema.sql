-- ============================================================
-- LinkedFlow India — Supabase Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Profiles (extends Supabase auth.users) ──────────────────
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','agency')),
  plan_expires_at TIMESTAMPTZ,
  language        TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── LinkedIn Accounts ────────────────────────────────────────
CREATE TABLE public.linkedin_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  profile_url     TEXT,
  li_at_cookie    TEXT NOT NULL,  -- encrypted
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','limited')),
  daily_limit     INT DEFAULT 25,
  weekly_sent     INT DEFAULT 0,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaigns ────────────────────────────────────────────────
CREATE TABLE public.campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('linkedin_search','post_engagers','event_attendees','group_members','custom_list','sales_navigator')),
  mode            TEXT NOT NULL DEFAULT 'outbound' CHECK (mode IN ('outbound','inbound')),
  outreach_type   TEXT NOT NULL DEFAULT 'connect' CHECK (outreach_type IN ('connect','inmail','message')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','failed')),
  max_targets     INT NOT NULL DEFAULT 250,
  targets_count   INT DEFAULT 0,
  success_count   INT DEFAULT 0,
  failed_count    INT DEFAULT 0,
  -- Sequence JSON: [{type:'connection_request',message:'...',delay_days:0}, ...]
  sequence        JSONB DEFAULT '[]',
  -- Filters for targeting
  filters         JSONB DEFAULT '{}',
  -- Schedule
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  -- Meta
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Leads ────────────────────────────────────────────────────
CREATE TABLE public.leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linkedin_url    TEXT NOT NULL,
  name            TEXT,
  title           TEXT,
  company         TEXT,
  location        TEXT,
  profile_pic_url TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','message_sent','replied','accepted','ignored','failed')),
  connection_sent_at TIMESTAMPTZ,
  message_sent_at    TIMESTAMPTZ,
  replied_at         TIMESTAMPTZ,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages / Templates ─────────────────────────────────────
CREATE TABLE public.templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('connection_request','follow_up','inmail')),
  content         TEXT NOT NULL,
  language        TEXT DEFAULT 'en',
  variables       TEXT[] DEFAULT '{}',  -- e.g. ['{{first_name}}','{{company}}']
  is_shared       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaign Messages (sent) ─────────────────────────────────
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('connection_request','follow_up','inmail','reply')),
  content         TEXT NOT NULL,
  direction       TEXT NOT NULL DEFAULT 'sent' CHECK (direction IN ('sent','received')),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

-- ── Billing / Subscriptions ──────────────────────────────────
CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_sub_id   TEXT UNIQUE,
  razorpay_plan_id  TEXT,
  plan              TEXT NOT NULL CHECK (plan IN ('starter','pro','agency')),
  status            TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','authenticated','active','paused','halted','cancelled','completed','expired')),
  current_start     TIMESTAMPTZ,
  current_end       TIMESTAMPTZ,
  amount            INT NOT NULL,  -- in paise
  currency          TEXT DEFAULT 'INR',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES public.subscriptions(id),
  razorpay_payment_id TEXT UNIQUE,
  razorpay_order_id   TEXT,
  amount            INT NOT NULL,
  currency          TEXT DEFAULT 'INR',
  status            TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','captured','failed','refunded')),
  method            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT,
  read        BOOLEAN DEFAULT FALSE,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Analytics (daily rollup) ─────────────────────────────────
CREATE TABLE public.analytics_daily (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  connections_sent   INT DEFAULT 0,
  connections_accepted INT DEFAULT 0,
  messages_sent    INT DEFAULT 0,
  replies_received INT DEFAULT 0,
  UNIQUE(user_id, campaign_id, date)
);

-- ── GitHub Actions Job Queue ─────────────────────────────────
CREATE TABLE public.jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL CHECK (action_type IN ('connect','send_message','inmail','scrape_leads')),
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts        INT DEFAULT 0,
  result          TEXT,
  error           TEXT,
  scheduled_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Campaign stats update
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.campaigns SET
    targets_count = (SELECT COUNT(*) FROM public.leads WHERE campaign_id = p_campaign_id),
    success_count = (SELECT COUNT(*) FROM public.leads WHERE campaign_id = p_campaign_id AND status IN ('connected','message_sent','replied','accepted')),
    failed_count  = (SELECT COUNT(*) FROM public.leads WHERE campaign_id = p_campaign_id AND status = 'failed')
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_accounts" ON public.linkedin_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_leads" ON public.leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_templates" ON public.templates FOR ALL USING (auth.uid() = user_id OR is_shared = TRUE);
CREATE POLICY "own_messages" ON public.messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_payments" ON public.payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_analytics" ON public.analytics_daily FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_jobs" ON public.jobs FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_scheduled_at ON public.jobs(scheduled_at);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_analytics_daily_date ON public.analytics_daily(user_id, date);

-- ============================================================
-- SEED DATA (Plans reference)
-- ============================================================
-- Razorpay Plan IDs stored in env, not DB
-- plan_free: 0 accounts, 0 campaigns
-- plan_starter: 1 account, 5 campaigns, 500 targets/mo
-- plan_pro: 3 accounts, unlimited campaigns, 2000 targets/mo
-- plan_agency: 10 accounts, unlimited, 10000 targets/mo
