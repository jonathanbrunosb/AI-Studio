import { generateKeyPairSync } from "node:crypto";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest, sha256Hex } from "@/lib/publications/manifest";
import { buildPublicationPackage } from "@/lib/publications/package-builder";
import { getSigningKey, resetSigningKeyCache } from "@/lib/publications/signing";
import { crc32, createZip } from "@/lib/publications/zip";

const PORTAL_MODULE = process.env.PORTAL_REPO_PATH
  ? `${process.env.PORTAL_REPO_PATH}/js/ai-studio-import.js`
  : "/home/user/portal-contabilidade/js/ai-studio-import.js";

/** PNG real e decodificável (azul corporativo), usado na fixture exportada para o portal. */
function realPng(width: number, height: number) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width); iv.setUint32(4, height); ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) raw.set([11, 43, 80], y * (width * 3 + 1) + 1 + x * 3);
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(deflateSync(raw))), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function png(width: number, height: number) {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}

const input = {
  publicationId: "11111111-1111-4111-8111-111111111111",
  content: {
    id: "22222222-2222-4222-8222-222222222222", title: "Atualização do Sistema IFRS 16", subtitle: "Nova funcionalidade disponível",
    description: "Conheça as melhorias <script>alert(1)</script> implementadas.", category: "system_announcement" as const,
    reference_date: "2026-09-22", source_name: null, source_url: "javascript:alert(1)",
    editorial_details: { solution_name: "Gestão de Arrendamentos", functionality: "Conciliação automática", access_url: "https://arrendamento.contabilidade-eqtl.com/" },
  },
  version: { id: "33333333-3333-4333-8333-333333333333", number: 4, approvedAt: "2026-09-22T18:00:00.000Z", snapshotSha256: "a".repeat(64) },
  destination: { id: "divulgacao_sistemas", label: "Central de Conteúdo → Newsletter (Tecnologia)", portal_collection: "newsletter", portal_category: "Tecnologia" },
  organization: "Gerência de Contabilidade",
  supersedes: null,
  preparedAt: "2026-09-23T10:00:00.000Z",
};

function withKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  process.env.PORTAL_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  resetSigningKeyCache();
  return Buffer.from(publicKey.export({ type: "spki", format: "der" })).toString("base64");
}

afterEach(() => { delete process.env.PORTAL_SIGNING_PRIVATE_KEY; resetSigningKeyCache(); });

describe("manifesto de publicação", () => {
  it("usa somente dados da versão aprovada, sem URLs executáveis nem dados pessoais", () => {
    const manifest = buildManifest({ ...input, image: { filename: "x.png", width: 1920, height: 1080, bytes: 10, sha256: "b".repeat(64) } });
    expect(manifest).toMatchObject({ schema_version: "1.0", content_id: input.content.id, version_id: input.version.id, category: "system_announcement", access_url: "https://arrendamento.contabilidade-eqtl.com/", system_name: "Gestão de Arrendamentos" });
    expect(manifest.approval).toEqual({ version_id: input.version.id, version_number: 4, approved_at: input.version.approvedAt, snapshot_sha256: "a".repeat(64) });
    expect(manifest.source_url).toBeNull();
    expect(JSON.stringify(manifest)).not.toMatch(/token|signedUrl|@|password/i);
  });
});

