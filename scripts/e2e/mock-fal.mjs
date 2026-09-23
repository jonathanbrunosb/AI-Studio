// Simulador da Queue API da fal.ai para E2E local (sem créditos). Devolve um PNG real gerado aqui.
import http from "node:http";
import { deflateSync } from "node:zlib";

const PORT = Number(process.env.E2E_FAL_PORT || 54400);
const BASE = `http://127.0.0.1:${PORT}`;
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(width, height) {
  const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, "ascii"); data.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set([23, 105, 170 - Math.floor((x / width) * 120)], y * (width * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const image = png(512, 288);
let counter = 0;
const requests = new Map();

http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (!String(req.headers.authorization || "").startsWith("Key ")) return send(401, { detail: "missing key" });
  if (req.method === "POST") {
    let payload = ""; for await (const chunk of req) payload += chunk;
    const input = JSON.parse(payload || "{}");
    const id = `e2e-${++counter}`;
    requests.set(id, { images: Math.max(1, Math.min(4, Number(input.num_images) || 1)), polls: 0 });
    const app = url.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return send(200, { request_id: id, status_url: `${BASE}/${app}/requests/${id}/status`, response_url: `${BASE}/${app}/requests/${id}`, cancel_url: `${BASE}/${app}/requests/${id}/cancel` });
  }
  const match = url.pathname.match(/\/requests\/([^/]+)(\/status|\/cancel)?$/);
  if (url.pathname === "/files/e2e.png") { res.writeHead(200, { "Content-Type": "image/png", "Content-Length": image.length }); return res.end(image); }
  if (!match || !requests.has(match[1])) return send(404, { detail: "not found" });
  const request = requests.get(match[1]);
  if (match[2] === "/status") { request.polls += 1; return send(200, { status: request.polls < 2 ? "IN_PROGRESS" : "COMPLETED" }); }
  return send(200, { images: Array.from({ length: request.images }, () => ({ url: `${BASE}/files/e2e.png`, width: 512, height: 288, content_type: "image/png" })) });
}).listen(PORT, "127.0.0.1", () => console.log(`mock fal on ${BASE}`));
