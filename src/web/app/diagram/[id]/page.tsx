import React, {useCallback, useState} from "react";
import type {ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";
import {useParams} from "react-router-dom";
import {nanoid} from "nanoid";

import {ExcalidrawCanvas} from "@web/components/ExcalidrawCanvas";
import {AiWorkbench} from "@web/components/AiWorkbench";
import {AppHeader} from "@web/components/AppHeader";
import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";

const DEFAULT_TEXT_STROKE = "#1e1e1e";
const DEFAULT_TEXT_STROKE_DARK = "#ffffff";

const ensureUniqueElements = (existing: readonly ExcalidrawElement[], incoming: ExcalidrawElement[]) => {
  const existingIds = new Set(existing.map((el) => el.id));
  return incoming.map((element) => {
    if (!existingIds.has(element.id)) {
      existingIds.add(element.id);
      return element;
    }
    const nextId = `${element.id}-${nanoid(6)}`;
    existingIds.add(nextId);
    return {...element, id: nextId};
  });
};

const applyTextStrokeDefaults = (
  elements: ExcalidrawElement[],
  containerSource: ExcalidrawElement[],
  isDark: boolean
) => {
  const containerMap = new Map<string, ExcalidrawElement>();
  for (const element of containerSource) {
    if (element?.id) {
      containerMap.set(element.id, element);
    }
  }

  const themeDefault = isDark ? DEFAULT_TEXT_STROKE_DARK : DEFAULT_TEXT_STROKE;

  return elements.map((element) => {
    if (element.type !== "text") return element;
    const currentStroke = (element as any).strokeColor as string | undefined;
    const normalizedStroke = typeof currentStroke === "string" ? currentStroke.trim().toLowerCase() : "";
    const isTransparent = normalizedStroke === "transparent";
    const isMissingStroke = !normalizedStroke || isTransparent;
    const isDefaultStroke =
      normalizedStroke === DEFAULT_TEXT_STROKE || normalizedStroke === DEFAULT_TEXT_STROKE_DARK;
    const containerId = (element as any).containerId as string | undefined;

    if (containerId) {
      const containerStroke = containerMap.get(containerId)?.strokeColor;
      if (containerStroke && (isMissingStroke || isDefaultStroke)) {
        return {...element, strokeColor: containerStroke};
      }
    }

    if (isMissingStroke || isDefaultStroke) {
      return {...element, strokeColor: themeDefault};
    }

    return element;
  });
};

const DiagramPage: React.FC = () => {
  const {id} = useParams();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI | null) => {
    setExcalidrawAPI(api);
  }, []);

  const handleAddElements = useCallback(
    (elements: ExcalidrawElement[]) => {
      if (!excalidrawAPI || elements.length === 0) return;
      const isDark = excalidrawAPI.getAppState()?.theme === "dark";
      const currentElements = (excalidrawAPI.getSceneElements?.() || []) as ExcalidrawElement[];
      const merged = [...currentElements, ...elements];
      const updatedExisting = applyTextStrokeDefaults(currentElements, merged, Boolean(isDark));
      const updatedIncoming = applyTextStrokeDefaults(elements, merged, Boolean(isDark));
      const nextElements = ensureUniqueElements(updatedExisting, updatedIncoming);
      excalidrawAPI.updateScene({
        elements: [...updatedExisting, ...nextElements],
      });
    },
    [excalidrawAPI]
  );

  if (!id) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppHeader />
      <ExcalidrawCanvas diagramId={id} onApiReady={handleApiReady} />
      <AiWorkbench
        diagramId={id}
        excalidrawAPI={excalidrawAPI}
        onAddElements={handleAddElements}
      />
    </div>
  );
};

export default DiagramPage;
