"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveSelection, Canvas, Circle, FabricImage, FabricObject, Group, Line, Rect, Textbox,
} from "fabric";
import "@/lib/editor/fabric-setup";
import type { EditorProject, EditorSeed, MediaAsset, TemplateOption } from "@/lib/editor/editor-types";
import { createEditorId, EDITOR_CUSTOM_PROPERTIES, getInitialSeedElements } from "@/lib/editor/editor-utils";
import { serializeCanvas } from "@/lib/editor/editor-serialization";
import { useEditorHistory } from "./use-editor-history";

export type EditorFabricObject = FabricObject & {
  editorId?: string; name?: string; storagePath?: string; assetId?: string; locked?: boolean; role?: string;
};

export type LayerItem = {
  id: string; name: string; type: string; visible: boolean; locked: boolean;
};

export type SelectedProperties = {
  id: string; type: string; name: string; left: number; top: number; width: number; height: number;
  angle: number; opacity: number; fill: string; stroke: string; strokeWidth: number;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: string | number;
  fontStyle?: string; textAlign?: string; charSpacing?: number;
};

function decorate<T extends FabricObject>(object: T, name: string, prefix: string): T {
  Object.assign(object, { editorId: createEditorId(prefix), name, locked: false });
  return object;
}

export function useEditor(initialProject: EditorProject, seed: EditorSeed, onProjectChange: (project: EditorProject, meta?: { initial?: boolean }) => void) {
  const elementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const projectRef = useRef(initialProject);
  const restoring = useRef(false);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selected, setSelected] = useState<SelectedProperties | null>(null);

  const readSelected = useCallback(() => {
    const canvas = canvasRef.current;
    const object = canvas?.getActiveObject() as EditorFabricObject | undefined;
    if (!canvas || !object || object instanceof ActiveSelection) { setSelected(null); return; }
    const text = object instanceof Textbox ? object : null;
    setSelected({
      id: object.editorId ?? "", type: object.type, name: object.name ?? object.type,
      left: Math.round(object.left), top: Math.round(object.top),
      width: Math.round(object.getScaledWidth()), height: Math.round(object.getScaledHeight()),
      angle: Math.round(object.angle), opacity: object.opacity,
      fill: typeof object.fill === "string" ? object.fill : "#1769aa",
      stroke: typeof object.stroke === "string" ? object.stroke : "#0b2b50",
      strokeWidth: object.strokeWidth,
      ...(text ? { text: text.text, fontFamily: text.fontFamily, fontSize: text.fontSize,
        fontWeight: text.fontWeight, fontStyle: text.fontStyle, textAlign: text.textAlign,
        charSpacing: text.charSpacing } : {}),
    });
  }, []);

  const readLayers = useCallback(() => {
    const objects = canvasRef.current?.getObjects() as EditorFabricObject[] | undefined;
    setLayers((objects ?? []).slice().reverse().map((object) => ({
      id: object.editorId ?? "", name: object.name ?? object.type, type: object.type,
      visible: object.visible, locked: Boolean(object.locked),
    })));
  }, []);

  const restoreSnapshot = useCallback(async (snapshot: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const project = JSON.parse(snapshot) as EditorProject;
    restoring.current = true;
    canvas.setDimensions({ width: project.canvas.width, height: project.canvas.height });
    canvas.backgroundColor = project.canvas.backgroundColor;
    await canvas.loadFromJSON({ objects: project.elements });
    canvas.requestRenderAll();
    projectRef.current = project;
    onProjectChange(project);
    readLayers(); readSelected();
    restoring.current = false;
  }, [onProjectChange, readLayers, readSelected]);

  const history = useEditorHistory(restoreSnapshot);

  const commit = useCallback((record = true) => {
    const canvas = canvasRef.current;
    if (!canvas || restoring.current) return;
    const project = serializeCanvas(canvas, projectRef.current);
    projectRef.current = project;
    onProjectChange(project);
    readLayers(); readSelected();
    if (record) history.record(JSON.stringify(project));
  }, [history, onProjectChange, readLayers, readSelected]);

  const seedCanvas = useCallback((canvas: Canvas, project: EditorProject) => {
    // `type` é somente leitura no Fabric 7: repassá-lo ao construtor lança exceção e interrompe a inicialização.
    const [bar, title, subtitle, body, footer] = getInitialSeedElements(seed, project.canvas.width, project.canvas.height)
      .map((element) => Object.fromEntries(Object.entries(element).filter(([key]) => key !== "type")));
    const objects = [
      decorate(new Rect(bar), String(bar.name), "brand"),
      decorate(new Textbox(String(title.text), title), String(title.name), "title"),
      decorate(new Textbox(String(subtitle.text), subtitle), String(subtitle.name), "subtitle"),
      decorate(new Textbox(String(body.text), body), String(body.name), "body"),
      decorate(new Textbox(String(footer.text), footer), String(footer.name), "footer"),
    ];
    canvas.add(...objects);
  }, [seed]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || canvasRef.current) return;
    const canvas = new Canvas(element, {
      width: initialProject.canvas.width, height: initialProject.canvas.height,
      backgroundColor: initialProject.canvas.backgroundColor, preserveObjectStacking: true,
      selectionColor: "rgba(23,105,170,.12)", selectionBorderColor: "#1769aa",
    });
    canvasRef.current = canvas;
    restoring.current = true;
    const initialize = async () => {
      if (initialProject.elements.length) await canvas.loadFromJSON({ objects: initialProject.elements });
      else seedCanvas(canvas, initialProject);
      canvas.requestRenderAll();
      restoring.current = false;
      const project = serializeCanvas(canvas, initialProject);
      projectRef.current = project;
      onProjectChange(project, { initial: true });
      history.reset(JSON.stringify(project));
      readLayers(); setReady(true);
    };
    void initialize();
    const select = () => readSelected();
    const changed = () => commit(true);
    canvas.on("selection:created", select); canvas.on("selection:updated", select); canvas.on("selection:cleared", select);
    canvas.on("object:modified", changed); canvas.on("text:changed", changed);
    return () => { canvas.dispose(); canvasRef.current = null; };
  // Initial project is intentionally loaded once for the editor session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addText = useCallback((kind: "title" | "subtitle" | "body") => {
    const canvas = canvasRef.current; if (!canvas) return;
    const sizes = { title: 72, subtitle: 42, body: 30 };
    const labels = { title: "Novo título", subtitle: "Novo subtítulo", body: "Nova caixa de texto" };
    const object = decorate(new Textbox(labels[kind], {
      left: canvas.getWidth() * .15, top: canvas.getHeight() * .2, width: canvas.getWidth() * .7,
      fontFamily: seed.fontFamily, fontSize: sizes[kind], fill: seed.primaryColor,
      fontWeight: kind === "title" ? "bold" : "normal",
    }), labels[kind], kind);
    canvas.add(object); canvas.setActiveObject(object); canvas.requestRenderAll(); commit();
  }, [commit, seed]);

  const addShape = useCallback((kind: "rect" | "circle" | "line") => {
    const canvas = canvasRef.current; if (!canvas) return;
    const common = { left: canvas.getWidth() * .25, top: canvas.getHeight() * .25 };
    const object = kind === "circle"
      ? decorate(new Circle({ ...common, radius: 120, fill: seed.accentColor }), "Círculo", "circle")
      : kind === "line"
        ? decorate(new Line([0, 0, 420, 0], { ...common, stroke: seed.accentColor, strokeWidth: 8 }), "Linha", "line")
        : decorate(new Rect({ ...common, width: 420, height: 220, rx: 12, ry: 12, fill: seed.accentColor }), "Retângulo", "rect");
    canvas.add(object); canvas.setActiveObject(object); canvas.requestRenderAll(); commit();
  }, [commit, seed]);

  const addImage = useCallback(async (asset: MediaAsset) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const image = await FabricImage.fromURL(asset.signedUrl, { crossOrigin: "anonymous" });
    image.set({ left: canvas.getWidth() * .2, top: canvas.getHeight() * .2 });
    if (image.width > canvas.getWidth() * .6) image.scaleToWidth(canvas.getWidth() * .6);
    Object.assign(image, { editorId: createEditorId("image"), name: asset.fileName, storagePath: asset.storagePath, assetId: asset.id, locked: false });
    canvas.add(image); canvas.setActiveObject(image); canvas.requestRenderAll(); commit();
  }, [commit]);

  /** Aplica a imagem como plano de fundo (camada inferior, cobrindo o canvas) sem remover os demais elementos. */
  const setBackgroundImage = useCallback(async (asset: MediaAsset) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const image = await FabricImage.fromURL(asset.signedUrl, { crossOrigin: "anonymous" });
    const scale = Math.max(canvas.getWidth() / image.width, canvas.getHeight() / image.height);
    image.set({ scaleX: scale, scaleY: scale, left: (canvas.getWidth() - image.width * scale) / 2, top: (canvas.getHeight() - image.height * scale) / 2 });
    const previous = (canvas.getObjects() as EditorFabricObject[]).filter((object) => object.role === "background");
    if (previous.length) canvas.remove(...previous);
    Object.assign(image, { editorId: createEditorId("background"), name: `Plano de fundo · ${asset.fileName}`, storagePath: asset.storagePath, assetId: asset.id, locked: false, role: "background" });
    canvas.add(image); canvas.sendObjectToBack(image); canvas.setActiveObject(image); canvas.requestRenderAll(); commit();
  }, [commit]);

  const removeSelected = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const objects = canvas.getActiveObjects(); if (!objects.length) return;
    canvas.discardActiveObject(); canvas.remove(...objects); canvas.requestRenderAll(); commit();
  }, [commit]);

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current; const active = canvas?.getActiveObject(); if (!canvas || !active) return;
    const clone = await active.clone(EDITOR_CUSTOM_PROPERTIES) as EditorFabricObject;
    clone.set({ left: active.left + 30, top: active.top + 30 });
    Object.assign(clone, { editorId: createEditorId("copy"), name: `${(active as EditorFabricObject).name ?? active.type} · cópia` });
    canvas.add(clone); canvas.setActiveObject(clone); canvas.requestRenderAll(); commit();
  }, [commit]);

  const groupSelected = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const objects = canvas.getActiveObjects(); if (objects.length < 2) return;
    canvas.discardActiveObject(); canvas.remove(...objects);
    const group = decorate(new Group(objects), "Grupo", "group");
    canvas.add(group); canvas.setActiveObject(group); canvas.requestRenderAll(); commit();
  }, [commit]);

  const updateSelected = useCallback((changes: Record<string, unknown>) => {
    const canvas = canvasRef.current; const object = canvas?.getActiveObject() as EditorFabricObject | undefined;
    if (!canvas || !object) return;
    const next = { ...changes };
    if (typeof next.width === "number" && object.width) { next.scaleX = next.width / object.width; delete next.width; }
    if (typeof next.height === "number" && object.height) { next.scaleY = next.height / object.height; delete next.height; }
    object.set(next); object.setCoords(); canvas.requestRenderAll(); commit();
  }, [commit]);

  const selectLayer = useCallback((id: string) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const object = (canvas.getObjects() as EditorFabricObject[]).find((item) => item.editorId === id);
    if (object) { canvas.setActiveObject(object); canvas.requestRenderAll(); readSelected(); }
  }, [readSelected]);

  const mutateLayer = useCallback((id: string, action: "visibility" | "lock" | "front" | "back" | "delete") => {
    const canvas = canvasRef.current; if (!canvas) return;
    const object = (canvas.getObjects() as EditorFabricObject[]).find((item) => item.editorId === id); if (!object) return;
    if (action === "visibility") object.set("visible", !object.visible);
    if (action === "lock") { const locked = !object.locked; Object.assign(object, { locked }); object.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked }); }
    if (action === "front") canvas.bringObjectToFront(object);
    if (action === "back") canvas.sendObjectToBack(object);
    if (action === "delete") canvas.remove(object);
    canvas.discardActiveObject(); canvas.requestRenderAll(); commit();
  }, [commit]);

  const resizeCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.setDimensions({ width, height }); canvas.requestRenderAll(); commit();
  }, [commit]);

  const setBackground = useCallback((color: string) => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.backgroundColor = color; canvas.requestRenderAll(); commit();
  }, [commit]);

  const applyTemplate = useCallback(async (template: TemplateOption, width: number, height: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const templateSnapshot = template.configuration && typeof template.configuration === "object"
      ? structuredClone(template.configuration as Record<string, unknown>)
      : {};
    projectRef.current = {
      ...projectRef.current,
      templateId: template.id,
      templateSnapshot,
      canvas: { width, height, backgroundColor: "#ffffff" },
      elements: [],
    };
    restoring.current = true; canvas.clear(); canvas.setDimensions({ width, height }); canvas.backgroundColor = "#ffffff";
    seedCanvas(canvas, { ...projectRef.current, canvas: { width, height, backgroundColor: "#ffffff" }, elements: [] });
    canvas.requestRenderAll(); restoring.current = false; commit();
  }, [commit, seedCanvas]);

  const getCanvas = useCallback(() => canvasRef.current, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      const activeObject = canvasRef.current?.getActiveObject();
      if (activeObject instanceof Textbox && activeObject.isEditing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); void (event.shiftKey ? history.redo() : history.undo()); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); void history.redo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); void duplicateSelected(); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duplicateSelected, history, removeSelected]);

  return {
    elementRef, ready, layers, selected, addText, addShape, addImage, setBackgroundImage, removeSelected,
    duplicateSelected, groupSelected, updateSelected, selectLayer, mutateLayer,
    resizeCanvas, setBackground, applyTemplate, getCanvas,
    loadProject: (project: EditorProject) => restoreSnapshot(JSON.stringify(project)),
    undo: history.undo, redo: history.redo, canUndo: history.canUndo, canRedo: history.canRedo,
  };
}
