---
sidebar_position: 2
---

# AI 客户端 API

AI 客户端模块提供与 AI 服务交互的完整 API。

## streamMermaid

流式生成 Mermaid 代码。

```typescript
async function streamMermaid(
  prompt: string,
  handlers: StreamHandlers
): Promise<void>
```

### 参数

- `prompt` - 用户描述
- `handlers` - 流式回调处理器

### 示例

```typescript
await streamMermaid("画一个用户登录流程图", {
  onChunk: (chunk) => console.log(chunk),
  onComplete: (text) => {
    const code = extractMermaid(text);
    console.log("Mermaid code:", code);
  },
  onError: (err) => console.error(err),
});
```

## generateMermaid

非流式生成 Mermaid 代码。

```typescript
async function generateMermaid(prompt: string): Promise<MermaidResult>
```

### 返回值

```typescript
type MermaidResult = {
  code: string;  // Mermaid 代码
};
```

## convertMermaidToExcalidraw

将 Mermaid 代码转换为 Excalidraw 元素。

```typescript
async function convertMermaidToExcalidraw(
  mermaidCode: string,
  options?: {
    isDark?: boolean;
    preferredStrokeColor?: string;
  }
): Promise<ExcalidrawSceneData>
```

### 返回值

```typescript
type ExcalidrawSceneData = {
  elements: ExcalidrawElement[];
  files?: Record<string, any>;
};
```

## streamDslEdit

流式 DSL 编辑。

```typescript
async function streamDslEdit(
  currentElements: ExcalidrawElement[],
  editPrompt: string,
  handlers: StreamHandlers
): Promise<void>
```

## generateDslEdit

非流式 DSL 编辑。

```typescript
async function generateDslEdit(
  currentElements: ExcalidrawElement[],
  editPrompt: string
): Promise<DslEditResult>
```

### 返回值

```typescript
type DslEditResult = {
  dsl: string;
  document: DSLCompressedDocument;
};
```

## applyDslChanges

应用 DSL 变更到画布。

```typescript
async function applyDslChanges(
  dsl: string,
  referenceDoc: DSLCompressedDocument,
  options?: {
    isDark?: boolean;
    preferredStrokeColor?: string;
  }
): Promise<ExcalidrawElement[]>
```
