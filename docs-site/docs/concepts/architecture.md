---
sidebar_position: 1
---

# 架构说明

本文档介绍 AGNX Excalidraw 的整体架构设计。

## 项目结构

```
agnx-excalidraw/
├── src/
│   ├── web/                    # Web 应用层
│   │   ├── App.tsx            # 主应用组件
│   │   ├── main.tsx           # 入口文件
│   │   ├── components/        # UI 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   └── lib/               # 工具函数
│   │
│   ├── sdk/                    # 核心 SDK 层
│   │   ├── ai/                # AI 功能模块
│   │   ├── dsl/               # DSL 解析模块
│   │   ├── utils/             # 工具函数
│   │   └── types.ts           # 类型定义
│   │
│   └── storage.ts             # 本地存储模块
│
├── docs-site/                  # Docusaurus 文档站点
├── public/                     # 静态资源
└── 配置文件
```

## 分层架构

```
┌─────────────────────────────────────────┐
│              Web 应用层                  │
│   (React 组件、路由、状态管理)            │
├─────────────────────────────────────────┤
│               SDK 层                     │
│   (AI 客户端、DSL 转换、配置管理)         │
├─────────────────────────────────────────┤
│              存储层                      │
│   (本地存储、配置持久化)                  │
├─────────────────────────────────────────┤
│            外部服务                      │
│   (AI API、Mermaid 解析)                 │
└─────────────────────────────────────────┘
```

## 核心模块

### 1. Web 应用层

负责用户界面和交互：

- **ExcalidrawCanvas** - Excalidraw 画布封装
- **AiChatPanel** - AI 对话面板
- **MermaidPanel** - Mermaid 代码编辑面板
- **DslPanel** - DSL 编辑面板

### 2. SDK 层

核心业务逻辑，可独立使用：

#### AI 模块 (`ai/`)
- `client.ts` - AI 客户端，提供流式/非流式 API
- `config.ts` - 配置管理，多 Provider 支持
- `prompts.ts` - Prompt 模板
- `text_generation.ts` - 文本生成抽象层

#### DSL 模块 (`dsl/`)
- `converter.ts` - JSON ↔ DSL 双向转换

### 3. 存储层

统一的本地存储管理，使用 `localStorage` 持久化：

- 图表数据
- AI 配置
- 用户偏好

## 数据流

### AI 对话流程

```
用户输入 Prompt
      ↓
AiChatPanel 调用 SDK
      ↓
client.ts 选择 Provider
      ↓
text_generation.ts 发起请求
      ↓
流式返回结果
      ↓
解析结果（Mermaid/DSL/JSON）
      ↓
更新 Excalidraw 画布
```

### Mermaid 转换流程

```
Mermaid 代码
      ↓
mermaid-to-excalidraw
      ↓
sanitizeExcalidrawElements()
      ↓
Excalidraw 元素
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS |
| 画布 | Excalidraw |
| 图表 | Mermaid |
| 路由 | React Router DOM |
| 文档 | Docusaurus |
