---
sidebar_position: 5
---

# SDK 与 Web 模式

AGNX Excalidraw 提供两种使用方式：**Web 应用** 和 **SDK 集成**。

## 概览

| 特性 | Web 应用 | SDK 模式 |
|------|---------|---------|
| 使用方式 | 直接运行完整应用 | 集成到你的项目 |
| 适用场景 | 独立白板工具 | 自定义开发 |
| 配置 | UI 界面配置 | 代码配置 |
| 部署 | Vercel/静态托管 | npm 包/源码引入 |

## Web 应用模式

直接运行完整的 Excalidraw 白板应用，包含所有 UI 和功能。

### 目录结构

```
src/web/
├── App.tsx              # 主应用组件
├── main.tsx             # 入口文件
├── styles.css           # 全局样式
├── components/          # UI 组件
│   ├── ExcalidrawCanvas.tsx   # 画布组件
│   ├── AiChatPanel.tsx        # AI 对话面板
│   ├── MermaidPanel.tsx       # Mermaid 面板
│   ├── DslPanel.tsx           # DSL 编辑面板
│   ├── AiSettingsPanel.tsx    # AI 设置面板
│   └── AIToolbar.tsx          # AI 工具栏
├── hooks/               # 自定义 Hooks
│   ├── useDiagramStorage.ts   # 图表存储
│   └── useChatHistory.ts      # 聊天记录
└── lib/                 # 工具函数
```

### 启动方式

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 预览
pnpm preview
```

### 适用场景

- ✅ 需要一个完整的 AI 白板工具
- ✅ 快速部署到 Vercel 或其他平台
- ✅ 不需要深度定制 UI
- ✅ 个人或团队独立使用

---

## SDK 模式

将核心功能集成到你自己的 React 项目中。

### 目录结构

```
src/sdk/
├── index.ts             # SDK 导出入口
├── types.ts             # 类型定义
├── ai/                  # AI 功能
│   ├── client.ts        # AI 客户端 API
│   ├── config.ts        # 配置管理
│   ├── prompts.ts       # Prompt 模板
│   ├── storage.ts       # 配置存储
│   ├── text_generation.ts   # 文本生成
│   └── text_generation.json # Provider 定义
├── dsl/                 # DSL 转换
│   ├── index.ts
│   └── converter.ts     # JSON ↔ DSL 转换
└── utils/               # 工具函数
    ├── mermaid-to-excalidraw-loader.ts
    └── sanitize-elements.ts
```

### 导入方式

```typescript
// 从 SDK 导入所需功能
import {
  // AI 生成
  generateMermaid,
  streamMermaid,
  convertMermaidToExcalidraw,
  
  // DSL 编辑
  generateDslEdit,
  streamDslEdit,
  applyDslChanges,
  convertJsonToDsl,
  convertDslToJson,
  
  // 配置
  loadAppConfig,
  persistAppConfig,
  resolveActiveProvider,
  isConfigReady,
} from './src/sdk';
```

### 适用场景

- ✅ 集成到现有 React 项目
- ✅ 需要自定义 UI 和交互
- ✅ 只需要部分功能（如 Mermaid 转换）
- ✅ 构建自己的白板应用

---

## SDK 使用示例

### 示例 1：在你的 React 项目中集成 Mermaid 生成

```tsx
import React, { useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { generateMermaid, convertMermaidToExcalidraw } from './sdk';

function MyWhiteboard() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  const handleGenerate = async (prompt: string) => {
    // 1. 生成 Mermaid 代码
    const { code } = await generateMermaid(prompt);
    
    // 2. 转换为 Excalidraw 元素
    const sceneData = await convertMermaidToExcalidraw(code);
    
    // 3. 更新画布
    excalidrawAPI?.updateScene({
      elements: sceneData.elements,
    });
  };

  return (
    <div>
      <button onClick={() => handleGenerate('用户登录流程')}>
        生成流程图
      </button>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
      />
    </div>
  );
}
```

### 示例 2：仅使用 DSL 转换功能

```typescript
import { convertJsonToDsl, convertDslToJson } from './sdk';

// 将 Excalidraw 元素转为 DSL（用于存储或传输）
const elements = excalidrawAPI.getSceneElements();
const { dsl, document } = convertJsonToDsl(elements);
console.log(dsl);

// 将 DSL 转回元素
const result = convertDslToJson(dsl, document);
excalidrawAPI.updateScene({ elements: result.elements });
```

### 示例 3：自定义 AI Provider

```typescript
import { loadAppConfig, persistAppConfig, buildConfigWithActiveProvider } from './sdk';

async function setupCustomProvider() {
  const config = await loadAppConfig();
  
  const myProvider = {
    id: 'my-openai-proxy',
    name: '我的 OpenAI 代理',
    type: 'openai',
    apiKey: 'your-api-key',
    baseUrl: 'https://my-proxy.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
    enabled: true,
  };
  
  const newConfig = buildConfigWithActiveProvider(
    [...config.models, myProvider],
    myProvider.id,
    'gpt-4o-mini'
  );
  
  await persistAppConfig(newConfig);
}
```

---

## 对比总结

### 何时使用 Web 应用

```
用户场景：我需要一个可以直接使用的 AI 白板工具
↓
选择：运行 Web 应用 (pnpm dev)
↓
部署到 Vercel 或其他平台
```

### 何时使用 SDK

```
用户场景：我想在自己的项目中添加 AI 绘图功能
↓
选择：导入 SDK 模块
↓
只引入需要的功能，自定义 UI
```

## 混合使用

你也可以混合使用两种模式：

1. **Fork Web 应用** - 基于现有 UI 进行修改
2. **复用 SDK** - 使用 SDK 的 AI 和 DSL 功能
3. **替换组件** - 用自己的组件替换部分 UI

```tsx
// 使用 SDK 的 AI 功能 + 自定义 UI
import { streamMermaid } from './sdk';
import { MyCustomPanel } from './components/MyCustomPanel';

function App() {
  return (
    <div>
      <MyCustomPanel onSubmit={(prompt) => streamMermaid(prompt, handlers)} />
      <Excalidraw />
    </div>
  );
}
```
