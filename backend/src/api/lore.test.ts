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
import { createLoreApp, ensureWorkspace } from "./lore.js";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm } from "@dicelore/harness";
import type { Agent, AgentInit, PluginRef, TurnEvent } from "@dicelore/harness";

const PACK = [
  { path: "manifest.md", content: "# 凡人\n\n- id: f" },
  { path: "prologue.md", content: "你睁开眼，发现自己躺在七玄门弟子的木屋中。请向韩立描述清晨的山门。" },
  { path: "lore/黄枫谷.md", content: "正道" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,HP,12,1\n" },
];

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
    const openRes = await live.request("/sessions/s1/open", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ adventureId, ref: commitId }),
    });
    expect(openRes.status).toBe(201);

    // 4. 首屏快照含导入的 state cell
    const snap = (await (await live.request("/sessions/s1/presentation")).json()) as { sheets: { entity: string; cells: { attr: string; value: string }[] }[] };
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

    const res = await lore.request("/lore-sessions/s-skill-test/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定", name: "测试团本" }),
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

    const res = await lore.request("/lore-sessions/s-no-skill/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定", name: "无技能团本" }),
    });
    expect(res.status).toBe(202);
    expect(capturedPlugins[0]).toBeUndefined();
    catalog.close();
  });
});

// GET /lore-sessions/:id/draft —— additive 检视端点:看未 commit 的 Draft 当前态。
// 由来:RT-5 后 lore 是 REST only,POST messages 只回 {turnId} 不回传 GM 散文;构建 GM 改的是 in-memory
// Draft,commit 前 catalog 查不到。此端点暴露 LoreSession.draft 的只读视图(toPackFiles + snapshot),
// 供作者(eval build-mcp / 前端构建台)判断构建 GM 这一轮干了什么。
describe("GET /lore-sessions/:id/draft 检视未 commit 的 Draft", () => {
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
    const res = await lore.request("/lore-sessions/never-started/draft");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NO_SESSION");
    catalog.close();
  });

  it("发指令驱动构建 GM 改 Draft 后,GET draft 看到 files + snapshot(commit 前 catalog 仍空)", async () => {
    const catalog = openCatalog(":memory:");
    const lore = createLoreApp({ catalog, agentFactory: (init) => new FakeBuilder(init) });

    const send = await lore.request("/lore-sessions/d1/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "写点设定", name: "草稿团本" }),
    });
    expect(send.status).toBe(202);

    const draftRes = await lore.request("/lore-sessions/d1/draft");
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

// ── 会话工作区 ensureWorkspace（build-agent-workspace §1）──────────────────────
// workspace 每 session 持久:<sessionsDir>/lore/sessions/<id>/workspace/,只建 materials/,
// 不拷任何 skill、不产 .claude(skill 经 plugin 从数据根按引用加载)。ensureWorkspace 幂等。
describe("ensureWorkspace（会话工作区，纯 fs）", () => {
  it("建 <sessionsDir>/lore/sessions/<id>/workspace/materials，返回 workspace 绝对路径", () => {
    const root = mkdtempSync(join(tmpdir(), "dl-ws-"));
    try {
      const ws = ensureWorkspace(root, "sess-a");
      expect(ws).toBe(join(root, "lore", "sessions", "sess-a", "workspace"));
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

// ── POST /lore-sessions/:id/materials（流式上传，build-agent-workspace §3）──────
describe("POST /lore-sessions/:id/materials 流式素材上传", () => {
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
      const res = await app.request("/lore-sessions/m1/materials?filename=兽人冒险.md", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body,
      });
      expect(res.status).toBe(200);
      const out = (await res.json()) as { path: string; bytes: number };
      expect(out.path).toBe("materials/兽人冒险.md");
      expect(out.bytes).toBe(Buffer.byteLength(body));
      const onDisk = readFileSync(join(root, "lore", "sessions", "m1", "workspace", "materials", "兽人冒险.md"), "utf8");
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
      await app.request("/lore-sessions/m2/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "第一版内容",
      });
      const res = await app.request("/lore-sessions/m2/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "第二版",
      });
      expect(res.status).toBe(200);
      const onDisk = readFileSync(join(root, "lore", "sessions", "m2", "workspace", "materials", "a.txt"), "utf8");
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
      const res = await app.request("/lore-sessions/m3/materials", {
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
      const res = await app.request("/lore-sessions/m4/materials?filename=" + encodeURIComponent("../evil.txt"), {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x",
      });
      expect(res.status).toBe(400);
      const out = (await res.json()) as { error: { code: string } };
      expect(out.error.code).toBe("bad_material_name");
      // 逃逸目标不存在
      expect(existsSync(join(root, "lore", "sessions", "evil.txt"))).toBe(false);
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("filename 缺失 → 400 bad_material_name", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-mat-"));
    const { app, catalog } = loreApp(root);
    try {
      const res = await app.request("/lore-sessions/m5/materials", {
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
      const res = await app.request("/lore-sessions/m6/materials?filename=big.bin", {
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
      expect(existsSync(join(root, "lore", "sessions", "m6", "workspace", "materials", "big.bin"))).toBe(false);
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
      const res = await app.request("/lore-sessions/m7/materials?filename=a.txt", {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x",
      });
      expect(res.status).toBe(500);
    } finally {
      catalog.close();
    }
  });
});
