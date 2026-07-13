// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCatalog, openDb, initSchema, resolveId, type DB, type PackFile } from "@dicelore/backend";
import { createLoreApp, ensureWorkspace, createLoreDraftHook, getLoreEntry } from "./lore.js";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm, SessionTranscript, sessionDir } from "@dicelore/harness";
import type { Agent, AgentInit, PluginRef, TurnEvent, TurnInput } from "@dicelore/harness";
import { getLogger } from "@dicelore/logs";

const PACK = [
  { path: "manifest.md", content: "# 凡人\n\n- id: f" },
  { path: "prologue.md", content: "你睁开眼，发现自己躺在七玄门弟子的木屋中。请向韩立描述清晨的山门。" },
  { path: "lore/黄枫谷.md", content: "正道" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,HP,12,1\n" },
];

// session-surface-flatten：loregm 会话须先经 POST /sessions/loregm 显式建(C2 移除懒建);
// 建一个 loregm 会话、返回服务端生成的 sessionId。
async function createLoreSession(app: ReturnType<typeof createLoreApp>, name?: string): Promise<string> {
  const res = await app.request("/sessions/loregm", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(name === undefined ? {} : { name }),
  });
  return ((await res.json()) as { sessionId: string }).sessionId;
}

describe("后端 e2e: 建团本 → 列 → 开局 import → 呈现", () => {
  it("catalog commit → list → /sessions/:id/open → presentation 含导入态", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });

    // 1. 直接提交一个团本
    const commitRes = await lore.request("/catalog/commit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "凡人", message: "init", files: PACK }),
    });
    expect(commitRes.status).toBe(201);
    const { adventureId, commitId } = (await commitRes.json()) as { adventureId: string; commitId: string };

    // 2. 列团本
    const ls = (await (await lore.request("/catalog")).json()) as { adventure: { id: string; name: string }[] };
    expect(ls.adventure.find((t) => t.id === adventureId)?.name).toBe("凡人");

    // 3. 开局:per-id 持久内存库,import 落其中
    const dbs = new Map<string, DB>();
    const openSession = (id: string): DB => {
      let d = dbs.get(id);
      if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); }
      return d;
    };
    const live = createLiveApp({ catalog, openSession, agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了" }, { type: "turn_end" }]) });
    const openRes = await live.request("/sessions/dicegm", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId: adventureId, version: commitId }),
    });
    expect(openRes.status).toBe(201);
    const { sessionId } = (await openRes.json()) as { sessionId: string };

    // 4. 首屏快照含导入的 state cell
    const snap = (await (await live.request(`/sessions/dicegm/${sessionId}/presentation`)).json()) as { sheets: { entity: string; cells: { attr: string; value: string }[] }[] };
    const hp = snap.sheets.find((g) => g.entity === "韩立")?.cells.find((c) => c.attr === "HP");
    expect(hp?.value).toBe("12");

    catalog.close();
  });
});

