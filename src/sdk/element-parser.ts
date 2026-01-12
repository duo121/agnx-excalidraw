export interface ExcalidrawElementLike {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch";
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  seed?: number;
  index?: string;  // Fractional index for element ordering
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  points?: number[][];
  startArrowhead?: "arrow" | "bar" | "dot" | "triangle" | null;
  endArrowhead?: "arrow" | "bar" | "dot" | "triangle" | null;
  roundness?: {type: number} | null;
  containerId?: string | null;
  boundElements?: {type: "text"; id: string}[] | null;
  startBinding?: {elementId: string; focus: number; gap: number} | null;
  endBinding?: {elementId: string; focus: number; gap: number} | null;
}

export interface ParseResult {
  elements: ExcalidrawElementLike[];
  remainingBuffer: string;
  parseErrors?: Array<{json: string; error: string}>;
  repairedElements?: ExcalidrawElementLike[];  // 只包含修复后的元素
}

const COLOR_PALETTE = [
  {stroke: "#f97316", fill: "#fed7aa"},
  {stroke: "#8b5cf6", fill: "#ddd6fe"},
  {stroke: "#60a5fa", fill: "#bfdbfe"},
  {stroke: "#ef4444", fill: "#fecaca"},
  {stroke: "#22c55e", fill: "#bbf7d0"},
  {stroke: "#f59e0b", fill: "#fde68a"},
  {stroke: "#14b8a6", fill: "#99f6e4"},
  {stroke: "#ec4899", fill: "#fbcfe8"},
  {stroke: "#6366f1", fill: "#c7d2fe"},
  {stroke: "#64748b", fill: "#e2e8f0"},
];

const DEFAULT_TEXT_STROKE_LIGHT = "#1e1e1e";
const DEFAULT_TEXT_STROKE_DARK = "#ffffff";
const ARROW_BINDING_DISTANCE = 80;

const normalizeColor = (value?: string | null) => {
  if (!value) return "";
  return value.trim().toLowerCase();
};

const isMissingColor = (value?: string | null) => {
  const normalized = normalizeColor(value);
  return !normalized || normalized === "transparent";
};

const getThemeTextStroke = (isDark: boolean) => {
  return isDark ? DEFAULT_TEXT_STROKE_DARK : DEFAULT_TEXT_STROKE_LIGHT;
};

const getPointDistanceToRect = (x: number, y: number, rect: ExcalidrawElementLike) => {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
};

const resolveArrowEndpoints = (element: ExcalidrawElementLike) => {
  const points = Array.isArray(element.points) && element.points.length >= 2
    ? element.points
    : [[0, 0], [element.width || 0, element.height || 0]];
  const start = {
    x: element.x + points[0][0],
    y: element.y + points[0][1],
  };
  const last = points[points.length - 1];
  const end = {
    x: element.x + last[0],
    y: element.y + last[1],
  };
  return {start, end};
};

