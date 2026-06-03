export type Plan = 'free' | 'starter' | 'pro' | 'agency'
export type Language = 'en' | 'hi'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed'
export type CampaignType = 'linkedin_search' | 'post_engagers' | 'event_attendees' | 'group_members' | 'custom_list' | 'sales_navigator'
export type CampaignMode = 'outbound' | 'inbound'
export type OutreachType = 'connect' | 'inmail' | 'message'
export type LeadStatus = 'pending' | 'connected' | 'message_sent' | 'replied' | 'accepted' | 'ignored' | 'failed'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed'
export type SubStatus = 'created' | 'authenticated' | 'active' | 'paused' | 'halted' | 'cancelled' | 'completed' | 'expired'

export interface Profile {
  id: string
  email: string
  name: string | null
  phone: string | null
  avatar_url: string | null
  role: 'admin' | 'user'
  plan: Plan
  plan_expires_at: string | null
  language: Language
  created_at: string
}

export interface LinkedInAccount {
  id: string
  user_id: string
  name: string
  email: string | null
  profile_url: string | null
  li_at_cookie: string
  status: 'active' | 'disconnected' | 'limited'
  daily_limit: number
  weekly_sent: number
  last_active_at: string | null
  created_at: string
}

export interface Campaign {
  id: string
  user_id: string
  account_id: string | null
  name: string
  type: CampaignType
  mode: CampaignMode
  outreach_type: OutreachType
  status: CampaignStatus
  max_targets: number
  targets_count: number
  success_count: number
  failed_count: number
  sequence: SequenceStep[]
  filters: Record<string, unknown>
  scheduled_start: string | null
  scheduled_end: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  linkedin_accounts?: LinkedInAccount
}

export interface SequenceStep {
  type: 'connection_request' | 'follow_up' | 'inmail'
  message: string
  delay_days: number
}

export interface Lead {
  id: string
  campaign_id: string
  user_id: string
  linkedin_url: string
  name: string | null
  title: string | null
  company: string | null
  location: string | null
  profile_pic_url: string | null
  status: LeadStatus
  connection_sent_at: string | null
  message_sent_at: string | null
  replied_at: string | null
  notes: string | null
  tags: string[]
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  type: 'connection_request' | 'follow_up' | 'inmail'
  content: string
  language: string
  variables: string[]
  is_shared: boolean
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  razorpay_sub_id: string | null
  plan: Plan
  status: SubStatus
  current_start: string | null
  current_end: string | null
  amount: number
  currency: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  read: boolean
  data: Record<string, unknown>
  created_at: string
}

export interface AnalyticsDaily {
  date: string
  connections_sent: number
  connections_accepted: number
  messages_sent: number
  replies_received: number
}

// Plan limits
export const PLAN_LIMITS: Record<Plan, { accounts: number; campaigns: number; targets_per_month: number; price_paise: number }> = {
  free:    { accounts: 0, campaigns: 0,  targets_per_month: 0,     price_paise: 0 },
  starter: { accounts: 1, campaigns: 5,  targets_per_month: 500,   price_paise: 299900 },
  pro:     { accounts: 3, campaigns: -1, targets_per_month: 2000,  price_paise: 699900 },
  agency:  { accounts: 10,campaigns: -1, targets_per_month: 10000, price_paise: 1499900 },
}
