// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { vi, afterEach, beforeEach, expect, it, describe } from "vitest";
import type { DraftSnapshot } from "./api.js";

// ── mocks ─────────────────────────────────────────────────────────────────
const listLoreSessions = vi.fn();
const validateDraft = vi.fn();
const postBuildMessage = vi.fn();
const createLoreSession = vi.fn();
const deleteLoreSession = vi.fn();
vi.mock("./api.js", () => ({
  listLoreSessions: (...a: unknown[]) => listLoreSessions(...a),
  validateDraft: (...a: unknown[]) => validateDraft(...a),
  postBuildMessage: (...a: unknown[]) => postBuildMessage(...a),
  createLoreSession: (...a: unknown[]) => createLoreSession(...a),
  deleteLoreSession: (...a: unknown[]) => deleteLoreSession(...a),
  uploadMaterial: () => ({ promise: Promise.resolve({ path: "materials/x", bytes: 10 }), abort: () => {} }),
}));

vi.mock("@/features/catalog/api.js", () => ({ commitPack: vi.fn(async () => ({ adventureId: "a", commitId: "c" })) }));

const draft = { files: [{ path: "manifest.md", content: "# 黑风寨" }] };
const snapshot: DraftSnapshot = {
  manifest: { name: "黑风寨的钟声", id: "hei" },
  prologue: "夜色如墨……",
  world: { 黑风寨: "据点" },
  rules: { 潜行判定: "d20" },
  pools: {},
  sheets: { cells: [{ entity: "钟三爷", kind: "npc", attr: "HP", value: 40 }] },
  fronts: {},
  plotlines: [],
  foreshadows: [],
  anchors: [{ owner_table: "npc", owner_id: "钟三爷", target_table: "npc", target_id: "张三", role: "敌对" }],
};
const loreState = { draft: { ...draft, snapshot }, generating: false, seq: 1, error: null as null | { code: string; message: string }, liveTools: [] as unknown[], toolsByTurn: {} as Record<string, unknown[]>, refresh: vi.fn(), clearError: vi.fn() };
vi.mock("./useLoreSession.js", () => ({ useLoreSession: () => loreState }));

vi.mock("@/shell/useHealth.js", () => ({
  useHealth: () => ({ health: { model: { gm: "claude-opus-4-8", configured: true, baseUrl: null }, mcp: { toolCount: 0, running: true }, notify: { configured: false } }, offline: false }),
}));

import BuildPage from "./BuildPage.js";

beforeEach(() => {
  listLoreSessions.mockResolvedValue([{ sessionId: "l1", kind: "loregm", status: "active", title: "黑风寨的钟声", packName: "黑风寨的钟声", lastActionAt: Date.now() }]);
  validateDraft.mockResolvedValue([]);
  postBuildMessage.mockResolvedValue({ turnId: "t-1" });
  createLoreSession.mockResolvedValue("l2");
  loreState.generating = false; loreState.error = null; loreState.liveTools = []; loreState.toolsByTurn = {};
});
afterEach(() => { vi.clearAllMocks(); });

describe("BuildPage 三栏骨架 + sidenav 七组", () => {
  it("渲染 ctx 四按钮（校验/导入/提交/导出，提交≠导出）", async () => {
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-ctxbar")).toBeInTheDocument());
    expect(screen.getByTestId("build-validate-btn")).toBeInTheDocument();
    expect(screen.getByTestId("build-import-btn")).toBeInTheDocument();
    expect(screen.getByTestId("build-commit-btn")).toBeInTheDocument();
    expect(screen.getByTestId("build-export-btn")).toBeInTheDocument();
  });

  it("sidenav 五域 + 叙事脚手架 + relation nav + 素材 + guideline 进度全在", async () => {
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-nav-lore")).toBeInTheDocument());
    for (const k of ["lore", "npc", "pool", "rule", "state", "front", "plotline", "foreshadow", "anchor", "relation", "prologue", "manifest", "materials"]) {
      expect(screen.getByTestId(`build-nav-${k}`)).toBeInTheDocument();
    }
    for (const g of ["source", "world", "npc", "rule", "manifest"]) {
      expect(screen.getByTestId(`build-guideline-${g}`)).toBeInTheDocument();
    }
  });
});

