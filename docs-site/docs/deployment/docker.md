---
sidebar_position: 2
---

# Docker 部署

使用 Docker 部署 AGNX Excalidraw。

## Dockerfile

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 构建和运行

```bash
# 构建镜像
docker build -t agnx-excalidraw .

# 运行容器
docker run -p 8080:80 agnx-excalidraw
```

## Docker Compose

```yaml
version: '3.8'
services:
  excalidraw:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
```

访问 `http://localhost:8080` 即可使用。
