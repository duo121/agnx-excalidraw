import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";
import type {ExcalidrawImperativeAPI} from "@excalidraw/excalidraw/types";
import {List, Plus, Settings, Trash2} from "lucide-react";
import {
  applyDslChanges,
  convertMermaidToExcalidraw,
  extractDsl,
  extractMermaid,
  repairJsonWithAI,
  streamDslEdit,
  streamExcalidrawJson,
  streamMermaid,
} from "../../sdk/ai/client";
import {isConfigReady, loadAppConfig} from "../../sdk/ai/config";
import {convertJsonToDsl, type DSLCompressedDocument} from "../../sdk/dsl";
import {legacyStorageKeys, storageKeys} from "../../storage";

import {parseExcalidrawElements, parseExcalidrawElementsWithRepair} from "../../sdk/element-parser";
import {useChatHistory} from "@web/hooks/useChatHistory";

const INSERT_GAP_PX = 80;
const DEFAULT_STROKE_LIGHT = "#1e1e1e";
const MERMAID_HEADER_REGEX = /^\s*(graph|flowchart|sequenceDiagram)\b/;
const DSL_HEADER_REGEX = /^#\s*excalidraw public-attribute DSL/i;


type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

// Compute bounding box for a single element
const getElementBounds = (element: {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: readonly (readonly [number, number])[] | number[][];
}): Bounds => {
  const x2 = element.x + element.width;
  const y2 = element.y + element.height;
  let minX = Math.min(element.x, x2);
  let maxX = Math.max(element.x, x2);
  let minY = Math.min(element.y, y2);
  let maxY = Math.max(element.y, y2);

  if (Array.isArray(element.points)) {
    element.points.forEach((point) => {
      if (!Array.isArray(point) || point.length < 2) return;
      const px = element.x + point[0];
      const py = element.y + point[1];
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    });
  }

  return {minX, minY, maxX, maxY};
};

// Compute combined bounds for a list of elements
const getElementsBounds = (
  elements: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    points?: readonly (readonly [number, number])[] | number[][];
  }>
): Bounds | null => {
  if (!elements.length) return null;
  let bounds = getElementBounds(elements[0]);
  for (let i = 1; i < elements.length; i += 1) {
    const next = getElementBounds(elements[i]);
    bounds = {
      minX: Math.min(bounds.minX, next.minX),
      minY: Math.min(bounds.minY, next.minY),
      maxX: Math.max(bounds.maxX, next.maxX),
      maxY: Math.max(bounds.maxY, next.maxY),
    };
  }
  return bounds;
};

// Remove embedded element JSON from assistant messages for cleaner display
const stripJsonObjects = (text: string) => {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      let depth = 0;
      let inString = false;
      let escape = false;
      let j = i;
      for (; j < text.length; j += 1) {
        const char = text[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\" && inString) {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (char === "{") depth += 1;
        if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            const jsonStr = text.slice(i, j + 1);
            if (/"type"\s*:\s*"(rectangle|ellipse|diamond|text|arrow|line)"/.test(jsonStr)) {
              i = j + 1;
              break;
            }
            result += text[i];
            i += 1;
            break;
          }
        }
      }
      if (depth !== 0) {
        result += text[i];
        i += 1;
      }
    } else {
      result += text[i];
      i += 1;
    }
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
};

type AiChatPanelProps = {
  diagramId: string;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onAddElements: (elements: ExcalidrawElement[]) => void;
  onOpenSettings: () => void;
  onBusyChange?: (isBusy: boolean) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
};

type OutputMeta = {
  type: "mermaid" | "dsl";
  content: string;
  status: "streaming" | "ready" | "error" | "applied";
  referenceDoc?: DSLCompressedDocument;
};

