// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// build-mcp 集成测:起真后端 lore 面(createLoreApp + openCatalog)+ 一个 fake 构建 agent(驱动真
// dicelore_build_* 工具改 Draft),调 build-mcp handler 验 open→send→检视(get_draft/list_catalog/
// get_pack_files)闭环。**不烧 LLM**——agentFactory 返回脚本化构建 agent,经 mcpServer 上注册的真构建工具
// 改 Draft / commit,完全复刻真 CC 构建 GM 的产物路径,只是把 LLM 决策换成固定指令序列。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serve } from "@hono/node-server";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCatalog, resolveId, type CatalogDB } from "@dicelore/backend";
import type { Agent, AgentInit, TurnEvent } from "@dicelore/harness";
import { createLoreApp } from "@dicelore/backend";
import { doOpenBuildSession, doSendToBuilder, doGetDraft, doListCatalog, doGetPackFiles, doPutMaterial } from "./build-mcp.js";

// 脚本化构建 agent:不烧 LLM,经 mcpServer 上注册的真 dicelore_build_* 工具改 Draft。
// 每收一条作者指令(text),按 text 关键字决定调哪些构建工具——模拟真构建 GM「读作者意图→调工具造包」。
// 经 _registeredTools[name].handler(args) 直驱真构建核心(invokeBuildTool over 同一 Draft),
// 与真 CC SDK 经 MCP 协议调工具是同一份 handler,只是这里直接进程内调、跳过 stdio 传输。
class FakeLoreBuilder implements Agent {
  constructor(private init: AgentInit) {}
  private async call(name: string, args: unknown): Promise<void> {
    const reg = (this.init.mcpServer as unknown as { _registeredTools: Record<string, { handler: (a: unknown) => Promise<unknown> }> })._registeredTools;
    const tool = reg[name];
    if (!tool) throw new Error(`fake builder: 未注册工具 ${name}`);
    await tool.handler(args);
  }
  async *runTurn(input: { text: string }): AsyncIterable<TurnEvent> {
    // 第一轮:写 manifest + lore + prologue(团本最小骨架)。
    if (input.text.includes("起手") || input.text.includes("设定")) {
      await this.call("dicelore_build_set_manifest", { name: "测试团本", id: "ceshi" });
      await this.call("dicelore_build_write_lore", { name: "世界观", content: "一个测试用的奇幻世界。" });
      await this.call("dicelore_build_set_prologue", { text: "你站在测试村庄的入口。" });
    }
    // 第二轮:commit 到 catalog。
    if (input.text.includes("提交") || input.text.includes("commit")) {
      await this.call("dicelore_build_commit", { message: "init 测试团本" });
    }
    yield { type: "turn_end" };
  }
}

