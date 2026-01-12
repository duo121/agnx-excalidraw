const DEFAULT_STROKE_LIGHT = "#1e1e1e";
const DEFAULT_STROKE_DARK = "#ffffff";
const DEFAULT_BACKGROUND = "transparent";

/**
 * 根据主题获取默认描边颜色
 */
function getDefaultStrokeColor(isDark: boolean): string {
  return isDark ? DEFAULT_STROKE_DARK : DEFAULT_STROKE_LIGHT;
}

/**
 * 计算颜色的亮度（luminance）
 * @param color - 颜色值（hex 或 rgb）
 * @returns 亮度值 (0-1)，0 最暗，1 最亮
 */
function getColorLuminance(color: string): number {
  if (!color) return 0;

  const normalized = color.toLowerCase().trim();

  // 尝试解析 hex 颜色
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r =
      hex.length === 3
        ? parseInt(hex[0] + hex[0], 16)
        : parseInt(hex.substring(0, 2), 16);
    const g =
      hex.length === 3
        ? parseInt(hex[1] + hex[1], 16)
        : parseInt(hex.substring(2, 4), 16);
    const b =
      hex.length === 3
        ? parseInt(hex[2] + hex[2], 16)
        : parseInt(hex.substring(4, 6), 16);

    // 计算相对亮度 (0-1)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // 尝试解析 rgb 颜色
  const rgbMatch = normalized.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  return 0.5; // 默认中等亮度
}

/**
 * 检查颜色是否为深色（亮度低）
 * @param color - 颜色值（hex 或 rgb）
 * @returns 是否为深色
 */
function isDarkColor(color: string): boolean {
  if (!color) return false;

  const normalized = color.toLowerCase().trim();

  // 检查常见的深色值
  const darkColors = [
    "#000",
    "#000000",
    "#1e1e1e",
    "#1a1a1a",
    "#2a2a2a",
    "#333",
    "#333333",
    "rgb(0, 0, 0)",
    "rgb(30, 30, 30)",
    "rgb(26, 26, 26)",
    "rgb(42, 42, 42)",
    "rgb(51, 51, 51)"
  ];

  if (darkColors.includes(normalized)) {
    return true;
  }

  // 使用亮度判断
  return getColorLuminance(color) < 0.5;
}

/**
 * 将 label 对象转换为独立的文本元素
 *
 * Excalidraw 中，形状的文本需要是独立的 text 元素，并通过 boundElements 绑定
 *
 * @param element - 原始元素
 * @param label - label 对象 {text: string, fontSize?: number}
 * @param textId - 文本元素的 ID
 * @returns 文本元素对象
 */
function createTextElementFromLabel(
  element: any,
  label: {text: string; fontSize?: number; [key: string]: any},
  textId: string,
  parentId: string,
  defaultStroke: string
): any {
  const fontSize = label.fontSize || 16;

  // 估算文本宽度（粗略计算，中文字符按 1.2 倍宽度）
  const estimatedTextWidth = label.text.length * (fontSize * 0.6);
  const estimatedTextHeight = fontSize * 1.2;

  // 计算文本位置（居中在形状内）
  // 注意：Excalidraw 的文本元素 x, y 是文本的左上角，不是中心点
  const textX = element.x + (element.width || 0) / 2 - estimatedTextWidth / 2;
  const textY = element.y + (element.height || 0) / 2 - estimatedTextHeight / 2;

  // 生成随机数用于 seed 和 versionNonce
  const seed = Math.floor(Math.random() * 1000000000);
  const versionNonce = Math.floor(Math.random() * 1000000000);

  return {
    type: "text",
    version: 4, // Excalidraw 文本元素版本
    versionNonce: versionNonce,
    isDeleted: false,
    id: textId,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    x: textX,
    y: textY,
    strokeColor: element.strokeColor || defaultStroke,
    backgroundColor: "transparent",
    width: estimatedTextWidth,
    height: estimatedTextHeight,
    seed: seed,
    groupIds: Array.isArray(label.groupIds) ? [...label.groupIds] : [],
    frameId: null,
    roundness: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: fontSize,
    fontFamily: 1, // 1 = Virgil (Excalidraw 默认字体)
    text: label.text,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: fontSize,
    containerId: parentId, // ✅ 关键：指向父元素 ID
    originalText: label.text,
    lineHeight: 1.25
  };
}

