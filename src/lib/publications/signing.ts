import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";

let cached: { key: KeyObject; publicKeyBase64: string; keyId: string } | null | undefined;

/** Chave ECDSA P-256 (PKCS#8 PEM) em PORTAL_SIGNING_PRIVATE_KEY. A chave pública pode ser publicada no portal. */
export function getSigningKey() {
  if (cached !== undefined) return cached;
  const pem = process.env.PORTAL_SIGNING_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!pem) { cached = null; return cached; }
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("curve");
    const spki = createPublicKey(key).export({ type: "spki", format: "der" });
    const publicKeyBase64 = Buffer.from(spki).toString("base64");
    cached = { key, publicKeyBase64, keyId: publicKeyBase64.slice(-16) };
  } catch {
    cached = null;
  }
  return cached;
}

export function resetSigningKeyCache() { cached = undefined; }

/** Assinatura no formato IEEE P1363 (r||s), compatível com WebCrypto `ECDSA` + `SHA-256`. */
export function signManifest(bytes: Uint8Array) {
  const signing = getSigningKey();
  if (!signing) return null;
  const signature = sign("sha256", bytes, { key: signing.key, dsaEncoding: "ieee-p1363" });
  return { signatureBase64: signature.toString("base64"), keyId: signing.keyId };
}