let server: ReturnType<typeof serve>;
let catalog: CatalogDB;
beforeAll(() => {
  catalog = openCatalog(":memory:");
  const agentFactory = (init: AgentInit) => new FakeLoreBuilder(init);
  const app = createLoreApp({ catalog, agentFactory });
  server = serve({ fetch: app.fetch, port: 0 });
  process.env.DICELORE_PLAY_URL = `http://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
  catalog.close();
  delete process.env.DICELORE_PLAY_URL;
});

describe("build-mcp handlers", () => {
  it("open→send→检视(get_draft)→commit→检视(list_catalog/get_pack_files)闭环,不烧 LLM", async () => {
    const sid = doOpenBuildSession();
    expect(sid).toMatch(/^build-/);
    const name = "测试团本";

    // 会话尚未起 → get_draft 404(NO_SESSION)。
    await expect(doGetDraft(sid)).rejects.toThrow(/404/);

    // 第一轮:作者发"起手设定"→ 构建 GM 写 manifest/lore/prologue 到 Draft。
    const r1 = await doSendToBuilder(sid, name, "起手:把第一章设定写进去");
    expect(r1.turnId).toMatch(/-l\d+$/);

    // 检视未 commit 的 Draft:看到这一轮写入的产物(因构建 GM 响应不经 REST 返回,靠检视判进度)。
    const draft = (await doGetDraft(sid)) as { files: { path: string; content: string }[]; snapshot: { manifest: { name?: string }; prologue?: string; world: Record<string, string> } };
    expect(draft.snapshot.manifest.name).toBe("测试团本");
    expect(draft.snapshot.prologue).toBe("你站在测试村庄的入口。");
    expect(draft.snapshot.world["世界观"]).toContain("奇幻世界");
    expect(draft.files.map((f) => f.path)).toEqual(expect.arrayContaining(["manifest.md", "prologue.md", "lore/世界观.md"]));

    // commit 前:catalog 应为空(Draft 未落)。
    const before = (await doListCatalog()) as { adventure: unknown[] };
    expect(before.adventure.length).toBe(0);

    // 第二轮:作者发"提交"→ 构建 GM commit Draft 到 catalog。
    await doSendToBuilder(sid, name, "提交这个版本");

    // 检视已 commit 的 catalog:团本目录现含该团本。
    const after = (await doListCatalog()) as { adventure: { id: string; name: string; head: string | null }[] };
    expect(after.adventure.length).toBe(1);
    const entry = after.adventure.find((t) => t.id === resolveId(name));
    expect(entry?.name).toBe(name);
    expect(entry?.head).toBeTruthy();

    // 检视某团本包文件:ref=head commitId(catalog 的 ref=tag label 或 commitId,无 "head" 关键字,
    // 故从 list 取 head 传入)。含 commit 进去的文件(经 catalog 物化,非 Draft 内存态)。
    const pack = (await doGetPackFiles(entry!.id, entry!.head!)) as { files: { path: string; content: string }[] };
    const paths = pack.files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["manifest.md", "prologue.md", "lore/世界观.md"]));
  });
});

// put_material:把作者本机文件流式上传进构建会话工作区(build-agent-workspace §3)。
// content 不进工具参数(取 localPath),端点流式落 workspace/materials/。用带 sessionsDir 的独立后端。
describe("build-mcp put_material 流式上传素材", () => {
  let matServer: ReturnType<typeof serve>;
  let matCatalog: CatalogDB;
  let root: string;
  let prevUrl: string | undefined;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "dl-putmat-"));
    matCatalog = openCatalog(":memory:");
    const app = createLoreApp({ catalog: matCatalog, agentFactory: (init: AgentInit) => new FakeLoreBuilder(init), sessionsDir: root });
    matServer = serve({ fetch: app.fetch, port: 0 });
    prevUrl = process.env.DICELORE_PLAY_URL;
    process.env.DICELORE_PLAY_URL = `http://localhost:${(matServer.address() as { port: number }).port}`;
  });
  afterAll(() => {
    matServer.close();
    matCatalog.close();
    if (prevUrl === undefined) delete process.env.DICELORE_PLAY_URL;
    else process.env.DICELORE_PLAY_URL = prevUrl;
    rmSync(root, { recursive: true, force: true });
  });

  it("取 localPath 流式上传，返回 {path,bytes}，落盘内容与源一致（content 不进工具参数）", async () => {
    // 作者本机源文件(模拟 508KB 大源:此处小样本，关键是走 localPath 而非把 content 当参数)。
    const srcDir = mkdtempSync(join(tmpdir(), "dl-src-"));
    const srcPath = join(srcDir, "兽人冒险.md");
    const content = "从刚成年开始的兽人冒险。".repeat(500);
    writeFileSync(srcPath, content, "utf8");
    try {
      const sid = doOpenBuildSession();
      const out = await doPutMaterial(sid, "兽人冒险.md", srcPath);
      expect(out.path).toBe("materials/兽人冒险.md");
      expect(out.bytes).toBe(Buffer.byteLength(content));
      // 端点落盘:workspace/materials/ 下内容与源逐字节一致。
      const onDisk = readFileSync(join(root, "lore", "sessions", sid, "workspace", "materials", "兽人冒险.md"), "utf8");
      expect(onDisk).toBe(content);
    } finally {
      rmSync(srcDir, { recursive: true, force: true });
    }
  });
});
