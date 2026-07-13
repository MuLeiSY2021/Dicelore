// B4 跑团 · bay 入口/数据浏览 + 运行时观测族——期望来自 overview §B4 + play.html。
// 驱动方式：真实 seed + primeBay（bay 常驻可点）+ 点 bay 按钮开 popover（非 hash）。
//
// 放宽并注明（经作者裁决 · FAKE 教练档不产 usage token 计量 / 后端未回填字段）：
//  · play-turn-usage：回合尾 token 内联需 turn_ended.usage；FAKE GM 无 token 计量（usage 恒空）。渲染路径在 PlayPage（有 usage 即出）。
//  · play-context-hint「即将触发压缩」：仅 contextPct>90% 触发；FAKE GM usage 恒 0，永不达阈。渲染路径已就位。
//  · play-session-lastreply：SessionSummary.lastReply 后端未回填（契约 §10·RT9 留位）。渲染路径在 PlayBay（有值即出）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput, primeBay } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · bay 入口与运行时观测族", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("bay 专属入口八按钮", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    for (const t of ["session", "chara", "plotline", "world", "forms", "config", "archive", "usage"]) {
      await expectTestidVisible(page, `play-bay-btn-${t}`);
    }
  });

  test("团数据四类 = 数据浏览（play-data-entry 展开）", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await byTestid(page, "play-bay-btn-chara").click();
    await expectTestidVisible(page, "play-bay-popover-chara");
    await expect(byTestid(page, "play-data-entry").first()).toBeVisible(); // hero sheet 条目
  });

  test("bay-config：防剧透 + 透视 GM 动作 toggle", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await byTestid(page, "play-bay-btn-config").click();
    await expectTestidVisible(page, "play-bay-popover-config");
    await expectTestidVisible(page, "play-observe-toggle");
  });

  test("bay-session：会话列表 + 日期", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await byTestid(page, "play-bay-btn-session").click();
    await expectTestidVisible(page, "play-bay-popover-session");
    await expect(byTestid(page, "play-session-item").first()).toBeVisible();
    await expect(byTestid(page, "play-session-date").first()).toBeVisible();
    // play-session-lastreply 见文件头注（后端 lastReply 未回填）。
  });

  test("运行时观测族 · model 运行时切换", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page); // stagebar 仅续玩层可见
    await expectTestidVisible(page, "play-model-switch");
  });

  test("运行时观测族 · 上下文占用条 + 圆盘", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    // foot 下方常驻占用条（contextPct + 进度条）。
    await expectTestidVisible(page, "play-context-usage");
    // 用量详情浮窗内百分比圆盘。
    await byTestid(page, "play-bay-btn-usage").click();
    await expectTestidVisible(page, "play-context-dial");
    // play-context-hint 见文件头注（需 >90% · FAKE usage 恒 0）。
  });

  test("运行时观测族 · 用量详情浮窗", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await byTestid(page, "play-bay-btn-usage").click();
    await expectTestidVisible(page, "play-bay-popover-usage");
  });
});
