import { buildManifest, buildReadme, sha256Hex, slugify, type ManifestInput } from "./manifest";
import { signManifest } from "./signing";
import { createZip } from "./zip";

export type BuiltPackage = {
  zip: Uint8Array;
  fileName: string;
  manifest: ReturnType<typeof buildManifest>;
  manifestSha256: string;
  imageSha256: string;
  packageSha256: string;
  signed: boolean;
};

export function buildPublicationPackage(input: Omit<ManifestInput, "image">, image: Uint8Array, dims: { width: number; height: number }): BuiltPackage {
  const encoder = new TextEncoder();
  const base = `${slugify(input.content.title)}-v${input.version.number}`;
  const imageName = `${base}.png`;
  const imageSha256 = sha256Hex(image);
  const manifest = buildManifest({ ...input, image: { filename: imageName, width: dims.width, height: dims.height, bytes: image.byteLength, sha256: imageSha256 } });
  const manifestBytes = encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = sha256Hex(manifestBytes);
  const signature = signManifest(manifestBytes);
  const checksums = encoder.encode(`${manifestSha256}  manifest.json\n${imageSha256}  ${imageName}\n`);
  const entries = [
    { name: "manifest.json", data: manifestBytes },
    { name: imageName, data: image },
    { name: "checksums.sha256", data: checksums },
    { name: "README.txt", data: encoder.encode(buildReadme(manifest, Boolean(signature))) },
    ...(signature ? [{ name: "manifest.sig", data: encoder.encode(`${JSON.stringify({ algorithm: "ECDSA-P256-SHA256", key_id: signature.keyId, signature: signature.signatureBase64 })}\n`) }] : []),
  ];
  const zip = createZip(entries);
  return { zip, fileName: `${base}.zip`, manifest, manifestSha256, imageSha256, packageSha256: sha256Hex(zip), signed: Boolean(signature) };
}
