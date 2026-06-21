# 为 Dicelore 做贡献

欢迎!Dicelore 是一个给 AI agent 套上「GM 行为塑形框架」的开源项目,我们非常欢迎来自社区的代码、文档、测试与设计贡献。

## 开发环境

```bash
npm install              # 安装依赖（npm workspaces 单仓多包）
npm test                 # 运行测试（vitest）
npm run typecheck        # 类型检查
```

更多运行方式见 [README 的「开发」一节](README.md#开发)。代码结构与设计说明见 [`docs/wiki/`](docs/wiki/)。

## 许可与贡献授权

Dicelore 采用 **AGPL-3.0-or-later** 开源。**当你提交 Pull Request 时,即表示你同意将你的贡献以与项目相同的 AGPL-3.0-or-later 授权并入**(inbound=outbound),并确认你有权这样做(代码为你本人原创,或你已获得必要授权)。无需签署额外协议。

## Pull Request 指引

- **目标分支**:针对 `main` 提交 PR(项目仍在早期,后续若拆分 `staging` 会另行说明)。
- **语言**:commit message、PR 描述、代码注释请尽量用中文或英文,保持与现有代码一致(本地化文件除外)。
- **小而可测**:尽量让单个 PR 聚焦一件事、便于评审;较大改动建议先开 issue 讨论。
- **过检查**:提交前请确保 `npm test` 与 `npm run typecheck` 通过。

## 源码版权头约定

对于**新增的源文件**,请在文件开头加上 AGPL 标准版权头(GNU 推荐做法,明确许可状态;现有源文件已统一带头):

```ts
// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.
```

(年份用你新增该文件的年份即可;沿用 `MuLeiSY2021` 作为版权署名,与项目版权持有人一致。)

## 行为准则

请保持友善、就事论事。AI 跑团是个有趣的领域,我们希望它的社区也一样。

感谢你让 Dicelore 变得更好 🎲
