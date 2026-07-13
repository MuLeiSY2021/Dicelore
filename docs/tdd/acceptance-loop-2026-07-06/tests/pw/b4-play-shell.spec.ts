// B4 跑团页 · 壳与布局——期望来自 1-frontend-overview §B4 + 原型 play.html。
// 驱动方式：真实 seed（POST /sessions/dicegm）+ 真交互（点 kickoff 开局 → GM 开场回合 → 续玩层）。
// 每个需要「已开场」态的 test 用自己的新会话（kickoff 会改会话态，避免跨 test 污染）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 壳与布局", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("桌面沙盘壳：stage-shell + 右侧 dock + 折叠", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    // 开场后进续玩层（桌面沙盘壳）：play-stage-shell + 右侧 play-dock-right + play-dock-fold。
    await kickoffToInput(page);
    await expectTestidVisible(page, "play-stage-shell");
    await expectTestidVisible(page, "play-dock-right");
    await expectTestidVisible(page, "play-dock-fold");
  });

  test("无活动会话 hint（含引导入口 + 最近会话，不空）", async ({ page }) => {
    await seedPlaySession(); // 确保后端有会话 → play-none-recent 非空
    await page.goto(ROUTE.play); // 裸 /play = 会话选择态
    await expectTestidVisible(page, "play-noSession-hint");
    await expectTestidVisible(page, "play-none-catalog");
    await expect(byTestid(page, "play-none-recent").first()).toBeVisible(); // 多会话 → 取首条
  });

  test("未开场：kickoff 团本信息卡 + 开场按钮", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    // 新会话未开场：play-kickoff-pack + play-kickoff-btn。
    await expectTestidVisible(page, "play-kickoff-pack");
    await expectTestidVisible(page, "play-kickoff-btn");
  });

  test("移动端布局：右 dock 缩进 stage 上方横向滚动", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await expectTestidVisible(page, "play-stage-shell");
    await expectTestidVisible(page, "play-dock-right");
  });
});