// Identify Mermaid/DSL outputs from assistant text
const inferOutputMeta = (
  content: string,
  referenceDoc: DSLCompressedDocument
): OutputMeta | null => {
  const trimmed = content.trim();
  if (!trimmed) return null;
  if (DSL_HEADER_REGEX.test(trimmed)) {
    return {type: "dsl", content: trimmed, status: "ready", referenceDoc};
  }
  if (MERMAID_HEADER_REGEX.test(trimmed)) {
    return {type: "mermaid", content: trimmed, status: "ready"};
  }
  return null;
};

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  diagramId,
  excalidrawAPI,
  onAddElements,
  onOpenSettings,
  onBusyChange,
  dragHandleProps,
}) => {
  const [input, setInput] = useState(""); // 文本输入内容
  const [isLoading, setIsLoading] = useState(false); // 正在流式生成元素
  const [isBusy, setIsBusy] = useState(false); // 正在处理 Mermaid/DSL
  const [error, setError] = useState<string | null>(null); // 错误信息
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false); // 会话菜单开关
  const [outputMap, setOutputMap] = useState<Record<string, OutputMeta>>({}); // 助手消息的结构化输出
  const [, setDslExampleIndex] = useState(-1); // 示例轮换索引
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const dslExamples = useMemo(
    () => [
      "支付流程的流程图，按角色分泳道：用户、商户系统、支付平台、银行/三方。流程包括下单、创建订单、选择支付、生成支付并跳转/扫码/指纹、支付渠道扣款风控、返回结果，以及成功后更新订单状态/发货，失败则提示重试。",
      "用户注册与实名认证流程图：游客注册、短信验证码校验、设置密码、上传身份证+人脸识别、风控审核通过进入新手引导，失败则提示重新提交。",
      "售后退款流程图，角色：用户、客服、订单系统、支付平台。流程包括提交退款申请、客服审核、订单系统冻结订单、支付平台原路退回、通知用户完成。",
    ],
    []
  );
  const defaultDslDocument = useMemo(() => convertJsonToDsl([]).document, []);

  const storageKey = useMemo(() => storageKeys.aiChatHistory(diagramId), [diagramId]);
  const legacyStorageKey = useMemo(() => legacyStorageKeys.aiChatHistory(diagramId), [diagramId]);
  // 聊天记录与会话管理
  const {
    sessions,
    currentSession,
    currentSessionId,
    isLoaded,
    createSession,
    addMessage,
    updateMessage,
    deleteSession,
    switchSession,
  } = useChatHistory(storageKey, legacyStorageKey);

  const isWorking = isLoading || isBusy;

  // 将工作状态回传给外层
  useEffect(() => {
    onBusyChange?.(isWorking);
  }, [isWorking, onBusyChange]);

  // 保持滚动在底部
  const scrollToBottom = useCallback(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // 新消息后自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, scrollToBottom]);

  // 解析历史助手消息的结构化输出
  useEffect(() => {
    if (!currentSession) return;
    setOutputMap((prev) => {
      let next = prev;
      currentSession.messages.forEach((message) => {
        if (message.role !== "assistant") return;
        if (next[message.id]) return;
        const inferred = inferOutputMeta(message.content, defaultDslDocument);
        if (!inferred) return;
        if (next === prev) {
          next = {...prev};
        }
        next[message.id] = inferred;
      });
      return next;
    });
  }, [currentSession, defaultDslDocument]);

  // 会话菜单的外部点击/ESC 关闭
  useEffect(() => {
    if (!isSessionMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sessionMenuRef.current?.contains(target)) return;
      setIsSessionMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSessionMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSessionMenuOpen]);

  // 确保有当前会话 ID
  const ensureSessionId = useCallback(() => {
    if (currentSessionId) return currentSessionId;
    return createSession();
  }, [currentSessionId, createSession]);

  // 拉取配置并提示未配置
  const ensureConfigReady = useCallback(async () => {
    const config = await loadAppConfig();
    if (!isConfigReady(config)) {
      setError("Please configure a provider before using AI.");
      onOpenSettings();
      return false;
    }
    return true;
  }, [onOpenSettings]);

  // 将生成的元素插入画布并避免重叠
  const applyElementsWithOffset = useCallback(
    (incomingElements: ExcalidrawElement[], files?: Record<string, any>) => {
      if (!excalidrawAPI) return;
      const existingElements = (excalidrawAPI.getSceneElements?.() || []) as ExcalidrawElement[];
      const existingVisible = existingElements.filter((element) => !element.isDeleted);
      const incomingVisible = incomingElements.filter((element) => !element.isDeleted);
      if (!incomingVisible.length) return;

      let offsetY = 0;
      if (existingVisible.length && incomingVisible.length) {
        const existingBounds = getElementsBounds(existingVisible);
        const incomingBounds = getElementsBounds(incomingVisible);
        if (existingBounds && incomingBounds) {
          const targetTop = existingBounds.maxY + INSERT_GAP_PX;
          if (targetTop > incomingBounds.minY) {
            offsetY = targetTop - incomingBounds.minY;
          }
        }
      }

      const shifted = offsetY
        ? incomingVisible.map((element) => ({...element, y: element.y + offsetY}))
        : incomingVisible;

      onAddElements(shifted);
      if (files) {
        excalidrawAPI.addFiles?.(Object.values(files));
      }
      
      // 选中新插入的元素
      const selectedElementIds: Record<string, true> = {};
      shifted.forEach(el => {
        selectedElementIds[el.id] = true;
      });
      
      // 更新 appState 选中元素
      excalidrawAPI.updateScene({
        appState: {
          selectedElementIds: selectedElementIds
        }
      });
      
      excalidrawAPI.scrollToContent?.(shifted);
    },
    [excalidrawAPI, onAddElements]
  );

  // 发送自然语言并流式生成 Excalidraw JSON
  const handleSend = useCallback(async () => {
    if (!input.trim() || isWorking) return;

    const hasConfig = await ensureConfigReady();
    if (!hasConfig) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    const sessionId = ensureSessionId();
    addMessage(sessionId, "user", userMessage);
    const assistantMessageId = addMessage(sessionId, "assistant", "");

    let fullText = "";
    let processedLength = 0;
    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    
    // 收集所有生成的元素 ID，用于最后选中
    const generatedElementIds: string[] = [];

    try {
      await streamExcalidrawJson(userMessage, {
        onChunk: (delta) => {
          fullText += delta;
          updateMessage(sessionId, assistantMessageId, fullText);
          const {elements, remainingBuffer} = parseExcalidrawElements(fullText, processedLength, {isDark});
          if (elements.length > 0) {
            // 收集元素 ID
            elements.forEach(el => generatedElementIds.push(el.id));
            onAddElements(elements as unknown as ExcalidrawElement[]);
            processedLength = fullText.length - remainingBuffer.length;
          }
          scrollToBottom();
        },
        onError: (streamError) => {
          const message = streamError.message || "Streaming failed";
          updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
          setError(message);
        },
        onComplete: () => {
          // 先解析剩余的 JSON（不启用 AI 修复，不阻塞）
          const {elements, parseErrors} = parseExcalidrawElements(fullText, processedLength, {isDark});
          if (elements.length > 0) {
            // 收集剩余元素 ID
            elements.forEach(el => generatedElementIds.push(el.id));
            onAddElements(elements as unknown as ExcalidrawElement[]);
          }
          
          // 选中所有生成的元素
          if (excalidrawAPI && generatedElementIds.length > 0) {
            const selectedElementIds: Record<string, true> = {};
            generatedElementIds.forEach(id => {
              selectedElementIds[id] = true;
            });
            excalidrawAPI.updateScene({
              appState: {
                selectedElementIds: selectedElementIds
              }
            });
            
            // 获取所有生成的元素并滚动到它们
            const allElements = excalidrawAPI.getSceneElements?.() || [];
            const generatedElements = allElements.filter(el => generatedElementIds.includes(el.id));
            if (generatedElements.length > 0) {
              excalidrawAPI.scrollToContent?.(generatedElements);
            }
          }
          
          // 如果有解析错误，异步后台修复（不阻塞主流程）
          if (parseErrors && parseErrors.length > 0) {
            console.log(`[Excalidraw] 检测到 ${parseErrors.length} 个解析错误，后台异步修复中...`);
            
            // 异步修复，不阻塞 onComplete 返回
            parseExcalidrawElementsWithRepair(
              fullText,
              processedLength,
              {isDark, enableAIRepair: true, repairFn: repairJsonWithAI, maxRepairCount: 10}
            ).then(({repairedElements}) => {
              // repairedElements 只包含修复后的元素
              if (repairedElements && repairedElements.length > 0) {
                console.log(`[Excalidraw] 后台修复完成，添加 ${repairedElements.length} 个新元素`);
                // 收集修复后的元素 ID 并选中
                const repairedIds = repairedElements.map(el => el.id);
                onAddElements(repairedElements as unknown as ExcalidrawElement[]);
                
                // 更新选中状态，包含所有生成的元素
                if (excalidrawAPI) {
                  const allSelectedIds: Record<string, true> = {};
                  [...generatedElementIds, ...repairedIds].forEach(id => {
                    allSelectedIds[id] = true;
                  });
                  excalidrawAPI.updateScene({
                    appState: {
                      selectedElementIds: allSelectedIds
                    }
                  });
                }
              }
            }).catch(err => {
              console.error('[Excalidraw] 后台修复失败:', err);
            });
          }
        },
      });
    } catch (streamError: any) {
      const message = streamError?.message || "Streaming failed";
      updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isWorking,
    excalidrawAPI,
    ensureConfigReady,
    ensureSessionId,
    addMessage,
    updateMessage,
    onAddElements,
    scrollToBottom,
  ]);

  // 按提示生成 Mermaid 并流式展示
  const handleMermaid = useCallback(async () => {
    if (!input.trim() || isWorking) return;
    if (!excalidrawAPI) {
      setError("Canvas is not ready.");
      return;
    }

    const hasConfig = await ensureConfigReady();
    if (!hasConfig) return;

    const prompt = input.trim();
    setInput("");
    setIsBusy(true);
    setError(null);

    const sessionId = ensureSessionId();
    addMessage(sessionId, "user", prompt);
    const assistantMessageId = addMessage(sessionId, "assistant", "");

    setOutputMap((prev) => ({
      ...prev,
      [assistantMessageId]: {
        type: "mermaid",
        content: "",
        status: "streaming",
      },
    }));

    let streamedText = "";

    try {
      await streamMermaid(prompt, {
        onChunk: (delta) => {
          streamedText += delta;
          updateMessage(sessionId, assistantMessageId, streamedText);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "mermaid",
              content: streamedText,
              status: "streaming",
            },
          }));
          scrollToBottom();
        },
        onError: (streamError) => {
          const message = streamError.message || "Mermaid streaming failed";
          updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "mermaid",
              content: `Error: ${message}`,
              status: "error",
            },
          }));
          setError(message);
        },
        onComplete: (text) => {
          const finalText = text || streamedText;
          let extracted = finalText;
          let status: OutputMeta["status"] = "ready";
          try {
            extracted = extractMermaid(finalText);
          } catch (parseError: any) {
            status = "error";
            setError(parseError?.message || "No Mermaid code found.");
          }
          updateMessage(sessionId, assistantMessageId, extracted);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "mermaid",
              content: extracted,
              status,
            },
          }));
        },
      });
    } catch (streamError: any) {
      const message = streamError?.message || "Mermaid streaming failed";
      updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
      setOutputMap((prev) => ({
        ...prev,
        [assistantMessageId]: {
          ...prev[assistantMessageId],
          type: "mermaid",
          content: `Error: ${message}`,
          status: "error",
        },
      }));
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [
    input,
    isWorking,
    excalidrawAPI,
    ensureConfigReady,
    ensureSessionId,
    addMessage,
    updateMessage,
    scrollToBottom,
  ]);

  // 按提示生成 DSL 变更并流式展示
  const handleDsl = useCallback(async () => {
    if (!input.trim() || isWorking) return;
    if (!excalidrawAPI) {
      setError("Canvas is not ready.");
      return;
    }

    const hasConfig = await ensureConfigReady();
    if (!hasConfig) return;

    const prompt = input.trim();
    setInput("");
    setIsBusy(true);
    setError(null);

    const sessionId = ensureSessionId();
    addMessage(sessionId, "user", prompt);
    const assistantMessageId = addMessage(sessionId, "assistant", "");

    const baseElements: ExcalidrawElement[] = [];
    const snapshot = convertJsonToDsl(baseElements);

    setOutputMap((prev) => ({
      ...prev,
      [assistantMessageId]: {
        type: "dsl",
        content: "",
        status: "streaming",
        referenceDoc: snapshot.document,
      },
    }));

    let streamedText = "";

    try {
      await streamDslEdit(baseElements, prompt, {
        onChunk: (delta) => {
          streamedText += delta;
          updateMessage(sessionId, assistantMessageId, streamedText);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "dsl",
              content: streamedText,
              status: "streaming",
              referenceDoc: prev[assistantMessageId]?.referenceDoc ?? snapshot.document,
            },
          }));
          scrollToBottom();
        },
        onError: (streamError) => {
          const message = streamError.message || "DSL streaming failed";
          updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "dsl",
              content: `Error: ${message}`,
              status: "error",
              referenceDoc: prev[assistantMessageId]?.referenceDoc ?? snapshot.document,
            },
          }));
          setError(message);
        },
        onComplete: (text) => {
          const finalText = text || streamedText;
          let extracted = finalText;
          let status: OutputMeta["status"] = "ready";
          try {
            extracted = extractDsl(finalText);
          } catch (parseError: any) {
            status = "error";
            setError(parseError?.message || "No DSL found.");
          }
          updateMessage(sessionId, assistantMessageId, extracted);
          setOutputMap((prev) => ({
            ...prev,
            [assistantMessageId]: {
              ...prev[assistantMessageId],
              type: "dsl",
              content: extracted,
              status,
              referenceDoc: prev[assistantMessageId]?.referenceDoc ?? snapshot.document,
            },
          }));
        },
      });
    } catch (streamError: any) {
      const message = streamError?.message || "DSL streaming failed";
      updateMessage(sessionId, assistantMessageId, `Error: ${message}`);
      setOutputMap((prev) => ({
        ...prev,
        [assistantMessageId]: {
          ...prev[assistantMessageId],
          type: "dsl",
          content: `Error: ${message}`,
          status: "error",
          referenceDoc: prev[assistantMessageId]?.referenceDoc ?? snapshot.document,
        },
      }));
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [
    input,
    isWorking,
    excalidrawAPI,
    ensureConfigReady,
    ensureSessionId,
    addMessage,
    updateMessage,
    scrollToBottom,
  ]);

  // 将结构化输出应用到画布
  const handleApplyOutput = useCallback(
    async (messageId: string) => {
      if (!excalidrawAPI) return;
      const meta = outputMap[messageId];
      if (!meta || (meta.status !== "ready" && meta.status !== "applied")) return;

      setIsBusy(true);
      setError(null);

      try {
        if (meta.type === "mermaid") {
          const code = extractMermaid(meta.content);
          const isDark = excalidrawAPI.getAppState()?.theme === "dark";
          const userStroke = excalidrawAPI.getAppState()?.currentItemStrokeColor;
          const preferredStrokeColor = userStroke || DEFAULT_STROKE_LIGHT;
          const scene = await convertMermaidToExcalidraw(code, {isDark, preferredStrokeColor});
          console.log("[AiChatPanel] Applying Mermaid output", {
            code,
            elementCount: scene.elements.length,
            sample: scene.elements.slice(0, 3),
            missingStroke: scene.elements.filter(
              (el) => !(el as any).strokeColor || (el as any).strokeColor === "transparent"
            ).length,
          });
          applyElementsWithOffset(scene.elements as ExcalidrawElement[], scene.files);
        } else {
          const referenceDoc =
            meta.referenceDoc ||
            convertJsonToDsl(
              ((excalidrawAPI.getSceneElements?.() || []) as ExcalidrawElement[]) || []
            ).document;
          const code = extractDsl(meta.content);
          const isDark = excalidrawAPI.getAppState()?.theme === "dark";
          const userStroke = excalidrawAPI.getAppState()?.currentItemStrokeColor;
          const preferredStrokeColor = userStroke || DEFAULT_STROKE_LIGHT;
          const nextElements = await applyDslChanges(code, referenceDoc, {
            isDark,
            preferredStrokeColor,
          });
          if (!nextElements.length) {
            throw new Error("No elements to insert.");
          }
          console.log("[AiChatPanel] Applying DSL output", {
            code,
            elementCount: nextElements.length,
            sample: nextElements.slice(0, 3),
            missingStroke: nextElements.filter(
              (el) => !(el as any).strokeColor || (el as any).strokeColor === "transparent"
            ).length,
          });
          applyElementsWithOffset(nextElements as ExcalidrawElement[]);
        }

        setOutputMap((prev) => {
          const current = prev[messageId];
          if (!current) return prev;
          return {
            ...prev,
            [messageId]: {
              ...current,
              status: "applied",
            },
          };
        });
      } catch (applyError: any) {
        const message = applyError?.message || "Apply failed";
        setError(message);
        setOutputMap((prev) => {
          const current = prev[messageId];
          if (!current) return prev;
          return {
            ...prev,
            [messageId]: {
              ...current,
              status: "error",
            },
          };
        });
      } finally {
        setIsBusy(false);
      }
    },
    [applyElementsWithOffset, excalidrawAPI, outputMap]
  );

  // 更新助手消息的可编辑内容
  const handleUpdateOutputContent = useCallback(
    (messageId: string, content: string) => {
      setOutputMap((prev) => {
        const current = prev[messageId];
        if (!current) return prev;
        return {
          ...prev,
          [messageId]: {
            ...current,
            content,
          },
        };
      });
      if (currentSessionId) {
        updateMessage(currentSessionId, messageId, content);
      }
    },
    [currentSessionId, updateMessage]
  );

  // 插入一个示例 DSL 提示
  const handleDslExample = useCallback(() => {
    if (!dslExamples.length) return;
    setDslExampleIndex((current) => {
      const nextIndex = (current + 1) % dslExamples.length;
      setInput(dslExamples[nextIndex]);
      return nextIndex;
    });
  }, [dslExamples]);

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading chat history...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex select-none items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-700 cursor-grab active:cursor-grabbing dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
        {...dragHandleProps}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
          <h3 className="text-sm font-semibold tracking-tight">Excalidraw AI 助手</h3>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSessionMenuOpen((open) => !open)}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-white/20"
            aria-label="Session list"
            aria-expanded={isSessionMenuOpen}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              createSession();
              setIsSessionMenuOpen(false);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-white/20"
            aria-label="New session"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSessionMenuOpen(false);
              onOpenSettings();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-white/20"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          {isSessionMenuOpen && (
            <div
              ref={sessionMenuRef}
              className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-slate-200/70 bg-white/95 p-2 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.5)] backdrop-blur dark:border-white/10 dark:bg-slate-950/90"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="max-h-64 overflow-y-auto">
                {sessions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No sessions yet.</div>
                )}
                {sessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1 transition ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900"
                          : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs"
                        onClick={() => {
                          switchSession(session.id);
                          setIsSessionMenuOpen(false);
                        }}
                      >
                        {session.title}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                          isActive
                            ? "text-white/80 hover:text-white dark:text-slate-700 dark:hover:text-slate-900"
                            : "text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
                        }`}
                        aria-label="Delete session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={chatBodyRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-white/60 via-white/40 to-slate-50/80 px-4 py-4 text-sm dark:from-slate-950/50 dark:via-slate-950/40 dark:to-slate-900/60"
      >
        {(!currentSession?.messages || currentSession.messages.length === 0) ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-2xl">🎨</div>
            <h3 className="mb-2 text-base font-semibold text-slate-700 dark:text-slate-200">
              欢迎使用 AI 绘图助手
            </h3>
            <p className="mb-6 max-w-[240px] text-xs text-slate-500 dark:text-slate-400">
              描述你想要的图表，AI 将帮你生成 Mermaid 代码并转换为图形
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://platform.iflow.cn/profile?tab=apiKey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/70 bg-emerald-50/80 px-4 py-2 text-xs font-medium text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-800/40"
              >
                🎁 获取免费 API Key（GLM-4、Kimi K2）
              </a>
              <a
                href="https://agnx-excalidraw-docs.vercel.app/docs/intro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              >
                📚 文档
              </a>
              <a
                href="https://github.com/duo121/agnx-excalidraw"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              >
                ⭐ GitHub
              </a>
              <a
                href="https://agnx-excalidraw-docs.vercel.app/docs/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              >
                💬 联系我们
              </a>
            </div>
          </div>
        ) : (<>
        <div className="flex flex-col gap-3">
          {currentSession?.messages.map((message) => {
            const outputMeta = message.role === "assistant" ? outputMap[message.id] : undefined;
            const isAssistant = message.role === "assistant";
            const hasStructuredOutput = Boolean(isAssistant && outputMeta);
            // 结构化输出：撑满可用宽度（不随内容收缩），非结构化保持对话气泡宽度
            const bubbleWidthClass = hasStructuredOutput ? "w-full flex-1 min-w-0" : "max-w-[80%]";
            return (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${bubbleWidthClass} rounded-2xl border border-transparent px-3 py-2 text-sm leading-relaxed shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] ${
                    message.role === "user"
                      ? "border-slate-900/50 bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900"
                      : "border-slate-200/70 bg-white/80 text-slate-800 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    outputMeta ? (
                      <AiOutputMessage
                        meta={outputMeta}
                        onApply={() => void handleApplyOutput(message.id)}
                        onEdit={(next) => handleUpdateOutputContent(message.id, next)}
                        isBusy={isWorking}
                      />
                    ) : (
                      <AssistantMessage content={message.content} />
                    )
                  ) : (
                    <span>{message.content}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!isLoading && isBusy && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Working on it...
          </div>
        )}
        <div ref={messagesEndRef} />
        </>)}
      </div>

      <div className="border-t border-slate-200/70 bg-white/85 px-4 py-3 dark:border-white/10 dark:bg-slate-950/70">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-slate-900/60">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe the diagram you want..."
            rows={3}
            disabled={isWorking}
            className="input-scroll w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between border-t border-slate-200/70 px-3 py-2 dark:border-white/10">
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
                onClick={() => void handleMermaid()}
                disabled={!input.trim() || isWorking}
                type="button"
              >
                Mermaid
              </button>
              {/* DSL 功能暂时隐藏
              <button
                className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
                onClick={() => void handleDsl()}
                disabled={!input.trim() || isWorking}
                type="button"
              >
                DSL
              </button>
              <button
                className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
                onClick={handleDslExample}
                disabled={isWorking}
                type="button"
              >
                示例
              </button>
              */}
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isWorking}
              type="button"
            >
              发送
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-xs text-rose-500">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

const AiOutputMessage: React.FC<{
  meta: OutputMeta;
  onApply: () => void;
  onEdit?: (nextContent: string) => void;
  isBusy: boolean;
}> = ({meta, onApply, onEdit, isBusy}) => {
  const label = meta.type === "mermaid" ? "Mermaid 输出" : "DSL 输出";
  const isReady = meta.status === "ready" || meta.status === "applied";
  const isApplied = meta.status === "applied";
  const isStreaming = meta.status === "streaming";
  const isEditable = meta.type === "mermaid" && Boolean(onEdit) && !isStreaming;
  const lineCount = meta.content ? meta.content.split(/\r?\n/).length : 1;
  const rows = Math.min(30, Math.max(8, lineCount + 2));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <span>{label}</span>
        {isStreaming && <span className="text-[10px] text-slate-500">Streaming...</span>}
        {meta.status === "error" && <span className="text-[10px] text-rose-500">Failed</span>}
        {isApplied && <span className="text-[10px] text-emerald-500">已应用</span>}
      </div>
      {isEditable ? (
        <textarea
          value={meta.content}
          onChange={(event) => onEdit?.(event.target.value)}
          rows={rows}
          wrap="soft"
          className="input-scroll block w-full resize-y rounded-xl border border-slate-200/70 bg-white/90 p-3 text-xs font-mono text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20 whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto"
          placeholder="Edit Mermaid output before applying..."
          disabled={isBusy}
        />
      ) : (
        <pre className="block w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100">
          {meta.content || (isStreaming ? "Generating..." : "")}
        </pre>
      )}
      <div className="flex items-center justify-end">
        <button
          className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
          type="button"
          onClick={onApply}
          disabled={!isReady || isBusy}
        >
          应用
        </button>
      </div>
    </div>
  );
};

const AssistantMessage: React.FC<{content: string}> = ({content}) => {
  // 直接展示完整内容，允许水平滚动，保留换行
  if (!content) return <span>Generating...</span>;
  return (
    <pre className="block max-w-full overflow-x-auto overflow-y-hidden whitespace-pre-wrap break-words text-xs md:text-sm">
      {content}
    </pre>
  );
};
