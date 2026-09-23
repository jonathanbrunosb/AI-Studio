"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveEditorProjectAction } from "@/app/(protected)/studio/editor/actions";
import type { EditorProject, SaveStatus } from "@/lib/editor/editor-types";
import { projectFingerprint } from "@/lib/editor/editor-serialization";

export function useEditorPersistence(contentId: string, project: EditorProject | null) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(project?.updatedAt ?? null);
  const savedFingerprint = useRef(project ? projectFingerprint(project) : "");
  const latestProject = useRef(project);
  const saving = useRef(false);
  const queued = useRef<{ project: EditorProject; checkpoint: boolean } | null>(null);

  useEffect(() => { latestProject.current = project; }, [project]);

  const persist = useCallback(async (target: EditorProject, checkpoint = false) => {
    if (saving.current) {
      queued.current = { project: target, checkpoint: queued.current?.checkpoint || checkpoint };
      return false;
    }
    saving.current = true;
    let current: { project: EditorProject; checkpoint: boolean } | null = { project: target, checkpoint };
    let firstResult = false;

    try {
      while (current) {
        setStatus("saving");
        const result = await saveEditorProjectAction({ contentId, project: current.project, checkpoint: current.checkpoint });
        if (!firstResult) firstResult = result.ok;
        if (!result.ok) {
          setStatus("error");
          break;
        }
        savedFingerprint.current = projectFingerprint(current.project);
        setLastSavedAt(result.savedAt ?? new Date().toISOString());
        setStatus("saved");
        current = queued.current;
        queued.current = null;
      }
    } catch {
      setStatus("error");
    } finally {
      saving.current = false;
    }
    return firstResult;
  }, [contentId]);

  useEffect(() => {
    if (!project) return;
    const fingerprint = projectFingerprint(project);
    if (fingerprint === savedFingerprint.current) return;
    setStatus("dirty");
    const timeout = window.setTimeout(() => void persist(project), 1800);
    return () => window.clearTimeout(timeout);
  }, [persist, project]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving" || status === "error") event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [status]);

  /** Define a composição carregada do banco como já salva (evita regravar a versão ao apenas abrir o editor). */
  const markBaseline = useCallback((loaded: EditorProject) => {
    savedFingerprint.current = projectFingerprint(loaded);
  }, []);

  const saveNow = useCallback((checkpoint = true) => {
    if (!latestProject.current) return Promise.resolve(false);
    return persist(latestProject.current, checkpoint);
  }, [persist]);

  return { status, lastSavedAt, saveNow, markBaseline };
}
