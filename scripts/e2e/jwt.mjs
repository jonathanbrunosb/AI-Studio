// Gera chaves JWT HS256 (anon/service_role) para o stack local de E2E.
import { createHmac } from "node:crypto";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
export function sign(payload, secret) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const signature = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${signature}`;
}
if (process.argv[2]) {
  const secret = process.env.E2E_JWT_SECRET;
  console.log(sign({ role: process.argv[2], iss: "supabase-e2e", iat: 1700000000, exp: 2000000000 }, secret));
}
