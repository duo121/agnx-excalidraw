---
sidebar_position: 3
---

# 代码风格

项目代码风格指南。

## TypeScript

- 使用 TypeScript 严格模式
- 定义明确的类型，避免 `any`
- 使用接口定义复杂类型

## 命名规范

- 文件名：kebab-case (`my-component.tsx`)
- 组件名：PascalCase (`MyComponent`)
- 函数名：camelCase (`myFunction`)
- 常量：UPPER_SNAKE_CASE (`MAX_COUNT`)

## 组件规范

```typescript
// 推荐的组件结构
import React from 'react';

interface Props {
  title: string;
  onClick?: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onClick }) => {
  return (
    <div onClick={onClick}>
      {title}
    </div>
  );
};
```

## 提交信息

遵循 Conventional Commits 规范：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 其他修改
```