// §3 BE-checkout-head: GET /catalog/:id/files?ref=head 端点层解析 head commitId。
// core checkout 只认 tag label / commitId、不认 "head" 关键字;端点在 ref 省略或 = "head" 时
// 先从 catalog list 取该 adventure 的 head commitId 再 checkout,不动 core checkout 语义。
describe("GET /catalog/:id/files ref=head 解析", () => {
  async function commitPack(lore: ReturnType<typeof createLoreApp>, name: string, files: PackFile[], message: string) {
    const res = await lore.request("/catalog/commit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message, files }),
    });
    return (await res.json()) as { adventureId: string; commitId: string };
  }

  it("ref=head 返 head commit 的文件(非 [])", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    const { adventureId } = await commitPack(lore, "凡人", PACK, "init");

    const res = await lore.request(`/catalog/${adventureId}/files?ref=head`);
    expect(res.status).toBe(200);
    const { files } = (await res.json()) as { files: PackFile[] };
    expect(files.length).toBe(PACK.length);
    expect(files.map((f) => f.path)).toEqual(expect.arrayContaining(PACK.map((f) => f.path)));
    catalog.close();
  });

  it("省略 ref 返 head commit 的文件(非 [])", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    const { adventureId } = await commitPack(lore, "凡人", PACK, "init");

    const res = await lore.request(`/catalog/${adventureId}/files`);
    expect(res.status).toBe(200);
    const { files } = (await res.json()) as { files: PackFile[] };
    expect(files.length).toBe(PACK.length);
    catalog.close();
  });

  it("多次提交后 head 指向最新 commit", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    await commitPack(lore, "凡人", PACK, "init");
    const NEXT: PackFile[] = [...PACK, { path: "lore/新篇.md", content: "第二章" }];
    await commitPack(lore, "凡人", NEXT, "second");

    const res = await lore.request(`/catalog/${resolveId("凡人")}/files?ref=head`);
    const { files } = (await res.json()) as { files: PackFile[] };
    expect(files.map((f) => f.path)).toContain("lore/新篇.md");
    catalog.close();
  });

  it("显式 commitId 仍照旧解析(不受 head 分支影响)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    const { commitId } = await commitPack(lore, "凡人", PACK, "init");
    const NEXT: PackFile[] = [...PACK, { path: "lore/新篇.md", content: "第二章" }];
    await commitPack(lore, "凡人", NEXT, "second");

    // 用第一版的 commitId checkout,应拿到第一版(不含新篇)
    const res = await lore.request(`/catalog/${resolveId("凡人")}/files?ref=${commitId}`);
    const { files } = (await res.json()) as { files: PackFile[] };
    expect(files.map((f) => f.path)).not.toContain("lore/新篇.md");
    expect(files.length).toBe(PACK.length);
    catalog.close();
  });

  it("未知 adventure + ref=head 返空(head 为 null,不炸)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    const res = await lore.request(`/catalog/${resolveId("不存在")}/files?ref=head`);
    expect(res.status).toBe(200);
    const { files } = (await res.json()) as { files: PackFile[] };
    expect(files).toEqual([]);
    catalog.close();
  });
});

describe("createLoreApp: plugin 传入", () => {
  it("plugin 参数经 LoreDeps 传入构建会话(agentFactory 收到 plugin)", async () => {
    const catalog = openCatalog(":memory:");
    const capturedInits: { plugin?: PluginRef }[] = [];
    const fakePlugin: PluginRef = { pluginDir: "/data/lore", skills: "all" };
    const lore = createLoreApp({
      catalog,
      agentFactory: (init) => {
        capturedInits.push({ plugin: init.plugin });
        return new FakeDiceGm([{ type: "narration", text: "ok" }, { type: "turn_end" }]);
      },
      plugin: fakePlugin,
    });

    const id = await createLoreSession(lore, "测试团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202);
    expect(capturedInits.length).toBeGreaterThan(0);
    expect(capturedInits[0].plugin).toEqual(fakePlugin);
    catalog.close();
  });

  it("plugin 省略时构建 agent 收到 undefined(向后兼容)", async () => {
    const catalog = openCatalog(":memory:");
    const capturedPlugins: (PluginRef | undefined)[] = [];
    const lore = createLoreApp({
      catalog,
      agentFactory: (init) => {
        capturedPlugins.push(init.plugin);
        return new FakeDiceGm([{ type: "narration", text: "ok" }, { type: "turn_end" }]);
      },
      // plugin 省略
    });

    const id = await createLoreSession(lore, "无技能团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202);
    expect(capturedPlugins[0]).toBeUndefined();
    catalog.close();
  });
});

// usage-stream §3: POST /sessions/loregm/:id/messages 把 handleMessage 累加的本轮 usage
// 原样搭进 202 响应体(v1 不落库,仅内联回前端);无 usage 事件则不带。
describe("POST /sessions/loregm/:id/messages usage 透传(usage-stream §3)", () => {
  it("driver 产 usage 事件时 body 含 usage(四类 token 之和)、HTTP 202", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({
      catalog,
      agentFactory: () => new FakeDiceGm([
        { type: "usage", usage: { inputTokens: 5, outputTokens: 4, cacheReadTokens: 3, cacheCreationTokens: 2 } },
        { type: "usage", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheCreationTokens: 1 } },
        { type: "turn_end" },
      ]),
    });
    const id = await createLoreSession(lore, "计量团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { turnId: string; usage?: unknown };
    expect(body.turnId).toBeTruthy();
    expect(body.usage).toEqual({ inputTokens: 6, outputTokens: 5, cacheReadTokens: 4, cacheCreationTokens: 3 });
    catalog.close();
  });

  it("无 usage 事件时 body 不含 usage、HTTP 202", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({
      catalog,
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "ok" }, { type: "turn_end" }]),
    });
    const id = await createLoreSession(lore, "无计量团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { turnId: string; usage?: unknown };
    expect(body.turnId).toBeTruthy();
    expect(body.usage).toBeUndefined();
    catalog.close();
  });
});

