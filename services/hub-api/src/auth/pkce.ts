import { createHash, timingSafeEqual } from "node:crypto";

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 7636 S256: BASE64URL-ENCODE(SHA256(ASCII(code_verifier))). */
export function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  const hash = createHash("sha256").update(codeVerifier, "ascii").digest();
  const computed = base64Url(Buffer.from(hash));
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(codeChallenge.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
