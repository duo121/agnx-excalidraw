import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Layout,
  Lightbulb,
  Palette,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import React, {useState} from "react";
import {readJson, storageKeys, writeJson} from "../../storage";

const FLOATING_POSITION_KEY = storageKeys.aiToolbarPosition;
const FLOATING_DIALOG_POSITION_KEY = storageKeys.aiDialogPosition;
const FLOATING_DIALOG_SIZE_KEY = storageKeys.aiDialogSize;
const DRAG_THRESHOLD_PX = 4;
const FLOATING_MARGIN_PX = 8;
const DEFAULT_DIALOG_SIZE = {width: 420, height: 720};
const MIN_DIALOG_SIZE = {width: 360, height: 360};

export interface AIToolbarProps {
  onGenerate: (prompt: string) => Promise<string | void> | string | void;
  onOptimize?: () => Promise<void> | void;
  onBeautify?: () => Promise<void> | void;
  onRegenerate?: () => Promise<void> | void;
  isGenerating?: boolean;
  disabled?: boolean;
  showButton?: boolean; // 是否显示悬浮按钮（默认 false，由 header 按钮触发）
  scope?: string;
  dialogTitle?: string;
  renderDialogContent?: (args: {
    close: () => void;
    dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
  }) => React.ReactNode;
}

/**
 * Excalidraw 编辑器的 AI 图表生成工具
 * - 由 header 中的"文生图"按钮触发
 * - 两步式流程：自然语言 → Mermaid → Excalidraw
 */
