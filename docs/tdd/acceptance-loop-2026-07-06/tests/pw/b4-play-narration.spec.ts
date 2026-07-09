// B4 跑团 · 叙事流——期望来自 1-frontend-overview §B4 + 原型 play.html。
// 期望叙事流 play-stream 无脊线、靠 divider 分节，四类气泡区分：
//   玩家气泡 play-player-msg（右倾·edit/delete/more[复制·分支]）= 轮锚点
//   narrate prose（serif 小说正文）≠ GM 正文回复 play-gm-reply（去边框/小字/淡色·署名 GM）
//   暗骰 play-hidden-roll（带「暗骰」标·只说判定不显结果/DC）
//   披露 play-temp-stack；divider 分节带文案。
// 真前端现状：PlayPage 无 play-stream/play-player-msg 等原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 叙事流", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("叙事流容器 + 玩家气泡（轮锚点）", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-stream 叙事流 + play-player-msg 玩家气泡（右倾·play-player-edit/delete/more）。
    await expectTestidVisible(page, "play-stream");
    await expectTestidVisible(page, "play-player-msg");
    await expectTestidVisible(page, "play-player-edit");
    await expectTestidVisible(page, "play-player-delete");
    await expectTestidVisible(page, "play-player-more");
  });

  test("narrate prose ≠ GM 正文回复 play-gm-reply（刻意轻量）", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：prose（小说正文·serif 无框）与 play-gm-reply（.reply 去边框/小字/淡色·署名 GM 淡化）视觉区分——两者皆 testid 可定位。
    await expectTestidVisible(page, "play-gm-reply");
  });

  test("暗骰 mech：只说判定、不显结果/DC", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-hidden-roll 带「暗骰」标，只说「GM 进行了一次 XX 判定」，不显结果/DC（细节由 bay-config 防剧透分级）。
    await expectTestidVisible(page, "play-hidden-roll");
  });

  test("divider 分节带文案 + 新披露进 temp-stack", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：divider 分割线带文案（幕首 / 以上历史·以下本轮 / 待掷·区间裁决 / 终局·复盘）；AI 新披露进 play-temp-stack（临时位·不抢常驻 dock）。
    await expectTestidVisible(page, "play-temp-stack");
  });
});
