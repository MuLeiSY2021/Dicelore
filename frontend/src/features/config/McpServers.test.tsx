// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { McpServers } from "./McpServers.js";

// 后端 /mcp/* + /diagnostics/mcp-test 的 fetch 路由替身。
type Route = { status?: number; body: unknown };
function routeFetch(routes: Record<string, Route | (() => Route)>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.split("?")[0]}`;
    const r = routes[key] ?? routes[`${method} ${url}`];
    if (!r) throw new Error(`no route: ${key}`);
    const resolved = typeof r === "function" ? r() : r;
    const status = resolved.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => resolved.body } as Response;
  });
}

const emptyLists = {
  "GET /mcp/marketplaces": { body: { marketplaces: [] } },
  "GET /mcp/servers": { body: { servers: [] } },
};

beforeEach(() => { vi.stubGlobal("fetch", routeFetch(emptyLists)); });
afterEach(() => { vi.restoreAllMocks(); });

it("渲染核心 dicelore(标必需)与自定义 out-of-canon 说明 + 两按钮", async () => {
  render(<McpServers />);
  expect(screen.getByText("dicelore")).toBeInTheDocument();
  expect(screen.getByText(/必需/)).toBeInTheDocument();
  expect(screen.getAllByText(/out-of-canon/).length).toBeGreaterThan(0);
  expect(screen.getByText(/不参与 L3 审计/)).toBeInTheDocument();
  // 两按钮：添加 marketplace + 安装
  expect(screen.getByTestId("config-mcp-market-add")).toBeInTheDocument();
  expect(screen.getByTestId("config-mcp-install")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("config-mcp-empty")).toBeInTheDocument());
});

describe("按钮①：添加 marketplace", () => {
  it("填源 + 点击 → 调 POST /mcp/marketplaces → 展示源与可安装 MCP", async () => {
    const f = routeFetch({
      ...emptyLists,
      "POST /mcp/marketplaces": {
        body: {
          ok: true,
          marketplace: { name: "acme", source: "github", repo: "acme/mcp-market" },
          mcps: [{ name: "bocha-search", package: "@bocha/mcp@1.0.0", command: "npx", args: ["-y", "@bocha/mcp@1.0.0"], description: "博查搜索", envSchema: [{ key: "BOCHA_API_KEY", required: true }] }],
        },
      },
    });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);

    fireEvent.change(screen.getByLabelText("添加 marketplace"), { target: { value: "acme/mcp-market" } });
    fireEvent.click(screen.getByTestId("config-mcp-market-add"));

    await waitFor(() => expect(screen.getByText("bocha-search")).toBeInTheDocument());
    expect(screen.getByText("博查搜索")).toBeInTheDocument();
    expect(screen.getByText("acme/mcp-market")).toBeInTheDocument();
    const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/marketplaces");
    expect(call).toBeTruthy();
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ source: "acme/mcp-market" });
  });

  it("源非法 → 展示后端错误信息", async () => {
    vi.stubGlobal("fetch", routeFetch({
      ...emptyLists,
      "POST /mcp/marketplaces": { status: 400, body: { ok: false, message: "源非法" } },
    }));
    render(<McpServers />);
    fireEvent.change(screen.getByLabelText("添加 marketplace"), { target: { value: "??" } });
    fireEvent.click(screen.getByTestId("config-mcp-market-add"));
    await waitFor(() => expect(screen.getByTestId("config-mcp-err")).toHaveTextContent("源非法"));
  });
});

describe("按钮②：安装", () => {
  it("直装 npm 包 → 打开表单(推导 npx -y) → 确认 → POST /mcp/install → 列出 out-of-canon MCP", async () => {
    const f = routeFetch({
      ...emptyLists,
      "POST /mcp/install": {
        body: { ok: true, message: "预拉成功", server: { name: "some-mcp", package: "some-mcp@0.4.0", command: "npx", args: ["-y", "some-mcp@0.4.0"], installed: true, enabled: true, outOfCanon: true, env: { TOKEN: "t" } } },
      },
    });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);

    fireEvent.change(screen.getByLabelText("安装"), { target: { value: "some-mcp@0.4.0" } });
    fireEvent.click(screen.getByTestId("config-mcp-install"));

    // 表单出现 + command/args 推导
    const formEl = await screen.findByTestId("config-mcp-form");
    expect(within(formEl).getByLabelText("command")).toHaveValue("npx");
    expect(within(formEl).getByLabelText("args")).toHaveValue("-y some-mcp@0.4.0");
    expect(within(formEl).getByLabelText("实例名")).toHaveValue("some-mcp");

    // 加一个配置项
    fireEvent.click(screen.getByTestId("config-mcp-config-add"));
    fireEvent.change(screen.getByLabelText("配置项键 0"), { target: { value: "TOKEN" } });
    fireEvent.change(screen.getByLabelText("配置项值 0"), { target: { value: "t" } });

    fireEvent.click(screen.getByTestId("config-mcp-form-confirm"));

    await waitFor(() => expect(screen.getByTestId("config-mcp-item")).toBeInTheDocument());
    expect(screen.getByText("some-mcp")).toBeInTheDocument();
    const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/install");
    const sent = JSON.parse((call![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sent.spec).toBe("some-mcp@0.4.0");
    expect(sent.command).toBe("npx");
    expect(sent.env).toEqual({ TOKEN: "t" });
  });

  it("marketplace 装 → envSchema 预填必填项 → 只发 spec+env(不发 command/args)", async () => {
    const f = routeFetch({
      ...emptyLists,
      "POST /mcp/marketplaces": {
        body: {
          ok: true,
          marketplace: { name: "acme", source: "github", repo: "acme/mcp-market" },
          mcps: [{ name: "bocha-search", package: "@bocha/mcp@1.0.0", command: "npx", args: ["-y", "@bocha/mcp@1.0.0"], envSchema: [{ key: "BOCHA_API_KEY", required: true }] }],
        },
      },
      "POST /mcp/install": {
        body: { ok: true, message: "ok", server: { name: "bocha-search", package: "@bocha/mcp@1.0.0", command: "npx", args: ["-y", "@bocha/mcp@1.0.0"], fromMarketplace: "acme", installed: true, enabled: true, outOfCanon: true, env: { BOCHA_API_KEY: "k" } } },
      },
    });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);

    fireEvent.change(screen.getByLabelText("添加 marketplace"), { target: { value: "acme/mcp-market" } });
    fireEvent.click(screen.getByTestId("config-mcp-market-add"));
    // 从 marketplace 列表点该 MCP 的安装
    const mktInstall = await screen.findByTestId("config-mcp-market-install");
    fireEvent.click(mktInstall);

    const formEl = await screen.findByTestId("config-mcp-form");
    // envSchema 预填了 BOCHA_API_KEY 键
    expect(within(formEl).getByLabelText("配置项键 0")).toHaveValue("BOCHA_API_KEY");
    fireEvent.change(within(formEl).getByLabelText("配置项值 0"), { target: { value: "k" } });
    fireEvent.click(screen.getByTestId("config-mcp-form-confirm"));

    await waitFor(() => expect(screen.getByTestId("config-mcp-item")).toBeInTheDocument());
    const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/install");
    const sent = JSON.parse((call![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sent.spec).toBe("bocha-search@acme");
    expect(sent.command).toBeUndefined(); // marketplace 装不发 command/args
    expect(sent.env).toEqual({ BOCHA_API_KEY: "k" });
  });
});

describe("已装 MCP：开关 / 连接测试 / 删除", () => {
  const preinstalled = {
    "GET /mcp/marketplaces": { body: { marketplaces: [] } },
    "GET /mcp/servers": { body: { servers: [{ name: "my-mcp", package: "p@1", command: "npx", args: ["-y", "p@1"], installed: true, enabled: true, outOfCanon: true, env: {} }] } },
  };

  it("加载已装 MCP + out-of-canon 徽 + 开关调 toggle 端点", async () => {
    const f = routeFetch({ ...preinstalled, "POST /mcp/servers/my-mcp/toggle": { body: { ok: true, name: "my-mcp", enabled: false } } });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);
    await waitFor(() => expect(screen.getByText("my-mcp")).toBeInTheDocument());
    expect(screen.getAllByText("out-of-canon").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("config-mcp-toggle"));
    await waitFor(() => {
      const call = f.mock.calls.find((c) => String(c[0]) === "/mcp/servers/my-mcp/toggle");
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ enabled: false });
    });
  });

  it("连接测试 → 调 stdio mcp-test → 展示工具数", async () => {
    const f = routeFetch({ ...preinstalled, "POST /diagnostics/mcp-test": { body: { ok: true, toolCount: 3, message: "可达" } } });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);
    await screen.findByText("my-mcp");
    fireEvent.click(screen.getByTestId("config-mcp-test-btn"));
    await waitFor(() => expect(screen.getByText(/3 工具/)).toBeInTheDocument());
    const call = f.mock.calls.find((c) => String(c[0]) === "/diagnostics/mcp-test");
    expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({ transport: "stdio", command: "npx", args: ["-y", "p@1"] });
  });

  it("删除 → 调 DELETE 端点 → 从列表移除", async () => {
    const f = routeFetch({ ...preinstalled, "DELETE /mcp/servers/my-mcp": { body: { ok: true, name: "my-mcp" } } });
    vi.stubGlobal("fetch", f);
    render(<McpServers />);
    await screen.findByText("my-mcp");
    fireEvent.click(screen.getByLabelText(/删除 my-mcp/));
    await waitFor(() => expect(screen.queryByText("my-mcp")).not.toBeInTheDocument());
  });
});
