-- =====================================================
-- INFO2222 Security Functions and Triggers
-- =====================================================
-- Implements helper functions for security features
-- =====================================================

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
-- Automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.certificates;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.certificates
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.key_pairs;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.key_pairs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.project_tasks;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- SESSION CLEANUP FUNCTION
-- =====================================================
-- Automatically invalidate expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark expired sessions as invalid
    UPDATE public.sessions
    SET is_valid = false,
        revoked_at = NOW(),
        revoked_reason = 'EXPIRED'
    WHERE expires_at < NOW()
    AND is_valid = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO public.audit_logs (
        event_type,
        event_category,
        event_description,
        event_data
    ) VALUES (
        'SESSION_CLEANUP',
        'SYSTEM',
        'Expired sessions cleaned up',
        jsonb_build_object('count', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$;

-- =====================================================
-- FAILED LOGIN TRACKING
-- =====================================================
-- Function to increment failed login attempts
CREATE OR REPLACE FUNCTION public.increment_failed_login(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_failed_attempts INTEGER;
    v_max_attempts INTEGER := 5;
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
BEGIN
    -- Get current failed attempts
    SELECT failed_login_attempts INTO v_failed_attempts
    FROM public.users
    WHERE id = p_user_id;
    
    -- Increment and potentially lock account
    UPDATE public.users
    SET failed_login_attempts = failed_login_attempts + 1,
        last_failed_login_at = NOW(),
        account_locked_until = CASE
            WHEN failed_login_attempts + 1 >= v_max_attempts
            THEN NOW() + v_lockout_duration
            ELSE account_locked_until
        END
    WHERE id = p_user_id;
    
    -- Log the failed attempt
    INSERT INTO public.audit_logs (
        user_id,
        event_type,
        event_category,
        event_description,
        success
    ) VALUES (
        p_user_id,
        'LOGIN_FAILED',
        'AUTH',
        'Failed login attempt',
        false
    );
END;
$$;

-- Function to reset failed login attempts on successful login
CREATE OR REPLACE FUNCTION public.reset_failed_login(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET failed_login_attempts = 0,
        last_failed_login_at = NULL,
        account_locked_until = NULL,
        last_login_at = NOW()
    WHERE id = p_user_id;
    
    -- Log successful login
    INSERT INTO public.audit_logs (
        user_id,
        event_type,
        event_category,
        event_description,
        success
    ) VALUES (
        p_user_id,
        'LOGIN_SUCCESS',
        'AUTH',
        'Successful login',
        true
    );
END;
$$;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_locked_until TIMESTAMPTZ;
BEGIN
    SELECT account_locked_until INTO v_locked_until
    FROM public.users
    WHERE id = p_user_id;
    
    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN true;
    END IF;
    
    -- If lock has expired, reset it
    IF v_locked_until IS NOT NULL AND v_locked_until <= NOW() THEN
        UPDATE public.users
        SET account_locked_until = NULL,
            failed_login_attempts = 0
        WHERE id = p_user_id;
    END IF;
    
    RETURN false;
END;
$$;

-- =====================================================
-- SESSION MANAGEMENT FUNCTIONS
-- =====================================================
-- Create a new session
CREATE OR REPLACE FUNCTION public.create_session(
    p_user_id UUID,
    p_session_token TEXT,
    p_refresh_token TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_expires_in INTERVAL DEFAULT INTERVAL '24 hours',
    p_refresh_expires_in INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO public.sessions (
        user_id,
        session_token,
        refresh_token,
        ip_address,
        user_agent,
        expires_at,
        refresh_expires_at
    ) VALUES (
        p_user_id,
        p_session_token,
        p_refresh_token,
        p_ip_address,
        p_user_agent,
        NOW() + p_expires_in,
        NOW() + p_refresh_expires_in
    )
    RETURNING id INTO v_session_id;
    
    -- Log session creation
    INSERT INTO public.audit_logs (
        user_id,
        event_type,
        event_category,
        event_description,
        ip_address,
        user_agent,
        event_data
    ) VALUES (
        p_user_id,
        'SESSION_CREATED',
        'AUTH',
        'New session created',
        p_ip_address,
        p_user_agent,
        jsonb_build_object('session_id', v_session_id)
    );
    
    RETURN v_session_id;
END;
$$;

-- Validate a session token
CREATE OR REPLACE FUNCTION public.validate_session(p_session_token TEXT)
RETURNS TABLE (
    user_id UUID,
    session_id UUID,
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.user_id,
        s.id AS session_id,
        (s.is_valid AND s.expires_at > NOW()) AS is_valid
    FROM public.sessions s
    WHERE s.session_token = p_session_token;
    
    -- Update last activity
    UPDATE public.sessions
    SET last_activity_at = NOW()
    WHERE session_token = p_session_token
    AND is_valid = true
    AND expires_at > NOW();
END;
$$;

-- Revoke a session
CREATE OR REPLACE FUNCTION public.revoke_session(
    p_session_token TEXT,
    p_reason TEXT DEFAULT 'USER_LOGOUT'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_session_id UUID;
BEGIN
    UPDATE public.sessions
    SET is_valid = false,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE session_token = p_session_token
    AND is_valid = true
    RETURNING user_id, id INTO v_user_id, v_session_id;
    
    IF v_session_id IS NOT NULL THEN
        -- Log session revocation
        INSERT INTO public.audit_logs (
            user_id,
            event_type,
            event_category,
            event_description,
            event_data
        ) VALUES (
            v_user_id,
            'SESSION_REVOKED',
            'AUTH',
            'Session revoked',
            jsonb_build_object('session_id', v_session_id, 'reason', p_reason)
        );
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Revoke all sessions for a user
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(
    p_user_id UUID,
    p_except_session_token TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'USER_LOGOUT_ALL'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.sessions
    SET is_valid = false,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE user_id = p_user_id
    AND is_valid = true
    AND (p_except_session_token IS NULL OR session_token != p_except_session_token);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    IF v_count > 0 THEN
        INSERT INTO public.audit_logs (
            user_id,
            event_type,
            event_category,
            event_description,
            event_data
        ) VALUES (
            p_user_id,
            'SESSIONS_REVOKED_ALL',
            'AUTH',
            'All sessions revoked',
            jsonb_build_object('count', v_count, 'reason', p_reason)
        );
    END IF;
    
    RETURN v_count;
END;
$$;

-- =====================================================
-- AUDIT LOG FUNCTION
-- =====================================================
-- Helper function to create audit log entries
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_user_id UUID,
    p_event_type TEXT,
    p_event_category TEXT,
    p_event_description TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        event_type,
        event_category,
        event_description,
        ip_address,
        user_agent,
        event_data,
        success,
        error_message
    ) VALUES (
        p_user_id,
        p_event_type,
        p_event_category,
        p_event_description,
        p_ip_address,
        p_user_agent,
        p_event_data,
        p_success,
        p_error_message
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- =====================================================
-- CONVERSATION UPDATE TRIGGER
-- =====================================================
-- Update conversation timestamp when new message is sent
CREATE OR REPLACE FUNCTION public.trigger_update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_on_message ON public.messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_conversation_on_message();

-- =====================================================
-- PROJECT PROGRESS UPDATE TRIGGER
-- =====================================================
-- Update project progress when task is updated
CREATE OR REPLACE FUNCTION public.trigger_update_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_tasks INTEGER;
    v_completed_tasks INTEGER;
    v_progress INTEGER;
BEGIN
    -- Calculate progress based on completed tasks
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true)
    INTO v_total_tasks, v_completed_tasks
    FROM public.project_tasks
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);
    
    IF v_total_tasks > 0 THEN
        v_progress := (v_completed_tasks * 100) / v_total_tasks;
    ELSE
        v_progress := 0;
    END IF;
    
    UPDATE public.projects
    SET progress_percentage = v_progress
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_project_progress ON public.project_tasks;
CREATE TRIGGER update_project_progress
    AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_project_progress();

-- =====================================================
-- CLEANUP PRE-KEYS TRIGGER
-- =====================================================
-- Automatically generate new pre-keys when running low
CREATE OR REPLACE FUNCTION public.get_unused_prekey_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.pre_keys
    WHERE user_id = p_user_id
    AND is_used = false;
    
    RETURN v_count;
END;
$$;
