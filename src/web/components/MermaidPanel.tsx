import React, {useState} from "react";
import type {ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";

import {convertMermaidToExcalidraw, generateMermaid} from "../../sdk/ai/client";
import {isConfigReady, loadAppConfig} from "../../sdk/ai/config";

export type MermaidPanelProps = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onRequireConfig: () => void;
};

export const MermaidPanel: React.FC<MermaidPanelProps> = ({excalidrawAPI, onRequireConfig}) => {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleGenerate = async () => {
    const config = await loadAppConfig();
    if (!isConfigReady(config)) {
      setStatus("Please configure a provider first.");
      onRequireConfig();
      return;
    }

    if (!prompt.trim()) return;
    setIsBusy(true);
    setStatus(null);
    try {
      const result = await generateMermaid(prompt);
      setCode(result.code);
    } catch (error: any) {
      setStatus(error?.message || "Failed to generate Mermaid.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleApply = async () => {
    if (!code.trim() || !excalidrawAPI) return;
    setIsBusy(true);
    setStatus(null);
    try {
      const isDark = excalidrawAPI.getAppState()?.theme === "dark";
      const preferredStrokeColor =
        excalidrawAPI.getAppState()?.currentItemStrokeColor || "#1e1e1e";
      const result = await convertMermaidToExcalidraw(code, {isDark, preferredStrokeColor});
      
      // 获取当前元素
      const currentElements = excalidrawAPI.getSceneElements();
      const allElements = [...currentElements, ...result.elements];
      
      // 准备选中的元素 ID
      const selectedElementIds: Record<string, true> = {};
      result.elements.forEach(el => {
        selectedElementIds[el.id] = true;
      });
      
      // 添加文件
      if (result.files) {
        excalidrawAPI.addFiles?.(Object.values(result.files));
      }
      
      // 更新场景并选中元素
      console.log('[Mermaid] Inserting elements:', result.elements.length, 'Selected IDs:', Object.keys(selectedElementIds));
      excalidrawAPI.updateScene({
        elements: allElements,
        appState: {
          selectedElementIds: selectedElementIds
        }
      });
      
      // 滚动到新元素
      excalidrawAPI.scrollToContent?.(result.elements);
    } catch (error: any) {
      setStatus(error?.message || "Failed to apply Mermaid.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-sm text-slate-700 dark:text-slate-200">
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Prompt</label>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the diagram and generate Mermaid..."
        rows={3}
        className="input-scroll w-full resize-none rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20"
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isBusy}
        >
          Generate Mermaid
        </button>
      </div>

      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Mermaid</label>
      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Mermaid code will appear here"
        rows={8}
        className="input-scroll w-full flex-1 resize-none rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-800 outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20"
      />
      <div className="flex flex-wrap justify-between gap-2">
        <button
          className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
          type="button"
          onClick={() => setCode("")}
        >
          Clear
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-20px_rgba(14,116,144,0.55)] transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={() => void handleApply()}
          disabled={isBusy}
        >
          Apply to canvas
        </button>
      </div>
      {status && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {status}
        </div>
      )}
    </div>
  );
};
