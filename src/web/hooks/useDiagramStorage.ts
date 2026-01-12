import {useCallback, useEffect, useRef, useState} from "react";
import {nanoid} from "nanoid";

import type {DiagramData, DiagramType} from "../../sdk/types";
import {
  legacyStorageKeys,
  readJson,
  readStringWithFallback,
  removeItem,
  storageKeys,
  writeJson,
  writeString,
} from "../../storage";

const SAVE_DEBOUNCE_MS = 15000;

const readLastDiagramId = (): string | undefined => {
  const value = readStringWithFallback(
    storageKeys.lastDiagramId,
    [legacyStorageKeys.lastDiagramId]
  );
  return value ?? undefined;
};

const persistLastDiagramId = (id?: string) => {
  if (id) {
    writeString(storageKeys.lastDiagramId, id);
  } else {
    removeItem(storageKeys.lastDiagramId);
  }
};

const readDiagram = (id: string): DiagramData | null => {
  return readJson<DiagramData | null>(storageKeys.diagram(id), null);
};

const writeDiagram = (diagram: DiagramData): void => {
  writeJson(storageKeys.diagram(diagram.id), diagram);
};

const removeDiagram = (id: string): void => {
  removeItem(storageKeys.diagram(id));
};

export interface SaveDiagramOptions {
  generatePreview?: boolean;
  debounceMs?: number;
}

export type SaveDiagramPayload = Partial<
  Omit<DiagramData, "id" | "createdAt" | "updatedAt" | "version" | "elementCount" | "preview">
> & {
  preview?: string | null;
  elements?: DiagramData["elements"];
  appState?: DiagramData["appState"];
  files?: DiagramData["files"];
  type?: DiagramType;
};

interface UseDiagramStorageState {
  diagram: DiagramData | null;
  loading: boolean;
  error: Error | null;
  saveDiagram: (payload: SaveDiagramPayload, options?: SaveDiagramOptions) => Promise<DiagramData>;
  deleteDiagram: () => Promise<void>;
  refresh: () => Promise<void>;
  resolvedId: string | undefined;
}

export function useDiagramStorage(diagramId?: string): UseDiagramStorageState {
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(diagramId));
  const [error, setError] = useState<Error | null>(null);
  const currentIdRef = useRef<string | undefined>(diagramId);
  const diagramRef = useRef<DiagramData | null>(null);

  useEffect(() => {
    currentIdRef.current = diagramId;
  }, [diagramId]);

  useEffect(() => {
    diagramRef.current = diagram;
  }, [diagram]);

  const emitDiagramUpdated = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(
        new CustomEvent("diagram-updated", {
          detail: {diagramId: id},
        })
      );
    } catch {
      // ignore
    }
  }, []);

  const loadDiagram = useCallback(async (targetId?: string) => {
    const idToLoad = targetId ?? currentIdRef.current;
    if (!idToLoad) {
      setDiagram(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = readDiagram(idToLoad);
      setDiagram(data);
      currentIdRef.current = data?.id || idToLoad;
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (diagramId) {
        persistLastDiagramId(diagramId);
        await loadDiagram(diagramId);
        return;
      }

      const cachedId = readLastDiagramId();
      if (cachedId) {
        currentIdRef.current = cachedId;
        await loadDiagram(cachedId);
        return;
      }

      if (!cancelled) {
        setDiagram(null);
        setLoading(false);
      }
    };

    bootstrap().catch((err) => {
      if (!cancelled) {
        setError(err as Error);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [diagramId, loadDiagram]);

  const buildDiagramPayload = useCallback(
    async (payload: SaveDiagramPayload, options: SaveDiagramOptions = {}): Promise<DiagramData> => {
      const existing = diagramRef.current;
      const now = Date.now();
      const id = existing?.id || currentIdRef.current || nanoid();

      const next: DiagramData = {
        id,
        title: payload.title?.trim() ? payload.title.trim() : existing?.title || "Untitled diagram",
        type: payload.type || existing?.type || "flowchart",
        sessionId: payload.sessionId ?? existing?.sessionId,
        elements: payload.elements ?? existing?.elements ?? [],
        appState: payload.appState ?? existing?.appState ?? {},
        files: payload.files ?? existing?.files,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        version: (existing?.version ?? 0) + 1,
        elementCount: payload.elements?.length ?? existing?.elementCount ?? existing?.elements?.length ?? 0,
        preview: payload.preview === null ? undefined : payload.preview ?? existing?.preview,
        generatedBy: payload.generatedBy ?? existing?.generatedBy,
        mermaidDefinition: payload.mermaidDefinition ?? existing?.mermaidDefinition,
        aiProviderUsed: payload.aiProviderUsed ?? existing?.aiProviderUsed,
        aiModelUsed: payload.aiModelUsed ?? existing?.aiModelUsed,
        aiGenerationTime: payload.aiGenerationTime ?? existing?.aiGenerationTime,
        aiTokensUsed: payload.aiTokensUsed ?? existing?.aiTokensUsed,
        aiCostUsd: payload.aiCostUsd ?? existing?.aiCostUsd,
      };

      if (options.generatePreview) {
        next.preview = next.preview ?? existing?.preview;
      }

      return next;
    },
    []
  );

  const saveImmediately = useCallback(
    async (payload: SaveDiagramPayload, options?: SaveDiagramOptions): Promise<DiagramData> => {
      try {
        const next = await buildDiagramPayload(payload, options);
        writeDiagram(next);
        persistLastDiagramId(next.id);

        setDiagram(next);
        diagramRef.current = next;
        currentIdRef.current = next.id;
        setError(null);
        emitDiagramUpdated(next.id);
        return next;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [buildDiagramPayload, emitDiagramUpdated]
  );

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{
    payload: SaveDiagramPayload;
    options?: SaveDiagramOptions;
    resolvers: Array<{
      resolve: (value: DiagramData) => void;
      reject: (reason?: unknown) => void;
    }>;
  } | null>(null);

  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    debounceTimerRef.current = null;

    try {
      const result = await saveImmediately(pending.payload, pending.options);
      pending.resolvers.forEach(({resolve}) => resolve(result));
    } catch (err) {
      pending.resolvers.forEach(({reject}) => reject(err));
    }
  }, [saveImmediately]);

  const saveDiagram = useCallback(
    (payload: SaveDiagramPayload, options?: SaveDiagramOptions) => {
      return new Promise<DiagramData>((resolve, reject) => {
        if (pendingSaveRef.current) {
          pendingSaveRef.current.payload = payload;
          pendingSaveRef.current.options = options;
          pendingSaveRef.current.resolvers.push({resolve, reject});
        } else {
          pendingSaveRef.current = {
            payload,
            options,
            resolvers: [{resolve, reject}],
          };
        }

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          flushPendingSave().catch(() => {
            // ignore
          });
        }, options?.debounceMs ?? SAVE_DEBOUNCE_MS);
      });
    },
    [flushPendingSave]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (pendingSaveRef.current) {
        flushPendingSave().catch(() => {
          /* ignore */
        });
      }
    };
  }, [flushPendingSave]);

  const deleteDiagram = useCallback(async () => {
    const id = currentIdRef.current;
    if (!id) return;

    try {
      removeDiagram(id);
      if (readLastDiagramId() === id) {
        persistLastDiagramId(undefined);
      }
      setDiagram(null);
      diagramRef.current = null;
      currentIdRef.current = undefined;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadDiagram();
  }, [loadDiagram]);

  return {
    diagram,
    loading,
    error,
    saveDiagram,
    deleteDiagram,
    refresh,
    resolvedId: currentIdRef.current,
  };
}
