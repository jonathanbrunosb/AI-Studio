// Gateway local que imita as rotas do Supabase: /auth/v1 → GoTrue, /rest/v1 → PostgREST,
// /storage/v1 → armazenamento em memória (sem políticas: as regras de Storage são cobertas pelos testes SQL).
import http from "node:http";

const PORT = Number(process.env.E2E_GATEWAY_PORT || 54321);
const AUTH = process.env.E2E_AUTH_URL || "http://127.0.0.1:9999";
const REST = process.env.E2E_REST_URL || "http://127.0.0.1:3001";
const PUBLIC = `http://127.0.0.1:${PORT}`;
const files = new Map();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
  res.setHeader("Access-Control-Expose-Headers", "*");
}
async function body(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }
function json(res, status, value) { cors(res); res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); }

async function forward(req, res, target, strip) {
  const url = new URL(req.url.slice(strip.length) || "/", target);
  const headers = { ...req.headers, host: url.host };
  const payload = ["GET", "HEAD"].includes(req.method) ? undefined : await body(req);
  const response = await fetch(url, { method: req.method, headers, body: payload, redirect: "manual" });
  cors(res);
  const out = {};
  response.headers.forEach((value, key) => { if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key)) out[key] = value; });
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function storage(req, res) {
  const path = decodeURIComponent(new URL(req.url, PUBLIC).pathname.replace(/^\/storage\/v1/, ""));
  let match;
  if (req.method === "POST" && (match = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
    const key = `${match[1]}/${match[2]}`;
    if (!files.has(key)) return json(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
    return json(res, 200, { signedURL: `/object/sign/${match[1]}/${encodeURI(match[2])}?token=e2e` });
  }
  if (req.method === "GET" && (match = (path.match(/^\/object\/(?:sign|authenticated|public)\/([^/]+)\/(.+)$/) || path.match(/^\/object\/(?!sign\/|list\/|info\/)([^/]+)\/(.+)$/)))) {
    const file = files.get(`${match[1]}/${match[2]}`);
    if (!file) return json(res, 404, { error: "not_found" });
    cors(res); res.writeHead(200, { "Content-Type": file.type }); return res.end(file.data);
  }
  if ((req.method === "POST" || req.method === "PUT") && (match = path.match(/^\/object\/([^/]+)\/(.+)$/))) {
    const key = `${match[1]}/${match[2]}`;
    if (files.has(key) && req.headers["x-upsert"] !== "true") return json(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    files.set(key, { data: await body(req), type: req.headers["content-type"] || "application/octet-stream" });
    return json(res, 200, { Key: key, Id: key });
  }
  if (req.method === "DELETE" && (match = path.match(/^\/object\/([^/]+)$/))) {
    const { prefixes = [] } = JSON.parse((await body(req)).toString() || "{}");
    prefixes.forEach((prefix) => files.delete(`${match[1]}/${prefix}`));
    return json(res, 200, prefixes.map((name) => ({ name })));
  }
  return json(res, 404, { error: "unsupported_storage_operation", path });
}

http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }
    if (req.url.startsWith("/auth/v1")) return await forward(req, res, AUTH, "/auth/v1");
    if (req.url.startsWith("/rest/v1")) return await forward(req, res, REST, "/rest/v1");
    if (req.url.startsWith("/storage/v1")) return await storage(req, res);
    json(res, 404, { error: "not_found" });
  } catch (error) {
    json(res, 502, { error: "gateway_error", message: String(error?.message || error) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`e2e gateway on ${PUBLIC}`));