describe("data-view 切换", () => {
  it("默认 lore 视图；点 NPC 切到 npc 卡；点关系切到 relation 边表", async () => {
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-editor")).toBeInTheDocument());
    // 挂载后 activeId 就绪会触发一次 [activeId] 视图复位（reset→lore）；先 flush 该 passive effect，
    // 避免首次点击被随后到来的复位覆盖。
    await act(async () => { await Promise.resolve(); });
    // lore 默认
    expect(screen.getByTestId("build-editor-title")).toHaveTextContent("世界设定");
    expect(within(screen.getByTestId("build-editor")).getByText("黑风寨")).toBeInTheDocument();
    // → npc
    fireEvent.click(screen.getByTestId("build-nav-npc"));
    expect(screen.getByTestId("build-editor-title")).toHaveTextContent("NPC");
    expect(within(screen.getByTestId("build-editor")).getByText("钟三爷")).toBeInTheDocument();
    // → relation（关系边表）
    fireEvent.click(screen.getByTestId("build-nav-relation"));
    expect(within(screen.getByTestId("build-editor")).getByText(/敌对/)).toBeInTheDocument();
  });

  it("guideline 阶段可点跳转到对应 data-view（缺口 #8）", async () => {
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-guideline-manifest")).toBeInTheDocument());
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByTestId("build-guideline-manifest"));
    expect(screen.getByTestId("build-editor-title")).toHaveTextContent("Manifest");
  });
});

describe("loregm 校验报告 UI（RT-FE11）", () => {
  it("点校验 → 调 validateDraft → 按 level 分级展示可跳转条目", async () => {
    validateDraft.mockResolvedValue([
      { level: "warn", path: "npc.哑婆", msg: "缺 sheet 卡" },
      { level: "error", path: "manifest.clock", msg: "引用的 attr 未声明" },
    ]);
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-validate-btn")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("build-validate-btn"));
    await waitFor(() => expect(validateDraft).toHaveBeenCalledWith("l1"));
    const items = await screen.findAllByTestId("build-validate-item");
    expect(items).toHaveLength(2);
    // 点第一条（npc.哑婆）→ data-jump=npc → 切到 npc 视图
    expect(items[0]).toHaveAttribute("data-jump", "npc");
    fireEvent.click(items[0]);
    expect(screen.getByTestId("build-editor-title")).toHaveTextContent("NPC");
  });

  it("零 error 零 warn → 全绿态 build-validate-ok（缺口 #10）", async () => {
    validateDraft.mockResolvedValue([]);
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-validate-btn")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("build-validate-btn"));
    expect(await screen.findByTestId("build-validate-ok")).toBeInTheDocument();
  });
});

describe("构建助手 + per-turn usage（RT-FE12 / RT-FE16）", () => {
  it("发消息 → postBuildMessage → 回合尾内联 turn-usage（含估价）", async () => {
    postBuildMessage.mockResolvedValue({ turnId: "t-9", usage: { inputTokens: 5100, outputTokens: 720, cacheReadTokens: 12400, cacheCreationTokens: 680 } });
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-send")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("build-assistant").parentElement!.querySelector("input.box")!, { target: { value: "加条阵线" } });
    fireEvent.click(screen.getByTestId("build-send"));
    await waitFor(() => expect(postBuildMessage).toHaveBeenCalledWith("l1", "加条阵线"));
    const tu = await screen.findByTestId("build-turn-usage");
    expect(tu.textContent).toContain("5 100");
    expect(tu.textContent).toContain("claude-opus-4-8");
  });

  it("生成中态显示 build-generating + live tools", async () => {
    loreState.generating = true;
    loreState.liveTools = [{ tool: "add_front", args: {}, ok: true }];
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-generating")).toBeInTheDocument());
    expect(screen.getByTestId("build-generating-tools").textContent).toContain("add_front");
  });

  it("loregm 领域错误 → build-assistant-error 通道展示（缺口 #3）", async () => {
    loreState.error = { code: "build_tool_error", message: "clock attr 未声明" };
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-assistant-error")).toBeInTheDocument());
    expect(screen.getByTestId("build-assistant-error").textContent).toContain("clock attr 未声明");
  });
});

describe("三态 + 新建会话（缺口 #2 / #12）", () => {
  it("无会话 → build-noSession-hint；点新建弹 build-new-modal（四字段）", async () => {
    listLoreSessions.mockResolvedValue([]);
    render(<BuildPage />);
    await waitFor(() => expect(screen.getByTestId("build-noSession-hint")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("build-session-new-main"));
    expect(await screen.findByTestId("build-new-modal")).toBeInTheDocument();
    for (const f of ["name", "flows", "clock", "entry"]) {
      expect(screen.getByTestId(`build-new-${f}`)).toBeInTheDocument();
    }
  });
});
