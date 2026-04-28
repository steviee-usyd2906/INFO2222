import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type BootstrapPayload = {
  username: string;
  keyBundle: {
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
};

type MessageInsertPayload = {
  conversationId: string;
  senderUsername: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  signature: string;
  senderKeyId: string;
  ratchetPublicKey?: string;
  chainIndex: number;
};

type MessageRow = {
  id: string;
  sender_id: string;
  encrypted_content: string;
  content_iv: string;
  content_auth_tag: string | null;
  signature: string;
  sender_key_id: string;
  ratchet_public_key: string | null;
  chain_index: number | null;
  created_at: string;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
};

type PreKeyRow = {
  id: string;
  key_id: number;
  public_key: string;
};

const DEMO_PASSWORD_HASH = "demo-password-hash";
const DEMO_PASSWORD_SALT = "demo-password-salt";

function toDemoEmail(username: string) {
  const safe = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "user"}@mango-demo.local`;
}

async function ensureUser(username: string) {
  const supabase = createAdminClient();
  const email = toDemoEmail(username);

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, username, email")
    .eq("email", email)
    .maybeSingle<UserRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      username,
      email,
      password_hash: DEMO_PASSWORD_HASH,
      password_salt: DEMO_PASSWORD_SALT,
      is_active: true,
      is_email_verified: true,
    })
    .select("id, username, email")
    .single<UserRow>();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

async function upsertUserKeys(
  userId: string,
  payload: BootstrapPayload["keyBundle"],
) {
  const supabase = createAdminClient();

  // We keep one active key per purpose in this MVP for simpler demo flow.
  await supabase
    .from("key_pairs")
    .delete()
    .eq("user_id", userId)
    .in("key_purpose", ["KEY_EXCHANGE", "IDENTITY"]);

  const rows = [
    {
      user_id: userId,
      key_type: "X25519",
      key_purpose: "KEY_EXCHANGE",
      public_key: payload.exchangePublicKey,
      encrypted_private_key: payload.encryptedExchangePrivateKey,
      key_derivation_salt: payload.exchangeSalt,
      encryption_iv: payload.exchangeIv,
      encryption_auth_tag: payload.exchangeAuthTag,
      key_id: payload.exchangeKeyId,
      is_primary: true,
      is_active: true,
    },
    {
      user_id: userId,
      key_type: "Ed25519",
      key_purpose: "IDENTITY",
      public_key: payload.signingPublicKey,
      encrypted_private_key: payload.encryptedSigningPrivateKey,
      key_derivation_salt: payload.signingSalt,
      encryption_iv: payload.signingIv,
      encryption_auth_tag: payload.signingAuthTag,
      key_id: payload.signingKeyId,
      is_primary: true,
      is_active: true,
    },
  ];

  const { error } = await supabase.from("key_pairs").insert(rows);
  if (error) {
    throw error;
  }

  await supabase
    .from("users")
    .update({
      public_key: payload.exchangePublicKey,
      identity_public_key: payload.signingPublicKey,
    })
    .eq("id", userId);
}

async function ensurePreKeysForUser(userId: string) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("pre_keys")
    .select("id")
    .eq("user_id", userId)
    .eq("is_used", false)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if ((existing ?? []).length > 0) {
    return;
  }

  // Demo seed: provision a handful of one-time prekeys so first-contact
  // handshakes can consume one key without extra setup.
  const keyRows = Array.from({ length: 5 }, (_, index) => {
    const keyId = index + 1;
    return {
      user_id: userId,
      key_id: keyId,
      public_key: `demo-prekey-public-${userId}-${keyId}`,
      encrypted_private_key: `demo-prekey-private-${userId}-${keyId}`,
      key_derivation_salt: "demo-prekey-salt",
      encryption_iv: "demo-prekey-iv",
      is_used: false,
    };
  });

  const { error } = await supabase.from("pre_keys").insert(keyRows);
  if (error) {
    throw error;
  }
}

async function consumePreKeyForUser(userId: string, usedByUserId: string) {
  const supabase = createAdminClient();
  const { data: available, error: availableError } = await supabase
    .from("pre_keys")
    .select("id, key_id, public_key")
    .eq("user_id", userId)
    .eq("is_used", false)
    .order("key_id", { ascending: true })
    .limit(1)
    .maybeSingle<PreKeyRow>();

  if (availableError) {
    throw availableError;
  }

  if (!available) {
    return null;
  }

  const { error: markUsedError } = await supabase
    .from("pre_keys")
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
      used_by_user_id: usedByUserId,
    })
    .eq("id", available.id);

  if (markUsedError) {
    throw markUsedError;
  }

  return available;
}

async function ensureSelfConversation(userId: string) {
  const supabase = createAdminClient();

  // We keep a deterministic direct conversation for the current demo user.
  const { data: existingParticipant, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{ conversation_id: string }>();

  if (participantError) {
    throw participantError;
  }

  if (existingParticipant?.conversation_id) {
    return existingParticipant.conversation_id;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "DIRECT",
      name: "Secure Self Chat",
      admin_user_id: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (conversationError) {
    throw conversationError;
  }

  const { error: participantInsertError } = await supabase
    .from("conversation_participants")
    .insert({
      conversation_id: conversation.id,
      user_id: userId,
      is_active: true,
    });

  if (participantInsertError) {
    throw participantInsertError;
  }

  return conversation.id;
}

export async function bootstrapSecureChat(payload: BootstrapPayload) {
  const username = payload.username.trim();
  if (!username) {
    throw new Error("Username is required for secure chat bootstrap.");
  }

  const user = await ensureUser(username);
  await upsertUserKeys(user.id, payload.keyBundle);
  await ensurePreKeysForUser(user.id);
  const conversationId = await ensureSelfConversation(user.id);
  const consumedPreKey = await consumePreKeyForUser(user.id, user.id);

  return {
    userId: user.id,
    username: user.username,
    conversationId,
    keyBundle: {
      exchangePublicKey: payload.keyBundle.exchangePublicKey,
      signingPublicKey: payload.keyBundle.signingPublicKey,
      exchangeKeyId: payload.keyBundle.exchangeKeyId,
      signingKeyId: payload.keyBundle.signingKeyId,
    },
    consumedPreKey: consumedPreKey
      ? {
          id: consumedPreKey.id,
          keyId: consumedPreKey.key_id,
          publicKey: consumedPreKey.public_key,
        }
      : null,
  };
}

export async function saveEncryptedMessage(payload: MessageInsertPayload) {
  const supabase = createAdminClient();
  const sender = await ensureUser(payload.senderUsername);

  const { error } = await supabase.from("messages").insert({
    id: randomUUID(),
    conversation_id: payload.conversationId,
    sender_id: sender.id,
    encrypted_content: payload.encryptedContent,
    content_iv: payload.iv,
    content_auth_tag: payload.authTag,
    signature: payload.signature,
    sender_key_id: payload.senderKeyId,
    ratchet_public_key: payload.ratchetPublicKey ?? null,
    chain_index: payload.chainIndex,
    previous_chain_length: 0,
    message_type: "TEXT",
  });

  if (error) {
    throw error;
  }
}

export async function listEncryptedMessages(conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, sender_id, encrypted_content, content_iv, content_auth_tag, signature, sender_key_id, ratchet_public_key, chain_index, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MessageRow[];
  if (rows.length === 0) {
    return [];
  }

  const senderIds = [...new Set(rows.map((row) => row.sender_id))];
  const { data: senders } = await supabase
    .from("users")
    .select("id, username")
    .in("id", senderIds);
  const senderMap = new Map((senders ?? []).map((user) => [user.id, user.username]));

  const signingKeyIds = [...new Set(rows.map((row) => row.sender_key_id))];
  const { data: keyRows } = await supabase
    .from("key_pairs")
    .select("key_id, public_key")
    .in("key_id", signingKeyIds);
  const keyMap = new Map((keyRows ?? []).map((row) => [row.key_id, row.public_key]));

  const messageIds = rows.map((row) => row.id);
  const { data: receipts } = await supabase
    .from("message_read_receipts")
    .select("message_id, user_id")
    .in("message_id", messageIds);

  const readCountMap = new Map<string, number>();
  for (const receipt of receipts ?? []) {
    readCountMap.set(
      receipt.message_id,
      (readCountMap.get(receipt.message_id) ?? 0) + 1,
    );
  }

  return rows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderUsername: senderMap.get(row.sender_id) ?? "Unknown",
    encryptedContent: row.encrypted_content,
    iv: row.content_iv,
    authTag: row.content_auth_tag ?? "",
    signature: row.signature,
    senderKeyId: row.sender_key_id,
    senderSigningPublicKey: keyMap.get(row.sender_key_id) ?? "",
    ratchetPublicKey: row.ratchet_public_key ?? "",
    chainIndex: row.chain_index ?? 0,
    readByCount: readCountMap.get(row.id) ?? 0,
    createdAt: row.created_at,
  }));
}

export async function markMessagesRead(
  conversationId: string,
  username: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) {
    return;
  }

  const user = await ensureUser(username);
  const supabase = createAdminClient();

  // Upsert-style behavior via insert+ignore duplicate conflicts.
  const rows = messageIds.map((messageId) => ({
    message_id: messageId,
    user_id: user.id,
    read_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("message_read_receipts")
    .upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}
