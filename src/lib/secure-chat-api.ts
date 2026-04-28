type BootstrapResponse = {
  bootstrap: {
    userId: string;
    username: string;
    conversationId: string;
    keyBundle: {
      exchangePublicKey: string;
      signingPublicKey: string;
      exchangeKeyId: string;
      signingKeyId: string;
    };
    consumedPreKey: {
      id: string;
      keyId: number;
      publicKey: string;
    } | null;
  };
};

type MessageRecord = {
  id: string;
  senderId: string;
  senderUsername: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  signature: string;
  senderKeyId: string;
  senderSigningPublicKey: string;
  ratchetPublicKey: string;
  chainIndex: number;
  readByCount: number;
  createdAt: string;
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

export async function bootstrapSecureChat(
  username: string,
  keyBundle: Record<string, string>,
) {
  const data = await requestJson<BootstrapResponse>("/api/chat/bootstrap", {
    method: "POST",
    body: JSON.stringify({ username, keyBundle }),
  });
  return data.bootstrap;
}

export async function postEncryptedMessage(payload: {
  conversationId: string;
  senderUsername: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  signature: string;
  senderKeyId: string;
  ratchetPublicKey?: string;
  chainIndex: number;
}) {
  await requestJson<{ success: boolean }>("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEncryptedMessages(conversationId: string) {
  const data = await requestJson<{ messages: MessageRecord[] }>(
    `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
  );
  return data.messages;
}

export async function markReadReceipts(payload: {
  conversationId: string;
  username: string;
  messageIds: string[];
}) {
  await requestJson<{ success: boolean }>("/api/chat/read-receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
