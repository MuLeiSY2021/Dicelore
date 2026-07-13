// acceptance-loop 0706 第四步 · playwright 共享件
//
// 形制见 SKILL.md：spec 针对真前端 app，断言原型 data-testid（期望来自架构·铁律 1）。
// 真前端 IA/testid 未对齐原型 → 首跑必红（铁律 2）。
// 路由取自 frontend/src/app/router.tsx（真 app 实际路由）。

import { type Page, expect } from "@playwright/test";

/** 真前端 dev server（vite 5173 · 见 playwright.config webServer）。 */
export const BASE_URL = "http://localhost:5173";

/** 隔离测试后端（.dicelore-eval · FAKE_GM=1 · 8787）。seed 直连此，不走 vite 代理。 */
export const BACKEND =
  process.env.DICELORE_BASE ?? "http://127.0.0.1:8787";

/** 真 app 路由（frontend/src/app/router.tsx）。原型 hash(#s=/#v=) 是原型态切换、真 app 不认。 */
export const ROUTE = {
  home: "/",
  catalog: "/adventures",
  play: "/play",
  playSession: (id: string) => `/play/${id}`,
  build: "/build",
  config: "/config",
} as const;

/** 按 data-testid 取定位器（playwright 只认 testid，不依赖文案/class · overview 选择器约定）。 */
export const byTestid = (page: Page, id: string) => page.getByTestId(id);

/** 断言某 testid 可见——期望来自原型（铁律 1），真前端缺该 testid 即红（铁律 2）。 */
export const expectTestidVisible = async (page: Page, id: string) => {
  await expect(byTestid(page, id)).toBeVisible();
};

/** 等 vitest dev server 起来（webServer 已轮询，这里兜底首页可达）。 */
export const waitForFrontend = async (page: Page) => {
  await page.goto(ROUTE.home, { waitUntil: "domcontentloaded" });
};

/**
 * 等后端就绪（health 200）。seed 前调用。
 * 后端 createRateLimit 挂全局含 health，并发可能 429——视 429 为瞬时重试（非「未起」）。
 * 后端未起则抛——提示先 `cd .dicelore-eval && DICELORE_FAKE_GM=1 bash run.sh -f -p 8787`。
 */
export const waitForBackend = async () => {
  const deadline = Date.now() + 30_000;
  let last = 0;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BACKEND}/diagnostics/health`, { headers: { "x-session-id": `pw-wfb-${Math.random().toString(36).slice(2)}` } });
      if (r.ok) return;
      last = r.status;
      // 429 = 限流（瞬时），继续重试；其他非 200 也重试到 deadline。
    } catch {
      last = 0;
    }
    await new Promise((x) => setTimeout(x, 800));
  }
  throw new Error(
    `后端未就绪（health=${last}）。先：cd .dicelore-eval && DICELORE_FAKE_GM=1 bash run.sh -f -p 8787`,
  );
};

/**
 * 让 bay 常驻可点（对齐真产品「配置页 bay 行为=常驻」这一真实设置，非 hash harness）。
 * bay 默认「聚焦出现」（opacity:0 + pointer-events:none），playwright 点不到；
 * 写 localStorage bay-mode=always（BayProvider 读它加 body.bay-always）→ 常驻可交互。
 * 必须在 goto 前调用（addInitScript 对后续导航生效）。
 */
export const primeBay = async (page: Page) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("bay-mode", "always"); } catch { /* noop */ }
  });
};

/** 开局并等到续玩层输入框（真实流程：点 kickoff → GM 开场回合 → 输入框）。 */
export const kickoffToInput = async (page: Page) => {
  const kick = byTestid(page, "play-kickoff-btn");
  if (await kick.isVisible().catch(() => false)) {
    await kick.click();
  }
  await expect(byTestid(page, "play-input")).toBeVisible({ timeout: 15_000 });
};

/** 从输入框发一句玩家消息（驱动 FAKE 教练档产真态：掷骰/选择/终局/暗骰/报错）。 */
export const sendPlayerMessage = async (page: Page, text: string) => {
  const box = byTestid(page, "play-input").locator("input");
  await box.fill(text);
  await box.press("Enter");
};

/** build 页：等 loregm 会话就绪（ctxbar 出现）后从构建助手发一句指令（驱动 FAKE 构建档写 Draft）。 */
export const sendBuildMessage = async (page: Page, text: string) => {
  const box = page.locator(".cin .box");
  await box.fill(text);
  await byTestid(page, "build-send").click();
};