/**
 * 清理并转换 Excalidraw 元素
 *
 * 主要功能：
 * 1. 标准化颜色和样式（根据主题）
 * 2. 将 label 对象转换为独立的文本元素
 * 3. 使用 boundElements 将文本绑定到形状
 *
 * @param elements - 原始元素数组
 * @param options - 选项
 * @param options.isDark - 是否为暗色主题（默认 false）
 * @param options.mode - 清洗模式："default" 严格清洗（AI/DSL），"mermaid" 轻量清洗（Mermaid）
 */
export async function sanitizeExcalidrawElements(
  elements: any[] = [],
  options: {isDark?: boolean; preferredStrokeColor?: string; mode?: "default" | "mermaid"} = {}
) {
  const {isDark = false, preferredStrokeColor, mode = "default"} = options;
  const defaultStroke = preferredStrokeColor || getDefaultStrokeColor(isDark);
  if (!elements || elements.length === 0) {
    return [];
  }

  console.log("[sanitize] 原始元素数量:", elements.length);
  console.log(
    "[sanitize] 第一个元素示例:",
    JSON.stringify(elements[0], null, 2)
  );
  if (mode === "mermaid") {
    console.log("[sanitize] 🧜 Mermaid 轻量清洗模式启用");
    // 打印所有文本元素的宽度信息
    const textElements = elements.filter(el => el?.type === "text");
    if (textElements.length > 0) {
      console.log(`[sanitize] 找到 ${textElements.length} 个文本元素，第一个:`, {
        id: textElements[0].id,
        text: textElements[0].text,
        width: textElements[0].width,
        height: textElements[0].height,
        fontSize: textElements[0].fontSize,
        lineHeight: textElements[0].lineHeight,
        textAlign: textElements[0].textAlign
      });
    }
  }

  const processedElements: any[] = [];
  const textElements: any[] = [];
  const elementById = new Map<string, any>();
  const normalizeBoundElements = (value: any) => {
    if (!Array.isArray(value)) return undefined;
    return value
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          return {id: item, type: "text"};
        }
        if (typeof item === "object" && item.id) {
          return {id: item.id, type: item.type || "text"};
        }
        return null;
      })
      .filter(Boolean);
  };

  // 第一遍：处理所有元素，提取 label 并创建文本元素
  elements.forEach((element) => {
    if (!element) return;

    // ✅ 获取元素的原始描边颜色
    const originalStroke =
      element.strokeColor ||
      element.color ||
      element?.styles?.stroke ||
      defaultStroke;

    // 颜色处理：根据 mode 采用不同策略
    let stroke = originalStroke;
    
    if (mode === "mermaid") {
      // Mermaid 模式：轻量处理，只在缺失时补充
      // 保留 Mermaid 解析器输出的原始颜色
      stroke = originalStroke;
    } else {
      // Default 模式：强制颜色反转，确保可见性（用于 AI/DSL）
      const luminance = getColorLuminance(originalStroke);

      if (isDark) {
        // 暗色主题：除非颜色非常亮（接近白色），否则强制改为白色
        if (!originalStroke || luminance < 0.85) {
          stroke = defaultStroke; // 强制使用白色 #ffffff
          if (originalStroke && originalStroke !== defaultStroke) {
            console.log(
              `[sanitize] 暗色主题：元素 ${element.id} (${element.type}) 颜色 ${originalStroke} (亮度 ${luminance.toFixed(2)}) → 改为白色`
            );
          }
        }
      } else {
        // 亮色主题：除非颜色非常深（<0.15，接近黑色），否则强制改为深色
        if (!originalStroke || luminance > 0.15) {
          stroke = defaultStroke; // 强制使用深色 #1e1e1e
          if (originalStroke && originalStroke !== defaultStroke) {
            console.log(
              `[sanitize] 亮色主题：元素 ${element.id} (${element.type}) 颜色 ${originalStroke} (亮度 ${luminance.toFixed(2)}) → 改为深色`
            );
          }
        }
      }
    }

    const background =
      element.backgroundColor &&
      typeof element.backgroundColor === "string" &&
      element.backgroundColor.length > 0
        ? element.backgroundColor
        : DEFAULT_BACKGROUND;

    // 构建清理后的元素 - 明确复制属性，避免循环引用
    // ⚠️ 不使用 ...element，避免可能的循环引用导致堆栈溢出
    const sanitizedElement: any = {
      // 核心属性
      type: element.type,
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      angle: element.angle ?? 0,

      // 样式属性：根据 mode 决定是否保留原值
      fillStyle: mode === "mermaid" 
        ? (element.fillStyle || "solid")  // Mermaid: 保留原值或默认 solid
        : (element.fillStyle || "hachure"), // Default: 默认 hachure
      strokeStyle: element.strokeStyle || "solid",
      strokeWidth: mode === "mermaid"
        ? (element.strokeWidth ?? 2)  // Mermaid: 保留原值
        : (element.strokeWidth ?? 2),  // Default: 保留原值，后续会强制 >= 3
      strokeColor: stroke,
      backgroundColor: background,
      roughness: element.roughness ?? 1,
      opacity: element.opacity ?? 100,

      // Excalidraw 必需属性
      version: element.version ?? 4,
      versionNonce: element.versionNonce ?? Math.floor(Math.random() * 1000000000),
      seed: element.seed ?? Math.floor(Math.random() * 1000000000),
      updated: element.updated ?? Date.now(),
      isDeleted: element.isDeleted ?? false,
      locked: element.locked ?? false,
      roundness: element.roundness ?? null,
      groupIds: Array.isArray(element.groupIds) ? [...element.groupIds] : [],
      frameId: element.frameId ?? null,
      link: element.link ?? null,

      // 线性元素（arrow、line）必需属性
      ...((element.type === "arrow" || element.type === "line") && {
        // 如果已有 points，使用它；否则根据 x, y, width, height 生成
        points: (() => {
          if (Array.isArray(element.points) && element.points.length > 0) {
            return [...element.points];
          }
          // 如果没有 points，根据 width 和 height 生成
          // 如果 width 和 height 都是 0，至少生成一个有效的点对
          const width = element.width || 0;
          const height = element.height || 0;
          if (width === 0 && height === 0) {
            // 如果都是 0，生成一个最小长度的线段
            return [
              [0, 0],
              [1, 0]
            ];
          }
          return [
            [0, 0],
            [width, height]
          ];
        })(),
        startBinding: element.startBinding ?? null,
        endBinding: element.endBinding ?? null,
        lastCommittedPoint: element.lastCommittedPoint ?? null
      }),

      // 箭头特定属性
      ...(element.type === "arrow" && {
        startArrowhead: element.startArrowhead ?? null,
        endArrowhead: element.endArrowhead ?? "arrow"
      }),

      // 其他可能存在的属性（安全复制）
      ...(element.start && {start: element.start}),
      ...(element.end && {end: element.end}),
      ...(element.type === "text" && {
        text: element.text ?? "",
        fontSize: element.fontSize ?? 16,
        fontFamily: element.fontFamily ?? 1,
        textAlign: element.textAlign || "center",  // Mermaid 可能有自己的 textAlign
        verticalAlign: element.verticalAlign || "middle",  // Mermaid 可能有自己的 verticalAlign
        baseline: element.baseline ?? element.fontSize ?? 16,
        containerId: element.containerId ?? null,
        originalText: element.originalText ?? element.text ?? "",
        lineHeight: element.lineHeight ?? 1.25  // 保留原始 lineHeight
      }),
      ...(normalizeBoundElements(element.boundElements) && {
        boundElements: normalizeBoundElements(element.boundElements),
      })
      // 注意：boundElements 会在处理 label 时设置，这里不初始化
      // 注意：label 属性会被删除，不在这里复制
    };

    // 处理 label：如果是对象格式，转换为文本元素
    if (element.label) {
      let textElement: any = null;
      let textId = `${element.id}_label`;

      if (typeof element.label === "object" && element.label.text) {
        // 对象格式的 label
        textElement = createTextElementFromLabel(
          sanitizedElement,
          element.label,
          textId,
          element.id, // 传递父元素 ID
          defaultStroke
        );
      } else if (typeof element.label === "string") {
        // 字符串格式的 label
        textElement = createTextElementFromLabel(
          sanitizedElement,
          {text: element.label},
          textId,
          element.id, // 传递父元素 ID
          defaultStroke
        );
      }

      if (textElement) {
        // 特殊处理：箭头标签位置在箭头中点
        if (element.type === "arrow" && element.points && element.points.length > 0) {
          const midPoint = element.points[Math.floor(element.points.length / 2)];
          textElement.x = (element.x || 0) + midPoint[0] - textElement.width / 2;
          textElement.y =
            (element.y || 0) + midPoint[1] - textElement.height / 2;
        }

        textElements.push({
          textElement,
          parentId: element.id
        });

        // 从原元素中移除 label 属性
        delete sanitizedElement.label;

        // 初始化 boundElements 数组（如果不存在）
        if (!sanitizedElement.boundElements) {
          sanitizedElement.boundElements = [];
        }

        // 添加文本元素到 boundElements
        sanitizedElement.boundElements.push({
          type: "text",
          id: textId
        });
      }
    }

    processedElements.push(sanitizedElement);
    if (sanitizedElement?.id) {
      elementById.set(sanitizedElement.id, sanitizedElement);
    }
  });

  // 第二遍：添加所有文本元素
  textElements.forEach(({textElement}) => {
    processedElements.push(textElement);
    if (textElement?.id) {
      elementById.set(textElement.id, textElement);
    }
  });

  // 补齐 boundElements：字符串 -> 对象，缺失 type 时从目标元素推断
  processedElements.forEach((el) => {
    if (!el || !Array.isArray(el.boundElements)) return;
    el.boundElements = el.boundElements
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === "string") {
          const target = elementById.get(item);
          return {id: item, type: target?.type || "text"};
        }
        if (typeof item === "object" && item.id) {
          const target = elementById.get(item.id);
          return {id: item.id, type: item.type || target?.type || "text"};
        }
        return null;
      })
      .filter(Boolean);
  });

  // 第三遍：补齐文本绑定到容器的 boundElements
  processedElements.forEach((el) => {
    if (el?.type !== "text") return;
    const parentId = el.containerId;
    if (!parentId) return;
    const parent = elementById.get(parentId);
    if (!parent) return;
    parent.boundElements = Array.isArray(parent.boundElements) ? [...parent.boundElements] : [];
    if (!parent.boundElements.find((be: any) => be?.id === el.id && be?.type === "text")) {
      parent.boundElements.push({type: "text", id: el.id});
    }
    // 尝试将文本居中到父元素
    if (typeof parent.x === "number" && typeof parent.y === "number" && parent.width && parent.height) {
      if (mode === "mermaid") {
        // Mermaid 模式：保留原始宽度，但确保位置居中
        // 如果宽度不够，扩展宽度以适应文本
        const fontSize = el.fontSize || 16;
        const text = el.text || "";
        // 粗略估算文本需要的最小宽度（中文字符按 1倍 fontSize 计算）
        const estimatedMinWidth = text.length * fontSize * 0.6;
        const currentWidth = el.width || 0;
        // 如果当前宽度小于估算的最小宽度，扩展它
        const textWidth = Math.max(currentWidth, estimatedMinWidth, parent.width * 0.5);
        const textHeight = el.height || fontSize * 1.5;
        el.width = textWidth;
        el.height = textHeight;
        el.x = parent.x + parent.width / 2 - textWidth / 2;
        el.y = parent.y + parent.height / 2 - textHeight / 2;
      } else {
        // Default 模式：使用父元素宽度的 80%
        const textWidth = el.width || parent.width * 0.8;
        const textHeight = el.height || parent.height * 0.6;
        el.width = textWidth;
        el.height = textHeight;
        el.x = parent.x + parent.width / 2 - textWidth / 2;
        el.y = parent.y + parent.height / 2 - textHeight / 2;
      }
    }
  });

  // 第四遍：为箭头自动绑定最近的起止元素（如果缺失）
  // Mermaid 模式跳过此步骤，保留原始绑定关系
  if (mode !== "mermaid") {
    const shapeElements = processedElements.filter(
      (el) => el && !el.isDeleted && el.type && el.type !== "text"
    );
    const findNearestShape = (px: number, py: number) => {
    let best: any = null;
    let bestDist = Infinity;
    shapeElements.forEach((shape) => {
      const cx = (shape.x || 0) + (shape.width || 0) / 2;
      const cy = (shape.y || 0) + (shape.height || 0) / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = shape;
      }
    });
    return best;
  };

  processedElements.forEach((el) => {
    if (!el || el.type !== "arrow") return;
    const startX = el.x || 0;
    const startY = el.y || 0;
    const endX = startX + (el.width || 0);
    const endY = startY + (el.height || 0);

    // 补齐已有绑定的 focus/gap
    if (el.startBinding) {
      el.startBinding.focus = typeof el.startBinding.focus === "number" ? el.startBinding.focus : 0;
      el.startBinding.gap = typeof el.startBinding.gap === "number" ? el.startBinding.gap : 0;
    }
    if (el.endBinding) {
      el.endBinding.focus = typeof el.endBinding.focus === "number" ? el.endBinding.focus : 0;
      el.endBinding.gap = typeof el.endBinding.gap === "number" ? el.endBinding.gap : 0;
    }

    if (!el.startBinding) {
      const target = findNearestShape(startX, startY);
      if (target?.id) {
        el.startBinding = {elementId: target.id, focus: 0, gap: 0};
      }
    }
    if (!el.endBinding) {
      const target = findNearestShape(endX, endY);
      if (target?.id) {
        el.endBinding = {elementId: target.id, focus: 0, gap: 0};
      }
    }

    // 有绑定时，将箭头端点投影到绑定元素边缘，避免落在中心
    const startEl = el.startBinding ? elementById.get(el.startBinding.elementId) : null;
    const endEl = el.endBinding ? elementById.get(el.endBinding.elementId) : null;
    const gap = 8; // 给端点预留的间距，避免穿入形状

    if (startEl && endEl) {
      const projectToEdge = (from: any, to: any) => {
        const fx = (from.x || 0) + (from.width || 0) / 2;
        const fy = (from.y || 0) + (from.height || 0) / 2;
        const tx = (to.x || 0) + (to.width || 0) / 2;
        const ty = (to.y || 0) + (to.height || 0) / 2;
        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.hypot(dx, dy) || 1;
        // 从 from 边缘出发
        const startPx = fx + (dx / len) * ((from.width || 0) / 2 + gap);
        const startPy = fy + (dy / len) * ((from.height || 0) / 2 + gap);
        // 落到 to 边缘
        const endPx = tx - (dx / len) * ((to.width || 0) / 2 + gap);
        const endPy = ty - (dy / len) * ((to.height || 0) / 2 + gap);
        return {startPx, startPy, endPx, endPy};
      };

      const {startPx, startPy, endPx, endPy} = projectToEdge(startEl, endEl);
      el.x = startPx;
      el.y = startPy;
      el.width = endPx - startPx;
      el.height = endPy - startPy;
      el.points = [
        [0, 0],
        [el.width, el.height],
      ];
      // 更新 gap 回写
      el.startBinding.gap = gap;
      el.endBinding.gap = gap;
    } else {
      // 没有绑定时至少保证 points 与宽高一致
      if (!Array.isArray(el.points) || el.points.length < 2) {
        el.points = [
          [0, 0],
          [el.width || 0, el.height || 0],
        ];
      }
    }
  });
  } // 结束 mode !== "mermaid" 的第四遍处理

  // 第五遍：为文本设置默认描边色（防止文字与手绘纹理冲突）
  processedElements.forEach((el) => {
    if (!el || el.type !== "text") return;
    if (!el.strokeColor) {
      el.strokeColor = DEFAULT_STROKE_LIGHT; // #1e1e1e
    }
  });

  console.log(
    `[sanitize] ✅ 处理完成：${processedElements.length} 个元素（${textElements.length} 个文本元素）`
  );

  // ✅ 尝试使用 convertToExcalidrawElements 来修复元素（如果可用）
  // Mermaid 模式也需要调用，但要保留原始 points
  try {
    // 动态导入 convertToExcalidrawElements（避免 SSR 问题）
    const excalidrawModule = await import("@excalidraw/excalidraw");
    if (excalidrawModule.convertToExcalidrawElements) {
      console.log("[sanitize] 🔧 尝试使用 convertToExcalidrawElements 修复元素");

      // 将处理后的元素转换为 Skeleton 格式
      // 文本已经拆分为独立元素，因此这里只保留几何和样式字段
      const skeletonElements = processedElements.map((el) => {
        const skeleton: any = {
          type: el.type,
          id: el.id, // 保留原始 ID
          x: el.x,
          y: el.y,
          ...(el.width !== undefined && {width: el.width}),
          ...(el.height !== undefined && {height: el.height}),
          ...(el.strokeColor && {strokeColor: el.strokeColor}),
          ...(el.backgroundColor && {backgroundColor: el.backgroundColor}),
          ...(el.strokeWidth && {strokeWidth: el.strokeWidth}),
          ...(el.strokeStyle && {strokeStyle: el.strokeStyle}),
          ...(el.fillStyle && {fillStyle: el.fillStyle}),
          ...(el.points && {points: el.points}),
          ...(el.startBinding && {
            start: {id: el.startBinding.elementId}
          }),
          ...(el.endBinding && {
            end: {id: el.endBinding.elementId}
          }),
          // 文本元素
          ...(el.text && {text: el.text}),
          ...(el.fontSize && {fontSize: el.fontSize}),
          ...(el.fontFamily && {fontFamily: el.fontFamily})
        };
        return skeleton;
      });

      // 使用 convertToExcalidrawElements 转换
      const converted = excalidrawModule.convertToExcalidrawElements(
        skeletonElements,
        {regenerateIds: false} // 不重新生成 ID
      );
      const originalMap = new Map<string, any>();
      processedElements.forEach((el) => {
        if (el?.id) {
          originalMap.set(el.id, el);
        }
      });

      console.log(
        "[sanitize] convertToExcalidrawElements 转换后元素数量:",
        converted.length
      );
      console.log(
        "[sanitize] 转换后第一个元素:",
        JSON.stringify(converted[0], null, 2)
      );

      // 合并转换后的属性，保留我们的颜色处理
      const fixedElements = converted.map((convertedEl, index) => {
        const original =
          (convertedEl.id && originalMap.get(convertedEl.id)) ||
          processedElements[index];
        if (!original) return convertedEl;

        const mergedStrokeColor =
          original.strokeColor ||
          convertedEl.strokeColor ||
          defaultStroke;
        const mergedOpacity =
          (typeof original.opacity === "number" && original.opacity > 0 ? original.opacity : undefined) ??
          (typeof convertedEl.opacity === "number" && convertedEl.opacity > 0 ? convertedEl.opacity : undefined) ??
          100;

        const merged: any = {
          ...convertedEl,
          // ✅ 保留我们处理过的颜色（主题反转）
          strokeColor: mergedStrokeColor,
          opacity: mergedOpacity,
          backgroundColor: original.backgroundColor || convertedEl.backgroundColor,
          // ✅ 保留 boundElements（如果有）
          boundElements: original.boundElements || convertedEl.boundElements,
          // ✅ 保留其他重要属性
          ...(original.points && {points: original.points}),
          ...(original.startBinding && {startBinding: original.startBinding}),
          ...(original.endBinding && {endBinding: original.endBinding})
        };

        if (convertedEl.type === "text") {
          merged.textAlign = "center";
          merged.verticalAlign = "middle";
          merged.containerId = original.containerId ?? convertedEl.containerId ?? null;
          merged.originalText =
            original.originalText ??
            convertedEl.originalText ??
            convertedEl.text;

          if (merged.containerId) {
            const parent =
              originalMap.get(merged.containerId) ||
              converted.find((el) => el.id === merged.containerId) ||
              null;
            if (parent) {
              const textWidth =
                merged.width ??
                convertedEl.width ??
                original.width ??
                0;
              const textHeight =
                merged.height ??
                convertedEl.height ??
                original.height ??
                0;
              const parentWidth = parent.width ?? 0;
              const parentHeight = parent.height ?? 0;
              const parentX = parent.x ?? 0;
              const parentY = parent.y ?? 0;
              merged.x = parentX + parentWidth / 2 - textWidth / 2;
              merged.y = parentY + parentHeight / 2 - textHeight / 2;
            }
          }
        }

        return merged;
      });

      // 重新添加文本元素（如果有）
      if (textElements.length > 0) {
        textElements.forEach(({textElement}) => {
          // 检查是否已经在 fixedElements 中
          if (!fixedElements.find((el) => el.id === textElement.id)) {
            fixedElements.push(textElement);
          }
        });
      }

      console.log(
        "[sanitize] ✅ 使用 convertToExcalidrawElements 修复完成，最终元素数量:",
        fixedElements.length
      );
      // 最后一遍兜底：防止 convert 阶段丢失描边/宽度/透明度
      // 注意：mode 是外层作用域的变量，这里可以访问
      return fixedElements.map((el) => {
        const next: any = {...el};
        next.strokeColor = next.strokeColor || defaultStroke;
        // Default 模式强制 strokeWidth >= 3，Mermaid 模式保留原值
        if (mode !== "mermaid") {
          if (typeof next.strokeWidth !== "number" || next.strokeWidth < 3) {
            next.strokeWidth = 3;
          }
        }
        if (!next.strokeStyle) {
          next.strokeStyle = "solid";
        }
        if (typeof next.opacity !== "number" || next.opacity <= 0) {
          next.opacity = 100;
        }
        return next;
      });
    }
  } catch (error) {
    console.error("[sanitize] ❌ convertToExcalidrawElements 失败:", error);
    console.warn("[sanitize] 回退到手动构建的元素");
  }

  return processedElements;
}