const applyStyleDefaults = (
  elements: ExcalidrawElementLike[],
  options: {isDark?: boolean} = {}
): ExcalidrawElementLike[] => {
  const isDark = Boolean(options.isDark);
  const themeTextStroke = getThemeTextStroke(isDark);
  const shapeIds = new Map<string, ExcalidrawElementLike>();
  const shapeColors = new Map<string, {stroke: string; fill: string}>();
  let paletteIndex = 0;

  const isShape = (element: ExcalidrawElementLike) =>
    element.type === "rectangle" || element.type === "ellipse" || element.type === "diamond";

  elements.forEach((element) => {
    if (!element?.id || !isShape(element)) return;
    shapeIds.set(element.id, element);
    const strokeMissing = isMissingColor(element.strokeColor);
    const backgroundMissing =
      isMissingColor(element.backgroundColor) || element.backgroundColor === "transparent";
    if (strokeMissing || backgroundMissing) {
      const palette = COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length];
      shapeColors.set(element.id, palette);
      paletteIndex += 1;
    }
  });

  const resolveNearestShape = (x: number, y: number) => {
    let best: {element: ExcalidrawElementLike; distance: number} | null = null;
    shapeIds.forEach((shape) => {
      const distance = getPointDistanceToRect(x, y, shape);
      if (!best || distance < best.distance) {
        best = {element: shape, distance};
      }
    });
    if (best && best.distance <= ARROW_BINDING_DISTANCE) {
      return best.element;
    }
    return null;
  };

  const resolveShapeStroke = (shape?: ExcalidrawElementLike | null) => {
    if (!shape) return "";
    if (!isMissingColor(shape.strokeColor)) {
      return shape.strokeColor || "";
    }
    return shapeColors.get(shape.id)?.stroke || "";
  };

  return elements.map((element) => {
    if (!element) return element;
    let next = element;

    if (isShape(element)) {
      const palette = shapeColors.get(element.id);
      const strokeMissing = isMissingColor(element.strokeColor);
      const backgroundMissing =
        isMissingColor(element.backgroundColor) || element.backgroundColor === "transparent";
      const nextStroke = strokeMissing && palette ? palette.stroke : element.strokeColor;
      const nextBackground = backgroundMissing && palette ? palette.fill : element.backgroundColor;
      next = {
        ...next,
        strokeColor: nextStroke || element.strokeColor,
        backgroundColor: nextBackground || element.backgroundColor,
        fillStyle: element.fillStyle || "solid",
        strokeWidth: element.strokeWidth ?? 2,
        roughness: element.roughness ?? 2,
        roundness: element.roundness ?? {type: 3},
      };
    }

    if (element.type === "text") {
      const strokeMissing = isMissingColor(element.strokeColor);
      const containerId = element.containerId || null;
      const containerStroke = containerId
        ? resolveShapeStroke(shapeIds.get(containerId) || null)
        : "";
      if (strokeMissing && containerStroke) {
        next = {...next, strokeColor: containerStroke};
      } else if (strokeMissing) {
        next = {...next, strokeColor: themeTextStroke};
      }
    }

    if (element.type === "arrow") {
      const strokeMissing = isMissingColor(element.strokeColor);
      const {start, end} = resolveArrowEndpoints(element);
      const startShape = element.startBinding?.elementId
        ? shapeIds.get(element.startBinding.elementId)
        : resolveNearestShape(start.x, start.y);
      const endShape = element.endBinding?.elementId
        ? shapeIds.get(element.endBinding.elementId)
        : resolveNearestShape(end.x, end.y);
      const startStroke = resolveShapeStroke(startShape || null);
      const endStroke = resolveShapeStroke(endShape || null);

      const nextArrow: ExcalidrawElementLike = {...next};
      if (!nextArrow.startBinding && startShape) {
        nextArrow.startBinding = {elementId: startShape.id, focus: 0, gap: 0};
      }
      if (!nextArrow.endBinding && endShape) {
        nextArrow.endBinding = {elementId: endShape.id, focus: 0, gap: 0};
      }
      if (strokeMissing) {
        nextArrow.strokeColor =
          startStroke ||
          endStroke ||
          element.strokeColor ||
          themeTextStroke;
      }
      nextArrow.strokeWidth = element.strokeWidth ?? 2;
      nextArrow.roughness = element.roughness ?? 2;
      next = nextArrow;
    }

    if (element.type === "line") {
      if (isMissingColor(element.strokeColor)) {
        next = {...next, strokeColor: themeTextStroke};
      }
      next = {
        ...next,
        strokeWidth: element.strokeWidth ?? 2,
        roughness: element.roughness ?? 2,
      };
    }

    return next;
  });
};

interface ExtractedJson {
  json: string;
  endIndex: number;
  isValid: boolean;  // JSON 结构是否完整（括号匹配）
}

/**
 * 从文本中提取 JSON 对象
 * 改进：遇到无法匹配的 JSON 时，尝试用简单方法找到下一个换行后的 { 继续搜索
 */
