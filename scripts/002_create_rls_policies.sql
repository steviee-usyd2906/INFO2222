-- =====================================================
-- INFO2222 Row Level Security (RLS) Policies
-- =====================================================
-- These policies ensure data protection at the database level
-- Even if application code has bugs, RLS prevents unauthorized access
-- =====================================================

-- =====================================================
-- USERS TABLE RLS
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can view other users' public info (for messaging)
CREATE POLICY "users_select_public" ON public.users
    FOR SELECT USING (
        -- Allow viewing public fields of other users
        true
    );

-- Note: Users cannot delete their own account via RLS (admin only)
-- Note: Insert is handled by signup process with service role

-- =====================================================
-- SESSIONS TABLE RLS
-- =====================================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "sessions_select_own" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can revoke their own sessions
CREATE POLICY "sessions_update_own" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "sessions_delete_own" ON public.sessions
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- CERTIFICATES TABLE RLS
-- =====================================================
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- All users can view active certificates (for verification)
CREATE POLICY "certificates_select_active" ON public.certificates
    FOR SELECT USING (is_active = true AND is_revoked = false);

-- Only service role can insert/update/delete certificates

-- =====================================================
-- KEY PAIRS TABLE RLS
-- =====================================================
ALTER TABLE public.key_pairs ENABLE ROW LEVEL SECURITY;

-- Users can view their own key pairs
CREATE POLICY "key_pairs_select_own" ON public.key_pairs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own key pairs
CREATE POLICY "key_pairs_insert_own" ON public.key_pairs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own key pairs
CREATE POLICY "key_pairs_update_own" ON public.key_pairs
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own key pairs
CREATE POLICY "key_pairs_delete_own" ON public.key_pairs
    FOR DELETE USING (auth.uid() = user_id);

-- Users can view other users' public keys (for encryption)
CREATE POLICY "key_pairs_select_public" ON public.key_pairs
    FOR SELECT USING (true); -- Public keys are public

-- =====================================================
-- PRE-KEYS TABLE RLS
-- =====================================================
ALTER TABLE public.pre_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own pre-keys
CREATE POLICY "pre_keys_select_own" ON public.pre_keys
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pre-keys
CREATE POLICY "pre_keys_insert_own" ON public.pre_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pre-keys
CREATE POLICY "pre_keys_delete_own" ON public.pre_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Other users can consume (mark as used) pre-keys for key exchange
CREATE POLICY "pre_keys_consume" ON public.pre_keys
    FOR UPDATE USING (is_used = false);

-- =====================================================
-- CONVERSATIONS TABLE RLS
-- =====================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Users can view conversations they are part of
CREATE POLICY "conversations_select_participant" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = id
            AND user_id = auth.uid()
            AND is_active = true
        )
    );

-- Users can create conversations
CREATE POLICY "conversations_insert" ON public.conversations
    FOR INSERT WITH CHECK (true);

-- Admins can update their group conversations
CREATE POLICY "conversations_update_admin" ON public.conversations
    FOR UPDATE USING (admin_user_id = auth.uid());

-- =====================================================
-- CONVERSATION PARTICIPANTS TABLE RLS
-- =====================================================
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Users can view participants of conversations they are in
CREATE POLICY "conv_participants_select" ON public.conversation_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
            AND cp.is_active = true
        )
    );

-- Users can add participants to conversations they admin
CREATE POLICY "conv_participants_insert" ON public.conversation_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.admin_user_id = auth.uid() OR c.conversation_type = 'DIRECT')
        )
        OR user_id = auth.uid() -- Users can add themselves
    );

-- Users can leave conversations (update their own participant record)
CREATE POLICY "conv_participants_update_own" ON public.conversation_participants
    FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- MESSAGES TABLE RLS
-- =====================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in conversations they are part of
CREATE POLICY "messages_select_participant" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
            AND cp.is_active = true
        )
    );

-- Users can send messages to conversations they are part of
CREATE POLICY "messages_insert_participant" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
            AND cp.is_active = true
        )
    );

-- Users can soft-delete their own messages
CREATE POLICY "messages_delete_own" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid());

-- =====================================================
-- MESSAGE READ RECEIPTS TABLE RLS
-- =====================================================
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages they can see
CREATE POLICY "read_receipts_select" ON public.message_read_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
            WHERE m.id = message_id
            AND cp.user_id = auth.uid()
            AND cp.is_active = true
        )
    );

-- Users can create their own read receipts
CREATE POLICY "read_receipts_insert_own" ON public.message_read_receipts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- AUDIT LOGS TABLE RLS
-- =====================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "audit_logs_select_own" ON public.audit_logs
    FOR SELECT USING (user_id = auth.uid());

-- Insert is handled by service role only (application logs events)

-- =====================================================
-- PROJECTS TABLE RLS
-- =====================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can view their own projects
CREATE POLICY "projects_select_own" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "projects_insert_own" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "projects_update_own" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "projects_delete_own" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- PROJECT TASKS TABLE RLS
-- =====================================================
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view tasks of their own projects
CREATE POLICY "project_tasks_select_own" ON public.project_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can insert tasks to their own projects
CREATE POLICY "project_tasks_insert_own" ON public.project_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can update tasks of their own projects
CREATE POLICY "project_tasks_update_own" ON public.project_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can delete tasks of their own projects
CREATE POLICY "project_tasks_delete_own" ON public.project_tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- =====================================================
-- TASK COMMENTS TABLE RLS
-- =====================================================
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on tasks they can see
CREATE POLICY "task_comments_select" ON public.task_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.projects p ON p.id = pt.project_id
            WHERE pt.id = task_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can insert comments on tasks they can see
CREATE POLICY "task_comments_insert" ON public.task_comments
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.projects p ON p.id = pt.project_id
            WHERE pt.id = task_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can update their own comments
CREATE POLICY "task_comments_update_own" ON public.task_comments
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "task_comments_delete_own" ON public.task_comments
    FOR DELETE USING (user_id = auth.uid());
