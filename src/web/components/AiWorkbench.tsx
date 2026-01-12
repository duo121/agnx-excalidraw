import React, {useState} from "react";
import type {ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";
import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";
import {X} from "lucide-react";

import {AIToolbar} from "./AIToolbar";
import {AiChatPanel} from "./AiChatPanel";
import {AiSettingsPanel} from "./AiSettingsPanel";

export type AiWorkbenchProps = {
  diagramId: string;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onAddElements: (elements: ExcalidrawElement[]) => void;
};

export const AiWorkbench: React.FC<AiWorkbenchProps> = ({diagramId, excalidrawAPI, onAddElements}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAssistantBusy, setIsAssistantBusy] = useState(false);

  return (
    <AIToolbar
      showButton
      dialogTitle="AI Assistant"
      onGenerate={() => undefined}
      isGenerating={isAssistantBusy}
      renderDialogContent={({dragHandleProps}) => (
        <div className="relative flex h-full flex-col overflow-hidden font-sans text-slate-900 dark:text-slate-100">
          <AiChatPanel
            diagramId={diagramId}
            excalidrawAPI={excalidrawAPI}
            onAddElements={onAddElements}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onBusyChange={setIsAssistantBusy}
            dragHandleProps={dragHandleProps}
          />

          {isSettingsOpen && (
            <div className="absolute inset-0 z-20 flex flex-col bg-white/95 backdrop-blur dark:bg-slate-950/90">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-100">
                <div className="text-sm font-semibold">AI Settings</div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                  aria-label="Close settings"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <AiSettingsPanel onClose={() => setIsSettingsOpen(false)} />
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
};