const extractJsonObjects = (text: string): ExtractedJson[] => {
  const results: ExtractedJson[] = [];
  let i = 0;
  
  while (i < text.length) {
    const startIndex = text.indexOf("{", i);
    if (startIndex === -1) break;

    // 方法1：使用状态机解析（处理嵌套和字符串）
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;

    for (let j = startIndex; j < text.length; j += 1) {
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
          endIndex = j + 1;
          break;
        }
      }
    }

    if (endIndex > startIndex) {
      // 成功找到匹配的 JSON 对象
      results.push({
        json: text.slice(startIndex, endIndex),
        endIndex,
        isValid: true,
      });
      i = endIndex;
    } else {
      // 状态机解析失败，可能是：
      // 1. JSON 还在流式传输中（不完整）
      // 2. JSON 有语法错误（如多余的引号）
      
      // 尝试找到当前行的结束位置
      const lineEnd = text.indexOf("\n", startIndex);
      
      // 如果没有找到换行符，说明这个 JSON 可能还在流式传输中，跳过不处理
      if (lineEnd === -1) {
        // 留在 buffer 中，等待更多数据
        break;
      }
      
      // 有换行符，说明这行已经完成，但 JSON 结构有错误
      const brokenJson = text.slice(startIndex, lineEnd).trim();
      
      // 检查是否看起来像 JSON（以 { 开头且包含常见字段）
      if (brokenJson.startsWith("{") && /"(id|type|x|y)"\s*:/.test(brokenJson)) {
        // 尝试找到这个 JSON 的结尾（最后一个 }）
        const lastBrace = brokenJson.lastIndexOf("}");
        if (lastBrace > 0) {
          const possibleJson = brokenJson.slice(0, lastBrace + 1);
          results.push({
            json: possibleJson,
            endIndex: startIndex + lastBrace + 1,
            isValid: false,  // 标记为可能无效
          });
        } else {
          // 没有找到 }，记录整行
          results.push({
            json: brokenJson,
            endIndex: lineEnd,
            isValid: false,
          });
        }
      }
      
      // 继续从下一行开始搜索
      i = lineEnd + 1;
    }
  }
  return results;
};

const getDefaultElementProps = () => ({
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  roughness: 1,
  opacity: 100,
  seed: Math.floor(Math.random() * 100000),
  version: 1,
  versionNonce: Math.floor(Math.random() * 1000000000),
  isDeleted: false,
  groupIds: [],
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
});

const getTypeSpecificProps = (type: string, element: Partial<ExcalidrawElementLike>) => {
  if (type === "text") {
    return {
      fontSize: 20,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      baseline: 18,
      containerId: null,
      originalText: element.text || "",
      lineHeight: 1.25,
    };
  }

  if (type === "arrow" || type === "line") {
    return {
      points: element.points || [[0, 0], [element.width || 100, element.height || 0]],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: type === "arrow" ? "arrow" : null,
    };
  }

  return {
    roundness: {type: 3},
  };
};

export const parseExcalidrawElements = (
  text: string,
  processedLength = 0,
  options: {isDark?: boolean} = {}
): ParseResult => {
  const elements: ExcalidrawElementLike[] = [];
  const parseErrors: Array<{json: string; error: string}> = [];
  const newText = text.slice(processedLength);
  const jsonObjects = extractJsonObjects(newText);
  let lastIndex = 0;
  let currentFractionalIndex = 'a0';  // 初始 fractional index

  for (const {json, endIndex, isValid} of jsonObjects) {
    // 如果提取器已经标记为无效，直接记录错误，不尝试解析
    if (!isValid) {
      parseErrors.push({json, error: 'JSON 结构不完整（括号不匹配或存在语法错误）'});
      lastIndex = endIndex;
      continue;
    }
    
    try {
      const element = JSON.parse(json) as ExcalidrawElementLike;
      const validTypes = ["rectangle", "ellipse", "diamond", "text", "arrow", "line"];
      if (element.id && element.type && validTypes.includes(element.type) && typeof element.x === "number") {
        const finalElement = {
          ...getDefaultElementProps(),
          ...getTypeSpecificProps(element.type, element),
          ...element,
          // 如果 AI 没有提供 index，使用自动生成的
          index: element.index || currentFractionalIndex,
        };
        elements.push(finalElement as ExcalidrawElementLike);
        // 生成下一个index
        currentFractionalIndex = generateNextFractionalIndex(currentFractionalIndex);
      }
      lastIndex = endIndex;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      parseErrors.push({json, error: errorMsg});
      lastIndex = endIndex;
    }
  }

  const newProcessedLength = processedLength + lastIndex;
  return {
    elements: applyStyleDefaults(elements, options),
    remainingBuffer: text.slice(newProcessedLength),
    parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
  };
};

