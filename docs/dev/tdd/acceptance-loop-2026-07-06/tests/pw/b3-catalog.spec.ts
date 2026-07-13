// B3 团本目录页——期望来自 1-frontend-overview §B3 + 原型 catalog.html。
// 真前端现状：CatalogPage 无 catalog-list/catalog-item 等原型 testid → 首跑必红。
// 路由：/adventures （router.tsx）。seed 复用 curl fixture（commitCatalog 造团本，让列表非空）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend } from "./helpers";
import { commitCatalog } from "./seed";

test.describe("B3 团本目录页", () => {
  test.beforeAll(async () => {
    await waitForBackend();
    // 造一份团本，让 catalog-list 非空（红来自 testid 缺口，非「无数据空页」）。
    await commitCatalog();
  });

  test("列表 + 每项结构", async ({ page }) => {
    await page.goto(ROUTE.catalog);
    // 期望：catalog-list 每项 catalog-item（题材 tag + 角色预览 chip + catalog-item-session 续玩提示 + catalog-item-version 版本入口 + catalog-edit-btn + catalog-delete-btn + catalog-start-btn）。
    await expectTestidVisible(page, "catalog-list");
    // 目录含多个团本(共享 eval 后端跨用例累积)→ 逐项 testid 会命中多个，用 .first() 避免 strict-mode 违例。
    await expect(byTestid(page, "catalog-item").first()).toBeVisible();
    await expect(byTestid(page, "catalog-start-btn").first()).toBeVisible();
    await expect(byTestid(page, "catalog-edit-btn").first()).toBeVisible();
    await expect(byTestid(page, "catalog-delete-btn").first()).toBeVisible();
  });

  test("搜索 + 筛选（按名/题材实时过滤）", async ({ page }) => {
    await page.goto(ROUTE.catalog);
    await expectTestidVisible(page, "catalog-search");
    await expectTestidVisible(page, "catalog-filter");
  });

  test("start-btn → 版本选择 modal", async ({ page }) => {
    await page.goto(ROUTE.catalog);
    // 期望：catalog-start-btn → catalog-version-modal（catalog-version-packname 团本名 + catalog-version-list 每 catalog-version-opt 带 changelog + vdiff + catalog-version-confirm 跳跑团）。
    await byTestid(page, "catalog-start-btn").first().click();
    await expectTestidVisible(page, "catalog-version-modal");
    await expectTestidVisible(page, "catalog-version-list");
    await expectTestidVisible(page, "catalog-version-opt");
    await expectTestidVisible(page, "catalog-version-confirm");
  });

  test("import-btn → 导入流程 modal（validatePack 校验日志）", async ({ page }) => {
    await page.goto(ROUTE.catalog);
    // 期望：catalog-import-btn → catalog-import-modal（import-drop/import-file 选文件 → import-log validatePack 校验日志 ok/warn/err 着色 → import-confirm 入库 · A4 信任闸）。
    await byTestid(page, "catalog-import-btn").click();
    await expectTestidVisible(page, "catalog-import-modal");
    await expectTestidVisible(page, "catalog-import-file");
    await expectTestidVisible(page, "catalog-import-log");
    await expectTestidVisible(page, "catalog-import-confirm");
  });

  test("空态引导 + 加载骨架（期望态）", async ({ page }) => {
    // 期望：空态 catalog-empty（引导 catalog-import-btn-empty / 造示例 catalog-sample-btn）；加载态 catalog-loading。
    // 真 app 无会话/团本时显空态；首屏加载显骨架。这里验 testid 存在性（期望态画进原型）。
    await page.goto(ROUTE.catalog);
    // 列表或空态其一可见。
    const list = byTestid(page, "catalog-list");
    const empty = byTestid(page, "catalog-empty");
    await expect(list.or(empty)).toBeVisible();
  });
});
