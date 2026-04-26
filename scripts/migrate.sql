-- =====================================================
-- INFO2222 Full Database Migration
-- Run this entire file in the Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste → Run
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS TABLE
-- Argon2id password hashing (m=65536, t=3, p=4)
-- Separate salt column for defense in depth
-- Account lockout after 5 failed attempts (15 min)
-- X25519 public key for E2EE, Ed25519 for signing
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    public_key TEXT,
    identity_public_key TEXT,
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    email_verification_expires_at TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMPTZ,
    account_locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_public_key ON public.users(public_key);

-- =====================================================
-- 2. SESSIONS TABLE
-- 256-bit cryptographically secure session tokens
-- Refresh token rotation, IP/user-agent tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    is_valid BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);

-- =====================================================
-- 3. CERTIFICATES TABLE
-- TLS certificate storage for server authentication
-- Certificate pinning via SHA-256 fingerprint
-- =====================================================
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL CHECK (certificate_type IN ('CA', 'SERVER', 'CLIENT', 'INTERMEDIATE')),
    certificate_pem TEXT NOT NULL,
    public_key_pem TEXT,
    subject_cn VARCHAR(255),
    issuer_cn VARCHAR(255),
    serial_number VARCHAR(255),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    fingerprint_sha256 VARCHAR(95) NOT NULL,
    fingerprint_sha1 VARCHAR(59),
    is_active BOOLEAN DEFAULT true,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    parent_certificate_id UUID REFERENCES public.certificates(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_fingerprint ON public.certificates(fingerprint_sha256);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON public.certificates(certificate_type);

-- =====================================================
-- 4. KEY PAIRS TABLE
-- AES-256-GCM encrypted private keys
-- Key derived from password via Argon2id
-- =====================================================
CREATE TABLE IF NOT EXISTS public.key_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key_type VARCHAR(50) NOT NULL CHECK (key_type IN ('X25519', 'Ed25519', 'RSA', 'ECDSA')),
    key_purpose VARCHAR(50) NOT NULL CHECK (key_purpose IN ('ENCRYPTION', 'SIGNING', 'KEY_EXCHANGE', 'IDENTITY')),
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    key_derivation_salt TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    encryption_auth_tag TEXT,
    key_id VARCHAR(64) UNIQUE NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_pairs_user ON public.key_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_key_pairs_key_id ON public.key_pairs(key_id);
CREATE INDEX IF NOT EXISTS idx_key_pairs_type ON public.key_pairs(key_type);

-- =====================================================
-- 5. PRE-KEYS TABLE
-- Signal Protocol one-time pre-keys
-- Consumed on first message (X3DH key exchange)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pre_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    key_derivation_salt TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    used_by_user_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_pre_keys_user ON public.pre_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_keys_unused ON public.pre_keys(user_id, is_used) WHERE is_used = false;

-- =====================================================
-- 6. CONVERSATIONS TABLE
-- Supports DIRECT and GROUP conversation types
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_type VARCHAR(50) DEFAULT 'DIRECT' CHECK (conversation_type IN ('DIRECT', 'GROUP')),
    name VARCHAR(255),
    description TEXT,
    admin_user_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. CONVERSATION PARTICIPANTS TABLE
-- Per-participant encrypted session keys (Double Ratchet)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_session_key TEXT,
    session_key_iv TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON public.conversation_participants(conversation_id);

-- =====================================================
-- 8. MESSAGES TABLE
-- AES-256-GCM encrypted content (client-side)
-- Ed25519 digital signatures on all messages
-- Double Ratchet chain index for forward secrecy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_content TEXT NOT NULL,
    content_iv TEXT NOT NULL,
    content_auth_tag TEXT,
    signature TEXT NOT NULL,
    sender_key_id VARCHAR(64) NOT NULL,
    ratchet_public_key TEXT,
    chain_index INTEGER DEFAULT 0,
    previous_chain_length INTEGER DEFAULT 0,
    message_type VARCHAR(50) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'FILE', 'IMAGE', 'KEY_EXCHANGE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- =====================================================
-- 9. MESSAGE READ RECEIPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON public.message_read_receipts(message_id);

-- =====================================================
-- 10. AUDIT LOGS TABLE
-- Categories: AUTH, MESSAGE, KEY, CERTIFICATE, ADMIN, SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('AUTH', 'MESSAGE', 'KEY', 'CERTIFICATE', 'ADMIN', 'SYSTEM')),
    event_description TEXT,
    ip_address INET,
    user_agent TEXT,
    event_data JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- =====================================================
