-- PriorityMail Supabase Production Migration
-- Creates all application tables with UUID primary keys, references to auth.users,
-- automated profile/settings provisioning triggers, and strict Row Level Security (RLS).

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CONNECTED GOOGLE ACCOUNTS (Multi-account support)
CREATE TABLE IF NOT EXISTS public.connected_google_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_id TEXT NOT NULL,
  email             TEXT NOT NULL,
  display_name      TEXT,
  avatar_url        TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, google_account_id)
);

-- 3. GMAIL CREDENTIALS (Strictly restricted, accessible only via Service Role in Edge Functions)
CREATE TABLE IF NOT EXISTS public.gmail_credentials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id  UUID NOT NULL UNIQUE REFERENCES public.connected_google_accounts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_access_token  TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  scope                 TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EMAIL METADATA (Normalized priority classification state)
CREATE TABLE IF NOT EXISTS public.email_metadata (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_account_id  UUID NOT NULL REFERENCES public.connected_google_accounts(id) ON DELETE CASCADE,
  gmail_message_id      TEXT NOT NULL,
  gmail_thread_id       TEXT NOT NULL,
  sender_name           TEXT,
  sender_email          TEXT,
  subject               TEXT,
  snippet               TEXT,
  received_at           TIMESTAMPTZ,
  label_ids             JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_read               BOOLEAN NOT NULL DEFAULT FALSE,
  is_important          BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed          BOOLEAN NOT NULL DEFAULT FALSE,
  snoozed_until         TIMESTAMPTZ,
  priority              TEXT,
  score                 INTEGER,
  category              TEXT,
  reasons               JSONB NOT NULL DEFAULT '[]'::JSONB,
  action_required       BOOLEAN NOT NULL DEFAULT FALSE,
  deadline              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, gmail_message_id)
);

-- 5. PRIORITY RULES
CREATE TABLE IF NOT EXISTS public.priority_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- 'label' | 'sender' | 'domain' | 'keyword' | 'subject_keyword' | 'vip'
  value       TEXT NOT NULL,
  weight      INTEGER NOT NULL DEFAULT 4,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VIP SENDERS
CREATE TABLE IF NOT EXISTS public.vip_senders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Personal',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- 7. PUSH SUBSCRIPTIONS (Web Push / iPhone PWA)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. MOBILE DEVICE TOKENS (Expo / Android)
CREATE TABLE IF NOT EXISTS public.mobile_device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'android',
  device_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. GMAIL WATCH STATE (Pub/Sub watch status per account)
CREATE TABLE IF NOT EXISTS public.gmail_watch_state (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id  UUID NOT NULL UNIQUE REFERENCES public.connected_google_accounts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  history_id            TEXT NOT NULL,
  expiration            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICATION HISTORY (Deduplication against duplicate alerts)
CREATE TABLE IF NOT EXISTS public.notification_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, gmail_message_id)
);

-- 11. USER SETTINGS
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  vip_alerts            BOOLEAN NOT NULL DEFAULT TRUE,
  deadline_alerts       BOOLEAN NOT NULL DEFAULT TRUE,
  action_alerts         BOOLEAN NOT NULL DEFAULT TRUE,
  sensitivity           TEXT NOT NULL DEFAULT 'Balanced',
  quiet_hours_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_start           TEXT NOT NULL DEFAULT '22:00',
  quiet_end             TEXT NOT NULL DEFAULT '08:00',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_cga_user_id ON public.connected_google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_meta_user_id ON public.email_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_email_meta_account_id ON public.email_metadata(connected_account_id);
CREATE INDEX IF NOT EXISTS idx_email_meta_read_important ON public.email_metadata(user_id, is_read, is_important);
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON public.priority_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_vips_user_id ON public.vip_senders(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_tokens_user_id ON public.mobile_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_state_expiration ON public.gmail_watch_state(expiration);
CREATE INDEX IF NOT EXISTS idx_notif_history_user_msg ON public.notification_history(user_id, gmail_message_id);

-- AUTOMATIC PROFILE & SETTINGS CREATION ON NEW AUTH USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_watch_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 1. profiles: users can view and update their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. connected_google_accounts: users can manage their own connected accounts
CREATE POLICY "cga_select_own" ON public.connected_google_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cga_insert_own" ON public.connected_google_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cga_update_own" ON public.connected_google_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cga_delete_own" ON public.connected_google_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- 3. gmail_credentials: NO ACCESS FOR CLIENT ROLES (authenticated or anon)
-- Only Service Role (Edge Functions) can access or mutate credentials.
-- (No policies created for authenticated or anon roles, ensuring client requests are blocked by default)

-- 4. email_metadata: users can fully manage their own email metadata
CREATE POLICY "email_meta_all_own" ON public.email_metadata
  FOR ALL USING (auth.uid() = user_id);

-- 5. priority_rules: users can fully manage their own priority rules
CREATE POLICY "priority_rules_all_own" ON public.priority_rules
  FOR ALL USING (auth.uid() = user_id);

-- 6. vip_senders: users can fully manage their own VIP senders
CREATE POLICY "vip_senders_all_own" ON public.vip_senders
  FOR ALL USING (auth.uid() = user_id);

-- 7. push_subscriptions: users can manage their own push subscriptions
CREATE POLICY "push_subs_all_own" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- 8. mobile_device_tokens: users can manage their own device tokens
CREATE POLICY "mobile_tokens_all_own" ON public.mobile_device_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 9. gmail_watch_state: users can view their own watch status
CREATE POLICY "watch_state_select_own" ON public.gmail_watch_state
  FOR SELECT USING (auth.uid() = user_id);

-- 10. notification_history: users can view their own notification history
CREATE POLICY "notif_history_select_own" ON public.notification_history
  FOR SELECT USING (auth.uid() = user_id);

-- 11. user_settings: users can view and update their own settings
CREATE POLICY "user_settings_all_own" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);