// 简单的 fractional index 生成器
function generateNextFractionalIndex(current: string): string {
  // 简化版本：递增数字部分
  const match = current.match(/^([a-z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    return `${prefix}${num + 1}`;
  }
  return 'a1';
}

export const hasIncompleteBlock = (text: string): boolean => {
  const lastOpen = text.lastIndexOf("{");
  const lastClose = text.lastIndexOf("}");
  return lastOpen > lastClose;
};

export const generateElementId = (): string => {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * 带 AI 修复功能的元素解析（异步版本，批量并行处理）
 * 先尝试正常解析，如果有错误且启用了 AI 修复，则批量并行修复失败的 JSON
 */
export const parseExcalidrawElementsWithRepair = async (
  text: string,
  processedLength = 0,
  options: {
    isDark?: boolean;
    enableAIRepair?: boolean;
    repairFn?: (json: string) => Promise<string | null>;
    maxRepairCount?: number;  // 最大修复数量，避免成本过高
  } = {}
): Promise<ParseResult> => {
  // 第一步：正常解析
  const firstPass = parseExcalidrawElements(text, processedLength, options);
  
  // 如果没有解析错误或未启用 AI 修复，直接返回
  if (!options.enableAIRepair || !firstPass.parseErrors?.length || !options.repairFn) {
    return firstPass;
  }
  
  // 限制修复数量，避免成本过高
  const maxRepair = options.maxRepairCount ?? 10;
  const errorsToRepair = firstPass.parseErrors.slice(0, maxRepair);
  
  if (errorsToRepair.length < firstPass.parseErrors.length) {
    console.warn(
      `[Excalidraw] 检测到 ${firstPass.parseErrors.length} 个错误，` +
      `但只修复前 ${maxRepair} 个以控制成本`
    );
  }
  
  console.log(`[Excalidraw] 检测到 ${errorsToRepair.length} 个 JSON 解析错误，批量并行修复中...`);
  
  // 记录当前最大的 index，以便为修复的元素生成新的 index
  let maxIndex = 'a0';
  if (firstPass.elements.length > 0) {
    const lastElement = firstPass.elements[firstPass.elements.length - 1];
    maxIndex = (lastElement as any).index || 'a0';
  }
  
  // 第二步：批量并行修复失败的 JSON
  const repairPromises = errorsToRepair.map(async ({json}, index) => {
    try {
      const repaired = await options.repairFn!(json);
      if (!repaired) {
        console.warn(`[Excalidraw] AI 无法修复第 ${index + 1} 个 JSON`);
        return null;
      }
      
      // 尝试解析修复后的 JSON
      const element = JSON.parse(repaired) as ExcalidrawElementLike;
      const validTypes = ["rectangle", "ellipse", "diamond", "text", "arrow", "line"];
      
      if (element.id && element.type && validTypes.includes(element.type)) {
        // 为修复的元素生成新的 fractional index
        const newIndex = generateNextFractionalIndex(maxIndex);
        maxIndex = newIndex;  // 更新 maxIndex 以便下一个使用
        
        return {
          ...getDefaultElementProps(),
          ...getTypeSpecificProps(element.type, element),
          ...element,
          index: element.index || newIndex,  // 使用自动生成的 index
        } as ExcalidrawElementLike;
      }
      
      console.warn(`[Excalidraw] 修复后的第 ${index + 1} 个 JSON 缺少必要字段或类型无效`);
      return null;
    } catch (error) {
      // 修复后的 JSON 仍然无法解析
      console.warn(
        `[Excalidraw] 第 ${index + 1} 个 JSON 修复后仍然无法解析:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  });
  
  // 等待所有修复完成（并行）
  const repairResults = await Promise.all(repairPromises);
  const repairedElements = repairResults.filter((el): el is ExcalidrawElementLike => el !== null);
  
  if (repairedElements.length > 0) {
    console.log(`[Excalidraw] 成功修复 ${repairedElements.length}/${errorsToRepair.length} 个元素`);
  } else {
    console.warn('[Excalidraw] 所有修复尝试均失败');
  }
  
  // 第三步：返回结果，包含原始元素和单独的修复元素列表
  return {
    elements: firstPass.elements,  // 保持原始成功解析的元素不变
    remainingBuffer: firstPass.remainingBuffer,
    parseErrors: [],  // 已处理，清空错误列表
    repairedElements: applyStyleDefaults(repairedElements, options)  // 单独返回修复后的元素
  };
};