-- 11. PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    short_description TEXT,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);

-- =====================================================
-- 12. PROJECT TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    assigned_user VARCHAR(255),
    completed BOOLEAN DEFAULT false,
    due_date VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id);

-- =====================================================
-- 13. TASK COMMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);


-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.certificates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.certificates
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.key_pairs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.key_pairs
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.project_tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Mark expired sessions as invalid
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    UPDATE public.sessions
    SET is_valid = false, revoked_at = NOW(), revoked_reason = 'EXPIRED'
    WHERE expires_at < NOW() AND is_valid = true;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    INSERT INTO public.audit_logs (event_type, event_category, event_description, event_data)
    VALUES ('SESSION_CLEANUP', 'SYSTEM', 'Expired sessions cleaned up', jsonb_build_object('count', deleted_count));
    RETURN deleted_count;
END;
$$;

-- Increment failed login counter; lock account after 5 attempts for 15 min
CREATE OR REPLACE FUNCTION public.increment_failed_login(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_failed_attempts INTEGER;
    v_max_attempts INTEGER := 5;
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
BEGIN
    SELECT failed_login_attempts INTO v_failed_attempts FROM public.users WHERE id = p_user_id;
    UPDATE public.users
    SET failed_login_attempts = failed_login_attempts + 1,
        last_failed_login_at = NOW(),
        account_locked_until = CASE
            WHEN failed_login_attempts + 1 >= v_max_attempts THEN NOW() + v_lockout_duration
            ELSE account_locked_until
        END
    WHERE id = p_user_id;
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, success)
    VALUES (p_user_id, 'LOGIN_FAILED', 'AUTH', 'Failed login attempt', false);
END;
$$;

-- Reset failed login counter on successful login
CREATE OR REPLACE FUNCTION public.reset_failed_login(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.users
    SET failed_login_attempts = 0, last_failed_login_at = NULL,
        account_locked_until = NULL, last_login_at = NOW()
    WHERE id = p_user_id;
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, success)
    VALUES (p_user_id, 'LOGIN_SUCCESS', 'AUTH', 'Successful login', true);
END;
$$;

-- Check if account is currently locked (auto-clears expired locks)
CREATE OR REPLACE FUNCTION public.is_account_locked(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_locked_until TIMESTAMPTZ;
BEGIN
    SELECT account_locked_until INTO v_locked_until FROM public.users WHERE id = p_user_id;
    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN RETURN true; END IF;
    IF v_locked_until IS NOT NULL AND v_locked_until <= NOW() THEN
        UPDATE public.users SET account_locked_until = NULL, failed_login_attempts = 0 WHERE id = p_user_id;
    END IF;
    RETURN false;
END;
$$;

-- Create a new authenticated session
CREATE OR REPLACE FUNCTION public.create_session(
    p_user_id UUID, p_session_token TEXT, p_refresh_token TEXT,
    p_ip_address INET, p_user_agent TEXT,
    p_expires_in INTERVAL DEFAULT INTERVAL '24 hours',
    p_refresh_expires_in INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_session_id UUID;
BEGIN
    INSERT INTO public.sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at, refresh_expires_at)
    VALUES (p_user_id, p_session_token, p_refresh_token, p_ip_address, p_user_agent, NOW() + p_expires_in, NOW() + p_refresh_expires_in)
    RETURNING id INTO v_session_id;
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, ip_address, user_agent, event_data)
    VALUES (p_user_id, 'SESSION_CREATED', 'AUTH', 'New session created', p_ip_address, p_user_agent, jsonb_build_object('session_id', v_session_id));
    RETURN v_session_id;
END;
$$;

