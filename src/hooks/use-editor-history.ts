"use client";

import { useCallback, useRef, useState } from "react";

export function useEditorHistory(onRestore: (snapshot: string) => Promise<void>) {
  const history = useRef<string[]>([]);
  const index = useRef(-1);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  const sync = useCallback(() => setAvailability({
    canUndo: index.current > 0,
    canRedo: index.current >= 0 && index.current < history.current.length - 1,
  }), []);

  const record = useCallback((snapshot: string) => {
    if (history.current[index.current] === snapshot) return;
    history.current = history.current.slice(0, index.current + 1);
    history.current.push(snapshot);
    if (history.current.length > 50) history.current.shift();
    index.current = history.current.length - 1;
    sync();
  }, [sync]);

  const reset = useCallback((snapshot: string) => {
    history.current = [snapshot];
    index.current = 0;
    sync();
  }, [sync]);

  const undo = useCallback(async () => {
    if (index.current <= 0) return;
    index.current -= 1;
    await onRestore(history.current[index.current]);
    sync();
  }, [onRestore, sync]);

  const redo = useCallback(async () => {
    if (index.current >= history.current.length - 1) return;
    index.current += 1;
    await onRestore(history.current[index.current]);
    sync();
  }, [onRestore, sync]);

  return { ...availability, record, reset, undo, redo };
}
