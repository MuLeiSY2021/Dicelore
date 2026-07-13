// acceptance-loop 0706 第五步 · playwright seed helper（as-delivered 路由）
//
// 造确定性团本 + 建 dicegm 会话，让真前端 app 有真数据可渲染。
// 直连后端 8787（不走 vite 代理）。会话面已拉平：dicegm 显式建 = POST /sessions/dicegm {teamId,version?}
// （旧 POST /:id/open 懒建已删）。teamId = adventureId。

import { BACKEND } from "./helpers";

// 限流分桶：id-less 路由（create/commit/list）默认落**同一 global 桶**（120/60s）——整套 seed + 前端
// health/list 都挤这一个桶 → 后段测试 429。给 seed 请求带唯一 x-session-id 头（rateLimit subjectKey
// 次选它做桶键）→ 每次 seed 走**自己的桶**、不占 global，避免限流误伤。纯测试侧、不改后端。
const seedHeaders = () => ({
  "content-type": "application/json",
  "x-session-id": `pwseed-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
});

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
 */
export const commitCatalog = async (
  name = `pw-seed-${Date.now()}`,
): Promise<{ adventureId: string; commitId: string }> => {
  if (cachedAdventure) return cachedAdventure;
  const r = await fetch(`${BACKEND}/catalog/commit`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify({ name, message: "playwright seed", files: fixturePack }),
  });
  if (!r.ok) throw new Error(`seed commit 失败: ${r.status} ${await r.text()}`);
  const body = (await r.json()) as { adventureId: string; commitId: string };
  cachedAdventure = body;
  return body;
};

/**
 * 显式建 dicegm 会话（POST /sessions/dicegm {teamId} → 201 {sessionId, kind}）。
 * 服务端生成 sessionId、import 团本最新版（version 省略=head → validatePack 信任闸门）。
 */
export const createDiceSession = async (teamId: string): Promise<string> => {
  const r = await fetch(`${BACKEND}/sessions/dicegm`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify({ teamId }),
  });
  if (!r.ok) throw new Error(`seed dicegm 建会话失败: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { sessionId: string }).sessionId;
};

/** 显式建 loregm 会话（POST /sessions/loregm {name?} → 201 {sessionId, kind}）。 */
export const createLoreSession = async (name = `pw-build-${Date.now()}`): Promise<string> => {
  const r = await fetch(`${BACKEND}/sessions/loregm`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(`seed loregm 建会话失败: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { sessionId: string }).sessionId;
};

/** 一站式：commit 团本 + 建 dicegm 会话，返回 {adventureId, commitId, sessionId}。 */
export const seedPlaySession = async () => {
  const { adventureId, commitId } = await commitCatalog();
  const sessionId = await createDiceSession(adventureId);
  return { adventureId, commitId, sessionId };
};

/** 删空所有 loregm 会话（驱动无活动会话屏 / 隔离 BuildPage 自动选中的旧会话）。 */
export const clearLoreSessions = async (): Promise<void> => {
  const r = await fetch(`${BACKEND}/sessions/loregm`, { headers: seedHeaders() });
  if (!r.ok) return;
  const { sessions } = (await r.json()) as { sessions: { sessionId: string }[] };
  for (const s of sessions) {
    await fetch(`${BACKEND}/sessions/loregm/${s.sessionId}`, { method: "DELETE" }).catch(() => {});
  }
};

/** 隔离一个全新空 loregm 会话（先删空 → BuildPage 自动选中的必是这个新建的空 Draft 会话）。 */
export const freshLoreSession = async (name?: string): Promise<string> => {
  await clearLoreSessions();
  return createLoreSession(name);
};
