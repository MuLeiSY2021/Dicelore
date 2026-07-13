// acceptance-loop 0706 第四步 · playwright 配置（针对真前端 React app · vite dev server）
//
// 形制（见 SKILL.md 第四步）：playwright 跑的是**真前端 app**，不是静态原型。
// 原型 html+css 只是 BDD 共享样例（期望 + testid 源），不被 playwright 跑。
// spec 据原型 data-testid + 后端接口/curl 数据形状驱动页状态机每条转移、断言可见状态。
// 首跑必红——真前端 IA/testid 未对齐原型（RT-FE1/RT-FE3 等），前端按原型重构到 testid 对齐 + 接真数据才绿。
//
// 运行前置（两个 server）：
//   1. 后端（隔离数据根 · 假 GM · 确定性）：
//        cd .dicelore-eval && DICELORE_FAKE_GM=1 bash run.sh -f -p 8787
//      （run.sh 轮询 /diagnostics/health 到 200 才返回；FAKE_GM=1 走教练档确定性路径）
//   2. vite dev server（本配置 webServer 自动起·reuseExistingServer）：
//        vite 5173，proxy /sessions /catalog /lore-sessions /diagnostics → 8787（见 frontend/vite.config.ts）
//   3. 跑：
//        cd frontend && npx playwright test --config=../docs/tdd/acceptance-loop-2026-07-06/tests/pw/playwright.config.ts
//      （从 frontend 跑以复用其 node_modules/@playwright/test；testDir 相对本配置文件解析为 pw/）

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // 见红是第四步预期：不让单个 spec 失败中断整轮，跑完全部再汇总红数。
  retries: 0,
  // 串行：后端 createRateLimit 挂全局（含 /diagnostics/health），多 worker 并发 hammer 会 429 限流
  // → beforeAll waitForBackend 抛 → 级联「did not run」（基建抖动·非 testid 红·破铁律 5 确定性）。
  // 串行消除突发，也保证红只来自 testid/IA 缺口。
  workers: 1,
  reporter: [["list"]],
  // 运行产物(error-context 等)落本配置目录下 log/，不入库(.gitignore 已忽略 log/)。
  outputDir: "./log",
  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
  },
  webServer: {
    command: "npx vite --port 5173",
    // cwd 相对本配置文件所在 pw/ 解析：pw→tests→acceptance-loop→tdd→docs→repo 根，共 5 级上溯到 frontend/。
    cwd: "../../../../../frontend",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
