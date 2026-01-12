---
sidebar_position: 2
---

# 开发环境设置

设置本地开发环境的步骤。

## 环境要求

- Node.js >= 18
- pnpm >= 8
- Git

## 设置步骤

```bash
# 克隆仓库
git clone https://github.com/duo121/agnx-excalidraw.git
cd agnx-excalidraw

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 添加你的 API Key

# 启动开发服务器
pnpm dev
```

## 开发命令

```bash
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm typecheck  # 类型检查
pnpm preview    # 预览构建结果
```

## 文档开发

```bash
cd docs-site
pnpm install
pnpm start      # 启动文档开发服务器
```
