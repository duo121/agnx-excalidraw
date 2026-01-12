import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Excalidraw} from "@excalidraw/excalidraw";
import type {AppState, BinaryFiles, ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";
import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";

import {useDiagramStorage, type SaveDiagramPayload} from "../hooks/useDiagramStorage";

const SAVE_INTERVAL_MS = 10_000;

export type ExcalidrawCanvasProps = {
  diagramId: string;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
};

export const ExcalidrawCanvas: React.FC<ExcalidrawCanvasProps> = ({diagramId, onApiReady}) => {
  const {diagram, loading, saveDiagram} = useDiagramStorage(diagramId);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const lastAppliedVersionRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<SaveDiagramPayload | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveAtRef = useRef<number>(0);
  // 用于在 diagram 加载完成后强制重新挂载 Excalidraw，确保 initialData 被正确应用
  const [mountKey, setMountKey] = useState(0);
  const hasInitializedRef = useRef(false);

  const normalizeAppState = useCallback((appState?: Partial<AppState>) => {
    const nextState = {...(appState || {})} as AppState;
    const collaborators = (nextState as any).collaborators;
    if (!collaborators || typeof collaborators.forEach !== "function") {
      (nextState as any).collaborators = new Map();
    }
    return nextState;
  }, []);

  const sanitizeAppStateForStorage = useCallback((appState: AppState) => {
    const nextState: any = {...appState};
    if ("collaborators" in nextState) {
      delete nextState.collaborators;
    }
    return nextState as AppState;
  }, []);

  useEffect(() => {
    onApiReady?.(excalidrawAPI);
  }, [excalidrawAPI, onApiReady]);

  // 当 diagram 首次加载完成时，强制重新挂载 Excalidraw 以应用正确的 initialData
  useEffect(() => {
    if (!loading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // 设置页面主题
      const theme = diagram?.appState?.theme || "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", theme === "dark");
      }
      // 如果已经有 diagram，重新挂载 Excalidraw
      if (diagram) {
        setMountKey((k) => k + 1);
      }
    }
  }, [loading, diagram]);

  useEffect(() => {
    if (!diagram || !excalidrawAPI) return;
    if (lastAppliedVersionRef.current === diagram.version) return;

    // 确保主题被正确应用（如果没有保存主题则默认深色）
    const savedTheme = diagram.appState?.theme || "dark";
    const nextAppState = normalizeAppState({
      ...diagram.appState,
      theme: savedTheme,
    });
    
    // 同步更新 HTML class
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
    
    const fileEntries = diagram.files ? Object.values(diagram.files) : [];
    if (fileEntries.length > 0) {
      excalidrawAPI.addFiles(fileEntries);
    }
    excalidrawAPI.updateScene({
      elements: diagram.elements as ExcalidrawElement[],
      appState: nextAppState,
    });
    lastAppliedVersionRef.current = diagram.version;
  }, [diagram, excalidrawAPI, normalizeAppState]);

  const initialData = useMemo(() => {
    if (!diagram) {
      // 新图表默认使用深色主题
      return {
        appState: normalizeAppState({theme: "dark"}),
      };
    }
    return {
      elements: diagram.elements,
      appState: normalizeAppState({
        ...diagram.appState,
        // 如果没有保存过主题，默认使用深色
        theme: diagram.appState?.theme || "dark",
      }),
      files: diagram.files,
    };
  }, [diagram, normalizeAppState]);

  const flushPendingSave = useCallback(() => {
    const payload = pendingSaveRef.current;
    if (!payload) return;
    pendingSaveRef.current = null;
    lastSaveAtRef.current = Date.now();
    void saveDiagram(payload, {generatePreview: false, debounceMs: 0});
  }, [saveDiagram]);

  const scheduleSave = useCallback((delay: number) => {
    if (saveTimerRef.current) return;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushPendingSave();
    }, delay);
  }, [flushPendingSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", appState.theme === "dark");
      }
      const storageAppState = sanitizeAppStateForStorage(appState);
      pendingSaveRef.current = {
        elements: [...elements],
        appState: {...storageAppState},
        files: {...files},
      };

      const elapsed = Date.now() - lastSaveAtRef.current;
      if (elapsed >= SAVE_INTERVAL_MS) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        flushPendingSave();
      } else {
        scheduleSave(SAVE_INTERVAL_MS - elapsed);
      }
    },
    [flushPendingSave, scheduleSave, sanitizeAppStateForStorage]
  );

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute left-4 top-4 z-10 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs text-gray-700 shadow-sm">
          Loading diagram...
        </div>
      )}
      <Excalidraw
        key={mountKey}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        langCode="en"
      />
    </div>
  );
};
