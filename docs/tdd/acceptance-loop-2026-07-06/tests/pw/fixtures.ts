// acceptance-loop 0706 · playwright 共享 fixture
//
// 限流分桶修正：后端 rateLimit 对 **id-less 路由**（GET /diagnostics/health、GET /sessions/dicegm、
// GET /catalog、GET /sessions/loregm、POST /sessions/* 建会话…）默认落**同一 global 桶**（120/60s）。
// 整套 e2e 里前端每次页加载都打 health/list → 跨 test 在 global 桶累积 → 后段 test 429（列表空→缺屏/缺项）。
// 修正：给每个 test 的所有页请求带**唯一 x-session-id 头**（rateLimit subjectKey 次选它做桶键）→
// 每个 test 走自己的桶、互不累积。纯测试侧、不改后端；:id 路由仍按 session 分桶不受影响。

import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const bucket = `pw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await page.setExtraHTTPHeaders({ "x-session-id": bucket });
    await use(page);
  },
});

export { expect } from "@playwright/test";
