/**
 * Lightweight browser-side E2EE utilities for the assignment demo.
 *
 * Flow:
 * 1) Generate X25519 + Ed25519 key pairs
 * 2) Encrypt private keys with a passphrase-derived key before storing remotely
 * 3) Derive a shared message key (ECDH) and encrypt messages with AES-GCM
 * 4) Sign encrypted payloads with Ed25519 and verify on receive
 */

export type EncryptedPrivateKeyPackage = {
  ciphertext: string;
  salt: string;
  iv: string;
  authTag: string;
};

export type KeyBundleForServer = {
  exchangePublicKey: string;
  signingPublicKey: string;
  encryptedExchangePrivateKey: string;
  encryptedSigningPrivateKey: string;
  exchangeSalt: string;
  exchangeIv: string;
  exchangeAuthTag: string;
  signingSalt: string;
  signingIv: string;
  signingAuthTag: string;
  exchangeKeyId: string;
  signingKeyId: string;
};

export type RuntimeKeyBundle = {
  exchangePublicKeyRaw: Uint8Array;
  signingPublicKeyRaw: Uint8Array;
  exchangePrivateKey: CryptoKey;
  signingPrivateKey: CryptoKey;
  exchangeKeyId: string;
  signingKeyId: string;
  serverPayload: KeyBundleForServer;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const combined = new Uint8Array(a.length + b.length);
  combined.set(a, 0);
  combined.set(b, a.length);
  return combined;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function asCryptoKeyPair(value: CryptoKey | CryptoKeyPair): CryptoKeyPair {
  if ("publicKey" in value && "privateKey" in value) {
    return value;
  }
  throw new Error("Expected CryptoKeyPair.");
}

async function deriveWrappingKey(passphrase: string, salt: Uint8Array) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 250_000,
      hash: "SHA-256",
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPrivateKeyBytes(
  privateKeyBytes: Uint8Array,
  passphrase: string,
): Promise<EncryptedPrivateKeyPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      wrappingKey,
      toArrayBuffer(privateKeyBytes),
    ),
  );

  // WebCrypto AES-GCM appends the 16-byte auth tag at the end.
  const authTag = encrypted.slice(encrypted.length - 16);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);

  return {
    ciphertext: bytesToBase64(ciphertext),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    authTag: bytesToBase64(authTag),
  };
}

async function decryptPrivateKeyBytes(
  encryptedPackage: EncryptedPrivateKeyPackage,
  passphrase: string,
) {
  const salt = base64ToBytes(encryptedPackage.salt);
  const iv = base64ToBytes(encryptedPackage.iv);
  const ciphertext = base64ToBytes(encryptedPackage.ciphertext);
  const authTag = base64ToBytes(encryptedPackage.authTag);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    wrappingKey,
    toArrayBuffer(concatBytes(ciphertext, authTag)),
  );

  return new Uint8Array(decrypted);
}

export async function generateRuntimeKeyBundle(
  passphrase: string,
): Promise<RuntimeKeyBundle> {
  const exchangeKeyPair = await crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  );
  const signingKeyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const exchangePair = asCryptoKeyPair(exchangeKeyPair);
  const signingPair = asCryptoKeyPair(signingKeyPair);

  const exchangePublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", exchangePair.publicKey),
  );
  const signingPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", signingPair.publicKey),
  );
  const exchangePrivateKeyPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", exchangePair.privateKey),
  );
  const signingPrivateKeyPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", signingPair.privateKey),
  );

  const encryptedExchangePrivate = await encryptPrivateKeyBytes(
    exchangePrivateKeyPkcs8,
    passphrase,
  );
  const encryptedSigningPrivate = await encryptPrivateKeyBytes(
    signingPrivateKeyPkcs8,
    passphrase,
  );

  const exchangeKeyId = `kx-${toHex(crypto.getRandomValues(new Uint8Array(8)))}`;
  const signingKeyId = `sig-${toHex(crypto.getRandomValues(new Uint8Array(8)))}`;

  return {
    exchangePublicKeyRaw,
    signingPublicKeyRaw,
    exchangePrivateKey: exchangePair.privateKey,
    signingPrivateKey: signingPair.privateKey,
    exchangeKeyId,
    signingKeyId,
    serverPayload: {
      exchangePublicKey: bytesToBase64(exchangePublicKeyRaw),
      signingPublicKey: bytesToBase64(signingPublicKeyRaw),
      encryptedExchangePrivateKey: encryptedExchangePrivate.ciphertext,
      encryptedSigningPrivateKey: encryptedSigningPrivate.ciphertext,
      exchangeSalt: encryptedExchangePrivate.salt,
      exchangeIv: encryptedExchangePrivate.iv,
      exchangeAuthTag: encryptedExchangePrivate.authTag,
      signingSalt: encryptedSigningPrivate.salt,
      signingIv: encryptedSigningPrivate.iv,
      signingAuthTag: encryptedSigningPrivate.authTag,
      exchangeKeyId,
      signingKeyId,
    },
  };
}

