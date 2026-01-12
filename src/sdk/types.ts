import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";
import type {AppState, BinaryFiles} from "@excalidraw/excalidraw/types";

export type ExcalidrawAppState = Partial<AppState> & {
  currentItemVerticalAlign?: "top" | "middle" | "bottom";
};

export type DiagramType =
  | "flowchart"
  | "architecture"
  | "sequence"
  | "mindmap"
  | "wireframe"
  | "freehand";

export interface DiagramData {
  id: string;
  title: string;
  type: DiagramType;
  sessionId?: string;

  elements: readonly ExcalidrawElement[];
  appState: ExcalidrawAppState;
  files?: BinaryFiles;

  createdAt: number;
  updatedAt: number;
  version: number;
  elementCount: number;
  preview?: string;

  generatedBy?: "manual" | "ai" | "conversion";
  mermaidDefinition?: string;
  aiProviderUsed?: string;
  aiModelUsed?: string;
  aiGenerationTime?: number;
  aiTokensUsed?: {
    input: number;
    output: number;
  };
  aiCostUsd?: number;
}

export interface DiagramStorageService {
  save(diagram: DiagramData): Promise<void>;
  get(id: string): Promise<DiagramData | null>;
  delete(id: string): Promise<void>;
  list(options?: ListOptions): Promise<DiagramData[]>;
  generatePreview(
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files?: BinaryFiles
  ): Promise<string>;
}

export interface ListOptions {
  sessionId?: string;
  type?: DiagramType;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}
