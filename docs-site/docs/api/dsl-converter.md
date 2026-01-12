---
sidebar_position: 3
---

# DSL 转换 API

DSL 转换模块提供 JSON 与 DSL 格式之间的双向转换。

## convertJsonToDsl

将 Excalidraw 元素转换为 DSL 格式。

```typescript
function convertJsonToDsl(
  elements: ExcalidrawElement[],
  options?: JsonToDslOptions
): ConvertJsonToDslResult
```

### 参数

- `elements` - Excalidraw 元素数组
- `options` - 可选配置

### 返回值

```typescript
type ConvertJsonToDslResult = {
  dsl: string;              // DSL 文本
  document: DSLCompressedDocument;  // 压缩文档结构
};
```

## convertDslToJson

将 DSL 转换回 Excalidraw 元素。

```typescript
function convertDslToJson(
  dslText: string,
  compressed: DSLCompressedDocument
): {
  elements: any[];
  meta: Record<string, any>;
  shape: "object" | "array";
}
```

## 示例

```typescript
import { convertJsonToDsl, convertDslToJson } from './sdk';

// JSON → DSL
const elements = excalidrawAPI.getSceneElements();
const { dsl, document } = convertJsonToDsl(elements);

// DSL → JSON
const result = convertDslToJson(modifiedDsl, document);
excalidrawAPI.updateScene({ elements: result.elements });
```
