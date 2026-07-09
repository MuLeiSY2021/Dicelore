// acceptance-loop 0706 第四步 · playwright seed helper
//
// 内联 curl track 的 fixture-pack（tests/curl/fixture-pack.json 同款六文件）造确定性团本 + 开局会话，
// 让真前端 app 有真数据可渲染（红来自 testid/IA 缺口，非「无数据空页」）。
// 直连后端 8787（不走 vite 代理）；与 curl a4-catalog.sh 同一 fixture、同一 open 路径。
// 内联（非 fs 读）以规避 Playwright CJS transform 下 import.meta 不可用。

import { BACKEND } from "./helpers";

/** fixture pack（与 tests/curl/fixture-pack.json 一致：manifest/prologue/lore/rules/pools/state）。 */
export const fixturePack = [
  { path: "manifest.md", content: "# eval-fixture\n" },
  { path: "prologue.md", content: "你是 GM，请开始游戏。" },
  { path: "lore/eval.md", content: "eval lore 条目。" },
  { path: "rules/eval.md", content: "eval 规则。" },
  { path: "pools/eval.csv", content: "名称,品级,weight\neval,上品,1\n" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\nhero,player,资质,eval,1\n" },
];

let cachedAdventure: { adventureId: string; commitId: string } | null = null;

/**
 * 提交一份 fixture 团本版本到 catalog（POST /catalog/commit → 201 {adventureId, commitId}）。
 * 幂等缓存：同进程内只提交一次，复用 adventureId/commitId。
 * name 带时间戳避免与历史提交撞名（断言本身仍确定性——只验形状不验 name）。
 */
export const commitCatalog = async (
  name = `pw-seed-${Date.now()}`,
): Promise<{ adventureId: string; commitId: string }> => {
  if (cachedAdventure) return cachedAdventure;
  const r = await fetch(`${BACKEND}/catalog/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      message: "playwright seed",
      files: fixturePack,
    }),
  });
  if (!r.ok) throw new Error(`seed commit 失败: ${r.status} ${await r.text()}`);
  const body = (await r.json()) as { adventureId: string; commitId: string };
  cachedAdventure = body;
  return body;
};

/**
 * 开局一个会话（POST /sessions/:id/open {adventureId, ref} → 201 {sessionId, imported}）。
 * 与 curl a4 同路径；sessionId 由客户端生成（对齐 a4 的 uid 模式）。
 */
export const openSession = async (
  adventureId: string,
  ref: string,
): Promise<string> => {
  const sid = `pw${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const r = await fetch(`${BACKEND}/sessions/${sid}/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adventureId, ref }),
  });
  if (!r.ok) throw new Error(`seed open 失败: ${r.status} ${await r.text()}`);
  const body = (await r.json()) as { sessionId?: string; imported: unknown };
  return body.sessionId ?? sid;
};

/** 一站式：commit 团本 + 开局，返回 {adventureId, commitId, sessionId}。 */
export const seedPlaySession = async () => {
  const { adventureId, commitId } = await commitCatalog();
  const sessionId = await openSession(adventureId, commitId);
  return { adventureId, commitId, sessionId };
};
