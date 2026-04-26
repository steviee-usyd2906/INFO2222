-- =====================================================
-- INFO2222 Security Database Schema
-- =====================================================
-- This schema implements the following security features:
-- 1. Secure Password Storage (Argon2id hashing with salting)
-- 2. Server Authentication (Certificate storage)
-- 3. Secure Message Transmission (E2EE support)
-- 4. Session Management for secure authentication
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS TABLE - Secure Password Storage
-- =====================================================
-- Password hashing: Uses Argon2id (implemented at application level)
-- - Argon2id is the recommended algorithm by OWASP
-- - It is memory-hard and resistant to GPU/ASIC attacks
-- - Salt is generated using cryptographically secure random bytes
-- - Hash format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- Password hash stored in Argon2id format (includes salt)
    -- The hash contains: algorithm, version, memory cost, time cost, parallelism, salt, and hash
    password_hash TEXT NOT NULL,
    -- Additional salt stored separately for defense in depth
    -- This is a 32-byte random value encoded as base64
    password_salt TEXT NOT NULL,
    -- Public key for E2EE (X25519 for key exchange)
    public_key TEXT,
    -- Identity key for message signing (Ed25519)
    identity_public_key TEXT,
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    email_verification_expires_at TIMESTAMPTZ,
    -- Password reset
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    -- Failed login tracking (for rate limiting/account lockout)
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMPTZ,
    account_locked_until TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_public_key ON public.users(public_key);

-- =====================================================
-- 2. SESSIONS TABLE - Server Authentication
-- =====================================================
-- Secure session management with:
-- - Cryptographically secure session tokens
-- - IP address and user agent tracking
-- - Automatic expiration
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Session token: 256-bit cryptographically secure random value
    session_token TEXT UNIQUE NOT NULL,
    -- Refresh token for token rotation
    refresh_token TEXT UNIQUE,
    -- Security context
    ip_address INET,
    user_agent TEXT,
    -- Device fingerprint hash (optional, for anomaly detection)
    device_fingerprint TEXT,
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    -- Session validity
    is_valid BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);

