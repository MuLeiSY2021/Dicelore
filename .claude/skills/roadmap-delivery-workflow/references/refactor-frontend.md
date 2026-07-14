# 整理前端架构（refactor-frontend 变体）

> **主体流程见 [SKILL.md](../SKILL.md)**：一批走「三段式 Workflow」，单条线走文末「一条线内部怎么干」a→g。本 reference 只定义**这类需求的差异点**。

| 维度 | 取值 |
|------|------|
| 问题从哪来 | `docs/dev/plan/backlog-frontend.md` |
| 扫描范围 | `frontend` |
| 专属关注点 | 组件边界 / 渲染路径 / 路由 / i18n（硬编码中文走 i18n）/ 墨金视觉 token 一致性 |
| 验收口径 | web 单测 + Playwright e2e，**必须**走 `/webapp-testing`（example-skills:webapp-testing） |

要点：
- 现状差距分析时对照 [玩家客户端视觉/接口设计页](../../../../wiki/开发指南/04-子系统设计/)，别让组件实现与设计页漂移。
- 前端常有「等后端端点上线」的降级逻辑——重构别破坏对未上线契约的降级。