-- Validate a session token and update last_activity_at
CREATE OR REPLACE FUNCTION public.validate_session(p_session_token TEXT)
RETURNS TABLE (user_id UUID, session_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT s.user_id, s.id AS session_id, (s.is_valid AND s.expires_at > NOW()) AS is_valid
    FROM public.sessions s WHERE s.session_token = p_session_token;
    UPDATE public.sessions SET last_activity_at = NOW()
    WHERE session_token = p_session_token AND is_valid = true AND expires_at > NOW();
END;
$$;

-- Revoke a single session
CREATE OR REPLACE FUNCTION public.revoke_session(p_session_token TEXT, p_reason TEXT DEFAULT 'USER_LOGOUT')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID; v_session_id UUID;
BEGIN
    UPDATE public.sessions
    SET is_valid = false, revoked_at = NOW(), revoked_reason = p_reason
    WHERE session_token = p_session_token AND is_valid = true
    RETURNING user_id, id INTO v_user_id, v_session_id;
    IF v_session_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, event_data)
        VALUES (v_user_id, 'SESSION_REVOKED', 'AUTH', 'Session revoked', jsonb_build_object('session_id', v_session_id, 'reason', p_reason));
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

-- Revoke all sessions for a user (optionally except one)
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(
    p_user_id UUID, p_except_session_token TEXT DEFAULT NULL, p_reason TEXT DEFAULT 'USER_LOGOUT_ALL'
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE public.sessions
    SET is_valid = false, revoked_at = NOW(), revoked_reason = p_reason
    WHERE user_id = p_user_id AND is_valid = true
      AND (p_except_session_token IS NULL OR session_token != p_except_session_token);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, event_data)
        VALUES (p_user_id, 'SESSIONS_REVOKED_ALL', 'AUTH', 'All sessions revoked', jsonb_build_object('count', v_count, 'reason', p_reason));
    END IF;
    RETURN v_count;
END;
$$;

-- Generic audit log helper
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_user_id UUID, p_event_type TEXT, p_event_category TEXT, p_event_description TEXT,
    p_ip_address INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL, p_success BOOLEAN DEFAULT true, p_error_message TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_description, ip_address, user_agent, event_data, success, error_message)
    VALUES (p_user_id, p_event_type, p_event_category, p_event_description, p_ip_address, p_user_agent, p_event_data, p_success, p_error_message)
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$;

-- Update conversation.updated_at when a message is inserted
CREATE OR REPLACE FUNCTION public.trigger_update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_on_message ON public.messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.trigger_update_conversation_on_message();

-- Recalculate project.progress_percentage from completed tasks
CREATE OR REPLACE FUNCTION public.trigger_update_project_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total INTEGER; v_completed INTEGER; v_progress INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE completed = true)
    INTO v_total, v_completed
    FROM public.project_tasks WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);
    v_progress := CASE WHEN v_total > 0 THEN (v_completed * 100) / v_total ELSE 0 END;
    UPDATE public.projects SET progress_percentage = v_progress WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_project_progress ON public.project_tasks;
CREATE TRIGGER update_project_progress
    AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION public.trigger_update_project_progress();

-- Count unused pre-keys for a user
CREATE OR REPLACE FUNCTION public.get_unused_prekey_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.pre_keys WHERE user_id = p_user_id AND is_used = false;
    RETURN v_count;
END;
$$;


-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see other users (needed for messaging / finding users)
CREATE POLICY "users_select_all_authenticated" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- SESSIONS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_update_own" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON public.sessions
    FOR DELETE USING (auth.uid() = user_id);

-- CERTIFICATES (read-only for all authenticated users; writes via service role only)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificates_select_active" ON public.certificates
    FOR SELECT USING (is_active = true AND is_revoked = false);

-- KEY PAIRS
ALTER TABLE public.key_pairs ENABLE ROW LEVEL SECURITY;

-- Public keys are readable by all authenticated users (needed for E2EE encryption)
CREATE POLICY "key_pairs_select_all" ON public.key_pairs
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "key_pairs_insert_own" ON public.key_pairs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "key_pairs_update_own" ON public.key_pairs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "key_pairs_delete_own" ON public.key_pairs
    FOR DELETE USING (auth.uid() = user_id);

