"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, History, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEditor } from "@/hooks/use-editor";
import { useEditorPersistence } from "@/hooks/use-editor-persistence";
import { editorFormats, type EditorProject, type EditorSeed, type MediaAsset, type TemplateOption, type VersionSummary } from "@/lib/editor/editor-types";
import { clampNumber } from "@/lib/editor/editor-utils";
import { EditorCanvas } from "./editor-canvas";
import { EditorSidebar } from "./editor-sidebar";
import { EditorToolbar } from "./editor-toolbar";
import type { AvailableModel } from "@/lib/ai/models/model-types";
import type { GenerationJobView } from "@/lib/ai/services/job-view";
import { AiPanel, type AiAvailability } from "./ai-panel";
import { ExportDialog } from "./export-dialog";
import { PropertiesPanel } from "./properties-panel";

export function VisualEditor({ contentId, contentTitle, seed, initialProject, initialMedia, initialHistory, templates, userId, aiModels, aiAvailability, initialJobs }: {
  contentId: string; contentTitle: string; seed: EditorSeed; initialProject: EditorProject;
  initialMedia: MediaAsset[]; initialHistory: VersionSummary[]; templates: TemplateOption[]; userId: string;
  aiModels: AvailableModel[]; aiAvailability: AiAvailability; initialJobs: GenerationJobView[];
}) {
  const [rightTab, setRightTab] = useState<"properties" | "ai">("properties");
  const [project, setProject] = useState<EditorProject>(initialProject);
  const [media, setMedia] = useState(initialMedia);
  const [zoom, setZoom] = useState(.45);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const router = useRouter();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const onProjectChange = useCallback((next: EditorProject) => setProject(next), []);
  const editor = useEditor(initialProject, seed, onProjectChange);
  const persistence = useEditorPersistence(contentId, project);

  const canvasWidth = project.canvas.width;
  const canvasHeight = project.canvas.height;

  useEffect(() => {
    const fit = () => {
      const element = workspaceRef.current; if (!element) return;
      const availableWidth = Math.max(280, element.clientWidth - 80);
      const availableHeight = Math.max(420, window.innerHeight - 290);
      setZoom(Math.min(.8, Math.max(.12, Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight))));
    };
    fit(); const observer = new ResizeObserver(fit); if (workspaceRef.current) observer.observe(workspaceRef.current);
    return () => observer.disconnect();
  }, [canvasHeight, canvasWidth, leftOpen, rightOpen]);

  async function saveCheckpoint() {
    const ok = await persistence.saveNow(true);
    if (ok) { router.refresh(); setHistoryOpen(true); }
  }

  /** Garante que não há alterações pendentes antes de abrir o envio para aprovação. */
  async function goToSubmit() {
    const ok = persistence.status === "saved" || await persistence.saveNow(false);
    if (!ok) { window.alert("Não foi possível salvar a composição. Resolva o erro de salvamento antes de enviar."); return; }
    router.push(`/studio?id=${contentId}&submit=1`);
  }

  function resize(width: number, height: number) {
    const nextWidth = clampNumber(Math.round(width), 320, 4096);
    const nextHeight = clampNumber(Math.round(height), 320, 4096);
    if (nextWidth === project.canvas.width && nextHeight === project.canvas.height) return;
    if (window.confirm("Alterar o formato mantém os elementos nas coordenadas atuais. Deseja continuar?")) editor.resizeCanvas(nextWidth, nextHeight);
  }

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
    <EditorToolbar status={persistence.status} zoom={zoom} canUndo={editor.canUndo} canRedo={editor.canRedo}
      onZoom={setZoom} onUndo={() => void editor.undo()} onRedo={() => void editor.redo()}
      onDuplicate={() => void editor.duplicateSelected()} onDelete={editor.removeSelected} onGroup={editor.groupSelected}
      onSave={() => void saveCheckpoint()} onExport={() => setExportOpen(true)} />
    <div className="flex h-[calc(100vh-235px)] min-h-[620px]">
      <div className={`${leftOpen ? "block" : "hidden"} absolute z-20 h-[calc(100vh-235px)] shadow-xl lg:relative lg:block lg:shadow-none`}>
        <EditorSidebar contentId={contentId} userId={userId} media={media} templates={templates} layers={editor.layers}
          onMedia={(asset) => setMedia((current) => [asset, ...current])} onImage={(asset) => void editor.addImage(asset)}
          onText={editor.addText} onShape={editor.addShape} onLayerSelect={editor.selectLayer} onLayerAction={editor.mutateLayer}
          onTemplate={(template, width, height) => void editor.applyTemplate(template, width, height)} />
      </div>
      <button className="z-30 grid w-7 shrink-0 place-items-center border-r border-slate-200 bg-white text-slate-400 hover:text-blue-700" onClick={() => setLeftOpen((value) => !value)} title="Recolher ferramentas">{leftOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</button>
      <div ref={workspaceRef} className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          {Object.entries(editorFormats).map(([key, format]) => <button key={key} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${project.canvas.width === format.width && project.canvas.height === format.height ? "bg-blue-700 text-white" : "bg-white text-slate-600"}`} onClick={() => resize(format.width, format.height)}>{format.label}</button>)}
          <button className="ml-auto flex items-center gap-1 text-xs font-bold text-slate-600" onClick={() => setHistoryOpen((value) => !value)}><History size={14} />Histórico</button>
          <button className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-800 disabled:bg-slate-300" disabled={persistence.status === "saving"} onClick={() => void goToSubmit()} title="Salva a composição e abre a confirmação de envio"><Send size={13} />Enviar para aprovação</button>
        </div>
        {historyOpen && <div className="absolute right-3 top-12 z-40 max-h-80 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-bold text-slate-700">Versões salvas</p>{initialHistory.map((version) => <button key={version.id} disabled={!version.project} onClick={() => { if (version.project && window.confirm("Recuperar esta composição? A versão atual permanecerá no histórico de desfazer.")) { void editor.loadProject(version.project); setHistoryOpen(false); } }} className="mb-1 w-full rounded-lg p-2 text-left hover:bg-slate-50 disabled:opacity-50"><span className="block text-xs font-bold">v{version.versionNumber} · {version.label ?? version.kind}</span><span className="text-[10px] text-slate-400">{new Date(version.updatedAt).toLocaleString("pt-BR")}</span></button>)}{!initialHistory.length && <p className="p-3 text-center text-xs text-slate-400">O primeiro salvamento criará o histórico.</p>}</div>}
        <EditorCanvas canvasRef={editor.elementRef} width={project.canvas.width} height={project.canvas.height} zoom={zoom} />
      </div>
      <button className="z-30 grid w-7 shrink-0 place-items-center border-l border-slate-200 bg-white text-slate-400 hover:text-blue-700" onClick={() => setRightOpen((value) => !value)} title="Recolher propriedades">{rightOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
      <div className={`${rightOpen ? "block" : "hidden"} absolute right-0 z-20 h-[calc(100vh-235px)] shadow-xl xl:relative xl:block xl:shadow-none`}>
        <div className="flex h-full flex-col bg-white">
          <div role="tablist" className="flex shrink-0 border-b border-l border-slate-200">
            <button role="tab" aria-selected={rightTab === "properties"} onClick={() => setRightTab("properties")} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold ${rightTab === "properties" ? "border-b-2 border-blue-700 text-blue-700" : "text-slate-500"}`}><SlidersHorizontal size={13} />Propriedades</button>
            <button role="tab" aria-selected={rightTab === "ai"} onClick={() => setRightTab("ai")} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold ${rightTab === "ai" ? "border-b-2 border-blue-700 text-blue-700" : "text-slate-500"}`}><Sparkles size={13} />Geração com IA</button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className={rightTab === "properties" ? "flex h-full" : "hidden"}><PropertiesPanel selected={editor.selected} project={project} onUpdate={editor.updateSelected} onBackground={editor.setBackground} onResize={resize} /></div>
            <div className={rightTab === "ai" ? "h-full w-[320px] overflow-y-auto border-l border-slate-200 p-4" : "hidden"}>
              <AiPanel contentId={contentId} models={aiModels} availability={aiAvailability} initialJobs={initialJobs} library={media}
                onInsert={(asset) => void editor.addImage(asset)} onBackground={(asset) => void editor.setBackgroundImage(asset)}
                onLibraryAdd={(asset) => setMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)])} />
            </div>
          </div>
        </div>
      </div>
    </div>
    {persistence.status === "error" && <div role="alert" className="flex items-center justify-between bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><span>As alterações continuam nesta sessão, mas não foram salvas.</span><button className="underline" onClick={() => void persistence.saveNow(false)}>Tentar novamente</button></div>}
    <ExportDialog open={exportOpen} title={contentTitle} canvas={editor.getCanvas()} onClose={() => setExportOpen(false)} />
  </section>;
}
