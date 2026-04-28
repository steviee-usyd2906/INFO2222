import { bootstrapSecureChat } from "@/lib/secure-chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username : "";
    const keyBundle = body.keyBundle;

    if (!username.trim() || !keyBundle) {
      return Response.json(
        { error: "username and keyBundle are required." },
        { status: 400 },
      );
    }

    const payload = {
      username: username.trim(),
      keyBundle: {
        exchangePublicKey: String(keyBundle.exchangePublicKey ?? ""),
        signingPublicKey: String(keyBundle.signingPublicKey ?? ""),
        encryptedExchangePrivateKey: String(
          keyBundle.encryptedExchangePrivateKey ?? "",
        ),
        encryptedSigningPrivateKey: String(
          keyBundle.encryptedSigningPrivateKey ?? "",
        ),
        exchangeSalt: String(keyBundle.exchangeSalt ?? ""),
        exchangeIv: String(keyBundle.exchangeIv ?? ""),
        exchangeAuthTag: String(keyBundle.exchangeAuthTag ?? ""),
        signingSalt: String(keyBundle.signingSalt ?? ""),
        signingIv: String(keyBundle.signingIv ?? ""),
        signingAuthTag: String(keyBundle.signingAuthTag ?? ""),
        exchangeKeyId: String(keyBundle.exchangeKeyId ?? ""),
        signingKeyId: String(keyBundle.signingKeyId ?? ""),
      },
    };

    const result = await bootstrapSecureChat(payload);
    return Response.json({ bootstrap: result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to bootstrap secure chat.";
    return Response.json({ error: message }, { status: 500 });
  }
}