// §1 BE-lore-error-shape: POST /sessions/loregm/:id/messages 返回体带 error?。
// 构建 GM 中途 error 属领域级(turn 已跑完、turnId 有效)→ HTTP 保持 202,靠 body.error 标失败(不改 5xx)。
// 成功轮 body 不含 error。
describe("POST /sessions/loregm/:id/messages error 透传(body error,HTTP 保持 202)", () => {
  it("agent 产 error 事件时 body 含 error、HTTP 仍 202", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({
      catalog,
      agentFactory: () => new FakeDiceGm([
        { type: "narration", text: "开始……" },
        { type: "error", message: "构建工具异常", code: "tool_error" },
      ]),
    });

    const id = await createLoreSession(lore, "出错团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202); // 领域级 error、传输层仍成功
    const body = (await res.json()) as { turnId: string; error?: { message: string; code?: string } };
    expect(body.turnId).toBeTruthy();
    expect(body.error).toEqual({ message: "构建工具异常", code: "tool_error" });
    catalog.close();
  });

  it("成功轮 body 不含 error", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({
      catalog,
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "写好了" }, { type: "turn_end" }]),
    });

    const id = await createLoreSession(lore, "成功团本");
    const res = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { turnId: string; error?: unknown };
    expect(body.turnId).toBeTruthy();
    expect(body.error).toBeUndefined();
    catalog.close();
  });

  it("未显式建会话直接 POST messages → 404 NO_SESSION(C2 懒建已移除)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await lore.request("/sessions/loregm/never-created/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NO_SESSION");
    catalog.close();
  });
});

// GET /sessions/loregm/:id/draft —— additive 检视端点:看未 commit 的 Draft 当前态。
// 由来:RT-5 后 lore 是 REST only,POST messages 只回 {turnId} 不回传 GM 散文;构建 GM 改的是 in-memory
// Draft,commit 前 catalog 查不到。此端点暴露 LoreSession.draft 的只读视图(toPackFiles + snapshot),
// 供作者(eval build-mcp / 前端构建台)判断构建 GM 这一轮干了什么。
describe("GET /sessions/loregm/:id/draft 检视未 commit 的 Draft", () => {
  // 脚本化构建 agent:经 mcpServer 上注册的真 dicelore_build_* 工具改 Draft(不烧 LLM)。
  class FakeBuilder implements Agent {
    constructor(private init: AgentInit) {}
    async *runTurn(): AsyncIterable<TurnEvent> {
      const reg = (this.init.mcpServer as unknown as { _registeredTools: Record<string, { handler: (a: unknown) => Promise<unknown> }> })._registeredTools;
      await reg["dicelore_build_set_manifest"].handler({ name: "草稿团本", id: "caogao" });
      await reg["dicelore_build_write_lore"].handler({ name: "背景", content: "一段世界观文本。" });
      yield { type: "turn_end" };
    }
  }

  it("会话不存在 → 404 NO_SESSION", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new FakeBuilder(init) });
    const res = await lore.request("/sessions/loregm/never-started/draft");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NO_SESSION");
    catalog.close();
  });

  it("发指令驱动构建 GM 改 Draft 后,GET draft 看到 files + snapshot(commit 前 catalog 仍空)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new FakeBuilder(init) });

    const id = await createLoreSession(lore, "草稿团本");
    const send = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(send.status).toBe(202);

    const draftRes = await lore.request(`/sessions/loregm/${id}/draft`);
    expect(draftRes.status).toBe(200);
    const draft = (await draftRes.json()) as {
      files: { path: string; content: string }[];
      snapshot: { manifest: { name?: string }; world: Record<string, string> };
    };
    expect(draft.snapshot.manifest.name).toBe("草稿团本");
    expect(draft.snapshot.world["背景"]).toContain("世界观");
    expect(draft.files.map((f) => f.path)).toEqual(expect.arrayContaining(["manifest.md", "lore/背景.md"]));

    // commit 前:catalog 仍空(Draft 未落)。
    const cat = (await (await lore.request("/catalog")).json()) as { adventure: unknown[] };
    expect(cat.adventure.length).toBe(0);
    catalog.close();
  });
});