-- =====================================================
-- 3. CERTIFICATES TABLE - TLS/Certificate Management
-- =====================================================
-- Stores server certificates and CA certificates for:
-- - Server authentication verification
-- - Certificate pinning
-- - Certificate chain validation
-- =====================================================
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Certificate identification
    name VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL CHECK (certificate_type IN ('CA', 'SERVER', 'CLIENT', 'INTERMEDIATE')),
    -- Certificate data (PEM encoded)
    certificate_pem TEXT NOT NULL,
    -- Public key extracted from certificate (for verification)
    public_key_pem TEXT,
    -- Certificate metadata
    subject_cn VARCHAR(255),
    issuer_cn VARCHAR(255),
    serial_number VARCHAR(255),
    -- Validity
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    -- Certificate fingerprints for pinning
    fingerprint_sha256 VARCHAR(95) NOT NULL, -- SHA-256 fingerprint
    fingerprint_sha1 VARCHAR(59), -- SHA-1 fingerprint (legacy)
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    -- Chain information
    parent_certificate_id UUID REFERENCES public.certificates(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for certificate lookups
CREATE INDEX IF NOT EXISTS idx_certificates_fingerprint ON public.certificates(fingerprint_sha256);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON public.certificates(certificate_type);

-- =====================================================
-- 4. KEY PAIRS TABLE - E2EE Key Management
-- =====================================================
-- Stores encrypted private keys and public keys for E2EE
-- - X25519 key pairs for ECDH key exchange
-- - Ed25519 key pairs for digital signatures
-- - Keys are encrypted with user's password-derived key
-- =====================================================
CREATE TABLE IF NOT EXISTS public.key_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Key identification
    key_type VARCHAR(50) NOT NULL CHECK (key_type IN ('X25519', 'Ed25519', 'RSA', 'ECDSA')),
    key_purpose VARCHAR(50) NOT NULL CHECK (key_purpose IN ('ENCRYPTION', 'SIGNING', 'KEY_EXCHANGE', 'IDENTITY')),
    -- Public key (base64 encoded)
    public_key TEXT NOT NULL,
    -- Private key encrypted with user's password-derived key (base64 encoded)
    -- Encryption: AES-256-GCM with key derived from password using Argon2id
    encrypted_private_key TEXT NOT NULL,
    -- Encryption parameters
    key_derivation_salt TEXT NOT NULL, -- Salt for key derivation
    encryption_iv TEXT NOT NULL, -- IV for AES-GCM
    encryption_auth_tag TEXT, -- Auth tag for AES-GCM
    -- Key metadata
    key_id VARCHAR(64) UNIQUE NOT NULL, -- Unique key identifier for reference
    is_primary BOOLEAN DEFAULT false,
    -- Validity
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_key_pairs_user ON public.key_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_key_pairs_key_id ON public.key_pairs(key_id);
CREATE INDEX IF NOT EXISTS idx_key_pairs_type ON public.key_pairs(key_type);

-- =====================================================
-- 5. PRE-KEYS TABLE - Signal Protocol Pre-Keys
-- =====================================================
-- One-time pre-keys for Signal Protocol key exchange
-- These are consumed on first message to a user
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pre_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Pre-key data
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    -- Encrypted private key
    encrypted_private_key TEXT NOT NULL,
    key_derivation_salt TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    -- Usage tracking
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    used_by_user_id UUID REFERENCES public.users(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure unique key_id per user
    UNIQUE(user_id, key_id)
);

-- Index for pre-key lookups
CREATE INDEX IF NOT EXISTS idx_pre_keys_user ON public.pre_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_keys_unused ON public.pre_keys(user_id, is_used) WHERE is_used = false;

-- =====================================================
-- 6. CONVERSATIONS TABLE - E2EE Messaging
-- =====================================================
-- Stores conversation metadata for E2EE messaging
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Conversation type
    conversation_type VARCHAR(50) DEFAULT 'DIRECT' CHECK (conversation_type IN ('DIRECT', 'GROUP')),
    -- For group conversations
    name VARCHAR(255),
    description TEXT,
    -- Group admin (for group chats)
    admin_user_id UUID REFERENCES public.users(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. CONVERSATION PARTICIPANTS TABLE
-- =====================================================
-- Links users to conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- E2EE session keys (encrypted per-participant)
    -- These are the ratchet keys for the Double Ratchet algorithm
    encrypted_session_key TEXT,
    session_key_iv TEXT,
    -- Participant status
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    -- Unique participant per conversation
    UNIQUE(conversation_id, user_id)
);

-- Index for participant lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON public.conversation_participants(conversation_id);

-- =====================================================
-- 8. MESSAGES TABLE - E2EE Messages
-- =====================================================
-- Stores end-to-end encrypted messages
-- All message content is encrypted client-side before storage
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- E2EE message content (encrypted with session key)
    -- Encryption: AES-256-GCM
    encrypted_content TEXT NOT NULL,
    -- Encryption parameters
    content_iv TEXT NOT NULL, -- IV for AES-GCM
    content_auth_tag TEXT, -- Auth tag for AES-GCM
    -- Message authentication
    -- Digital signature of the encrypted content using sender's Ed25519 key
    signature TEXT NOT NULL,
    -- Key information for decryption
    sender_key_id VARCHAR(64) NOT NULL, -- Which key was used to encrypt
    -- Double Ratchet protocol information
    ratchet_public_key TEXT, -- Current ratchet public key
    chain_index INTEGER DEFAULT 0, -- Message chain index
    previous_chain_length INTEGER DEFAULT 0, -- Previous chain length
    -- Message metadata (not encrypted)
    message_type VARCHAR(50) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'FILE', 'IMAGE', 'KEY_EXCHANGE')),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Delivery status (server-side)
    delivered_at TIMESTAMPTZ,
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false
);

-- Index for message lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- =====================================================
-- 9. MESSAGE READ RECEIPTS TABLE
-- =====================================================
-- Tracks when messages are read (for E2EE read receipts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique read receipt per user per message
    UNIQUE(message_id, user_id)
);

-- Index for read receipt lookups
CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON public.message_read_receipts(message_id);

-- =====================================================
-- 10. AUDIT LOG TABLE - Security Auditing
-- =====================================================
-- Comprehensive audit log for security events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Actor
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('AUTH', 'MESSAGE', 'KEY', 'CERTIFICATE', 'ADMIN', 'SYSTEM')),
    event_description TEXT,
    -- Context
    ip_address INET,
    user_agent TEXT,
    -- Event data (JSON)
    event_data JSONB,
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- =====================================================
-- 11. PROJECTS TABLE - Application Data
-- =====================================================
-- Existing application feature: Project management
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

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);

-- =====================================================
-- 12. PROJECT TASKS TABLE - Application Data
-- =====================================================
-- Tasks within projects
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

-- Index for task lookups
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id);

-- =====================================================
-- 13. TASK COMMENTS TABLE - Application Data
-- =====================================================
-- Comments on project tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for comment lookups
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
