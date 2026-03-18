import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export function sealCookiePayload(payload: unknown): string {
  const sessionKey = getSessionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function unsealCookiePayload<T>(
  sealedPayload: string,
  guard: (value: unknown) => value is T,
): T | null {
  const [ivPart, authTagPart, ciphertextPart] = sealedPayload.split(".", 3);

  if (!ivPart || !authTagPart || !ciphertextPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSessionKey(),
      Buffer.from(ivPart, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsedValue: unknown = JSON.parse(plaintext);

    if (!guard(parsedValue)) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function getSessionKey(): Buffer {
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;

  if (typeof sessionSecret !== "string" || sessionSecret.trim().length < 32) {
    throw new Error(
      "DASHBOARD_SESSION_SECRET must be set to at least 32 characters.",
    );
  }

  return createHash("sha256").update(sessionSecret.trim()).digest();
}