// ── POST /sessions/loregm/:id/draft/validate —— 活跃期 Draft 校验(RT-FE11 §二)。
// 复用 core validateDraft(=validatePack 同一套规则),返 {issues:[{level,path,msg}]},
// path 用 Draft 分域路径(非文件路径)。无 body、只读、幂等。
describe("POST /sessions/loregm/:id/draft/validate 活跃期 Draft 校验", () => {
  // 脚本化构建 agent:写 manifest + lore,但**不写 prologue**(留一个缺 prologue error 供断言分级)。
  class FakeBuilder implements Agent {
    constructor(private init: AgentInit) {}
    async *runTurn(): AsyncIterable<TurnEvent> {
      const reg = (this.init.mcpServer as unknown as { _registeredTools: Record<string, { handler: (a: unknown) => Promise<unknown> }> })._registeredTools;
      await reg["dicelore_build_set_manifest"].handler({ name: "草稿团本", id: "caogao" });
      await reg["dicelore_build_write_lore"].handler({ name: "背景", content: "一段世界观文本。" });
      yield { type: "turn_end" };
    }
  }

  it("会话不存在 → 404 NO_SESSION", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new FakeBuilder(init) });
    const res = await lore.request("/sessions/loregm/never-started/draft/validate", { method: "POST" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NO_SESSION");
    catalog.close();
  });

  it("驱动构建 GM 后 POST validate 返分级 issues(path 分域、含缺 prologue error)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new FakeBuilder(init) });
    const id = await createLoreSession(lore, "草稿团本");
    const send = await lore.request(`/sessions/loregm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定" }),
    });
    expect(send.status).toBe(202);

    const res = await lore.request(`/sessions/loregm/${id}/draft/validate`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { issues: { level: string; path: string; msg: string }[] };
    expect(Array.isArray(body.issues)).toBe(true);
    // FakeBuilder 只写 manifest+lore、无 prologue → 缺 prologue error(复用 validatePack Rule 0c)。
    const prologueErr = body.issues.find((i) => i.path === "prologue");
    expect(prologueErr?.level).toBe("error");
    // path 是 Draft 分域路径,不含文件分隔符。
    expect(body.issues.every((i) => !i.path.includes("/"))).toBe(true);
    catalog.close();
  });
});

// ── 会话工作区 ensureWorkspace（build-agent-workspace §1）──────────────────────
// workspace 每 session 持久:<sessionsDir>/sessions/lore/<id>/workspace/,只建 materials/,
// 不拷任何 skill、不产 .claude(skill 经 plugin 从数据根按引用加载)。ensureWorkspace 幂等。
describe("ensureWorkspace（会话工作区，纯 fs）", () => {
  it("建 <sessionsDir>/sessions/lore/<id>/workspace/materials，返回 workspace 绝对路径", () => {
    const root = mkdtempSync(join(tmpdir(), "dl-ws-"));
    try {
      const ws = ensureWorkspace(root, "sess-a");
      expect(ws).toBe(join(root, "sessions", "lore", "sess-a", "workspace"));
      expect(existsSync(join(ws, "materials"))).toBe(true);
      // 不产 .claude / 不拷 skill——workspace 只装 materials（+ agent scratch，起跑时空）。
      expect(existsSync(join(ws, ".claude"))).toBe(false);
      expect(readdirSync(ws).sort()).toEqual(["materials"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("幂等：重复调不炸、目录仍在", () => {
    const root = mkdtempSync(join(tmpdir(), "dl-ws-"));
    try {
      const ws1 = ensureWorkspace(root, "sess-b");
      const ws2 = ensureWorkspace(root, "sess-b");
      expect(ws1).toBe(ws2);
      expect(existsSync(join(ws1, "materials"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── POST /sessions/loregm/:id/materials（流式上传，build-agent-workspace §3）──────
describe("POST /sessions/loregm/:id/materials 流式素材上传", () => {
  function loreApp(root: string) {
    const catalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]), sessionsDir: root });
    return { app, catalog };
  }

  it("octet-stream 流式落盘到 workspace/materials/，返回 {path,bytes}", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      const body = "北境蛮族与边境长城的百年恩怨。".repeat(10);
      const res = await app.request("/sessions/loregm/m1/materials?filename=兽人冒险.md", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body,
      });
      expect(res.status).toBe(200);
      const out = (await res.json()) as { path: string; bytes: number };
      expect(out.path).toBe("materials/兽人冒险.md");
      expect(out.bytes).toBe(Buffer.byteLength(body));
      const onDisk = readFileSync(join(root, "sessions", "lore", "m1", "workspace", "materials", "兽人冒险.md"), "utf8");
      expect(onDisk).toBe(body);
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("同名覆盖", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      await app.request("/sessions/loregm/m2/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "第一版内容",
      });
      const res = await app.request("/sessions/loregm/m2/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "第二版",
      });
      expect(res.status).toBe(200);
      const onDisk = readFileSync(join(root, "sessions", "lore", "m2", "workspace", "materials", "a.txt"), "utf8");
      expect(onDisk).toBe("第二版");
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("X-Material-Filename header 亦可带文件名", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      const res = await app.request("/sessions/loregm/m3/materials", {
        method: "POST",
        headers: { "content-type": "application/octet-stream", "x-material-filename": "via-header.txt" },
        body: "内容",
      });
      expect(res.status).toBe(200);
      const out = (await res.json()) as { path: string };
      expect(out.path).toBe("materials/via-header.txt");
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("filename 含 ../ → 400 bad_material_name，不落盘", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      const res = await app.request("/sessions/loregm/m4/materials?filename=" + encodeURIComponent("../evil.txt"), {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x",
      });
      expect(res.status).toBe(400);
      const out = (await res.json()) as { error: { code: string } };
      expect(out.error.code).toBe("bad_material_name");
      // 逃逸目标不存在
      expect(existsSync(join(root, "sessions", "lore", "evil.txt"))).toBe(false);
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("filename 缺失 → 400 bad_material_name", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      const res = await app.request("/sessions/loregm/m5/materials", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x",
      });
      expect(res.status).toBe(400);
      const out = (await res.json()) as { error: { code: string } };
      expect(out.error.code).toBe("bad_material_name");
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("超 DICELORE_MATERIAL_MAX_MB 中途 413 material_too_large + 清半成品（不整体入内存）", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const prev = process.env.DICELORE_MATERIAL_MAX_MB;
    process.env.DICELORE_MATERIAL_MAX_MB = "1"; // 上限 1MB
    const { app, catalog } = loreApp(root);
    try {
      // 构造一个远超上限的流(多块，边写边超)——不整体缓冲。
      const chunk = new Uint8Array(256 * 1024).fill(65); // 256KB/块
      const total = 8; // 2MB > 1MB 上限
      let pushed = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (pushed >= total) { controller.close(); return; }
          controller.enqueue(chunk);
          pushed += 1;
        },
      });
      const res = await app.request("/sessions/loregm/m6/materials?filename=big.bin", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: stream,
        // @ts-expect-error node fetch/undici needs duplex for streaming request body
        duplex: "half",
      });
      expect(res.status).toBe(413);
      const out = (await res.json()) as { error: { code: string } };
      expect(out.error.code).toBe("material_too_large");
      // 半成品已清:文件不应残留。
      expect(existsSync(join(root, "sessions", "lore", "m6", "workspace", "materials", "big.bin"))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DICELORE_MATERIAL_MAX_MB;
      else process.env.DICELORE_MATERIAL_MAX_MB = prev;
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("sessionsDir 缺省 → materials 端点 500（组合根未接线）", async () => {
    const catalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([]) });
    try {
      const res = await app.request("/sessions/loregm/m7/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x",
      });
      expect(res.status).toBe(500);
    } finally {
      catalog.close();
    }
  });
});

// ── lore-draft 回退钩子(v1 占位) + loregm transcript 落盘 ──────────────────────
// (1) transcript:接线 sessionsDir 后跑一轮,<sessionsDir>/sessions/lore/<id>/<id>_session.jsonl 出现非空。
// (2) lore-draft hook:rollbackTo 仅 warn + no-op(Draft 领域态还原占位);组合根注册在位。
describe("lore-draft 回退钩子 + loregm transcript 落盘", () => {
  // 适配器测试替身:据 AgentInit 建 kind:'lore' 的 SessionTranscript(复刻 DiceGm 带外落盘),
  // 落回合头(_:'turn',带作者 text)+ 一条 msg。loregm 本身不碰 transcript(由适配器落)。
  class TranscriptFakeGm implements Agent {
    constructor(private init: AgentInit) {}
    async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
      const dir = sessionDir(this.init.sessionsDir!, this.init.kind ?? "dice", this.init.sessionId!);
      const t = new SessionTranscript({ sessionDir: dir, sessionId: this.init.sessionId! });
      t.turn({ turnId: input.turnId, input: input.text });
      t.msg(1, { _: "msg", turnId: input.turnId, text: "已写入设定。" });
      t.turnEnd(input.turnId ?? "?");
      yield { type: "turn_end" };
    }
  }

  it("接线 sessionsDir 跑一轮后 <sessionsDir>/sessions/lore/<id>/<id>_session.jsonl 非空(含 turn+msg),HTTP 仍 202", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-lore-jsonl-"));
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new TranscriptFakeGm(init), sessionsDir: root });
    try {
      const id = await createLoreSession(lore, "凡人");
      const res = await lore.request(`/sessions/loregm/${id}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "把第一章设定写进去" }),
      });
      expect(res.status).toBe(202);
      const body = (await res.json()) as { turnId: string; error?: unknown };
      expect(body.turnId).toBeTruthy();
      expect(body.error).toBeUndefined();

      const jsonlPath = join(sessionDir(root, "lore", id), `${id}_session.jsonl`);
      expect(existsSync(jsonlPath)).toBe(true);
      const raw = readFileSync(jsonlPath, "utf8").trim();
      expect(raw.length).toBeGreaterThan(0);
      const lines = raw.split("\n").map((l) => JSON.parse(l) as { _?: string; input?: string });
      const turnLine = lines.find((l) => l._ === "turn");
      expect(turnLine?.input).toBe("把第一章设定写进去");
      expect(lines.some((l) => l._ === "msg")).toBe(true);
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("组合根 sessionsDir 接线时注册 lore-draft 回退编排在位(entry.rewind 存在)", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-lore-hook-"));
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new TranscriptFakeGm(init), sessionsDir: root });
    try {
      const id = await createLoreSession(lore, "凡人");
      await lore.request(`/sessions/loregm/${id}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "写点设定" }),
      });
      expect(getLoreEntry(id)?.rewind).toBeTruthy();
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("sessionsDir 未接线时不建回退编排(entry.rewind 为 undefined)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    try {
      const id = await createLoreSession(lore, "凡人");
      await lore.request(`/sessions/loregm/${id}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "写点设定" }),
      });
      expect(getLoreEntry(id)?.rewind).toBeUndefined();
    } finally {
      catalog.close();
    }
  });

  it("createLoreDraftHook: name='lore-draft',rollbackTo 仅 warn + no-op(不抛)", () => {
    const hook = createLoreDraftHook("s-hook");
    expect(hook.name).toBe("lore-draft");
    const warnSpy = vi.spyOn(getLogger(), "warn").mockImplementation(() => getLogger());
    try {
      expect(() => hook.rollbackTo({ uuid: "u-123" })).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      // warn 带 sessionId + uuid 上下文(诊断:transcript 已回退但 Draft 未动)。
      const [ctx] = warnSpy.mock.calls[0] as [{ sessionId: string; uuid: string }];
      expect(ctx.sessionId).toBe("s-hook");
      expect(ctx.uuid).toBe("u-123");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("lore-draft hook 注册进 Rewind 后,transcript 层回退(rewindTo 移 HEAD)真生效、hook no-op 不阻断", async () => {
    // 端到端:跑一轮 → transcript 落节点 → 从 jsonl 取一个真 uuid → rewind.rewindTo(uuid):
    // ① hasNode 读文件校验(过);② lore-draft hook 被调(warn+no-op、不抛);③ moveHead 写 HEAD 成功。
    // 验证 hook 确已注册进编排,且其 no-op 不阻断 transcript 层回退。
    // (注:composition-root 的 transcript 实例内存 _head 相对驱动侧滞后,故用读文件的 rewindTo 而非 rewindLast;
    //  端点接线 + 实例刷新属 follow-up,见 backlog-backend「lore Draft 按轮快照/回退」。)
    const root = mkdtempSync(join(tmpdir(), "dl-lore-rewind-"));
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new TranscriptFakeGm(init), sessionsDir: root });
    const warnSpy = vi.spyOn(getLogger(), "warn").mockImplementation(() => getLogger());
    try {
      const id = await createLoreSession(lore, "凡人");
      await lore.request(`/sessions/loregm/${id}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "第一轮" }),
      });
      const entry = getLoreEntry(id);
      expect(entry?.rewind).toBeTruthy();
      // 从落盘 jsonl 取一个真 uuid(turn 行)。
      const jsonlPath = join(sessionDir(root, "lore", id), `${id}_session.jsonl`);
      const lines = readFileSync(jsonlPath, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { uuid: string; _?: string });
      const target = lines.find((l) => l._ === "turn")!;
      warnSpy.mockClear();
      expect(() => entry!.rewind!.rewindTo(target.uuid)).not.toThrow();
      // lore-draft hook 在回退中被调用(warn),但 no-op 不阻断 → moveHead 成功。
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});


// ── session-surface-flatten 验收：loregm 会话面对称拉平 /sessions/loregm/* ──────────
describe("session-surface-flatten：loregm 会话面 /sessions/loregm/*", () => {
  it("POST /sessions/loregm {name?} → 201 {sessionId, kind:'loregm'}", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await lore.request("/sessions/loregm", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "黑风寨" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sessionId: string; kind: string };
    expect(body.kind).toBe("loregm");
    expect(body.sessionId).toBeTruthy();
    catalog.close();
  });

  it("POST /sessions/loregm 无 body 亦 201（name 可省）", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await lore.request("/sessions/loregm", { method: "POST" });
    expect(res.status).toBe(201);
    catalog.close();
  });

  it("GET /sessions/loregm → 200 {sessions:[...]}（对称 dicegm 列表）", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({
      catalog,
      agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]),
      listSessions: () => [{ sessionId: "l1", kind: "loregm", title: "l1", status: "active", packName: "凡人" }],
    });
    const res = await lore.request("/sessions/loregm");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: { sessionId: string; kind: string }[] };
    expect(body.sessions[0].sessionId).toBe("l1");
    expect(body.sessions[0].kind).toBe("loregm");
    catalog.close();
  });

  it("GET /sessions/loregm 无 listSessions 注入 → 200 空列表", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await lore.request("/sessions/loregm");
    expect(res.status).toBe(200);
    expect((await res.json()).sessions).toEqual([]);
    catalog.close();
  });

  it("GET /sessions/loregm/:id → 200 元信息 {sessionId, kind, status, ended, title}（建后 active）", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const id = await createLoreSession(lore, "凡人");
    const res = await lore.request(`/sessions/loregm/${id}`);
    expect(res.status).toBe(200);
    const info = (await res.json()) as { sessionId: string; kind: string; status: string; ended: boolean; title: string };
    expect(info).toMatchObject({ sessionId: id, kind: "loregm", status: "active", ended: false, title: id });
    catalog.close();
  });

  it("GET /sessions/loregm/:id 未建 → 200 status=archived（对称 dicegm 恒 200）", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const res = await lore.request("/sessions/loregm/not-loaded");
    expect(res.status).toBe(200);
    const info = (await res.json()) as { kind: string; status: string };
    expect(info.kind).toBe("loregm");
    expect(info.status).toBe("archived");
    catalog.close();
  });

  it("旧路径 /lore-sessions/* → 404（破坏性改名生效·C1，不留别名）", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    // 旧列表/会话路径均已删除、无 307 过渡别名。
    expect((await lore.request("/lore-sessions")).status).toBe(404);
    expect((await lore.request("/lore-sessions/x/messages", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(404);
    expect((await lore.request("/lore-sessions/x/draft")).status).toBe(404);
    catalog.close();
  });
});