export async function importPrivateKeyFromPackage(
  encryptedPackage: EncryptedPrivateKeyPackage,
  passphrase: string,
  kind: "X25519" | "Ed25519",
) {
  const pkcs8 = await decryptPrivateKeyBytes(encryptedPackage, passphrase);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: kind },
    false,
    kind === "X25519" ? ["deriveBits"] : ["sign"],
  );
}

export async function importSigningPublicKeyFromBase64(base64: string) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
}

export async function deriveSharedAesKey(
  ownExchangePrivate: CryptoKey,
  peerExchangePublicBase64: string,
) {
  const peerPublicKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(peerExchangePublicBase64),
    { name: "X25519" },
    false,
    [],
  );

  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "X25519",
        public: peerPublicKey,
      },
      ownExchangePrivate,
      256,
    ),
  );

  // Derive a fixed-length symmetric key from ECDH output.
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", toArrayBuffer(sharedBits)),
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function deriveRatchetMessageKey(
  baseSharedKey: CryptoKey,
  chainIndex: number,
) {
  // Simple deterministic per-message key derivation for ratchet progression demo.
  const baseRaw = new Uint8Array(await crypto.subtle.exportKey("raw", baseSharedKey));
  const indexBytes = new Uint8Array(4);
  new DataView(indexBytes.buffer).setUint32(0, chainIndex, false);
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      toArrayBuffer(concatBytes(baseRaw, indexBytes)),
    ),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(plainText: string, aesKey: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(plainText);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      aesKey,
      plainBytes,
    ),
  );

  const authTag = encrypted.slice(encrypted.length - 16);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);

  return {
    ciphertextB64: bytesToBase64(ciphertext),
    ivB64: bytesToBase64(iv),
    authTagB64: bytesToBase64(authTag),
  };
}

export async function decryptMessage(
  ciphertextB64: string,
  ivB64: string,
  authTagB64: string,
  aesKey: CryptoKey,
) {
  const ciphertext = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);
  const authTag = base64ToBytes(authTagB64);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    concatBytes(ciphertext, authTag),
  );

  return new TextDecoder().decode(decrypted);
}

export function buildSignaturePayload(parts: {
  conversationId: string;
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
  chainIndex: number;
}) {
  // Stable payload for signing/verification.
  return new TextEncoder().encode(
    JSON.stringify({
      c: parts.conversationId,
      ct: parts.ciphertextB64,
      iv: parts.ivB64,
      tag: parts.authTagB64,
      idx: parts.chainIndex,
    }),
  );
}

export async function signPayload(payload: Uint8Array, signingPrivateKey: CryptoKey) {
  const signature = await crypto.subtle.sign(
    "Ed25519",
    signingPrivateKey,
    toArrayBuffer(payload),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyPayloadSignature(
  payload: Uint8Array,
  signatureB64: string,
  signingPublicKey: CryptoKey,
) {
  return crypto.subtle.verify(
    "Ed25519",
    signingPublicKey,
    toArrayBuffer(base64ToBytes(signatureB64)),
    toArrayBuffer(payload),
  );
}