-- PRE-KEYS
ALTER TABLE public.pre_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pre_keys_select_own" ON public.pre_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pre_keys_insert_own" ON public.pre_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pre_keys_delete_own" ON public.pre_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Allow any authenticated user to consume (mark as used) an unused pre-key
CREATE POLICY "pre_keys_consume" ON public.pre_keys
    FOR UPDATE USING (is_used = false);

-- CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_participant" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = id AND user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "conversations_insert" ON public.conversations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "conversations_update_admin" ON public.conversations
    FOR UPDATE USING (admin_user_id = auth.uid());

-- CONVERSATION PARTICIPANTS
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_participants_select" ON public.conversation_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid() AND cp.is_active = true
        )
    );

CREATE POLICY "conv_participants_insert" ON public.conversation_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND (c.admin_user_id = auth.uid() OR c.conversation_type = 'DIRECT')
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "conv_participants_update_own" ON public.conversation_participants
    FOR UPDATE USING (user_id = auth.uid());

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_participant" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid() AND cp.is_active = true
        )
    );

CREATE POLICY "messages_insert_participant" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid() AND cp.is_active = true
        )
    );

CREATE POLICY "messages_update_own" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid());

-- MESSAGE READ RECEIPTS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_receipts_select" ON public.message_read_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
            WHERE m.id = message_id AND cp.user_id = auth.uid() AND cp.is_active = true
        )
    );

CREATE POLICY "read_receipts_insert_own" ON public.message_read_receipts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- AUDIT LOGS (users can only see their own; inserts via service role)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
    FOR SELECT USING (user_id = auth.uid());

-- PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- PROJECT TASKS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_tasks_select_own" ON public.project_tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "project_tasks_insert_own" ON public.project_tasks
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "project_tasks_update_own" ON public.project_tasks
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "project_tasks_delete_own" ON public.project_tasks
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

-- TASK COMMENTS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select" ON public.task_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.projects p ON p.id = pt.project_id
            WHERE pt.id = task_id AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "task_comments_insert" ON public.task_comments
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.projects p ON p.id = pt.project_id
            WHERE pt.id = task_id AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "task_comments_update_own" ON public.task_comments
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "task_comments_delete_own" ON public.task_comments
    FOR DELETE USING (user_id = auth.uid());


-- =====================================================
-- SEED: Root CA Certificate
-- =====================================================
INSERT INTO public.certificates (
    name, certificate_type, certificate_pem, public_key_pem,
    subject_cn, issuer_cn, serial_number,
    valid_from, valid_until,
    fingerprint_sha256, fingerprint_sha1, is_active
) VALUES (
    'INFO2222 Root CA',
    'CA',
    '-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfHDw0lpaMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBklO
Rk8yMjIyMB4XDTI0MDEwMTAwMDAwMFoXDTI1MTIzMTIzNTk1OVowETEPMA0GA1UE
AwwGSU5GTzIyMjIwXDANBgkqhkiG9w0BAQEFAANLADBIAkEA0Z3VS0fBl8K3Bb0w
nF5xF5TQGM9b5eP+YhKQ3rJb0L5vN0zB5n9aQ8Z1x5r0F5n3bM5L0bR5d5z0Y5mL
5pF5tQIDAQABMA0GCSqGSIb3DQEBCwUAA0EA0F5P5mB5kR5dH5y0W5jB5nP5oL5v
S5xB5dD5zR5mT5wB5kP5oL5vN5zB5dD5zR5mT5wB5kP5oL5vN5zB5dD5zQ==
-----END CERTIFICATE-----',
    '-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGd1UtHwZfCtwW9MJxecReU0BjPW+Xj
/mISkN6yW9C+bzdMweZ/WkPGdcea9BeZ92zOS9G0eXec9GOZi+aRebUCAwEAAQ==
-----END PUBLIC KEY-----',
    'INFO2222 Root CA', 'INFO2222 Root CA', '1',
    '2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00',
    'E3:B0:C4:42:98:FC:1C:14:9A:FB:F4:C8:99:6F:B9:24:27:AE:41:E4:64:9B:93:4C:A4:95:99:1B:78:52:B8:55',
    'DA:39:A3:EE:5E:6B:4B:0D:32:55:BF:EF:95:60:18:90:AF:D8:07:09',
    true
) ON CONFLICT DO NOTHING;
