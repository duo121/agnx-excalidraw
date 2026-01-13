---
sidebar_position: 4
---

# DSL 编辑

:::caution 实验性功能

此功能目前为实验性功能，在用户界面中已暂时隐藏。如果你是开发者并希望尝试此功能，可以通过 SDK API 调用。

:::

DSL（Domain Specific Language）是 Excalidraw JSON 的压缩文本格式，可以通过自然语言指令高效编辑画布。

## 什么是 DSL？

DSL 是一种将 Excalidraw 元素压缩为文本的格式，便于 AI 理解和编辑：

**原始 JSON:**
```json
{
  "id": "abc123",
  "type": "rectangle",
  "x": 100,
  "y": 200,
  "width": 150,
  "height": 80
}
```

**DSL 格式:**
```
rectangle:
- id x=100 y=200 w=150 h=80
```

## 使用方法

### 1. 打开 DSL 面板

切换到 "DSL" 模式，会显示当前画布的 DSL 表示。

### 2. 输入编辑指令

用自然语言描述你想要的修改：

```
将所有矩形的背景色改为蓝色
```

### 3. 应用变更

AI 会生成修改后的 DSL，点击「应用」更新画布。

## 支持的操作

### 修改属性

```
把标题字体大小改为 24px
将第一个节点向右移动 50 像素
把所有圆形的边框改为红色
```

### 添加元素

```
在节点 A 右边添加一个矩形
添加一条从 A 到 B 的箭头
在画布中心添加文字 "开始"
```

### 删除元素

```
删除所有虚线
删除 ID 为 3 的元素
删除所有文本标签
```

### 批量操作

```
将所有元素向下移动 100 像素
把所有矩形改为圆角矩形
统一设置所有文本的字体为手写体
```

## DSL 语法参考

### 基本结构

```
# excalidraw public-attribute DSL v2

common:
- strokeColor=#1e1e1e
- backgroundColor=transparent

rectangle:
- id x=100 y=100 w=150 h=80
- id x=300 y=100 w=150 h=80

text:
- id x=120 y=130 t="标签" c=@1
```

### 字段别名

| 别名 | 完整字段 |
|------|---------|
| x | x |
| y | y |
| w | width |
| h | height |
| t | text |
| c | containerId |
| fs | fontSize |
| ff | fontFamily |

### ID 引用

DSL 使用短 ID（数字）代替 Excalidraw 的长 ID：

```
# 元素 1 的 containerId 引用元素 2
text:
- 1 x=100 y=100 t="文本" c=@2
```

## SDK API

### 转换为 DSL

```typescript
import { convertJsonToDsl } from './sdk';

const elements = excalidrawAPI.getSceneElements();
const { dsl, document } = convertJsonToDsl(elements);
console.log(dsl);
```

### 应用 DSL 编辑

```typescript
import { generateDslEdit, applyDslChanges } from './sdk';

// 1. 生成编辑后的 DSL
const { dsl, document } = await generateDslEdit(
  currentElements,
  "将所有矩形改为蓝色背景"
);

// 2. 应用变更
const newElements = await applyDslChanges(dsl, document);

// 3. 更新画布
excalidrawAPI.updateScene({ elements: newElements });
```

### 流式编辑

```typescript
import { streamDslEdit } from './sdk';

await streamDslEdit(elements, "添加一个新节点", {
  onChunk: (chunk) => {
    // 显示实时输出
    console.log(chunk);
  },
  onComplete: (text) => {
    const dsl = extractDsl(text);
    // 处理结果
  },
});
```

## 最佳实践

### 1. 明确指令

```
❌ "改颜色"
✅ "将 ID 为 1 的矩形背景色改为 #a5d8ff"
```

### 2. 分步操作

复杂修改建议分步执行：

```
第一步："添加三个矩形节点"
第二步："用箭头连接这三个节点"
第三步："给每个节点添加文字标签"
```

### 3. 验证结果

编辑后检查画布状态，必要时撤销重试。

## 常见问题

### Q: 为什么 AI 无法正确理解我的指令？

A: 尝试使用更具体的描述，包含元素类型、位置、颜色等具体信息。

### Q: DSL 编辑会影响元素的绑定关系吗？

A: DSL 会保持元素间的绑定关系（如文本绑定到形状、箭头连接等）。

### Q: 如何撤销 DSL 编辑？

A: 使用 Excalidraw 的撤销功能（Ctrl+Z）可以回退修改。
