"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MediaAsset } from "@/lib/editor/editor-types";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export function ImageUploader({ contentId, userId, assets, onUploaded, onInsert }: {
  contentId: string; userId: string; assets: MediaAsset[];
  onUploaded: (asset: MediaAsset) => void; onInsert: (asset: MediaAsset) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function choose(file?: File) {
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size > maxBytes) {
      setError("Use PNG, JPG ou WebP com até 10 MB."); return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file); setPreviewUrl(URL.createObjectURL(file)); setError(null);
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setError(null);
    const supabase = createClient();
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const path = `${userId}/${contentId}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage.from("editor-assets").upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) { setError("Não foi possível enviar a imagem."); setUploading(false); return; }
    const record = await supabase.from("media_assets").insert({
      content_id: contentId, storage_path: path, file_name: file.name, mime_type: file.type, created_by: userId,
    }).select("id, file_name, storage_path, mime_type").single();
    if (record.error || !record.data) {
      await supabase.storage.from("editor-assets").remove([path]);
      setError("A imagem não pôde ser registrada na biblioteca."); setUploading(false); return;
    }
    const signed = await supabase.storage.from("editor-assets").createSignedUrl(path, 3600);
    if (!signed.data?.signedUrl) { setError("A imagem foi enviada, mas não pôde ser aberta."); setUploading(false); return; }
    const asset: MediaAsset = { id: record.data.id, fileName: record.data.file_name, storagePath: record.data.storage_path, mimeType: record.data.mime_type, signedUrl: signed.data.signedUrl };
    onUploaded(asset); await onInsert(asset); setUploading(false);
    setPendingFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return <div>
    <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} />
    <button className="secondary-button w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" size={16} /> : <ImagePlus size={16} />}{uploading ? "Enviando…" : "Enviar imagem"}</button>
    {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    {pendingFile && previewUrl && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-2"><img src={previewUrl} alt="Prévia do arquivo selecionado" className="h-28 w-full rounded-lg object-contain bg-white" /><p className="mt-2 truncate text-[10px] font-semibold text-slate-600">{pendingFile.name}</p><div className="mt-2 flex gap-2"><button className="primary-button flex-1" disabled={uploading} onClick={() => void upload(pendingFile)}>Confirmar upload</button><button className="secondary-button" disabled={uploading} onClick={() => { setPendingFile(null); URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>Cancelar</button></div></div>}
    <div className="mt-4 grid grid-cols-2 gap-2">{assets.map((asset) => <button key={asset.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left" onClick={() => void onInsert(asset)} title={`Inserir ${asset.fileName}`}><img src={asset.signedUrl} alt="" className="h-20 w-full object-cover" /><span className="block truncate p-2 text-[10px] font-semibold text-slate-600">{asset.fileName}</span></button>)}</div>
    {!assets.length && <p className="mt-4 text-center text-xs text-slate-400">Sua biblioteca de imagens está vazia.</p>}
  </div>;
}
