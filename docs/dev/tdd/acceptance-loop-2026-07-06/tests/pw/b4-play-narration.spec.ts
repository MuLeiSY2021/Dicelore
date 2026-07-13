// B4 跑团 · 叙事流——期望来自 1-frontend-overview §B4 + 原型 play.html。
// 驱动方式：真实 seed + 交互。play-stream/play-player-msg 经开局+玩家消息真出；
// play-hidden-roll 经教练档「暗骰」消息 → visible=0 verdict 事件 → 前端从事件历史渲染缩略指示
// （非仅瞬时 WS 帧·重连/回填后仍在）。
//
// 放宽并注明（经作者裁决 · 假教练档/基础 seed 驱动不了、非删断言骗绿）：
//  · play-gm-reply：交付协议流只有 narration_commit 一条文本通道（stream.ts），无「GM 非 narrate
//    纯文本回复」独立通道 → gm-reply 是尚未落地的协议概念。此处不断言 DOM，待协议补该通道 + 组件单测覆盖。
//  · play-temp-stack：临时披露栈来自 presentation_delta 的 reveal(watcher)，教练档 + 基础 fixture 不产
//    reveal。前端渲染路径已存在（PlayPage reveals→play-temp-stack）；需带 watcher 的团本触发方能 e2e。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput, sendPlayerMessage } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 叙事流", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("叙事流容器 + 玩家气泡（轮锚点）+ GM 叙述", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await expectTestidVisible(page, "play-stream");
    await sendPlayerMessage(page, "我推门走进去");
    // 玩家气泡（轮锚点）+ edit/delete/more。
    await expectTestidVisible(page, "play-player-msg");
    await expectTestidVisible(page, "play-player-edit");
    await expectTestidVisible(page, "play-player-delete");
    await expectTestidVisible(page, "play-player-more");
    // GM 叙述渲进 stream（narrate 正文 = prose；教练档回声含「GM」）。
    await expect(byTestid(page, "play-stream")).toContainText("GM");
  });

  test("暗骰 mech：只说判定、不显结果/DC（从 visible=0 verdict 事件渲染）", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "我要暗骰一下试试看");
    // 暗骰缩略指示：默认严格档只说「进行了…判定」，不显 roll 点数/band 结果。
    const hidden = byTestid(page, "play-hidden-roll");
    await expect(hidden).toBeVisible({ timeout: 15_000 });
    await expect(hidden).toContainText("判定");
    // 严格档不泄露结果：coach 暗骰 band=失败·roll 具体点数不应出现在缩略条。
    await expect(hidden).not.toContainText("失败");
  });
});
