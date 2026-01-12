import React, {useState} from "react";
import type {ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";
import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";

import {applyDslChanges, generateDslEdit} from "../../sdk/ai/client";
import {isConfigReady, loadAppConfig} from "../../sdk/ai/config";
import {convertJsonToDsl, type DSLCompressedDocument} from "../../sdk/dsl";

export type DslPanelProps = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onRequireConfig: () => void;
};

export const DslPanel: React.FC<DslPanelProps> = ({excalidrawAPI, onRequireConfig}) => {
  const [prompt, setPrompt] = useState("");
  const [dslText, setDslText] = useState("");
  const [referenceDoc, setReferenceDoc] = useState<DSLCompressedDocument | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const captureSnapshot = () => {
    if (!excalidrawAPI) return;
    const elements = (excalidrawAPI.getSceneElements?.() || []) as ExcalidrawElement[];
    const snapshot = convertJsonToDsl(elements);
    setReferenceDoc(snapshot.document);
    setDslText(snapshot.dsl);
    setStatus("Snapshot captured.");
  };

  const handleGenerate = async () => {
    if (!excalidrawAPI) return;
    const config = await loadAppConfig();
    if (!isConfigReady(config)) {
      setStatus("Please configure a provider first.");
      onRequireConfig();
      return;
    }

    const elements = (excalidrawAPI.getSceneElements?.() || []) as ExcalidrawElement[];
    if (!elements.length) {
      setStatus("No elements on canvas.");
      return;
    }

    if (!prompt.trim()) return;
    setIsBusy(true);
    setStatus(null);

    try {
      const result = await generateDslEdit(elements, prompt);
      setReferenceDoc(result.document);
      setDslText(result.dsl);
    } catch (error: any) {
      setStatus(error?.message || "Failed to generate DSL.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleApply = async () => {
    if (!excalidrawAPI || !referenceDoc) {
      setStatus("Capture a snapshot first.");
      return;
    }
    if (!dslText.trim()) return;

    setIsBusy(true);
    setStatus(null);
    try {
      const isDark = excalidrawAPI.getAppState()?.theme === "dark";
      const preferredStrokeColor =
        excalidrawAPI.getAppState()?.currentItemStrokeColor || "#1e1e1e";
      const nextElements = await applyDslChanges(dslText, referenceDoc, {
        isDark,
        preferredStrokeColor,
      });
      excalidrawAPI.updateScene({elements: nextElements});
      excalidrawAPI.scrollToContent?.(nextElements);
    } catch (error: any) {
      setStatus(error?.message || "Failed to apply DSL.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-sm text-slate-700 dark:text-slate-200">
      <div>
        <button
          className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
          type="button"
          onClick={captureSnapshot}
        >
          Capture snapshot
        </button>
      </div>

      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Edit prompt</label>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the DSL edits you want..."
        rows={3}
        className="input-scroll w-full resize-none rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20"
      />
      <button
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
        type="button"
        onClick={() => void handleGenerate()}
        disabled={isBusy}
      >
        Generate DSL
      </button>

      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">DSL</label>
      <textarea
        value={dslText}
        onChange={(event) => setDslText(event.target.value)}
        placeholder="DSL output"
        rows={8}
        className="input-scroll w-full flex-1 resize-none rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-800 outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20"
      />

      <div className="flex flex-wrap justify-between gap-2">
        <button
          className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
          type="button"
          onClick={() => setDslText("")}
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
