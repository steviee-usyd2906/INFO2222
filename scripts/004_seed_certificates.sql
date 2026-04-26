-- =====================================================
-- INFO2222 Initial Certificate Seed Data
-- =====================================================
-- Seeds the initial CA certificate for server authentication
-- In production, this would be your actual CA certificate
-- =====================================================

-- Insert a sample CA certificate
-- NOTE: In production, replace with your actual CA certificate
-- This is a placeholder structure showing what fields are needed
INSERT INTO public.certificates (
    name,
    certificate_type,
    certificate_pem,
    public_key_pem,
    subject_cn,
    issuer_cn,
    serial_number,
    valid_from,
    valid_until,
    fingerprint_sha256,
    fingerprint_sha1,
    is_active
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
    'INFO2222 Root CA',
    'INFO2222 Root CA',
    '1',
    '2024-01-01 00:00:00+00',
    '2025-12-31 23:59:59+00',
    'E3:B0:C4:42:98:FC:1C:14:9A:FB:F4:C8:99:6F:B9:24:27:AE:41:E4:64:9B:93:4C:A4:95:99:1B:78:52:B8:55',
    'DA:39:A3:EE:5E:6B:4B:0D:32:55:BF:EF:95:60:18:90:AF:D8:07:09',
    true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECURITY DOCUMENTATION
-- =====================================================
-- This section documents the security architecture

/*
=====================================================
1. SECURE PASSWORD STORAGE
=====================================================
Algorithm: Argon2id (via application code)

Why Argon2id?
- Winner of the Password Hashing Competition (PHC)
- Memory-hard: resistant to GPU/ASIC attacks
- Combines Argon2i (side-channel resistant) and Argon2d (GPU resistant)
- Recommended by OWASP for password hashing

Parameters used:
- Memory cost (m): 65536 KB (64 MB)
- Time cost (t): 3 iterations
- Parallelism (p): 4 threads
- Salt: 16 bytes (128 bits) cryptographically random
- Hash output: 32 bytes (256 bits)

Storage format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>

Additional defense: Separate password_salt column stores an additional
salt value for defense in depth.

=====================================================
2. SERVER AUTHENTICATION
=====================================================
Method: TLS 1.3 with Certificate Pinning

Certificate Chain:
1. Root CA Certificate (self-signed, stored in certificates table)
2. Server Certificate (signed by Root CA)
3. Client validates server cert against pinned CA public key

Security implications of hardcoded CA public key:
PROS:
- Prevents MITM attacks even if attacker has valid CA cert
- Provides additional layer of trust beyond standard PKI
- Protects against CA compromise

CONS:
- Requires app update if CA key rotates
- Cannot use different CAs in different environments
- Key compromise requires immediate app update

Certificate generation process:
1. Generate CA private key: openssl genrsa -out ca.key 4096
2. Create CA certificate: openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 -out ca.crt
3. Generate server private key: openssl genrsa -out server.key 4096
4. Create server CSR: openssl req -new -key server.key -out server.csr
5. Sign server cert with CA: openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365 -sha256

=====================================================
3. SECURE PASSWORD TRANSMISSION
=====================================================
Method: TLS 1.2+ (TLS 1.3 preferred)

Implementation:
- All API endpoints require HTTPS
- HTTP requests redirect to HTTPS
- HSTS header enabled with max-age
- Secure cookies with HttpOnly, Secure, SameSite flags

The Supabase connection already uses TLS for all communications.

=====================================================
4. END-TO-END ENCRYPTION (E2EE)
=====================================================
Protocol: Signal Protocol (Double Ratchet)

Key types:
- Identity key (Ed25519): Long-term signing key
- Signed pre-key (X25519): Medium-term key exchange
- One-time pre-keys (X25519): Consumed on first message

Encryption:
- AES-256-GCM for message content
- X25519 for key exchange (ECDH)
- Ed25519 for digital signatures

Double Ratchet provides:
- Forward secrecy: Past messages protected if current key compromised
- Break-in recovery: Future messages protected after compromise
- Message authentication: Signatures prevent tampering

Database storage:
- All message content is encrypted client-side
- Server only sees encrypted_content, content_iv, content_auth_tag
- Private keys are encrypted with user's password-derived key
- Key derivation uses Argon2id with separate salt
*/
