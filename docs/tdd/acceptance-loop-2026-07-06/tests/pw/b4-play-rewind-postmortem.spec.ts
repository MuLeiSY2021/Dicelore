// B4 跑团 · rewind 确认 + 终局复盘态——期望来自 overview §B4 + play.html。
// 驱动方式：真实 seed + 开局 + 玩家消息（造玩家气泡供 rewind）；终局经教练档「结束游戏」→ 会话
// status=debrief（game_end MCP 落 meta）→ 前端从 status 派生复盘态（非依赖瞬时 WS game_end 帧）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput, sendPlayerMessage } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · rewind 确认与终局复盘", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("rewind：inline 确认（不省略）+ 确认后留 note", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "我往前走一步"); // 造一个玩家气泡（轮锚点）
    await expect(byTestid(page, "play-player-edit").first()).toBeVisible({ timeout: 15_000 });
    await byTestid(page, "play-player-edit").first().click();
    await expectTestidVisible(page, "play-rewind-confirm");
    await expectTestidVisible(page, "play-rewind-go");
    await expectTestidVisible(page, "play-rewind-cancel");
    // 确认后才出 play-rewind-note（不可省确认）。
    await byTestid(page, "play-rewind-go").first().click();
    await expectTestidVisible(page, "play-rewind-note");
  });

  test("终局 = 复盘态（不遮罩）：postmortem 输入框仍可对话", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "结束游戏收场吧"); // → status=debrief
    await expect(byTestid(page, "play-postmortem-input")).toBeVisible({ timeout: 15_000 });
    // 终局不遮罩：舞台壳仍在。
    await expectTestidVisible(page, "play-stage-shell");
  });
});