export const AIToolbar: React.FC<AIToolbarProps> = ({
  onGenerate,
  onOptimize,
  onBeautify,
  onRegenerate,
  isGenerating = false,
  disabled = false,
  showButton = false,
  scope,
  dialogTitle,
  renderDialogContent
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{x: number; y: number} | null>(() => {
    const stored = readJson<{x?: number; y?: number} | null>(FLOATING_POSITION_KEY, null);
    if (stored && typeof stored.x === "number" && typeof stored.y === "number") {
      return {x: stored.x, y: stored.y};
    }
    return null;
  });
  const [dialogPosition, setDialogPosition] = useState<{x: number; y: number} | null>(() => {
    const stored = readJson<{x?: number; y?: number} | null>(FLOATING_DIALOG_POSITION_KEY, null);
    if (stored && typeof stored.x === "number" && typeof stored.y === "number") {
      return {x: stored.x, y: stored.y};
    }
    return null;
  });
  const [dialogSize, setDialogSize] = useState<{width: number; height: number}>(() => {
    const stored = readJson<{width?: number; height?: number} | null>(FLOATING_DIALOG_SIZE_KEY, null);
    if (stored && typeof stored.width === "number" && typeof stored.height === "number") {
      return {
        width: Math.max(MIN_DIALOG_SIZE.width, stored.width),
        height: Math.max(MIN_DIALOG_SIZE.height, stored.height),
      };
    }
    if (typeof window === "undefined") return DEFAULT_DIALOG_SIZE;
    const maxWidth = Math.max(MIN_DIALOG_SIZE.width, window.innerWidth - FLOATING_MARGIN_PX * 2);
    const maxHeight = Math.max(MIN_DIALOG_SIZE.height, window.innerHeight - FLOATING_MARGIN_PX * 2);
    return {
      width: Math.min(DEFAULT_DIALOG_SIZE.width, maxWidth),
      height: maxHeight,
    };
  });
  const positionRef = React.useRef(position);
  const dialogPositionRef = React.useRef(dialogPosition);
  const dialogSizeRef = React.useRef(dialogSize);
  const dragStateRef = React.useRef<{
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    moved: boolean;
  }>({
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    moved: false,
  });
  const dialogDragStateRef = React.useRef<{
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    moved: boolean;
  }>({
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    moved: false,
  });
  const dialogResizeStateRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });
  const userSelectRef = React.useRef<string | null>(null);
  const dialogUserSelectRef = React.useRef<string | null>(null);
  const suppressClickRef = React.useRef(false);
  const [prompt, setPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedMermaid, setGeneratedMermaid] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [step, setStep] = useState<"prompt" | "mermaid">("prompt");

  React.useEffect(() => {
    positionRef.current = position;
  }, [position]);

  React.useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  React.useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  const handleGenerateMermaid = async () => {
    if (!prompt.trim()) return;

    setError(null);
    setGeneratedMermaid(null);

    try {
      // 第一步：生成 Mermaid 代码（不转换）
      const result = await onGenerate(prompt.trim());

      // onGenerate 应该返回生成的 Mermaid 代码字符串
      if (typeof result === "string" && result.trim()) {
        setGeneratedMermaid(result);
        setStep("mermaid");
        console.log("[AIToolbar] ✅ Mermaid 代码已生成");
      } else {
        throw new Error("未能生成有效的 Mermaid 代码");
      }
    } catch (err: any) {
      console.error("[AIToolbar] 生成失败:", err);
      setError(err?.message || "生成失败，请重试");
    }
  };

  const handleConvert = async () => {
    if (!generatedMermaid?.trim()) {
      setError("Mermaid 代码不能为空");
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      // 第二步：转换为 Excalidraw（调用转换函数）
      await onGenerate(generatedMermaid); // 这里应该是转换函数

      // ✅ 成功：清空状态并关闭弹框
      setPrompt("");
      setGeneratedMermaid(null);
      setShowPromptInput(false);
    } catch (err: any) {
      console.error("[AIToolbar] 转换失败:", err);
      setError(err?.message || "转换失败，请重试");
    } finally {
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    // 返回第一步，保留用户输入的描述和生成的 Mermaid 代码
    // ✅ 不清空 generatedMermaid，以便用户可以再次查看/编辑
    setStep("prompt");
    setError(null);
    // 不关闭弹框，让用户可以修改描述
  };

  const handleClose = () => {
    // 完全关闭弹框
    setPrompt("");
    setGeneratedMermaid(null);
    setError(null);
    setShowPromptInput(false);
    setStep("prompt");
  };

  const handleNextStep = () => {
    // ✅ 如果还没有生成过 Mermaid 代码，初始化为空字符串
    if (generatedMermaid === null) {
      setGeneratedMermaid("");
    }
    setError(null);
    setStep("mermaid");
  };

  // 填充示例提示词
  const handleFillExample = () => {
    const examples = [
      "登录",
      "用户注册流程，包括邮箱验证",
      "订单支付流程，从购物车到支付成功",
      "微服务架构，包含 API 网关、用户服务、订单服务",
      "用户与系统的交互时序图"
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setPrompt(randomExample);
  };

  const resolvedTitle = dialogTitle
    ? dialogTitle
    : step === "mermaid"
      ? "生成的 Mermaid 代码"
      : "描述你想生成的图表";
  const hasCustomDialog = typeof renderDialogContent === "function";

  const persistPosition = React.useCallback((nextPosition: {x: number; y: number}) => {
    if (typeof window === "undefined") return;
    try {
      writeJson(FLOATING_POSITION_KEY, nextPosition);
    } catch {
      // ignore
    }
  }, []);

  const persistDialogPosition = React.useCallback((nextPosition: {x: number; y: number}) => {
    if (typeof window === "undefined") return;
    try {
      writeJson(FLOATING_DIALOG_POSITION_KEY, nextPosition);
    } catch {
      // ignore
    }
  }, []);

  const persistDialogSize = React.useCallback((nextSize: {width: number; height: number}) => {
    if (typeof window === "undefined") return;
    try {
      writeJson(FLOATING_DIALOG_SIZE_KEY, nextSize);
    } catch {
      // ignore
    }
  }, []);

  const clamp = React.useCallback((value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  }, []);

  const resolveDialogPosition = React.useCallback(() => {
    if (typeof window === "undefined") {
      return {x: FLOATING_MARGIN_PX, y: FLOATING_MARGIN_PX};
    }
    const size = dialogSizeRef.current;
    const maxX = window.innerWidth - size.width - FLOATING_MARGIN_PX;
    return {
      x: Math.max(FLOATING_MARGIN_PX, maxX),
      y: FLOATING_MARGIN_PX,
    };
  }, []);

  const openDialog = React.useCallback(() => {
    setShowPromptInput(true);
    setStep("prompt");
    setDialogPosition((current) => current ?? resolveDialogPosition());
  }, [resolveDialogPosition]);

  const toggleDialog = React.useCallback(() => {
    if (showPromptInput) {
      handleClose();
      return;
    }
    openDialog();
  }, [handleClose, openDialog, showPromptInput]);

  // 监听自定义事件来打开弹框
  React.useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<{scope?: string}>).detail;
      if (scope) {
        if (!detail?.scope || detail.scope !== scope) {
          return;
        }
      }
      openDialog();
    };
    window.addEventListener("open-ai-diagram-generator", handleOpenEvent);
    return () => {
      window.removeEventListener("open-ai-diagram-generator", handleOpenEvent);
    };
  }, [openDialog, scope]);

  const handleWindowPointerMove = React.useCallback(
    (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      if (!drag.moved) {
        drag.moved = true;
        suppressClickRef.current = true;
        if (typeof document !== "undefined") {
          userSelectRef.current = document.body.style.userSelect;
          document.body.style.userSelect = "none";
        }
      }

      const maxX = window.innerWidth - drag.width - FLOATING_MARGIN_PX;
      const maxY = window.innerHeight - drag.height - FLOATING_MARGIN_PX;
      const nextX = clamp(event.clientX - drag.offsetX, FLOATING_MARGIN_PX, Math.max(FLOATING_MARGIN_PX, maxX));
      const nextY = clamp(event.clientY - drag.offsetY, FLOATING_MARGIN_PX, Math.max(FLOATING_MARGIN_PX, maxY));
      setPosition({x: nextX, y: nextY});
    },
    [clamp]
  );

  const handleWindowPointerUp = React.useCallback(
    (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== event.pointerId) return;
      dragStateRef.current.pointerId = null;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      if (userSelectRef.current !== null) {
        document.body.style.userSelect = userSelectRef.current;
        userSelectRef.current = null;
      }
      if (drag.moved && positionRef.current) {
        persistPosition(positionRef.current);
      }
    },
    [handleWindowPointerMove, persistPosition]
  );

  const handleDialogPointerMove = React.useCallback(
    (event: PointerEvent) => {
      const drag = dialogDragStateRef.current;
      if (drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      if (!drag.moved) {
        drag.moved = true;
        if (typeof document !== "undefined") {
          dialogUserSelectRef.current = document.body.style.userSelect;
          document.body.style.userSelect = "none";
        }
      }

      const maxX = window.innerWidth - drag.width - FLOATING_MARGIN_PX;
      const maxY = window.innerHeight - drag.height - FLOATING_MARGIN_PX;
      const nextX = clamp(event.clientX - drag.offsetX, FLOATING_MARGIN_PX, Math.max(FLOATING_MARGIN_PX, maxX));
      const nextY = clamp(event.clientY - drag.offsetY, FLOATING_MARGIN_PX, Math.max(FLOATING_MARGIN_PX, maxY));
      setDialogPosition({x: nextX, y: nextY});
      dialogPositionRef.current = {x: nextX, y: nextY};
    },
    [clamp]
  );

  const handleDialogPointerUp = React.useCallback(
    (event: PointerEvent) => {
      const drag = dialogDragStateRef.current;
      if (drag.pointerId !== event.pointerId) return;
      dialogDragStateRef.current.pointerId = null;
      window.removeEventListener("pointermove", handleDialogPointerMove);
      window.removeEventListener("pointerup", handleDialogPointerUp);
      window.removeEventListener("pointercancel", handleDialogPointerUp);
      if (dialogUserSelectRef.current !== null) {
        document.body.style.userSelect = dialogUserSelectRef.current;
        dialogUserSelectRef.current = null;
      }
      if (drag.moved && dialogPositionRef.current) {
        persistDialogPosition(dialogPositionRef.current);
      }
    },
    [handleDialogPointerMove, persistDialogPosition]
  );

  const handleResizePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const resize = dialogResizeStateRef.current;
      if (resize.pointerId !== event.pointerId) return;
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const position = dialogPositionRef.current ?? {x: FLOATING_MARGIN_PX, y: FLOATING_MARGIN_PX};
      const maxWidth = Math.max(MIN_DIALOG_SIZE.width, window.innerWidth - position.x - FLOATING_MARGIN_PX);
      const maxHeight = Math.max(MIN_DIALOG_SIZE.height, window.innerHeight - position.y - FLOATING_MARGIN_PX);
      const nextWidth = clamp(resize.startWidth + dx, MIN_DIALOG_SIZE.width, maxWidth);
      const nextHeight = clamp(resize.startHeight + dy, MIN_DIALOG_SIZE.height, maxHeight);
      setDialogSize({width: nextWidth, height: nextHeight});
      dialogSizeRef.current = {width: nextWidth, height: nextHeight};
    },
    [clamp]
  );

  const handleResizePointerUp = React.useCallback(
    (event: PointerEvent) => {
      const resize = dialogResizeStateRef.current;
      if (resize.pointerId !== event.pointerId) return;
      dialogResizeStateRef.current.pointerId = null;
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", handleResizePointerUp);
      window.removeEventListener("pointercancel", handleResizePointerUp);
      if (dialogUserSelectRef.current !== null) {
        document.body.style.userSelect = dialogUserSelectRef.current;
        dialogUserSelectRef.current = null;
      }
      persistDialogSize(dialogSizeRef.current);
    },
    [handleResizePointerMove, persistDialogSize]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const initialPosition = positionRef.current ?? {x: rect.left, y: rect.top};
    if (!positionRef.current) {
      setPosition(initialPosition);
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    suppressClickRef.current = false;
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
  };

  const handleDialogPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const initialPosition = dialogPositionRef.current ?? {x: rect.left, y: rect.top};
    if (!dialogPositionRef.current) {
      setDialogPosition(initialPosition);
    }
    dialogDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    window.addEventListener("pointermove", handleDialogPointerMove);
    window.addEventListener("pointerup", handleDialogPointerUp);
    window.addEventListener("pointercancel", handleDialogPointerUp);
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    dialogResizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    if (typeof document !== "undefined") {
      dialogUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
    }
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", handleResizePointerUp);
    window.addEventListener("pointercancel", handleResizePointerUp);
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const cleanupDragListeners = React.useCallback(() => {
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
    window.removeEventListener("pointercancel", handleWindowPointerUp);
    if (userSelectRef.current !== null) {
      document.body.style.userSelect = userSelectRef.current;
      userSelectRef.current = null;
    }
  }, [handleWindowPointerMove, handleWindowPointerUp]);

  const cleanupDialogListeners = React.useCallback(() => {
    window.removeEventListener("pointermove", handleDialogPointerMove);
    window.removeEventListener("pointerup", handleDialogPointerUp);
    window.removeEventListener("pointercancel", handleDialogPointerUp);
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
    window.removeEventListener("pointercancel", handleResizePointerUp);
    if (dialogUserSelectRef.current !== null) {
      document.body.style.userSelect = dialogUserSelectRef.current;
      dialogUserSelectRef.current = null;
    }
  }, [handleDialogPointerMove, handleDialogPointerUp, handleResizePointerMove, handleResizePointerUp]);

  React.useEffect(() => {
    return () => {
      cleanupDragListeners();
      cleanupDialogListeners();
    };
  }, [cleanupDialogListeners, cleanupDragListeners]);

  return (
    <>
      {/* 悬浮按钮 - 只在 showButton=true 时显示 */}
      {showButton && (
        <div
          ref={containerRef}
          className={`z-20 flex items-center gap-2 select-none ${position ? "fixed" : "absolute top-4 right-4"} cursor-grab active:cursor-grabbing`}
          style={position ? {left: position.x, top: position.y, touchAction: "none"} : {touchAction: "none"}}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
        >
          <button
            onClick={toggleDialog}
            disabled={disabled}
            aria-pressed={showPromptInput}
            aria-label={showPromptInput ? "Close AI assistant" : "Open AI assistant"}
            className={`group relative flex h-11 w-11 items-center justify-center rounded-full border text-slate-700 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.5)] transition-all hover:shadow-[0_20px_44px_-24px_rgba(15,23,42,0.6)] disabled:cursor-not-allowed disabled:opacity-60 ${
              showPromptInput
                ? "border-slate-900/80 bg-slate-900 text-white"
                : "border-slate-200/70 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
            } ${isGenerating ? "ring-2 ring-emerald-400/40" : ""}`}
            type="button"
          >
            <Sparkles
              size={18}
              className={`transition-transform duration-300 group-hover:rotate-12 ${
                isGenerating ? "animate-spin text-emerald-400" : ""
              }`}
            />
          </button>

          {onOptimize && (
            <button
              onClick={() => onOptimize()}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-all hover:shadow-xl">
              <Layout size={16} />
              优化布局
            </button>
          )}

          {onBeautify && (
            <button
              onClick={() => onBeautify()}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-all hover:shadow-xl">
              <Palette size={16} />
              美化样式
            </button>
          )}

          {onRegenerate && (
            <button
              onClick={() => onRegenerate()}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-all hover:shadow-xl">
              <RotateCcw size={16} />
              重新生成
            </button>
          )}
        </div>
      )}

      {showPromptInput && (
        <div
          ref={dialogRef}
          className="fixed z-30 flex flex-col rounded-[26px] border border-slate-200/70 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)]"
          style={{
            left: dialogPosition?.x ?? FLOATING_MARGIN_PX,
            top: dialogPosition?.y ?? FLOATING_MARGIN_PX,
            width: dialogSize.width,
            height: dialogSize.height,
            minWidth: MIN_DIALOG_SIZE.width,
            minHeight: MIN_DIALOG_SIZE.height,
          }}
        >
          {!hasCustomDialog && (
            <div
              className="flex cursor-grab items-center justify-between gap-2 border-b border-slate-200/70 px-5 pb-3 pt-4 text-slate-900 active:cursor-grabbing dark:border-white/10 dark:text-slate-50"
              onPointerDown={handleDialogPointerDown}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-slate-400/80">
                  <span className="h-2 w-2 rounded-full bg-slate-300/70 dark:bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-slate-300/50 dark:bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-slate-300/30 dark:bg-white/10" />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {resolvedTitle}
                </h3>
              </div>
              <button
                onClick={handleClose}
                onPointerDown={(event) => event.stopPropagation()}
                disabled={isGenerating || isConverting}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white/70 text-slate-500 transition hover:border-slate-300 hover:bg-white/90 hover:text-slate-700 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div className={hasCustomDialog ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-2"}>
            {hasCustomDialog ? (
              renderDialogContent({
                close: handleClose,
                dragHandleProps: {
                  onPointerDown: handleDialogPointerDown,
                },
              })
            ) : step === "prompt" ? (
              // 第一步：输入描述
              <>
                <textarea
                  className="w-full min-h-[110px] rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 input-scroll dark:border-gray-700 dark:text-gray-100"
                  autoFocus
                  placeholder="例如：包含注册、登录、重置密码的用户认证流程图"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleGenerateMermaid();
                    }
                  }}
                />
                {error && (
                  <div className="mt-2 flex items-start gap-2 text-sm text-rose-500">
                    <span className="shrink-0">❌</span>
                    <span>{error}</span>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
                  <button
                    onClick={handleNextStep}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    下一步
                    <ChevronRight size={16} />
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleFillExample}
                      onMouseDown={(e) => e.preventDefault()}
                      className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Lightbulb size={14} />
                      示例
                    </button>
                    <button
                      onClick={handleGenerateMermaid}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={!prompt.trim() || isGenerating}
                      className="flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500 hover:text-white disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          生成中…
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          生成 Mermaid
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // 第二步：显示 Mermaid 代码 + 转换按钮
              <>
                <textarea
                  className="w-full min-h-[200px] rounded-xl border border-gray-300 bg-gray-50 p-4 font-mono text-sm text-gray-900 input-scroll dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  autoFocus
                  value={generatedMermaid ?? ""}
                  onChange={(event) => setGeneratedMermaid(event.target.value)}
                />
                {error && (
                  <div className="mt-2 flex items-start gap-2 text-sm text-rose-500">
                    <span className="shrink-0">❌</span>
                    <span>{error}</span>
                  </div>
                )}
                <div className="mt-4 flex justify-between text-sm">
                  <button
                    onClick={handleReset}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={isConverting}
                    className="flex items-center rounded-full border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft size={16} /> 上一步
                  </button>
                  <button
                    onClick={handleConvert}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={isConverting || !generatedMermaid?.trim()}
                    className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-500 hover:text-white disabled:opacity-50"
                  >
                    {isConverting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        转换中…
                      </>
                    ) : (
                      <>
                        转换为 Excalidraw
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <div
            className="absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize"
            onPointerDown={handleResizePointerDown}
          >
            <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-slate-400/70 dark:border-white/30" />
            <div className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-slate-400/40 dark:border-white/20" />
          </div>
        </div>
      )}
    </>
  );
};