describe("pacote ZIP", () => {
  it("gera ZIP válido com CRC e hashes corretos", () => {
    const image = png(1920, 1080);
    const built = buildPublicationPackage(input, image, { width: 1920, height: 1080 });
    expect(built.fileName).toBe("atualizacao-do-sistema-ifrs-16-v4.zip");
    expect(built.imageSha256).toBe(sha256Hex(image));
    expect(built.packageSha256).toBe(sha256Hex(built.zip));
    expect(built.signed).toBe(false);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const view = new DataView(built.zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });

  it("recusa nomes com caminhos", () => {
    expect(() => createZip([{ name: "../evil.png", data: new Uint8Array(1) }])).toThrow();
    expect(() => createZip([{ name: "a/b.png", data: new Uint8Array(1) }])).toThrow();
  });

  it("assina o manifesto quando a chave está configurada", () => {
    const publicKey = withKey();
    expect(getSigningKey()?.publicKeyBase64).toBe(publicKey);
    const built = buildPublicationPackage(input, png(1080, 1080), { width: 1080, height: 1080 });
    expect(built.signed).toBe(true);
  });
});

// Teste de interoperabilidade real: o pacote gerado pelo AI Studio é lido pelo código do portal.
describe.runIf(existsSync(PORTAL_MODULE))("importação no Portal da Contabilidade (código real do portal)", () => {
  async function portal() {
    return await import(/* @vite-ignore */ pathToFileURL(PORTAL_MODULE).href) as {
      readZip: (b: Uint8Array) => Promise<Map<string, Uint8Array>>;
      validatePackage: (f: Map<string, Uint8Array>, o: { publicKeySpki?: string; requireSignature?: boolean }) => Promise<{ ok: boolean; errors: string[]; origin: string; manifest: { title: string } }>;
      findExisting: (items: unknown[], m: unknown) => { kind: string } | null;
      toPortalItem: (m: unknown, o: Record<string, unknown>) => Record<string, unknown>;
    };
  }

  it("importa pacote válido e assinado como item em revisão", async () => {
    const publicKey = withKey();
    const built = buildPublicationPackage(input, realPng(640, 360), { width: 640, height: 360 });
    const { readZip, validatePackage, toPortalItem, findExisting } = await portal();
    const files = await readZip(built.zip);
    const result = await validatePackage(files, { publicKeySpki: publicKey, requireSignature: true });
    expect(result.errors).toEqual([]);
    expect(result.origin).toBe("verified");
    const item = toPortalItem(result.manifest, { imagePath: "assets/images/ai-studio/x.png", origin: result.origin });
    expect(item).toMatchObject({ status: "Em revisão", titulo: input.content.title, aprovadoPor: null });
    expect(findExisting([item], result.manifest)).toMatchObject({ kind: "duplicate" });
    const outDir = process.env.PORTAL_FIXTURE_DIR;
    if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(`${outDir}/pacote-exemplo.zip`, built.zip); writeFileSync(`${outDir}/chave-publica.txt`, publicKey); }
  });

  it("bloqueia pacote adulterado, sem assinatura ou assinado por outra chave", async () => {
    const { readZip, validatePackage } = await portal();
    const publicKey = withKey();
    const built = buildPublicationPackage(input, png(1080, 1080), { width: 1080, height: 1080 });
    const tampered = built.zip.slice();
    const at = Buffer.from(tampered).indexOf("Atualiza");
    tampered[at] = "X".charCodeAt(0);
    await expect(readZip(tampered)).rejects.toThrow(/CRC/);

    const otherKey = withKey();
    expect(otherKey).not.toBe(publicKey);
    const files = await readZip(built.zip);
    expect((await validatePackage(files, { publicKeySpki: otherKey, requireSignature: true })).origin).toBe("invalid");

    delete process.env.PORTAL_SIGNING_PRIVATE_KEY; resetSigningKeyCache();
    const unsigned = buildPublicationPackage(input, png(1080, 1080), { width: 1080, height: 1080 });
    const unsignedResult = await validatePackage(await readZip(unsigned.zip), { publicKeySpki: publicKey, requireSignature: true });
    expect(unsignedResult.ok).toBe(false);
  });

  it("recusa ZIP com arquivos inesperados", async () => {
    const { readZip, validatePackage } = await portal();
    const built = buildPublicationPackage(input, png(1080, 1080), { width: 1080, height: 1080 });
    const files = await readZip(built.zip);
    files.set("script.js", new TextEncoder().encode("alert(1)"));
    const result = await validatePackage(files, {});
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain("inesperado");
  });
});
