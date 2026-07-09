// B4 跑团 · rewind 确认 + 终局复盘态——期望来自 overview §B4 + play.html。
// 期望：点 play-player-edit → play-rewind-confirm（inline 确认「将丢弃其后 N 条回合」+ play-rewind-go 确认 / play-rewind-cancel 取消）→ 确认才 rewind、留 play-rewind-note（不省略确认）。
//   终局 = 复盘态（不遮罩）：play-postmortem-input 复盘输入框（仍可对话）；无黑屏遮罩、无「新局/复盘」按钮。rewind 到头 → 转 kickoff（无 rewind-empty）；归档不单列态。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · rewind 确认与终局复盘", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("rewind：inline 确认（不省略）+ 确认后留 note", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：点 play-player-edit → play-rewind-confirm（inline）+ play-rewind-go / play-rewind-cancel。
    await expectTestidVisible(page, "play-player-edit");
    await byTestid(page, "play-player-edit").first().click();
    await expectTestidVisible(page, "play-rewind-confirm");
    await expectTestidVisible(page, "play-rewind-go");
    await expectTestidVisible(page, "play-rewind-cancel");
    // 期望：确认后才出 play-rewind-note（不可省确认）。
    await byTestid(page, "play-rewind-go").first().click();
    await expectTestidVisible(page, "play-rewind-note");
  });

  test("终局 = 复盘态（不遮罩）：postmortem 输入框仍可对话", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#s=end`);
    // 期望：play-postmortem-input 复盘输入框（GM 已知游戏结束进入复盘·不再推进剧情·仍可回答玩家问题）；无黑屏遮罩、无「新局/复盘」按钮。
    await expectTestidVisible(page, "play-postmortem-input");
    // 终局不遮罩：舞台壳仍在。
    await expectTestidVisible(page, "play-stage-shell");
  });
});
